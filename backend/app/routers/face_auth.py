"""Face authentication endpoints (feature flag: FACE_AUTH_ENABLED, DEC-024).

Routes (all under /auth/face; the flag / HTTPS / 4 MB guards live in the
FaceRouteGuard middleware in main.py so they run before routing and body
parsing):

POST   /auth/face/challenge             public - issue a single-use liveness challenge
POST   /auth/face/enroll                auth - store the caller face (consent required)
POST   /auth/face/login                 public - 1:1 email + face sign-in
POST   /auth/face/verify-second-factor  pending_2fa token - optional privileged step-up
GET    /auth/face/status                auth - is the caller enrolled?
PATCH  /auth/face/template              ADMIN/SUPERADMIN - toggle the optional 2FA step
DELETE /auth/face/template              auth - remove the caller own template
DELETE /auth/face/template/{user_id}    SUPERADMIN - revoke another user template

Wire format is snake_case (challenge_id, frames, require_login_2fa); the
stored template field stays ``requireLogin2fa`` to match routers/auth.py.

Security rules (DEC-024):
  * /login and /verify-second-factor failures always answer the generic
    401 "Face sign-in failed" - no enumeration by status, body or timing:
    the frame pipeline runs before the account-specific outcome.
  * lockout (429) is enforced on these face endpoints only; password and
    Google login are never blocked by it (routers/auth.py reads only the
    per-user verify-second-factor counter for its skip rule).
  * counters (15-minute windows): /login -> 20 per IP + 5 per email
    (USER/RESOLVER subjects only); /verify-second-factor -> 5 per user,
    incremented only when a valid pending_2fa token was presented, so
    unauthenticated callers cannot lock anyone out.
  * every attempt is audited with a machine reason code and the similarity
    bucketed down to 0.05 - never embeddings, frames or raw scores.
  * enroll answers with specific 400 messages: the caller is already
    authenticated there, so the generic anti-enumeration error is needless.
"""

from __future__ import annotations

import base64
import logging
import math
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from .. import config
from ..auth import get_current_user, get_pending_user
from ..permissions import require_permission
from ..repositories.audit import audit_repository
from ..repositories.face_templates import face_repository
from ..services import face_service
from ..services.face_service import (
    CHALLENGE_TTL_SECONDS,
    IP_FAIL_LIMIT,
    MAX_FRAME_BYTES,
    MAX_FRAMES,
    MIN_FRAMES,
    RATE_WINDOW_SECONDS,
    USER_FAIL_LIMIT,
    VALID_ACTIONS,
    FaceAuthError,
)
from ..users_db import users_repository
from .auth import PRIVILEGED_ROLES, _token_response

logger = logging.getLogger("grievance-api")
router = APIRouter(prefix="/auth/face", tags=["auth"])

ORDINARY_ROLES = ("USER", "RESOLVER")
GENERIC_FAIL = "Face sign-in failed"
LOCKED_MSG = "Too many failed attempts. Please try again later."


# ── Request models ───────────────────────────────────────────────────────────

class FaceFramesRequest(BaseModel):
    """Shared shape: a fresh challenge plus 5-8 base64 JPEG frames."""

    challenge_id: str = Field(min_length=1, max_length=64)
    frames: list[bytes] = Field(min_length=MIN_FRAMES, max_length=MAX_FRAMES)

    @field_validator("frames", mode="before")
    @classmethod
    def _decode_frames(cls, value):
        if not isinstance(value, list):
            return value
        decoded: list[bytes] = []
        for item in value:
            if not isinstance(item, str):
                raise ValueError("frames must be base64-encoded strings")
            try:
                raw = base64.b64decode(item, validate=True)
            except Exception as exc:
                raise ValueError("frame is not valid base64") from exc
            if not raw:
                raise ValueError("frame is empty")
            if len(raw) > MAX_FRAME_BYTES:
                raise ValueError("frame exceeds 1 MB")
            decoded.append(raw)
        return decoded


class EnrollRequest(FaceFramesRequest):
    consent: bool = False
    require_login_2fa: bool = False


class FaceLoginRequest(FaceFramesRequest):
    email: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class VerifySecondFactorRequest(FaceFramesRequest):
    pass


class TemplateToggleRequest(BaseModel):
    require_login_2fa: bool


# ── Helpers ──────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    if config.TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def _ip_key(ip: str) -> str:
    return f"face:fail:ip:{ip}"


def _email_key(email: str) -> str:
    return f"face:fail:email:{email}"


def _user_key(user_id: str) -> str:
    return f"face:fail:user:{user_id}"


def _ip_locked(ip: str) -> bool:
    return face_repository.rate_count(_ip_key(ip), RATE_WINDOW_SECONDS) >= IP_FAIL_LIMIT


def _email_locked(email: str) -> bool:
    return face_repository.rate_count(_email_key(email), RATE_WINDOW_SECONDS) >= USER_FAIL_LIMIT


def _score_bucket(score: float) -> str:
    """Similarity rounded DOWN to 0.05 - auditable without exposing the score."""
    return f"{math.floor(score / 0.05) * 0.05:.2f}"


def _audit_entry(
    action: str,
    *,
    actor_id: str = "",
    actor_role: str = "",
    entity_id: str = "",
    reason: str = "",
    ip: str = "",
    score: float | None = None,
    old: dict | None = None,
    new: dict | None = None,
) -> None:
    """One audit row for a face action - SYSTEM-sourced, never embeddings."""
    entry: dict = {
        "actorId": actor_id,
        "actorRole": actor_role,
        "action": action,
        "entity": "face_template",
        "entityId": entity_id,
        "reason": reason,
        "ip": ip,
        "source": "SYSTEM",
    }
    if score is not None:
        entry["scoreBucket"] = _score_bucket(score)
    if old is not None:
        entry["old"] = old
    if new is not None:
        entry["new"] = new
    audit_repository.append(entry)


def _bump(key: str, limit: int, *, actor_id: str, actor_role: str, label: str, ip: str) -> None:
    """Record one failure against *key*; audit the lockout at the boundary."""
    allowed, remaining = face_repository.rate_hit(key, limit, RATE_WINDOW_SECONDS)
    if allowed and remaining == 0:
        _audit_entry(
            "face.lockout",
            actor_id=actor_id,
            actor_role=actor_role,
            entity_id=actor_id,
            reason=f"{label} lockout",
            ip=ip,
        )


def _fail_login(*, ip: str, email: str, subject: dict | None, reason: str, score: float | None = None) -> None:
    """Audit a failed public face login and bump its counters.

    The IP counter always moves; the email counter only for existing
    USER/RESOLVER subjects (DEC-024). Privileged accounts are never counted
    here - their public face login is denied outright.
    """
    user_id = subject["id"] if subject else ""
    actor_role = subject.get("role", "") if subject else ""
    _audit_entry(
        "face.login_failed",
        actor_id=user_id,
        actor_role=actor_role,
        entity_id=user_id,
        reason=reason,
        ip=ip,
        score=score,
    )
    _bump(_ip_key(ip), IP_FAIL_LIMIT, actor_id=user_id, actor_role=actor_role, label="ip", ip=ip)
    if subject is not None and subject.get("role") in ORDINARY_ROLES:
        _bump(_email_key(email), USER_FAIL_LIMIT, actor_id=user_id, actor_role=actor_role, label="email", ip=ip)


def _fail_verify(*, user_id: str, role: str, ip: str, reason: str, score: float | None = None) -> None:
    """Audit a failed privileged step-up and bump the per-user counter."""
    _audit_entry(
        "face.verify_failed",
        actor_id=user_id,
        actor_role=role,
        entity_id=user_id,
        reason=reason,
        ip=ip,
        score=score,
    )
    _bump(_user_key(user_id), USER_FAIL_LIMIT, actor_id=user_id, actor_role=role, label="user", ip=ip)


def _generic_401() -> HTTPException:
    return HTTPException(status_code=401, detail=GENERIC_FAIL)


def _locked_429() -> HTTPException:
    return HTTPException(status_code=429, detail=LOCKED_MSG)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/challenge")
def issue_challenge(request: Request):
    """Issue a single-use liveness challenge (random action, 30 s TTL)."""
    ip = _client_ip(request)
    if _ip_locked(ip):
        raise _locked_429()
    challenge = face_repository.create_challenge(
        secrets.choice(VALID_ACTIONS), CHALLENGE_TTL_SECONDS
    )
    return {
        "challenge_id": challenge["id"],
        "action": challenge["action"],
        "expires_in": CHALLENGE_TTL_SECONDS,
    }


@router.post("/enroll")
def enroll_face(
    payload: EnrollRequest,
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Store the caller's face template (consent required, re-enroll = replace).

    Failures here answer with specific 400 messages: the caller is already
    authenticated, so there is no account oracle to protect.
    """
    ip = _client_ip(request)
    if _ip_locked(ip):
        raise _locked_429()
    if not payload.consent:
        raise HTTPException(
            status_code=400, detail="Face data consent is required to enroll a face template"
        )

    action, reason = face_repository.consume_challenge(payload.challenge_id)
    if action is None:
        _audit_entry(
            "face.enroll_failed",
            actor_id=current["user_id"],
            actor_role=current["role"],
            entity_id=current["user_id"],
            reason=f"challenge_{reason}",
            ip=ip,
        )
        raise HTTPException(status_code=400, detail="Challenge is invalid, expired, or already used")

    try:
        verified = face_service.verify_frames(payload.frames, action)
    except FaceAuthError as exc:
        _audit_entry(
            "face.enroll_failed",
            actor_id=current["user_id"],
            actor_role=current["role"],
            entity_id=current["user_id"],
            reason=exc.code,
            ip=ip,
        )
        raise HTTPException(status_code=400, detail=exc.message)

    try:
        encrypted = face_service.encrypt_embedding(verified.embedding)
    except FaceAuthError as exc:
        logger.error("face embedding encryption failed: %s", exc.code)
        _audit_entry(
            "face.enroll_failed",
            actor_id=current["user_id"],
            actor_role=current["role"],
            entity_id=current["user_id"],
            reason=exc.code,
            ip=ip,
        )
        raise HTTPException(status_code=500, detail="Face service is unavailable")

    face_repository.upsert_template(current["user_id"], {
        "encryptedEmbedding": encrypted,
        "modelName": config.FACE_MODEL_NAME,
        "frameCount": verified.frame_count,
        "consentAt": datetime.now(timezone.utc).isoformat(),
        # The optional 2FA step only exists for privileged accounts (DEC-024).
        "requireLogin2fa": bool(
            payload.require_login_2fa and current["role"] in PRIVILEGED_ROLES
        ),
    })
    _audit_entry(
        "face.enrolled",
        actor_id=current["user_id"],
        actor_role=current["role"],
        entity_id=current["user_id"],
        reason="consent granted",
        ip=ip,
    )
    return {"enrolled": True}


@router.post("/login")
def face_login(payload: FaceLoginRequest, request: Request):
    """1:1 email + face sign-in for USER/RESOLVER accounts.

    Always the generic 401 on failure; the frame pipeline runs before the
    account-specific branches so known and unknown emails take the same
    expensive path (timing-shape anti-enumeration).
    """
    ip = _client_ip(request)
    if _ip_locked(ip):
        raise _locked_429()
    email = payload.email
    subject = users_repository.find_by_email(email)
    if subject is not None and subject.get("role") in ORDINARY_ROLES and _email_locked(email):
        raise _locked_429()

    action, reason = face_repository.consume_challenge(payload.challenge_id)
    if action is None:
        _fail_login(ip=ip, email=email, subject=subject, reason=f"challenge_{reason}")
        raise _generic_401()
    try:
        verified = face_service.verify_frames(payload.frames, action)
    except FaceAuthError as exc:
        _fail_login(ip=ip, email=email, subject=subject, reason=exc.code)
        raise _generic_401()

    if subject is None:
        _fail_login(ip=ip, email=email, subject=None, reason="unknown_user")
        raise _generic_401()
    if subject.get("role") in PRIVILEGED_ROLES:
        _fail_login(ip=ip, email=email, subject=subject, reason="privileged_signin_denied")
        raise _generic_401()
    template = face_repository.get_template(subject["id"])
    if template is None:
        _fail_login(ip=ip, email=email, subject=subject, reason="not_enrolled")
        raise _generic_401()
    try:
        score = face_service.similarity_to_template(template, verified)
    except FaceAuthError as exc:
        _fail_login(ip=ip, email=email, subject=subject, reason=exc.code)
        raise _generic_401()
    if score < config.FACE_MATCH_THRESHOLD:
        _fail_login(ip=ip, email=email, subject=subject, reason="below_threshold", score=score)
        raise _generic_401()

    face_repository.rate_reset(_email_key(email))
    _audit_entry(
        "face.login_success",
        actor_id=subject["id"],
        actor_role=subject.get("role", ""),
        entity_id=subject["id"],
        reason="1:1 match",
        ip=ip,
        score=score,
    )
    return _token_response(subject)


@router.post("/verify-second-factor")
def verify_second_factor(
    payload: VerifySecondFactorRequest,
    request: Request,
    pending: Annotated[dict, Depends(get_pending_user)],
):
    """Optional face step after a privileged password/Google login.

    The pending token dependency rejects everything else (including full
    access tokens), so unauthenticated callers can never burn the per-user
    counter. Success exchanges the pending token for the full token pair -
    identical shape to a password login, so RBAC is untouched.
    """
    ip = _client_ip(request)
    if pending["role"] not in PRIVILEGED_ROLES:
        # Pending tokens are only minted for privileged accounts - fail closed.
        raise _generic_401()
    user_id = pending["user_id"]
    role = pending["role"]
    if face_repository.rate_count(_user_key(user_id), RATE_WINDOW_SECONDS) >= USER_FAIL_LIMIT:
        raise _locked_429()

    action, reason = face_repository.consume_challenge(payload.challenge_id)
    if action is None:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason=f"challenge_{reason}")
        raise _generic_401()
    try:
        verified = face_service.verify_frames(payload.frames, action)
    except FaceAuthError as exc:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason=exc.code)
        raise _generic_401()

    user = users_repository.get(user_id)
    if user is None:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason="user_missing")
        raise _generic_401()
    template = face_repository.get_template(user_id)
    if template is None:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason="not_enrolled")
        raise _generic_401()
    try:
        score = face_service.similarity_to_template(template, verified)
    except FaceAuthError as exc:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason=exc.code)
        raise _generic_401()
    if score < config.FACE_MATCH_THRESHOLD:
        _fail_verify(user_id=user_id, role=role, ip=ip, reason="below_threshold", score=score)
        raise _generic_401()

    face_repository.rate_reset(_user_key(user_id))
    _audit_entry(
        "face.verify_success",
        actor_id=user_id,
        actor_role=role,
        entity_id=user_id,
        reason="1:1 match",
        ip=ip,
        score=score,
    )
    return _token_response(user)

@router.get("/status")
def face_status(current: Annotated[dict, Depends(get_current_user)]):
    """Whether the caller has a stored face template."""
    return {"enrolled": face_repository.get_template(current["user_id"]) is not None}


@router.patch("/template")
def update_template(
    payload: TemplateToggleRequest,
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Toggle the optional post-password face step (privileged accounts only)."""
    if current["role"] not in PRIVILEGED_ROLES:
        raise HTTPException(status_code=403, detail="Requires role: ADMIN, SUPERADMIN")
    ip = _client_ip(request)
    user_id = current["user_id"]
    template = face_repository.get_template(user_id)
    if template is None:
        raise HTTPException(status_code=404, detail="No face template")
    was = bool(template.get("requireLogin2fa"))
    updated = face_repository.upsert_template(
        user_id, {**template, "requireLogin2fa": payload.require_login_2fa}
    )
    _audit_entry(
        "face.template_updated",
        actor_id=user_id,
        actor_role=current["role"],
        entity_id=user_id,
        reason="requireLogin2fa toggled",
        ip=ip,
        old={"requireLogin2fa": was},
        new={"requireLogin2fa": bool(payload.require_login_2fa)},
    )
    return {"requireLogin2fa": bool(updated.get("requireLogin2fa"))}


@router.delete("/template")
def delete_own_template(
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Remove the caller's own template (any role; self-service opt-out)."""
    ip = _client_ip(request)
    user_id = current["user_id"]
    if not face_repository.delete_template(user_id):
        raise HTTPException(status_code=404, detail="No face template")
    _audit_entry(
        "face.template_deleted",
        actor_id=user_id,
        actor_role=current["role"],
        entity_id=user_id,
        reason="removed by owner",
        ip=ip,
    )
    return {"deleted": True}


@router.delete("/template/{user_id}")
def revoke_template(
    user_id: str,
    request: Request,
    current: Annotated[dict, Depends(require_permission("user.manage_admin"))],
):
    """Revoke another user's template (SUPERADMIN only)."""
    ip = _client_ip(request)
    if not face_repository.delete_template(user_id):
        raise HTTPException(status_code=404, detail="No face template")
    _audit_entry(
        "face.template_revoked",
        actor_id=current["user_id"],
        actor_role=current["role"],
        entity_id=user_id,
        reason="revoked by superadmin",
        ip=ip,
    )
    return {"deleted": True}

