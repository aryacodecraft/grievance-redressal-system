"""Grievance persistence.

Two implementations of one interface:

* :class:`MongoRepository` — used when ``MONGODB_URI`` is set (MongoDB Atlas).
* :class:`InMemoryRepository` — process-local fallback so the API can boot and
  be exercised before any database is configured.

Routers only ever talk to the :class:`GrievanceRepository` protocol, so swapping
the implementation never touches them.
"""

from __future__ import annotations

import itertools
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

logger = logging.getLogger("grievance-api")

COLLECTION = "grievances"


class GrievanceRepository(Protocol):
    def create(self, doc: dict[str, Any]) -> str: ...

    def get(self, grievance_id: str) -> Optional[dict[str, Any]]: ...

    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]: ...

    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]: ...


def _new_id() -> str:
    return f"GRV-{datetime.now(timezone.utc).year}-{next(_counter):04d}"


_counter = itertools.count(1)


class InMemoryRepository:
    """Process-local fallback — no external dependency, resets on restart."""

    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, doc: dict[str, Any]) -> str:
        with self._lock:
            grievance_id = _new_id()
            record = dict(doc)
            record.setdefault(
                "createdAt", datetime.now(timezone.utc).isoformat()
            )
            record["id"] = grievance_id
            self._docs[grievance_id] = record
            return grievance_id

    def get(self, grievance_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            doc = self._docs.get(grievance_id)
            return dict(doc) if doc else None

    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        with self._lock:
            docs = list(self._docs.values())

        if user_id:
            docs = [d for d in docs if d.get("userId") == user_id]

        weight = {"high": 3, "medium": 2, "low": 1}
        docs.sort(
            key=lambda d: (
                d.get("createdAt") or "",
                weight.get(str(d.get("priority", "low")).lower(), 1),
                d.get("id", ""),
            ),
            reverse=True,
        )
        return [dict(d) for d in docs[:limit]]

    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        with self._lock:
            doc = self._docs.get(grievance_id)
            if doc is None:
                return None
            doc.update({k: v for k, v in patch.items() if v is not None})
            return dict(doc)


class MongoRepository:
    """MongoDB-backed implementation (Atlas in production)."""

    def __init__(self, uri: str, db_name: str, timeout_ms: int = 8000) -> None:
        from pymongo import MongoClient

        self._client = MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
        )
        self._db = self._client[db_name]
        self._col = self._db[COLLECTION]

    def ensure_indexes(self) -> None:
        """Unique grievance id + the userId/createdAt lookup compound."""
        from pymongo import ASCENDING, DESCENDING

        self._col.create_index("id", unique=True, name="uniq_grievance_id")
        self._col.create_index(
            [(("userId"), ASCENDING), (("createdAt"), DESCENDING)],
            name="user_created",
        )

    def ping(self) -> bool:
        try:
            self._client.admin.command("ping")
            return True
        except Exception:
            return False

    @staticmethod
    def _to_storage(doc: dict[str, Any]) -> dict[str, Any]:
        out = dict(doc)
        created = out.get("createdAt")
        if isinstance(created, str):
            try:
                out["createdAt"] = datetime.fromisoformat(created)
            except ValueError:
                pass
        return out

    @staticmethod
    def _from_storage(doc: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in doc.items() if k != "_id"}
        created = out.get("createdAt")
        if isinstance(created, datetime):
            out["createdAt"] = created.astimezone(timezone.utc).isoformat()
        return out

    def create(self, doc: dict[str, Any]) -> str:
        grievance_id = _new_id()
        record = self._to_storage(doc)
        record.setdefault("createdAt", datetime.now(timezone.utc))
        if isinstance(record["createdAt"], str):
            record["createdAt"] = datetime.fromisoformat(record["createdAt"])
        record["id"] = grievance_id
        self._col.insert_one(record)
        return grievance_id

    def get(self, grievance_id: str) -> Optional[dict[str, Any]]:
        doc = self._col.find_one({"id": grievance_id}, {"_id": 0})
        return self._from_storage(doc) if doc else None

    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"userId": user_id} if user_id else {}
        cursor = (
            self._col.find(query, {"_id": 0})
            .sort([("createdAt", -1), ("id", -1)])
            .limit(limit)
        )
        return [self._from_storage(doc) for doc in cursor]

    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        from pymongo import ReturnDocument

        doc = self._col.find_one_and_update(
            {"id": grievance_id},
            {"$set": {k: v for k, v in patch.items() if v is not None}},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )
        return self._from_storage(doc) if doc else None


_storage_mode = "in-memory"


def _build_repository() -> GrievanceRepository:
    from .config import MONGODB_DB, MONGODB_URI

    global _storage_mode

    if not MONGODB_URI:
        logger.warning(
            "MONGODB_URI not set — using in-memory storage. Data will be lost "
            "on restart; set MONGODB_URI to use MongoDB Atlas."
        )
        _storage_mode = "in-memory"
        return InMemoryRepository()

    repo = MongoRepository(MONGODB_URI, MONGODB_DB)
    try:
        repo.ensure_indexes()
        if repo.ping():
            _storage_mode = "mongodb"
            logger.info("Storage: MongoDB (%s)", MONGODB_DB)
        else:
            logger.error(
                "MongoDB is configured but not reachable — requests will fail "
                "until the cluster is reachable."
            )
    except Exception:
        logger.exception("MongoDB index/ping failed at startup")
    return repo


repository: GrievanceRepository = _build_repository()


def storage_mode() -> str:
    return _storage_mode


def to_api(doc: dict[str, Any]) -> dict[str, Any]:
    """Normalise a stored record to the shape the frontend zod schema expects.

    Optional fields are omitted entirely rather than sent as `null`, so plain
    `z.string().optional()` style schemas validate cleanly.
    """
    created = doc.get("createdAt")
    if isinstance(created, datetime):
        created = created.astimezone(timezone.utc).isoformat()

    hf = doc.get("hfEngine") or {}
    payload: dict[str, Any] = {
        "id": doc.get("id", ""),
        "title": doc.get("title", "Untitled"),
        "description": doc.get("description", ""),
        "status": doc.get("status", "open"),
        "category": doc.get("category") or hf.get("category") or "other",
        "priority": doc.get("priority") or hf.get("priority") or "low",
        "createdAt": created or datetime.now(timezone.utc).isoformat(),
    }

    for key in (
        "userId",
        "imageUrl",
        "imageValidation",
        "latitude",
        "longitude",
        "assignee",
    ):
        value = doc.get(key)
        if value is not None:
            payload[key] = value

    if hf:
        payload["hfEngine"] = hf

    return payload
