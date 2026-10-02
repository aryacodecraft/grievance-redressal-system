"""Security baseline — the behaviour Phase 1 (JWT + RBAC) must replace.

**These tests assert the CURRENT, INSECURE behaviour on purpose.**

`docs/SECURITY.md` calls the missing server-side authorisation the
project's highest-risk gap, and AGENTS.md requires role checks to be enforced
server-side. None of that exists yet, so each test below documents what an
attacker can do today. They are the measurable "before" for Phase 1: when auth
lands, every one of these must fail — flip it to expect `401`/`403` at that
point rather than deleting it.

Nothing here reaches the network: `conftest.py` pins `MONGODB_URI=""` and the
LLM keys before `backend.app` is imported.
"""

from __future__ import annotations

import pytest


def _create(client, sample_payload, **overrides) -> str:
    payload = {**sample_payload, **overrides}
    res = client.post("/submit-grievance", json=payload)
    assert res.status_code == 200, res.text
    return res.json()["grievanceId"]


# ── F1: unauthenticated read of the whole dataset ───────────────────────────


def test_BASELINE_anyone_can_list_every_citizens_grievances(client, sample_payload):
    """No credentials, no `userId` → every record for every citizen.

    Phase 1: must require a bearer token, and non-admins must only ever see
    their own rows regardless of what they pass.
    """
    _create(client, sample_payload, userId="citizen-a")
    _create(client, sample_payload, userId="citizen-b")

    res = client.get("/grievances")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_BASELINE_user_id_query_param_is_not_an_authorisation_check(
    client, sample_payload
):
    """`?userId=` is a filter a caller can point anywhere.

    Phase 1: scoping must be derived from the verified token, not the query
    string — asking for someone else's rows must be refused.
    """
    _create(client, sample_payload, userId="victim")
    res = client.get("/grievances", params={"userId": "victim"})
    assert res.status_code == 200
    assert len(res.json()) == 1


# ── F2: unauthenticated write ───────────────────────────────────────────────


def test_BASELINE_anyone_can_change_any_grievances_status(client, sample_payload):
    """PATCH accepts no credentials at all — assign or resolve from any client.

    Phase 1: must require RESOLVER or ADMIN (DEC-007), and a citizen's token
    must be refused with 403.
    """
    gid = _create(client, sample_payload, userId="victim")
    res = client.patch(
        f"/grievances/{gid}/status",
        json={"status": "resolved", "assignee": "nobody"},
    )
    assert res.status_code == 200
    assert client.get(f"/grievances/{gid}").json()["status"] == "resolved"


def test_BASELINE_status_updates_are_not_attributed_to_anyone(client, sample_payload):
    """No actor, no token, no reason — nothing identifies who acted.

    Phase 1 + the audit requirements in AGENTS.md: the acting principal must be
    recorded server-side and be unspoofable by the request body.
    """
    gid = _create(client, sample_payload)
    body = client.patch(
        f"/grievances/{gid}/status", json={"status": "assigned"}
    ).json()
    for field in ("actor", "actorId", "updatedBy", "changedBy", "token", "role"):
        assert field not in body, field


# ── F3: identity is a client-supplied string ────────────────────────────────


def test_BASELINE_user_id_is_taken_from_the_request_body(client, sample_payload):
    """Submitting as someone else is one edited field.

    Phase 1: `userId` must come from the verified token and any body-supplied
    value must be ignored (or rejected).
    """
    res = client.post(
        "/submit-grievance",
        json={**sample_payload, "userId": "someone-else"},
    )
    assert res.status_code == 200
    stored = client.get(f"/grievances/{res.json()['grievanceId']}").json()
    assert stored["userId"] == "someone-else"


def test_BASELINE_a_grievance_cannot_be_tied_to_a_verified_identity(
    client, sample_payload
):
    """Nothing in the stored record distinguishes a verified user from a guess."""
    gid = _create(client, sample_payload, userId="alice")
    stored = client.get(f"/grievances/{gid}").json()
    for field in ("idToken", "email", "verified", "authUid", "sessionId"):
        assert field not in stored, field


# ── F2b: no rate limiting, no request caps ──────────────────────────────────


def test_BASELINE_no_rate_limiting_on_submission(client, sample_payload):
    """A burst of submissions is accepted in full — there is no throttling.

    Phase 1 (or deployment hardening): rate limiting belongs with auth, since
    it needs a principal to count against.
    """
    for i in range(25):
        res = client.post(
            "/submit-grievance", json={**sample_payload, "userId": f"burst-{i}"}
        )
        assert res.status_code == 200, i
    assert len(client.get("/grievances", params={"limit": 1000}).json()) == 25


# ── F6: CORS is wide open by default ────────────────────────────────────────


def test_cors_origins_config_is_a_non_empty_list_of_strings():
    """`CORS_ORIGINS` is parsed from a comma-separated string at import time.

    `config.py` splits, strips and drops empties, falling back to `["*"]` when
    the result would be empty. The contract worth pinning is that FastAPI is
    always handed a list of non-empty strings — and that a *blank*
    `CORS_ORIGINS=` in the environment does not silently resolve to an empty
    list, which would reject every origin including the app's own.
    """
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
    """The gap must stay visible in `docs/SECURITY.md`, not only in tests."""
    from pathlib import Path

    text = Path("docs/SECURITY.md").read_text(encoding="utf-8").lower()
    for expected in ("authentication", "authori"):
        assert expected in text
