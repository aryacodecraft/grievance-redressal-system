"""Grievance state machine — canonical states and transition table.

Role strings match the JWT/DB values: USER, RESOLVER, ADMIN, SUPERADMIN.
The special token SYSTEM is used for automated transitions (AI, SLA cron).
"""

from __future__ import annotations

from enum import Enum

from fastapi import HTTPException


class GrievanceState(str, Enum):
    SUBMITTED = "SUBMITTED"
    AI_PROCESSING = "AI_PROCESSING"
    PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT"
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    RESOLUTION_SUBMITTED = "RESOLUTION_SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    REOPENED = "REOPENED"


# Role aliases for readability (matching actual JWT/DB strings)
_SA = "SUPERADMIN"
_AD = "ADMIN"      # dept manager
_RE = "RESOLVER"   # dept employee
_US = "USER"       # citizen
_SY = "SYSTEM"     # automated

S = GrievanceState

# (from_state, to_state) → frozenset of allowed roles
TRANSITIONS: dict[tuple[GrievanceState, GrievanceState], frozenset[str]] = {
    # AI/system processing
    (S.SUBMITTED, S.AI_PROCESSING):         frozenset({_SY}),
    (S.SUBMITTED, S.PENDING_ASSIGNMENT):    frozenset({_SY, _AD, _SA}),
    (S.AI_PROCESSING, S.PENDING_ASSIGNMENT): frozenset({_SY}),

    # Assignment
    (S.PENDING_ASSIGNMENT, S.ASSIGNED):     frozenset({_AD, _SA}),
    (S.SUBMITTED, S.ASSIGNED):              frozenset({_AD, _SA}),  # direct assign

    # Work start
    (S.ASSIGNED, S.ACCEPTED):              frozenset({_RE, _AD, _SA}),
    (S.ACCEPTED, S.IN_PROGRESS):           frozenset({_RE, _AD, _SA}),
    (S.ASSIGNED, S.IN_PROGRESS):            frozenset({_RE, _AD, _SA}),

    # Work in progress
    (S.IN_PROGRESS, S.BLOCKED):             frozenset({_RE, _AD, _SA}),
    (S.ACCEPTED, S.BLOCKED):               frozenset({_RE, _AD, _SA}),
    (S.BLOCKED, S.IN_PROGRESS):             frozenset({_RE, _AD, _SA}),

    # Resolution path
    (S.IN_PROGRESS, S.RESOLUTION_SUBMITTED):  frozenset({_RE, _SA}),
    (S.BLOCKED, S.RESOLUTION_SUBMITTED):      frozenset({_RE, _SA}),
    (S.RESOLUTION_SUBMITTED, S.UNDER_REVIEW): frozenset({_AD, _SA}),
    (S.UNDER_REVIEW, S.RESOLVED):             frozenset({_AD, _SA}),
    (S.UNDER_REVIEW, S.IN_PROGRESS):          frozenset({_AD, _SA}),  # return
    (S.RESOLUTION_SUBMITTED, S.RESOLVED):     frozenset({_AD, _SA}),  # direct approve

    # Closure
    (S.RESOLVED, S.CLOSED):                 frozenset({_SY, _AD, _SA}),
    (S.REOPENED, S.CLOSED):                 frozenset({_AD, _SA}),

    # Reopen
    (S.RESOLVED, S.REOPENED):              frozenset({_US, _AD, _SA}),

    # Escalation (from any active state)
    (S.SUBMITTED, S.ESCALATED):            frozenset({_US, _RE, _AD, _SA}),
    (S.PENDING_ASSIGNMENT, S.ESCALATED):   frozenset({_US, _RE, _AD, _SA}),
    (S.ASSIGNED, S.ESCALATED):             frozenset({_US, _RE, _AD, _SA}),
    (S.ACCEPTED, S.ESCALATED):             frozenset({_US, _RE, _AD, _SA}),
    (S.IN_PROGRESS, S.ESCALATED):          frozenset({_US, _RE, _AD, _SA}),
    (S.BLOCKED, S.ESCALATED):              frozenset({_US, _RE, _AD, _SA}),
    (S.ESCALATED, S.ASSIGNED):             frozenset({_AD, _SA}),
    (S.ESCALATED, S.IN_PROGRESS):          frozenset({_AD, _SA}),

    # Withdrawal
    (S.SUBMITTED, S.WITHDRAWN):            frozenset({_US, _AD, _SA}),
    (S.PENDING_ASSIGNMENT, S.WITHDRAWN):   frozenset({_US, _AD, _SA}),
    (S.ASSIGNED, S.WITHDRAWN):             frozenset({_US, _AD, _SA}),
    (S.IN_PROGRESS, S.WITHDRAWN):          frozenset({_AD, _SA}),   # needs manager

    # Rejection
    (S.SUBMITTED, S.REJECTED):             frozenset({_AD, _SA}),
    (S.PENDING_ASSIGNMENT, S.REJECTED):    frozenset({_AD, _SA}),
    (S.ASSIGNED, S.REJECTED):              frozenset({_AD, _SA}),
    (S.IN_PROGRESS, S.REJECTED):           frozenset({_AD, _SA}),

    # Reopen → back to work
    (S.REOPENED, S.IN_PROGRESS):           frozenset({_AD, _SA, _RE}),
}


def transition_state(current_state: str, to_state: str, actor_role: str) -> None:
    """Validate a state transition.  Raises HTTPException(422) on failure."""
    # SUPERADMIN can force any valid state (logged separately)
    if actor_role == _SA:
        try:
            GrievanceState(to_state.upper())
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Unknown state: {to_state}")
        return

    try:
        cs = GrievanceState(current_state.upper())
        ts = GrievanceState(to_state.upper())
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid state value: '{current_state}' → '{to_state}'")

    allowed = TRANSITIONS.get((cs, ts))
    if not allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Transition {cs.value} → {ts.value} is not permitted",
        )
    if actor_role not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Role {actor_role} cannot perform {cs.value} → {ts.value}",
        )


# ── Legacy status adapter ─────────────────────────────────────────────────────
# Maps old lowercase free-string statuses stored in DB to canonical uppercase states.

_STATUS_COMPAT: dict[str, str] = {
    "open": "SUBMITTED",
    "assigned": "ASSIGNED",
    "accepted": "ACCEPTED",
    "in_progress": "IN_PROGRESS",
    "resolved": "RESOLVED",
    "closed": "CLOSED",
    "escalated": "ESCALATED",
    "rejected": "REJECTED",
    "withdrawn": "WITHDRAWN",
    "reopened": "REOPENED",
    "resolution_submitted": "RESOLUTION_SUBMITTED",
    "under_review": "UNDER_REVIEW",
    "pending_assignment": "PENDING_ASSIGNMENT",
    "blocked": "BLOCKED",
    "ai_processing": "AI_PROCESSING",
}
