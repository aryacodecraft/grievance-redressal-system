"""Health / probe endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from ..db import storage_mode

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "storage": storage_mode()}


@router.get("/test")
def test():
    return PlainTextResponse("FastAPI running.")
