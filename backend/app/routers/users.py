"""User management endpoints (SUPERADMIN / ADMIN)."""

from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user
from ..permissions import require_permission
from ..users_db import users_repository
from ..db import repository
from ..repositories.audit import audit_repository
from datetime import datetime, timezone
import bcrypt
import re

router = APIRouter(prefix="/users", tags=["users"])

def _same_department(actor: dict, target: dict) -> bool:
    actor_dept = "roads" if actor.get("departmentId") == "transport" else actor.get("departmentId")
    target_dept = "roads" if target.get("departmentId") == "transport" else target.get("departmentId")
    return actor.get("role") == "SUPERADMIN" or bool(actor_dept and actor_dept == target_dept)

@router.post("/employees", status_code=201)
def create_employee(payload: dict, current: Annotated[dict, Depends(require_permission("user.manage"))] = None):
    if current["role"] not in ("ADMIN", "SUPERADMIN"):
        raise HTTPException(status_code=403, detail="Only department managers can create employees")
    department = current.get("departmentId") if current["role"] == "ADMIN" else str(payload.get("departmentId") or "").strip().lower()
    email = str(payload.get("email", "")).strip().lower()
    name = str(payload.get("full_name", "")).strip()
    password = str(payload.get("password", ""))
    if not department or not email or not name or len(password) < 8:
        raise HTTPException(status_code=400, detail="Department, name, email, and an 8-character password are required")
    if len(name) > 120 or len(email) > 254 or not re.fullmatch(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+", email):
        raise HTTPException(status_code=400, detail="Enter a valid employee name and email address")
    if users_repository.find_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = users_repository.create({"email": email, "full_name": name, "hashed_password": bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode(), "role": "RESOLVER", "departmentId": department, "isActive": True})
    created = users_repository.get(user_id)
    audit_repository.append({"actorId": current["user_id"], "actorRole": current["role"], "action": "user.employee_created", "entity": "user", "entityId": user_id, "new": {"departmentId": department, "role": "RESOLVER"}, "at": datetime.now(timezone.utc).isoformat(), "reason": "Employee created", "source": "HUMAN"})
    return _safe_user(created or {})

@router.get("")
def list_users(
    role: str | None = None,
    dept: str | None = None,
    q: str | None = None,
    limit: int = 100,
    current: Annotated[dict, Depends(require_permission("user.view"))] = None,
):
    actor_role = current["role"]
    # ADMIN can only view non-admin users in their dept
    if actor_role == "ADMIN":
        role = "RESOLVER"
        own_dept = current.get("departmentId")
        own_dept = "roads" if own_dept == "transport" else own_dept
        if not own_dept:
            return []
        # Ignore caller-supplied department filters; manager scope comes from
        # the verified token. Roads also includes legacy transport accounts.
        if own_dept == "roads":
            users = users_repository.list_users(role=role, q=q, limit=limit * 2)
            users = [u for u in users if ("roads" if u.get("departmentId") == "transport" else u.get("departmentId")) == own_dept]
            users = users[:limit]
        else:
            users = users_repository.list_users(role=role, dept_id=own_dept, q=q, limit=limit)
        users = [u for u in users if u.get("role") not in ("ADMIN", "SUPERADMIN")]
    else:
        users = users_repository.list_users(role=role, dept_id=dept, q=q, limit=limit)
    return [_safe_user(u) for u in users]

@router.post("/{user_id}/roles")
def update_user_role(
    user_id: str,
    payload: dict,
    current: Annotated[dict, Depends(require_permission("user.manage_admin"))] = None,
):
    new_role = payload.get("role", "").upper()
    reason = payload.get("reason", "")
    valid_roles = {"USER", "RESOLVER", "ADMIN", "SUPERADMIN"}
    if new_role not in valid_roles:
        return JSONResponse(status_code=400, content={"error": f"Invalid role: {new_role}"})
    
    target = users_repository.get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Guard: cannot demote last SUPERADMIN
    if target.get("role") == "SUPERADMIN" and new_role != "SUPERADMIN":
        all_superadmins = users_repository.list_users(role="SUPERADMIN", limit=10)
        if len(all_superadmins) <= 1:
            return JSONResponse(status_code=400, content={"error": "Cannot demote the last SUPERADMIN"})
    
    old_role = target.get("role")
    updated = users_repository.update_role(user_id, new_role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    
    audit_repository.append({
        "actorId": current["user_id"],
        "actorRole": current["role"],
        "action": "user.role_changed",
        "entity": "user",
        "entityId": user_id,
        "old": {"role": old_role},
        "new": {"role": new_role},
        "at": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
        "source": "HUMAN",
    })
    return _safe_user(updated)

@router.post("/{user_id}/active")
def set_user_active(
    user_id: str,
    payload: dict,
    current: Annotated[dict, Depends(require_permission("user.manage"))] = None,
):
    is_active = bool(payload.get("is_active", True))
    reason = payload.get("reason", "")
    target = users_repository.get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if current["role"] == "ADMIN" and (target.get("role") != "RESOLVER" or not _same_department(current, target)):
        raise HTTPException(status_code=403, detail="Can only manage employee accounts in your department")
    old_active = target.get("isActive", True)
    updated = users_repository.set_active(user_id, is_active)
    audit_repository.append({
        "actorId": current["user_id"],
        "actorRole": current["role"],
        "action": "user.active_changed",
        "entity": "user",
        "entityId": user_id,
        "old": {"isActive": old_active},
        "new": {"isActive": is_active},
        "at": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
        "source": "HUMAN",
    })
    return _safe_user(updated)

@router.delete("/{user_id}")
def delete_employee(user_id: str, current: Annotated[dict, Depends(require_permission("user.manage"))] = None):
    target = users_repository.get(user_id)
    if not target or target.get("role") != "RESOLVER":
        raise HTTPException(status_code=404, detail="Employee not found")
    if not _same_department(current, target):
        raise HTTPException(status_code=403, detail="Employee belongs to another department")
    assigned = repository.list(limit=1000, owner_id=user_id)
    active_states = {"SUBMITTED", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "ESCALATED", "REOPENED"}
    if any(str(g.get("state") or g.get("status") or "").upper() in active_states for g in assigned):
        raise HTTPException(status_code=409, detail="Reassign this employee’s open grievances before removing the account")
    if not users_repository.delete(user_id):
        raise HTTPException(status_code=404, detail="Employee not found")
    audit_repository.append({"actorId": current["user_id"], "actorRole": current["role"], "action": "user.employee_deleted", "entity": "user", "entityId": user_id, "old": {"departmentId": target.get("departmentId")}, "at": datetime.now(timezone.utc).isoformat(), "reason": "Employee deleted", "source": "HUMAN"})
    return {"message": "Employee deleted", "userId": user_id}

def _safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("hashed_password",)}
