"""Audit log read endpoints."""
from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends
from ..permissions import require_permission
from ..repositories.audit import audit_repository

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("")
def list_audit(
    entity: str | None = None,
    actor: str | None = None,
    limit: int = 100,
    current: Annotated[dict, Depends(require_permission("audit.view_dept"))] = None,
):
    return audit_repository.list(entity_id=entity, actor_id=actor, limit=limit)
