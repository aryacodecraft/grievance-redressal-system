"""User management endpoints (SUPERADMIN / ADMIN)."""

from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user
from ..permissions import require_permission
from ..users_db import users_repository
from ..repositories.audit import audit_repository
from datetime import datetime, timezone

router = APIRouter(prefix="/users", tags=["users"])

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
        dept = dept or current.get("departmentId")
        users = users_repository.list_users(role=role, dept_id=dept, q=q, limit=limit)
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

def _safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("hashed_password",)}
