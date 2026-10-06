"""SLA config persistence with default seeds."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("grievance-api")

_DEFAULTS = {"high": 3, "medium": 7, "low": 14, "critical": 1}


class InMemorySlaConfigRepository:
    def __init__(self) -> None:
        # (category, priority) → days; "any" is the catch-all category
        self._data: dict[tuple[str, str], int] = {
            ("any", "critical"): 1,
            ("any", "high"): 3,
            ("any", "medium"): 7,
            ("any", "low"): 14,
        }

    def ensure_indexes_and_seed(self) -> None:
        pass

    def get_days(self, category: str, priority: str) -> int:
        key = (category.lower(), priority.lower())
        if key in self._data:
            return self._data[key]
        fallback = ("any", priority.lower())
        if fallback in self._data:
            return self._data[fallback]
        return _DEFAULTS.get(priority.lower(), 7)

    def upsert(self, category: str, priority: str, days: int) -> None:
        self._data[(category.lower(), priority.lower())] = days


class MongoSlaConfigRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient
        self._col = MongoClient(uri)[db_name]["sla_config"]

    def ensure_indexes_and_seed(self) -> None:
        from pymongo import ASCENDING
        self._col.create_index(
            [("category", ASCENDING), ("priority", ASCENDING)],
            unique=True,
            name="sla_cat_pri",
        )
        # Seed defaults if collection is empty
        if self._col.count_documents({}) == 0:
            self._col.insert_many([
                {"category": "any", "priority": "critical", "days": 1},
                {"category": "any", "priority": "high", "days": 3},
                {"category": "any", "priority": "medium", "days": 7},
                {"category": "any", "priority": "low", "days": 14},
            ])
            logger.info("SLA config seeded with defaults")

    def get_days(self, category: str, priority: str) -> int:
        doc = self._col.find_one({"category": category.lower(), "priority": priority.lower()})
        if doc:
            return int(doc["days"])
        doc = self._col.find_one({"category": "any", "priority": priority.lower()})
        if doc:
            return int(doc["days"])
        return _DEFAULTS.get(priority.lower(), 7)

    def upsert(self, category: str, priority: str, days: int) -> None:
        self._col.update_one(
            {"category": category.lower(), "priority": priority.lower()},
            {"$set": {"days": days}},
            upsert=True,
        )


def _build_sla_repo():
    from ..config import MONGODB_URI, MONGODB_DB
    if MONGODB_URI:
        try:
            repo = MongoSlaConfigRepository(MONGODB_URI, MONGODB_DB)
            repo.ensure_indexes_and_seed()
            logger.info("SLA config: MongoDB (%s.sla_config)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB SLA config init failed (%s); using in-memory.", exc)
    else:
        logger.warning("MONGODB_URI not set — SLA config stored in memory.")
    return InMemorySlaConfigRepository()


sla_repository = _build_sla_repo()
