"""Progress updates persistence."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("grievance-api")


class InMemoryProgressRepository:
    def __init__(self) -> None:
        self._data: list[dict] = []

    def ensure_indexes(self) -> None:
        pass

    def create(self, doc: dict[str, Any]) -> str:
        record = dict(doc)
        record.setdefault("_id", str(uuid.uuid4()))
        record.setdefault("id", record["_id"])
        record.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
        self._data.append(record)
        return record["id"]

    def list_for_grievance(
        self, grievance_id: str, visibility_filter: Optional[list[str]] = None
    ) -> list[dict]:
        res = [dict(d) for d in self._data if d.get("grievanceId") == grievance_id]
        if visibility_filter:
            res = [d for d in res if d.get("visibility") in visibility_filter]
        return res


class MongoProgressRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["progress_updates"]

    def ensure_indexes(self) -> None:
        from pymongo import ASCENDING, DESCENDING
        self._col.create_index(
            [("grievanceId", ASCENDING), ("createdAt", ASCENDING)],
            name="progress_grievance_at",
        )
        self._col.create_index(
            [("grievanceId", ASCENDING), ("visibility", ASCENDING)],
            name="progress_grievance_visibility",
        )

    def create(self, doc: dict[str, Any]) -> str:
        record = dict(doc)
        record.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
        result = self._col.insert_one(record)
        return str(result.inserted_id)

    def list_for_grievance(
        self, grievance_id: str, visibility_filter: Optional[list[str]] = None
    ) -> list[dict]:
        query: dict = {"grievanceId": grievance_id}
        if visibility_filter:
            query["visibility"] = {"$in": visibility_filter}
        return list(self._col.find(query, {"_id": 0}).sort("createdAt", 1))


def _build_progress_repo():
    from ..config import MONGODB_URI, MONGODB_DB
    if MONGODB_URI:
        try:
            repo = MongoProgressRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes()
            logger.info("Progress: MongoDB (%s.progress_updates)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB progress init failed (%s); using in-memory.", exc)
    else:
        logger.warning("MONGODB_URI not set — progress updates stored in memory.")
    return InMemoryProgressRepository()


progress_repository = _build_progress_repo()
