"""FastAPI application entry point.

Run from the repo root:

    uvicorn backend.app.main:app --host 0.0.0.0 --port 10000
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .config import CORS_ORIGINS
from .services.face_service import MAX_REQUEST_BYTES
from .routers import auth as auth_router
from .routers import face_auth as face_auth_router
from .routers import grievances, health, images
from .routers import users as users_router
from .routers import departments as dept_router
from .routers import progress as progress_router
from .routers import assignments as assignment_router
from .routers import admin as admin_router
from .routers import audit as audit_router
from .routers import notifications as notif_router
from .routers import phone as phone_router

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("grievance-api")

app = FastAPI(
    title="Grievance Redressal API",
    version="2.0.0",
    description="AI-assisted grievance submission, triage and officer review. JWT auth required.",
)

# ── Face route guard (DEC-024) ───────────────────────────────────────────────
def _face_request_is_https(scope) -> bool:
    headers = {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in scope.get("headers", [])
    }
    if scope.get("scheme") == "https":
        return True
    if config.TRUST_PROXY:
        forwarded = headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
        if forwarded == "https":
            return True
    host = headers.get("host", "")
    if host.startswith("["):  # IPv6 literal: [::1]:8000
        hostname = host[1:].split("]")[0]
    else:
        hostname = host.split(":")[0]
    return hostname.lower() in ("localhost", "127.0.0.1")


class FaceRouteGuard:
    """Feature flag, HTTPS enforcement and a 4 MB body cap for /auth/face/*.

    A pure ASGI middleware that runs before routing (DEC-024):
      * FACE_AUTH_ENABLED=false -> 404 for every face route, before any
        request validation runs
      * non-HTTPS -> 400 (localhost / 127.0.0.1 excepted; X-Forwarded-Proto
        honoured only when TRUST_PROXY=true)
      * body over 4 MB -> 413 before any JSON or base64 parsing (the body is
        buffered once, then replayed to the app)
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        if path != "/auth/face" and not path.startswith("/auth/face/"):
            return await self.app(scope, receive, send)

        async def reply(status: int, message: str) -> None:
            await JSONResponse({"error": message}, status_code=status)(scope, receive, send)

        if not config.FACE_AUTH_ENABLED:
            return await reply(404, "Not Found")
        if not _face_request_is_https(scope):
            return await reply(400, "HTTPS is required for face authentication")

        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1")
            for k, v in scope.get("headers", [])
        }
        content_length = headers.get("content-length", "")
        if content_length.isdigit() and int(content_length) > MAX_REQUEST_BYTES:
            return await reply(413, "Request body too large")

        body = b""
        while True:
            message = await receive()
            if message["type"] != "http.request":
                return  # client hung up mid-upload; nothing to serve
            body += message.get("body", b"")
            if len(body) > MAX_REQUEST_BYTES:
                return await reply(413, "Request body too large")
            if not message.get("more_body", False):
                break

        scope.setdefault("state", {})
        scope["state"]["request_t0"] = time.perf_counter()
        scope["state"]["body_bytes_len"] = len(body)

        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        return await self.app(scope, replay, send)


# Registered BEFORE the CORS middleware on purpose: Starlette runs the most
# recently added middleware first, so CORSMiddleware stays outermost and adds
# its headers to the guard's 404/400/413 replies too.
app.add_middleware(FaceRouteGuard)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Face-Reason"],
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
app.include_router(face_auth_router.router)
app.include_router(grievances.router)
app.include_router(images.router)
app.include_router(users_router.router)
app.include_router(dept_router.router)
app.include_router(progress_router.router)
app.include_router(assignment_router.router)
app.include_router(admin_router.router)
app.include_router(audit_router.router)
app.include_router(notif_router.router)
app.include_router(phone_router.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def _validate_face_auth() -> None:
    """Fail fast when face auth is enabled but unusable (DEC-024).

    validate_embed_key raises ValueError (missing/invalid FACE_EMBED_KEY) and
    uvicorn aborts startup instead of serving a flag-on API that would fail
    every enrollment at runtime.
    """
    from . import config as _config

    if not _config.FACE_AUTH_ENABLED:
        return
    from .services.face_service import validate_embed_key

    validate_embed_key()


@app.on_event("startup")
def _warmup_face_auth() -> None:
    """Preload the face model in a background thread when enabled (DEC-024).

    Avoids latency spikes on the first user request while preserving the lazy
    fallback if warmup fails or is still finishing.
    """
    from . import config as _config

    if not _config.FACE_AUTH_ENABLED:
        return

    import threading
    from .services.face_service import _get_analyzer

    def _warmup() -> None:
        try:
            logger.info("Preloading face model in background thread: %s", _config.FACE_MODEL_NAME)
            _get_analyzer()
            logger.info("Face model background preload complete: %s", _config.FACE_MODEL_NAME)
        except Exception:
            logger.exception("Face model background preload failed; lazy fallback active")

    t = threading.Thread(target=_warmup, name="face-model-warmup", daemon=True)
    t.start()


@app.on_event("startup")
def _seed_on_startup() -> None:
    """Seed admin / SUPERADMIN accounts at startup if env vars are set.

    Repositories already initialise their own indexes at import time (each
    singleton factory calls ensure_indexes on the Mongo path). The startup
    hook only handles data seeding that needs the full app context.
    """
    import bcrypt as _bcrypt
    from .db import repository
    from .services.departments import canonical_department

    # Legacy grievances were created before departmentId became mandatory.
    # Repair only missing routing metadata; never reset state or owner here.
    try:
        legacy = repository.list(limit=1000)
        repaired = 0
        for grievance in legacy:
            existing = grievance.get("departmentId")
            category = canonical_department(str(existing or grievance.get("category") or (grievance.get("hfEngine") or {}).get("category") or "other"))
            if existing == category:
                continue
            repository.update(grievance["id"], {"departmentId": category})
            repaired += 1
        if repaired:
            logger.info("Backfilled departmentId for %d legacy grievances", repaired)
    except Exception:
        logger.exception("Legacy department backfill failed; startup will continue")

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
