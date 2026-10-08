# RBAC Spec Suite — Index

> Location: `memory/rbac/` — implementation-ready specs for the role-based grievance workflow.
> Codebase is source of truth for `[EXISTING]`; requirements are `[NEW]`/`[MODIFY]`.
> See `memory/DECISIONS.md` DEC-007 (roles), DEC-006 (state machine), DEC-017 (auth/RBAC), DEC-018 (admin UI).

## Files

| File | Covers |
|---|---|
| `RBAC.md` | Role defs, CUSTOMER/EMPLOYEE/MANAGER/ADMIN/SUPERADMIN mapping, permission matrix, authorization rules |
| `AUTHENTICATION.md` | Existing JWT/OAuth reality vs stale docs, token lifecycle, what to harden |
| `ROLE_INTERFACES.md` | Per-role dashboards, actions, visibility |
| `GRIEVANCE_WORKFLOW.md` | End-to-end lifecycle, state machine, transition table |
| `PROGRESS_FLOW.md` | Progress updates as first-class data, internal vs customer-visible, customer timeline |
| `TICKET_MANAGEMENT.md` | Ticket model, ownership, assignment, priority/deadline |
| `BACKEND_ARCHITECTURE.md` | Router → Service → Repository boundaries + AI/notification contracts |
| `API_CONTRACTS.md` | Required endpoints, auth/role per endpoint, audit/notification side-effects |
| `DATABASE_CHANGES.md` | Collections/fields/indexes required, no migration yet |
| `NOTIFICATION_FLOW.md` | Triggers/recipients + audit trail + security risks |
| `IMPLEMENTATION_CHECKLIST.md` | Phased checklist with dependency order |

## Status tags

- `[EXISTING]` — code exists, keep.
- `[MODIFY]` — code exists, must change.
- `[NEW]` — not in tree, to build.
- `[DEPRECATED]` — do not use (e.g. `frontend/lib/roles.ts` substring rule, `frontend/lib/sla.ts` as source of truth).

## Canonical role mapping (proposal, see `RBAC.md`)

| Spec term | Code term | Notes |
|---|---|---|
| CUSTOMER | `USER` | Citizen, JWT `role=USER` |
| DEPARTMENT EMPLOYEE | `RESOLVER` | Dept staff, assigned-only |
| DEPARTMENT MANAGER | `ADMIN` (department scope) | Triage, assign, review |
| ADMIN (system) | `SUPERADMIN` | Owns admins/roles/permissions/departments |

`RESOLVER` sees all today — scoping to assigned is `[MODIFY]`.
Department scoping for `ADMIN` is `[NEW]`.
System `SUPERADMIN` powers (role/permission CRUD, admin management) are `[NEW]`.
