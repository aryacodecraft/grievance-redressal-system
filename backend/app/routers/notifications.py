"""Notification endpoints."""
from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from ..auth import get_current_user
from ..repositories.notifications import notif_repository

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current: Annotated[dict, Depends(get_current_user)] = None,
):
    return notif_repository.list_for_user(current["user_id"], unread_only=unread_only, limit=limit)

@router.patch("/read-all")
def mark_all_read(current: Annotated[dict, Depends(get_current_user)]):
    notif_repository.mark_all_read(current["user_id"])
    return {"message": "All notifications marked as read"}

@router.patch("/{notif_id}/read")
def mark_read(notif_id: str, current: Annotated[dict, Depends(get_current_user)]):
    result = notif_repository.mark_read(notif_id, current["user_id"])
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}
