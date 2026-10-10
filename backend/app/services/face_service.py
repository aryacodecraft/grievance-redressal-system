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

import contextvars
import io
import logging
import math
import statistics
import time
from dataclasses import dataclass, field

import numpy as np

from .. import config

logger = logging.getLogger("grievance-api")

@dataclass
class FaceTiming:
    request_t0: float = field(default_factory=time.perf_counter)
    body_size_kb: float = 0.0
    json_parse_ms: float = 0.0
    base64_decode_ms: float = 0.0
    jpeg_decode_ms: float = 0.0
    detection_ms: float = 0.0
    landmarks_ms: float = 0.0
    embedding_ms: float = 0.0
    liveness_ms: float = 0.0
    db_challenge_ms: float = 0.0
    db_ratelimit_ms: float = 0.0
    db_template_ms: float = 0.0
    db_audit_ms: float = 0.0
    total_ms: float = 0.0

    def log(self):
        logger.info(
            "[FACE_TIMING] body_size_kb=%.1f, json_parse_ms=%.1f, base64_decode_ms=%.1f, "
            "jpeg_decode_ms=%.1f, detection_ms=%.1f, landmarks_ms=%.1f, embedding_ms=%.1f, "
            "liveness_ms=%.1f, db_ms=(challenge=%.1f, ratelimit=%.1f, template=%.1f, audit=%.1f), "
            "total_ms=%.1f",
            self.body_size_kb,
            self.json_parse_ms,
            self.base64_decode_ms,
            self.jpeg_decode_ms,
            self.detection_ms,
            self.landmarks_ms,
            self.embedding_ms,
            self.liveness_ms,
            self.db_challenge_ms,
            self.db_ratelimit_ms,
            self.db_template_ms,
            self.db_audit_ms,
            self.total_ms,
        )


_CURRENT_TIMING: contextvars.ContextVar[FaceTiming | None] = contextvars.ContextVar(
    "current_face_timing", default=None
)
_CURRENT_B64_TIME: contextvars.ContextVar[float] = contextvars.ContextVar(
    "current_b64_time", default=0.0
)

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
    kps: np.ndarray | None = None


@dataclass
class VerifiedFace:
    """Outcome of a successful liveness + quality pass over the frames."""

    embedding: np.ndarray  # 512-d, L2-normed mean of the frame embeddings
    frame_count: int
    min_pair_similarity: float
    yaw_trace: list[float]
    binding_score: float | None = None


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
    t0 = time.perf_counter()
    try:
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
    finally:
        timing = _CURRENT_TIMING.get()
        if timing is not None:
            timing.jpeg_decode_ms += (time.perf_counter() - t0) * 1000


def laplacian_variance(gray: np.ndarray) -> float:
    """Sharpness proxy — variance of the discrete Laplacian (numpy only)."""
    g = np.asarray(gray, dtype=np.float64)
    if g.shape[0] < 3 or g.shape[1] < 3:
        return 0.0
    lap = (
        g[1:-1, :-2] + g[1:-1, 2:] + g[:-2, 1:-1] + g[2:, 1:-1] - 4.0 * g[1:-1, 1:-1]
    )
    return float(lap.var())


def select_single_face(detections: list[Detection], *, require_embedding: bool = True) -> Detection:
    """Exactly one sufficiently large, confident face — 0 or 2+ reject."""
    if len(detections) != 1:
        raise FaceAuthError("FACE_COUNT", f"expected 1 face, found {len(detections)}")
    det = detections[0]
    if det.det_score < MIN_DET_SCORE:
        raise FaceAuthError("DETECTION_FAILED", "low detection confidence")
    x1, y1, x2, y2 = det.bbox
    if (x2 - x1) < config.FACE_MIN_FACE_PX or (y2 - y1) < config.FACE_MIN_FACE_PX:
        raise FaceAuthError("FACE_TOO_SMALL", "face too small in frame")
    if require_embedding and det.embedding is None:
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
    t0 = time.perf_counter()
    try:
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
            valid_ears = [d.eye_aspect for d in detections if d.eye_aspect is not None]
            if len(valid_ears) < 3:
                raise FaceAuthError("LANDMARKS_UNAVAILABLE", "eye landmarks unavailable")
            sorted_ears = sorted(valid_ears)
            top_half = sorted_ears[len(sorted_ears) // 2:]
            baseline = float(statistics.median(top_half))
            if baseline < MIN_OPEN_EAR:
                raise FaceAuthError("LIVENESS_FAILED", "eyes not open at frame edges")
            min_ear = min(valid_ears)
            if min_ear > config.FACE_BLINK_EAR_DROP * baseline:
                raise FaceAuthError("LIVENESS_FAILED", "no blink observed")

        elif action == "smile":
            valid_widths = [d.mouth_width for d in detections if d.mouth_width is not None]
            if len(valid_widths) < 3:
                raise FaceAuthError("LANDMARKS_UNAVAILABLE", "mouth landmarks unavailable")
            sorted_w = sorted(valid_widths)
            half_len = max(1, len(sorted_w) // 2)
            baseline = float(statistics.median(sorted_w[:half_len]))
            max_width = max(valid_widths)
            if max_width < config.FACE_SMILE_MOUTH_WIDEN * baseline:
                raise FaceAuthError("LIVENESS_FAILED", "no smile observed")
    finally:
        timing = _CURRENT_TIMING.get()
        if timing is not None:
            timing.liveness_ms += (time.perf_counter() - t0) * 1000


def pick_action_candidate(
    candidates: list[tuple[np.ndarray, Detection]], action: str
) -> tuple[np.ndarray, Detection] | None:
    """Select the candidate frame that corresponds to the liveness action."""
    if not candidates:
        return None
    if action in ("turn_left", "turn_right"):
        return max(
            candidates,
            key=lambda item: abs(item[1].yaw_degrees if item[1].yaw_degrees is not None else 0.0),
        )
    if action == "blink":
        valid = [c for c in candidates if c[1].eye_aspect is not None]
        if valid:
            return min(valid, key=lambda item: item[1].eye_aspect)  # type: ignore[arg-type]
        return candidates[0]
    if action == "smile":
        valid = [c for c in candidates if c[1].mouth_width is not None]
        if valid:
            return max(valid, key=lambda item: item[1].mouth_width)  # type: ignore[arg-type]
        return candidates[0]
    return None
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

import threading as _threading

_ANALYZERS: dict[str, object] = {}
_ANALYZER_LOCK = _threading.Lock()


def _get_analyzer():
    """Lazy singleton FaceAnalysis for the configured model pack."""
    name = config.FACE_MODEL_NAME
    cached = _ANALYZERS.get(name)
    if cached is not None:
        return cached
    with _ANALYZER_LOCK:
        cached = _ANALYZERS.get(name)
        if cached is not None:
            return cached
        try:
            from insightface.app import FaceAnalysis
        except Exception as exc:
            logger.error("insightface unavailable: %s", exc)
            raise FaceAuthError("SERVICE_UNAVAILABLE", "face model is not installed") from exc
        try:
            import os
            import onnxruntime as ort

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = min(4, os.cpu_count() or 1)

            analyzer = FaceAnalysis(
                name=name,
                allowed_modules=["detection", "landmark_2d_106", "recognition"],
                providers=["CPUExecutionProvider"],
                sess_options=opts,
            )
            det_size = max(320, config.FACE_DET_SIZE)
            analyzer.prepare(ctx_id=-1, det_size=(det_size, det_size))
        except Exception as exc:
            logger.exception("failed to load face model %r", name)
            raise FaceAuthError("SERVICE_UNAVAILABLE", "face model failed to load") from exc
        _ANALYZERS[name] = analyzer
        logger.info("Face model loaded: %s (det_size=%d, allowed_modules=detection,landmark_2d_106,recognition)", name, det_size)
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
        kps=kps,
    )


def _real_detections(img: np.ndarray) -> list[Detection]:
    """Run insightface detection + landmarks on one decoded frame (RGB -> BGR)."""
    timing = _CURRENT_TIMING.get()
    analyzer = _get_analyzer()
    bgr = np.ascontiguousarray(img[:, :, ::-1])
    try:
        t0 = time.perf_counter()
        bboxes, kpss = analyzer.det_model.detect(bgr, max_num=0, metric="default")
        if timing is not None:
            timing.detection_ms += (time.perf_counter() - t0) * 1000

        if bboxes.shape[0] == 0:
            return []

        from insightface.app.common import Face

        faces = []
        for i in range(bboxes.shape[0]):
            face = Face(
                bbox=bboxes[i, 0:4],
                kps=kpss[i] if kpss is not None else None,
                det_score=bboxes[i, 4],
            )
            t0 = time.perf_counter()
            if "landmark_2d_106" in analyzer.models:
                analyzer.models["landmark_2d_106"].get(bgr, face)
            if timing is not None:
                timing.landmarks_ms += (time.perf_counter() - t0) * 1000
            # Recognition is deferred to _real_embed for the top 3 frontal frames.
            faces.append(face)
    except Exception as exc:
        logger.exception("face detection failed")
        raise FaceAuthError("DETECTION_FAILED", "face detection failed") from exc
    return [_to_detection(face) for face in faces]


def _real_embed(img: np.ndarray, det: Detection) -> np.ndarray:
    """Run ArcFace embedding on one detected face crop (the 3-frame path)."""
    timing = _CURRENT_TIMING.get()
    t0 = time.perf_counter()
    try:
        if det.embedding is not None:
            return normalize(det.embedding)
        analyzer = _get_analyzer()
        if "recognition" not in analyzer.models:
            raise FaceAuthError("SERVICE_UNAVAILABLE", "recognition model not available")
        from insightface.app.common import Face

        face = Face(
            bbox=np.asarray(det.bbox),
            kps=det.kps,
            det_score=det.det_score,
        )
        bgr = np.ascontiguousarray(img[:, :, ::-1])
        analyzer.models["recognition"].get(bgr, face)
        normed = getattr(face, "normed_embedding", None)
        if normed is not None:
            emb = np.asarray(normed, dtype=np.float32)
        else:
            raw = getattr(face, "embedding", None)
            if raw is None:
                raise FaceAuthError("DETECTION_FAILED", "failed to extract embedding")
            emb = np.asarray(raw, dtype=np.float32)
        res = normalize(emb)
        det.embedding = res
        return res
    finally:
        if timing is not None:
            timing.embedding_ms += (time.perf_counter() - t0) * 1000


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
    embeddings: list[np.ndarray] = []
    detections: list[Detection] = []
    first_failing_check: str | None = None
    first_failing_exc: FaceAuthError | None = None

    if not (MIN_FRAMES <= frames_received <= MAX_FRAMES):
        first_failing_check = "FRAME_COUNT"
        first_failing_exc = FaceAuthError("FRAME_COUNT", f"expected {MIN_FRAMES}-{MAX_FRAMES} frames")
    elif action is not None and action not in VALID_ACTIONS:
        first_failing_check = "LIVENESS_FAILED(unknown_action)"
        first_failing_exc = FaceAuthError("LIVENESS_FAILED", "unknown challenge action")

    candidates: list[tuple[np.ndarray, Detection]] = []
    frame_errors: list[tuple[str, FaceAuthError]] = []
    for jpeg in frames:
        img = None
        current_frame_error: tuple[str, FaceAuthError] | None = None
        try:
            img = decode_frame(jpeg)
        except FaceAuthError as exc:
            current_frame_error = (exc.code, exc)
        except Exception:
            current_frame_error = ("IMAGE_INVALID", FaceAuthError("IMAGE_INVALID", "frame could not be decoded"))

        if img is not None:
            gray = img.mean(axis=2)
            b_var = laplacian_variance(gray)
            blur_vars.append(b_var)
            frame_passed_quality = True
            if b_var < config.FACE_MIN_BLUR_VARIANCE:
                frame_passed_quality = False
                if current_frame_error is None:
                    current_frame_error = (
                        f"FACE_BLURRY(var={b_var:.1f}<{config.FACE_MIN_BLUR_VARIANCE})",
                        FaceAuthError("FACE_BLURRY", "frame is too blurry"),
                    )

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
                        if current_frame_error is None:
                            current_frame_error = (
                                f"DETECTION_FAILED(det_score={det.det_score:.3f}<{MIN_DET_SCORE})",
                                FaceAuthError("DETECTION_FAILED", "low detection confidence"),
                            )
                    elif min_side < config.FACE_MIN_FACE_PX:
                        frame_passed_quality = False
                        if current_frame_error is None:
                            current_frame_error = (
                                f"FACE_TOO_SMALL({min_side:.0f}px<{config.FACE_MIN_FACE_PX}px)",
                                FaceAuthError("FACE_TOO_SMALL", "face too small in frame"),
                            )

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
                        if current_frame_error is None:
                            current_frame_error = (exc.code, exc)

                    if frame_passed_quality and current_frame_error is None:
                        candidates.append((img, det))
                else:
                    if current_frame_error is None:
                        current_frame_error = (
                            f"FACE_COUNT({len(raw_dets)})",
                            FaceAuthError("FACE_COUNT", f"expected 1 face, found {len(raw_dets)}"),
                        )
            except FaceAuthError as exc:
                if current_frame_error is None:
                    current_frame_error = (exc.code, exc)
            except Exception:
                if current_frame_error is None:
                    current_frame_error = (
                        "DETECTION_FAILED",
                        FaceAuthError("DETECTION_FAILED", "face detection failed"),
                    )

        if current_frame_error is not None:
            frame_errors.append(current_frame_error)

    # Frame tolerance: reject fewer than 5 valid frames; tolerate 1 failed frame out of >=6
    # as long as at least 3 frontal frames pass.
    tolerated = len(frames) >= 6 and len(frame_errors) <= 1 and len(candidates) >= 5
    if frame_errors and not tolerated and first_failing_check is None:
        first_failing_check = frame_errors[0][0]
        first_failing_exc = frame_errors[0][1]

    # Run recognition only on the 3 most frontal frames that pass quality (smallest |yaw|, highest det_score).
    frontal = sorted(
        candidates,
        key=lambda item: (
            abs(item[1].yaw_degrees if item[1].yaw_degrees is not None else 0.0),
            -item[1].det_score,
        ),
    )[:3]
    if len(frontal) < 3 and first_failing_check is None:
        if frame_errors:
            first_failing_check, first_failing_exc = frame_errors[0]
        else:
            first_failing_check = "DETECTION_FAILED"
            first_failing_exc = FaceAuthError("DETECTION_FAILED", "fewer than 3 frontal frames passed quality")

    for c_img, c_det in frontal:
        try:
            emb = _real_embed(c_img, c_det)
            embeddings.append(emb)
        except Exception:
            pass

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

    if action is not None and len(detections) >= 5:
        try:
            check_action(action, detections)
        except FaceAuthError as exc:
            if first_failing_check is None:
                first_failing_check = f"LIVENESS_FAILED({exc.message})"
                first_failing_exc = exc

    binding_sim: float | None = None
    if action is not None and candidates and embeddings:
        action_cand = pick_action_candidate(candidates, action)
        if action_cand is not None:
            try:
                action_emb = _real_embed(action_cand[0], action_cand[1])
                agg_frontal = aggregate_embeddings(embeddings)
                binding_sim = similarity(action_emb, agg_frontal)
                if (
                    binding_sim < config.FACE_BINDING_THRESHOLD
                    and first_failing_check is None
                ):
                    first_failing_check = (
                        f"LIVENESS_IDENTITY_MISMATCH(binding_sim={binding_sim:.3f}<{config.FACE_BINDING_THRESHOLD:.2f})"
                    )
                    first_failing_exc = FaceAuthError(
                        "LIVENESS_IDENTITY_MISMATCH",
                        "liveness frame does not match frontal face",
                    )
            except FaceAuthError as exc:
                if first_failing_check is None:
                    first_failing_check = exc.code
                    first_failing_exc = exc
            except Exception as exc:
                if first_failing_check is None:
                    first_failing_check = f"EMBED_ERROR({exc})"
                    first_failing_exc = FaceAuthError("DETECTION_FAILED", "embedding failed")

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
    valid_ears = [e for e in ears if e is not None]
    if valid_ears:
        sorted_ears = sorted(valid_ears)
        top_half = sorted_ears[len(sorted_ears) // 2:]
        base_ear = float(statistics.median(top_half))
        ear_ratio_str = f"{min(valid_ears) / base_ear:.2f}" if base_ear > 0 else "N/A"

    smile_ratio_str = "N/A"
    valid_w = [w for w in mouth_widths if w is not None]
    if valid_w:
        sorted_w = sorted(valid_w)
        half_len = max(1, len(sorted_w) // 2)
        base_w = float(statistics.median(sorted_w[:half_len]))
        smile_ratio_str = f"{max(valid_w) / base_w:.2f}" if base_w > 0 else "N/A"

    yaw_str = "N/A"
    if yaws:
        y_first = yaws[0]
        y_last = yaws[-1]
        y_delta = y_last - y_first
        y_list = ", ".join(f"{y:+.1f}" for y in yaws)
        yaw_str = f"[{y_list}] (first={y_first:+.1f}, last={y_last:+.1f}, delta={y_delta:+.1f})"

    ear_list = ", ".join(f"{e:.3f}" if e is not None else "None" for e in ears)
    ear_frame_str = f"[{ear_list}]" if ears else "N/A"
    mw_list = ", ".join(f"{w:.3f}" if w is not None else "None" for w in mouth_widths)
    mw_frame_str = f"[{mw_list}]" if mouth_widths else "N/A"

    det_score_min_str = f"{min(det_scores):.3f}" if det_scores else "N/A"
    bbox_px_min_str = f"{int(min(bbox_pxs))}" if bbox_pxs else "N/A"
    blur_var_min_str = f"{min(blur_vars):.1f}" if blur_vars else "N/A"
    pair_min_str = f"{min_pair_sim:.3f}" if min_pair_sim is not None else "N/A"
    pair_mean_str = f"{mean_pair_sim:.3f}" if mean_pair_sim is not None else "N/A"
    sim_template_str = f"{sim_to_template:.3f}" if sim_to_template is not None else "N/A"
    binding_str = f"{binding_sim:.3f}" if binding_sim is not None else "N/A"
    failing_name_str = first_failing_check if first_failing_check is not None else "None"

    # Exactly one log line with the required metrics
    logger.info(
        "[FACE_DEBUG] action=%s, frames_received=%d, frames_with_exactly_one_face=%d, "
        "det_score min=%s, bbox px min=%s, blur variance min=%s, "
        "yaw per frame=%s, EAR per frame=%s, mouth width per frame=%s, "
        "EAR min/max ratio=%s, smile spread ratio=%s, "
        "pairwise cosine min/mean across frames=%s/%s, similarity to template=%s, "
        "binding score=%s, threshold=%.2f, first failing check name=%s",
        f"{op}:{action}" if action else op,
        frames_received,
        frames_with_exactly_one_face,
        det_score_min_str,
        bbox_px_min_str,
        blur_var_min_str,
        yaw_str,
        ear_frame_str,
        mw_frame_str,
        ear_ratio_str,
        smile_ratio_str,
        pair_min_str,
        pair_mean_str,
        sim_template_str,
        binding_str,
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
        binding_score=binding_sim,
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
    frame_errors: list[FaceAuthError] = []
    for jpeg in frames:
        try:
            img = decode_frame(jpeg)
            det = select_single_face(_real_detections(img), require_embedding=False)
            gray = img.mean(axis=2)
            if laplacian_variance(gray) < config.FACE_MIN_BLUR_VARIANCE:
                raise FaceAuthError("FACE_BLURRY", "frame is too blurry")
            _antispoof_score(img)
            detections.append(det)
            candidates.append((img, det))
        except FaceAuthError as exc:
            frame_errors.append(exc)

    # Frame tolerance: reject fewer than 5 valid frames; tolerate 1 failed frame out of >=6
    # as long as at least 3 frontal frames pass.
    tolerated = len(frames) >= 6 and len(frame_errors) <= 1 and len(candidates) >= 5
    if frame_errors and not tolerated:
        raise frame_errors[0]

    # Select the 3 most frontal frames (smallest |yaw|, highest det_score).
    frontal = sorted(
        candidates,
        key=lambda item: (
            abs(item[1].yaw_degrees if item[1].yaw_degrees is not None else 0.0),
            -item[1].det_score,
        ),
    )[:3]
    if len(frontal) < 3:
        if frame_errors:
            raise frame_errors[0]
        raise FaceAuthError("DETECTION_FAILED", "fewer than 3 frontal frames passed quality")

    if action is not None:
        check_action(action, detections)

    embeddings: list[np.ndarray] = [_real_embed(c_img, c_det) for c_img, c_det in frontal]

    # All 3 frontal frames must be the same person before any match against a template.
    min_sim = 1.0
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            pair = similarity(embeddings[i], embeddings[j])
            min_sim = min(min_sim, pair)
            if pair < config.FACE_CONSISTENCY_THRESHOLD:
                raise FaceAuthError("INCONSISTENT_FRAMES", "frames show different faces")

    binding_sim: float | None = None
    if action is not None and candidates:
        action_cand = pick_action_candidate(candidates, action)
        if action_cand is not None:
            action_emb = _real_embed(action_cand[0], action_cand[1])
            agg_frontal = aggregate_embeddings(embeddings)
            binding_sim = similarity(action_emb, agg_frontal)
            if binding_sim < config.FACE_BINDING_THRESHOLD:
                raise FaceAuthError(
                    "LIVENESS_IDENTITY_MISMATCH",
                    "liveness frame does not match frontal face",
                )

    return VerifiedFace(
        embedding=aggregate_embeddings(embeddings),
        frame_count=len(embeddings),
        min_pair_similarity=min_sim,
        yaw_trace=[d.yaw_degrees or 0.0 for d in detections],
        binding_score=binding_sim,
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
