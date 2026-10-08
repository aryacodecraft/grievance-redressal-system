"""Department CRUD (SUPERADMIN write, any authenticated read)."""
from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user
from ..permissions import require_permission
from ..repositories.departments import dept_repository
from ..repositories.audit import audit_repository
from datetime import datetime, timezone

router = APIRouter(prefix="/departments", tags=["departments"])

@router.get("")
def list_departments(current: Annotated[dict, Depends(get_current_user)]):
    return dept_repository.list()

@router.get("/{dept_id}")
def get_department(dept_id: str, current: Annotated[dict, Depends(get_current_user)]):
    dept = dept_repository.get(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept

@router.post("", status_code=201)
def create_department(
    payload: dict,
    current: Annotated[dict, Depends(require_permission("department.manage"))],
):
    name = payload.get("name", "").strip()
    key = payload.get("key", "").strip().lower()
    if not name or not key:
        return JSONResponse(status_code=400, content={"error": "name and key required"})
    dept_id = dept_repository.create({"name": name, "key": key, "managerId": payload.get("managerId"), "isActive": True})
    audit_repository.append({"actorId": current["user_id"], "actorRole": current["role"], "action": "department.created", "entity": "department", "entityId": dept_id, "old": None, "new": {"name": name, "key": key}, "at": datetime.now(timezone.utc).isoformat(), "reason": payload.get("reason", ""), "source": "HUMAN"})
    return dept_repository.get(dept_id)

@router.patch("/{dept_id}")
def update_department(
    dept_id: str,
    payload: dict,
    current: Annotated[dict, Depends(require_permission("department.manage"))],
):
    dept = dept_repository.get(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    patch = {k: v for k, v in payload.items() if k in ("name", "managerId", "isActive") and v is not None}
    updated = dept_repository.update(dept_id, patch)
    audit_repository.append({"actorId": current["user_id"], "actorRole": current["role"], "action": "department.updated", "entity": "department", "entityId": dept_id, "old": dept, "new": patch, "at": datetime.now(timezone.utc).isoformat(), "reason": payload.get("reason", ""), "source": "HUMAN"})
    return updated

@router.delete("/{dept_id}", status_code=204)
def delete_department(
    dept_id: str,
    current: Annotated[dict, Depends(require_permission("department.manage"))],
):
    dept = dept_repository.get(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept_repository.update(dept_id, {"isActive": False})
    audit_repository.append({"actorId": current["user_id"], "actorRole": current["role"], "action": "department.deleted", "entity": "department", "entityId": dept_id, "old": dept, "new": {"isActive": False}, "at": datetime.now(timezone.utc).isoformat(), "reason": "soft delete", "source": "HUMAN"})
