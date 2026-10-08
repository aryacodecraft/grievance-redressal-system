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
from .routers import users as users_router
from .routers import departments as dept_router
from .routers import progress as progress_router
from .routers import assignments as assignment_router
from .routers import admin as admin_router
from .routers import audit as audit_router
from .routers import notifications as notif_router

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
app.include_router(users_router.router)
app.include_router(dept_router.router)
app.include_router(progress_router.router)
app.include_router(assignment_router.router)
app.include_router(admin_router.router)
app.include_router(audit_router.router)
app.include_router(notif_router.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def _seed_on_startup() -> None:
    """Seed admin / SUPERADMIN accounts at startup if env vars are set.

    Repositories already initialise their own indexes at import time (each
    singleton factory calls ensure_indexes on the Mongo path). The startup
    hook only handles data seeding that needs the full app context.
    """
    import bcrypt as _bcrypt

    from .config import (
        SEED_ADMIN_EMAIL,
        SEED_ADMIN_PASSWORD,
        SEED_SUPERADMIN_EMAIL,
        SEED_SUPERADMIN_PASSWORD,
        SEED_TEST_ACCOUNTS,
    )
    from .users_db import users_repository

    def _seed(email: str, password: str, role: str, name: str) -> None:
        if not email or not password:
            return
        if not users_repository.find_by_email(email):
            hashed = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(12)).decode()
            users_repository.create({
                "email": email.lower(),
                "full_name": name,
                "hashed_password": hashed,
                "role": role,
                "isActive": True,
            })
            logger.info("Seeded %s account: %s", role, email)

    _seed(SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, "ADMIN", "Admin")
    _seed(SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, "SUPERADMIN", "SuperAdmin")

    # Testing-phase accounts (dev only): one MANAGER + one EMPLOYEE per
    # department, plus the default superadmin. Idempotent — existing emails
    # are left untouched. Disabled unless SEED_TEST_ACCOUNTS=true.
    if SEED_TEST_ACCOUNTS:
        try:
            from .seed_test_accounts import seed_test_accounts
            stats = seed_test_accounts()
            logger.info("Test accounts seed stats: %s", stats)
        except Exception:
            logger.exception("Test account seeding failed")

    # Seed demo citizen for testing/evaluation
    demo_citizen_email = "citizen@grievance.local"
    if not users_repository.find_by_email(demo_citizen_email):
        citizen_hashed = _bcrypt.hashpw(b"Citizen@2026!", _bcrypt.gensalt(12)).decode()
        users_repository.create({
            "email": demo_citizen_email,
            "full_name": "Demo Citizen",
            "hashed_password": citizen_hashed,
            "role": "USER",
            "isActive": True,
        })
        logger.info("Seeded citizen account: %s", demo_citizen_email)
