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
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import CORS_ORIGINS
from .routers import auth as auth_router
from .routers import grievances, health, images

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("grievance-api")

app = FastAPI(
    title="Grievance Redressal API",
    version="2.0.0",
    description="AI-assisted grievance submission, triage and officer review. JWT auth required.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Unrouted paths and disallowed methods also use the flat error shape.

    Without this, Starlette answers an unknown route with
    `{"detail": "Not Found"}` while every handler in the app answers with
    `{"error": "..."}` — and `frontend/lib/api.ts` only reads `json.error`,
    so those failures surfaced to users as a bare "Request failed (404)".
    `docs/API.md` documents the flat shape for 400/404 as the implemented one.
    """
    headers = getattr(exc, "headers", None)
    detail = exc.detail
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": detail if isinstance(detail, str) else "Request failed"},
        headers=headers,
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


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(grievances.router)
app.include_router(images.router)


# ── Startup: seed admin account ───────────────────────────────────────────────
@app.on_event("startup")
def _seed_admin() -> None:
    """Create the first ADMIN account at startup if env vars are set.

    This runs once; if the email is already registered nothing happens.
    Set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD in backend/.env (locally)
    or in Render environment variables.
    """
    from .config import SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
    from .users_db import users_repository
    import bcrypt as _bcrypt

    if not SEED_ADMIN_EMAIL or not SEED_ADMIN_PASSWORD:
        return

    if users_repository.find_by_email(SEED_ADMIN_EMAIL):
        return  # Already exists

    hashed = _bcrypt.hashpw(SEED_ADMIN_PASSWORD.encode(), _bcrypt.gensalt(12)).decode()
    users_repository.create({
        "email": SEED_ADMIN_EMAIL.lower(),
        "full_name": "Admin",
        "hashed_password": hashed,
        "role": "ADMIN",
    })
    logger.info("Seeded admin account: %s", SEED_ADMIN_EMAIL)
