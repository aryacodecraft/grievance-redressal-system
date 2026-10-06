# API_CONTRACTS — Workflow Endpoints

> Implemented today (see `docs/API.md:16-32`): `GET /health`, `POST /submit-grievance`, `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status`, image routes, `/auth/*`. Everything below with `[NEW]`/`[MODIFY]` keeps those paths stable.

## Conventions

- Base `http://localhost:10000`. Errors flat `{"error": "..."}` (`main.py:41-75`). Auth `Authorization: Bearer`. Citizen scoping server-side. 422 = bad transition, 403 = wrong role/scope.
- Each endpoint doc must state: method/path, auth, role/permission, request/response (zod+Pydantic), validation, errors, side-effects (history/audit/notify), cache impact (none v1).

## Grievances

- `POST /submit-grievance` [EXISTING, MODIFY] — auth optional (demo flag); authed → JWT id wins. Resp `{message, grievanceId, hfEngine}`. Audit `grievance.created`.
- `GET /grievances?userId=&limit=&state=&dept=&overdue=` [MODIFY] — `USER` forced self; `RESOLVER` forced assigned; `ADMIN` dept default; `SUPERADMIN` all. `limit 1..1000`.
- `GET /grievances/{id}` [MODIFY] — resource check per RBAC; `USER` non-own → 404 (no oracle).
- `POST /grievances/{id}/progress` [NEW] — EMPLOYEE assigned / MANAGER dept / SUPERADMIN. Body `{bodyInternal, bodyCustomer?, visibility, kind, etaClass?, attachments?}`. → history + notify (customer only if `customer`).
- `POST /grievances/{id}/assign|/reassign` [NEW] — MANAGER dept / SUPERADMIN. `{departmentId, ownerId, dueDate?, reason, overrideAi?}`.
- `PATCH /grievances/{id}/state` [NEW canonical; keep `/status` as compat] — `{to_state, reason}` validated by machine.
- `PATCH priority|deadline`, `POST escalate|resolution|close|withdraw|reopen|reject` [NEW] — roles per matrix; all reason-required; all audited + notified.
- `GET /grievances/{id}/history` [NEW] — role-filtered (customer projection hides internal).

## System (SUPERADMIN-first)

- `GET /users?role=&dept=&q=` [NEW] — SUPERADMIN all, ADMIN dept/non-admin.
- `POST /users/{id}/roles` [NEW] — SUPERADMIN only `{role, reason}`; no self-demote to zero admins (guard: ≥1 SUPERADMIN remains).
- `CRUD /roles`, `CRUD /permissions`, `POST /roles/{id}/grant|revoke` [NEW] — SUPERADMIN only.
- `CRUD /departments`, `POST /departments/{id}/manager` [NEW] — SUPERADMIN write, staff read.
- `GET /admin/overview|workload|overdue|escalations` [NEW] — MANAGER dept, SUPERADMIN all.
- `GET /notifications`, `PATCH /notifications/{id}/read|/read-all` [NEW] — own only.
- `GET /audit?entity=&actor=` [NEW] — MANAGER dept, SUPERADMIN all.

## Hardening (do with above)

- Require auth on `/validate-image|/sign-cloudinary|/delete-cloudinary` (today open) + SSRF guard on `imageUrl` fetch (`services/image.py:145` `requests.get` — allowlist scheme/host, size/timeout, block 169.254/10/172.16/192.168). [MODIFY]
- `getGrievance()` in `frontend/lib/api.ts:194-210` bypasses Bearer (raw `fetch`) — must send token or citizen private docs leak via IDOR guess. [MODIFY]
