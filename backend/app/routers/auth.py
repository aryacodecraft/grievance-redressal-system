"""Authentication endpoints.

POST  /auth/register       — create a new USER account
POST  /auth/login          — email + password → access + refresh tokens
POST  /auth/refresh        — exchange a refresh token for a new access token
POST  /auth/logout         — (client-side: discard tokens; server is stateless)
GET   /auth/me             — get the current user's profile
GET   /auth/google         — redirect to Google OAuth consent screen
GET   /auth/google/callback — exchange code for user; issue tokens

Google OAuth is optional: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not
set the /auth/google routes return 503 rather than crashing.
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
import bcrypt as _bcrypt
from pydantic import BaseModel, EmailStr, field_validator

from ..auth import (
    create_access_token,
    create_pending_token,
    create_refresh_token,
    _decode,
    get_current_user,
    get_pending_user,
)
from .. import config
from ..repositories.face_templates import face_repository
from ..services.face_service import RATE_WINDOW_SECONDS, USER_FAIL_LIMIT
from ..users_db import users_repository

logger = logging.getLogger("grievance-api")
router = APIRouter(prefix="/auth", tags=["auth"])

PRIVILEGED_ROLES = ("ADMIN", "SUPERADMIN")


def _hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(12)).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    if not hashed:
        return False
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# Google OAuth settings — optional
_GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


import re

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


# ── Request / response models ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_REGEX.match(v):
            raise ValueError("value is not a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name is required")
        return v.strip()


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_REGEX.match(v):
            raise ValueError("value is not a valid email address")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Helper ───────────────────────────────────────────────────────────────────

def _user_to_profile(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "role": user.get("role", "USER"),
        "departmentId": user.get("departmentId"),
        "avatar_url": user.get("avatar_url"),
    }


def _token_response(user: dict) -> dict:
    return {
        "access_token": create_access_token(user["id"], user["role"], user["email"], user.get("departmentId")),
        "refresh_token": create_refresh_token(user["id"]),
        "token_type": "bearer",
        "user": _user_to_profile(user),
    }


def _face_step_required(user: dict) -> bool:
    """True when this privileged login pauses for the *optional* face step.

    Face is never mandatory (DEC-024): the step only appears when face auth
    is enabled, the account is privileged AND enrolled with `requireLogin2fa`.
    The decision reads only the verify-second-factor counter
    (`face:fail:user:<id>`) — a public /auth/face/login lockout can never
    influence password/Google login, and vice versa.
    """
    if not config.FACE_AUTH_ENABLED:
        return False
    if user.get("role") not in PRIVILEGED_ROLES:
        return False
    template = face_repository.get_template(user.get("id", ""))
    if not template or not template.get("requireLogin2fa"):
        return False
    key = f"face:fail:user:{user['id']}"
    return face_repository.rate_count(key, RATE_WINDOW_SECONDS) < USER_FAIL_LIMIT


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(payload: RegisterRequest):
    """Create a new citizen account.  Email must be unique."""
    if users_repository.find_by_email(payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = users_repository.create({
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "hashed_password": _hash_password(payload.password),
        "role": "USER",
    })
    user = users_repository.get(user_id)
    return _token_response(user)


@router.post("/login")
def login(payload: LoginRequest):
    """Email + password → access + refresh tokens.

    When face auth is enabled and a privileged account has opted into the
    extra face step (enrolled + `requireLogin2fa`, not currently locked out
    of the face endpoint), the response is a short-lived pending token
    instead — password/Google login itself always succeeds.
    """
    user = users_repository.find_by_email(payload.email)
    if not user or not _verify_password(payload.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if _face_step_required(user):
        return {
            "two_factor": "face",
            "token_type": "bearer",
            "pending_token": create_pending_token(
                user["id"], user["role"], user["email"], user.get("departmentId")
            ),
        }
    return _token_response(user)


@router.post("/complete-pending")
def complete_pending(current: Annotated[dict, Depends(get_pending_user)]):
    """Exchange a pending token for the full token response.

    Lockout escape hatch only (DEC-024): while the account can still attempt
    face verification, the pending token must be used for
    /auth/face/verify-second-factor and is rejected here (403) — it never
    grants protected access on its own. Once the account is locked out of the
    face endpoint (face:fail:user:{id} at the limit) the face step cannot be
    taken, so the pending token is completed directly. The face step is an
    optional convenience, never a hard requirement.
    """
    user = users_repository.get(current["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    key = f"face:fail:user:{user['id']}"
    if face_repository.rate_count(key, RATE_WINDOW_SECONDS) < USER_FAIL_LIMIT:
        raise HTTPException(status_code=403, detail="Face verification required")
    return _token_response(user)


@router.post("/refresh")
def refresh(payload: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    data = _decode(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = users_repository.get(data["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "access_token": create_access_token(user["id"], user["role"], user["email"], user.get("departmentId")),
        "token_type": "bearer",
    }


@router.get("/me")
def me(current: Annotated[dict, Depends(get_current_user)]):
    """Return the authenticated user's profile."""
    user = users_repository.get(current["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile(user)


# ── Google OAuth ─────────────────────────────────────────────────────────────

def _require_google():
    if not _GOOGLE_CLIENT_ID or not _GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)",
        )


@router.get("/google")
def google_redirect(request: Request):
    """Redirect the browser to Google's OAuth consent screen."""
    _require_google()

    state = secrets.token_urlsafe(32)
    # Store state in session cookie for CSRF validation (simplistic; production
    # should use a signed cookie or a Redis-backed nonce store).
    redirect_uri = str(request.url_for("google_callback"))
    params = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={_GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&state={state}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    response = RedirectResponse(url=params)
    response.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=600)
    return response


@router.get("/google/callback", name="google_callback")
def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """Exchange Google authorization code for a user account and issue tokens."""
    _require_google()

    if error:
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=google_denied")

    stored_state = request.cookies.get("oauth_state", "")
    if not state or state != stored_state:
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=invalid_state")

    import httpx  # noqa: PLC0415 — local import keeps startup fast

    # Exchange code for tokens
    redirect_uri = str(request.url_for("google_callback"))
    token_resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": _GOOGLE_CLIENT_ID,
            "client_secret": _GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        timeout=10,
    )
    if not token_resp.is_success:
        logger.error("Google token exchange failed: %s", token_resp.text)
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=google_token_failed")

    google_tokens = token_resp.json()
    id_token_str = google_tokens.get("id_token", "")
    if not id_token_str:
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=no_id_token")

    # Decode the Google ID token (verify with Google's public keys in production;
    # for the prototype we do a lightweight decode without signature check since
    # we just exchanged it ourselves from Google's endpoint).
    import base64, json as _json  # noqa: PLC0415

    try:
        parts = id_token_str.split(".")
        payload_b64 = parts[1] + "=="  # re-pad
        decoded = _json.loads(base64.urlsafe_b64decode(payload_b64))
        google_email = decoded.get("email", "")
        google_name = decoded.get("name", "")
        google_sub = decoded.get("sub", "")
        avatar_url = decoded.get("picture", "")
    except Exception as exc:
        logger.exception("Failed to decode Google ID token: %s", exc)
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=id_token_decode")

    if not google_email:
        return RedirectResponse(url=f"{_FRONTEND_URL}/login?error=no_email")

    # Find or create the user
    user = users_repository.find_by_email(google_email)
    if not user:
        uid = users_repository.create({
            "email": google_email.lower(),
            "full_name": google_name,
            "hashed_password": "",  # no password for OAuth users
            "role": "USER",
            "google_id": google_sub,
            "avatar_url": avatar_url,
        })
        user = users_repository.get(uid)
    else:
        # Update avatar / google_id on existing account
        users_repository.update(user["id"], {"google_id": google_sub, "avatar_url": avatar_url})
        user = users_repository.get(user["id"])

    access_token = create_access_token(user["id"], user["role"], user["email"], user.get("departmentId"))
    refresh_token = create_refresh_token(user["id"])

    # Optional face step for privileged accounts that opted in (DEC-024):
    # redirect with a pending token instead of the full pair.
    if _face_step_required(user):
        pending_token = create_pending_token(
            user["id"], user["role"], user["email"], user.get("departmentId")
        )
        return RedirectResponse(
            url=(
                f"{_FRONTEND_URL}/auth/callback"
                f"?two_factor=face&pending_token={pending_token}"
            )
        )

    # Redirect back to the frontend with tokens in the query string.
    # In production prefer setting httpOnly cookies or using a code-for-token
    # exchange flow — this is acceptable for the prototype.
    return RedirectResponse(
        url=(
            f"{_FRONTEND_URL}/auth/callback"
            f"?access_token={access_token}"
            f"&refresh_token={refresh_token}"
        )
    )
