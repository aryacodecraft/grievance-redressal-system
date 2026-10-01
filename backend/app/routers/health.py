"""Health / probe endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/test")
def test():
    return PlainTextResponse("FastAPI running.")
