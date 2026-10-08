"""Seed realistic, idempotent demo grievances for local evaluation.

Run from the repository root with ``python -m backend.seed_demo_data``.
The records are written through the same repository abstraction as the API,
so the command works with MongoDB Atlas or the in-memory fallback.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from .app.db import repository


DEMO_USER_ID = "demo-citizen"
IMAGE_BASE = os.getenv("DEMO_IMAGE_BASE_URL", "http://localhost:3000/demo-assets").rstrip("/")

DEMO_GRIEVANCES = (
    ("water", "Low pressure and leaking pipeline near Indiranagar 12th Main", "Residents have had low water pressure every morning for the past two weeks. A public supply pipe is also leaking continuously beside 12th Main Road near the community park.", "Bengaluru, Karnataka", 12.9784, 77.6408, "high"),
    ("roads", "Deep pothole on Baner Road near Balewadi crossing", "A deep pothole has opened in the left lane after recent rain. Two-wheelers are swerving into traffic, and the damaged section is growing each day.", "Pune, Maharashtra", 18.5590, 73.7790, "high"),
    ("transport", "Damaged bus shelter at Andheri East station", "The shelter roof is broken and does not protect commuters during rain. The seating is unsafe and the stop becomes congested during the evening peak.", "Mumbai, Maharashtra", 19.1197, 72.8468, "medium"),
    ("electricity", "Exposed low-hanging cable on Vivekananda Road", "An electrical cable is hanging unusually low across the lane outside the market. It is within reach of pedestrians and is especially dangerous during rain.", "New Delhi, Delhi", 28.6519, 77.2219, "high"),
    ("sanitation", "Overflowing waste collection point in Anna Nagar", "The collection point has not been cleared for several days. Waste is spilling onto the footpath, creating a strong smell and attracting stray animals.", "Chennai, Tamil Nadu", 13.0850, 80.2101, "medium"),
    ("health", "Broken access ramp at Ward 14 primary health centre", "The entrance ramp is cracked and difficult to use with a wheelchair or stretcher. Patients are being asked to use the steps instead.", "Kolkata, West Bengal", 22.5726, 88.3639, "high"),
    ("governance", "Delayed birth-certificate correction at civic office", "A correction request submitted three weeks ago has not moved beyond document verification. The applicant has made two visits but has not received a clear status update.", "Ahmedabad, Gujarat", 23.0225, 72.5714, "medium"),
    ("other", "Broken footpath and open drain near Jawahar Circle", "The footpath is unusable for several metres because paving slabs are missing and an open drain is exposed. This is affecting pedestrians and schoolchildren.", "Jaipur, Rajasthan", 26.8467, 75.8056, "medium"),
)


def seed_demo_data() -> dict[str, int]:
    existing = repository.list(limit=1000)
    existing_keys = {row.get("demoDataKey") for row in existing}
    created = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for index, (category, title, description, city, lat, lon, priority) in enumerate(DEMO_GRIEVANCES):
        key = f"demo-{category}"
        if key in existing_keys:
            skipped += 1
            continue
        created_at = (now - timedelta(days=3 * index + 1)).isoformat()
        hf_engine = {
            "category": category,
            "priority": priority,
            "isUrgent": priority == "high",
            "keywords": [category, city.split(",")[0].lower(), "public service"],
            "explanation": f"Demo record prepared for {city}; category and priority are curated for UI testing.",
            "rawCategoryLabel": category,
            "categoryConfidence": 0.96,
            "urgentMatches": ["unsafe", "dangerous"] if priority == "high" else [],
            "modelInfo": {"source": "demo-seed", "humanReviewed": True},
        }
        repository.create({
            "demoDataKey": key,
            "title": title,
            "description": description,
            "userId": DEMO_USER_ID,
            "status": "open",
            "state": "PENDING_ASSIGNMENT",
            "category": category,
            "priority": priority,
            "createdAt": created_at,
            "imageUrl": f"{IMAGE_BASE}/{category}.png",
            "imageValidation": {"ok": True, "explanation": "Bundled demo attachment."},
            "latitude": lat,
            "longitude": lon,
            "departmentId": category,
            "hfEngine": hf_engine,
        })
        created += 1
    return {"created": created, "skipped": skipped}


if __name__ == "__main__":
    print(seed_demo_data())
