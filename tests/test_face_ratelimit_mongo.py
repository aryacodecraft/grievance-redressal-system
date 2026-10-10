"""Integration tests for MongoFaceRepository rate limiting.

Requires a live MongoDB connection via MONGODB_URI_TEST.
Uses a temporary collection dropped on test completion.
"""

from __future__ import annotations

import concurrent.futures
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from backend.app.repositories.face_templates import MongoFaceRepository

MONGODB_URI_TEST = os.getenv("MONGODB_URI_TEST")


@pytest.fixture
def mongo_repo():
    if not MONGODB_URI_TEST:
        pytest.skip("MONGODB_URI_TEST not set")
    temp_coll = f"test_face_rate_{uuid.uuid4().hex[:8]}"
    db_name = os.getenv("MONGODB_DB", "grievance_db")
    repo = MongoFaceRepository(MONGODB_URI_TEST, db_name, counters_collection=temp_coll)
    repo.ensure_indexes()
    try:
        yield repo
    finally:
        try:
            repo._counters.drop()
        except Exception:
            pass


def test_mongo_rate_limit_sequence(mongo_repo):
    key = f"seq_{uuid.uuid4().hex[:8]}"
    limit = 5
    window_seconds = 60

    # calls 1-5 allowed
    for i in range(1, 6):
        allowed, remaining = mongo_repo.rate_hit(key, limit, window_seconds)
        assert allowed is True, f"Call {i} should be allowed"
        assert remaining == limit - i, f"Remaining after call {i} should be {limit - i}"

    # calls 6-7 denied
    for i in range(6, 8):
        allowed, remaining = mongo_repo.rate_hit(key, limit, window_seconds)
        assert allowed is False, f"Call {i} should be denied"
        assert remaining == 0, f"Remaining after call {i} should be 0"

    # count stays 5
    assert mongo_repo.rate_count(key, window_seconds) == 5


def test_mongo_rate_limit_expired_window(mongo_repo):
    key = f"exp_{uuid.uuid4().hex[:8]}"
    limit = 5
    window_seconds = 60

    # Consume hits
    mongo_repo.rate_hit(key, limit, window_seconds)
    mongo_repo.rate_hit(key, limit, window_seconds)

    # Set windowExpiresAt in the past
    past = datetime.now(timezone.utc) - timedelta(seconds=10)
    mongo_repo._counters.update_one({"_id": key}, {"$set": {"windowExpiresAt": past}})

    # Next call allowed with count 1
    allowed, remaining = mongo_repo.rate_hit(key, limit, window_seconds)
    assert allowed is True
    assert remaining == limit - 1
    assert mongo_repo.rate_count(key, window_seconds) == 1


def test_mongo_rate_limit_concurrent_threads(mongo_repo):
    key = f"conc_{uuid.uuid4().hex[:8]}"
    limit = 5
    window_seconds = 60
    num_threads = 10

    def hit():
        return mongo_repo.rate_hit(key, limit, window_seconds)

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(hit) for _ in range(num_threads)]
        results = [f.result() for f in futures]

    allowed_count = sum(1 for allowed, _ in results if allowed is True)
    denied_count = sum(1 for allowed, _ in results if allowed is False)

    assert allowed_count == 5, f"Expected 5 allowed, got {allowed_count}"
    assert denied_count == 5, f"Expected 5 denied, got {denied_count}"
    assert mongo_repo.rate_count(key, window_seconds) == 5
