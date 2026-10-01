"""Repository tests — both `GrievanceRepository` implementations.

`InMemoryRepository` is always exercised. `MongoRepository` needs a reachable
test database: set `TEST_MONGODB_URI` (default `mongodb://127.0.0.1:27017`) or
the Mongo tests skip rather than fail. The fixture drops the collection before
and after each test, so a local `mongod` used for verification is left clean.

These tests target the repository class directly rather than the running app,
because the app's repository is chosen once at import time (see
`_build_repository()`); selection logic is covered separately below.
"""

from __future__ import annotations

import pytest

from backend.app.db import InMemoryRepository

# A stored record as the routers build it (see routers/grievances.py).
BASE_DOC = {
    "title": "Streetlight out",
    "description": "The streetlight near the bus stop has been dark for weeks.",
    "userId": "alice",
    "status": "open",
    "category": "electricity",
    "priority": "medium",
}


def _doc(**overrides) -> dict:
    return {**BASE_DOC, **overrides}


# ── Shared contract (parametrised over both implementations) ────────────────


@pytest.fixture(params=["memory", "mongo"])
def repo(request):
    """A repository of each kind; the Mongo param skips if unreachable.

    `mongo_repository` is resolved lazily so the `memory` param runs even on
    machines with no MongoDB at all.
    """
    if request.param == "memory":
        return InMemoryRepository()
    return request.getfixturevalue("mongo_repository")


def test_create_assigns_id_and_returns_it(repo):
    doc_id = repo.create(_doc())
    assert doc_id.startswith("GRV-")
    assert repo.get(doc_id)["id"] == doc_id


def test_get_missing_returns_none(repo):
    assert repo.get("GRV-1999-9999") is None


def test_get_roundtrips_fields(repo):
    doc_id = repo.create(_doc(assignee="Ward 4 Engineer", latitude=18.5))
    stored = repo.get(doc_id)
    assert stored["title"] == BASE_DOC["title"]
    assert stored["assignee"] == "Ward 4 Engineer"
    assert stored["latitude"] == 18.5


def test_list_filters_by_user(repo):
    repo.create(_doc(userId="alice"))
    repo.create(_doc(userId="bob"))
    repo.create(_doc(userId="alice"))

    alice = repo.list(user_id="alice")
    assert len(alice) == 2
    assert {d["userId"] for d in alice} == {"alice"}
    assert repo.list(user_id="nobody") == []


def test_list_without_user_returns_everything(repo):
    for uid in ("a", "b", "c"):
        repo.create(_doc(userId=uid))
    assert len(repo.list()) == 3


def test_list_respects_limit(repo):
    for i in range(10):
        repo.create(_doc(userId=f"u{i}"))
    assert len(repo.list(limit=4)) == 4


def test_list_returns_newest_first(repo):
    older = repo.create(_doc(title="older"))
    newer = repo.create(_doc(title="newer"))
    ids = [d["id"] for d in repo.list()]
    assert ids.index(newer) < ids.index(older)


def test_update_persists_patch(repo):
    doc_id = repo.create(_doc())
    updated = repo.update(doc_id, {"status": "assigned", "assignee": "Zonal Officer"})

    assert updated["status"] == "assigned"
    assert updated["assignee"] == "Zonal Officer"
    # Unrelated fields untouched.
    assert updated["title"] == BASE_DOC["title"]

    reloaded = repo.get(doc_id)
    assert reloaded["status"] == "assigned"
    assert reloaded["assignee"] == "Zonal Officer"


def test_update_missing_returns_none(repo):
    assert repo.update("GRV-1999-9999", {"status": "resolved"}) is None


def test_update_ignores_none_values(repo):
    """`None` means "leave alone" — the routers rely on this for partial PATCH."""
    doc_id = repo.create(_doc())
    repo.update(doc_id, {"assignee": "kept", "status": None})
    stored = repo.get(doc_id)
    assert stored["assignee"] == "kept"
    assert stored["status"] == "open"


def test_ids_are_unique_across_creates(repo):
    ids = {repo.create(_doc()) for _ in range(25)}
    assert len(ids) == 25


# ── In-memory specifics ─────────────────────────────────────────────────────


def test_inmemory_creates_isolated_instances():
    a, b = InMemoryRepository(), InMemoryRepository()
    a.create(_doc())
    assert b.list() == []


def test_inmemory_stores_iso_created_at():
    from datetime import datetime

    repo = InMemoryRepository()
    doc_id = repo.create(_doc())
    created = repo.get(doc_id)["createdAt"]
    assert datetime.fromisoformat(created)  # parses back


# ── Mongo specifics ─────────────────────────────────────────────────────────


def test_mongo_persists_as_bson_datetime(mongo_repository):
    """`createdAt` is stored as a real BSON date, not a string."""
    from datetime import datetime

    doc_id = mongo_repository.create(_doc())
    raw = mongo_repository._col.find_one({"id": doc_id}, {"_id": 0})
    assert isinstance(raw["createdAt"], datetime)

    # And comes back as an ISO-8601 string for the API.
    reloaded = mongo_repository.get(doc_id)
    assert isinstance(reloaded["createdAt"], str)
    datetime.fromisoformat(reloaded["createdAt"])


def test_mongo_does_not_leak_mongo_id(mongo_repository):
    doc_id = mongo_repository.create(_doc())
    stored = mongo_repository.get(doc_id)
    assert "_id" not in stored
    for doc in mongo_repository.list():
        assert "_id" not in doc


def test_mongo_indexes_exist(mongo_repository):
    names = {idx["name"] for idx in mongo_repository._col.list_indexes()}
    assert {"uniq_grievance_id", "user_created"} <= names


def test_mongo_unique_id_index_rejects_duplicates(mongo_repository):
    from pymongo.errors import DuplicateKeyError

    doc_id = mongo_repository.create(_doc())
    duplicate = _doc(id=doc_id)
    with pytest.raises(DuplicateKeyError):
        mongo_repository._col.insert_one(dict(duplicate))


def test_mongo_survives_a_new_repository_instance(mongo_repository, mongo_uri):
    """Stand-in for a process restart: data must outlive the object."""
    from backend.app.db import MongoRepository

    doc_id = mongo_repository.create(_doc(title="written before restart"))

    reopened = MongoRepository(mongo_uri, "grievance_test", timeout_ms=750)
    assert reopened.get(doc_id)["title"] == "written before restart"
    assert reopened.ping()


# ── Repository selection ────────────────────────────────────────────────────


def test_build_repository_uses_memory_without_uri(monkeypatch):
    """`MONGODB_URI` empty → in-memory fallback (the default dev path)."""
    import backend.app.config as config
    from backend.app import db

    monkeypatch.setattr(config, "MONGODB_URI", "")
    chosen = db._build_repository()
    assert isinstance(chosen, InMemoryRepository)
    assert db.storage_mode() == "in-memory"


def test_build_repository_uses_mongo_with_uri(monkeypatch, mongo_uri):
    import backend.app.config as config
    from backend.app import db

    monkeypatch.setattr(config, "MONGODB_URI", mongo_uri)
    monkeypatch.setattr(config, "MONGODB_DB", "grievance_selection_test")
    try:
        chosen = db._build_repository()
        assert isinstance(chosen, db.MongoRepository)
        assert db.storage_mode() == "mongodb"
    finally:
        # Never leave the throwaway db behind.
        from pymongo import MongoClient

        MongoClient(mongo_uri, serverSelectionTimeoutMS=750).drop_database(
            "grievance_selection_test"
        )
        db._storage_mode = "in-memory"


def test_storage_mode_reports_fallback_by_default():
    """With conftest pinning `MONGODB_URI=""`, the app must report in-memory."""
    from backend.app import db

    assert db.storage_mode() == "in-memory"


def test_to_api_omits_absent_optional_fields():
    from backend.app.db import to_api

    payload = to_api({"id": "GRV-2026-0001", "title": "t"})
    assert payload["status"] == "open"
    assert payload["category"] == "other"
    assert payload["priority"] == "low"
    for key in ("assignee", "imageUrl", "latitude", "longitude"):
        assert key not in payload


def test_to_api_prefers_toplevel_category_over_hf_engine():
    from backend.app.db import to_api

    payload = to_api(
        {
            "id": "GRV-2026-0002",
            "category": "roads",
            "priority": "high",
            "hfEngine": {"category": "water", "priority": "low"},
        }
    )
    assert payload["category"] == "roads"
    assert payload["priority"] == "high"
    assert payload["hfEngine"]["category"] == "water"
