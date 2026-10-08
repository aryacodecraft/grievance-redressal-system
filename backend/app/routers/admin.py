"""Admin overview, workload, overdue, escalations endpoints."""
from __future__ import annotations
from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..db import repository
from ..permissions import require_permission

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/overview")
def overview(current: Annotated[dict, Depends(require_permission("grievance.view_dept"))]):
    role = current["role"]
    dept_id = current.get("departmentId")
    # Get all grievances scoped by role
    if role == "SUPERADMIN":
        docs = repository.list(limit=1000)
    else:
        docs = repository.list(limit=1000)
        if dept_id:
            docs = [d for d in docs if d.get("departmentId") == dept_id]
    
    counts = {}
    for d in docs:
        state = d.get("state") or d.get("status", "unknown")
        counts[state] = counts.get(state, 0) + 1
    
    return {"totalGrievances": len(docs), "byState": counts}

@router.get("/workload")
def workload(current: Annotated[dict, Depends(require_permission("grievance.view_dept"))]):
    role = current["role"]
    dept_id = current.get("departmentId")
    docs = repository.list(limit=1000)
    if role != "SUPERADMIN" and dept_id:
        docs = [d for d in docs if d.get("departmentId") == dept_id]
    
    workload_map = {}
    for d in docs:
        owner = d.get("ownerId")
        if owner:
            workload_map[owner] = workload_map.get(owner, 0) + 1
    return {"workload": workload_map}

@router.get("/overdue")
def overdue(current: Annotated[dict, Depends(require_permission("grievance.view_dept"))]):
    role = current["role"]
    dept_id = current.get("departmentId")
    now_str = datetime.now(timezone.utc).isoformat()
    docs = repository.list(limit=1000)
    if role != "SUPERADMIN" and dept_id:
        docs = [d for d in docs if d.get("departmentId") == dept_id]
    
    overdue = [d for d in docs if d.get("dueDate") and d["dueDate"] < now_str and d.get("state") not in ("CLOSED","RESOLVED","REJECTED","WITHDRAWN")]
    return {"overdue": overdue, "count": len(overdue)}

@router.get("/escalations")
def escalations(current: Annotated[dict, Depends(require_permission("grievance.view_dept"))]):
    role = current["role"]
    dept_id = current.get("departmentId")
    docs = repository.list(limit=1000)
    if role != "SUPERADMIN" and dept_id:
        docs = [d for d in docs if d.get("departmentId") == dept_id]
    
    escalated = [d for d in docs if (d.get("state") or d.get("status", "")) in ("ESCALATED", "escalated")]
    return {"escalations": escalated, "count": len(escalated)}
