# PROGRESS_FLOW — Updates as First-Class Data

> Today: no update entity. Only free `status/assignee` patch + `hfEngine.explanation`. Customer sees `StatusTimeline` in `GrievanceCard.tsx` from raw status. This spec makes employee work visible without leaking internals.

## Conceptual flow

```
EMPLOYEE composes update → GRIEVANCE timeline (append-only)
→ MANAGER sees all → SUPERADMIN on escalations/audit
→ customer-visible subset transformed → CUSTOMER timeline
```

## Visibility enum (per update)

- `internal` — employee/manager only (diagnosis, staffing, sensitive notes). Never to customer.
- `manager` — manager+admin review (default for blockers/escalation requests until triaged).
- `customer` — safe to show (what was done, what next, ETA class).
- `system` — generated (assigned, SLA breach, escalated, resolved, closed).

Rule: default `internal`; author opts into `customer` via checkbox + preview; manager can promote/demote with reason. Blocked/escalation internals stay `manager` until manager publishes a customer-safe summary.

## Update schema [NEW] `progress_updates`

- `id, grievanceId, authorId, authorRole, createdAt`
- `stateAtWrite` (canonical state), `kind: note|start|block|resume|evidence|resolution_proposal|escalation_request`
- `workCompleted, currentSituation, nextAction, etaClass` (no exact staff promises; ETA from `due_date` class)
- `bodyCustomer` (optional, required if `visibility=customer`), `bodyInternal`
- `attachments[]` (Cloudinary `publicId+url+score`), `visibility`, `escalationReason?`
- Immutable; edit = new update superseding.

## Customer timeline (rendered from `customer+system` only)

Submitted → Dept assigned → Work started → Progress update(s) → Further action → Resolution under review → Resolved → Closed. Each row: date, friendly title, 1–2 line summary, evidence thumbnail if customer-safe. Never: internal comments, staff PII, AI chain-of-thought, security details.

## Backend rules

- `POST /grievances/{id}/progress` (EMPLOYEE assigned / MANAGER dept / SUPERADMIN). Validate state allows notes. Writes history + notification fan-out.
- Timeline read: role-filtered projection (`USER` gets `customer+system`; staff get all).
- Evidence via existing `/validate-image|/sign-cloudinary` but require auth (today unauthenticated — fix, see `NOTIFICATION_FLOW.md` risks).
