"""Endpoint tests against the real FastAPI app.

Runs with the in-memory repository (conftest pins `MONGODB_URI=""` before
`backend.app` imports), so these are deterministic and never touch a real
database. The response shapes asserted here are what the frontend's zod
schemas in `frontend/lib/api.ts` parse — keep them in sync.
"""

from __future__ import annotations

import pytest


# ── Health ──────────────────────────────────────────────────────────────────


def test_health_reports_storage_mode(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["storage"] == "in-memory"


# ── Create ──────────────────────────────────────────────────────────────────


def test_submit_requires_user_id(client):
    res = client.post(
        "/submit-grievance", json={"title": "T", "description": "D"}
    )
    assert res.status_code == 400
    assert "userId" in res.json()["error"]


def test_submit_requires_title(client):
    res = client.post(
        "/submit-grievance", json={"description": "D", "userId": "u1"}
    )
    assert res.status_code == 400
    assert "error" in res.json()


def test_submit_returns_expected_shape(client, sample_payload):
    res = client.post("/submit-grievance", json=sample_payload)
    assert res.status_code == 200
    body = res.json()
    # This is the contract `submitResultSchema` validates in lib/api.ts.
    assert set(body) >= {"message", "grievanceId"}
    assert body["grievanceId"].startswith("GRV-")


def test_submit_assigns_ai_fields(client, sample_payload):
    body = client.post("/submit-grievance", json=sample_payload).json()
    # Without LLM keys the classifier falls back to keywords — "pothole"/
    # "road" in the sample put it in `roads`.
    assert body["hfEngine"]["category"] == "roads"
    assert body["hfEngine"]["priority"] in {"low", "medium", "high"}


def test_submit_without_llm_keys_still_succeeds(client):
    """No GROQ/HF keys configured → keyword fallback, not a 500."""
    res = client.post(
        "/submit-grievance",
        json={"title": "Water logging", "description": "no water", "userId": "u"},
    )
    assert res.status_code == 200
    assert res.json()["hfEngine"]["category"] == "water"


# ── Read ────────────────────────────────────────────────────────────────────


def _create(client, sample_payload, **overrides):
    payload = {**sample_payload, **overrides}
    return client.post("/submit-grievance", json=payload).json()["grievanceId"]


def test_list_empty_by_default(client):
    assert client.get("/grievances").json() == []


def test_list_returns_created(client, sample_payload):
    gid = _create(client, sample_payload)
    items = client.get("/grievances").json()
    assert len(items) == 1
    assert items[0]["id"] == gid


def test_list_scopes_by_user(client, sample_payload):
    _create(client, sample_payload, userId="alice")
    _create(client, sample_payload, userId="bob")

    alice = client.get("/grievances", params={"userId": "alice"}).json()
    assert [g["userId"] for g in alice] == ["alice"]

    nobody = client.get("/grievances", params={"userId": "carol"}).json()
    assert nobody == []


def test_list_respects_limit(client, sample_payload):
    for i in range(5):
        _create(client, sample_payload, userId=f"u{i}")
    assert len(client.get("/grievances", params={"limit": 2}).json()) == 2


def test_list_newest_first(client, sample_payload):
    first = _create(client, sample_payload, title="older")
    second = _create(client, sample_payload, title="newer")
    ids = [g["id"] for g in client.get("/grievances").json()]
    assert ids == [second, first]


def test_get_single_grievance(client, sample_payload):
    gid = _create(client, sample_payload)
    body = client.get(f"/grievances/{gid}").json()
    assert body["id"] == gid
    assert body["title"] == sample_payload["title"]
    assert body["userId"] == sample_payload["userId"]


def test_get_unknown_grievance_404(client):
    assert client.get("/grievances/GRV-1999-9999").status_code == 404


def test_grievance_optional_fields_are_null_tolerated(client, sample_payload):
    """Response must parse with the frontend's nullish zod schema."""
    body = client.get(f"/grievances/{_create(client, sample_payload)}").json()
    # Optional fields may be absent or null; `createdAt` and `status` must exist.
    assert isinstance(body["createdAt"], str)
    assert body["status"] in {"open", "submitted"}
    for key in ("imageUrl", "latitude", "longitude", "assignee", "hfEngine"):
        assert body.get(key) in (None, "") or key in body


# ── Update ──────────────────────────────────────────────────────────────────


def test_patch_status_and_assignee(client, sample_payload):
    gid = _create(client, sample_payload)
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "assigned", "assignee": "Roads Division — Zone 3"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "assigned"
    assert body["assignee"] == "Roads Division — Zone 3"

    # Persisted, not just echoed back.
    assert client.get(f"/grievances/{gid}").json()["status"] == "assigned"


def test_patch_unknown_grievance_404(client):
    res = client.patch(
        "/grievances/GRV-1999-9999/status", json={"status": "resolved"}
    )
    assert res.status_code == 404
    assert "error" in res.json()


def test_patch_partial_update_leaves_other_fields(client, sample_payload):
    gid = _create(client, sample_payload)
    client.patch(f"/grievances/{gid}/status", json={"status": "resolved"})
    body = client.get(f"/grievances/{gid}").json()
    assert body["status"] == "resolved"
    assert body["title"] == sample_payload["title"]
    assert body["userId"] == sample_payload["userId"]


# ── Errors ──────────────────────────────────────────────────────────────────


def test_error_responses_use_flat_error_key(client):
    """Errors are `{ "error": ... }`, not FastAPI's default `{ "detail": ... }`."""
    res = client.get("/grievances/GRV-0000-0000")
    assert res.status_code == 404
    assert "error" in res.json()
    assert "detail" not in res.json()


def test_validation_error_is_normalised(client):
    res = client.post("/submit-grievance", json={"nonsense": True})
    assert res.status_code == 400
    body = res.json()
    assert "error" in body
    # The handler in main.py flattens FastAPI's error list to a single string.
    assert isinstance(body["error"], str)
    assert "traceback" not in body["error"].lower()
    assert "detail" not in body
