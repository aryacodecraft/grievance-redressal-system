"""Notification persistence — in-app v1, no email/SMS."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("grievance-api")


class InMemoryNotificationRepository:
    def __init__(self) -> None:
        self._data: list[dict] = []

    def ensure_indexes(self) -> None:
        pass

    def create(self, doc: dict[str, Any]) -> str:
        record = dict(doc)
        record.setdefault("_id", str(uuid.uuid4()))
        record.setdefault("id", record["_id"])
        record.setdefault("isRead", False)
        record.setdefault("at", datetime.now(timezone.utc).isoformat())
        self._data.append(record)
        return record["id"]

    def list_for_user(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
        res = [dict(n) for n in reversed(self._data) if n.get("userId") == user_id]
        if unread_only:
            res = [n for n in res if not n.get("isRead")]
        return res[:limit]

    def mark_read(self, notif_id: str, user_id: str) -> bool:
        for n in self._data:
            if n.get("id") == notif_id and n.get("userId") == user_id:
                n["isRead"] = True
                return True
        return False

    def mark_all_read(self, user_id: str) -> bool:
        modified = False
        for n in self._data:
            if n.get("userId") == user_id and not n.get("isRead"):
                n["isRead"] = True
                modified = True
        return modified


class MongoNotificationRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["notifications"]

    def ensure_indexes(self) -> None:
        from pymongo import ASCENDING, DESCENDING
        self._col.create_index(
            [("userId", ASCENDING), ("isRead", ASCENDING), ("at", DESCENDING)],
            name="notif_user_read_at",
        )

    def create(self, doc: dict[str, Any]) -> str:
        record = dict(doc)
        record.setdefault("isRead", False)
        record.setdefault("at", datetime.now(timezone.utc).isoformat())
        result = self._col.insert_one(record)
        return str(result.inserted_id)

    def list_for_user(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
        query: dict = {"userId": user_id}
        if unread_only:
            query["isRead"] = False
        cursor = self._col.find(query).sort("at", -1).limit(max(1, min(limit, 100)))
        return [{**{key: value for key, value in row.items() if key != "_id"}, "id": str(row["_id"])} for row in cursor]

    def mark_read(self, notif_id: str, user_id: str) -> bool:
        from bson import ObjectId
        try:
            res = self._col.update_one(
                {"_id": ObjectId(notif_id), "userId": user_id},
                {"$set": {"isRead": True}},
            )
            return res.modified_count > 0
        except Exception:
            return False

    def mark_all_read(self, user_id: str) -> bool:
        res = self._col.update_many(
            {"userId": user_id, "isRead": False},
            {"$set": {"isRead": True}},
        )
        return res.modified_count > 0


def _build_notif_repo():
    from ..config import MONGODB_URI, MONGODB_DB
    if MONGODB_URI:
        try:
            repo = MongoNotificationRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes()
            logger.info("Notifications: MongoDB (%s.notifications)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB notifications init failed (%s); using in-memory.", exc)
    else:
        logger.warning("MONGODB_URI not set — notifications stored in memory.")
    return InMemoryNotificationRepository()


notif_repository = _build_notif_repo()
