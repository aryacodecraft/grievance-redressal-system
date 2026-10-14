"""Shared signup-test helpers (not collected — filename has no test_ prefix).

Centralizes three repetitive needs:
  - a valid citizen profile payload (DEC-031 required fields)
  - a deterministic captcha ("AAAAA") via tightly-scoped stdlib patching
  - the face-signup phone-proof steps with a deterministic OTP ("000000")

Manual save/restore (never monkeypatch) is used because the stdlib `secrets`
module object is shared with face-challenge selection and citizen-ID
generation — a broad patch corrupts those paths.
"""
from __future__ import annotations


PROFILE_PAYLOAD = {
    "address": "221B Baker Street, Mumbai 400001",
    "dob": "1990-05-17",
    "occupation": "Teacher",
    "gender": "female",
}

FACE_PROFILE_PAYLOAD = {
    "address": "14 MG Road, Pune 411001",
    "dob": "1988-11-02",
    "occupation": "Nurse",
    "gender": "female",
}


def deterministic_captcha_id(client) -> str:
    """Mint a captcha whose solution is "AAAAA"."""
    import secrets as stdlib_secrets
    real_choice = stdlib_secrets.choice
    stdlib_secrets.choice = lambda _seq: "A"  # noqa: E731
    try:
        res = client.get("/auth/captcha")
    finally:
        stdlib_secrets.choice = real_choice
    assert res.status_code == 200, res.text
    return res.json()["captcha_id"]


def _default_phone(email: str) -> str:
    """Deterministic unique 10-digit number per email (valid 6-9 lead)."""
    import hashlib
    h = int(hashlib.sha256(email.encode()).hexdigest(), 16)
    return f"9{h % 1_000_000_000:09d}"


def register_citizen(client, email: str, password: str = "Pass1234!",
                     name: str = "Test User", phone: str | None = None, **over):
    """POST /auth/register with valid profile + solved captcha (+phone)."""
    payload = {"email": email, "password": password, "full_name": name,
               "phone": phone or _default_phone(email), **PROFILE_PAYLOAD,
               "captcha_id": deterministic_captcha_id(client),
               "captcha_solution": "AAAAA"}
    payload.update(over)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 201, res.text
    return res


def face_signup_start(client, phone: str, name: str = "Test Citizen", **over):
    """POST /auth/face/signup/start with valid profile + solved captcha."""
    payload = {"full_name": name, "phone": phone, "consent": True,
               **FACE_PROFILE_PAYLOAD,
               "captcha_id": deterministic_captcha_id(client),
               "captcha_solution": "AAAAA"}
    payload.update(over)
    return client.post("/auth/face/signup/start", json=payload)


def face_prove_phone(client, signup_token: str, code: str = "000000"):
    """Run the signup OTP request+verify with a deterministic code."""
    import secrets as stdlib_secrets
    real_randbelow = stdlib_secrets.randbelow
    stdlib_secrets.randbelow = lambda _n: 0  # noqa: E731
    try:
        res = client.post("/auth/face/signup/request-otp",
                          json={"signup_token": signup_token})
    finally:
        stdlib_secrets.randbelow = real_randbelow
    assert res.status_code == 200, res.text
    res = client.post("/auth/face/signup/verify-otp",
                      json={"signup_token": signup_token, "code": code})
    assert res.status_code == 200, res.text
    return res.json()
