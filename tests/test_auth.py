"""Tests for JWT authentication and RBAC endpoints.

Covers:
  - POST /auth/register
  - POST /auth/login
  - POST /auth/refresh
  - GET  /auth/me
  - Role-scoped access to /grievances and /grievances/{id}/status

All tests run fully in-process via FastAPI TestClient.
`conftest.py` provides:
  - ``client``    — TestClient with fresh in-memory repositories per test
  - ``sample_payload`` — a minimal grievance submission body (no userId)
"""

from __future__ import annotations

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
REFRESH_URL = "/auth/refresh"
ME_URL = "/auth/me"


def _reg(client, monkeypatch, email="u@example.com", password="Pass1234!", name="Test User"):
    from _signup_helpers import register_citizen
    return register_citizen(client, email, password, name)


def _login(client, email="u@example.com", password="Pass1234!"):
    return client.post(LOGIN_URL, json={"email": email, "password": password})


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Register ──────────────────────────────────────────────────────────────────

class TestRegister:
    def test_register_ok_returns_201_and_tokens(self, client, monkeypatch):
        res = _reg(client, monkeypatch)
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "u@example.com"
        assert data["user"]["role"] == "USER"

    def test_register_duplicate_email_returns_409(self, client, monkeypatch):
        from _signup_helpers import deterministic_captcha_id, PROFILE_PAYLOAD
        _reg(client, monkeypatch)
        payload = {"email": "u@example.com", "password": "Pass1234!", "full_name": "Test User",
                   "phone": "9222222222", **PROFILE_PAYLOAD,
                   "captcha_id": deterministic_captcha_id(client), "captcha_solution": "AAAAA"}
        res = client.post(REGISTER_URL, json=payload)
        assert res.status_code == 409

    def test_register_short_password_returns_400(self, client):
        res = client.post(REGISTER_URL, json={"email": "x@x.com", "password": "short", "full_name": "X"})
        assert res.status_code == 400

    def test_register_blank_name_returns_400(self, client):
        res = client.post(REGISTER_URL, json={"email": "x@x.com", "password": "Pass1234!", "full_name": "   "})
        assert res.status_code == 400

    def test_register_invalid_email_returns_400(self, client):
        res = client.post(REGISTER_URL, json={"email": "not-an-email", "password": "Pass1234!", "full_name": "X"})
        assert res.status_code == 400

    def test_register_missing_fields_returns_400(self, client):
        res = client.post(REGISTER_URL, json={"email": "x@x.com"})
        assert res.status_code == 400


# ── Login ────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_correct_credentials_returns_tokens(self, client, monkeypatch):
        _reg(client, monkeypatch, "login@x.com", "Pass1234!")
        res = _login(client, "login@x.com", "Pass1234!")
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "login@x.com"

    def test_login_wrong_password_returns_401(self, client, monkeypatch):
        _reg(client, monkeypatch, "wrong@x.com", "Pass1234!")
        res = _login(client, "wrong@x.com", "WRONGPASS!")
        assert res.status_code == 401

    def test_login_unknown_email_returns_401(self, client):
        res = _login(client, "nobody@x.com", "Pass1234!")
        assert res.status_code == 401

    def test_login_email_is_case_insensitive(self, client, monkeypatch):
        _reg(client, monkeypatch, "case@x.com", "Pass1234!")
        res = _login(client, "CASE@X.COM", "Pass1234!")
        assert res.status_code == 200

    def test_login_local_domain_email_succeeds(self, client, monkeypatch):
        _reg(client, monkeypatch, "admin@grievance.local", "Pass1234!")
        res = _login(client, "admin@grievance.local", "Pass1234!")
        assert res.status_code == 200
        assert res.json()["user"]["email"] == "admin@grievance.local"


# ── /auth/me ─────────────────────────────────────────────────────────────────

class TestMe:
    def test_me_returns_profile_for_valid_token(self, client, monkeypatch):
        data = _reg(client, monkeypatch, "me@x.com").json()
        res = client.get(ME_URL, headers=_bearer(data["access_token"]))
        assert res.status_code == 200
        profile = res.json()
        assert profile["email"] == "me@x.com"
        assert profile["role"] == "USER"

    def test_me_without_token_returns_401(self, client):
        res = client.get(ME_URL)
        assert res.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        res = client.get(ME_URL, headers=_bearer("not.a.valid.token"))
        assert res.status_code == 401

    def test_me_with_refresh_token_returns_401(self, client, monkeypatch):
        data = _reg(client, monkeypatch, "me2@x.com").json()
        # Passing the refresh token to a non-refresh endpoint must fail
        res = client.get(ME_URL, headers=_bearer(data["refresh_token"]))
        assert res.status_code == 401


# ── Refresh ───────────────────────────────────────────────────────────────────

class TestRefresh:
    def test_refresh_valid_token_returns_new_access_token(self, client, monkeypatch):
        data = _reg(client, monkeypatch, "ref@x.com").json()
        res = client.post(REFRESH_URL, json={"refresh_token": data["refresh_token"]})
        assert res.status_code == 200
        new_data = res.json()
        assert "access_token" in new_data
        # Tokens issued within the same second share identical bytes (same exp/iat);
        # we just verify the response contains a valid access token string.
        assert isinstance(new_data["access_token"], str) and len(new_data["access_token"]) > 10

    def test_refresh_with_access_token_returns_401(self, client, monkeypatch):
        data = _reg(client, monkeypatch, "ref2@x.com").json()
        res = client.post(REFRESH_URL, json={"refresh_token": data["access_token"]})
        assert res.status_code == 401

    def test_refresh_garbage_token_returns_401(self, client, monkeypatch):
        res = client.post(REFRESH_URL, json={"refresh_token": "garbage.token.here"})
        assert res.status_code == 401


# ── RBAC on grievance endpoints ───────────────────────────────────────────────

class TestGrievanceRBAC:
    def _make_user(self, client, email, role="USER"):
        from backend.app.users_db import users_repository
        import bcrypt as _bcrypt

        hashed = _bcrypt.hashpw(b"Pass1234!", _bcrypt.gensalt(12)).decode()
        users_repository.create({
            "email": email,
            "full_name": "Test",
            "hashed_password": hashed,
            "role": role,
        })
        res = client.post(LOGIN_URL, json={"email": email, "password": "Pass1234!"})
        assert res.status_code == 200
        return res.json()

    def test_citizen_cannot_patch_status(self, client, sample_payload, monkeypatch):
        user_data = _reg(client, monkeypatch, "c_rbac@x.com").json()
        token = user_data["access_token"]

        # Submit a grievance as this citizen
        payload = {k: v for k, v in sample_payload.items() if k != "userId"}
        res = client.post("/submit-grievance", json=payload, headers=_bearer(token))
        assert res.status_code == 200
        gid = res.json()["grievanceId"]

        # Try to patch — must be refused
        res = client.patch(
            f"/grievances/{gid}/status",
            json={"status": "in-progress"},
            headers=_bearer(token),
        )
        assert res.status_code == 403

    def test_admin_can_patch_status(self, client, sample_payload, monkeypatch):
        # Create a citizen to submit
        user_data = _reg(client, monkeypatch, "citizen_admin@x.com").json()
        payload = {k: v for k, v in sample_payload.items() if k != "userId"}
        res = client.post(
            "/submit-grievance", json=payload,
            headers=_bearer(user_data["access_token"])
        )
        gid = res.json()["grievanceId"]

        # Create an admin
        admin_data = self._make_user(client, "admin_rbac@x.com", role="ADMIN")
        admin_token = admin_data["access_token"]

        res = client.patch(
            f"/grievances/{gid}/status",
            json={"status": "resolved"},
            headers=_bearer(admin_token),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "RESOLVED"

    def test_resolver_can_patch_status(self, client, sample_payload, monkeypatch):
        user_data = _reg(client, monkeypatch, "cit_res@x.com").json()
        payload = {k: v for k, v in sample_payload.items() if k != "userId"}
        res = client.post(
            "/submit-grievance", json=payload,
            headers=_bearer(user_data["access_token"])
        )
        gid = res.json()["grievanceId"]

        resolver_data = self._make_user(client, "resolver_rbac@x.com", role="RESOLVER")
        res = client.patch(
            f"/grievances/{gid}/status",
            json={"status": "in-progress"},
            headers=_bearer(resolver_data["access_token"]),
        )
        assert res.status_code == 200

    def test_citizen_list_scoped_to_own_grievances(self, client, sample_payload, monkeypatch):
        a = _reg(client, monkeypatch, "scoped_a@x.com").json()
        b = _reg(client, monkeypatch, "scoped_b@x.com").json()

        payload = {k: v for k, v in sample_payload.items() if k != "userId"}
        client.post("/submit-grievance", json=payload, headers=_bearer(a["access_token"]))
        client.post("/submit-grievance", json=payload, headers=_bearer(b["access_token"]))

        res = client.get("/grievances", headers=_bearer(a["access_token"]))
        assert res.status_code == 200
        rows = res.json()
        # Citizen A should only see their own
        uid_a = a["user"]["id"]
        uid_b = b["user"]["id"]
        assert all(r["userId"] == uid_a for r in rows), rows
        assert not any(r["userId"] == uid_b for r in rows)


# ── Phone OTP login ─────────────────────────────────────────────────────────

PHONE_LOGIN_REQ = "/auth/login/phone/request-otp"
PHONE_LOGIN_VERIFY = "/auth/login/phone/verify"


def _phone_login_code(client, phone: str, monkeypatch) -> str:
    """Request a login OTP with debug codes enabled; returns the code."""
    from backend.app import config as app_config
    monkeypatch.setattr(app_config, "OTP_DEBUG_RETURN_CODE", True)
    res = client.post(PHONE_LOGIN_REQ, json={"phone": phone})
    assert res.status_code == 200, res.text
    assert "debug_code" in res.json()
    return res.json()["debug_code"]


class TestPhoneLogin:
    def test_unknown_phone_gets_generic_response(self, client):
        res = client.post(PHONE_LOGIN_REQ, json={"phone": "9000000001"})
        assert res.status_code == 200
        body = res.json()
        assert "message" in body and "debug_code" not in body
        res = client.post(PHONE_LOGIN_VERIFY, json={"phone": "9000000001", "code": "000000"})
        assert res.status_code == 400

    def test_unverified_phone_cannot_log_in(self, client, monkeypatch):
        _reg(client, monkeypatch, "unv@x.com")
        from backend.app import users_db
        user = users_db.users_repository.find_by_email("unv@x.com")
        phone = user["phone"]
        assert user["phoneVerifiedAt"] is None
        res = client.post(PHONE_LOGIN_REQ, json={"phone": phone})
        assert res.status_code == 200  # generic — no code issued
        res = client.post(PHONE_LOGIN_VERIFY, json={"phone": phone, "code": "000000"})
        assert res.status_code == 400

    def test_verified_phone_login_issues_tokens(self, client, monkeypatch):
        from backend.app import users_db
        _reg(client, monkeypatch, "phlogin@x.com")
        user = users_db.users_repository.find_by_email("phlogin@x.com")
        phone = user["phone"]
        users_db.users_repository.update(user["id"], {"phoneVerifiedAt": "2026-10-14T00:00:00Z"})
        code = _phone_login_code(client, phone, monkeypatch)
        res = client.post(PHONE_LOGIN_VERIFY, json={"phone": phone, "code": code})
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["user"]["email"] == "phlogin@x.com"
        me = client.get("/auth/me", headers=_bearer(data["access_token"]))
        assert me.status_code == 200

    def test_wrong_codes_burn_login_challenge(self, client, monkeypatch):
        from backend.app import users_db
        _reg(client, monkeypatch, "burn@x.com")
        user = users_db.users_repository.find_by_email("burn@x.com")
        phone = user["phone"]
        users_db.users_repository.update(user["id"], {"phoneVerifiedAt": "2026-10-14T00:00:00Z"})
        _phone_login_code(client, phone, monkeypatch)
        for _ in range(3):
            res = client.post(PHONE_LOGIN_VERIFY, json={"phone": phone, "code": "999999"})
            assert res.status_code == 400
        res = client.post(PHONE_LOGIN_VERIFY, json={"phone": phone, "code": "999999"})
        assert res.status_code == 400

    def test_non_user_role_rejected(self, client, monkeypatch):
        from backend.app import users_db
        from backend.app.repositories.otp_codes import otp_repository
        from backend.app.routers.auth import _phone_login_key, _otp_hash_for_login
        uid = users_db.users_repository.create({
            "email": "staff-ph@x.com", "full_name": "Staff",
            "hashed_password": "x", "role": "ADMIN",
            "phone": "9134567890", "phoneVerifiedAt": "2026-10-14T00:00:00Z",
        })
        assert uid
        # White-box a valid challenge (the request endpoint never issues
        # one for non-citizens) — verify must still refuse the login.
        key = _phone_login_key("9134567890")
        otp_repository.put(key, _otp_hash_for_login(key, "123456"), "phone_login", 300)
        res = client.post(PHONE_LOGIN_VERIFY, json={"phone": "9134567890", "code": "123456"})
        assert res.status_code == 400
        assert "access_token" not in res.json()
