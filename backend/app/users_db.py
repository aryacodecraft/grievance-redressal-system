"""Users collection persistence.

Two implementations:
- ``MongoUsersRepository`` — backed by MongoDB Atlas (``users`` collection).
- ``InMemoryUsersRepository`` — process-local fallback; data lost on restart.

The singleton ``users_repository`` is selected at import time based on
``MONGODB_URI`` from the environment, exactly like ``db.py`` for grievances.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger("grievance-api")


# ── In-memory fallback ───────────────────────────────────────────────────────

class InMemoryUsersRepository:
    def __init__(self) -> None:
        self._users: dict[str, dict] = {}  # id → user doc
        self._by_email: dict[str, str] = {}  # email → id
        self._seq = 0

    def create(self, doc: dict[str, Any]) -> str:
        self._seq += 1
        uid = f"u{self._seq:05d}"
        user = {**doc, "id": uid}
        self._users[uid] = user
        self._by_email[doc["email"].lower()] = uid
        return uid

    def get(self, user_id: str) -> Optional[dict]:
        doc = self._users.get(user_id)
        return dict(doc) if doc else None

    def find_by_email(self, email: str) -> Optional[dict]:
        uid = self._by_email.get(email.strip().lower())
        if not uid:
            return None
        doc = self._users.get(uid)
        return dict(doc) if doc else None

    def update(self, user_id: str, patch: dict[str, Any]) -> Optional[dict]:
        doc = self._users.get(user_id)
        if not doc:
            return None
        doc.update(patch)
        return dict(doc)

    def list_all(self, limit: int = 100) -> list[dict]:
        return [dict(v) for v in list(self._users.values())[:limit]]


# ── MongoDB-backed implementation ────────────────────────────────────────────

class MongoUsersRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient

        self._col = MongoClient(uri)[db_name]["users"]
        self._col.create_index("email", unique=True, name="uniq_user_email")

    @staticmethod
    def _out(raw: dict | None) -> Optional[dict]:
        if raw is None:
            return None
        return {**{k: v for k, v in raw.items() if k != "_id"}, "id": str(raw["_id"])}

    def create(self, doc: dict[str, Any]) -> str:
        from bson import ObjectId

        result = self._col.insert_one({**doc})
        return str(result.inserted_id)

    def get(self, user_id: str) -> Optional[dict]:
        from bson import ObjectId

        try:
            raw = self._col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        return self._out(raw)

    def find_by_email(self, email: str) -> Optional[dict]:
        raw = self._col.find_one({"email": email.strip().lower()})
        return self._out(raw)

    def update(self, user_id: str, patch: dict[str, Any]) -> Optional[dict]:
        from bson import ObjectId

        try:
            raw = self._col.find_one_and_update(
                {"_id": ObjectId(user_id)},
                {"$set": patch},
                return_document=True,  # AFTER
            )
        except Exception:
            return None
        return self._out(raw)

    def list_all(self, limit: int = 100) -> list[dict]:
        return [self._out(d) for d in self._col.find({}, {"_id": 1, "email": 1, "full_name": 1, "role": 1}).limit(limit)]


# ── Singleton factory ────────────────────────────────────────────────────────

def _build_users_repo():
    from .config import MONGODB_DB, MONGODB_URI

    if MONGODB_URI:
        try:
            repo = MongoUsersRepository(MONGODB_URI, MONGODB_DB)
            logger.info("Users: MongoDB (%s.users)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB users init failed (%s); using in-memory fallback.", exc)
    else:
        logger.warning("MONGODB_URI not set — users stored in memory (lost on restart).")
    return InMemoryUsersRepository()


users_repository = _build_users_repo()
