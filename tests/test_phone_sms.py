from __future__ import annotations

from backend.app import config
from backend.app.auth import create_access_token
from backend.app.repositories.otp_codes import InMemoryOtpRepository
from backend.app.services.sms import SEND_STAGES, STAGE_SMS_LABEL, render_stage_message
from backend.app.state_machine import GrievanceState
from backend.app.users_db import InMemoryUsersRepository, normalize_phone, to_e164


def test_india_phone_normalization_and_e164():
    assert normalize_phone("+91 (987) 654-3210") == "9876543210"
    assert to_e164("09876543210") == "+919876543210"
    try:
        to_e164("+1 4155551212")
    except ValueError:
        pass
    else:
        raise AssertionError("non-Indian number accepted")


def test_phone_identifier_requires_verified_number():
    users = InMemoryUsersRepository()
    uid = users.create({"phone": "9876543210", "role": "USER"})
    assert users.find_by_identifier("9876543210") is None
    users.update(uid, {"phoneVerifiedAt": "2026-10-10T00:00:00Z"})
    assert users.find_by_identifier("9876543210")["id"] == uid
    assert users.find_by_identifier("CIT-MISSING") is None


def test_otp_regeneration_overwrites_and_attempt_limit_burns():
    repo = InMemoryOtpRepository()
    repo.put("k", "hash-a", "bind")
    repo.put("k", "hash-b", "bind")
    assert repo.get("k")["hash"] == "hash-b"
    for _ in range(3):
        repo.fail("k")
    assert repo.get("k") is None


def test_every_state_has_human_sms_label_and_sent_templates_fit_one_segment():
    assert {s.value for s in GrievanceState} == set(STAGE_SMS_LABEL)
    assert SEND_STAGES <= set(STAGE_SMS_LABEL)
    for stage in SEND_STAGES:
        assert len(render_stage_message("GRV-2026-0010", stage)) <= 160


def test_sms_dry_run_requires_verified_phone_consent_and_deduplicates(monkeypatch):
    from backend.app.services import sms
    from backend.app import users_db

    monkeypatch.setattr(config, "SMS_PROVIDER", "dry-run")
    monkeypatch.setattr(config, "SMS_RATE_LIMIT_PER_USER_HOUR", 100)
    monkeypatch.setattr(config, "SMS_RATE_LIMIT_PER_GRIEVANCE_DAY", 100)
    sms._sent.clear()
    sms._user_dispatches.clear()
    sms._grievance_dispatches.clear()
    uid = users_db.users_repository.create({"phone": "9876543210", "phoneVerifiedAt": "now", "smsConsent": True, "role": "USER"})
    assert sms.send_stage_update(uid, "GRV-2026-0099", "SUBMITTED") is True
    assert sms.send_stage_update(uid, "GRV-2026-0099", "SUBMITTED") is False
    users_db.users_repository.update(uid, {"smsConsent": False, "smsOptOutAt": "now"})
    assert sms.send_stage_update(uid, "GRV-2026-0100", "ASSIGNED") is False


def test_phone_otp_bind_and_phone_login_gate(monkeypatch):
    from backend.app.routers import phone as phone_router
    from backend.app import users_db
    from starlette.requests import Request

    monkeypatch.setattr(config, "OTP_DEBUG_RETURN_CODE", True)
    monkeypatch.setattr(config, "SMS_PROVIDER", "dry-run")
    uid = users_db.users_repository.create({"full_name": "Test Citizen", "phone": "9876543210", "role": "USER"})
    current = {"user_id": uid, "role": "USER"}
    request = Request({"type": "http", "client": ("127.0.0.1", 1234), "headers": []})
    requested = phone_router.request_otp(phone_router.PhoneRequest(phone="9876543210"), request, current)
    verified = phone_router.verify_otp(phone_router.VerifyRequest(phone="9876543210", code=requested["debug_code"]), current)
    assert verified["verified"]
    assert users_db.users_repository.find_by_identifier("9876543210") is None
    bound = phone_router.bind_phone(phone_router.PhoneRequest(phone="9876543210"), current)
    assert bound["phoneVerifiedAt"]
    assert users_db.users_repository.find_by_identifier("9876543210")["id"] == uid


def test_phone_bind_refuses_already_owned_phone(monkeypatch):
    from backend.app.routers import phone as phone_router
    from starlette.requests import Request
    from backend.app import users_db
    monkeypatch.setattr(config, "OTP_DEBUG_RETURN_CODE", True)
    owner = users_db.users_repository.create({"phone": "9876543210", "role": "USER", "phoneVerifiedAt": "now"})
    other = users_db.users_repository.create({"phone": "9123456780", "role": "USER"})
    current = {"user_id": other, "role": "USER"}
    request = Request({"type": "http", "client": ("127.0.0.1", 1234), "headers": []})
    data = phone_router.request_otp(phone_router.PhoneRequest(phone="9876543210"), request, current)
    phone_router.verify_otp(phone_router.VerifyRequest(phone="9876543210", code=data["debug_code"]), current)
    try:
        phone_router.bind_phone(phone_router.PhoneRequest(phone="9876543210"), current)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
    else:
        raise AssertionError("duplicate phone binding should be rejected")
    assert users_db.users_repository.get(owner)["phone"] == "9876543210"
