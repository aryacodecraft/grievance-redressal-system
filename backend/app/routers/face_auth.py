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
import time
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from .. import config
from ..auth import (
    _decode,
    create_reenroll_token,
    create_signup_token,
    get_current_user,
    get_pending_user,
)
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
    FaceTiming,
    _CURRENT_B64_TIME,
    _CURRENT_TIMING,
)
from ..users_db import normalize_phone, users_repository
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
        t0 = time.perf_counter()
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
        _CURRENT_B64_TIME.set((time.perf_counter() - t0) * 1000)
        return decoded


class EnrollRequest(FaceFramesRequest):
    consent: bool = False
    require_login_2fa: bool = False


class FaceLoginRequest(FaceFramesRequest):
    identifier: str | None = None
    email: str | None = None

    @field_validator("identifier", mode="before")
    @classmethod
    def _validate_identifier(cls, value):
        if value is not None and isinstance(value, str):
            return value.strip()
        return value

    @field_validator("email", mode="before")
    @classmethod
    def _validate_email(cls, value):
        if value is not None and isinstance(value, str):
            return value.strip().lower()
        return value


class FaceReenrollRequest(FaceFramesRequest):
    token: str
    identifier: str


class VerifySecondFactorRequest(FaceFramesRequest):
    pass


class TemplateToggleRequest(BaseModel):
    require_login_2fa: bool


class FaceSignupStartRequest(BaseModel):
    full_name: str
    phone: str
    consent: bool = True


class FaceSignupCompleteRequest(FaceFramesRequest):
    signup_token: str


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


def _identifier_key(identifier: str) -> str:
    raw = identifier.strip()
    if "@" in raw:
        return f"face:fail:email:{raw.lower()}"
    if raw.upper().startswith("CIT-"):
        return f"face:fail:id:{raw.upper()}"
    try:
        from ..users_db import normalize_phone
        return f"face:fail:id:{normalize_phone(raw)}"
    except Exception:
        return f"face:fail:id:{raw}"


def _ip_locked(ip: str) -> bool:
    t0 = time.perf_counter()
    res = face_repository.rate_count(_ip_key(ip), RATE_WINDOW_SECONDS) >= IP_FAIL_LIMIT
    timing = _CURRENT_TIMING.get()
    if timing is not None:
        timing.db_ratelimit_ms += (time.perf_counter() - t0) * 1000
    return res


def _email_locked(email: str) -> bool:
    t0 = time.perf_counter()
    res = face_repository.rate_count(_email_key(email), RATE_WINDOW_SECONDS) >= USER_FAIL_LIMIT
    timing = _CURRENT_TIMING.get()
    if timing is not None:
        timing.db_ratelimit_ms += (time.perf_counter() - t0) * 1000
    return res


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
    t0 = time.perf_counter()
    audit_repository.append(entry)
    timing = _CURRENT_TIMING.get()
    if timing is not None:
        timing.db_audit_ms += (time.perf_counter() - t0) * 1000


def _bump(key: str, limit: int, *, actor_id: str, actor_role: str, label: str, ip: str) -> None:
    """Record one failure against *key*; audit the lockout at the boundary."""
    t0 = time.perf_counter()
    allowed, remaining = face_repository.rate_hit(key, limit, RATE_WINDOW_SECONDS)
    timing = _CURRENT_TIMING.get()
    if timing is not None:
        timing.db_ratelimit_ms += (time.perf_counter() - t0) * 1000
    if allowed and remaining == 0:
        _audit_entry(
            "face.lockout",
            actor_id=actor_id,
            actor_role=actor_role,
            entity_id=actor_id,
            reason=f"{label} lockout",
            ip=ip,
        )


def _fail_login(
    *,
    ip: str,
    email: str | None = None,
    identifier: str | None = None,
    subject: dict | None,
    reason: str,
    score: float | None = None,
    count: bool = True,
) -> None:
    """Audit a failed public face login and bump its counters.

    The IP counter always moves; the identifier counter moves only for existing
    USER subjects (DEC-024). Privileged accounts are never counted
    here - their public face login is denied outright. ``count=False`` audits
    without touching any counter: server-side conditions such as
    MODEL_MISMATCH are not attacker failures and must never lock a user out.
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
    if not count:
        return
    _bump(_ip_key(ip), IP_FAIL_LIMIT, actor_id=user_id, actor_role=actor_role, label="ip", ip=ip)
    raw_id = identifier or email or (subject.get("email") if subject else None)
    if subject is not None and subject.get("role") == "USER" and raw_id:
        label = "email" if "@" in raw_id else "identifier"
        _bump(
            _identifier_key(raw_id),
            USER_FAIL_LIMIT,
            actor_id=user_id,
            actor_role=actor_role,
            label=label,
            ip=ip,
        )


def _fail_verify(
    *,
    user_id: str,
    role: str,
    ip: str,
    reason: str,
    score: float | None = None,
    count: bool = True,
) -> None:
    """Audit a failed privileged step-up and bump the per-user counter.

    ``count=False`` behaves like ``_fail_login``: audit only (MODEL_MISMATCH).
    """
    _audit_entry(
        "face.verify_failed",
        actor_id=user_id,
        actor_role=role,
        entity_id=user_id,
        reason=reason,
        ip=ip,
        score=score,
    )
    if not count:
        return
    _bump(_user_key(user_id), USER_FAIL_LIMIT, actor_id=user_id, actor_role=role, label="user", ip=ip)


def _generic_401(headers: dict[str, str] | None = None) -> HTTPException:
    return HTTPException(status_code=401, detail=GENERIC_FAIL, headers=headers)


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


@router.post("/signup/start")
def signup_start(payload: FaceSignupStartRequest, request: Request):
    """Start face-only signup for citizens: validate phone, mint 5-min signup token + challenge."""
    ip = _client_ip(request)
    if _ip_locked(ip):
        raise _locked_429()
    if not payload.consent:
        raise HTTPException(
            status_code=400, detail="Consent is required to sign up with face"
        )
    name = payload.full_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    try:
        phone_clean = normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    if users_repository.find_by_phone(phone_clean):
        raise HTTPException(status_code=400, detail="Could not complete signup")

    action = secrets.choice(VALID_ACTIONS)
    challenge = face_repository.create_challenge(action, 300)
    token = create_signup_token(phone_clean, name)
    return {
        "signup_token": token,
        "challenge_id": challenge["id"],
        "action": challenge["action"],
        "expires_in": 300,
    }


@router.post("/signup/complete")
def signup_complete(payload: FaceSignupCompleteRequest, request: Request):
    """Complete face-only signup: verify enrollment pipeline, create citizen account + template."""
    t_enter = time.perf_counter()
    req_t0 = getattr(request.state, "request_t0", t_enter)
    body_len = getattr(request.state, "body_bytes_len", 0)
    b64_ms = _CURRENT_B64_TIME.get() or 0.0
    json_ms = max(0.0, (t_enter - req_t0) * 1000 - b64_ms)
    timing = FaceTiming(
        request_t0=req_t0,
        body_size_kb=body_len / 1024.0,
        json_parse_ms=json_ms,
        base64_decode_ms=b64_ms,
    )
    _CURRENT_TIMING.set(timing)

    ip = _client_ip(request)
    if _ip_locked(ip):
        raise _locked_429()

    try:
        data = _decode(payload.signup_token)
    except HTTPException:
        raise HTTPException(status_code=400, detail="Invalid or expired signup token")
    if data.get("type") != "signup":
        raise HTTPException(status_code=400, detail="Invalid token type")

    phone = data.get("phone") or data.get("sub")
    full_name = data.get("full_name") or ""
    jti = data.get("jti")

    if jti:
        if face_repository.rate_count(f"face:signup_used:{jti}", 300) > 0:
            raise HTTPException(status_code=400, detail="Signup token already used")
        face_repository.rate_hit(f"face:signup_used:{jti}", limit=1, window_seconds=300)

    t_ch0 = time.perf_counter()
    action, reason = face_repository.consume_challenge(payload.challenge_id)
    timing.db_challenge_ms += (time.perf_counter() - t_ch0) * 1000
    if action is None:
        _audit_entry(
            "face.signup_failed",
            actor_id="",
            actor_role="",
            entity_id="",
            reason=f"challenge_{reason}",
            ip=ip,
        )
        raise HTTPException(status_code=400, detail="Challenge is invalid, expired, or already used")

    if users_repository.find_by_phone(phone):
        _audit_entry(
            "face.signup_failed",
            actor_id="",
            actor_role="",
            entity_id="",
            reason="duplicate_phone",
            ip=ip,
        )
        raise HTTPException(status_code=400, detail="Could not complete signup")

    try:
        verified = face_service.verify_frames(
            payload.frames, action, template=None, op="enroll"
        )
    except FaceAuthError as exc:
        _audit_entry(
            "face.signup_failed",
            actor_id="",
            actor_role="",
            entity_id="",
            reason=exc.code,
            ip=ip,
        )
        raise HTTPException(status_code=400, detail=exc.message)

    try:
        encrypted = face_service.encrypt_embedding(verified.embedding)
    except FaceAuthError as exc:
        _audit_entry(
            "face.signup_failed",
            actor_id="",
            actor_role="",
            entity_id="",
            reason=exc.code,
            ip=ip,
        )
        raise HTTPException(status_code=500, detail="Face service is unavailable")

    citizen_id = users_repository.generate_unique_citizen_id()
    try:
        user_id = users_repository.create({
            "full_name": full_name,
            "phone": phone,
            "citizen_id": citizen_id,
            "role": "USER",
            "auth_method": "face_only",
        })
    except Exception as exc:
        logger.warning("Failed creating user for face signup: %s", exc)
        _audit_entry(
            "face.signup_failed",
            actor_id="",
            actor_role="",
            entity_id="",
            reason="user_create_failed",
            ip=ip,
        )
        raise HTTPException(status_code=400, detail="Could not complete signup")

    t_tm0 = time.perf_counter()
    try:
        face_repository.upsert_template(user_id, {
            "encryptedEmbedding": encrypted,
            "modelName": config.FACE_MODEL_NAME,
            "frameCount": verified.frame_count,
            "consentAt": datetime.now(timezone.utc).isoformat(),
            "requireLogin2fa": False,
        })
    except Exception:
        logger.exception("Failed storing face template for newly created user %s; deleting user", user_id)
        users_repository.delete(user_id)
        _audit_entry(
            "face.signup_failed",
            actor_id=user_id,
            actor_role="USER",
            entity_id=user_id,
            reason="template_write_failed",
            ip=ip,
        )
        raise HTTPException(status_code=500, detail="Could not store face template")
    timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000

    _audit_entry(
        "face.signup_success",
        actor_id=user_id,
        actor_role="USER",
        entity_id=user_id,
        reason="signup_enrolled",
        ip=ip,
    )

    user = users_repository.get(user_id)
    resp = _token_response(user)
    resp["citizen_id"] = citizen_id
    return resp


@router.post("/enroll")
def enroll_face(
    payload: EnrollRequest,
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Enroll a new biometric template for the currently authenticated caller.

    Failures here answer with specific 400 messages: the caller is already
    authenticated, so there is no account oracle to protect.
    """
    t_enter = time.perf_counter()
    req_t0 = getattr(request.state, "request_t0", t_enter)
    body_len = getattr(request.state, "body_bytes_len", 0)
    b64_ms = _CURRENT_B64_TIME.get() or 0.0
    json_ms = max(0.0, (t_enter - req_t0) * 1000 - b64_ms)
    timing = FaceTiming(
        request_t0=req_t0,
        body_size_kb=body_len / 1024.0,
        json_parse_ms=json_ms,
        base64_decode_ms=b64_ms,
    )
    token = _CURRENT_TIMING.set(timing)
    try:
        ip = _client_ip(request)
        if _ip_locked(ip):
            raise _locked_429()
        if not payload.consent:
            raise HTTPException(
                status_code=400, detail="Face data consent is required to enroll a face template"
            )

        t_ch0 = time.perf_counter()
        action, reason = face_repository.consume_challenge(payload.challenge_id)
        timing.db_challenge_ms += (time.perf_counter() - t_ch0) * 1000
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

        t_tm0 = time.perf_counter()
        template = face_repository.get_template(current["user_id"])
        timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000
        try:
            verified = face_service.verify_frames(
                payload.frames, action, template=template, op="enroll"
            )
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

        t_tm0 = time.perf_counter()
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
        timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000
        _audit_entry(
            "face.enrolled",
            actor_id=current["user_id"],
            actor_role=current["role"],
            entity_id=current["user_id"],
            reason="consent granted",
            ip=ip,
        )
        return {"enrolled": True}
    finally:
        timing.total_ms = (time.perf_counter() - timing.request_t0) * 1000
        if config.FACE_DEBUG:
            timing.log()
        _CURRENT_TIMING.reset(token)


@router.post("/login")
def face_login(payload: FaceLoginRequest, request: Request):
    """1:1 face authentication for citizen (USER) accounts.

    Accepts identifier = phone OR citizen_id (email still works for backwards compatibility).
    Fails closed on any issue. Every non-lockout failure returns the same
    generic 401 with identical response body, after executing the same
    pipeline to prevent enumeration.
    """
    t_enter = time.perf_counter()
    req_t0 = getattr(request.state, "request_t0", t_enter)
    body_len = getattr(request.state, "body_bytes_len", 0)
    b64_ms = _CURRENT_B64_TIME.get() or 0.0
    json_ms = max(0.0, (t_enter - req_t0) * 1000 - b64_ms)
    timing = FaceTiming(
        request_t0=req_t0,
        body_size_kb=body_len / 1024.0,
        json_parse_ms=json_ms,
        base64_decode_ms=b64_ms,
    )
    token = _CURRENT_TIMING.set(timing)
    try:
        ip = _client_ip(request)
        raw_identifier = (payload.identifier or payload.email or "").strip()
        subject = users_repository.find_by_identifier(raw_identifier) if raw_identifier else None
        keys_to_check = [_ip_key(ip)]
        if subject is not None and subject.get("role") == "USER" and raw_identifier:
            keys_to_check.append(_identifier_key(raw_identifier))
        t_rl0 = time.perf_counter()
        counts = face_repository.rate_counts(keys_to_check)
        timing.db_ratelimit_ms += (time.perf_counter() - t_rl0) * 1000
        if counts.get(_ip_key(ip), 0) >= IP_FAIL_LIMIT:
            raise _locked_429()
        if raw_identifier and counts.get(_identifier_key(raw_identifier), 0) >= USER_FAIL_LIMIT:
            raise _locked_429()

        t_ch0 = time.perf_counter()
        action, reason = face_repository.consume_challenge(payload.challenge_id)
        timing.db_challenge_ms += (time.perf_counter() - t_ch0) * 1000
        if action is None:
            _fail_login(ip=ip, identifier=raw_identifier, subject=subject, reason=f"challenge_{reason}")
            raise _generic_401()

        t_tm0 = time.perf_counter()
        template = face_repository.get_template(subject["id"]) if subject else None
        timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000
        try:
            verified = face_service.verify_frames(
                payload.frames, action, template=template, op="login"
            )
        except FaceAuthError as exc:
            _fail_login(ip=ip, identifier=raw_identifier, subject=subject, reason=exc.code)
            raise _generic_401()

        if subject is None:
            _fail_login(ip=ip, identifier=raw_identifier, subject=None, reason="unknown_user")
            raise _generic_401()
        if subject.get("role") != "USER":
            _fail_login(ip=ip, identifier=raw_identifier, subject=subject, reason="privileged_signin_denied")
            raise _generic_401()
        if template is None:
            _fail_login(ip=ip, identifier=raw_identifier, subject=subject, reason="not_enrolled")
            raise _generic_401()
        try:
            score = face_service.similarity_to_template(template, verified)
        except FaceAuthError as exc:
            # MODEL_MISMATCH means the server-side model pack changed since
            # enrollment — re-enroll, not lockout: audit but never count it.
            _fail_login(
                ip=ip,
                identifier=raw_identifier,
                subject=subject,
                reason=exc.code,
                count=exc.code != "MODEL_MISMATCH",
            )
            if exc.code == "MODEL_MISMATCH":
                raise _generic_401(headers={"X-Face-Reason": "MODEL_MISMATCH"})
            raise _generic_401()
        if score < config.FACE_MATCH_THRESHOLD:
            _fail_login(ip=ip, identifier=raw_identifier, subject=subject, reason="below_threshold", score=score)
            raise _generic_401()

        t_r0 = time.perf_counter()
        if raw_identifier:
            face_repository.rate_reset(_identifier_key(raw_identifier))
        timing.db_ratelimit_ms += (time.perf_counter() - t_r0) * 1000
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
    finally:
        timing.total_ms = (time.perf_counter() - timing.request_t0) * 1000
        if config.FACE_DEBUG:
            timing.log()
        _CURRENT_TIMING.reset(token)


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
    t_enter = time.perf_counter()
    req_t0 = getattr(request.state, "request_t0", t_enter)
    body_len = getattr(request.state, "body_bytes_len", 0)
    b64_ms = _CURRENT_B64_TIME.get() or 0.0
    json_ms = max(0.0, (t_enter - req_t0) * 1000 - b64_ms)
    timing = FaceTiming(
        request_t0=req_t0,
        body_size_kb=body_len / 1024.0,
        json_parse_ms=json_ms,
        base64_decode_ms=b64_ms,
    )
    token = _CURRENT_TIMING.set(timing)
    try:
        ip = _client_ip(request)
        if pending["role"] not in PRIVILEGED_ROLES:
            # Pending tokens are only minted for privileged accounts - fail closed.
            raise _generic_401()
        user_id = pending["user_id"]
        role = pending["role"]
        t_r0 = time.perf_counter()
        if face_repository.rate_count(_user_key(user_id), RATE_WINDOW_SECONDS) >= USER_FAIL_LIMIT:
            timing.db_ratelimit_ms += (time.perf_counter() - t_r0) * 1000
            raise _locked_429()
        timing.db_ratelimit_ms += (time.perf_counter() - t_r0) * 1000

        t_ch0 = time.perf_counter()
        action, reason = face_repository.consume_challenge(payload.challenge_id)
        timing.db_challenge_ms += (time.perf_counter() - t_ch0) * 1000
        if action is None:
            _fail_verify(user_id=user_id, role=role, ip=ip, reason=f"challenge_{reason}")
            raise _generic_401()

        t_tm0 = time.perf_counter()
        template = face_repository.get_template(user_id)
        timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000
        try:
            verified = face_service.verify_frames(
                payload.frames, action, template=template, op="verify"
            )
        except FaceAuthError as exc:
            _fail_verify(user_id=user_id, role=role, ip=ip, reason=exc.code)
            raise _generic_401()

        user = users_repository.get(user_id)
        if user is None:
            _fail_verify(user_id=user_id, role=role, ip=ip, reason="user_missing")
            raise _generic_401()
        if template is None:
            _fail_verify(user_id=user_id, role=role, ip=ip, reason="not_enrolled")
            raise _generic_401()
        try:
            score = face_service.similarity_to_template(template, verified)
        except FaceAuthError as exc:
            # MODEL_MISMATCH means the server-side model pack changed since
            # enrollment — re-enroll, not lockout: audit but never count it.
            _fail_verify(
                user_id=user_id,
                role=role,
                ip=ip,
                reason=exc.code,
                count=exc.code != "MODEL_MISMATCH",
            )
            raise _generic_401()
        if score < config.FACE_MATCH_THRESHOLD:
            _fail_verify(user_id=user_id, role=role, ip=ip, reason="below_threshold", score=score)
            raise _generic_401()

        t_r0 = time.perf_counter()
        face_repository.rate_reset(_user_key(user_id))
        timing.db_ratelimit_ms += (time.perf_counter() - t_r0) * 1000
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
    finally:
        timing.total_ms = (time.perf_counter() - timing.request_t0) * 1000
        if config.FACE_DEBUG:
            timing.log()
        _CURRENT_TIMING.reset(token)
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


@router.post("/admin-reset/{user_id}")
def admin_reset_face(
    user_id: str,
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Admin/Superadmin reset of a face-only user's face login credential.

    Deletes their face template and generates a 24-hour one-time re-enrollment token.
    """
    if current["role"] not in PRIVILEGED_ROLES:
        raise HTTPException(status_code=403, detail="Requires role: ADMIN, SUPERADMIN")
    ip = _client_ip(request)
    target = users_repository.get(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("auth_method") != "face_only":
        raise HTTPException(status_code=400, detail="Only face-only citizen accounts can be reset")

    face_repository.delete_template(user_id)
    token = create_reenroll_token(
        user_id,
        phone=target.get("phone"),
        citizen_id=target.get("citizen_id"),
    )
    _audit_entry(
        "face.admin_reset",
        actor_id=current["user_id"],
        actor_role=current["role"],
        entity_id=user_id,
        reason="admin_face_reset",
        ip=ip,
    )
    return {
        "re_enroll_token": token,
        "expires_in": 86400,
    }


@router.post("/re-enroll")
def face_reenroll(payload: FaceReenrollRequest, request: Request):
    """Re-enroll face template using a staff-issued one-time re-enrollment token."""
    t_enter = time.perf_counter()
    req_t0 = getattr(request.state, "request_t0", t_enter)
    body_len = getattr(request.state, "body_bytes_len", 0)
    b64_ms = _CURRENT_B64_TIME.get() or 0.0
    json_ms = max(0.0, (t_enter - req_t0) * 1000 - b64_ms)
    timing = FaceTiming(
        request_t0=req_t0,
        body_size_kb=body_len / 1024.0,
        json_parse_ms=json_ms,
        base64_decode_ms=b64_ms,
    )
    token = _CURRENT_TIMING.set(timing)
    try:
        ip = _client_ip(request)
        if _ip_locked(ip):
            raise _locked_429()

        # Validate token
        if not payload.token:
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")
        try:
            claims = _decode(payload.token)
        except HTTPException:
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")

        if claims.get("type") != "re_enroll":
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")

        jti = claims.get("jti")
        if not jti or face_repository.rate_count(f"face:reenroll_burned:{jti}", 86400) > 0:
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")

        user_id = claims.get("sub")
        user = users_repository.get(user_id) if user_id else None
        if not user or user.get("auth_method") != "face_only":
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")

        # Verify identifier matches user
        ident_user = users_repository.find_by_identifier(payload.identifier)
        if not ident_user or ident_user["id"] != user["id"]:
            raise HTTPException(status_code=400, detail="Invalid or expired re-enrollment token")

        t_ch0 = time.perf_counter()
        action, reason = face_repository.consume_challenge(payload.challenge_id)
        timing.db_challenge_ms += (time.perf_counter() - t_ch0) * 1000
        if action is None:
            _audit_entry(
                "face.reenroll_failed",
                actor_id=user_id,
                actor_role=user.get("role", ""),
                entity_id=user_id,
                reason=f"challenge_{reason}",
                ip=ip,
            )
            raise HTTPException(status_code=400, detail="Challenge is invalid, expired, or already used")

        # Run enrollment pipeline (template=None so it doesn't compare against deleted/old template)
        try:
            verified = face_service.verify_frames(
                payload.frames, action, template=None, op="enroll"
            )
        except FaceAuthError as exc:
            _audit_entry(
                "face.reenroll_failed",
                actor_id=user_id,
                actor_role=user.get("role", ""),
                entity_id=user_id,
                reason=exc.code,
                ip=ip,
            )
            # Token is kept valid on verification failure
            raise HTTPException(status_code=400, detail=exc.message)

        try:
            encrypted = face_service.encrypt_embedding(verified.embedding)
        except FaceAuthError as exc:
            _audit_entry(
                "face.reenroll_failed",
                actor_id=user_id,
                actor_role=user.get("role", ""),
                entity_id=user_id,
                reason=exc.code,
                ip=ip,
            )
            raise HTTPException(status_code=500, detail="Face service is unavailable")

        # Store new template
        t_tm0 = time.perf_counter()
        face_repository.upsert_template(user_id, {
            "encryptedEmbedding": encrypted,
            "modelName": config.FACE_MODEL_NAME,
            "frameCount": verified.frame_count,
            "consentAt": datetime.now(timezone.utc).isoformat(),
            "requireLogin2fa": False,
        })
        timing.db_template_ms += (time.perf_counter() - t_tm0) * 1000

        # Burn token on success
        face_repository.rate_hit(f"face:reenroll_burned:{jti}", limit=1, window_seconds=86400)

        _audit_entry(
            "face.reenrolled",
            actor_id=user_id,
            actor_role=user.get("role", ""),
            entity_id=user_id,
            reason="reenrolled_with_token",
            ip=ip,
        )

        resp = _token_response(user)
        resp["re_enrolled"] = True
        return resp
    finally:
        timing.total_ms = (time.perf_counter() - timing.request_t0) * 1000
        if config.FACE_DEBUG:
            timing.log()
        _CURRENT_TIMING.reset(token)

