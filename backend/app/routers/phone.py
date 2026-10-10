"""OTP-proven citizen phone binding and independently withdrawable SMS consent."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from .. import config
from ..auth import get_current_user
from ..repositories.audit import audit_repository
from ..repositories.face_templates import face_repository
from ..repositories.otp_codes import otp_repository
from ..users_db import normalize_phone, to_e164, users_repository

router = APIRouter(prefix="/phone", tags=["phone"])
logger = logging.getLogger("grievance-api")


class PhoneRequest(BaseModel):
    phone: str


class VerifyRequest(PhoneRequest):
    code: str

    @field_validator("code")
    @classmethod
    def valid_code(cls, value):
        if len(value) != 6 or not value.isdigit():
            raise ValueError("Enter the six-digit verification code")
        return value


class ConsentRequest(BaseModel):
    enabled: bool


def _citizen(current):
    if current.get("role") != "USER":
        raise HTTPException(403, "Phone settings are available to citizen accounts")


def _mask(phone: str | None) -> str | None:
    return f"{phone[:2]}***{phone[-5:]}" if phone and len(phone) == 10 else None


def _key(user_id: str, phone: str, purpose: str) -> str:
    raw = f"{user_id}:{phone}:{purpose}".encode()
    return hmac.new(config.OTP_HASH_SECRET.encode(), raw, hashlib.sha256).hexdigest()


def _hash(key: str, code: str) -> str:
    return hmac.new(config.OTP_HASH_SECRET.encode(), f"{key}:{code}".encode(), hashlib.sha256).hexdigest()


def _purpose(user, phone):
    return "unbind" if user.get("phone") == phone and user.get("phoneVerifiedAt") else "bind"


@router.post("/request-otp")
def request_otp(payload: PhoneRequest, request: Request, current: Annotated[dict, Depends(get_current_user)]):
    _citizen(current)
    try:
        phone = normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(400, "Enter a valid Indian mobile number")
    ip = request.client.host if request.client else "unknown"
    phone_key = hmac.new(config.OTP_HASH_SECRET.encode(), phone.encode(), hashlib.sha256).hexdigest()
    ip_key = hashlib.sha256(ip.encode()).hexdigest()
    for key, limit in ((f"otp:user:{current['user_id']}", 5), (f"otp:phone:{phone_key}", 5), (f"otp:ip:{ip_key}", 10)):
        allowed, _remaining = face_repository.rate_hit(key, limit, 3600)
        if not allowed:
            raise HTTPException(429, "Too many verification requests. Try again later.")
    account = users_repository.get(current["user_id"]) or {}
    purpose = _purpose(account, phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    key = _key(current["user_id"], phone, purpose)
    otp_repository.put(key, _hash(key, code), purpose, 300)
    # Dry-run never emits OTP values in logs. Local developers may explicitly
    # enable a response-only code; this is disabled by default and forbidden
    # when external delivery is configured.
    logger.info("Phone OTP issued provider=%s destination=%s", config.SMS_PROVIDER, _mask(phone))
    result = {"message": "If this number can be verified, a code has been issued.", "expires_in": 300}
    if config.OTP_DEBUG_RETURN_CODE and config.SMS_PROVIDER == "dry-run":
        result["debug_code"] = code
    return result


@router.post("/verify-otp")
def verify_otp(payload: VerifyRequest, current: Annotated[dict, Depends(get_current_user)]):
    _citizen(current)
    try:
        phone = normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(400, "Verification failed")
    account = users_repository.get(current["user_id"]) or {}
    purpose = _purpose(account, phone)
    key = _key(current["user_id"], phone, purpose)
    challenge = otp_repository.get(key)
    if not challenge or challenge.get("purpose") != purpose or challenge.get("attempts", 0) >= 3:
        raise HTTPException(400, "Verification failed or expired")
    if not hmac.compare_digest(challenge["hash"], _hash(key, payload.code)):
        otp_repository.fail(key)
        raise HTTPException(400, "Verification failed or expired")
    otp_repository.mark_verified(key)
    return {"verified": True, "purpose": purpose}


@router.post("/bind")
def bind_phone(payload: PhoneRequest, current: Annotated[dict, Depends(get_current_user)]):
    _citizen(current)
    try:
        phone = normalize_phone(payload.phone)
    except ValueError:
        raise HTTPException(400, "Enter a valid Indian mobile number")
    account = users_repository.get(current["user_id"]) or {}
    purpose = _purpose(account, phone)
    key = _key(current["user_id"], phone, purpose)
    challenge = otp_repository.get(key)
    if not challenge or not challenge.get("verified") or purpose != "bind":
        raise HTTPException(400, "Verify this number before binding it")
    owner = users_repository.find_by_phone(phone)
    if owner and owner.get("id") != current["user_id"]:
        raise HTTPException(409, "This number cannot be linked to this account")
    now = datetime.now(timezone.utc).isoformat()
    before = users_repository.get(current["user_id"])
    updated = users_repository.update(current["user_id"], {
        "phone": phone, "phoneVerifiedAt": now, "phoneVerifiedMethod": "otp_sms",
    })
    if not updated:
        raise HTTPException(409, "Unable to link this number")
    otp_repository.consume(key)
    audit_repository.append({"actorId": current["user_id"], "actorRole": "USER",
        "action": "phone.bound", "entity": "user", "entityId": current["user_id"],
        "old": {"phone": _mask((before or {}).get("phone"))}, "new": {"phone": _mask(phone), "verified": True},
        "at": now, "reason": "OTP verified", "source": "HUMAN"})
    return {"phone": phone, "phoneVerifiedAt": now, "phoneVerifiedMethod": "otp_sms"}


@router.post("/unbind")
def unbind_phone(current: Annotated[dict, Depends(get_current_user)]):
    _citizen(current)
    account = users_repository.get(current["user_id"]) or {}
    phone = account.get("phone")
    if not phone:
        raise HTTPException(400, "No mobile number is linked")
    key = _key(current["user_id"], phone, "unbind")
    challenge = otp_repository.get(key)
    if not challenge or not challenge.get("verified"):
        raise HTTPException(400, "Verify the linked number before removing it")
    now = datetime.now(timezone.utc).isoformat()
    users_repository.update(current["user_id"], {"phone": None, "phoneVerifiedAt": None,
        "phoneVerifiedMethod": None, "smsConsent": False, "smsOptOutAt": now})
    otp_repository.consume(key)
    audit_repository.append({"actorId": current["user_id"], "actorRole": "USER",
        "action": "phone.unbound", "entity": "user", "entityId": current["user_id"],
        "old": {"phone": _mask(phone)}, "new": {"phone": None}, "at": now,
        "reason": "OTP verified; SMS updates opted out", "source": "HUMAN"})
    return {"unbound": True}


@router.patch("/consent")
def update_consent(payload: ConsentRequest, current: Annotated[dict, Depends(get_current_user)]):
    _citizen(current)
    now = datetime.now(timezone.utc).isoformat()
    users_repository.update(current["user_id"], {"smsConsent": payload.enabled,
        "smsConsentAt": now if payload.enabled else None,
        "smsOptOutAt": None if payload.enabled else now})
    return {"smsConsent": payload.enabled, "smsOptOutAt": None if payload.enabled else now}
