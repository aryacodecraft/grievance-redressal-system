"""Short-lived phone verification challenges (OTP values are never stored)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import RLock


class InMemoryOtpRepository:
    def __init__(self):
        self._items: dict[str, dict] = {}
        self._lock = RLock()

    def put(self, key: str, code_hash: str, purpose: str, ttl: int = 300):
        with self._lock:
            self._items[key] = {"hash": code_hash, "purpose": purpose,
                "expires": datetime.now(timezone.utc) + timedelta(seconds=ttl),
                "attempts": 0, "verified": False}

    def get(self, key: str):
        with self._lock:
            value = self._items.get(key)
            if not value or value["expires"] <= datetime.now(timezone.utc):
                self._items.pop(key, None)
                return None
            return dict(value)

    def fail(self, key: str):
        with self._lock:
            value = self._items.get(key)
            if value:
                value["attempts"] += 1
                if value["attempts"] >= 3:
                    self._items.pop(key, None)

    def mark_verified(self, key: str):
        with self._lock:
            value = self.get(key)
            if value:
                value["verified"] = True
                value["hash"] = ""  # burn the submitted OTP; retain proof marker for bind
                self._items[key] = value

    def consume(self, key: str):
        with self._lock:
            return self._items.pop(key, None)


class MongoOtpRepository(InMemoryOtpRepository):
    def __init__(self, uri: str, db_name: str):
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["phone_otp_challenges"]
        self._col.create_index("expires", expireAfterSeconds=0, name="otp_ttl")
        self._col.create_index("key", unique=True, name="otp_key")

    def put(self, key, code_hash, purpose, ttl=300):
        expires = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        self._col.replace_one({"key": key}, {"key": key, "hash": code_hash,
            "purpose": purpose, "expires": expires, "attempts": 0, "verified": False}, upsert=True)

    def get(self, key):
        value = self._col.find_one({"key": key, "expires": {"$gt": datetime.now(timezone.utc)}})
        return value

    def fail(self, key):
        self._col.update_one({"key": key}, {"$inc": {"attempts": 1}})
        self._col.delete_one({"key": key, "attempts": {"$gte": 3}})

    def mark_verified(self, key):
        self._col.update_one({"key": key}, {"$set": {"verified": True, "hash": ""}})

    def consume(self, key):
        return self._col.find_one_and_delete({"key": key})


def _build():
    from ..config import MONGODB_DB, MONGODB_URI
    if MONGODB_URI:
        try:
            return MongoOtpRepository(MONGODB_URI, MONGODB_DB)
        except Exception:
            pass
    return InMemoryOtpRepository()


otp_repository = _build()
