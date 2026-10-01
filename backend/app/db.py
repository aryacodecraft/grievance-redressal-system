"""Grievance persistence.

Phase 2 ships an in-process repository so every endpoint works end-to-end
without any external service. Phase 3 implements the same interface on top of
MongoDB and swaps it in below — no router changes required.
"""

from __future__ import annotations

import itertools
import threading
from datetime import datetime, timezone
from typing import Any, Optional, Protocol


class GrievanceRepository(Protocol):
    def create(self, doc: dict[str, Any]) -> str: ...

    def get(self, grievance_id: str) -> Optional[dict[str, Any]]: ...

    def list(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> list[dict[str, Any]]: ...

    def update(
        self, grievance_id: str, patch: dict[str, Any]
    ) -> Optional[dict[str, Any]]: ...


class InMemoryRepository:
    """Phase 2 placeholder — deterministic, dependency-free, process-local."""

    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._seq = itertools.count(1)

    def create(self, doc: dict[str, Any]) -> str:
        with self._lock:
            year = datetime.now(timezone.utc).year
            grievance_id = f"GRV-{year}-{next(self._seq):04d}"
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

        # createdAt desc, then priority weight, then id desc (parity with legacy)
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


repository: GrievanceRepository = InMemoryRepository()


def to_api(doc: dict[str, Any]) -> dict[str, Any]:
    """Normalise a stored record to the shape the frontend zod schema expects.

    Optional fields are omitted entirely rather than sent as `null`, so plain
    `z.string().optional()` style schemas validate cleanly.
    """
    hf = doc.get("hfEngine") or {}
    payload: dict[str, Any] = {
        "id": doc.get("id", ""),
        "title": doc.get("title", "Untitled"),
        "description": doc.get("description", ""),
        "status": doc.get("status", "open"),
        "category": doc.get("category") or hf.get("category") or "other",
        "priority": doc.get("priority") or hf.get("priority") or "low",
        "createdAt": doc.get("createdAt")
        or datetime.now(timezone.utc).isoformat(),
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
