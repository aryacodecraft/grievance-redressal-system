"""Department collection persistence — Mongo + in-memory fallback."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("grievance-api")


class InMemoryDepartmentRepository:
    def __init__(self) -> None:
        self._data: dict[str, dict] = {}

    def ensure_indexes(self) -> None:
        pass

    def create(self, doc: dict[str, Any]) -> str:
        dept_id = str(uuid.uuid4())
        record = {**doc, "_id": dept_id, "id": dept_id, "createdAt": datetime.now(timezone.utc).isoformat()}
        self._data[dept_id] = record
        return dept_id

    def get(self, dept_id: str) -> Optional[dict]:
        d = self._data.get(dept_id)
        return dict(d) if d else None

    def get_by_key(self, key: str) -> Optional[dict]:
        for d in self._data.values():
            if d.get("key") == key:
                return dict(d)
        return None

    def list(self) -> list[dict]:
        return [dict(d) for d in self._data.values() if d.get("isActive", True)]

    def update(self, dept_id: str, updates: dict[str, Any]) -> Optional[dict]:
        d = self._data.get(dept_id)
        if d is None:
            return None
        d.update(updates)
        return dict(d)

    def delete(self, dept_id: str) -> bool:
        d = self._data.get(dept_id)
        if d:
            d["isActive"] = False
            return True
        return False


class MongoDepartmentRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["departments"]

    def ensure_indexes(self) -> None:
        self._col.create_index("key", unique=True, name="uniq_dept_key")

    @staticmethod
    def _out(raw: dict | None) -> Optional[dict]:
        if raw is None:
            return None
        doc = {k: v for k, v in raw.items() if k != "_id"}
        doc["id"] = str(raw["_id"])
        return doc

    def create(self, doc: dict[str, Any]) -> str:
        from bson import ObjectId
        record = {**doc, "createdAt": datetime.now(timezone.utc)}
        result = self._col.insert_one(record)
        return str(result.inserted_id)

    def get(self, dept_id: str) -> Optional[dict]:
        from bson import ObjectId
        try:
            raw = self._col.find_one({"_id": ObjectId(dept_id)})
        except Exception:
            raw = self._col.find_one({"id": dept_id})
        return self._out(raw)

    def get_by_key(self, key: str) -> Optional[dict]:
        return self._out(self._col.find_one({"key": key}))

    def list(self) -> list[dict]:
        return [self._out(d) for d in self._col.find({"isActive": {"$ne": False}})]

    def update(self, dept_id: str, updates: dict[str, Any]) -> Optional[dict]:
        from bson import ObjectId
        from pymongo import ReturnDocument
        try:
            raw = self._col.find_one_and_update(
                {"_id": ObjectId(dept_id)},
                {"$set": updates},
                return_document=ReturnDocument.AFTER,
            )
        except Exception:
            return None
        return self._out(raw)

    def delete(self, dept_id: str) -> bool:
        return bool(self.update(dept_id, {"isActive": False}))


def _build_dept_repo():
    from ..config import MONGODB_URI, MONGODB_DB
    if MONGODB_URI:
        try:
            repo = MongoDepartmentRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes()
            logger.info("Departments: MongoDB (%s.departments)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB departments init failed (%s); using in-memory.", exc)
    else:
        logger.warning("MONGODB_URI not set — departments stored in memory.")
    return InMemoryDepartmentRepository()


dept_repository = _build_dept_repo()
