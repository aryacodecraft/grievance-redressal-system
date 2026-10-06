"""Pydantic request models.

Field names mirror the JSON keys the frontend sends (and the legacy Flask
payloads), so no aliasing is needed.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SubmitGrievanceRequest(BaseModel):
    title: str
    description: str
    # When a valid Bearer token is provided, userId is derived from the JWT (body is ignored).
    # In unauthenticated / demo mode, userId from body is required for backwards compatibility.
    userId: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    imageUrl: str | None = None


class ValidateImageRequest(BaseModel):
    imageUrl: str | None = None
    image_url: str | None = None
    url: str | None = None
    public_id: str | None = None
    public_url: str | None = None


class DeleteCloudinaryRequest(BaseModel):
    public_id: str | None = None
    public_url: str | None = None
    resource_type: str = "image"


class SignCloudinaryRequest(BaseModel):
    public_id: str
    resource_type: str = "image"
    transform: str = "f_auto,q_auto,w_900"


class StatusUpdateRequest(BaseModel):
    """Officer action — status and/or assignee (PATCH /grievances/{id}/status)."""

    status: str | None = None
    assignee: str | None = None


class HfEngine(BaseModel):
    category: str
    priority: str
    isUrgent: bool = False
    keywords: list[str] = Field(default_factory=list)
    explanation: str = ""
    rawCategoryLabel: str = ""
    categoryConfidence: float = 0.0
    urgentMatches: list[str] = Field(default_factory=list)
    modelInfo: dict = Field(default_factory=dict)

class StateTransitionRequest(BaseModel):
    to_state: str
    reason: str

class AssignRequest(BaseModel):
    departmentId: str
    ownerId: str
    dueDate: str | None = None
    reason: str
    overrideAi: bool = False

class ReassignRequest(BaseModel):
    ownerId: str
    departmentId: str | None = None
    reason: str

class ProgressUpdateRequest(BaseModel):
    bodyInternal: str
    bodyCustomer: str | None = None
    visibility: str = "internal"
    kind: str = "note"
    etaClass: str | None = None
    workCompleted: str | None = None
    currentSituation: str | None = None
    nextAction: str | None = None

class PriorityUpdateRequest(BaseModel):
    priority: str
    reason: str

class DeadlineUpdateRequest(BaseModel):
    dueDate: str
    reason: str

class EscalationRequest(BaseModel):
    reason: str
    targetDept: str | None = None

class ResolutionRequest(BaseModel):
    text: str
    actions: list[str] = Field(default_factory=list)

class CloseRequest(BaseModel):
    reason: str

class WithdrawRequest(BaseModel):
    reason: str

class ReopenRequest(BaseModel):
    reason: str

class RejectRequest(BaseModel):
    reason: str

class ReturnResolutionRequest(BaseModel):
    reason: str
