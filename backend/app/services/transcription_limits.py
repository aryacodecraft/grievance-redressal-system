"""Atomic process-local attempt reservations (prototype; resets on restart)."""

from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import HTTPException

from .. import config


@dataclass
class Attempt:
    fingerprint: str
    started: float
    active: bool = True
    result: dict | None = None


class TranscriptionLimits:
    def __init__(self, clock=monotonic):
        self._lock = Lock()
        self._clock = clock
        self._attempts: dict[tuple[str, str], Attempt] = {}

    def reserve(self, user: str, key: str, fingerprint: str) -> dict | None:
        """Reserve exactly one provider attempt, or return an unexpired replay.

        Keep tombstones after failures/expiry: a timeout may already be billed.
        The lifetime budget bounds the total number of entries in this store.
        """
        with self._lock:
            now = self._clock()
            for attempt in self._attempts.values():
                if now - attempt.started > config.TRANSCRIPTION_IDEMPOTENCY_TTL_SECONDS:
                    attempt.result = None
            prior = self._attempts.get((user, key))
            if prior:
                if prior.fingerprint != fingerprint:
                    raise HTTPException(409, "Idempotency key was used for different audio or language")
                if prior.active:
                    raise HTTPException(409, "Transcription is already in progress")
                if prior.result is not None:
                    return dict(prior.result)
                raise HTTPException(409, "Attempt cannot be replayed; explicitly start a new attempt")
            attempts = list(self._attempts.items())
            if any(u == user and a.active for (u, _), a in attempts):
                raise HTTPException(429, "A transcription is already active for this user", headers={"Retry-After": "5"})
            if sum(a.active for _, a in attempts) >= config.TRANSCRIPTION_MAX_CONCURRENT:
                raise HTTPException(429, "Transcription is busy; try again later", headers={"Retry-After": "5"})
            for window, limit in ((60, config.TRANSCRIPTION_USER_MINUTE_LIMIT), (3600, config.TRANSCRIPTION_USER_HOUR_LIMIT)):
                if sum(u == user and now - a.started < window for (u, _), a in attempts) >= limit:
                    raise HTTPException(429, "Transcription request limit reached", headers={"Retry-After": str(window)})
            if len(attempts) >= config.TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT:
                raise HTTPException(503, "Transcription prototype budget exhausted")
            self._attempts[(user, key)] = Attempt(fingerprint, now)
            return None

    def finish(self, user: str, key: str, result: dict | None = None) -> None:
        with self._lock:
            attempt = self._attempts[(user, key)]
            attempt.active = False
            attempt.result = dict(result) if result is not None else None


transcription_limits = TranscriptionLimits()
