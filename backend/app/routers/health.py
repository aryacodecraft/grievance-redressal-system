"""Health / probe / public-config endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from .. import config
from ..db import storage_mode

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "storage": storage_mode()}


@router.get("/config")
def public_config():
    """Public runtime flags the UI needs to decide what to render.

    Only exposes non-sensitive feature switches — never secrets or thresholds.
    """
    return {"faceAuthEnabled": bool(config.FACE_AUTH_ENABLED)}


@router.get("/test")
def test():
    return PlainTextResponse("FastAPI running.")
