# DATABASE_CHANGES — Required Model Deltas

> Today: `grievances` (`backend/app/db.py:36-62`, indexes `uniq_grievance_id`, `user_created`) + `users` (`users_db.py:59-65`, `uniq_user_email`). `docs/DATABASE.md:128-137` roadmap lists the rest as deferred. No migrations (Mongo, startup `ensure_indexes`). DO NOT migrate yet — spec only.

## [MODIFY] `grievances`

Add: `departmentId, ownerId, managerId, state (upper canonical) + legacy `status` adapter, dueDate (BSON date), resolvedAt/closedAt, updatedAt, stateHistory[], assignmentHistory[], priorityHistory[], deadlineHistory[], escalationIds[], resolution{}, closure{reason,by,at}, visibilityDefault`.
Keep: `id GRV-YYYY-NNNN` allocator (`db.py:175-213` + retry), `hfEngine`, `imageValidation {llm_score,explanation,raw}`.
Indexes add: `{departmentId, state, dueDate}`, `{ownerId, state}`, `{state, dueDate}`, text `{title, description}` (or Atlas Search later).

## [MODIFY] `users`

Add: `role enum(USER,RESOLVER,ADMIN,SUPERADMIN)`, `departmentId?`, `isActive`, `createdAt/updatedAt`, `google_id/avatar_url` keep. Index `{role, departmentId, isActive}`, `{departmentId}`.

## [NEW] collections

- `departments {_id, name, key, managerId, isActive}` — unique `key`.
- `roles {_id, key, label, isSystem}` + `permissions {_id, key, label}` + `role_permissions {roleId, permissionId}` (or embedded `permissions[]` v1).
- `progress_updates` (see `PROGRESS_FLOW.md`) — index `{grievanceId, createdAt}`, `{grievanceId, visibility}`.
- `assignments` mirror (if not embedded) — index `{grievanceId, at}`.
- `escalations {grievanceId, from,to, reason, aiRec?, by, at, status}` — index `{status, at}`.
- `resolutions {grievanceId, text, actions, type, by, at, approval{by,at,note}}`.
- `notifications {userId, kind, entityId, title, isRead, at}` — index `{userId, isRead, at}`.
- `audit_logs {actorId, actorRole, action, entity, entityId, old, new, at, reason, source}` — index `{entityId, at}`, `{actorId, at}`. Immutable (no update API).
- `sla_config {category, priority, days}` — seeds `{high:3, medium:7, low:14}` to replace `sla.ts`.

## Rules

- Histories append-only; `ownerId` single current + history preserved.
- `createdAt/dueDate` BSON dates, ISO over API (`db.py:167-174` pattern).
- PII: no staff email/phone in grievance doc; join on read with scope.
