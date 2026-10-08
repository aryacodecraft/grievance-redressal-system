import re

with open("backend/app/db.py", "r") as f:
    content = f.read()

# InMemoryRepository.list
content = content.replace(
"""    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        with self._lock:
            docs = list(self._docs.values())

        if user_id:
            docs = [d for d in docs if d.get("userId") == user_id]""",
"""    def list(
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
            docs = [d for d in docs if d.get("dueDate") and d["dueDate"] < now_str and d.get("state") not in ("CLOSED", "RESOLVED", "REJECTED", "WITHDRAWN")]"""
)

# InMemoryRepository.update -> append_history
content = content.replace(
"""    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        with self._lock:
            doc = self._docs.get(grievance_id)
            if doc is None:
                return None
            doc.update({k: v for k, v in patch.items() if v is not None})
            return dict(doc)""",
"""    def update(
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
                doc[history_key].append(entry)"""
)

# MongoRepository.list
content = content.replace(
"""    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        # See InMemoryRepository.list: `limit <= 0` must mean "no rows", but
        # pymongo treats `.limit(0)` as *unlimited* and `.limit(-n)` as "take
        # n and stop", so the guard has to happen before the cursor is built.
        if limit <= 0:
            return []

        query: dict[str, Any] = {"userId": user_id} if user_id else {}""",
"""    def list(
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
            query["state"] = {"$nin": ["CLOSED", "RESOLVED", "REJECTED", "WITHDRAWN"]}"""
)

# MongoRepository.append_history
content = content.replace(
"""    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        from pymongo import ReturnDocument

        doc = self._col.find_one_and_update(
            {"id": grievance_id},
            {"$set": {k: v for k, v in patch.items() if v is not None}},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )
        return self._from_storage(doc) if doc else None""",
"""    def update(
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
        self._col.update_one({"id": grievance_id}, {"$push": {history_key: entry}})"""
)


# to_api update
content = content.replace(
"""    hf = doc.get("hfEngine") or {}
    payload: dict[str, Any] = {
        "id": doc.get("id", ""),
        "title": doc.get("title", "Untitled"),
        "description": doc.get("description", ""),
        "status": doc.get("status", "open"),
        "category": doc.get("category") or hf.get("category") or "other",
        "priority": doc.get("priority") or hf.get("priority") or "low",
        "createdAt": created or datetime.now(timezone.utc).isoformat(),
    }""",
"""    hf = doc.get("hfEngine") or {}
    
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
    
    for key in ("departmentId", "ownerId", "managerId", "dueDate", "resolvedAt", "closedAt", "stateHistory", "assignmentHistory", "priorityHistory", "deadlineHistory"):
        val = doc.get(key)
        if val is not None:
            payload[key] = val
"""
)

with open("backend/app/db.py", "w") as f:
    f.write(content)
