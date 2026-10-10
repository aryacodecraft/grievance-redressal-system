"""JWT authentication utilities and FastAPI dependency helpers."""

from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import jwt  # PyJWT

import secrets

logger = logging.getLogger("grievance-api")

# ── Settings ────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"
ACCESS_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
# Pending-login token issued when an opted-in privileged account still has the
# optional face step ahead of it (DEC-024). Short-lived by design; it can only
# be exchanged via /auth/complete-pending or /auth/face/verify-second-factor.
PENDING_EXPIRE_MINUTES = 5

_bearer = HTTPBearer(auto_error=False)


# ── Token creation ───────────────────────────────────────────────────────────

def create_access_token(user_id: str, role: str, email: str | None = None, department_id: str | None = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "email": email or "",
        "departmentId": department_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_pending_token(user_id: str, role: str, email: str | None = None, department_id: str | None = None) -> str:
    """Half-authenticated login: credentials verified, face step still open.

    Not a full access token — `get_current_user` rejects any type other than
    "access", so a pending token grants no API access on its own.
    """
    payload = {
        "sub": user_id,
        "role": role,
        "email": email or "",
        "departmentId": department_id,
        "type": "pending_2fa",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=PENDING_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_signup_token(phone: str, full_name: str, sms_consent: bool = False) -> str:
    """Short-lived signup token carrying normalized phone and full_name (5 min)."""
    payload = {
        "sub": phone,
        "phone": phone,
        "full_name": full_name,
        "sms_consent": bool(sms_consent),
        "type": "signup",
        "jti": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_reenroll_token(user_id: str, phone: str | None = None, citizen_id: str | None = None) -> str:
    """One-time re-enrollment token valid for 24 hours."""
    payload = {
        "sub": user_id,
        "phone": phone or "",
        "citizen_id": citizen_id or "",
        "type": "re_enroll",
        "jti": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Token verification ───────────────────────────────────────────────────────

def _decode(token: str) -> dict:
    """Decode and verify a JWT.  Raises HTTPException on any failure."""
    if not JWT_SECRET:
        # Fallback: allow requests when JWT_SECRET_KEY is not configured so
        # the demo / in-memory mode is still usable without real secrets.
        logger.warning("JWT_SECRET_KEY not set — running without token validation.")
        raise HTTPException(status_code=500, detail="JWT_SECRET_KEY not configured")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


# ── FastAPI dependencies ─────────────────────────────────────────────────────

def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    """Require a valid Bearer access token.  Returns token payload dict.

    Raises 401 when the token is missing, expired, or invalid.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode(creds.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return {
        "user_id": payload["sub"],
        "role": payload.get("role", "USER"),
        "email": payload.get("email", ""),
        "departmentId": payload.get("departmentId"),
    }


def get_pending_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    """Require a valid ``pending_2fa`` token (half-authenticated login).

    Raises 401 when missing/expired/invalid or of any other token type —
    full access tokens are rejected here on purpose (the pending flow must be
    started by password/Google login, not reused from an established session).
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode(creds.credentials)
    if payload.get("type") != "pending_2fa":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return {
        "user_id": payload["sub"],
        "role": payload.get("role", "USER"),
        "email": payload.get("email", ""),
        "departmentId": payload.get("departmentId"),
    }


def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict | None:
    """Like get_current_user but returns None instead of 401 when no token."""
    if not creds or not JWT_SECRET:
        return None
    try:
        payload = _decode(creds.credentials)
        if payload.get("type") != "access":
            return None
        return {
            "user_id": payload["sub"],
            "role": payload.get("role", "USER"),
            "email": payload.get("email", ""),
        }
    except HTTPException:
        return None


def require_role(allowed: list[str]):
    """Dependency factory: require the caller's role to be in *allowed*.

    Usage::

        @router.patch("/grievances/{id}/status")
        def update(current: dict = Depends(require_role(["ADMIN", "RESOLVER"]))):
            ...
    """
    def _check(current: Annotated[dict, Depends(get_current_user)]) -> dict:
        if current["role"] not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(allowed)}",
            )
        return current
    return _check
