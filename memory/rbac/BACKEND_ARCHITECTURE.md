# BACKEND_ARCHITECTURE — Layer Contracts

> Today: `backend/app/main.py:1-122` (app+CORS+handlers+seed), `routers/grievances.py:43-207` (submit does validation+image+classify+persist inline), `db.py:25-37` protocol, `services/classification.py` + `services/image.py`. No service/workflow/audit/notification layers.

## Target

```
Router (HTTP) → Service (business+AuthZ+transitions) → Repository (Mongo) → DB
                ↘ AI Service | Notification Service | Audit
```

## Responsibilities

- **Router**: auth dep (`get_current_user/get_optional_user/require_role→require_permission`), Pydantic validate, call service, format `{error}` / zod shape, map 400/401/403/404/422. No classification math, no transition rules, no direct `repository` writes for domain ops. `[MODIFY]`
- **Service** (`GrievanceService, AssignmentService, ProgressService, EscalationService, UserService, DepartmentService, RoleService`): owns state machine, ownership/deadline rules, visibility filtering, side-effects ordering (persist → history → notify → audit). `[NEW]`
- **Repository**: `GrievanceRepository` + new `Users/Progress/Assignment/Audit/Notification/Department/Role` repos; query + index logic only. `[MODIFY+NEW]`
- **AI Service**: wraps `services/classification.py` cascade (HF→Groq→keywords), image confidence, future similarity/assignment/risk/quality. Returns `{value, confidence, model, reason}`; never persists privileged transitions. `[MODIFY wrap]`
- **Notification Service**: event → recipients → `notifications` docs; delivery in-app v1 (email/SMS deferred per PRD). `[NEW]`
- **Cache**: none required prototype-scale; add only with measured need. No Redis.

## Contracts (sketch)

- `GrievanceService.transition(id, to_state, actor, reason)` → validates table + role + dept, appends history, sets owner/dates, emits `grievance.state_changed`.
- `ProgressService.add(id, actor, payload)` → validates assignment, stores update, emits `progress.added {visibility}`.
- `AssignmentService.assign/reassign(...)` → validates manager scope, preserves history.
- Repos: `create/get/list/update` + `append_history`; no HTTP, no AuthZ inside repo (service passes scoped filter).

## Rules

1. No business logic in routers or `lib/*.tsx` beyond display.
2. AI output is `recommendation`, human action is `decision` — separate fields.
3. Every privileged write emits audit (actor/role/action/entity/old→new/at/reason/source).
