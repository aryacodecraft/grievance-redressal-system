"""Exercise concurrent reservations and billing attempt tombstones."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException

from backend.app import config
from backend.app.services.transcription_limits import TranscriptionLimits


def test_atomic_global_budget(monkeypatch):
    monkeypatch.setattr(config, "TRANSCRIPTION_MAX_CONCURRENT", 100)
    limiter = TranscriptionLimits()
    def reserve(i):
        try:
            limiter.reserve(str(i), str(i), "fingerprint")
            return True
        except HTTPException:
            return False
    with ThreadPoolExecutor(max_workers=25) as pool:
        assert sum(pool.map(reserve, range(100))) == 20


def test_active_and_concurrent_limits():
    limiter = TranscriptionLimits()
    limiter.reserve("a", "1", "x")
    for user, key in (("a", "2"),):
        with pytest.raises(HTTPException) as exc:
            limiter.reserve(user, key, "x")
        assert exc.value.status_code == 429
    limiter.reserve("b", "1", "x")
    with pytest.raises(HTTPException):
        limiter.reserve("c", "1", "x")
    limiter.finish("b", "1")
    assert limiter.reserve("c", "1", "x") is None


def test_sliding_minute_hour_limits():
    now = [0.0]
    limiter = TranscriptionLimits(clock=lambda: now[0])
    for i in range(10):
        if i % 3 == 0:
            now[0] += 61
        limiter.reserve("a", str(i), "x")
        limiter.finish("a", str(i))
        if i == 2:
            with pytest.raises(HTTPException):
                limiter.reserve("a", "minute-blocked", "x")
    now[0] += 61
    with pytest.raises(HTTPException):
        limiter.reserve("a", "hour-blocked", "x")
    now[0] += 3600
    assert limiter.reserve("a", "after-window", "x") is None


def test_idempotency_and_expiry():
    now = [0.0]
    limiter = TranscriptionLimits(clock=lambda: now[0])
    limiter.reserve("a", "key", "x")
    with pytest.raises(HTTPException) as exc:
        limiter.reserve("a", "key", "x")
    assert exc.value.status_code == 409
    limiter.finish("a", "key", {"transcript": "result"})
    assert limiter.reserve("a", "key", "x") == {"transcript": "result"}
    with pytest.raises(HTTPException):
        limiter.reserve("a", "key", "different")
    now[0] += 301
    with pytest.raises(HTTPException):
        limiter.reserve("a", "key", "x")
    assert limiter._attempts[("a", "key")].result is None


def test_failed_attempt_not_retried():
    limiter = TranscriptionLimits()
    limiter.reserve("a", "key", "x")
    limiter.finish("a", "key")
    with pytest.raises(HTTPException):
        limiter.reserve("a", "key", "x")
