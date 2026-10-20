"""Tests for /admin/analytics/* endpoints (DEC-054).

Covers:
- RBAC permissions (unauthenticated -> 401, citizen -> 403, superadmin/admin -> 200)
- Scoping (SUPERADMIN sees all, ADMIN sees dept-scoped)
- Metrics calculation (trends, departments, resolution, aging, priorities)
- Date range filtering
- Empty datasets & edge cases
- Citizen privacy / no PII exposure
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from backend.app.auth import create_access_token
from backend.app.db import repository


def _auth(role: str = "SUPERADMIN", dept_id: str | None = None, user_id: str = "admin-1"):
    token = create_access_token(
        user_id=user_id,
        role=role,
        email=f"{user_id}@example.com",
        department_id=dept_id,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _seed_grievances():
    """Seed test grievances into the in-memory repository."""
    # Clear in-memory docs for isolation if using InMemoryRepository
    if hasattr(repository, "_docs"):
        repository._docs.clear()

    now = datetime.now(timezone.utc)
    t_1d_ago = (now - timedelta(days=1)).isoformat()
    t_5d_ago = (now - timedelta(days=5)).isoformat()
    t_10d_ago = (now - timedelta(days=10)).isoformat()
    t_20d_ago = (now - timedelta(days=20)).isoformat()

    # 1. Roads complaint, resolved within SLA
    repository.create({
        "title": "Road pothole",
        "description": "Hazard on highway",
        "departmentId": "roads",
        "category": "roads",
        "priority": "high",
        "state": "RESOLVED",
        "status": "resolved",
        "createdAt": t_5d_ago,
        "resolvedAt": t_1d_ago,
        "dueDate": now.isoformat(),  # resolved before dueDate -> within SLA
        "userId": "citizen-1",
    })

    # 2. Roads complaint, open and overdue
    repository.create({
        "title": "Broken street light",
        "description": "Dark road junction",
        "departmentId": "roads",
        "category": "roads",
        "priority": "medium",
        "state": "IN_PROGRESS",
        "status": "in_progress",
        "createdAt": t_10d_ago,
        "dueDate": t_1d_ago,  # past due date -> overdue
        "userId": "citizen-2",
    })

    # 3. Water complaint, open, 1 day old (0-2 bucket)
    repository.create({
        "title": "Low water pressure",
        "description": "Sector 4 supply",
        "departmentId": "water",
        "category": "water",
        "priority": "low",
        "state": "SUBMITTED",
        "status": "open",
        "createdAt": t_1d_ago,
        "userId": "citizen-3",
    })

    # 4. Sanitation complaint, open, 20 days old (15+ bucket)
    repository.create({
        "title": "Garbage dump",
        "description": "Near market",
        "departmentId": "sanitation",
        "category": "sanitation",
        "priority": "urgent",
        "state": "ASSIGNED",
        "status": "assigned",
        "createdAt": t_20d_ago,
        "userId": "citizen-4",
    })


# ── RBAC / Permissions ────────────────────────────────────────────────────────

def test_analytics_requires_auth(client):
    endpoints = ["trends", "departments", "resolution", "aging", "priorities"]
    for ep in endpoints:
        res = client.get(f"/admin/analytics/{ep}")
        assert res.status_code == 401


def test_citizen_forbidden_from_analytics(client):
    headers = _auth(role="USER", user_id="citizen-1")
    endpoints = ["trends", "departments", "resolution", "aging", "priorities"]
    for ep in endpoints:
        res = client.get(f"/admin/analytics/{ep}", headers=headers)
        assert res.status_code == 403


# ── Trends Endpoint ──────────────────────────────────────────────────────────

def test_trends_superadmin_daily(client):
    res = client.get("/admin/analytics/trends?granularity=daily", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    assert body["granularity"] == "daily"
    assert isinstance(body["data"], list)
    total_received = sum(p["received"] for p in body["data"])
    total_resolved = sum(p["resolved"] for p in body["data"])
    assert total_received == 4
    assert total_resolved == 1


def test_trends_admin_dept_scoped(client):
    res = client.get(
        "/admin/analytics/trends?granularity=daily",
        headers=_auth(role="ADMIN", dept_id="water"),
    )
    assert res.status_code == 200
    body = res.json()
    total_received = sum(p["received"] for p in body["data"])
    # Water has only 1 complaint
    assert total_received == 1


def test_trends_weekly_monthly(client):
    for gran in ["weekly", "monthly"]:
        res = client.get(f"/admin/analytics/trends?granularity={gran}", headers=_auth())
        assert res.status_code == 200
        assert res.json()["granularity"] == gran


# ── Departments Endpoint ─────────────────────────────────────────────────────

def test_departments_counts(client):
    res = client.get("/admin/analytics/departments", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    assert "data" in body
    dept_map = {d["department"]: d for d in body["data"]}
    assert "roads" in dept_map
    assert dept_map["roads"]["received"] == 2
    assert dept_map["roads"]["resolved"] == 1
    assert dept_map["roads"]["open"] == 1
    assert dept_map["roads"]["overdue"] == 1

    assert "water" in dept_map
    assert dept_map["water"]["open"] == 1
    assert dept_map["water"]["overdue"] == 0


def test_departments_date_filtering(client):
    # Filter to only the last 3 days: should exclude complaints from 5, 10, 20 days ago
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
    res = client.get(f"/admin/analytics/departments?date_from={three_days_ago}", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    total_received = sum(d["received"] for d in body["data"])
    assert total_received == 1  # Only the water complaint (1 day ago)


# ── Resolution Endpoint ──────────────────────────────────────────────────────

def test_resolution_metrics(client):
    res = client.get("/admin/analytics/resolution", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    assert body["overall_mean_days"] is not None
    assert body["overall_median_days"] is not None
    assert body["overall_sla_compliance_pct"] == 100.0  # 1 complaint resolved within due date
    assert "SLA compliance counts only" in body["sla_note"]
    assert len(body["by_department"]) >= 1


# ── Aging Endpoint ───────────────────────────────────────────────────────────

def test_aging_buckets(client):
    res = client.get("/admin/analytics/aging", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    assert "reference_time" in body
    buckets = {b["label"]: b["count"] for b in body["buckets"]}
    # Resolved complaint (roads #1) must be excluded
    # Water (#3, 1d) -> "0–2 days"
    assert buckets["0–2 days"] == 1
    # Roads (#2, 10d) -> "8–14 days"
    assert buckets["8–14 days"] == 1
    # Sanitation (#4, 20d) -> "15+ days"
    assert buckets["15+ days"] == 1
    assert buckets["3–7 days"] == 0


# ── Priorities Endpoint ──────────────────────────────────────────────────────

def test_priorities_distribution(client):
    res = client.get("/admin/analytics/priorities", headers=_auth())
    assert res.status_code == 200
    body = res.json()
    assert "note" in body
    assert "Stored priority values" in body["note"] or "stored" in body["note"].lower()
    data = body["data"]
    assert len(data) >= 4
    # All stored priorities present
    priorities = {d["priority"] for d in data}
    assert "high" in priorities
    assert "medium" in priorities
    assert "low" in priorities
    assert "urgent" in priorities


# ── Privacy / No Citizen PII ─────────────────────────────────────────────────

def test_no_citizen_pii_in_analytics(client):
    endpoints = ["trends", "departments", "resolution", "aging", "priorities"]
    for ep in endpoints:
        res = client.get(f"/admin/analytics/{ep}", headers=_auth())
        text = res.text
        # Ensure no citizen ids, emails, or names are exposed in aggregate data
        assert "citizen-1" not in text
        assert "citizen-2" not in text
        assert "citizen@example.com" not in text
