"""Canonical department keys shared by routing, user management and queues."""

from __future__ import annotations

import re


_ALIASES = {
    "water": "water",
    "watersupply": "water",
    "watersupplyandsewerageboard": "water",
    "roads": "roads",
    "road": "roads",
    "transport": "roads",
    "transportation": "roads",
    "roadtransport": "roads",
    "roadsandtransport": "roads",
    "roadandtransport": "roads",
    "roadsinfrastructureauthority": "roads",
    "roadsandtransportauthority": "roads",
    "trafficandtransportoperations": "roads",
    "electricity": "electricity",
    "power": "electricity",
    "electricityandpowerdistribution": "electricity",
    "sanitation": "sanitation",
    "waste": "sanitation",
    "municipalsanitationandwaste": "sanitation",
    "health": "health",
    "publichealthandmedicalservices": "health",
    "governance": "governance",
    "civicgovernanceandcitizenservices": "governance",
    "other": "other",
    "generalurbanadministration": "other",
}


CANONICAL_DEPARTMENTS: tuple[tuple[str, str], ...] = (
    ("water", "Water Supply & Sewerage Board"),
    ("roads", "Roads & Transport Authority"),
    ("electricity", "Electricity & Power Distribution"),
    ("sanitation", "Municipal Sanitation & Waste"),
    ("health", "Public Health & Medical Services"),
    ("governance", "Civic Governance & Citizen Services"),
    ("other", "General Urban Administration"),
)


def canonical_department(value: str | None) -> str:
    """Normalize canonical keys and known display/legacy labels to one key."""
    key = re.sub(r"[^a-z0-9]", "", (value or "other").strip().lower())
    if "road" in key or "transport" in key:
        return "roads"
    return _ALIASES.get(key, key or "other")
