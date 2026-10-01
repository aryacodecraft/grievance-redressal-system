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

# Must happen before any `backend.app` import (db.py builds its repository at
# import time and load_dotenv() would otherwise pick up backend/.env).
os.environ["MONGODB_URI"] = ""
os.environ["MONGODB_DB"] = "grievance_test"
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
# Force the deterministic keyword fallback — no HF/Groq network calls in tests.
os.environ["GROQ_API_KEY"] = ""
os.environ["HF_API_TOKEN"] = ""

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
    """Give every test a clean store.

    `db.repository` is module-global and `routers/grievances.py` binds it at
    import time (`from ..db import repository`), so the router's name is the one
    that has to be swapped — not `db.repository`.
    """
    from backend.app import db
    from backend.app.routers import grievances as grievances_router

    previous = grievances_router.repository
    grievances_router.repository = db.InMemoryRepository()
    try:
        yield
    finally:
        grievances_router.repository = previous


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
