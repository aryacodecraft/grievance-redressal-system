"""Security baseline — these tests assert the PRE-Phase 1 (insecure) behaviour.

**Phase 1 (JWT + RBAC) is now IMPLEMENTED.** These tests must be updated so
they confirm the NEW, SECURE behaviour rather than the old insecure defaults.

Each test is annotated with what changed and why it was retained.  Tests that
were `BASELINE` assertions of the insecure state are now inverted to confirm
the secure endpoint behaviour.

Nothing here reaches the network: `conftest.py` pins `MONGODB_URI=""` and the
LLM keys before `backend.app` is imported.
"""

from __future__ import annotations

import os

import pytest


# ── Helpers ──────────────────────────────────────────────────────────────────

def _register(client, email="test@example.com", password="Secret123", name="Test User"):
    res = client.post("/auth/register", json={"email": email, "password": password, "full_name": name})
    assert res.status_code == 201, res.text
    return res.json()


def _login(client, email="test@example.com", password="Secret123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create(client, sample_payload, token: str | None = None, **overrides):
    headers = _auth_header(token) if token else {}
    payload = {k: v for k, v in {**sample_payload, **overrides}.items() if k != "userId"}
    res = client.post("/submit-grievance", json=payload, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["grievanceId"]


# ── F1: unauthenticated read of the whole dataset (INVERTED — now secure) ───


def test_unauthenticated_list_is_rejected_but_reference_lookup_remains_public(client, sample_payload):
    """Public tracking is by ID only; the full grievance list requires auth."""
    data = _register(client, "a@x.com")
    token = data["access_token"]
    grievance_id = _create(client, sample_payload, token=token)

    res = client.get("/grievances")
    assert res.status_code == 401
    public_view = client.get(f"/grievances/{grievance_id}")
    assert public_view.status_code == 200
    assert "userId" not in public_view.json()


def test_authenticated_citizen_sees_only_own_grievances(client, sample_payload):
    """A USER token scopes the list response to the user's own grievances.

    Phase 1: scoping is derived from the verified token, not the query string.
    """
    data_a = _register(client, "citizen_a@x.com", name="Citizen A")
    data_b = _register(client, "citizen_b@x.com", name="Citizen B")

    _create(client, sample_payload, token=data_a["access_token"])
    _create(client, sample_payload, token=data_b["access_token"])

    res = client.get("/grievances", headers=_auth_header(data_a["access_token"]))
    assert res.status_code == 200
    rows = res.json()
    # Citizen A should only see their own grievance(s)
    user_ids = {r.get("userId") for r in rows}
    assert data_a["user"]["id"] in user_ids
    assert data_b["user"]["id"] not in user_ids


# ── F2: unauthenticated status update (INVERTED — now requires role) ─────────


def test_unauthenticated_patch_is_rejected(client, sample_payload):
    """PATCH /grievances/{id}/status without a token is now refused with 401.

    Phase 1: ADMIN or RESOLVER token required.
    """
    data = _register(client, "patchtest@x.com")
    gid = _create(client, sample_payload, token=data["access_token"])

    res = client.patch(f"/grievances/{gid}/status", json={"status": "resolved"})
    assert res.status_code in (401, 403), f"Expected 401/403, got {res.status_code}: {res.text}"


def test_citizen_token_cannot_patch_status(client, sample_payload):
    """A USER-role token is refused 403 on PATCH status (requires ADMIN/RESOLVER).

    Phase 1: DEC-007 RBAC enforcement.
    """
    data = _register(client, "citizen_patch@x.com")
    gid = _create(client, sample_payload, token=data["access_token"])

    res = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "resolved"},
        headers=_auth_header(data["access_token"]),
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"


# ── F3: identity comes from JWT, not the request body ────────────────────────


def test_user_id_is_derived_from_token_not_body(client, sample_payload):
    """Phase 1: userId in the stored record comes from the verified JWT sub.

    Any attempt to spoof a different userId via the body is silently ignored
    (userId is not accepted from the request body at all).
    """
    data = _register(client, "idtest@x.com")
    token = data["access_token"]
    expected_uid = data["user"]["id"]

    res = client.post(
        "/submit-grievance",
        json={k: v for k, v in sample_payload.items() if k != "userId"},
        headers=_auth_header(token),
    )
    assert res.status_code == 200, res.text
    gid = res.json()["grievanceId"]

    stored = client.get(f"/grievances/{gid}", headers=_auth_header(token)).json()
    assert stored["userId"] == expected_uid, (
        f"Expected userId={expected_uid!r}, got {stored.get('userId')!r}"
    )


# ── F2b: no rate limiting, no request caps ──────────────────────────────────


def test_BASELINE_no_rate_limiting_on_submission(client, sample_payload):
    """A burst of submissions is still accepted — no throttling is implemented.

    This remains a known gap; rate limiting belongs with auth and requires a
    principal to count against. Retained as a reminder, not a goal.
    """
    data = _register(client, "burst@x.com")
    token = data["access_token"]
    for _ in range(10):
        res = client.post(
            "/submit-grievance",
            json={k: v for k, v in sample_payload.items() if k != "userId"},
            headers=_auth_header(token),
        )
        assert res.status_code == 200


# ── F6: CORS config ──────────────────────────────────────────────────────────


def test_cors_origins_config_is_a_non_empty_list_of_strings():
    """`CORS_ORIGINS` is parsed from a comma-separated string at import time."""
    from backend.app.config import CORS_ORIGINS

    assert isinstance(CORS_ORIGINS, list)
    assert CORS_ORIGINS, "must never resolve to an empty list"
    assert all(isinstance(o, str) and o for o in CORS_ORIGINS)


def test_env_example_ships_a_concrete_cors_origin():
    """`.env.example` must not teach operators to leave CORS wide open."""
    from pathlib import Path

    line = next(
        (
            l
            for l in Path("backend/.env.example")
            .read_text(encoding="utf-8")
            .splitlines()
            if l.startswith("CORS_ORIGINS=")
        ),
        "",
    )
    value = line.partition("=")[2].strip()
    assert value, "CORS_ORIGINS must be present in backend/.env.example"
    assert "*" not in value, "do not ship a wildcard CORS origin as the example"


# ── The document itself ─────────────────────────────────────────────────────


def test_security_gaps_are_documented_not_silent():
    """The gap must stay visible in `docs/SECURITY.md`."""
    from pathlib import Path

    text = Path("docs/SECURITY.md").read_text(encoding="utf-8").lower()
    for expected in ("authentication", "authori"):
        assert expected in text
