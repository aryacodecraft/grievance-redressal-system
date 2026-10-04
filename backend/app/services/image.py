"""Image validation: Groq multimodal scoring with a heuristic fallback."""

from __future__ import annotations

import logging

import numpy as np
import requests
from PIL import Image, ImageStat
from io import BytesIO

from ..config import IMAGE_LLM_THRESHOLD, LLAVA_MODEL, get_groq_client

logger = logging.getLogger("grievance-api")


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

    Uses Groq multimodal when configured, otherwise an image-quality heuristic.
    Returns {"score": float, "explanation": str, "raw": str}.
    """
    if not image_url:
        return {"score": 0.0, "explanation": "No image URL provided", "raw": ""}

    groq_client = get_groq_client()
    if groq_client:
        try:
            res = groq_client.chat.completions.create(
                model=LLAVA_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """
                                Does this image show a public infrastructure complaint?

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
                "Groq vision model unavailable (%s); using calibrated image quality check.",
                str(exc).split("\n")[0][:100],
            )

    # Heuristic fallback
    try:
        r = requests.get(image_url, timeout=12)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content)).convert("RGB")
        q = compute_image_quality_score(img)
        score = q.get("score", 0.0)
        comps = q.get("components", {})
        explanation = f"Fallback quality check: score={score}. Components: {comps}."
        if score < 30:
            explanation = "Low image clarity/context for a public complaint. " + explanation
        return {
            "score": float(round(score, 2)),
            "explanation": explanation[:400],
            "raw": "heuristic:quality-check",
        }
    except Exception as exc:
        logger.exception("Fallback image download/quality check failed")
        return {
            "score": 5.0,
            "explanation": "Unable to validate image (LLM failed and fallback also failed).",
            "raw": f"heuristic:error:{str(exc)[:300]}",
        }
