"""Face authentication service: frame quality, liveness, embeddings, matching.

Design (DEC-024): **1:1 verification only** (email + face, never 1:N search),
**server-side liveness** against a single-use challenge, **embeddings only**
(encrypted at rest, never images), feature-flagged behind ``FACE_AUTH_ENABLED``.

Every failure raises :class:`FaceAuthError` with a machine reason code that the
router writes to the audit log (never the raw similarity or embeddings to the
client). All checks **fail closed** — an unavailable model, missing landmarks
or a broken anti-spoof path rejects the attempt instead of passing it.

Heavy dependencies (insightface, onnxruntime) are imported lazily so the app
boots and the test suite runs without ``requirements-face.txt`` as long as the
flag is off. Tests inject synthetic detections by monkeypatching the
``_real_detections`` seam — no camera and no model download in CI.

Frame convention: the client captures **un-mirrored** frames (the subject's
left appears on the image right), so ``turn_left`` moves the nose toward image
right and yields a positive yaw net change.
"""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass

import numpy as np

from .. import config

logger = logging.getLogger("grievance-api")

# ── Constants ────────────────────────────────────────────────────────────────

FACE_EMBED_DIM = 512
MIN_FRAMES = 5
MAX_FRAMES = 8
MAX_FRAME_BYTES = 1_048_576  # 1 MB per decoded frame
MAX_REQUEST_BYTES = 4 * 1024 * 1024  # 4 MB total body cap (enforced in router)
CHALLENGE_TTL_SECONDS = 30
RATE_WINDOW_SECONDS = 900  # 15 minutes
USER_FAIL_LIMIT = 5  # per-user (verify-second-factor) / per-email (face login)
IP_FAIL_LIMIT = 20  # per-IP across public face endpoints

VALID_ACTIONS = ("turn_left", "turn_right", "blink", "smile")

MIN_DET_SCORE = 0.5
TURN_DIRECTION_JITTER = 2.0  # degrees of pose noise tolerated per step
TURN_AGREE_RATIO = 0.6  # ≥60% of deltas must agree with the net direction
MIN_OPEN_EAR = 0.18  # edge frames must show an open eye
ANTISPOOF_MIN_SCORE = 0.90
# The remaining thresholds (bbox minimum, blur floor, yaw delta, blink EAR
# drop, smile spread) are read from config.FACE_* at call time so a webcam can
# be tuned via env without code changes (DEC-024).


# ── Errors ───────────────────────────────────────────────────────────────────

class FaceAuthError(Exception):
    """Fail-closed verification error carrying a machine reason code.

    Reason codes are for audit logs only — routers must map every one of them
    to a generic client message so responses never distinguish failure modes.
    """

    def __init__(self, code: str, message: str = "Face verification failed"):
        super().__init__(message)
        self.code = code
        self.message = message


# ── Data shapes ──────────────────────────────────────────────────────────────

@dataclass
class Detection:
    """Insightface-independent detection result (the test seam works on this)."""

    bbox: tuple[float, float, float, float]
    det_score: float
    embedding: np.ndarray | None
    yaw_degrees: float | None = None  # from the 5-point kps
    eye_aspect: float | None = None  # from 2d106 landmarks (None = unavailable)
    mouth_width: float | None = None  # mouth corner distance / interocular


@dataclass
class VerifiedFace:
    """Outcome of a successful liveness + quality pass over the frames."""

    embedding: np.ndarray  # 512-d, L2-normed mean of the frame embeddings
    frame_count: int
    min_pair_similarity: float
    yaw_trace: list[float]


# ── Vector helpers ───────────────────────────────────────────────────────────

def normalize(vec: np.ndarray) -> np.ndarray:
    arr = np.asarray(vec, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(arr))
    if not math.isfinite(norm) or norm == 0.0:
        raise FaceAuthError("EMBEDDING_INVALID", "empty or non-finite embedding")
    return (arr / norm).astype(np.float32)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two embeddings (defensively re-normed)."""
    return float(np.dot(normalize(a), normalize(b)))


def aggregate_embeddings(vectors: list[np.ndarray]) -> np.ndarray:
    """Mean of frame embeddings, renormalized — the stored template vector."""
    if not vectors:
        raise FaceAuthError("EMBEDDING_INVALID", "no embeddings to aggregate")
    return normalize(np.mean(np.stack(vectors), axis=0))


# ── Encryption at rest (Fernet) ──────────────────────────────────────────────

def _fernet():
    from cryptography.fernet import Fernet

    key = config.FACE_EMBED_KEY
    if not key:
        raise FaceAuthError("KEY_MISSING", "FACE_EMBED_KEY is not configured")
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as exc:
        raise FaceAuthError("KEY_INVALID", "FACE_EMBED_KEY is not a valid Fernet key") from exc


def encrypt_embedding(vec: np.ndarray) -> str:
    """Encrypt an L2-normed embedding; only this token is ever persisted."""
    arr = normalize(vec).astype(np.float32)
    if arr.size != FACE_EMBED_DIM:
        raise FaceAuthError("EMBEDDING_INVALID", f"expected {FACE_EMBED_DIM} dimensions")
    return _fernet().encrypt(arr.tobytes()).decode()


def decrypt_embedding(token: str) -> np.ndarray:
    try:
        raw = _fernet().decrypt(token.encode())
    except FaceAuthError:
        raise
    except Exception as exc:
        raise FaceAuthError("DECRYPT_FAILED", "stored embedding could not be decrypted") from exc
    arr = np.frombuffer(raw, dtype=np.float32)
    if arr.size != FACE_EMBED_DIM:
        raise FaceAuthError("DECRYPT_FAILED", "stored embedding has the wrong size")
    return arr


def validate_embed_key() -> None:
    """Startup guard: raise ValueError when the flag is on but the key is not."""
    key = config.FACE_EMBED_KEY
    if not key:
        raise ValueError(
            "FACE_AUTH_ENABLED=true but FACE_EMBED_KEY is not set — "
            'generate one with: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    try:
        from cryptography.fernet import Fernet

        Fernet(key.encode())
    except ImportError as exc:
        raise ValueError("cryptography is not installed (pip install -r backend/requirements.txt)") from exc
    except Exception as exc:
        raise ValueError("FACE_EMBED_KEY is not a valid Fernet key") from exc


# ── Frame decode and quality ─────────────────────────────────────────────────

def decode_frame(jpeg: bytes) -> np.ndarray:
    """Base64-decoded JPEG bytes → RGB uint8 array. Fails closed."""
    if not jpeg:
        raise FaceAuthError("IMAGE_INVALID", "empty frame")
    if len(jpeg) > MAX_FRAME_BYTES:
        raise FaceAuthError("FRAME_TOO_LARGE", "frame exceeds 1 MB")
    if not jpeg.startswith(b"\xff\xd8"):
        raise FaceAuthError("IMAGE_INVALID", "frame is not a JPEG")
    from PIL import Image

    try:
        with Image.open(io.BytesIO(jpeg)) as img:
            rgb = img.convert("RGB")
            arr = np.asarray(rgb)
    except FaceAuthError:
        raise
    except Exception as exc:
        raise FaceAuthError("IMAGE_INVALID", "frame could not be decoded") from exc
    if arr.ndim != 3 or arr.shape[2] != 3 or arr.size == 0:
        raise FaceAuthError("IMAGE_INVALID", "frame decoded to an empty image")
    return arr


def laplacian_variance(gray: np.ndarray) -> float:
    """Sharpness proxy — variance of the discrete Laplacian (numpy only)."""
    g = np.asarray(gray, dtype=np.float64)
    if g.shape[0] < 3 or g.shape[1] < 3:
        return 0.0
    lap = (
        g[1:-1, :-2] + g[1:-1, 2:] + g[:-2, 1:-1] + g[2:, 1:-1] - 4.0 * g[1:-1, 1:-1]
    )
    return float(lap.var())


def select_single_face(detections: list[Detection]) -> Detection:
    """Exactly one sufficiently large, confident face — 0 or 2+ reject."""
    if len(detections) != 1:
        raise FaceAuthError("FACE_COUNT", f"expected 1 face, found {len(detections)}")
    det = detections[0]
    if det.det_score < MIN_DET_SCORE:
        raise FaceAuthError("DETECTION_FAILED", "low detection confidence")
    x1, y1, x2, y2 = det.bbox
    if (x2 - x1) < config.FACE_MIN_FACE_PX or (y2 - y1) < config.FACE_MIN_FACE_PX:
        raise FaceAuthError("FACE_TOO_SMALL", "face too small in frame")
    if det.embedding is None:
        raise FaceAuthError("DETECTION_FAILED", "no embedding for detected face")
    return det


# ── Geometric metrics (pure helpers — unit-tested with synthetic data) ──────

def _dist(a, b) -> float:
    return float(math.hypot(float(a[0]) - float(b[0]), float(a[1]) - float(b[1])))


def yaw_from_kps(kps, bbox) -> float:
    """Yaw proxy: nose lateral shift vs. mid-eye, scaled by half face width.

    Positive = nose moved toward image right (subject turning to their left
    under the un-mirrored capture convention).
    """
    x1, _, x2, _ = bbox
    half_width = max((x2 - x1) / 2.0, 1.0)
    mid_eye_x = (float(kps[0][0]) + float(kps[1][0])) / 2.0
    offset = float(kps[2][0]) - mid_eye_x
    ratio = max(-1.0, min(1.0, offset / half_width))
    return math.degrees(math.asin(ratio))


def mouth_width_from_kps(kps) -> float:
    """Mouth corner distance normalised by interocular distance."""
    interocular = _dist(kps[0], kps[1])
    if interocular <= 0:
        raise FaceAuthError("LANDMARKS_UNAVAILABLE", "degenerate eye geometry")
    return _dist(kps[3], kps[4]) / interocular


def eye_aspect_from_landmarks(landmarks, kps) -> float | None:
    """Height/width ratio of the eye contour, geometrically selected.

    The 106-point indices vary by model pack, so contour points are picked by
    proximity to the eye centres from the detection kps. Returns None when
    too few points are found — liveness then fails closed.
    """
    if landmarks is None or len(landmarks) < 4:
        return None
    interocular = _dist(kps[0], kps[1])
    if interocular <= 0:
        return None
    radius = 0.5 * interocular
    ratios: list[float] = []
    for centre in (kps[0], kps[1]):
        pts = [p for p in landmarks if _dist(p, centre) <= radius]
        if len(pts) < 5:
            return None
        xs = [float(p[0]) for p in pts]
        ys = [float(p[1]) for p in pts]
        width = max(xs) - min(xs)
        if width <= 0:
            return None
        ratios.append((max(ys) - min(ys)) / width)
    return float(sum(ratios) / len(ratios))


# ── Liveness ─────────────────────────────────────────────────────────────────

def check_action(action: str, detections: list[Detection]) -> None:
    """Verify the head-pose/landmark trace matches the challenge action."""
    if action not in VALID_ACTIONS:
        raise FaceAuthError("LIVENESS_FAILED", "unknown challenge action")
    if len(detections) < 3:
        raise FaceAuthError("LIVENESS_FAILED", "not enough frames for liveness")

    if action in ("turn_left", "turn_right"):
        yaws = [d.yaw_degrees for d in detections]
        if any(y is None for y in yaws):
            raise FaceAuthError("LANDMARKS_UNAVAILABLE", "pose estimates missing")
        net = yaws[-1] - yaws[0]
        signed_net = net if action == "turn_left" else -net
        if signed_net < config.FACE_TURN_MIN_DEGREES:
            raise FaceAuthError("LIVENESS_FAILED", "head turn too small")
        direction = 1.0 if signed_net > 0 else -1.0
        deltas = [b - a for a, b in zip(yaws, yaws[1:])]
        agreeing = sum(
            1
            for delta in deltas
            if (delta if action == "turn_left" else -delta) * direction >= -TURN_DIRECTION_JITTER
        )
        if agreeing < math.ceil(TURN_AGREE_RATIO * len(deltas)):
            raise FaceAuthError("LIVENESS_FAILED", "head turn direction inconsistent")

    elif action == "blink":
        ears = [d.eye_aspect for d in detections]
        if any(e is None for e in ears):
            raise FaceAuthError("LANDMARKS_UNAVAILABLE", "eye landmarks unavailable")
        edge = min(ears[0], ears[-1])
        mid = min(ears[1:-1])
        if edge < MIN_OPEN_EAR:
            raise FaceAuthError("LIVENESS_FAILED", "eyes not open at frame edges")
        if mid > config.FACE_BLINK_EAR_DROP * edge:
            raise FaceAuthError("LIVENESS_FAILED", "no blink observed")

    elif action == "smile":
        widths = [d.mouth_width for d in detections]
        if any(w is None for w in widths):
            raise FaceAuthError("LANDMARKS_UNAVAILABLE", "mouth landmarks unavailable")
        edge = (widths[0] + widths[-1]) / 2.0
        mid = sum(widths[1:-1]) / (len(widths) - 2)
        if mid < config.FACE_SMILE_MOUTH_WIDEN * edge:
            raise FaceAuthError("LIVENESS_FAILED", "no smile observed")


# ── Anti-spoofing (optional) ─────────────────────────────────────────────────

_antispoof_session: dict = {"path": None, "session": None}


def _antispoof_score(img: np.ndarray) -> float:
    """Passive Silent-Face score in [0, 1]; 1.0 when the check is disabled."""
    path = config.FACE_ANTISPOOF_MODEL_PATH
    if not path:
        return 1.0
    if _antispoof_session["session"] is None or _antispoof_session["path"] != path:
        try:
            import onnxruntime as ort

            _antispoof_session["session"] = ort.InferenceSession(
                path, providers=["CPUExecutionProvider"]
            )
            _antispoof_session["path"] = path
        except Exception as exc:
            # Configured but broken → fail closed.
            raise FaceAuthError("ANTISPOOF_UNAVAILABLE", "anti-spoof model failed to load") from exc
    session = _antispoof_session["session"]
    try:
        spec = session.get_inputs()[0]
        shape = spec.shape  # (N, C, H, W) or (N, H, W, C)
        height = int(shape[2]) if isinstance(shape[2], int) and shape[2] > 0 else 80
        width = int(shape[3]) if isinstance(shape[3], int) and shape[3] > 0 else 80
        from PIL import Image as _Image

        resized = _Image.fromarray(img).resize((width, height))
        plane = np.asarray(resized, dtype=np.float32) / 255.0
        # NHWC only when the last axis is clearly the channel axis.
        hwc = len(shape) == 4 and shape[-1] in (1, 3)
        tensor = plane if hwc else plane.transpose(2, 0, 1)
        tensor = np.expand_dims(tensor, 0)
        outputs = session.run(None, {spec.name: tensor})
        values = np.asarray(outputs[0], dtype=np.float64).reshape(-1)
        if values.size > 1:  # logits → probabilities; take the most confident class
            values = np.exp(values - values.max())
            values = values / values.sum()
        score = float(values.max())
    except FaceAuthError:
        raise
    except Exception as exc:
        raise FaceAuthError("ANTISPOOF_UNAVAILABLE", "anti-spoof scoring failed") from exc
    if not math.isfinite(score) or score < ANTISPOOF_MIN_SCORE:
        raise FaceAuthError("ANTISPOOF_FAILED", "anti-spoof score too low")
    return score


# ── Detection seam (real insightface path) ───────────────────────────────────

_ANALYZERS: dict[str, object] = {}


def _get_analyzer():
    """Lazy singleton FaceAnalysis for the configured model pack."""
    name = config.FACE_MODEL_NAME
    cached = _ANALYZERS.get(name)
    if cached is not None:
        return cached
    try:
        from insightface.app import FaceAnalysis
    except Exception as exc:
        logger.error("insightface unavailable: %s", exc)
        raise FaceAuthError("SERVICE_UNAVAILABLE", "face model is not installed") from exc
    try:
        analyzer = FaceAnalysis(name=name, providers=["CPUExecutionProvider"])
        analyzer.prepare(ctx_id=-1, det_size=(640, 640))
    except Exception as exc:
        logger.exception("failed to load face model %r", name)
        raise FaceAuthError("SERVICE_UNAVAILABLE", "face model failed to load") from exc
    _ANALYZERS[name] = analyzer
    logger.info("Face model loaded: %s", name)
    return analyzer


def _to_detection(face) -> Detection:
    bbox = tuple(float(v) for v in getattr(face, "bbox", (0, 0, 0, 0)))
    det_score = float(getattr(face, "det_score", 0.0))
    embedding: np.ndarray | None = None
    normed = getattr(face, "normed_embedding", None)
    if normed is not None:
        embedding = np.asarray(normed, dtype=np.float32)
    else:
        raw = getattr(face, "embedding", None)
        if raw is not None:
            try:
                embedding = normalize(np.asarray(raw, dtype=np.float32))
            except FaceAuthError:
                embedding = None
    kps = getattr(face, "kps", None)
    yaw = mouth = None
    ear = None
    if kps is not None:
        try:
            yaw = yaw_from_kps(kps, bbox)
            mouth = mouth_width_from_kps(kps)
            ear = eye_aspect_from_landmarks(getattr(face, "landmark_2d_106", None), kps)
        except FaceAuthError:
            yaw = mouth = ear = None
    return Detection(
        bbox=bbox,
        det_score=det_score,
        embedding=embedding,
        yaw_degrees=yaw,
        eye_aspect=ear,
        mouth_width=mouth,
    )


def _real_detections(img: np.ndarray) -> list[Detection]:
    """Run insightface on one decoded frame (RGB → BGR for the model)."""
    analyzer = _get_analyzer()
    bgr = np.ascontiguousarray(img[:, :, ::-1])
    try:
        faces = analyzer.get(bgr)
    except Exception as exc:
        logger.exception("face detection failed")
        raise FaceAuthError("DETECTION_FAILED", "face detection failed") from exc
    return [_to_detection(face) for face in faces]


# ── Orchestration ────────────────────────────────────────────────────────────

def _verify_frames_debug(
    frames: list[bytes],
    action: str | None,
    *,
    template: dict | None = None,
    op: str = "verify",
) -> VerifiedFace:
    """Full-diagnostic path when FACE_DEBUG=true. Inspects all frames, logs one
    detailed metric line, and then raises the first failing check if any."""
    frames_received = len(frames)
    threshold = config.FACE_MATCH_THRESHOLD
    frames_with_exactly_one_face = 0
    det_scores: list[float] = []
    bbox_pxs: list[float] = []
    blur_vars: list[float] = []
    yaws: list[float] = []
    ears: list[float] = []
    mouth_widths: list[float] = []
    candidates: list[tuple[np.ndarray, Detection]] = []
    detections: list[Detection] = []
    first_failing_check: str | None = None
    first_failing_exc: FaceAuthError | None = None

    if not (MIN_FRAMES <= frames_received <= MAX_FRAMES):
        first_failing_check = "FRAME_COUNT"
        first_failing_exc = FaceAuthError("FRAME_COUNT", f"expected {MIN_FRAMES}-{MAX_FRAMES} frames")
    elif action is not None and action not in VALID_ACTIONS:
        first_failing_check = "LIVENESS_FAILED(unknown_action)"
        first_failing_exc = FaceAuthError("LIVENESS_FAILED", "unknown challenge action")

    for jpeg in frames:
        img = None
        try:
            img = decode_frame(jpeg)
        except FaceAuthError as exc:
            if first_failing_check is None:
                first_failing_check = exc.code
                first_failing_exc = exc
        except Exception:
            if first_failing_check is None:
                first_failing_check = "IMAGE_INVALID"
                first_failing_exc = FaceAuthError("IMAGE_INVALID", "frame could not be decoded")

        if img is not None:
            gray = img.mean(axis=2)
            b_var = laplacian_variance(gray)
            blur_vars.append(b_var)
            frame_passed_quality = True
            if b_var < config.FACE_MIN_BLUR_VARIANCE:
                frame_passed_quality = False
                if first_failing_check is None:
                    first_failing_check = f"FACE_BLURRY(var={b_var:.1f}<{config.FACE_MIN_BLUR_VARIANCE})"
                    first_failing_exc = FaceAuthError("FACE_BLURRY", "frame is too blurry")

            try:
                raw_dets = _real_detections(img)
                if len(raw_dets) == 1:
                    frames_with_exactly_one_face += 1
                    det = raw_dets[0]
                    detections.append(det)
                    det_scores.append(det.det_score)
                    x1, y1, x2, y2 = det.bbox
                    min_side = min(x2 - x1, y2 - y1)
                    bbox_pxs.append(min_side)

                    if det.det_score < MIN_DET_SCORE:
                        frame_passed_quality = False
                        if first_failing_check is None:
                            first_failing_check = f"DETECTION_FAILED(det_score={det.det_score:.3f}<{MIN_DET_SCORE})"
                            first_failing_exc = FaceAuthError("DETECTION_FAILED", "low detection confidence")
                    elif min_side < config.FACE_MIN_FACE_PX:
                        frame_passed_quality = False
                        if first_failing_check is None:
                            first_failing_check = f"FACE_TOO_SMALL({min_side:.0f}px<{config.FACE_MIN_FACE_PX}px)"
                            first_failing_exc = FaceAuthError("FACE_TOO_SMALL", "face too small in frame")

                    if det.yaw_degrees is not None:
                        yaws.append(det.yaw_degrees)
                    if det.eye_aspect is not None:
                        ears.append(det.eye_aspect)
                    if det.mouth_width is not None:
                        mouth_widths.append(det.mouth_width)

                    try:
                        _antispoof_score(img)
                    except FaceAuthError as exc:
                        frame_passed_quality = False
                        if first_failing_check is None:
                            first_failing_check = exc.code
                            first_failing_exc = exc

                    if frame_passed_quality:
                        candidates.append((img, det))
                else:
                    if first_failing_check is None:
                        first_failing_check = f"FACE_COUNT({len(raw_dets)})"
                        first_failing_exc = FaceAuthError("FACE_COUNT", f"expected 1 face, found {len(raw_dets)}")
            except FaceAuthError as exc:
                if first_failing_check is None:
                    first_failing_check = exc.code
                    first_failing_exc = exc
            except Exception:
                if first_failing_check is None:
                    first_failing_check = "DETECTION_FAILED"
                    first_failing_exc = FaceAuthError("DETECTION_FAILED", "face detection failed")

    # Recognition and template matching on the 3 most frontal frames
    frontal = sorted(
        candidates,
        key=lambda item: (
            abs(item[1].yaw_degrees if item[1].yaw_degrees is not None else 0.0),
            -item[1].det_score,
        ),
    )[:3]
    embeddings: list[np.ndarray] = [normalize(d.embedding) for _, d in frontal if d.embedding is not None]

    pairwise_sims: list[float] = []
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            pairwise_sims.append(similarity(embeddings[i], embeddings[j]))

    min_pair_sim = min(pairwise_sims) if pairwise_sims else None
    mean_pair_sim = (sum(pairwise_sims) / len(pairwise_sims)) if pairwise_sims else None

    if (
        min_pair_sim is not None
        and min_pair_sim < config.FACE_CONSISTENCY_THRESHOLD
        and first_failing_check is None
    ):
        first_failing_check = (
            f"INCONSISTENT_FRAMES(min_cos={min_pair_sim:.3f}<{config.FACE_CONSISTENCY_THRESHOLD:.2f})"
        )
        first_failing_exc = FaceAuthError("INCONSISTENT_FRAMES", "frames show different faces")

    if action is not None and len(detections) >= len(frames):
        try:
            check_action(action, detections)
        except FaceAuthError as exc:
            if first_failing_check is None:
                first_failing_check = f"LIVENESS_FAILED({exc.message})"
                first_failing_exc = exc

    sim_to_template = None
    if template is not None and embeddings:
        try:
            stored = decrypt_embedding(template.get("encryptedEmbedding", ""))
            agg_emb = aggregate_embeddings(embeddings)
            sim_to_template = similarity(stored, agg_emb)
            if sim_to_template < threshold and first_failing_check is None:
                first_failing_check = f"below_threshold(sim={sim_to_template:.3f}<{threshold:.2f})"
        except Exception as exc:
            if first_failing_check is None:
                first_failing_check = f"TEMPLATE_ERROR({exc})"

    ear_ratio_str = "N/A"
    if ears and max(ears) > 0:
        ear_ratio_str = f"{min(ears) / max(ears):.2f}"

    smile_ratio_str = "N/A"
    if mouth_widths and len(mouth_widths) >= 3:
        edge_mw = (mouth_widths[0] + mouth_widths[-1]) / 2.0
        mid_mw = sum(mouth_widths[1:-1]) / (len(mouth_widths) - 2)
        smile_ratio_str = f"{mid_mw / edge_mw:.2f}" if edge_mw > 0 else "N/A"

    yaw_str = "N/A"
    if yaws:
        y_first = yaws[0]
        y_last = yaws[-1]
        y_delta = y_last - y_first
        y_list = ", ".join(f"{y:+.1f}" for y in yaws)
        yaw_str = f"[{y_list}] (first={y_first:+.1f}, last={y_last:+.1f}, delta={y_delta:+.1f})"

    det_score_min_str = f"{min(det_scores):.3f}" if det_scores else "N/A"
    bbox_px_min_str = f"{int(min(bbox_pxs))}" if bbox_pxs else "N/A"
    blur_var_min_str = f"{min(blur_vars):.1f}" if blur_vars else "N/A"
    pair_min_str = f"{min_pair_sim:.3f}" if min_pair_sim is not None else "N/A"
    pair_mean_str = f"{mean_pair_sim:.3f}" if mean_pair_sim is not None else "N/A"
    sim_template_str = f"{sim_to_template:.3f}" if sim_to_template is not None else "N/A"
    failing_name_str = first_failing_check if first_failing_check is not None else "None"

    # Exactly one log line with the required metrics
    logger.info(
        "[FACE_DEBUG] action=%s, frames_received=%d, frames_with_exactly_one_face=%d, "
        "det_score min=%s, bbox px min=%s, blur variance min=%s, "
        "yaw per frame=%s, EAR min/max ratio=%s, smile spread ratio=%s, "
        "pairwise cosine min/mean across frames=%s/%s, similarity to template=%s, "
        "threshold=%.2f, first failing check name=%s",
        f"{op}:{action}" if action else op,
        frames_received,
        frames_with_exactly_one_face,
        det_score_min_str,
        bbox_px_min_str,
        blur_var_min_str,
        yaw_str,
        ear_ratio_str,
        smile_ratio_str,
        pair_min_str,
        pair_mean_str,
        sim_template_str,
        threshold,
        failing_name_str,
    )

    if first_failing_exc is not None:
        raise first_failing_exc

    return VerifiedFace(
        embedding=aggregate_embeddings(embeddings),
        frame_count=len(embeddings),
        min_pair_similarity=min_pair_sim if min_pair_sim is not None else 1.0,
        yaw_trace=[d.yaw_degrees or 0.0 for d in detections],
    )


def verify_frames(
    frames: list[bytes],
    action: str | None,
    *,
    template: dict | None = None,
    op: str = "verify",
) -> VerifiedFace:
    """Decode, quality-check, anti-spoof, liveness-check and embed the frames.

    Raises FaceAuthError (fail closed) on any violation. On success the frame
    embeddings are mutually consistent and reduced to one mean vector.
    """
    if config.FACE_DEBUG:
        return _verify_frames_debug(frames, action, template=template, op=op)

    if not (MIN_FRAMES <= len(frames) <= MAX_FRAMES):
        raise FaceAuthError("FRAME_COUNT", f"expected {MIN_FRAMES}-{MAX_FRAMES} frames")
    if action is not None and action not in VALID_ACTIONS:
        raise FaceAuthError("LIVENESS_FAILED", "unknown challenge action")

    detections: list[Detection] = []
    candidates: list[tuple[np.ndarray, Detection]] = []
    for jpeg in frames:
        img = decode_frame(jpeg)
        det = select_single_face(_real_detections(img))
        gray = img.mean(axis=2)
        if laplacian_variance(gray) < config.FACE_MIN_BLUR_VARIANCE:
            raise FaceAuthError("FACE_BLURRY", "frame is too blurry")
        _antispoof_score(img)
        detections.append(det)
        candidates.append((img, det))

    if action is not None:
        check_action(action, detections)

    # Recognition and template matching on the 3 most frontal frames
    frontal = sorted(
        candidates,
        key=lambda item: (
            abs(item[1].yaw_degrees if item[1].yaw_degrees is not None else 0.0),
            -item[1].det_score,
        ),
    )[:3]
    embeddings = [normalize(det.embedding) for _, det in frontal if det.embedding is not None]

    # Pairwise consistency check across the 3 frontal frames
    min_sim = 1.0
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            pair = similarity(embeddings[i], embeddings[j])
            min_sim = min(min_sim, pair)
            if pair < config.FACE_CONSISTENCY_THRESHOLD:
                raise FaceAuthError("INCONSISTENT_FRAMES", "frames show different faces")

    return VerifiedFace(
        embedding=aggregate_embeddings(embeddings),
        frame_count=len(embeddings),
        min_pair_similarity=min_sim,
        yaw_trace=[d.yaw_degrees or 0.0 for d in detections],
    )


def check_template_compatibility(template: dict) -> None:
    """A template from another model pack requires re-enrollment (DEC-024)."""
    stored = template.get("modelName", "")
    if stored != config.FACE_MODEL_NAME:
        raise FaceAuthError(
            "MODEL_MISMATCH",
            f"template model {stored!r} != current {config.FACE_MODEL_NAME!r}",
        )


def similarity_to_template(template: dict, face: VerifiedFace) -> float:
    """Cosine similarity of the verified frames against the stored template."""
    check_template_compatibility(template)
    stored = decrypt_embedding(template.get("encryptedEmbedding", ""))
    return similarity(stored, face.embedding)
