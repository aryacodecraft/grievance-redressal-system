"""Grievance persistence.

Two implementations of one interface:

* :class:`MongoRepository` — used when ``MONGODB_URI`` is set (MongoDB Atlas).
* :class:`InMemoryRepository` — process-local fallback so the API can boot and
  be exercised before any database is configured.

Routers only ever talk to the :class:`GrievanceRepository` protocol, so swapping
the implementation never touches them.
"""

from __future__ import annotations

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
        self, user_id: Optional[str] = None, limit: int = 50,
        state: Optional[str] = None, dept_id: Optional[str] = None,
        owner_id: Optional[str] = None, overdue: bool = False,
    ) -> list[dict[str, Any]]: ...

    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]: ...

    def append_history(self, grievance_id: str, history_key: str, entry: dict[str, Any]) -> None: ...


def _id_for(year: int, seq: int) -> str:
    return f"GRV-{year}-{seq:04d}"


def _sequence_of(grievance_id: str) -> Optional[int]:
    """Numeric tail of ``GRV-2026-0007`` -> ``7``; ``None`` if unparseable."""
    try:
        return int(grievance_id.rsplit("-", 1)[1])
    except (IndexError, ValueError):
        return None


class InMemoryRepository:
    """Process-local fallback — no external dependency, resets on restart."""

    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, doc: dict[str, Any]) -> str:
        with self._lock:
            # Derived from stored ids rather than a shared counter, so a
            # freshly constructed repo holding pre-existing ids never
            # re-issues one (the failure mode that made _new_id() 500 after
            # a restart against MongoDB).
            year = datetime.now(timezone.utc).year
            prefix = f"GRV-{year}-"
            seq = 1
            for existing in self._docs:
                if existing.startswith(prefix):
                    seen = _sequence_of(existing)
                    if seen is not None:
                        seq = max(seq, seen + 1)

            grievance_id = _id_for(year, seq)
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
        self, user_id: Optional[str] = None, limit: int = 50,
        state: Optional[str] = None, dept_id: Optional[str] = None,
        owner_id: Optional[str] = None, overdue: bool = False,
    ) -> list[dict[str, Any]]:
        with self._lock:
            docs = list(self._docs.values())

        if user_id:
            docs = [d for d in docs if d.get("userId") == user_id]
        if state:
            docs = [d for d in docs if (d.get("state") == state or d.get("status") == (state.lower() if state else ""))]
        if dept_id:
            docs = [d for d in docs if d.get("departmentId") == dept_id]
        if owner_id:
            docs = [d for d in docs if d.get("ownerId") == owner_id]
        if overdue:
            from datetime import datetime, timezone
            now_str = datetime.now(timezone.utc).isoformat()
            docs = [d for d in docs if d.get("dueDate") and d["dueDate"] < now_str and d.get("state") not in ("CLOSED", "RESOLVED", "REJECTED", "WITHDRAWN")]

        # Ordering must match MongoRepository exactly (it is the production
        # path, DEC-011): `(createdAt, id)` descending. A priority tie-break
        # was removed here because Mongo never applied one, so dev and Atlas
        # disagreed about which record came first.
        #
        # `limit <= 0` returns nothing rather than everything: a Python slice
        # `docs[:0]` is empty, but pymongo reads `.limit(0)` as "no limit" —
        # the same call returned 0 rows on one store and the whole collection
        # on the other. The API rejects `limit < 1` before it gets here.
        if limit <= 0:
            return []

        docs.sort(
            key=lambda d: (d.get("createdAt") or "", d.get("id", "")),
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

    def append_history(self, grievance_id: str, history_key: str, entry: dict[str, Any]) -> None:
        with self._lock:
            doc = self._docs.get(grievance_id)
            if doc is not None:
                if history_key not in doc:
                    doc[history_key] = []
                doc[history_key].append(entry)


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
        self._col.create_index([("departmentId", ASCENDING), ("state", ASCENDING), ("dueDate", ASCENDING)], name="dept_state_due")
        self._col.create_index([("ownerId", ASCENDING), ("state", ASCENDING)], name="owner_state")
        self._col.create_index([("state", ASCENDING), ("dueDate", ASCENDING)], name="state_due")

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

    def _next_sequence(self) -> int:
        """Next free id tail for the current UTC year, read from stored ids.

        Deriving this from the data (instead of an in-process counter) is what
        keeps a restart from replaying ``GRV-<year>-0001`` and tripping the
        unique index. The prefix bounds the lookup, so the sort rides the
        ``uniq_grievance_id`` index instead of scanning the collection.
        """
        prefix = f"GRV-{datetime.now(timezone.utc).year}-"
        doc = self._col.find_one(
            {"id": {"$gte": prefix}},
            {"_id": 0, "id": 1},
            sort=[("id", -1)],
        )
        if doc is None:
            return 1
        seen = _sequence_of(str(doc.get("id", "")))
        return (seen + 1) if seen is not None else 1

    def create(self, doc: dict[str, Any]) -> str:
        from pymongo.errors import DuplicateKeyError

        record = self._to_storage(doc)
        record.setdefault("createdAt", datetime.now(timezone.utc))
        if isinstance(record["createdAt"], str):
            record["createdAt"] = datetime.fromisoformat(record["createdAt"])

        seq = self._next_sequence()
        for _ in range(100):
            grievance_id = _id_for(datetime.now(timezone.utc).year, seq)
            record["id"] = grievance_id
            try:
                self._col.insert_one(record)
                return grievance_id
            except DuplicateKeyError:
                # Concurrent writer took this number — try the next one.
                record.pop("_id", None)
                seq += 1
        raise RuntimeError("could not allocate a unique grievance id")

    def get(self, grievance_id: str) -> Optional[dict[str, Any]]:
        doc = self._col.find_one({"id": grievance_id}, {"_id": 0})
        return self._from_storage(doc) if doc else None

    def list(
        self, user_id: Optional[str] = None, limit: int = 50,
        state: Optional[str] = None, dept_id: Optional[str] = None,
        owner_id: Optional[str] = None, overdue: bool = False,
    ) -> list[dict[str, Any]]:
        # See InMemoryRepository.list: `limit <= 0` must mean "no rows", but
        # pymongo treats `.limit(0)` as *unlimited* and `.limit(-n)` as "take
        # n and stop", so the guard has to happen before the cursor is built.
        if limit <= 0:
            return []

        query: dict[str, Any] = {"userId": user_id} if user_id else {}
        if state: query["state"] = state
        if dept_id: query["departmentId"] = dept_id
        if owner_id: query["ownerId"] = owner_id
        if overdue:
            from datetime import datetime, timezone
            query["dueDate"] = {"$lt": datetime.now(timezone.utc).isoformat()}
            query["state"] = {"$nin": ["CLOSED", "RESOLVED", "REJECTED", "WITHDRAWN"]}
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

    def append_history(self, grievance_id: str, history_key: str, entry: dict[str, Any]) -> None:
        self._col.update_one({"id": grievance_id}, {"$push": {history_key: entry}})


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
    # Set eagerly, not on ping success. It used to be assigned only after a
    # successful ping, so a cluster that was down at boot left health reporting
    # "in-memory" while `repository` above was already a MongoRepository — every
    # request went to MongoDB and /health denied it was in use. `storage_mode()`
    # describes what is *configured*; reachability is a separate question (and
    # one /health deliberately does not answer — see its test).
    _storage_mode = "mongodb"
    try:
        repo.ensure_indexes()
        if repo.ping():
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
    """Normalise a stored record to the shape the frontend zod schema expects."""
    created = doc.get("createdAt")
    if isinstance(created, datetime):
        created = created.astimezone(timezone.utc).isoformat()

    hf = doc.get("hfEngine") or {}
    
    _STATUS_COMPAT = {
        "open": "SUBMITTED", "assigned": "ASSIGNED", "in_progress": "IN_PROGRESS",
        "resolved": "RESOLVED", "closed": "CLOSED", "escalated": "ESCALATED",
        "rejected": "REJECTED",
    }
    raw_status = doc.get("status", "open")
    canonical_state = doc.get("state") or _STATUS_COMPAT.get(raw_status.lower(), raw_status.upper() if raw_status else "SUBMITTED")
    
    payload: dict[str, Any] = {
        "id": doc.get("id", ""),
        "title": doc.get("title", "Untitled"),
        "description": doc.get("description", ""),
        "status": canonical_state,
        "state": canonical_state,
        "category": doc.get("category") or hf.get("category") or "other",
        "priority": doc.get("priority") or hf.get("priority") or "low",
        "createdAt": created or datetime.now(timezone.utc).isoformat(),
    }

    for key in (
        "userId", "imageUrl", "imageValidation", "latitude", "longitude",
        "assignee",
        "departmentId", "ownerId", "managerId", "dueDate", "resolvedAt", "closedAt",
        "stateHistory", "assignmentHistory", "priorityHistory", "deadlineHistory"
    ):
        value = doc.get(key)
        if value is not None:
            payload[key] = value

    # Compatibility for records written before department routing was added.
    # Startup persists this value; this fallback keeps the API useful during
    # the short interval before a restart/backfill has run.
    if "departmentId" not in payload:
        payload["departmentId"] = payload["category"]

    if hf:
        payload["hfEngine"] = hf

    return payload
