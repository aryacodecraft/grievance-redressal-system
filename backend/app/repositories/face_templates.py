"""Face authentication persistence — templates, challenges, rate-limit counters.

Three stores behind one repository (DEC-024), following the same
InMemory/Mongo/singleton pattern as ``repositories/audit.py``:

- ``face_templates``   — one encrypted embedding per user (never images)
- ``face_challenges``  — single-use server-issued liveness challenges (30 s TTL)
- ``face_rate_limits`` — failed-attempt counters with a TTL window

MongoDB when ``MONGODB_URI`` is set, process-local memory otherwise.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger("grievance-api")

ChallengeResult = tuple[Optional[str], str]  # (action, reason)
RateResult = tuple[bool, int]  # (allowed, remaining attempts)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── In-memory fallback ───────────────────────────────────────────────────────

class InMemoryFaceRepository:
    def __init__(self) -> None:
        self._templates: dict[str, dict] = {}  # user_id → template doc
        self._challenges: dict[str, dict] = {}  # challenge_id → challenge doc
        self._counters: dict[str, dict] = {}  # key → {count, windowExpiresAt}

    def ensure_indexes(self) -> None:
        pass

    # ── Templates ──

    def get_template(self, user_id: str) -> Optional[dict]:
        doc = self._templates.get(user_id)
        return dict(doc) if doc else None

    def upsert_template(self, user_id: str, fields: dict[str, Any]) -> dict:
        existing = self._templates.get(user_id)
        now_iso = _now().isoformat()
        doc = {
            **fields,
            "userId": user_id,
            "createdAt": existing["createdAt"] if existing else now_iso,
            "updatedAt": now_iso,
        }
        self._templates[user_id] = doc
        return dict(doc)

    def delete_template(self, user_id: str) -> bool:
        return self._templates.pop(user_id, None) is not None

    # ── Challenges ──

    def create_challenge(self, action: str, ttl_seconds: int) -> dict:
        challenge_id = uuid.uuid4().hex
        now = _now()
        doc = {
            "id": challenge_id,
            "action": action,
            "createdAt": now,
            "expiresAt": now + timedelta(seconds=ttl_seconds),
        }
        self._challenges[challenge_id] = doc
        return {"id": challenge_id, "action": action, "ttl": ttl_seconds}

    def consume_challenge(self, challenge_id: str) -> ChallengeResult:
        """Atomically consume a challenge (single use).

        Returns ``(action, "ok")`` on first use, ``(None, "expired")`` after
        the TTL, ``(None, "not_found")`` when unknown or already consumed.
        """
        doc = self._challenges.pop(challenge_id, None)
        if doc is None:
            return None, "not_found"
        if _now() > doc["expiresAt"]:
            return None, "expired"
        return doc["action"], "ok"

    # ── Rate limits ──

    def rate_hit(self, key: str, limit: int, window_seconds: int) -> RateResult:
        """Record one failure. Returns (allowed, remaining)."""
        now = _now()
        entry = self._counters.get(key)
        if entry is None or now > entry["windowExpiresAt"]:
            entry = {"count": 0, "windowExpiresAt": now + timedelta(seconds=window_seconds)}
            self._counters[key] = entry
        if entry["count"] >= limit:
            return False, 0
        entry["count"] += 1
        return True, limit - entry["count"]

    def rate_count(self, key: str, window_seconds: int) -> int:
        """Current failure count in the active window (0 when expired)."""
        entry = self._counters.get(key)
        if entry is None or _now() > entry["windowExpiresAt"]:
            return 0
        return int(entry["count"])

    def rate_counts(self, keys: list[str]) -> dict[str, int]:
        return {k: self.rate_count(k, 0) for k in keys}

    def rate_reset(self, key: str) -> None:
        self._counters.pop(key, None)


# ── MongoDB-backed implementation ────────────────────────────────────────────

class MongoFaceRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient

        client = MongoClient(uri)
        db = client[db_name]
        self._templates = db["face_templates"]
        self._challenges = db["face_challenges"]
        self._counters = db["face_rate_limits"]

    def ensure_indexes(self) -> None:
        from pymongo import ASCENDING
        from pymongo.errors import OperationFailure

        self._templates.create_index(
            "userId", unique=True, name="uniq_face_user"
        )
        # TTL indexes: MongoDB's background purge is lazy (~60 s), so every
        # read also checks expiry explicitly.
        for coll, key_spec, idx_name in [
            (self._challenges, [("expiresAt", ASCENDING)], "face_challenge_ttl"),
            (self._counters, [("windowExpiresAt", ASCENDING)], "face_rate_ttl"),
        ]:
            try:
                coll.create_index(key_spec, name=idx_name, expireAfterSeconds=0)
            except OperationFailure as exc:
                if exc.code == 85:  # IndexOptionsConflict
                    coll.drop_index(idx_name)
                    coll.create_index(key_spec, name=idx_name, expireAfterSeconds=0)
                else:
                    raise

    @staticmethod
    def _out(raw: dict | None) -> Optional[dict]:
        if raw is None:
            return None
        return {k: v for k, v in raw.items() if k != "_id"}

    # ── Templates ──

    def get_template(self, user_id: str) -> Optional[dict]:
        return self._out(self._templates.find_one({"userId": user_id}))

    def upsert_template(self, user_id: str, fields: dict[str, Any]) -> dict:
        existing = self._templates.find_one({"userId": user_id}, {"createdAt": 1})
        now_iso = _now().isoformat()
        doc = {
            **fields,
            "userId": user_id,
            "createdAt": (existing or {}).get("createdAt", now_iso),
            "updatedAt": now_iso,
        }
        self._templates.find_one_and_replace(
            {"userId": user_id}, doc, upsert=True
        )
        return dict(doc)

    def delete_template(self, user_id: str) -> bool:
        result = self._templates.delete_one({"userId": user_id})
        return result.deleted_count == 1

    # ── Challenges ──

    def create_challenge(self, action: str, ttl_seconds: int) -> dict:
        challenge_id = uuid.uuid4().hex
        now = _now()
        self._challenges.insert_one(
            {
                "_id": challenge_id,
                "action": action,
                "createdAt": now,
                "expiresAt": now + timedelta(seconds=ttl_seconds),
            }
        )
        return {"id": challenge_id, "action": action, "ttl": ttl_seconds}

    def consume_challenge(self, challenge_id: str) -> ChallengeResult:
        doc = self._challenges.find_one_and_delete({"_id": challenge_id})
        if doc is None:
            return None, "not_found"
        expires_at = doc.get("expiresAt")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if _now() > expires_at:
                return None, "expired"
        return doc.get("action"), "ok"

    # ── Rate limits ──

    def rate_hit(self, key: str, limit: int, window_seconds: int) -> RateResult:
        now = _now()
        expiry = now + timedelta(seconds=window_seconds)
        from pymongo import ReturnDocument

        doc = self._counters.find_one_and_update(
            {"_id": key},
            [
                {
                    "$set": {
                        "windowExpiresAt": {
                            "$cond": [
                                {
                                    "$or": [
                                        {"$eq": [{"$type": "$windowExpiresAt"}, "missing"]},
                                        {"$lte": ["$windowExpiresAt", now]},
                                    ]
                                },
                                expiry,
                                "$windowExpiresAt",
                            ]
                        },
                        "count": {
                            "$cond": [
                                {
                                    "$or": [
                                        {"$eq": [{"$type": "$count"}, "missing"]},
                                        {"$lte": ["$windowExpiresAt", now]},
                                    ]
                                },
                                1,
                                {
                                    "$cond": [
                                        {"$gte": ["$count", limit]},
                                        "$count",
                                        {"$add": ["$count", 1]},
                                    ]
                                },
                            ]
                        },
                    }
                }
            ],
            upsert=True,
            return_document=ReturnDocument.BEFORE,
        )
        if doc is None:
            return True, limit - 1
        exp = doc.get("windowExpiresAt")
        if isinstance(exp, datetime) and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is None or now > exp:
            return True, limit - 1
        cnt = int(doc.get("count", 0))
        if cnt >= limit:
            return False, 0
        return True, limit - (cnt + 1)

    def rate_count(self, key: str, window_seconds: int) -> int:
        doc = self._counters.find_one({"_id": key})
        if not doc:
            return 0
        expires_at = doc.get("windowExpiresAt")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if _now() > expires_at:
                return 0
        return int(doc.get("count", 0))

    def rate_counts(self, keys: list[str]) -> dict[str, int]:
        now = _now()
        cursor = self._counters.find({"_id": {"$in": keys}})
        counts: dict[str, int] = {k: 0 for k in keys}
        for doc in cursor:
            k = doc.get("_id")
            exp = doc.get("windowExpiresAt")
            if isinstance(exp, datetime):
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if now > exp:
                    continue
            counts[k] = int(doc.get("count", 0))
        return counts

    def rate_reset(self, key: str) -> None:
        self._counters.delete_one({"_id": key})


# ── Singleton factory ────────────────────────────────────────────────────────

def _build_face_repo():
    from ..config import MONGODB_DB, MONGODB_URI

    if MONGODB_URI:
        try:
            repo = MongoFaceRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes()
            logger.info("Face auth: MongoDB (%s.face_templates)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning(
                "MongoDB face init failed (%s); using in-memory fallback.", exc
            )
    else:
        logger.warning(
            "MONGODB_URI not set — face templates stored in memory."
        )
    return InMemoryFaceRepository()


face_repository = _build_face_repo()
