"""Image validation and Cloudinary asset endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import IMAGE_LLM_THRESHOLD
from ..models import DeleteCloudinaryRequest, SignCloudinaryRequest, ValidateImageRequest
from ..services import cloudinary as cloudinary_service
from ..services.image import llm_image_confidence

logger = logging.getLogger("grievance-api")
router = APIRouter()


@router.post("/validate-image")
def validate_image(payload: ValidateImageRequest):
    image_url = payload.imageUrl or payload.image_url or payload.url
    public_id = payload.public_id
    public_url = payload.public_url

    if not image_url:
        return JSONResponse(status_code=400, content={"error": "imageUrl required"})

    try:
        llm_res = llm_image_confidence(image_url)
    except Exception as exc:
        logger.exception("LLM image check failed for url: %s", image_url)
        return JSONResponse(
            status_code=500,
            content={
                "error": "LLM image validation failed",
                "detail": str(exc),
                "hint": "Check GROQ_API_KEY and the Groq SDK; see server logs for the raw reply.",
            },
        )

    llm_score = float(llm_res.get("score", 0.0))
    ok = llm_score >= IMAGE_LLM_THRESHOLD
    result = {
        "ok": ok,
        "llm_score": llm_score,
        "explanation": llm_res.get("explanation", ""),
        "raw": llm_res.get("raw", ""),
        "threshold": float(IMAGE_LLM_THRESHOLD),
    }

    # Rejected + client gave us an asset → best-effort server-side cleanup.
    if not ok and (public_id or public_url):
        try:
            pid = public_id
            if not pid and public_url:
                pid = cloudinary_service.extract_public_id(public_url)
            if pid:
                result["deleted"] = cloudinary_service.delete_asset(
                    pid, "image"
                )
            else:
                logger.warning("No public_id extracted; skipping delete")
        except Exception as exc:
            logger.warning("cloudinary delete attempt failed: %s", exc)
            result["delete_error"] = str(exc)

    return result


@router.post("/delete-cloudinary")
def delete_cloudinary(payload: DeleteCloudinaryRequest):
    public_id = payload.public_id
    if not public_id and payload.public_url:
        public_id = cloudinary_service.extract_public_id(payload.public_url)

    if not public_id:
        return JSONResponse(
            status_code=400,
            content={"error": "public_id or public_url required"},
        )

    try:
        deleted = cloudinary_service.delete_asset(public_id, payload.resource_type)
    except RuntimeError as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("cloudinary delete failed for %s", public_id)
        return JSONResponse(
            status_code=500,
            content={"error": "cloudinary delete failed", "detail": str(exc)},
        )

    return {"deleted": deleted}


@router.post("/sign-cloudinary")
def sign_cloudinary(payload: SignCloudinaryRequest):
    try:
        signed_url, signed = cloudinary_service.sign_url(
            payload.public_id, payload.resource_type, payload.transform
        )
    except RuntimeError as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    except Exception:
        logger.exception("cloudinary signing failed")
        return JSONResponse(
            status_code=500, content={"error": "cloudinary signing failed"}
        )
    return {"signedUrl": signed_url, "signed": signed}
