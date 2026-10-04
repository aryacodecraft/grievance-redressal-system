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
