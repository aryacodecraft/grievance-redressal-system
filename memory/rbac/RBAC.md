# RBAC Specification

> Source of truth: `backend/app/auth.py:107-123` (`require_role`), `backend/app/routers/grievances.py:210-301` (enforcement), `backend/app/routers/auth.py:135-148` (register hard-codes `role=USER`), `backend/app/users_db.py:1-125`, `frontend/lib/roles.ts:1-24` (demo only).

## 1. Roles

### [EXISTING] `USER` = CUSTOMER
- Grievance raiser. Registers via `POST /auth/register` → always `USER`.
- Sees own grievances only (`GET /grievances` forces `user_id=current`, `GET /grievances/{id}` 404s on others).
- Can submit (JWT identity wins; body `userId` only in demo mode).

### [EXISTING, MODIFY scope] `RESOLVER` = DEPARTMENT EMPLOYEE
- Exists in `require_role(["ADMIN","SUPERADMIN","RESOLVER"])` for `PATCH status`.
- Today sees **all** grievances (same as ADMIN) — must narrow to assigned/department-only.

### [EXISTING, MODIFY scope] `ADMIN` = DEPARTMENT MANAGER
- Today: full triage via `/admin` table + `GrievanceReviewModal` (assign/resolve, `AdminBoard.tsx`).
- Intended: department scope (own department queue, workload, overdue, reassign, priority/deadline, resolution review).
- Must lose system powers below (move to SUPERADMIN).

### [EXISTING string, NEW powers] `SUPERADMIN` = SYSTEM ADMIN
- String already accepted by backend; no dedicated UI/APIs yet.
- Requested powers (all `[NEW]` except grievance read):
  - Manage Admins (create/disable, promote/demote)
  - Create/Delete Roles
  - Create/Modify Permissions
  - Grant/Revoke Permissions
  - Assign Roles to Admins
  - Manage Departments (CRUD + assign manager)
  - Full System Control (users, config, audit, override with audit)

`SUPERADMIN` bootstrap: env seed (`SEED_ADMIN_EMAIL` pattern in `backend/app/main.py:86-110`) + first-promotion script. No self-promotion API.

## 2. Permission matrix (target)

| Action | CUSTOMER (`USER`) | EMPLOYEE (`RESOLVER`) | MANAGER (`ADMIN`) | SUPERADMIN |
|---|---|---|---|---|
| Submit grievance | YES | YES (on behalf allowed, audited) | YES | YES |
| View own grievance | YES | own-assigned + own-submitted | YES (dept) / all read | YES all |
| View all / dept queue | NO | NO (assigned only) | YES dept (+all read) | YES |
| Assign / reassign | NO | NO (may request) | YES dept | YES (override, audited) |
| Update progress | NO | YES assigned | YES | YES |
| Change status | NO (withdraw only) | YES assigned (limited transitions) | YES dept | YES |
| Change priority | NO | propose only | YES dept | YES |
| Set/change deadline | NO | NO | YES dept | YES |
| Escalate / request escalation | YES own | YES assigned | YES | YES |
| Submit resolution | NO | YES propose assigned | YES | YES |
| Approve resolution / close | NO | NO | YES dept | YES |
| Withdraw own | YES + reason | — | YES (any, with reason) | YES |
| Reject | NO | NO | YES dept + reason | YES |
| Manage users (non-admin) | NO | NO | YES | YES |
| Manage admins | NO | NO | NO | YES |
| Role CRUD / permission CRUD / grant-revoke | NO | NO | NO (assign existing only) | YES |
| Department CRUD / assign manager | NO | NO | NO (view) | YES |
| View audit (dept / all) | own only | assigned only | dept | all |
| Analytics | NO | limited (own workload) | dept | system |

## 3. Authorization rules

1. AuthN ≠ AuthZ. Frontend gates (`AdminGate.tsx`, `roles.ts`) are UX only. Backend `Depends(require_role)` + resource checks are the boundary. [EXISTING pattern, extend]
2. JWT `role` must be re-validated against `users` collection on sensitive ops (role change takes effect ≤ access-token expiry; refresh re-issues from DB). [MODIFY — `auth.py:_decode` + `routers/auth.py:160-172` refresh path]
3. Resource checks: `USER` → `doc.userId == token.sub`; `RESOLVER` → `doc.assigneeId == token.sub OR dept match`; `ADMIN` → `doc.department == admin.department` (or all-read with dept-write); `SUPERADMIN` → all. [MODIFY `routers/grievances.py:210-259`]
4. Demo/unauthenticated fallback (`get_optional_user` → body `userId`) is `[DEPRECATED]` for prod; keep only behind explicit `ALLOW_DEMO_SUBMIT` flag, never for officer writes.
5. Role escalation (promote to `ADMIN`/`SUPERADMIN`, grant permission) → `SUPERADMIN` only, requires reason, writes audit. [NEW]
6. `roleForEmail()` substring `includes("admin")` (`frontend/lib/roles.ts:15`) is `[DEPRECATED]` — delete when server roles are sole source.

## 4. What to build

- [NEW] `departments` collection + `users.departmentId` + `users.role` FK.
- [NEW] `roles` / `permissions` / `role_permissions` (or static permission map v1 + CRUD v2 — decide at build, reversible).
- [NEW] `require_permission("grievance.assign")` building on `require_role`.
- [MODIFY] Narrow `RESOLVER` list/get to assigned; scope `ADMIN` writes by department.
- [NEW] `/users`, `/roles`, `/permissions`, `/departments` admin APIs (see `API_CONTRACTS.md`).
