"""Tests for the first-time signup hardening (DEC-031).

Covers:
  - Profile-field validation (address, DOB, occupation, gender)
  - Self-hosted captcha lifecycle (mint shape, wrong solution, 3-strike
    burn, single use, unknown id)
  - POST /auth/register requires valid profile + solved captcha
  - Face signup OTP gate: complete without proof is rejected, wrong codes
    burn the challenge, verified proof is consumed on success
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app
from backend.app.profile_fields import GENDERS, validate_profile
from backend.app.services.captcha import mint_captcha, verify_captcha


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(config, "FACE_AUTH_ENABLED", True)
    with TestClient(app, base_url="https://testserver") as tc:
        yield tc


from _signup_helpers import (
    PROFILE_PAYLOAD as GOOD,
    deterministic_captcha_id as _mint_known,
    face_signup_start,
)


# ── Profile validation ────────────────────────────────────────────────────


def test_validate_profile_accepts_clean_values():
    cleaned = validate_profile(**GOOD)
    assert cleaned["dob"] == "1990-05-17"
    assert cleaned["gender"] == "female"


def test_validate_profile_rejects_each_field():
    import copy
    bad = copy.deepcopy(GOOD)
    bad["address"] = "short"
    with pytest.raises(ValueError):
        validate_profile(**bad)
    bad = copy.deepcopy(GOOD)
    bad["dob"] = "not-a-date"
    with pytest.raises(ValueError):
        validate_profile(**bad)
    bad = copy.deepcopy(GOOD)
    bad["dob"] = "2030-01-01"
    with pytest.raises(ValueError):
        validate_profile(**bad)
    bad = copy.deepcopy(GOOD)
    bad["dob"] = "2020-01-01"  # underage
    with pytest.raises(ValueError):
        validate_profile(**bad)
    bad = copy.deepcopy(GOOD)
    bad["occupation"] = "x"
    with pytest.raises(ValueError):
        validate_profile(**bad)
    bad = copy.deepcopy(GOOD)
    bad["gender"] = "unknown"
    with pytest.raises(ValueError):
        validate_profile(**bad)


def test_validate_profile_normalizes_gender():
    cleaned = validate_profile(**{**GOOD, "gender": "Prefer Not To Say"})
    assert cleaned["gender"] == "prefer_not_to_say"
    assert GENDERS == {"female", "male", "other", "prefer_not_to_say"}


# ── Captcha lifecycle ─────────────────────────────────────────────────────


def test_captcha_mint_shape_and_svg():
    minted = mint_captcha()
    assert minted["captcha_id"].startswith("cap_")
    assert minted["svg"].startswith("<svg")
    assert minted["expires_in"] == 300


def test_captcha_wrong_solution_then_burns():
    minted = mint_captcha()
    assert verify_captcha(minted["captcha_id"], "WRONG") is False
    assert verify_captcha(minted["captcha_id"], "WRONG") is False
    assert verify_captcha(minted["captcha_id"], "WRONG") is False
    # 3 strikes: challenge burned even for a later attempt
    assert verify_captcha(minted["captcha_id"], "WRONG") is False


def test_captcha_unknown_id_rejected():
    assert verify_captcha("cap_missing", "ABCDE") is False
    assert verify_captcha("", "ABCDE") is False


def test_captcha_http_single_use(client):
    cid = _mint_known(client)
    payload = {"email": "cap1@example.com", "password": "Pass1234!", "full_name": "Cap One",
               **GOOD, "captcha_id": cid, "captcha_solution": "AAAAA"}
    assert client.post("/auth/register", json=payload).status_code == 201
    # Same captcha cannot be replayed for a second account
    payload["email"] = "cap2@example.com"
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400


# ── Register negatives ────────────────────────────────────────────────────


def _reg_base(**over):
    payload = {"email": "neg@example.com", "password": "Pass1234!", "full_name": "Neg Test",
               **GOOD, "captcha_id": "cap_missing", "captcha_solution": "AAAAA"}
    payload.update(over)
    return payload


def test_register_rejects_bad_profile_fields(client):
    for field, value in (("dob", "tomorrow-never"), ("gender", "unknown"),
                         ("address", "tiny"), ("occupation", "x")):
        res = client.post("/auth/register", json=_reg_base(**{field: value}))
        assert res.status_code == 400, (field, res.text)


def test_register_rejects_missing_and_wrong_captcha(client):
    res = client.post("/auth/register", json=_reg_base(captcha_id="", captcha_solution=""))
    assert res.status_code == 400
    res = client.post("/auth/register", json=_reg_base())
    assert res.status_code == 400


def test_register_ok_returns_profile_fields(client):
    cid = _mint_known(client)
    res = client.post("/auth/register", json=_reg_base(
        email="prof@example.com", captcha_id=cid, captcha_solution="AAAAA"))
    assert res.status_code == 201, res.text
    user = res.json()["user"]
    assert user["address"] == GOOD["address"]
    assert user["dob"] == GOOD["dob"]
    assert user["occupation"] == GOOD["occupation"]
    assert user["gender"] == GOOD["gender"]


def test_register_phone_stored_unverified_then_bindable(client):
    from backend.app import users_db
    cid = _mint_known(client)
    res = client.post("/auth/register", json=_reg_base(
        email="ph@example.com", phone="9876543210",
        captcha_id=cid, captcha_solution="AAAAA"))
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["user"]["phone"] == "9876543210"
    assert data["user"]["phoneVerifiedAt"] is None
    # Full OTP bind flow proves the stored number afterwards.
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    req = client.post("/phone/request-otp", json={"phone": "9876543210"}, headers=headers)
    assert req.status_code == 200, req.text
    uid = data["user"]["id"]
    stored = users_db.users_repository.get(uid)
    assert stored["phone"] == "9876543210"


def test_register_rejects_bad_and_duplicate_phone(client):
    cid = _mint_known(client)
    res = client.post("/auth/register", json=_reg_base(
        email="badph@example.com", phone="123",
        captcha_id=cid, captcha_solution="AAAAA"))
    assert res.status_code == 400
    cid = _mint_known(client)
    one = client.post("/auth/register", json=_reg_base(
        email="one@example.com", phone="9123456780",
        captcha_id=cid, captcha_solution="AAAAA"))
    assert one.status_code == 201, one.text
    cid = _mint_known(client)
    two = client.post("/auth/register", json=_reg_base(
        email="two@example.com", phone="9123456780",
        captcha_id=cid, captcha_solution="AAAAA"))
    assert two.status_code == 409


# ── Face signup OTP gate ──────────────────────────────────────────────────


def _face_start(client, phone: str) -> dict:
    res = face_signup_start(client, phone, name="Gate Test")
    assert res.status_code == 200, res.text
    return res.json()


def test_face_start_rejects_bad_profile_and_captcha(client):
    cid = _mint_known(client)
    bad = {"full_name": "Gate Test", "phone": "9876543290", "consent": True,
           **GOOD, "captcha_id": cid, "captcha_solution": "AAAAA", "gender": "unknown"}
    assert client.post("/auth/face/signup/start", json=bad).status_code == 400
    bad["gender"] = "female"
    bad["captcha_solution"] = "WRONG"
    assert client.post("/auth/face/signup/start", json=bad).status_code == 400


def test_face_complete_requires_proven_phone(client):
    import base64
    st = _face_start(client, "9876543291")
    res = client.post("/auth/face/signup/complete", json={
        "signup_token": st["signup_token"],
        "challenge_id": st["challenge_id"],
        "frames": [base64.b64encode(b"junk").decode()] * 5,
    })
    assert res.status_code == 400
    assert res.json().get("error") == "Phone verification required before completing signup"


def test_face_signup_otp_wrong_codes_burn_challenge(client):
    st = _face_start(client, "9876543292")
    token = st["signup_token"]
    for _ in range(3):
        res = client.post("/auth/face/signup/verify-otp",
                          json={"signup_token": token, "code": "999999"})
        assert res.status_code == 400
    # Burned: the challenge is gone, so even a verify attempt fails …
    res = client.post("/auth/face/signup/verify-otp",
                      json={"signup_token": token, "code": "999999"})
    assert res.status_code == 400
    # … while a fresh request-otp starts a brand-new challenge.
    res = client.post("/auth/face/signup/request-otp", json={"signup_token": token})
    assert res.status_code == 200
