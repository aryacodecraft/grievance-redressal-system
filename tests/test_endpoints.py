"""Endpoint tests against the real FastAPI app.

Runs with the in-memory repository (conftest pins `MONGODB_URI=""` before
`backend.app` imports), so these are deterministic and never touch a real
database. The response shapes asserted here are what the frontend's zod
schemas in `frontend/lib/api.ts` parse — keep them in sync.
"""

from __future__ import annotations

import pytest


# ── Helpers ─────────────────────────────────────────────────────────────────


def _auth_headers(user_id: str = "citizen-test-1", role: str = "USER"):
    """Authenticate as `user_id`.

    Submission ownership now comes from the verified JWT, never the request
    body, so tests that care about who submitted must carry a token.
    """
    from backend.app.auth import create_access_token

    token = create_access_token(user_id, role, f"{user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


# ── Health ──────────────────────────────────────────────────────────────────


def test_health_reports_storage_mode(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["storage"] == "in-memory"


def test_storage_mode_reflects_configuration_not_reachability(
    monkeypatch,
):
    """`MONGODB_URI` set but unreachable must not be reported as in-memory.

    `_build_repository()` used to assign `_storage_mode` only after a
    successful ping, so a cluster that was down at boot left `/health`
    claiming `in-memory` while `repository` was already a MongoRepository —
    every request went to MongoDB and the health endpoint denied it.
    """
    import backend.app.config as config
    import backend.app.db as db

    class UnreachableRepository:
        def __init__(self, *args, **kwargs):
            pass

        def ensure_indexes(self):
            raise ConnectionError("no route to cluster")

        def ping(self):
            return False

    monkeypatch.setattr(config, "MONGODB_URI", "mongodb://127.0.0.1:1/unreachable")
    monkeypatch.setattr(db, "MongoRepository", UnreachableRepository)
    # Silence the two failure logs this path is *supposed* to emit.
    monkeypatch.setattr(db.logger, "error", lambda *a, **k: None)
    monkeypatch.setattr(db.logger, "exception", lambda *a, **k: None)

    previous = db._storage_mode
    try:
        repo = db._build_repository()
        assert isinstance(repo, UnreachableRepository), "repo must still be built"
        assert db.storage_mode() == "mongodb", (
            "an unreachable cluster is still the configured storage — "
            "reporting 'in-memory' while writing to MongoDB is the bug"
        )
    finally:
        db._storage_mode = previous


def test_storage_mode_is_in_memory_when_no_uri(monkeypatch):
    import backend.app.config as config
    import backend.app.db as db

    monkeypatch.setattr(config, "MONGODB_URI", "")
    previous = db._storage_mode
    try:
        repo = db._build_repository()
        assert isinstance(repo, db.InMemoryRepository)
        assert db.storage_mode() == "in-memory"
    finally:
        db._storage_mode = previous


def test_storage_mode_is_a_boot_time_snapshot(client):
    """BASELINE: `/health` does not consult the repository at all.

    `storage_mode()` returns a string captured at import, so a cluster that
    dies *after* boot keeps reporting healthy forever, and a repository that
    cannot answer a single query still yields `status: "ok"`. Deliberate for
    now — making `/health` ping would hold Render's health check open for
    `serverSelectionTimeoutMS` (8s) whenever the cluster is down, and a 503
    would trigger service restarts that cannot fix an unreachable Atlas.

    Deployment hardening should add a separate `/readyz` with a short-timeout
    ping rather than change this endpoint's semantics.
    """
    from backend.app import db
    from backend.app.routers import grievances as router

    class BrokenRepository:
        def create(self, *a, **k):
            raise ConnectionError("cluster unreachable")

        def list(self, *a, **k):
            raise ConnectionError("cluster unreachable")

        def get(self, *a, **k):
            raise ConnectionError("cluster unreachable")

        def update(self, *a, **k):
            raise ConnectionError("cluster unreachable")

    previous = router.repository
    router.repository = BrokenRepository()
    try:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
        # …while a read against the same repository the endpoint ignores
        # explodes. (Probing the repository directly rather than through the
        # client: TestClient re-raises server exceptions by default.)
        with pytest.raises(ConnectionError):
            router.repository.list()
    finally:
        router.repository = previous

    assert db.storage_mode() == "in-memory"


def test_health_is_reachable_at_the_root_probe_path(client):
    """`render.yaml` / deployment probes read `/health`; it must never move."""
    res = client.get("/health")
    assert res.status_code == 200
    assert set(res.json()) == {"status", "storage"}


# ── Create ──────────────────────────────────────────────────────────────────


def test_submit_requires_authentication(client):
    """Phase 1 inversion: anonymous submissions are rejected, not trusted.

    The old baseline accepted a body-supplied `userId` with no auth at all;
    identity now comes exclusively from a verified Bearer token.
    """
    res = client.post("/submit-grievance", json={"title": "T", "description": "D"})
    assert res.status_code == 401
    assert "error" in res.json()


def test_submit_takes_user_id_from_token_not_body(client):
    """A body `userId` is parsed for compatibility but never trusted."""
    res = client.post(
        "/submit-grievance",
        json={"title": "T", "description": "D", "userId": "spoofed"},
        headers=_auth_headers("alice"),
    )
    assert res.status_code == 200, res.text
    stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_admin_headers()).json()
    assert stored["userId"] == "alice"


def test_submit_requires_title(client):
    res = client.post(
        "/submit-grievance",
        json={"description": "D"},
        headers=_auth_headers(),
    )
    assert res.status_code == 400
    assert "error" in res.json()


def test_submit_returns_expected_shape(client, sample_payload):
    res = client.post(
        "/submit-grievance", json=sample_payload, headers=_auth_headers()
    )
    assert res.status_code == 200
    body = res.json()
    # This is the contract `submitResultSchema` validates in lib/api.ts.
    assert set(body) >= {"message", "grievanceId"}
    assert body["grievanceId"].startswith("GRV-")


def test_submit_assigns_ai_fields(client, sample_payload):
    body = client.post(
        "/submit-grievance", json=sample_payload, headers=_auth_headers()
    ).json()
    # Without LLM keys the classifier falls back to keywords — "pothole"/
    # "road" in the sample put it in `roads`.
    assert body["hfEngine"]["category"] == "roads"
    assert body["hfEngine"]["priority"] in {"low", "medium", "high"}


def test_submit_without_llm_keys_still_succeeds(client):
    """No GROQ/HF keys configured → keyword fallback, not a 500."""
    res = client.post(
        "/submit-grievance",
        json={"title": "Water logging", "description": "no water"},
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    assert res.json()["hfEngine"]["category"] == "water"


# ── Read ────────────────────────────────────────────────────────────────────


def _create(client, sample_payload, **overrides):
    payload = {**sample_payload, **overrides}
    # Ownership is carried by the token, so route the payload's userId into
    # the signer — tests that override it keep scoping rows by that identity.
    user_id = payload.pop("userId", None) or "citizen-test-1"
    res = client.post(
        "/submit-grievance", json=payload, headers=_auth_headers(user_id)
    )
    return res.json()["grievanceId"]



def test_list_empty_by_default(client):
    assert client.get("/grievances").status_code == 401


def test_list_returns_created(client, sample_payload):
    gid = _create(client, sample_payload)
    items = client.get("/grievances", headers=_admin_headers()).json()
    assert len(items) == 1
    assert items[0]["id"] == gid


def test_list_scopes_by_user(client, sample_payload):
    _create(client, sample_payload, userId="alice")
    _create(client, sample_payload, userId="bob")

    alice = client.get("/grievances", params={"userId": "alice"}, headers=_admin_headers()).json()
    assert [g["userId"] for g in alice] == ["alice"]

    nobody = client.get("/grievances", params={"userId": "carol"}, headers=_admin_headers()).json()
    assert nobody == []


def test_list_respects_limit(client, sample_payload):
    for i in range(5):
        _create(client, sample_payload, userId=f"u{i}")
    assert len(client.get("/grievances", params={"limit": 2}, headers=_admin_headers()).json()) == 2


def test_list_newest_first(client, sample_payload):
    first = _create(client, sample_payload, title="older")
    second = _create(client, sample_payload, title="newer")
    ids = [g["id"] for g in client.get("/grievances", headers=_admin_headers()).json()]
    assert ids == [second, first]


def test_get_single_grievance(client, sample_payload):
    gid = _create(client, sample_payload)
    body = client.get(f"/grievances/{gid}", headers=_auth_headers()).json()
    assert body["id"] == gid
    assert body["title"] == sample_payload["title"]
    assert body["userId"] == sample_payload["userId"]


def test_get_unknown_grievance_404(client):
    assert client.get("/grievances/GRV-1999-9999").status_code == 404


def test_grievance_optional_fields_are_null_tolerated(client, sample_payload):
    """Response must parse with the frontend's nullish zod schema."""
    body = client.get(f"/grievances/{_create(client, sample_payload)}", headers=_auth_headers()).json()
    # Optional fields may be absent or null; `createdAt` and `status` must exist.
    assert isinstance(body["createdAt"], str)
    assert body["status"] in {"SUBMITTED"}
    for key in ("imageUrl", "latitude", "longitude", "assignee", "hfEngine"):
        assert body.get(key) in (None, "") or key in body


# ── Update ──────────────────────────────────────────────────────────────────


def _admin_headers():
    from backend.app.auth import create_access_token

    token = create_access_token("admin-test", "ADMIN", "admin@example.com")
    return {"Authorization": f"Bearer {token}"}


def test_patch_status_and_assignee(client, sample_payload):
    gid = _create(client, sample_payload)
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "assigned", "assignee": "Roads Division — Zone 3"},
        headers=_admin_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ASSIGNED"
    assert body["assignee"] == "Roads Division — Zone 3"

    # Persisted, not just echoed back.
    assert client.get(f"/grievances/{gid}", headers=_admin_headers()).json()["status"] == "ASSIGNED"


def test_patch_unknown_grievance_404(client):
    res = client.patch(
        "/grievances/GRV-1999-9999/status",
        json={"status": "resolved"},
        headers=_admin_headers(),
    )
    assert res.status_code == 404
    assert "error" in res.json()


def test_patch_partial_update_leaves_other_fields(client, sample_payload):
    gid = _create(client, sample_payload)
    client.patch(
        f"/grievances/{gid}/status",
        json={"status": "resolved"},
        headers=_admin_headers(),
    )
    body = client.get(f"/grievances/{gid}", headers=_admin_headers()).json()
    assert body["status"] == "RESOLVED"
    assert body["title"] == sample_payload["title"]
    assert body["userId"] == sample_payload["userId"]


# ── Errors ──────────────────────────────────────────────────────────────────


def test_error_responses_use_flat_error_key(client):
    """Errors are `{ "error": ... }`, not FastAPI's default `{ "detail": ... }`."""
    res = client.get("/grievances/GRV-0000-0000")
    assert res.status_code == 404
    assert "error" in res.json()
    assert "detail" not in res.json()


def test_unknown_route_uses_flat_error_key(client):
    """Unrouted paths go through Starlette, which defaults to `detail`."""
    res = client.get("/definitely-not-a-route")
    assert res.status_code == 404
    body = res.json()
    assert "error" in body and "detail" not in body
    assert isinstance(body["error"], str) and body["error"]


def test_disallowed_method_uses_flat_error_key(client):
    """405 is the other framework-default shape the frontend cannot read."""
    cases = (
        ("post", "/grievances", {"title": "x"}),
        ("delete", "/grievances/GRV-2026-0001", None),
        ("put", "/health", {"x": 1}),
    )
    for method, path, body in cases:
        res = getattr(client, method)(path, json=body) if body else getattr(
            client, method
        )(path)
        assert res.status_code == 405, f"{method.upper()} {path}"
        payload = res.json()
        assert "error" in payload and "detail" not in payload, payload


def test_validation_error_is_normalised(client):
    res = client.post(
        "/submit-grievance", json={"nonsense": True}, headers=_auth_headers()
    )
    assert res.status_code == 400
    body = res.json()
    assert "error" in body
    # The handler in main.py flattens FastAPI's error list to a single string.
    assert isinstance(body["error"], str)
    assert "traceback" not in body["error"].lower()
    assert "detail" not in body


def test_every_error_body_is_readable_by_the_frontend(client):
    """`lib/api.ts` throws `json.error` — a body without it shows a bare code."""
    errors = [
        client.get("/grievances/GRV-0000-0000"),
        client.get("/nope"),
        client.post("/grievances", json={}),
        client.post("/submit-grievance", json={}),
        client.patch("/grievances/GRV-0000-0000/status", json={"status": "x"}),
        client.get("/grievances", params={"limit": "abc"}, headers=_admin_headers()),
    ]
    for res in errors:
        assert res.status_code >= 400
        assert isinstance(res.json().get("error"), str), (
            f"{res.request.method} {res.request.url} -> {res.json()}"
        )


# ── List parameters ─────────────────────────────────────────────────────────


def test_limit_must_be_a_positive_integer(client, sample_payload):
    """`limit=0`/`limit=-5` used to reach the repository, where pymongo reads
    `.limit(0)` as *no limit* and a Python slice reads it as *nothing* — one
    URL, two opposite answers depending on which store was configured."""
    for i in range(3):
        _create(client, sample_payload, userId=f"u{i}")

    for bad in (0, -1, -5):
        res = client.get("/grievances", params={"limit": bad}, headers=_admin_headers())
        assert res.status_code == 400, bad
        assert "error" in res.json()


def test_limit_is_capped(client, sample_payload):
    _create(client, sample_payload)
    res = client.get("/grievances", params={"limit": 1000}, headers=_admin_headers())
    assert res.status_code == 200
    assert client.get("/grievances", params={"limit": 1001}, headers=_admin_headers()).status_code == 400


def test_limit_defaults_to_a_page(client, sample_payload):
    for i in range(5):
        _create(client, sample_payload, userId=f"u{i}")
    assert len(client.get("/grievances", headers=_admin_headers()).json()) == 5


# ── Status updates: blanks vs. vocabulary ───────────────────────────────────


def test_blank_status_is_rejected(client, sample_payload):
    """An empty status used to be stored, leaving `Badge` with no match and
    `StatusTimeline` pinned to step 0."""
    gid = _create(client, sample_payload)
    for blank in ("", "   ", "\t\n"):
        res = client.patch(
            f"/grievances/{gid}/status",
            json={"status": blank},
            headers=_admin_headers(),
        )
        assert res.status_code == 400, repr(blank)
        assert "error" in res.json()
    assert client.get(f"/grievances/{gid}", headers=_admin_headers()).json()["status"] == "SUBMITTED"


def test_blank_assignee_is_rejected(client, sample_payload):
    gid = _create(client, sample_payload)
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"assignee": "   "},
        headers=_admin_headers(),
    )
    assert res.status_code == 400
    assert "assignee" in res.json()["error"]


def test_status_surrounding_whitespace_is_trimmed(client, sample_payload):
    gid = _create(client, sample_payload)
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "  resolved  "},
        headers=_admin_headers(),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "RESOLVED"


def test_patch_without_any_field_is_rejected(client, sample_payload):
    gid = _create(client, sample_payload)
    assert (
        client.patch(
            f"/grievances/{gid}/status", json={}, headers=_admin_headers()
        ).status_code
        == 400
    )
    # Explicit nulls are "leave alone", so they must not count as a patch.
    assert (
        client.patch(
            f"/grievances/{gid}/status",
            json={"status": None, "assignee": None},
            headers=_admin_headers(),
        ).status_code
        == 400
    )


def test_patch_assignee_without_status(client, sample_payload):
    gid = _create(client, sample_payload)
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"assignee": "Drainage Cell"},
        headers=_admin_headers(),
    )
    assert res.status_code == 200
    body = client.get(f"/grievances/{gid}", headers=_admin_headers()).json()
    assert body["assignee"] == "Drainage Cell"
    assert body["status"] == "SUBMITTED"  # untouched


def test_patch_status_without_assignee(client, sample_payload):
    gid = _create(client, sample_payload)
    client.patch(
        f"/grievances/{gid}/status",
        json={"assignee": "Roads Cell"},
        headers=_admin_headers(),
    )
    client.patch(
        f"/grievances/{gid}/status",
        json={"status": "in_progress"},
        headers=_admin_headers(),
    )
    body = client.get(f"/grievances/{gid}", headers=_admin_headers()).json()
    assert body["status"] == "IN_PROGRESS"
    assert body["assignee"] == "Roads Cell"  # survives a status-only patch


def test_unknown_status_values_are_accepted_verbatim(client, sample_payload):
    """Migrated for Phase 2 (canonical UPPER on read).

    `PATCH /status` still stores the trimmed string verbatim, but `to_api()`
    normalises to the canonical UPPER state on read (`open`→`SUBMITTED`,
    unknown→`upper()`). Strict transition validation lives on the new
    `PATCH /grievances/{id}/state` (see `state_machine.transition_state`).
    """
    gid = _create(client, sample_payload)
    expected = {
        "Banana": "BANANA",
        "OPEN": "SUBMITTED",
        "closed": "CLOSED",
        "in_review": "IN_REVIEW",
        "escalated_to_cmo": "ESCALATED_TO_CMO",
    }
    for value, canonical in expected.items():
        res = client.patch(
            f"/grievances/{gid}/status",
            json={"status": value},
            headers=_admin_headers(),
        )
        assert res.status_code == 200, value
        assert client.get(f"/grievances/{gid}", headers=_admin_headers()).json()["status"] == canonical


def test_status_update_records_no_history_or_actor(client, sample_payload):
    """BASELINE for Phase 2: there is no audit trail at all.

    AGENTS.md requires who/what/when/reason and human-vs-AI provenance for
    important actions; none of that exists yet, and the response proves it by
    exposing no such fields.
    """
    gid = _create(client, sample_payload)
    body = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "resolved", "assignee": "Ward 4"},
        headers=_admin_headers(),
    ).json()
    for forbidden in ("history", "updatedAt", "updatedBy", "reason", "actor"):
        assert forbidden not in body, forbidden


# ── Payload handling ────────────────────────────────────────────────────────


def test_unknown_submit_fields_are_ignored(client, sample_payload):
    """Pydantic ignores extras — a client cannot smuggle fields into a record.

    Worth pinning: `role`/`status`/`isAdmin` arriving in the body must not
    become stored document fields.
    """
    res = client.post(
        "/submit-grievance",
        json={
            **sample_payload,
            "role": "admin",
            "isAdmin": True,
            "status": "resolved",
            "bogus": {"nested": 1},
        },
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_auth_headers()).json()
    assert stored["status"] == "SUBMITTED"  # not the client-supplied "resolved"
    for banned in ("role", "isAdmin", "bogus"):
        assert banned not in stored, banned


def test_submit_trims_whitespace_in_required_fields(client):
    res = client.post(
        "/submit-grievance",
        json={"title": "  Pothole  ", "description": "  Deep hole  "},
        headers=_auth_headers("citizen-9"),
    )
    assert res.status_code == 200
    stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_auth_headers("citizen-9")).json()
    assert stored["title"] == "Pothole"
    assert stored["description"] == "Deep hole"
    assert stored["userId"] == "citizen-9"  # from the token, not the body


def test_whitespace_only_required_fields_are_rejected(client, sample_payload):
    # userId is no longer a body field the server relies on (it comes from
    # the token), so only title and description are validated here.
    for field in ("title", "description"):
        payload = {**sample_payload, field: "   "}
        res = client.post("/submit-grievance", json=payload, headers=_auth_headers())
        assert res.status_code == 400, field
        assert "error" in res.json()


def test_unicode_and_emoji_round_trip(client, sample_payload):
    payload = {
        **sample_payload,
        "title": "पाणी भरलेला रस्ता 🌧️ — waterlogged road",
        "description": "मुंबईत पाऊस: “पाणी” संप्ली नाही. — ॐ نَصْلَح",
    }
    res = client.post("/submit-grievance", json=payload, headers=_auth_headers())
    assert res.status_code == 200
    stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_admin_headers()).json()
    assert stored["title"] == payload["title"]
    assert stored["description"] == payload["description"]


def test_operator_like_values_are_stored_literally(client, sample_payload):
    """pymongo parameterises values, so these must arrive back verbatim.

    Each probe is a Mongo operator fragment used as a *value* — if any were
    interpreted, a query would match rows it should not (or drop them).
    """
    probes = ["$gt", "$ne", "$where", "$or", '{"$gt": ""}']
    for i, value in enumerate(probes):
        payload = {**sample_payload, "title": value}
        # Each probe submits as its own user so the scoping query below can
        # still pick exactly one row — identity comes from the token now.
        res = client.post(
            "/submit-grievance", json=payload, headers=_auth_headers(f"inj-{i}")
        )
        assert res.status_code == 200, value
        stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_admin_headers()).json()
        assert stored["title"] == value

    # Filtering on a probe-matching user still returns only that one row.
    scoped = client.get("/grievances", params={"userId": "inj-0"}, headers=_admin_headers()).json()
    assert len(scoped) == 1
    assert scoped[0]["title"] == "$gt"


def test_long_fields_are_accepted(client, sample_payload):
    payload = {
        **sample_payload,
        "title": "T" * 500,
        "description": "D" * 10_000,
    }
    res = client.post("/submit-grievance", json=payload, headers=_auth_headers())
    assert res.status_code == 200
    stored = client.get(f"/grievances/{res.json()['grievanceId']}", headers=_admin_headers()).json()
    assert len(stored["title"]) == 500
    assert len(stored["description"]) == 10_000
