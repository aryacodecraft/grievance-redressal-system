"""Image validation: Groq multimodal scoring with an unverified fallback."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import numpy as np
import requests
from PIL import Image, ImageStat
from io import BytesIO

from ..config import CLOUDINARY_CLOUD_NAME, IMAGE_LLM_THRESHOLD, LLAVA_MODEL, get_groq_client

logger = logging.getLogger("grievance-api")

# Image validation runs inline during submit, before the grievance is stored.
# Bound it like the classification calls: no SDK retries, hard per-call limit.
IMAGE_LLM_TIMEOUT_SECONDS = 8.0


def is_allowed_image_url(image_url: str) -> bool:
    """Only fetch images uploaded to this application's Cloudinary account."""
    parsed = urlparse(image_url)
    prefix = f"/{CLOUDINARY_CLOUD_NAME}/image/upload/" if CLOUDINARY_CLOUD_NAME else ""
    return bool(
        parsed.scheme == "https" and parsed.hostname == "res.cloudinary.com"
        and not parsed.username and not parsed.password and parsed.port is None
        and prefix and parsed.path.startswith(prefix)
    )


def compute_image_quality_score(pil_img: Image.Image) -> dict:
    img = pil_img.convert("RGB")
    width, height = img.size
    ref_area = 800 * 600
    area = max(1, width * height)
    res_score = min(1.0, area / ref_area)

    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    mean_brightness = stat.mean[0] if stat.mean else 0
    # Natural lighting check: normal indoor/outdoor exposure between 25 and 235
    if mean_brightness < 20 or mean_brightness > 240:
        bright_score = 0.0
    elif 40 <= mean_brightness <= 220:
        bright_score = 1.0
    elif mean_brightness < 40:
        bright_score = max(0.0, (mean_brightness - 20) / 20.0)
    else:
        bright_score = max(0.0, (240 - mean_brightness) / 20.0)

    arr = np.asarray(gray).astype(np.int32)
    if arr.shape[0] < 3 or arr.shape[1] < 3:
        sharpness_score = 0.0
    else:
        dyy = arr[2:, 1:-1] - 2 * arr[1:-1, 1:-1] + arr[:-2, 1:-1]
        dxx = arr[1:-1, 2:] - 2 * arr[1:-1, 1:-1] + arr[1:-1, :-2]
        lap = dyy + dxx
        var = float(np.var(lap))
        # Standard photography threshold: Laplacian variance >= 60-100 indicates in-focus details.
        sharpness_score = min(1.0, max(0.0, (var - 20.0) / 100.0))

    final_score = (sharpness_score * 0.45 + res_score * 0.35 + bright_score * 0.20) * 100.0

    # Minimum usability bounds (too small, pitch black, or completely blurred)
    if width < 300 or height < 300 or sharpness_score < 0.10 or bright_score < 0.10:
        final_score = min(final_score, 40.0)

    return {
        "score": round(final_score, 2),
        "components": {
            "sharpness_score": round(sharpness_score * 100, 2),
            "resolution_score": round(res_score * 100, 2),
            "brightness_score": round(bright_score * 100, 2),
            "width": width,
            "height": height,
        },
    }


def llm_image_confidence(image_url: str) -> dict:
    """Score an image 0-100 for "is this a public infrastructure complaint?".

    Uses Groq multimodal when configured. Local image quality cannot establish
    that an image is relevant, so unavailable vision returns score=None for
    human review instead of approving based on sharpness or brightness.
    """
    if not image_url:
        return {"score": 0.0, "explanation": "No image URL provided", "raw": ""}
    if not is_allowed_image_url(image_url):
        return {"score": 0.0, "explanation": "Image URL is not from the configured Cloudinary account.", "raw": "invalid-image-url"}

    groq_client = get_groq_client()
    if groq_client:
        try:
            res = groq_client.with_options(max_retries=0).chat.completions.create(
                model=LLAVA_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """
                                Does this image show a public infrastructure complaint?

                                Be strict. Score only the visible image itself, not
                                the user's description. A screenshot, app or browser
                                screen, chat, meme, selfie, document, or unrelated
                                photograph is invalid even if it contains civic words
                                or a picture of infrastructure. A valid image must
                                visibly depict the reported physical public issue.

                                Valid:
                                - potholes
                                - broken roads
                                - garbage piles
                                - damaged streetlights
                                - drainage issues
                                - water leakage

                                Invalid:
                                - screenshots
                                - selfies
                                - memes
                                - chats
                                - documents

                                Return JSON:
                                {
                                "score": 0-100,
                                "explanation": "..."
                                }
                                """,
                            },
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    }
                ],
                temperature=0.0,
                max_tokens=500,
                timeout=IMAGE_LLM_TIMEOUT_SECONDS,
            )

            try:
                raw = res.choices[0].message.content.strip()
            except Exception:
                try:
                    raw = str(res.choices[0].message.content or res).strip()
                except Exception:
                    raw = str(res)

            from .classification import _extract_json

            parsed = _extract_json(raw)
            if parsed and "score" in parsed:
                try:
                    score = float(parsed.get("score", 0.0))
                except Exception:
                    try:
                        score = float(int(parsed.get("score", 0)))
                    except Exception:
                        score = 0.0
                score = max(0.0, min(100.0, score))
                explanation = str(parsed.get("explanation", "") or "")[:400]
                return {
                    "score": round(score, 2),
                    "explanation": explanation,
                    "raw": raw,
                }

            logger.warning(
                "LLM returned unparsable response for image validation: %s",
                str(raw)[:400],
            )
        except Exception as exc:
            logger.info(
                "Groq vision model unavailable (%s); image will require human review.",
                str(exc).split("\n")[0][:100],
            )

    # Quality metrics can explain whether an image is legible, but cannot
    # establish relevance. Keep them as diagnostics; never use them to approve.
    try:
        r = requests.get(image_url, timeout=12, allow_redirects=False, stream=True)
        r.raise_for_status()
        if int(r.headers.get("Content-Length", "0") or 0) > 10 * 1024 * 1024:
            raise ValueError("Image exceeds 10 MB")
        data = r.raw.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024:
            raise ValueError("Image exceeds 10 MB")
        img = Image.open(BytesIO(data)).convert("RGB")
        q = compute_image_quality_score(img)
        comps = q.get("components", {})
        return {
            "score": None,
            "explanation": f"Relevance could not be verified automatically; image quality details: {comps}. Staff review required.",
            "raw": "heuristic:quality-check",
        }
    except Exception as exc:
        logger.exception("Fallback image download/quality check failed")
        return {
            "score": None,
            "explanation": "Unable to validate image (LLM failed and fallback also failed).",
            "raw": f"heuristic:error:{str(exc)[:300]}",
        }
