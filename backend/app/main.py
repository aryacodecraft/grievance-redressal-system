"""FastAPI application entry point.

Run from the repo root:

    uvicorn backend.app.main:app --host 0.0.0.0 --port 10000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CORS_ORIGINS
from .routers import grievances, health, images

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Grievance Redressal API",
    version="1.0.0",
    description="AI-assisted grievance submission, triage and officer review.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Match the legacy Flask error shape: {"error": "..."} with HTTP 400."""
    parts: list[str] = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        msg = err.get("msg", "invalid")
        parts.append(f"{loc}: {msg}" if loc else msg)
    return JSONResponse(
        status_code=400,
        content={"error": "; ".join(parts) or "Invalid request"},
    )


app.include_router(health.router)
app.include_router(grievances.router)
app.include_router(images.router)
