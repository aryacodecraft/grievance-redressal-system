"""Assignment, priority, deadline, escalation, resolution and workflow endpoints."""
from __future__ import annotations
from typing import Annotated
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
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
from ..services.departments import canonical_department

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

def _notify(user_id: str, kind: str, entity_id: str, title: str, message: str | None = None):
    if user_id:
        notif_repository.create({
            "userId": user_id,
            "kind": kind,
            "entityId": entity_id,
            "title": title,
            "message": message,
        })


@router.post("/grievances/{grievance_id}/assign")
def assign_grievance(
    grievance_id: str,
    payload: AssignRequest,
    current: Annotated[dict, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    role = current["role"]
    if role not in ("ADMIN", "SUPERADMIN"):
        return JSONResponse(status_code=403, content={"error": "Requires ADMIN or SUPERADMIN"})
    
    doc = _get_doc_or_404(grievance_id)
    state = _canon_state(doc)
    department_id = canonical_department(payload.departmentId)
    grievance_department = canonical_department(doc.get("departmentId") or doc.get("category"))
    manager_department = canonical_department(current.get("departmentId")) if current.get("departmentId") else ""
    if role == "ADMIN" and manager_department and (grievance_department != manager_department or department_id != manager_department):
        return JSONResponse(status_code=403, content={"error": "Can only route grievances within your department"})
    if payload.ownerId:
        from ..users_db import users_repository
        worker = users_repository.get(payload.ownerId)
        worker_department = canonical_department((worker or {}).get("departmentId")) if (worker or {}).get("departmentId") else ""
        if not worker or worker.get("role") != "RESOLVER" or worker.get("isActive") is False or worker_department != department_id:
            return JSONResponse(status_code=400, content={"error": "Assigned employee must belong to the selected department"})
    assignable_states = {"PENDING_ASSIGNMENT", "SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "ESCALATED"}
    if state not in assignable_states:
        return JSONResponse(status_code=422, content={"error": f"Cannot change department in terminal/review state {state}."})
    
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
        "toDept": canonical_department(payload.departmentId),
        "byRole": role,
        "reason": payload.reason,
        "at": now,
    }
    
    # Department reassignment must not erase an active worker assignment or
    # reset work already in progress. Initial review still moves the ticket to
    # ASSIGNED, while later department changes preserve its current state.
    is_initial_assignment = state in ("PENDING_ASSIGNMENT", "SUBMITTED")
    patch = {
        "departmentId": department_id,
        "managerId": current["user_id"],
        "dueDate": due_date,
        "updatedAt": now,
    }
    if is_initial_assignment:
        patch.update({"state": "ASSIGNED", "status": "assigned"})
    if payload.ownerId:
        patch["ownerId"] = payload.ownerId
    repository.update(grievance_id, patch)
    try:
        repository.append_history(grievance_id, "assignmentHistory", assignment_entry)
        if is_initial_assignment:
            repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ASSIGNED", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("userId"), "grievance.assigned", grievance_id, f"Your grievance {grievance_id} has been routed to the {department_id} department")
    if is_initial_assignment:
        from ..services.sms import queue_stage_update
        queue_stage_update(background_tasks, doc.get("userId"), grievance_id, "ASSIGNED")
    if payload.ownerId:
        _notify(payload.ownerId, "grievance.assigned_to_you", grievance_id, f"New task assigned: {doc.get('title', grievance_id)}", f"{grievance_id} · {priority} priority · Due {due_date}")
    action = "grievance.department_reviewed" if is_initial_assignment else "grievance.department_reassigned"
    _emit_audit(current, action, grievance_id, {"state": state, "departmentId": doc.get("departmentId")}, {"state": "ASSIGNED" if is_initial_assignment else state, "ownerId": payload.ownerId or doc.get("ownerId"), "departmentId": department_id}, payload.reason)
    return {"message": "Grievance assigned" if is_initial_assignment else "Grievance department reassigned", "grievanceId": grievance_id, "dueDate": due_date, "state": "ASSIGNED" if is_initial_assignment else state}


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
    grievance_department = canonical_department(doc.get("departmentId") or doc.get("category"))
    assignment_department = canonical_department(payload.departmentId or grievance_department)
    if role == "ADMIN":
        actor_dept = canonical_department(current.get("departmentId")) if current.get("departmentId") else ""
        if actor_dept != grievance_department or assignment_department != actor_dept:
            return JSONResponse(status_code=403, content={"error": "Can only assign tasks in your department"})
    from ..users_db import users_repository
    target = users_repository.get(payload.ownerId)
    target_dept = canonical_department((target or {}).get("departmentId")) if (target or {}).get("departmentId") else ""
    if not target or target.get("role") != "RESOLVER" or target.get("isActive") is False or target_dept != assignment_department:
        return JSONResponse(status_code=400, content={"error": "Assigned employee must belong to the grievance department"})
    now = datetime.now(timezone.utc).isoformat()
    old_owner = doc.get("ownerId")
    state = _canon_state(doc)
    patch = {"ownerId": payload.ownerId, "updatedAt": now}
    if payload.departmentId:
        patch["departmentId"] = assignment_department
    initial_assignment = state in ("PENDING_ASSIGNMENT", "SUBMITTED")
    if initial_assignment:
        due_days = sla_repository.get_days(doc.get("category", "other"), doc.get("priority", "low"))
        patch.update({"state": "ASSIGNED", "status": "assigned", "managerId": current["user_id"],
                      "dueDate": doc.get("dueDate") or (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()})
    repository.update(grievance_id, patch)
    try:
        repository.append_history(grievance_id, "assignmentHistory", {"fromOwner": old_owner, "toOwner": payload.ownerId, "byRole": role, "reason": payload.reason, "at": now, "reassign": True})
        if initial_assignment:
            repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ASSIGNED", "by": current["user_id"], "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(payload.ownerId, "grievance.assigned_to_you", grievance_id, f"New task assigned: {doc.get('title', grievance_id)}", f"{grievance_id} · {doc.get('priority', 'low')} priority · Due {patch.get('dueDate', doc.get('dueDate', 'not set'))}")
    if initial_assignment:
        _notify(doc.get("userId"), "grievance.assigned", grievance_id, f"Your grievance {grievance_id} has been assigned to a department employee")
    if old_owner:
        _notify(old_owner, "grievance.reassigned_away", grievance_id, f"Grievance {grievance_id} has been reassigned")
    _emit_audit(current, "grievance.reassigned", grievance_id, {"ownerId": old_owner, "state": state}, {"ownerId": payload.ownerId, "state": "ASSIGNED" if initial_assignment else state}, payload.reason)
    return {"message": "Grievance reassigned", "grievanceId": grievance_id, "state": "ASSIGNED" if initial_assignment else state}


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
    background_tasks: BackgroundTasks,
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
    
    _notify(doc.get("userId"), f"grievance.state.{payload.to_state.lower()}", grievance_id, f"Your grievance status is now {payload.to_state.replace('_', ' ').title()}", payload.reason)
    from ..services.sms import queue_stage_update
    queue_stage_update(background_tasks, doc.get("userId"), grievance_id, payload.to_state)
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
    ticket = {"issueType": payload.issueType or "Other", "reason": payload.reason,
              "description": payload.description or payload.reason,
              "suggestedAction": payload.suggestedAction, "evidenceUrl": payload.evidenceUrl,
              "targetDept": payload.targetDept, "by": actor_id, "at": now, "status": "OPEN"}
    repository.update(grievance_id, {"state": "ESCALATED", "status": "escalated", "escalation": ticket, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ESCALATED", "by": actor_id, "byRole": role, "reason": payload.reason, "at": now, "source": "HUMAN"})
        repository.append_history(grievance_id, "escalationHistory", ticket)
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
    if state not in ("IN_PROGRESS", "BLOCKED", "ASSIGNED", "ACCEPTED"):
        return JSONResponse(status_code=422, content={"error": f"Cannot submit resolution in state {state}"})
    
    now = datetime.now(timezone.utc).isoformat()
    resolution = {"text": payload.text, "actions": payload.actions, "by": actor_id, "at": now,
                  "completionPhotoUrl": payload.completionPhotoUrl,
                  "supportingDocumentUrl": payload.supportingDocumentUrl}
    repository.update(grievance_id, {"state": "RESOLUTION_SUBMITTED", "status": "resolution_submitted", "resolution": resolution, "updatedAt": now})
    try:
        repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "RESOLUTION_SUBMITTED", "by": actor_id, "byRole": role, "reason": "Resolution proposed", "at": now, "source": "HUMAN"})
    except Exception:
        pass
    
    _notify(doc.get("managerId"), "grievance.resolution_proposed", grievance_id, f"Grievance {grievance_id} resolution submitted for review")
    _emit_audit(current, "grievance.resolution_proposed", grievance_id, {"state": state}, {"state": "RESOLUTION_SUBMITTED"}, "Resolution proposed")
    return {"message": "Resolution submitted for review"}


@router.post("/grievances/{grievance_id}/accept")
def accept_assignment(grievance_id: str, current: Annotated[dict, Depends(get_current_user)]):
    """Worker acknowledgement; completion still requires manager review."""
    if current["role"] != "RESOLVER":
        return JSONResponse(status_code=403, content={"error": "Requires RESOLVER"})
    doc = _get_doc_or_404(grievance_id)
    if doc.get("ownerId") != current["user_id"]:
        return JSONResponse(status_code=403, content={"error": "Not your assigned grievance"})
    state = _canon_state(doc)
    transition_state(state, "ACCEPTED", "RESOLVER")
    now = datetime.now(timezone.utc).isoformat()
    repository.update(grievance_id, {"state": "ACCEPTED", "status": "accepted", "updatedAt": now})
    repository.append_history(grievance_id, "stateHistory", {"from": state, "to": "ACCEPTED", "by": current["user_id"], "byRole": "RESOLVER", "reason": "Assignment accepted", "at": now, "source": "HUMAN"})
    _notify(doc.get("managerId"), "grievance.assignment_accepted", grievance_id, f"{grievance_id} assignment accepted")
    _emit_audit(current, "grievance.assignment_accepted", grievance_id, {"state": state}, {"state": "ACCEPTED"}, "Assignment accepted")
    return {"message": "Assignment accepted", "state": "ACCEPTED"}


@router.post("/grievances/{grievance_id}/approve-resolution")
def approve_resolution(
    grievance_id: str,
    current: Annotated[dict, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
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
    
    _notify(doc.get("userId"), "grievance.resolved", grievance_id, f"Your grievance {grievance_id} has been resolved", "The department manager approved the submitted resolution.")
    from ..services.sms import queue_stage_update
    queue_stage_update(background_tasks, doc.get("userId"), grievance_id, "RESOLVED")
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
    
    _notify(doc.get("ownerId"), "grievance.resolution_returned", grievance_id, f"Grievance {grievance_id} returned for rework", payload.reason)
    _emit_audit(current, "grievance.resolution_returned", grievance_id, {"state": state}, {"state": "IN_PROGRESS"}, payload.reason)
    return {"message": "Resolution returned for rework"}


@router.post("/grievances/{grievance_id}/close")
def close_grievance(
    grievance_id: str,
    payload: CloseRequest,
    current: Annotated[dict, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
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
    from ..services.sms import queue_stage_update
    queue_stage_update(background_tasks, doc.get("userId"), grievance_id, "CLOSED")
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
    background_tasks: BackgroundTasks,
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
    from ..services.sms import queue_stage_update
    queue_stage_update(background_tasks, doc.get("userId"), grievance_id, "REJECTED")
    _emit_audit(current, "grievance.rejected", grievance_id, {"state": state}, {"state": "REJECTED"}, payload.reason)
    return {"message": "Grievance rejected"}
