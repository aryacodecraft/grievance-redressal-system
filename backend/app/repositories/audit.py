"""Audit log persistence — append-only, no update API."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("grievance-api")


class InMemoryAuditRepository:
    def __init__(self) -> None:
        self._data: list[dict] = []

    def ensure_indexes(self) -> None:
        pass

    def append(self, entry: dict[str, Any]) -> dict:
        record = dict(entry)
        record.setdefault("_id", str(uuid.uuid4()))
        record.setdefault("at", datetime.now(timezone.utc).isoformat())
        self._data.append(record)
        return record

    def list(self, entity_id: Optional[str] = None, actor_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        res = list(reversed(self._data))
        if entity_id:
            res = [r for r in res if r.get("entityId") == entity_id]
        if actor_id:
            res = [r for r in res if r.get("actorId") == actor_id]
        return res[:limit]


class MongoAuditRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["audit_logs"]

    def ensure_indexes(self) -> None:
        from pymongo import ASCENDING, DESCENDING
        self._col.create_index([("entityId", ASCENDING), ("at", DESCENDING)], name="audit_entity_at")
        self._col.create_index([("actorId", ASCENDING), ("at", DESCENDING)], name="audit_actor_at")

    def append(self, entry: dict[str, Any]) -> dict:
        record = dict(entry)
        record.setdefault("at", datetime.now(timezone.utc).isoformat())
        self._col.insert_one(record)
        record.pop("_id", None)
        return record

    def list(self, entity_id: Optional[str] = None, actor_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        query: dict = {}
        if entity_id:
            query["entityId"] = entity_id
        if actor_id:
            query["actorId"] = actor_id
        cursor = self._col.find(query, {"_id": 0}).sort("at", -1).limit(limit)
        return list(cursor)


def _build_audit_repo():
    from ..config import MONGODB_URI, MONGODB_DB
    if MONGODB_URI:
        try:
            repo = MongoAuditRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes()
            logger.info("Audit logs: MongoDB (%s.audit_logs)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB audit init failed (%s); using in-memory.", exc)
    else:
        logger.warning("MONGODB_URI not set — audit logs stored in memory.")
    return InMemoryAuditRepository()


audit_repository = _build_audit_repo()
