# GRIEVANCE_WORKFLOW — Lifecycle + State Machine

> Code today: `backend/app/db.py:47-62` doc has free-string `status` (default `open` in `routers/grievances.py:181`, `to_api` fallback `open`), blank rejected (`routers/grievances.py:270-282`). No transition validation, no history. Target: DEC-006 / `docs/WORKFLOWS.md:10-52` 12 uppercase states. Four vocabularies pinned in `tests/test_status_vocabularies.py` — reconcile here.

## End-to-end (target)

```
CUSTOMER submit → SYSTEM AI_PROCESSING → PENDING_ASSIGNMENT → MANAGER assign
→ ASSIGNED → EMPLOYEE start → IN_PROGRESS ↔ (BLOCKED/WAITING*)
→ RESOLUTION_SUBMITTED → UNDER_REVIEW → RESOLVED → CLOSED (customer confirm / auto)
Alt: ESCALATED, REASSIGNED (event, not state), REOPENED, REJECTED, WITHDRAWN/CANCELLED
```

`*` Keep `IN_PROGRESS+blocked_flag` if 12-state freeze preferred; else add `WAITING/BLOCKED` as explicit state. Decide at Phase 2, reversible.

## Minimum clean states (proposal — maps old lowercase)

| Canonical | Old code | Who sets | Requires | Customer sees |
|---|---|---|---|---|
| SUBMITTED | `open` | SYSTEM on create | title/desc/userId | "Submitted" |
| AI_PROCESSING | — (sync cascade today) | SYSTEM | — | "Reviewing" (or fold into Submitted) |
| PENDING_ASSIGNMENT (NOT_REVIEWED) | — | SYSTEM post-AI | ai summary | "Assigned to department (pending officer)" |
| ASSIGNED | `assigned` | MANAGER/SUPERADMIN | dept + owner + due_date | "Assigned to {Dept}" |
| IN_PROGRESS | `in_progress` | EMPLOYEE (assignee) | start note | "Work started" + latest visible update |
| BLOCKED* | — | EMPLOYEE | blocker reason | "Paused — {reason class}" |
| RESOLUTION_SUBMITTED | — | EMPLOYEE | resolution text + actions | "Resolution under review" |
| UNDER_REVIEW | — | SYSTEM (flag) / MANAGER | QA or manual | same as above |
| RESOLVED | `resolved` | MANAGER approve | approval note | resolution + feedback CTA |
| CLOSED | `closed`* | SYSTEM (feedback window) / MANAGER/SUPERADMIN | feedback or approval | "Closed" + receipt |
| ESCALATED | `escalated`* | MANAGER/SUPERADMIN | target + reason | "Escalated for priority handling" |
| REJECTED | `rejected`* | MANAGER/SUPERADMIN | reason | "Closed — not actionable ({reason class})" |
| WITHDRAWN | — | CUSTOMER (+MANAGER approve if in-progress) | reason | "Withdrawn" |
| REOPENED | — | CUSTOMER (window) / MANAGER | reason | "Reopened" |

`*` lowercase exists only in UI filter strings today, not enforced.

## Transition table (enforce server-side, 422 on invalid)

| From | Action | To | Actor |
|---|---|---|---|
| SUBMITTED | AI done | PENDING_ASSIGNMENT | SYSTEM |
| PENDING_ASSIGNMENT | assign (dept+owner+due) | ASSIGNED | MANAGER/SUPERADMIN |
| ASSIGNED | start | IN_PROGRESS | EMPLOYEE assignee / MANAGER |
| IN_PROGRESS | progress note | IN_PROGRESS | EMPLOYEE |
| IN_PROGRESS | block | BLOCKED | EMPLOYEE |
| BLOCKED | resume | IN_PROGRESS | EMPLOYEE/MANAGER |
| IN_PROGRESS/BLOCKED | submit resolution | RESOLUTION_SUBMITTED | EMPLOYEE |
| RESOLUTION_SUBMITTED | approve | RESOLVED | MANAGER/SUPERADMIN |
| RESOLUTION_SUBMITTED | return | IN_PROGRESS | MANAGER (reason) |
| RESOLVED | feedback/expire | CLOSED | SYSTEM/MANAGER |
| RESOLVED | reopen (window) | REOPENED → IN_PROGRESS | CUSTOMER/MANAGER |
| ANY active | escalate | ESCALATED | CUSTOMER/EMPLOYEE/MANAGER (approve path) |
| ESCALATED | reassign+resume | ASSIGNED | MANAGER/SUPERADMIN |
| PENDING/ASSIGNED/IN_PROGRESS | reject | REJECTED | MANAGER/SUPERADMIN |
| SUBMITTED/ASSIGNED/IN_PROGRESS | withdraw | WITHDRAWN | CUSTOMER (+approve) |

Every transition: actor, role, from→to, reason, timestamp, `source=HUMAN|AI|SYSTEM`. History immutable, never overwrite.

## Implementation notes

- [MODIFY] `StatusUpdateRequest` (`backend/app/models.py:43-47`) → `{to_state, reason, assignee?, due_date?, visibility?}`; validate against table + role.
- [NEW] `grievance_status_history` (collection or embedded `history[]` + audit mirror — pick embedded for reads, mirror critical to `audit_logs`).
- [MODIFY] Normalize stored states to UPPER; add read adapter for old `open/assigned/...` docs.
- AI (classify/priority in `services/classification.py`) may recommend, never transition privileged states.
