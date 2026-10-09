# API.md — API Endpoint Documentation

> Status: **PARTIALLY IMPLEMENTED (2026-09-11).** The "Implemented endpoints"
> table below reflects what `backend/app/routers/*` actually serves today;
> everything else in this document is the PLANNED surface for later phases.
> Authentication: JWT authentication is enforced for grievance submission and
> workflow endpoints. The `Authorization: Bearer <token>` scheme is required
> for these protected routes; legacy image/admin hardening remains tracked in
> `docs/SECURITY.md`.

---

## Base URL

Development: `http://localhost:10000`

### Implemented endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Returns `{ "status", "storage" }` — `storage` is `mongodb` or `in-memory` |
| `GET` | `/test` | Legacy smoke-test route |
| `POST` | `/submit-grievance` | **Authenticated users only.** Creates a grievance using the verified JWT owner; runs the AI classifier cascade. Returns `{ "message", "grievanceId", "hfEngine" }` |
| `GET` | `/grievances` | Authenticated list; citizens/resolvers are token-scoped, staff see authorized scope; optional `?limit=` (default `50`, must be `1..1000`) |
| `GET` | `/resolver/tasks` | Authenticated resolver's assigned work, strictly scoped by token owner ID and independent of department aliases |
| `GET` | `/grievances/department-counts` | Aggregate totals by category; no individual grievance data is returned |
| `GET` | `/grievances/{grievance_id}` | Single grievance; public reference lookup returns a limited tracking projection; `404` if unknown |
| `GET` | `/grievances/{grievance_id}/history` | Full history for authorized accounts; anonymous/non-owner tracking receives customer-visible/system updates only |
| `PATCH` | `/grievances/{grievance_id}/status` | Officer action: `{ status?, assignee? }` — blank/whitespace-only values are `400`; surrounding whitespace is trimmed. No auth and no transition rules yet (Phase 1/2). |
| `POST` | `/validate-image` | Image validation |
| `POST` | `/sign-cloudinary` | Cloudinary upload signature |
| `POST` | `/delete-cloudinary` | Cloudinary asset removal |

> **Naming note:** the implemented create route is `POST /submit-grievance`
> (kept for parity with the legacy client), not `POST /grievances` as
> originally planned below. Interactive docs: `http://localhost:10000/docs`.

Authenticated `RESOLVER` requests to `GET /grievances` are always restricted to
the caller's `ownerId` assignments. A department filter is optional; omitting
it must not restrict the resolver queue to the `other` department.

---

## /health

### GET /health
No auth required.

**Response 200 (actual):**
```json
{ "status": "ok", "storage": "mongodb" }
```
`storage` is `"mongodb"` whenever `MONGODB_URI` is set, and `"in-memory"`
otherwise (non-persistent fallback). It reports what is *configured*, not
whether the cluster currently answers — `/health` does not ping, deliberately:
a ping would hold a deployment's health check open for `serverSelectionTimeoutMS`
whenever the cluster is down, and a `503` would trigger restarts that cannot
fix an unreachable Atlas. Probe liveness separately if you need it.

---

## /auth

### POST /auth/register
Register a new user (USER role by default).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "string (min 8 chars)",
  "full_name": "string"
}
```
**Response 201:** `{ "id", "email", "full_name", "role" }`
**Errors:** 409 email already registered

---

### POST /auth/login
Email/password login.

**Request:**
```json
{ "email": "string", "password": "string" }
```
**Response 200:** `{ "access_token", "refresh_token", "token_type": "bearer" }`
**Errors:** 401 invalid credentials

---

### POST /auth/refresh
Refresh access token.

**Request:** `{ "refresh_token": "string" }`
**Response 200:** `{ "access_token", "token_type": "bearer" }`

---

### GET /auth/google
Redirect to Google OAuth 2.0 consent screen.

### GET /auth/google/callback
OAuth callback — exchanges code for tokens, creates or finds user.
**Response:** Redirect with JWT tokens set.

### POST /auth/logout
Invalidate refresh token.
**Auth:** Required.

---

## /users

### GET /users/me
Get current authenticated user profile.
**Auth:** Any role.
**Response 200:** `{ "id", "email", "full_name", "role", "avatar_url", ... }`

### PATCH /users/me
Update own profile.
**Auth:** Any role.
**Request:** `{ "full_name"?, "phone"?, "avatar_url"? }`

### GET /users
List users. **Auth:** ADMIN, SUPERADMIN.
**Query params:** `role`, `department_id`, `is_active`, `page`, `page_size`

### GET /users/{user_id}
Get user by ID. **Auth:** ADMIN, SUPERADMIN.

### POST /users/{user_id}/roles
Assign role to user. **Auth:** SUPERADMIN.
**Request:** `{ "role": "RESOLVER" | "ADMIN" | "USER" }`

---

## /grievances

### POST /grievances
Submit a new grievance. **Auth:** USER, ADMIN.

**Request (multipart/form-data):**
```
title: string
description: string
category_id?: UUID
attachments?: File[]
```
**Response 201:**
```json
{
  "id": "UUID",
  "reference_number": "GRV-2026-00001",
  "status": "SUBMITTED",
  "submitted_at": "ISO8601"
}
```

---

### GET /grievances
List grievances. **Auth:** Required; unauthenticated requests receive `401`.
Use `GET /grievances/{grievance_id}` for public reference-ID tracking.

- USER: own grievances only
- RESOLVER: assigned grievances only
- ADMIN/SUPERADMIN: all grievances

**Query params:** `status`, `category_id`, `severity`, `priority`, `assigned_to`, `from_date`, `to_date`, `search`, `page`, `page_size`

**Response 200:** `{ "items": [...], "total": N, "page": N, "page_size": N }`

---

### GET /grievances/{grievance_id}
Get grievance detail by reference ID (case-insensitive). Anonymous visitors
and signed-in non-owners receive a limited tracking projection (`id`, title,
current state/status, category, priority, submission time, and department).
It omits account/worker IDs, precise coordinates, images, AI internals, and
workflow history. The complainant and authorized staff retain full detail.
Unknown IDs return `404`.

### GET /grievances/{grievance_id}/history
Anonymous reference tracking and non-owner accounts receive only customer-
visible/system updates, with internal text and author identity removed. The
complainant, assigned worker, and administrative roles retain their authorized
history. A history error must never turn a successful detail lookup into a
“not found” result.

---

### PATCH /grievances/{grievance_id}/status
Update grievance status. **Auth:** RESOLVER (limited), ADMIN.
**Request:** `{ "status": "IN_PROGRESS", "reason"?: "string" }`
**Side effect:** Creates `grievance_status_history` entry.

---

### POST /grievances/{grievance_id}/comments
Add comment. **Auth:** USER (own), RESOLVER (assigned), ADMIN.
**Request:** `{ "content": "string", "is_internal": false }`

---

### GET /grievances/{grievance_id}/history
Get the progress timeline. Public/non-owner requests receive only
customer-visible/system updates; internal notes and author identity are
excluded. Owners, assigned workers, and administrative roles receive their
authorized history.

---

### POST /grievances/{grievance_id}/attachments
Upload attachment. **Auth:** USER (own, while SUBMITTED), RESOLVER (assigned), ADMIN.
**Request:** `multipart/form-data` with file.

---

### POST /grievances/{grievance_id}/withdraw
User withdraws own grievance. **Auth:** USER (own), ADMIN.
**Request:** `{ "reason": "string" }`

---

## /assignments

### GET /assignments/pending
List grievances pending assignment. **Auth:** ADMIN.

### POST /grievances/{grievance_id}/assign
Assign grievance. **Auth:** ADMIN.
**Request:**
```json
{
  "department_id": "UUID",
  "resolver_id"?: "UUID",
  "notes"?: "string",
  "override_ai_recommendation": false
}
```
**Side effect:** Status → ASSIGNED, notification sent.

### POST /grievances/{grievance_id}/reassign
Reassign. **Auth:** ADMIN.
**Request:** `{ "department_id", "resolver_id"?, "reason": "string" }`

---

## /ai

### GET /grievances/{grievance_id}/ai-analysis
Get all AI analysis results for a grievance. **Auth:** RESOLVER (assigned), ADMIN.

### POST /grievances/{grievance_id}/ai-analysis/rerun
Rerun AI analysis. **Auth:** ADMIN.
**Side effect:** Overwrites previous analysis; stores old version for audit.

### GET /grievances/{grievance_id}/similar
Get similar grievances. **Auth:** RESOLVER (assigned), ADMIN.

---

## /escalations

### GET /escalations
List escalation recommendations and active escalations. **Auth:** ADMIN.

### POST /grievances/{grievance_id}/escalate
Approve/initiate escalation. **Auth:** ADMIN.
**Request:** `{ "escalated_to_id"?, "priority_override"?, "notes": "string" }`

### POST /grievances/{grievance_id}/de-escalate
Return from escalation to IN_PROGRESS. **Auth:** ADMIN.
**Request:** `{ "reason": "string" }`

---

## /resolutions

### POST /grievances/{grievance_id}/resolution
Submit resolution. **Auth:** RESOLVER (assigned), ADMIN.
**Request:**
```json
{
  "resolution_text": "string",
  "actions_taken": "string",
  "resolution_type": "RESOLVED | PARTIAL | REFERRED | REJECTED"
}
```
**Side effect:** Status → RESOLVED; triggers AI-10 assessment.

### GET /grievances/{grievance_id}/resolution
Get resolution details. **Auth:** USER (own), RESOLVER (assigned), ADMIN.

### GET /grievances/{grievance_id}/resolution/assessment
Get AI-10 quality assessment. **Auth:** ADMIN.

### POST /grievances/{grievance_id}/close
Admin closes grievance (after review or approval). **Auth:** ADMIN.
**Request:** `{ "notes"?: "string" }`

---

## /feedback

### POST /grievances/{grievance_id}/feedback
Submit user feedback on resolution. **Auth:** USER (own grievance, status RESOLVED/CLOSED).
**Request:** `{ "rating": 1-5, "comment"?: "string", "is_satisfied": true }`

---

## /analytics

All analytics endpoints require ADMIN or SUPERADMIN.

### GET /analytics/overview
Summary counts: total, by status, by severity, by category.
**Query params:** `from_date`, `to_date`, `department_id`

### GET /analytics/volume
Grievance submission volume over time (daily/weekly/monthly).
**Query params:** `from_date`, `to_date`, `interval`

### GET /analytics/categories
Category distribution.

### GET /analytics/resolution-times
Average/median resolution times by category, department, resolver.

### GET /analytics/workload
Resolver/department workload distribution.

### GET /analytics/escalations
Escalation patterns and rates.

### GET /analytics/delayed
List of delayed and at-risk grievances.

### GET /analytics/recurring-patterns
AI-identified recurring grievance patterns.

---

## /notifications

### GET /notifications
Get current user's notifications. **Auth:** Any role.
Returns the newest notifications first with `id`, `kind`, `entityId`, `title`, `message`, `at`, and `isRead` fields. The response is scoped to the authenticated account; optional query parameters are `unread_only` and `limit` (maximum 100).

### PATCH /notifications/{notification_id}/read
Mark notification as read. **Auth:** Own notification only.

### PATCH /notifications/read-all
Mark all notifications as read. **Auth:** Any role.

---

## /departments

### GET /departments
List departments. **Auth:** RESOLVER, ADMIN.

### POST /departments
Create department. **Auth:** ADMIN.
**Request:** `{ "name", "description"?, "head_user_id"? }`

### PATCH /departments/{department_id}
Update department. **Auth:** ADMIN.

---

## /categories

### GET /categories
List grievance categories. **Auth:** Any (public list for submission form).

### POST /categories
Create category. **Auth:** ADMIN.
**Request:** `{ "name", "description"?, "default_sla_days", "assigned_department_id"? }`

### PATCH /categories/{category_id}
Update category. **Auth:** ADMIN.

---

## Error Response Format

**Implemented shape (actual):** validation and domain errors return
`400`/`404` with a flat message field:
```json
{ "error": "Human-readable error message" }
```
FastAPI request-validation failures are normalised to the same shape by the
`RequestValidationError` handler in `backend/app/main.py`.

Unrouted paths (`404`) and disallowed methods (`405`) used to bypass that and
return Starlette's `{"detail": "..."}`, which the client does not read — they
surfaced to users as a bare "Request failed (404)". A `StarletteHTTPException`
handler in `main.py` now maps them to the same flat shape, so **every** error
body the API can return carries `error`.

**Planned shape (target, not yet used):**
All errors follow:
```json
{
  "detail": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

Common HTTP status codes:
- 400 Bad Request — validation error
- 401 Unauthorized — missing or invalid token
- 403 Forbidden — insufficient role
- 404 Not Found — resource not found
- 409 Conflict — duplicate resource
- 422 Unprocessable Entity — invalid state transition or business rule violation
- 500 Internal Server Error — unexpected error (no stack trace in response)
### Worker workflow additions

- `POST /grievances/{id}/accept` — owner-only `RESOLVER` acknowledgement.
- `POST /grievances/{id}/escalate` accepts `issueType`, `description`,
  `suggestedAction`, and optional `evidenceUrl`; the ticket is stored with the
  grievance and in escalation history.
- `POST /grievances/{id}/resolution` accepts optional completion photo and
  supporting document URLs; manager approval remains required.
- Progress updates accept an optional `attachmentUrl`.

### Department employee management

- `GET /users` returns department-scoped users to department managers; a
  requested `dept` cannot expand the authenticated manager's scope. Legacy
  `transport` employee records are included with the combined `roads` team.
- `POST /users/employees` creates a `RESOLVER` in the manager's department.
- `DELETE /users/{id}` removes an employee only within the caller's department
  and returns `409` while that employee owns active grievances.
- `POST /grievances/{id}/reassign` is used by the manager workspace to assign
  an open grievance to a validated same-department employee. Initial worker
  assignment moves `PENDING_ASSIGNMENT`/`SUBMITTED` to `ASSIGNED`, establishes
  its due date, and records state history.
