"""Grievance id allocation — regression tests for DEC-014.

`_new_id()` used to be `itertools.count(1)`, which resets to 1 on every process
start. The first write after a restart therefore requested an id that already
existed and tripped `uniq_grievance_id`:

    DuplicateKeyError: E11000 … dup key: { id: "GRV-2026-0001" }  ->  500

Ids are now derived from stored data, so these tests seed an existing id and
assert the next one continues from it rather than restarting at 0001. If any of
these fail, a restart can corrupt writes against a real database.

The `repo` fixture is parametrised over both implementations, so each case below
runs against `InMemoryRepository` always and `MongoRepository` when a test
database is reachable.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest

from backend.app.db import InMemoryRepository, _id_for, _sequence_of


def _auth_headers(user_id: str = "citizen-test-1", role: str = "USER"):
    """Submission identity comes from the JWT — attach a token to post."""
    from backend.app.auth import create_access_token

    token = create_access_token(user_id, role, f"{user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}

BASE_DOC = {
    "title": "Streetlight out",
    "description": "The streetlight near the bus stop has been dark for weeks.",
    "userId": "alice",
    "status": "open",
    "category": "electricity",
    "priority": "medium",
}

YEAR = datetime.now(timezone.utc).year


def _doc(**overrides) -> dict:
    return {**BASE_DOC, **overrides}


def _seed(repo, grievance_id: str) -> None:
    """Insert a record with an exact id, bypassing allocation."""
    record = _doc()
    if isinstance(repo, InMemoryRepository):
        repo._docs[grievance_id] = {**record, "id": grievance_id}
    else:
        repo._col.insert_one({**record, "id": grievance_id})


# ── Helpers ─────────────────────────────────────────────────────────────────


def test_id_for_formats_and_zero_pads():
    assert _id_for(2026, 7) == "GRV-2026-0007"
    assert _id_for(2026, 1234) == "GRV-2026-1234"


@pytest.mark.parametrize(
    "value,expected",
    [
        ("GRV-2026-0007", 7),
        ("GRV-2026-1234", 1234),
        ("GRV-2026-abc", None),
        ("", None),
        ("nonsense", None),
        ("GRV-2026-", None),
    ],
)
def test_sequence_of_parses_tail(value, expected):
    assert _sequence_of(value) == expected


# ── Allocation continues from what is stored ────────────────────────────────


def test_continues_from_stored_ids(repo):
    _seed(repo, f"GRV-{YEAR}-0007")
    assert repo.create(_doc()) == f"GRV-{YEAR}-0008"


def test_picks_highest_not_most_recent_insert(repo):
    """An out-of-order id must not be resurrected."""
    _seed(repo, f"GRV-{YEAR}-0003")
    _seed(repo, f"GRV-{YEAR}-0042")
    _seed(repo, f"GRV-{YEAR}-0011")
    assert repo.create(_doc()) == f"GRV-{YEAR}-0043"


def test_ignores_previous_year(repo):
    """A year rollover starts a new series rather than continuing the old one."""
    _seed(repo, f"GRV-{YEAR - 1}-0999")
    assert repo.create(_doc()) == f"GRV-{YEAR}-0001"


def test_unparseable_stored_id_does_not_wedge_allocation(repo):
    """Garbage in the id column must not make every future create fail."""
    _seed(repo, f"GRV-{YEAR}-notanumber")
    assert repo.create(_doc()) == f"GRV-{YEAR}-0001"


def test_ids_are_sequential_across_creates(repo):
    first = repo.create(_doc())
    second = repo.create(_doc())
    assert _sequence_of(second) == (_sequence_of(first) or 0) + 1


# ── Uniqueness under concurrency ────────────────────────────────────────────


@pytest.mark.parametrize("count", [8, 32])
def test_concurrent_creates_yield_unique_ids(repo, count):
    """Exercises the DuplicateKeyError retry in `MongoRepository.create`."""
    with ThreadPoolExecutor(max_workers=min(16, count)) as pool:
        ids = list(pool.map(lambda _: repo.create(_doc()), range(count)))

    assert len(set(ids)) == count
    assert all(i.startswith("GRV-") for i in ids)


# ── Endpoint level: the exact DEC-014 reproduction ──────────────────────────


def test_submit_after_an_existing_zero_padded_id(client, sample_payload):
    """The 500 this file was written for: 0001 exists, submit again anyway."""
    existing = f"GRV-{YEAR}-0001"

    from backend.app.routers import grievances as router

    router.repository._docs[existing] = {
        **sample_payload,
        "id": existing,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    res = client.post("/submit-grievance", json=sample_payload, headers=_auth_headers())
    assert res.status_code == 200, res.text
    assert res.json()["grievanceId"] == f"GRV-{YEAR}-0002"


def test_repeated_submits_never_reissue_an_id(client, sample_payload):
    for i in range(1, 6):
        res = client.post(
            "/submit-grievance", json=sample_payload, headers=_auth_headers()
        )
        assert res.status_code == 200, res.text
        assert res.json()["grievanceId"] == f"GRV-{YEAR}-{i:04d}"
