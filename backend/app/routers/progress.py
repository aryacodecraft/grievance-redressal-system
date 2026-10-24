"""Progress updates on grievances."""
from __future__ import annotations
from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user, get_optional_user
from ..db import repository
from ..models import ProgressUpdateRequest
from ..repositories.progress import progress_repository
from ..repositories.audit import audit_repository
from ..repositories.notifications import notif_repository
from ..services.departments import canonical_department

router = APIRouter(tags=["progress"])

_ACTIVE_STATES = {
    "IN_PROGRESS", "ASSIGNED", "ACCEPTED", "BLOCKED", "RESOLUTION_SUBMITTED",
    "UNDER_REVIEW", "ESCALATED", "REOPENED", "PENDING_ASSIGNMENT"
}

@router.post("/grievances/{grievance_id}/progress", status_code=201)
def add_progress(
    grievance_id: str,
    payload: ProgressUpdateRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    doc = repository.get(grievance_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Grievance not found")
    
    state = doc.get("state") or doc.get("status", "SUBMITTED")
    from ..state_machine import _STATUS_COMPAT
    state = _STATUS_COMPAT.get(state.lower(), state.upper())
    
    if state not in _ACTIVE_STATES:
        return JSONResponse(status_code=422, content={"error": f"Cannot add progress in state {state}"})
    
    role = current["role"]
    actor_id = current["user_id"]
    
    # Authorization: EMPLOYEE must be assignee, ADMIN must be dept manager, SUPERADMIN free
    if role == "RESOLVER":
        if doc.get("ownerId") != actor_id:
            return JSONResponse(status_code=403, content={"error": "You are not the assignee of this grievance"})
    elif role == "ADMIN":
        manager_department = canonical_department(current.get("departmentId"))
        grievance_department = canonical_department(
            doc.get("departmentId") or doc.get("category")
        )
        if not current.get("departmentId") or manager_department != grievance_department:
            return JSONResponse(
                status_code=403,
                content={"error": "Can only update grievances in your department"},
            )
    
    visibility = payload.visibility
    if visibility not in ("internal", "manager", "customer", "system"):
        return JSONResponse(status_code=400, content={"error": "Invalid visibility"})
    if visibility == "customer" and not payload.bodyCustomer:
        return JSONResponse(status_code=400, content={"error": "bodyCustomer required when visibility=customer"})
    
    entry = {
        "grievanceId": grievance_id,
        "authorId": actor_id,
        "authorRole": role,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "stateAtWrite": state,
        "kind": payload.kind,
        "bodyInternal": payload.bodyInternal,
        "bodyCustomer": payload.bodyCustomer,
        "visibility": visibility,
        "etaClass": payload.etaClass,
        "workCompleted": payload.workCompleted,
        "currentSituation": payload.currentSituation,
        "nextAction": payload.nextAction,
    }
    update_id = progress_repository.create(entry)
    
    # Notify customer if customer-visible
    if visibility == "customer" and doc.get("userId"):
        notif_repository.create({
            "userId": doc["userId"],
            "kind": "progress.customer",
            "entityId": grievance_id,
            "title": f"Update on your grievance {grievance_id}",
            "message": payload.bodyCustomer,
        })
    
    audit_repository.append({
        "actorId": actor_id, "actorRole": role, "action": "progress.added",
        "entity": "grievance", "entityId": grievance_id,
        "old": None, "new": {"visibility": visibility, "kind": payload.kind},
        "at": datetime.now(timezone.utc).isoformat(), "reason": "", "source": "HUMAN",
    })
    return {"id": update_id, **entry}

@router.get("/grievances/{grievance_id}/history")
def get_history(
    grievance_id: str,
    current: Annotated[dict | None, Depends(get_optional_user)] = None,
):
    grievance_id = grievance_id.strip().upper()
    doc = repository.get(grievance_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Grievance not found")
    
    role = current["role"] if current else "PUBLIC"
    actor_id = current["user_id"] if current else None
    if (
        current
        and role in ("RESOLVER", "EMPLOYEE")
        and doc.get("ownerId") != actor_id
    ):
        raise HTTPException(status_code=403, detail="Not your assigned grievance")

    is_department_staff_out_of_scope = bool(
        current
        and role in ("ADMIN", "MANAGER")
        and current.get("departmentId")
        and canonical_department(current.get("departmentId"))
        != canonical_department(doc.get("departmentId") or doc.get("category"))
    )
    
    # Citizen can only see own grievance history
    if (
        role == "PUBLIC"
        or (role == "USER" and doc.get("userId") != actor_id)
        or is_department_staff_out_of_scope
        or role not in ("PUBLIC", "USER", "RESOLVER", "EMPLOYEE", "ADMIN", "SUPERADMIN")
    ):
        updates = progress_repository.list_for_grievance(grievance_id, visibility_filter=["customer", "system"])
    elif role == "USER":
        updates = progress_repository.list_for_grievance(grievance_id, visibility_filter=["customer", "system"])
    elif role in ("RESOLVER", "EMPLOYEE"):
        updates = progress_repository.list_for_grievance(grievance_id)
    elif role in ("ADMIN", "SUPERADMIN"):
        updates = progress_repository.list_for_grievance(grievance_id)
    else:
        updates = progress_repository.list_for_grievance(grievance_id, visibility_filter=["customer", "system"])
    
    # Include citizen-owned state changes without exposing staff comments.
    if role == "USER" and doc.get("userId") == actor_id:
        updates.extend(
            {
                "kind": "status",
                "from": entry.get("from"),
                "to": entry.get("to"),
                "reason": entry.get("reason") if role == "USER" and entry.get("by") == actor_id else None,
                "createdAt": entry.get("at"),
                "visibility": "system",
            }
            for entry in doc.get("stateHistory", [])
            if entry.get("at")
        )
    # Assigned employees and in-scope managers need workflow history too: in
    # particular, a manager's return-for-rework reason is the employee's review
    # feedback and must be visible on the task they are asked to correct.
    elif role in ("RESOLVER", "EMPLOYEE", "ADMIN", "SUPERADMIN") and not is_department_staff_out_of_scope:
        updates.extend(
            {
                "kind": (
                    "review_feedback"
                    if entry.get("from") == "RESOLUTION_SUBMITTED" and entry.get("to") == "IN_PROGRESS"
                    else "status"
                ),
                "from": entry.get("from"),
                "to": entry.get("to"),
                "reason": entry.get("reason"),
                "createdAt": entry.get("at"),
                "visibility": "internal",
            }
            for entry in doc.get("stateHistory", [])
            if entry.get("at")
        )

    # Sort updates
    updates = sorted(updates, key=lambda x: x.get("createdAt", ""))

    # Remove internal bodyInternal for customer
    result = []
    for u in updates:
        entry = dict(u)
        if role in ("USER", "PUBLIC"):
            entry.pop("bodyInternal", None)
            entry.pop("escalationReason", None)
        if role == "PUBLIC":
            entry = {key: entry[key] for key in ("kind", "bodyCustomer", "createdAt", "visibility") if key in entry}
        result.append(entry)
    
    return result
