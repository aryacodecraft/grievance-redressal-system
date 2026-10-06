"""Shared fixtures for the backend test suite.

Environment is pinned **before** `backend.app` is imported anywhere:
`MONGODB_URI` is forced empty so the application's module-level repository is
always the in-memory one, which keeps endpoint tests deterministic and stops
them from touching a real Atlas cluster.

Mongo-specific behaviour is exercised separately by constructing a
`MongoRepository` directly against `TEST_MONGODB_URI` (see test_repository.py),
which skips cleanly when no test database is reachable.
"""

from __future__ import annotations

import os
from typing import Any

# Must happen before any `backend.app` import (db.py and users_db.py build
# their repositories at import time and load_dotenv() would otherwise pick up
# backend/.env).
os.environ["MONGODB_URI"] = ""
os.environ["MONGODB_DB"] = "grievance_test"
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
# Force the deterministic keyword fallback — no HF/Groq network calls in tests.
os.environ["GROQ_API_KEY"] = ""
os.environ["HF_API_TOKEN"] = ""
# JWT secret for tests — any stable value works; must be non-empty so tokens
# are actually validated (auth.py disables verification when secret is "").
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only-not-production")
# Disable admin seeding in tests (the seed hash runs at app startup and would
# fail if SEED_ADMIN_PASSWORD from backend/.env is too long for bcrypt).
os.environ["SEED_ADMIN_EMAIL"] = ""
os.environ["SEED_ADMIN_PASSWORD"] = ""

import pytest
from fastapi.testclient import TestClient

TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI", "mongodb://127.0.0.1:27017")
TEST_MONGODB_DB = os.environ.get("TEST_MONGODB_DB", "grievance_test")


@pytest.fixture(scope="session")
def app():
    from backend.app.main import app as fastapi_app

    return fastapi_app


@pytest.fixture(autouse=True)
def fresh_repository():
    """Isolate every test from all module-global stores.

    Routers bind repositories at import (`from ..db import repository`,
    `from ..repositories.audit import audit_repository`, ...), so swapping
    only `db.repository` leaves the other bindings pointing at the previous
    test's store. Rebind every known attribute on every router module.
    """
    from backend.app import db, users_db
    from backend.app.repositories import audit as audit_repo_mod
    from backend.app.repositories import progress as progress_repo_mod
    from backend.app.repositories import notifications as notif_repo_mod
    from backend.app.repositories import departments as dept_repo_mod
    from backend.app.repositories import sla_config as sla_repo_mod

    fresh_grievances = db.InMemoryRepository()
    fresh_users = users_db.InMemoryUsersRepository()
    fresh_audit = audit_repo_mod.InMemoryAuditRepository()
    fresh_progress = progress_repo_mod.InMemoryProgressRepository()
    fresh_notif = notif_repo_mod.InMemoryNotificationRepository()
    fresh_dept = dept_repo_mod.InMemoryDepartmentRepository()
    fresh_sla = sla_repo_mod.InMemorySlaConfigRepository()

    # Remember previous values for restore.
    saved: list[tuple[Any, str, Any]] = []

    def _swap(obj: Any, attr: str, fresh: Any) -> None:
        if hasattr(obj, attr):
            saved.append((obj, attr, getattr(obj, attr)))
            setattr(obj, attr, fresh)

    import backend.app.routers.grievances as rg
    import backend.app.routers.assignments as ra
    import backend.app.routers.progress as rp
    import backend.app.routers.admin as rad
    import backend.app.routers.users as ru
    import backend.app.routers.departments as rd
    import backend.app.routers.audit as rau
    import backend.app.routers.notifications as rn
    import backend.app.routers.auth as rauth

    # Grievance store on every router that reads/writes grievances.
    for mod in (rg, ra, rp, rad):
        _swap(mod, "repository", fresh_grievances)
    # Users store.
    _swap(rauth, "users_repository", fresh_users)
    _swap(ru, "users_repository", fresh_users)
    _swap(users_db, "users_repository", fresh_users)
    # Side-effect stores (singletons + direct router bindings).
    _swap(audit_repo_mod, "audit_repository", fresh_audit)
    _swap(progress_repo_mod, "progress_repository", fresh_progress)
    _swap(notif_repo_mod, "notif_repository", fresh_notif)
    _swap(dept_repo_mod, "dept_repository", fresh_dept)
    _swap(sla_repo_mod, "sla_repository", fresh_sla)
    for mod in (ra, rp, rau, rd):
        _swap(mod, "audit_repository", fresh_audit)
    for mod in (ra, rp, rn):
        _swap(mod, "notif_repository", fresh_notif)
    for mod in (rp,):
        _swap(mod, "progress_repository", fresh_progress)
    for mod in (rd,):
        _swap(mod, "dept_repository", fresh_dept)
    for mod in (ra,):
        _swap(mod, "sla_repository", fresh_sla)

    try:
        yield
    finally:
        for obj, attr, prev in reversed(saved):
            try:
                setattr(obj, attr, prev)
            except Exception:
                pass


@pytest.fixture()
def client(app):
    """A TestClient with the in-memory repository."""
    from backend.app import db

    assert db.storage_mode() == "in-memory", (
        "endpoint tests must not run against a real database — "
        f"storage_mode()={db.storage_mode()!r}"
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def mongo_uri() -> str:
    """URI for a throwaway test database, or skip the Mongo tests."""
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError

    try:
        MongoClient(
            TEST_MONGODB_URI, serverSelectionTimeoutMS=750, connectTimeoutMS=750
        ).admin.command("ping")
    except PyMongoError:
        pytest.skip(
            f"no reachable test MongoDB at {TEST_MONGODB_URI!r} "
            "(set TEST_MONGODB_URI to run these)"
        )
    return TEST_MONGODB_URI


@pytest.fixture()
def mongo_repository(mongo_uri):
    """A MongoRepository wired to a test database, dropped after each test."""
    from backend.app.db import MongoRepository

    repo = MongoRepository(mongo_uri, TEST_MONGODB_DB, timeout_ms=750)
    repo._col.drop()
    repo.ensure_indexes()
    try:
        yield repo
    finally:
        repo._col.drop()


@pytest.fixture()
def sample_payload() -> dict:
    return {
        "title": "Pothole outside the school gate",
        "description": "A deep pothole on the main road is damaging vehicles.",
        "userId": "citizen-test-1",
        "latitude": 18.5204,
        "longitude": 73.8567,
    }


@pytest.fixture(params=["memory", "mongo"])
def repo(request):
    """A repository of each kind; the Mongo param skips if unreachable.

    Lives here rather than in `test_repository.py` so every test module can
    assert against both implementations — the in-memory fallback and MongoDB
    must honour the same contract (see the divergence tests).

    `mongo_repository` is resolved lazily so the `memory` param runs even on
    machines with no MongoDB at all.
    """
    from backend.app.db import InMemoryRepository

    if request.param == "memory":
        return InMemoryRepository()
    return request.getfixturevalue("mongo_repository")
