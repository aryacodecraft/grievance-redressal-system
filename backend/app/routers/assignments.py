"""Assignment, priority, deadline, escalation, resolution and workflow endpoints."""
from __future__ import annotations
from typing import Annotated
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user
from ..db import repository
from ..models import (
    AssignRequest, ReassignRequest, PriorityUpdateRequest, DeadlineUpdateRequest,
    EscalationRequest, ResolutionRequest, CloseRequest, WithdrawRequest,
    ReopenRequest, RejectRequest, ReturnResolutionRequest, StateTransitionRequest,
)
from ..state_machine import GrievanceState, transition_state, _STATUS_COMPAT
from ..repositories.audit import audit_repository
from ..repositories.notifications import notif_repository
from ..repositories.sla_config import sla_repository

router = APIRouter(tags=["assignments"])

def _get_doc_or_404(grievance_id: str):
    doc = repository.get(grievance_id.strip())
    if not doc:
        raise HTTPException(status_code=404, detail="Grievance not found")
    return doc

def _canon_state(doc: dict) -> str:
    raw = doc.get("state") or doc.get("status", "SUBMITTED")
    return _STATUS_COMPAT.get(raw.lower(), raw.upper())

def _emit_audit(current, action, grievance_id, old, new, reason):
    audit_repository.append({
        "actorId": current["user_id"], "actorRole": current["role"],
        "action": action, "entity": "grievance", "entityId": grievance_id,
        "old": old, "new": new,
        "at": datetime.now(timezone.utc).isoformat(), "reason": reason, "source": "HUMAN",
    })

def _notify(user_id: str, kind: str, entity_id: str, title: str):
    if user_id:
        notif_repository.create({
            "userId": user_id,
            "kind": kind,
            "entityId": entity_id,
            "title": title,
        })


@router.post("/grievances/{grievance_id}/assign")
def assign_grievance(
    grievance_id: str,
    payload: AssignRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    if state not in ("PENDING_ASSIGNMENT", "SUBMITTED"):
        return JSONResponse(status_code=422, content={"error": f"Cannot assign in state {state}. Must be PENDING_ASSIGNMENT or SUBMITTED."})
    
    # Calculate dueDate from SLA config
    category = doc.get("category", "other")
    priority = doc.get("priority", "low")
    due_days = sla_repository.get_days(category, priority)
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()
    if payload.dueDate:
        due_date = payload.dueDate
    
    now = datetime.now(timezone.utc).isoformat()
    assignment_entry = {
        "fromOwner": doc.get("ownerId"),
        "toOwner": payload.ownerId,
        "toDept": payload.departmentId,
        "byRole": role,
        "reason": payload.reason,
        "at": now,
    }
    
    patch = {
        "state": "ASSIGNED",
        "status": "assigned",  # compat
        "departmentId": payload.departmentId,
        "ownerId": payload.ownerId,
        "managerId": current["user_id"],
        "dueDate": due_date,
        "updatedAt": now,
    }
    repository.update(grievance_id, patch)
    try:
        repository.append_history(grievance_id, "assignmentHistory", assignment_entry)
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ASSIGNED", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), "grievance.assigned", grievance_id, f"Your grievance {grievance_id} has been assigned")
    _emit_audit(current, "grievance.assigned", grievance_id, {"state": state, "ownerId": doc.get("ownerId")}, {"state": "ASSIGNED", "ownerId": payload.ownerId, "departmentId": payload.departmentId}, payload.reason)
    return {"message": "Grievance assigned", "grievanceId": grievance_id, "dueDate": due_date}


@router.post("/grievances/{grievance_id}/reassign")
def reassign_grievance(
    grievance_id: str,
    payload: ReassignRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    now = datetime.now(timezone.utc).isoformat()
    old_owner = doc.get("ownerId")
    
    patch = {"ownerId": payload.ownerId, "updatedAt": now}
    if payload.departmentId:
        patch["departmentId"] = payload.departmentId
    repository.update(grievance_id, patch)
    try:
        repository.append_history(grievance_id, "assignmentHistory", {"fromOwner": old_owner, "toOwner": payload.ownerId, "byRole": role, "reason": payload.reason, "at": now, "reassign": True})
    except Exception:
        pass
    
    _notify(payload.ownerId, "grievance.reassigned", grievance_id, f"Grievance {grievance_id} has been assigned to you")
    if old_owner:
        _notify(old_owner, "grievance.reassigned_away", grievance_id, f"Grievance {grievance_id} has been reassigned")
    _emit_audit(current, "grievance.reassigned", grievance_id, {"ownerId": old_owner}, {"ownerId": payload.ownerId}, payload.reason)
    return {"message": "Grievance reassigned", "grievanceId": grievance_id}


@router.patch("/grievances/{grievance_id}/priority")
def update_priority(
    grievance_id: str,
    payload: PriorityUpdateRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    valid = {"low", "medium", "high", "critical"}
    if payload.priority.lower() not in valid:
        return JSONResponse(status_code=400, content={"error": f"Invalid priority. Must be one of: {', '.join(valid)}"})
    
    doc = _get_doc_or_404(grievance_id)
    old_priority = doc.get("priority")
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"priority": payload.priority.lower(), "updatedAt": now})
    try:
        repository.append_history(grievance_id, "priorityHistory", {"from": old_priority, "to": payload.priority, "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now})
    except Exception:
        pass
    _emit_audit(current, "grievance.priority_changed", grievance_id, {"priority": old_priority}, {"priority": payload.priority}, payload.reason)
    return {"message": "Priority updated", "priority": payload.priority}


@router.patch("/grievances/{grievance_id}/deadline")
def update_deadline(
    grievance_id: str,
    payload: DeadlineUpdateRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    old_due = doc.get("dueDate")
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"dueDate": payload.dueDate, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "deadlineHistory", {"from": old_due, "to": payload.dueDate, "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now})
    except Exception:
        pass
    _emit_audit(current, "grievance.deadline_changed", grievance_id, {"dueDate": old_due}, {"dueDate": payload.dueDate}, payload.reason)
    return {"message": "Deadline updated", "dueDate": payload.dueDate}


@router.patch("/grievances/{grievance_id}/state")
def transition_grievance_state(
    grievance_id: str,
    payload: StateTransitionRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    role = current["role"]
    
    # validate transition
    transition_state(state, payload.to_state, role)  # raises 422 if invalid
    
    now = datetime.now(timezone.utc).isoformat()
    patch = {"state": payload.to_state, "status": payload.to_state.lower(), "updatedAt": now}
    if payload.to_state == "RESOLVED":
        patch["resolvedAt"] = now
    if payload.to_state == "CLOSED":
        patch["closedAt"] = now
    repository.update(grievance_id, patch)
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": payload.to_state, "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), f"grievance.state.{payload.to_state.lower()}", grievance_id, f"Your grievance {grievance_id} status: {payload.to_state}")
    _emit_audit(current, "grievance.state_changed", grievance_id, {"state": state}, {"state": payload.to_state}, payload.reason)
    return {"message": "State updated", "state": payload.to_state}


@router.post("/grievances/{grievance_id}/escalate")
def escalate_grievance(
    grievance_id: str,
    payload: EscalationRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    doc = _get_doc_or_404(grievance_id)
    role = current["role"]
    actor_id = current["user_id"]
    
    # USER can only escalate own; RESOLVER must be assignee
    if role == "USER" and doc.get("userId") != actor_id:
        return JSONResponse(status_code=403, content={"error": "Can only escalate your own grievance"})
    if role == "RESOLVER" and doc.get("ownerId") != actor_id:
        return JSONResponse(status_code=403, content={"error": "Can only escalate your assigned grievance"})
    
    state = _canon_state(doc)
    if state in ("CLOSED", "REJECTED", "WITHDRAWN"):
        return JSONResponse(status_code=422, content={"error": f"Cannot escalate in terminal state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "ESCALATED", "status": "escalated", "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ESCALATED", "by": actor_id, "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("managerId"), "grievance.escalated", grievance_id, f"Grievance {grievance_id} escalated")
    _emit_audit(current, "grievance.escalated", grievance_id, {"state": state}, {"state": "ESCALATED"}, payload.reason)
    return {"message": "Grievance escalated"}


@router.post("/grievances/{grievance_id}/resolution")
def propose_resolution(
    grievance_id: str,
    payload: ResolutionRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    actor_id = current["user_id"]
    doc = _get_doc_or_404(grievance_id)
    
    if role == "RESOLVER" and doc.get("ownerId") != actor_id:
        return JSONResponse(status_code=403, content={"error": "Not your assigned grievance"})
    if role not in ("RESOLVER", "ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Insufficient permissions"})
    
    state = _canon_state(doc)
    if state not in ("IN_PROGRESS", "BLOCKED", "ASSIGNED"):
        return JSONResponse(status_code=422, content={"error": f"Cannot submit resolution in state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    resolution = {"text": payload.text, "actions": payload.actions, "by": actor_id, "at": now}
    repository.update(grievance_id, {"state": "RESOLUTION_SUBMITTED", "status": "resolution_submitted", "resolution": resolution, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "RESOLUTION_SUBMITTED", "by": actor_id, "byRole": role, "reason": "Resolution proposed", "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("managerId"), "grievance.resolution_proposed", grievance_id, f"Grievance {grievance_id} resolution submitted for review")
    _emit_audit(current, "grievance.resolution_proposed", grievance_id, {"state": state}, {"state": "RESOLUTION_SUBMITTED"}, "Resolution proposed")
    return {"message": "Resolution submitted for review"}


@router.post("/grievances/{grievance_id}/approve-resolution")
def approve_resolution(
    grievance_id: str,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    if state != "RESOLUTION_SUBMITTED":
        return JSONResponse(status_code=422, content={"error": f"Cannot approve resolution in state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "RESOLVED", "status": "resolved", "resolvedAt": now, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "RESOLVED", "by": current["user_id"], "byRole": role, "reason": "Resolution approved", "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), "grievance.resolved", grievance_id, f"Your grievance {grievance_id} has been resolved!")
    _notify(doc.get("ownerId"), "grievance.resolution_approved", grievance_id, f"Grievance {grievance_id} resolution approved")
    _emit_audit(current, "grievance.resolution_approved", grievance_id, {"state": state}, {"state": "RESOLVED"}, "Approved")
    return {"message": "Resolution approved, grievance resolved"}


@router.post("/grievances/{grievance_id}/return-resolution")
def return_resolution(
    grievance_id: str,
    payload: ReturnResolutionRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    if state != "RESOLUTION_SUBMITTED":
        return JSONResponse(status_code=422, content={"error": f"Can only return from RESOLUTION_SUBMITTED, current: {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "IN_PROGRESS", "status": "in_progress", "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "IN_PROGRESS", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("ownerId"), "grievance.resolution_returned", grievance_id, f"Grievance {grievance_id} resolution returned for rework")
    _emit_audit(current, "grievance.resolution_returned", grievance_id, {"state": state}, {"state": "IN_PROGRESS"}, payload.reason)
    return {"message": "Resolution returned for rework"}


@router.post("/grievances/{grievance_id}/close")
def close_grievance(
    grievance_id: str,
    payload: CloseRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    if state not in ("RESOLVED", "REOPENED"):
        return JSONResponse(status_code=422, content={"error": f"Cannot close from state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    closure = {"reason": payload.reason, "by": current["user_id"], "at": now}
    repository.update(grievance_id, {"state": "CLOSED", "status": "closed", "closedAt": now, "closure": closure, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "CLOSED", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), "grievance.closed", grievance_id, f"Your grievance {grievance_id} has been closed")
    _emit_audit(current, "grievance.closed", grievance_id, {"state": state}, {"state": "CLOSED"}, payload.reason)
    return {"message": "Grievance closed"}


@router.post("/grievances/{grievance_id}/withdraw")
def withdraw_grievance(
    grievance_id: str,
    payload: WithdrawRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    doc = _get_doc_or_404(grievance_id)
    role = current["role"]
    actor_id = current["user_id"]
    
    if role == "USER":
        if doc.get("userId") != actor_id:
            return JSONResponse(status_code=403, content={"error": "Can only withdraw your own grievance"})
    
    state = _canon_state(doc)
    if state in ("CLOSED", "REJECTED", "WITHDRAWN"):
        return JSONResponse(status_code=422, content={"error": f"Cannot withdraw in state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "WITHDRAWN", "status": "withdrawn", "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "WITHDRAWN", "by": actor_id, "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _emit_audit(current, "grievance.withdrawn", grievance_id, {"state": state}, {"state": "WITHDRAWN"}, payload.reason)
    return {"message": "Grievance withdrawn"}


@router.post("/grievances/{grievance_id}/reopen")
def reopen_grievance(
    grievance_id: str,
    payload: ReopenRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    doc = _get_doc_or_404(grievance_id)
    role = current["role"]
    actor_id = current["user_id"]
    
    if role == "USER" and doc.get("userId") != actor_id:
        return JSONResponse(status_code=403, content={"error": "Can only reopen your own grievance"})
    
    state = _canon_state(doc)
    if state != "RESOLVED":
        return JSONResponse(status_code=422, content={"error": f"Can only reopen from RESOLVED. Current: {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "REOPENED", "status": "reopened", "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "REOPENED", "by": actor_id, "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("managerId"), "grievance.reopened", grievance_id, f"Grievance {grievance_id} has been reopened")
    _emit_audit(current, "grievance.reopened", grievance_id, {"state": state}, {"state": "REOPENED"}, payload.reason)
    return {"message": "Grievance reopened"}


@router.post("/grievances/{grievance_id}/reject")
def reject_grievance(
    grievance_id: str,
    payload: RejectRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    if state in ("CLOSED", "REJECTED", "WITHDRAWN", "RESOLVED"):
        return JSONResponse(status_code=422, content={"error": f"Cannot reject in state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "REJECTED", "status": "rejected", "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "REJECTED", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), "grievance.rejected", grievance_id, f"Your grievance {grievance_id} has been rejected: {payload.reason}")
    _emit_audit(current, "grievance.rejected", grievance_id, {"state": state}, {"state": "REJECTED"}, payload.reason)
    return {"message": "Grievance rejected"}
