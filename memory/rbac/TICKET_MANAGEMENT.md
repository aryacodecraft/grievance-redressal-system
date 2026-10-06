# TICKET_MANAGEMENT — Ownership, Assignment, Priority/Deadline

> Today: `backend/app/db.py:47-62` doc = `id/title/desc/userId/status/category/priority/createdAt/imageUrl/lat/long/assignee/hfEngine`. `assignee` is free-text dept (`routers/grievances.py:283-289`). No owner FK, no history, no `due_date`. SLA is display-only `frontend/lib/sla.ts:1+` (`createdAt+3/7/14d`).

## Ticket fields (target)

Core: `id GRV-YYYY-NNNN [EXISTING], customerId, departmentId [NEW], category, priority, state [MODIFY upper], ownerId (current responsible) [NEW], managerId, createdAt/updatedAt, dueDate [NEW], resolvedAt/closedAt [NEW], evidence[], resolution{}, closure{}, ai{} [EXISTING hfEngine]`.

Histories (append-only): `statusHistory[], assignmentHistory[], priorityHistory[], deadlineHistory[], progressIds[], escalationIds[], auditRef`.

## Ownership (always answerable)

- `ownerId` = next actor (employee once ASSIGNED, manager when unassigned/escalated/under-review).
- `departmentId` set at assign; `managerId` = assigning manager.
- Who can view/modify/escalate derives from `RBAC.md` + dept match.

## Assignment [NEW endpoints, MODIFY storage]

- Assign: MANAGER dept (`dept + owner + due + reason`) → ASSIGNED. AI recommendation shown (DEC-003) but human approves.
- Reassign: MANAGER/SUPERADMIN with `reason`; mark prior inactive, `reassignCount++`; never overwrite.
- `assignmentHistory`: `{fromOwner,toOwner,byRole,reason,at,aiRec?}`.
- Team assignment deferred; `ownerId` single + `watchers[]` optional.

## Priority & deadline [NEW server truth]

- Priority `low|medium|high (+critical? — decide, reversible)`; initial from classifier (`services/classification.py`), manager override with reason.
- `dueDate` set at ASSIGN from `sla_config{category,priority→days}` (answers PRD OQ-005); `sla.ts` heuristic `[DEPRECATED]` as truth, keep as fallback display until server ships.
- Auto-escalate visibility: overdue / due-in-24h / inactive-N-days surface in manager queue + notifications; auto priority bump requires MANAGER approve (no silent AI writes).
- All changes versioned with actor/reason.
