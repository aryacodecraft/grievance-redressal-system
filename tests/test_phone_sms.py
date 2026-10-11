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


class _FakeMessages:
    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail

    def create(self, **kwargs):
        if self.fail:
            raise RuntimeError("carrier down")
        self.sent.append(kwargs)
        return type("FakeMessage", (), {"sid": "SMfake123"})()


class _FakeTwilioClient:
    def __init__(self, fail=False):
        self.messages = _FakeMessages(fail=fail)


def _twilio_env(monkeypatch, provider="twilio"):
    from backend.app.services import sms
    monkeypatch.setattr(config, "SMS_PROVIDER", provider)
    monkeypatch.setattr(config, "TWILIO_ACCOUNT_SID", "ACfake")
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", "tokfake")
    monkeypatch.setattr(config, "TWILIO_MESSAGING_SERVICE_SID", "MGfake")
    monkeypatch.setattr(config, "SMS_RATE_LIMIT_PER_USER_HOUR", 100)
    monkeypatch.setattr(config, "SMS_RATE_LIMIT_PER_GRIEVANCE_DAY", 100)
    sms._sent.clear()
    sms._user_dispatches.clear()
    sms._grievance_dispatches.clear()
    return sms


def _consenting_citizen(phone="9876543210"):
    from backend.app import users_db
    return users_db.users_repository.create({
        "phone": phone, "phoneVerifiedAt": "now", "smsConsent": True, "role": "USER"})


def test_sms_twilio_stage_dispatch_uses_messaging_service(monkeypatch):
    sms = _twilio_env(monkeypatch)
    fake = _FakeTwilioClient()
    monkeypatch.setattr(sms, "_twilio_client", lambda: fake)
    uid = _consenting_citizen()
    assert sms.send_stage_update(uid, "GRV-2026-0201", "ASSIGNED") is True
    assert len(fake.messages.sent) == 1
    payload = fake.messages.sent[0]
    assert payload["messaging_service_sid"] == "MGfake"
    assert payload["to"] == "+919876543210"
    assert "GRV-2026-0201" in payload["body"]
    # At-most-once: the same grievance+stage never sends twice.
    assert sms.send_stage_update(uid, "GRV-2026-0201", "ASSIGNED") is False
    assert len(fake.messages.sent) == 1


def test_sms_twilio_incomplete_credentials_sends_nothing(monkeypatch):
    sms = _twilio_env(monkeypatch)
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", "")

    def _boom():
        raise AssertionError("client must not be built without credentials")
    monkeypatch.setattr(sms, "_twilio_client", _boom)
    uid = _consenting_citizen()
    assert sms.send_stage_update(uid, "GRV-2026-0202", "SUBMITTED") is False
    assert sms.send_otp_code("9876543210", "123456") is False


def test_sms_twilio_failure_is_isolated_from_workflows(monkeypatch):
    sms = _twilio_env(monkeypatch)
    monkeypatch.setattr(sms, "_twilio_client", lambda: _FakeTwilioClient(fail=True))
    uid = _consenting_citizen()
    assert sms.send_stage_update(uid, "GRV-2026-0203", "IN_PROGRESS") is False
    assert sms.send_otp_code("9876543210", "123456") is False


def test_sms_twilio_otp_body_and_no_code_in_logs(monkeypatch, caplog):
    from backend.app.services.sms import render_otp_message
    sms = _twilio_env(monkeypatch)
    fake = _FakeTwilioClient()
    monkeypatch.setattr(sms, "_twilio_client", lambda: fake)
    with caplog.at_level("INFO", logger="grievance-api"):
        assert sms.send_otp_code("9876543210", "123456") is True
    assert fake.messages.sent[0]["body"] == render_otp_message("123456")
    assert fake.messages.sent[0]["to"] == "+919876543210"
    assert "123456" not in caplog.text
    assert "9876543210" not in caplog.text


def test_sms_unsupported_provider_sends_nothing(monkeypatch):
    sms = _twilio_env(monkeypatch, provider="pigeon")
    uid = _consenting_citizen()
    assert sms.send_stage_update(uid, "GRV-2026-0204", "SUBMITTED") is False
    assert sms.send_otp_code("9876543210", "123456") is False


def test_request_otp_delivers_code_over_twilio_without_oracle(monkeypatch):
    from backend.app.routers import phone as phone_router
    from backend.app import users_db
    from starlette.requests import Request
    sms = _twilio_env(monkeypatch)
    fake = _FakeTwilioClient()
    monkeypatch.setattr(sms, "_twilio_client", lambda: fake)
    monkeypatch.setattr(config, "OTP_DEBUG_RETURN_CODE", True)
    uid = users_db.users_repository.create({"full_name": "T Citizen", "phone": "9112345678", "role": "USER"})
    request = Request({"type": "http", "client": ("127.0.0.1", 1234), "headers": []})
    result = phone_router.request_otp(phone_router.PhoneRequest(phone="9112345678"), request, {"user_id": uid, "role": "USER"})
    # Generic response even though delivery ran; debug codes stay dry-run-only.
    assert "debug_code" not in result
    assert len(fake.messages.sent) == 1
    assert fake.messages.sent[0]["to"] == "+919112345678"
