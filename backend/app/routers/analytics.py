"""Admin analytics endpoints — aggregation-based (no PII returned).

GET /admin/analytics/trends       complaint received/resolved over time
GET /admin/analytics/departments  received, open, resolved, overdue by dept
GET /admin/analytics/resolution   median/mean resolution time, SLA compliance
GET /admin/analytics/aging        unresolved complaints bucketed by age
GET /admin/analytics/priorities   priority × status distribution

Auth: require_permission("grievance.view_dept") — same as existing admin routes.
SUPERADMIN: all grievances; ADMIN with departmentId: dept-scoped.

MongoDB path: aggregation pipelines (no full-collection load into Python).
InMemory path: Python equivalents — same response shape, dev-only.
"""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..auth import get_current_user
from ..db import repository, storage_mode
from ..permissions import require_permission

logger = logging.getLogger("grievance-api")

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])

# ── Terminal states (excluded from "active/aging" counts) ─────────────────
_TERMINAL = {"RESOLVED", "CLOSED", "REJECTED", "WITHDRAWN"}


# ── Response models ──────────────────────────────────────────────────────────

class TrendsPoint(BaseModel):
    date: str          # YYYY-MM-DD (daily) | YYYY-Www (weekly) | YYYY-MM (monthly)
    received: int
    resolved: int


class TrendsResponse(BaseModel):
    granularity: str   # "daily" | "weekly" | "monthly"
    data: list[TrendsPoint]


class DeptStats(BaseModel):
    department: str
    received: int
    open: int
    resolved: int
    overdue: int


class DepartmentsResponse(BaseModel):
    data: list[DeptStats]


class ResolutionDeptStat(BaseModel):
    department: str
    count: int                      # number with resolvedAt
    mean_days: Optional[float]
    median_days: Optional[float]
    within_sla: Optional[int]       # count resolved within dueDate
    total_with_due: Optional[int]   # count that had a dueDate


class ResolutionResponse(BaseModel):
    overall_mean_days: Optional[float]
    overall_median_days: Optional[float]
    overall_sla_compliance_pct: Optional[float]   # None if no dueDate data
    sla_note: str
    by_department: list[ResolutionDeptStat]


class AgingBucket(BaseModel):
    label: str   # "0–2 days", "3–7 days", "8–14 days", "15+ days"
    days_min: int
    days_max: Optional[int]   # None means open-ended
    count: int


class AgingResponse(BaseModel):
    reference_time: str      # ISO UTC — the "now" used for all age calculations
    buckets: list[AgingBucket]


class PriorityStatusCell(BaseModel):
    priority: str
    status: str
    count: int


class PrioritiesResponse(BaseModel):
    data: list[PriorityStatusCell]
    note: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _truncate_date(dt: datetime, granularity: str) -> str:
    if granularity == "daily":
        return dt.strftime("%Y-%m-%d")
    elif granularity == "weekly":
        # ISO week: YYYY-Www
        return dt.strftime("%Y-W%W")
    else:  # monthly
        return dt.strftime("%Y-%m")


def _dept_scope(current: dict) -> Optional[str]:
    """Return departmentId for ADMIN scope; None means all departments."""
    role = current.get("role", "")
    if role == "SUPERADMIN":
        return None
    return current.get("departmentId") or None


def _as_dt(val) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.astimezone(timezone.utc) if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val)
            return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


# ── In-memory fallback helpers ───────────────────────────────────────────────

def _inmem_all(dept_scope: Optional[str]) -> list[dict]:
    """Load all grievances from the in-memory repo (dev only)."""
    docs = repository.list(limit=5000)
    if dept_scope:
        docs = [d for d in docs if (d.get("departmentId") or d.get("category", "")) == dept_scope]
    return docs


# ══════════════════════════════════════════════════════════════════════════════
#  1. Trends
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/trends", response_model=TrendsResponse)
def trends(
    current: Annotated[dict, Depends(require_permission("grievance.view_dept"))],
    granularity: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Complaints received and resolved over time."""
    dept_scope = _dept_scope(current)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    if storage_mode() == "mongodb":
        return _trends_mongo(granularity, dt_from, dt_to, dept_scope)
    return _trends_inmem(granularity, dt_from, dt_to, dept_scope)


def _trends_mongo(granularity: str, dt_from, dt_to, dept_scope) -> TrendsResponse:
    from ..db import MongoRepository  # type: ignore
    col = repository._col  # type: ignore

    # Date format string for $dateToString
    fmt = {"daily": "%Y-%m-%d", "weekly": "%Y-W%V", "monthly": "%Y-%m"}[granularity]

    match_base: dict = {}
    if dept_scope:
        match_base["departmentId"] = dept_scope
    if dt_from or dt_to:
        match_base["createdAt"] = {}
        if dt_from:
            match_base["createdAt"]["$gte"] = dt_from
        if dt_to:
            match_base["createdAt"]["$lte"] = dt_to

    # Received: group by truncated createdAt
    received_pipe = [
        {"$match": match_base},
        {"$group": {
            "_id": {"$dateToString": {"format": fmt, "date": "$createdAt", "timezone": "UTC"}},
            "count": {"$sum": 1},
        }},
    ]

    # Resolved: match resolvedAt in range, group by resolvedAt date
    resolved_match = {"resolvedAt": {"$exists": True, "$ne": None}}
    if dept_scope:
        resolved_match["departmentId"] = dept_scope
    if dt_from or dt_to:
        resolved_match["resolvedAt"] = {"$exists": True, "$ne": None}
        if dt_from:
            resolved_match.setdefault("resolvedAt", {})
            resolved_match["resolvedAt"]["$gte"] = dt_from.isoformat() if isinstance(dt_from, datetime) else dt_from
        if dt_to:
            resolved_match.setdefault("resolvedAt", {})
            resolved_match["resolvedAt"]["$lte"] = dt_to.isoformat() if isinstance(dt_to, datetime) else dt_to

    resolved_pipe = [
        {"$match": {"resolvedAt": {"$exists": True, "$ne": None}, **({"departmentId": dept_scope} if dept_scope else {})}},
        {"$addFields": {
            "resolvedDt": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$resolvedAt"}, "string"]},
                    "then": {"$dateFromString": {"dateString": "$resolvedAt", "onError": None}},
                    "else": "$resolvedAt",
                }
            }
        }},
        {"$match": {"resolvedDt": {"$ne": None}}},
        {"$group": {
            "_id": {"$dateToString": {"format": fmt, "date": "$resolvedDt", "timezone": "UTC"}},
            "count": {"$sum": 1},
        }},
    ]

    received_map = {r["_id"]: r["count"] for r in col.aggregate(received_pipe) if r["_id"]}
    resolved_map = {r["_id"]: r["count"] for r in col.aggregate(resolved_pipe) if r["_id"]}
    all_keys = sorted(set(received_map) | set(resolved_map))

    data = [
        TrendsPoint(date=k, received=received_map.get(k, 0), resolved=resolved_map.get(k, 0))
        for k in all_keys
    ]
    return TrendsResponse(granularity=granularity, data=data)


def _trends_inmem(granularity: str, dt_from, dt_to, dept_scope) -> TrendsResponse:
    docs = _inmem_all(dept_scope)
    received_map: dict[str, int] = {}
    resolved_map: dict[str, int] = {}

    for d in docs:
        created = _as_dt(d.get("createdAt"))
        if created:
            if dt_from and created < dt_from:
                continue
            if dt_to and created > dt_to:
                continue
            k = _truncate_date(created, granularity)
            received_map[k] = received_map.get(k, 0) + 1

        resolved_raw = d.get("resolvedAt")
        if resolved_raw:
            resolved = _as_dt(resolved_raw)
            if resolved:
                k2 = _truncate_date(resolved, granularity)
                resolved_map[k2] = resolved_map.get(k2, 0) + 1

    all_keys = sorted(set(received_map) | set(resolved_map))
    data = [
        TrendsPoint(date=k, received=received_map.get(k, 0), resolved=resolved_map.get(k, 0))
        for k in all_keys
    ]
    return TrendsResponse(granularity=granularity, data=data)


# ══════════════════════════════════════════════════════════════════════════════
#  2. Departments
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/departments", response_model=DepartmentsResponse)
def departments(
    current: Annotated[dict, Depends(require_permission("grievance.view_dept"))],
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Received, open, resolved, and overdue counts by department."""
    dept_scope = _dept_scope(current)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    if storage_mode() == "mongodb":
        return _departments_mongo(dt_from, dt_to, dept_scope)
    return _departments_inmem(dt_from, dt_to, dept_scope)


def _departments_mongo(dt_from, dt_to, dept_scope) -> DepartmentsResponse:
    col = repository._col  # type: ignore
    now = datetime.now(timezone.utc)

    match: dict = {}
    if dept_scope:
        match["departmentId"] = dept_scope
    if dt_from or dt_to:
        match["createdAt"] = {}
        if dt_from:
            match["createdAt"]["$gte"] = dt_from
        if dt_to:
            match["createdAt"]["$lte"] = dt_to

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$departmentId",
            "received": {"$sum": 1},
            "resolved": {"$sum": {"$cond": [{"$in": ["$state", list(_TERMINAL)]}, 1, 0]}},
            "open": {"$sum": {"$cond": [{"$not": [{"$in": ["$state", list(_TERMINAL)]}]}, 1, 0]}},
            # Overdue: dueDate < now AND not terminal
            "overdue": {"$sum": {
                "$cond": [
                    {"$and": [
                        {"$not": [{"$in": ["$state", list(_TERMINAL)]}]},
                        {"$lt": ["$dueDate", now.isoformat()]},
                        {"$ne": ["$dueDate", None]},
                    ]},
                    1, 0,
                ]
            }},
        }},
        {"$sort": {"received": -1}},
    ]

    data = [
        DeptStats(
            department=r["_id"] or "unknown",
            received=r["received"],
            open=r["open"],
            resolved=r["resolved"],
            overdue=r["overdue"],
        )
        for r in col.aggregate(pipeline)
    ]
    return DepartmentsResponse(data=data)


def _departments_inmem(dt_from, dt_to, dept_scope) -> DepartmentsResponse:
    docs = _inmem_all(dept_scope)
    now = datetime.now(timezone.utc)
    stats: dict[str, dict] = {}

    for d in docs:
        created = _as_dt(d.get("createdAt"))
        if created:
            if dt_from and created < dt_from:
                continue
            if dt_to and created > dt_to:
                continue

        dept = d.get("departmentId") or d.get("category", "unknown")
        if dept not in stats:
            stats[dept] = {"received": 0, "open": 0, "resolved": 0, "overdue": 0}
        s = stats[dept]
        s["received"] += 1
        state = (d.get("state") or "SUBMITTED").upper()
        if state in _TERMINAL:
            s["resolved"] += 1
        else:
            s["open"] += 1
            due = d.get("dueDate")
            if due:
                due_dt = _as_dt(due)
                if due_dt and due_dt < now:
                    s["overdue"] += 1

    data = [
        DeptStats(department=dept, **s)
        for dept, s in sorted(stats.items(), key=lambda x: -x[1]["received"])
    ]
    return DepartmentsResponse(data=data)


# ══════════════════════════════════════════════════════════════════════════════
#  3. Resolution time & SLA compliance
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/resolution", response_model=ResolutionResponse)
def resolution(
    current: Annotated[dict, Depends(require_permission("grievance.view_dept"))],
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Median/mean resolution time and SLA compliance by department.

    SLA compliance = resolved before dueDate / total resolved with a dueDate.
    NOTE: dueDate is only set at assignment time. Pre-assignment complaints
    have no dueDate and are excluded from SLA compliance calculations.
    """
    dept_scope = _dept_scope(current)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    if storage_mode() == "mongodb":
        return _resolution_mongo(dt_from, dt_to, dept_scope)
    return _resolution_inmem(dt_from, dt_to, dept_scope)


def _resolution_mongo(dt_from, dt_to, dept_scope) -> ResolutionResponse:
    col = repository._col  # type: ignore
    now = datetime.now(timezone.utc)

    match: dict = {"resolvedAt": {"$exists": True, "$ne": None}}
    if dept_scope:
        match["departmentId"] = dept_scope
    if dt_from or dt_to:
        match["createdAt"] = {}
        if dt_from:
            match["createdAt"]["$gte"] = dt_from
        if dt_to:
            match["createdAt"]["$lte"] = dt_to

    pipeline = [
        {"$match": match},
        {"$addFields": {
            "resolvedDt": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$resolvedAt"}, "string"]},
                    "then": {"$dateFromString": {"dateString": "$resolvedAt", "onError": None}},
                    "else": "$resolvedAt",
                }
            },
            "createdDt": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$createdAt"}, "string"]},
                    "then": {"$dateFromString": {"dateString": "$createdAt", "onError": None}},
                    "else": "$createdAt",
                }
            },
        }},
        {"$match": {"resolvedDt": {"$ne": None}, "createdDt": {"$ne": None}}},
        {"$project": {
            "departmentId": 1,
            "dueDate": 1,
            "resolutionMs": {"$subtract": ["$resolvedDt", "$createdDt"]},
            "withinSla": {
                "$cond": [
                    {"$and": [
                        {"$ne": ["$dueDate", None]},
                        {"$lte": ["$resolvedDt", {
                            "$cond": {
                                "if": {"$eq": [{"$type": "$dueDate"}, "string"]},
                                "then": {"$dateFromString": {"dateString": "$dueDate", "onError": None}},
                                "else": "$dueDate",
                            }
                        }]},
                    ]},
                    1, 0,
                ]
            },
            "hasDue": {"$cond": [{"$ne": ["$dueDate", None]}, 1, 0]},
        }},
        {"$group": {
            "_id": "$departmentId",
            "count": {"$sum": 1},
            "totalMs": {"$sum": "$resolutionMs"},
            "within_sla": {"$sum": "$withinSla"},
            "total_with_due": {"$sum": "$hasDue"},
            # Collect all resolution ms for median (project-grade; not huge)
            "all_ms": {"$push": "$resolutionMs"},
        }},
    ]

    by_dept: list[ResolutionDeptStat] = []
    all_days: list[float] = []
    all_within_sla = 0
    all_with_due = 0

    for r in col.aggregate(pipeline):
        ms_list = [ms for ms in r.get("all_ms", []) if ms is not None and ms >= 0]
        days_list = [ms / 86_400_000 for ms in ms_list]
        all_days.extend(days_list)

        mean_d = (sum(days_list) / len(days_list)) if days_list else None
        median_d = statistics.median(days_list) if days_list else None

        w = r.get("within_with_due", r.get("within_sla", 0))
        td = r.get("total_with_due", 0)
        all_within_sla += w
        all_with_due += td

        by_dept.append(ResolutionDeptStat(
            department=r["_id"] or "unknown",
            count=r["count"],
            mean_days=round(mean_d, 2) if mean_d is not None else None,
            median_days=round(median_d, 2) if median_d is not None else None,
            within_sla=r.get("within_sla"),
            total_with_due=td,
        ))

    overall_mean = round(sum(all_days) / len(all_days), 2) if all_days else None
    overall_median = round(statistics.median(all_days), 2) if all_days else None
    sla_pct = round(all_within_sla / all_with_due * 100, 1) if all_with_due else None

    return ResolutionResponse(
        overall_mean_days=overall_mean,
        overall_median_days=overall_median,
        overall_sla_compliance_pct=sla_pct,
        sla_note=(
            "SLA compliance counts only complaints that were assigned a due date "
            "(dueDate is set at assignment time). Unassigned complaints are excluded."
        ),
        by_department=sorted(by_dept, key=lambda x: -(x.count or 0)),
    )


def _resolution_inmem(dt_from, dt_to, dept_scope) -> ResolutionResponse:
    docs = _inmem_all(dept_scope)
    dept_data: dict[str, list] = {}
    dept_within: dict[str, int] = {}
    dept_due: dict[str, int] = {}

    for d in docs:
        resolved_raw = d.get("resolvedAt")
        if not resolved_raw:
            continue
        created = _as_dt(d.get("createdAt"))
        resolved = _as_dt(resolved_raw)
        if not created or not resolved:
            continue

        if dt_from and created < dt_from:
            continue
        if dt_to and created > dt_to:
            continue

        days = (resolved - created).total_seconds() / 86400
        dept = d.get("departmentId") or d.get("category", "unknown")
        dept_data.setdefault(dept, []).append(days)

        due_raw = d.get("dueDate")
        dept_due[dept] = dept_due.get(dept, 0)
        dept_within[dept] = dept_within.get(dept, 0)
        if due_raw:
            dept_due[dept] += 1
            due_dt = _as_dt(due_raw)
            if due_dt and resolved <= due_dt:
                dept_within[dept] += 1

    by_dept: list[ResolutionDeptStat] = []
    all_days: list[float] = []
    all_within = 0
    all_due = 0

    for dept, days_list in sorted(dept_data.items(), key=lambda x: -len(x[1])):
        all_days.extend(days_list)
        w = dept_within.get(dept, 0)
        td = dept_due.get(dept, 0)
        all_within += w
        all_due += td
        by_dept.append(ResolutionDeptStat(
            department=dept,
            count=len(days_list),
            mean_days=round(sum(days_list) / len(days_list), 2),
            median_days=round(statistics.median(days_list), 2),
            within_sla=w,
            total_with_due=td,
        ))

    overall_mean = round(sum(all_days) / len(all_days), 2) if all_days else None
    overall_median = round(statistics.median(all_days), 2) if all_days else None
    sla_pct = round(all_within / all_due * 100, 1) if all_due else None

    return ResolutionResponse(
        overall_mean_days=overall_mean,
        overall_median_days=overall_median,
        overall_sla_compliance_pct=sla_pct,
        sla_note=(
            "SLA compliance counts only complaints that were assigned a due date "
            "(dueDate is set at assignment time). Unassigned complaints are excluded."
        ),
        by_department=by_dept,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  4. Complaint aging
# ══════════════════════════════════════════════════════════════════════════════

_AGING_BUCKETS = [
    {"label": "0–2 days", "min": 0, "max": 2},
    {"label": "3–7 days", "min": 3, "max": 7},
    {"label": "8–14 days", "min": 8, "max": 14},
    {"label": "15+ days", "min": 15, "max": None},
]


@router.get("/aging", response_model=AgingResponse)
def aging(
    current: Annotated[dict, Depends(require_permission("grievance.view_dept"))],
):
    """Currently unresolved complaints bucketed by age (days since created)."""
    dept_scope = _dept_scope(current)
    now = datetime.now(timezone.utc)

    if storage_mode() == "mongodb":
        return _aging_mongo(now, dept_scope)
    return _aging_inmem(now, dept_scope)


def _aging_mongo(now: datetime, dept_scope) -> AgingResponse:
    col = repository._col  # type: ignore

    match: dict = {"state": {"$nin": list(_TERMINAL)}}
    if dept_scope:
        match["departmentId"] = dept_scope

    pipeline = [
        {"$match": match},
        {"$addFields": {
            "createdDt": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$createdAt"}, "string"]},
                    "then": {"$dateFromString": {"dateString": "$createdAt", "onError": None}},
                    "else": "$createdAt",
                }
            }
        }},
        {"$match": {"createdDt": {"$ne": None}}},
        {"$project": {
            "ageDays": {
                "$divide": [
                    {"$subtract": [now, "$createdDt"]},
                    86_400_000,
                ]
            }
        }},
        {"$bucket": {
            "groupBy": "$ageDays",
            "boundaries": [0, 3, 8, 15],
            "default": "15+",
            "output": {"count": {"$sum": 1}},
        }},
    ]

    try:
        raw = {str(r["_id"]): r["count"] for r in col.aggregate(pipeline)}
    except Exception:
        # $bucket may not behave exactly if boundaries cause issues — fall back
        logger.warning("Aging $bucket pipeline failed, falling back to Python")
        return _aging_inmem(now, dept_scope)

    # Map bucket ids to labels: boundaries produce ids 0, 3, 8; default="15+"
    bucket_id_map = {"0": 0, "3": 1, "8": 2, "15+": 3}
    counts = [0, 0, 0, 0]
    for key, cnt in raw.items():
        idx = bucket_id_map.get(key)
        if idx is not None:
            counts[idx] = cnt

    buckets = [
        AgingBucket(label=b["label"], days_min=b["min"], days_max=b["max"], count=counts[i])
        for i, b in enumerate(_AGING_BUCKETS)
    ]
    return AgingResponse(reference_time=now.isoformat(), buckets=buckets)


def _aging_inmem(now: datetime, dept_scope) -> AgingResponse:
    docs = _inmem_all(dept_scope)
    counts = [0, 0, 0, 0]

    for d in docs:
        state = (d.get("state") or "SUBMITTED").upper()
        if state in _TERMINAL:
            continue
        created = _as_dt(d.get("createdAt"))
        if not created:
            continue
        age_days = (now - created).total_seconds() / 86400
        if age_days <= 2:
            counts[0] += 1
        elif age_days <= 7:
            counts[1] += 1
        elif age_days <= 14:
            counts[2] += 1
        else:
            counts[3] += 1

    buckets = [
        AgingBucket(label=b["label"], days_min=b["min"], days_max=b["max"], count=counts[i])
        for i, b in enumerate(_AGING_BUCKETS)
    ]
    return AgingResponse(reference_time=now.isoformat(), buckets=buckets)


# ══════════════════════════════════════════════════════════════════════════════
#  5. Priority distribution
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/priorities", response_model=PrioritiesResponse)
def priorities(
    current: Annotated[dict, Depends(require_permission("grievance.view_dept"))],
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Priority × status distribution (stored priority values only)."""
    dept_scope = _dept_scope(current)
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    if storage_mode() == "mongodb":
        return _priorities_mongo(dt_from, dt_to, dept_scope)
    return _priorities_inmem(dt_from, dt_to, dept_scope)


def _priorities_mongo(dt_from, dt_to, dept_scope) -> PrioritiesResponse:
    col = repository._col  # type: ignore

    match: dict = {}
    if dept_scope:
        match["departmentId"] = dept_scope
    if dt_from or dt_to:
        match["createdAt"] = {}
        if dt_from:
            match["createdAt"]["$gte"] = dt_from
        if dt_to:
            match["createdAt"]["$lte"] = dt_to

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {
                "priority": {"$ifNull": ["$priority", "low"]},
                "state": {"$ifNull": ["$state", "SUBMITTED"]},
            },
            "count": {"$sum": 1},
        }},
    ]

    data = [
        PriorityStatusCell(
            priority=r["_id"]["priority"],
            status=r["_id"]["state"],
            count=r["count"],
        )
        for r in col.aggregate(pipeline)
    ]
    return PrioritiesResponse(
        data=sorted(data, key=lambda x: x.count, reverse=True),
        note="Priorities shown are stored/human-assigned values. AI-suggested priorities are separate (hfEngine.priority) and not mixed in.",
    )


def _priorities_inmem(dt_from, dt_to, dept_scope) -> PrioritiesResponse:
    docs = _inmem_all(dept_scope)
    cell_map: dict[tuple[str, str], int] = {}

    for d in docs:
        created = _as_dt(d.get("createdAt"))
        if created:
            if dt_from and created < dt_from:
                continue
            if dt_to and created > dt_to:
                continue

        priority = d.get("priority") or "low"
        state = (d.get("state") or "SUBMITTED").upper()
        key = (priority, state)
        cell_map[key] = cell_map.get(key, 0) + 1

    data = [
        PriorityStatusCell(priority=p, status=s, count=c)
        for (p, s), c in sorted(cell_map.items(), key=lambda x: -x[1])
    ]
    return PrioritiesResponse(
        data=data,
        note="Priorities shown are stored/human-assigned values. AI-suggested priorities are separate (hfEngine.priority) and not mixed in.",
    )
