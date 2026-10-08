# ROLE_INTERFACES — Per-Role UI Spec

> Existing surfaces: `/submit` + `MyGrievances.tsx`, `/track`, `/admin` table + `GrievanceReviewModal.tsx`, `/admin/analytics`, `/login|/register|/auth/callback`. No employee/manager/superadmin views yet.

## CUSTOMER (`USER`) — [EXISTING list/detail, NEW timeline/feedback]

- See: own grievances, current status (customer wording), dept (no staff PII), latest customer-visible update, expected date, evidence submitted, resolution + feedback form.
- Do: submit (title/desc/location/photo), track by ID, withdraw with reason, escalate own, confirm/rate resolution.
- Hide: internal notes, assignee identity beyond role/dept, AI reasoning, audit IPs.
- Timeline: Submitted → Dept assigned → Work started → Progress updates → Resolution → Closed (see `PROGRESS_FLOW.md`). No raw `open/assigned` strings — map to friendly labels.

## DEPARTMENT EMPLOYEE (`RESOLVER`) — [NEW] `/resolver` or `/employee`

- Queue: assigned only (priority, SLA, age), filters by overdue/blocked.
- Detail: customer info + evidence + AI panel (read-only) + assignment memo + history.
- Actions: start work, post progress update (visibility default internal, opt customer-visible), upload evidence/report, mark blocked with reason, submit resolution (propose), request escalation/reassign.
- Must answer: done / happening / blocked / remaining / resolved?
- Cannot: assign to others, change deadline, close, see other depts.

## DEPARTMENT MANAGER (`ADMIN`, dept scope) — [MODIFY `/admin`]

- Keep lean table + review modal; add: pending triage, high-priority, overdue, workload by employee, escalation inbox, resolution review queue.
- Actions: assign/reassign (with reason, history preserved), set priority/deadline, approve/return resolution, approve/reject escalation, nudge overdue.
- Supervise without doing employee work: bulk view, not per-ticket spelunking.
- Scope: own department writes; all-read optional behind `can_view_all`.

## SUPERADMIN (system) — [NEW] `/superadmin` or `/admin/system`

- System grievance overview, all departments, escalations, SLA breaches.
- Users: list/search, disable/enable, reset; Admins: create/disable, assign roles.
- Roles: CRUD; Permissions: CRUD + grant/revoke to roles; Departments: CRUD + assign manager.
- Audit trail viewer, system analytics, config (SLA defaults per category/priority).
- Every action reason-required + audited; override banner when acting as officer.
- Narrowest default: read-only unless explicit action; no silent bypass.

## ADMIN vs SUPERADMIN guardrails (from owner spec)

- ADMIN: manage users, assign **existing** roles, revoke non-admin access, manage employees/managers in scope, handle escalations, grievance oversight. Cannot touch admins/roles/permissions/departments.
- SUPERADMIN: everything above system-wide + admin/role/permission/department management.
- Frontend hides; backend denies (403 + audit `auth.forbidden`).
