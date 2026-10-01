"""Cloudinary helpers: configure, delete and sign assets."""

from __future__ import annotations

import logging
import re

from ..config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
)

logger = logging.getLogger("grievance-api")

_cloudinary = None


def get_cloudinary():
    """Lazily import and configure the Cloudinary SDK (optional dependency)."""
    global _cloudinary
    if _cloudinary is not None:
        return _cloudinary
    try:
        import cloudinary
    except Exception:
        logger.error("cloudinary SDK not installed")
        return None

    if CLOUDINARY_CLOUD_NAME:
        try:
            cloudinary.config(
                cloud_name=CLOUDINARY_CLOUD_NAME,
                api_key=CLOUDINARY_API_KEY,
                api_secret=CLOUDINARY_API_SECRET,
                secure=True,
            )
            logger.info("Cloudinary configured")
            _cloudinary = cloudinary
        except Exception:
            logger.exception("Failed to configure Cloudinary")
            return None
    return _cloudinary


def is_configured() -> bool:
    return bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)


def extract_public_id(url: str) -> str | None:
    """Pull the public_id out of a res.cloudinary.com URL."""
    match = re.search(r"/upload/(?:v\d+/)?(.+)$", url)
    if not match:
        return None
    candidate = match.group(1)
    return re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", candidate)


def delete_asset(public_id: str, resource_type: str = "image") -> dict:
    cloudinary = get_cloudinary()
    if cloudinary is None:
        raise RuntimeError("Cloudinary SDK not installed on server")
    if not is_configured():
        raise RuntimeError(
            "Cloudinary not configured. Set CLOUDINARY_API_KEY, "
            "CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME."
        )
    from cloudinary import uploader

    logger.info(
        "Deleting Cloudinary asset: %s (resource_type=%s)", public_id, resource_type
    )
    result = uploader.destroy(public_id, resource_type=resource_type)
    logger.info("Cloudinary delete response: %s", result)
    return result if isinstance(result, dict) else {"result": str(result)}


def sign_url(public_id: str, resource_type: str = "image", transform: str = "f_auto,q_auto,w_900") -> tuple[str, bool]:
    """Return (signed_url, is_signed)."""
    if get_cloudinary() and CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY:
        from cloudinary.utils import cloudinary_url

        signed_url, _options = cloudinary_url(
            public_id,
            resource_type=resource_type,
            sign_url=bool(CLOUDINARY_API_SECRET),
            secure=True,
            transformation=transform,
        )
        return signed_url, bool(CLOUDINARY_API_SECRET)

    if CLOUDINARY_CLOUD_NAME:
        unsigned = (
            f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/"
            f"{resource_type}/upload/{transform}/{public_id}"
        )
        return unsigned, False

    raise RuntimeError("Cloudinary not configured on server")
