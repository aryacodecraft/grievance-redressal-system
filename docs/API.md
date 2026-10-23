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

Stage 4B adds authenticated multipart `POST /transcribe` (disabled by default),
returning original-language text without creating a grievance. Audio contract,
idempotency, quotas and errors: [Voice-assisted complaints](VOICE_ASSISTED_COMPLAINT.md).

DEC-038 (Stage 12) adds authenticated JSON `POST /grievance-intake/extract`:
what the citizen said so far (transcripts and/or typed answers) becomes
structured draft fields plus at most one follow-up question. Stateless — no
grievance is created and no database is written; submission still goes through
`POST /submit-grievance`. DEC-039 (Stage 13) replaced the free-text `question`
with `question_kind` (`details` | `location` | `when` | `frequency` |
`affected` | `danger` | `landmark` | `clarify` | `null`) so every question can
be pre-recorded; `asked_questions` now carries kinds, not wording. Contract,
question policy and errors:
[Voice-assisted complaints](VOICE_ASSISTED_COMPLAINT.md).

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
| `PATCH` | `/grievances/{grievance_id}/status` | Legacy officer patch: `{ status?, assignee? }` — authenticated officer roles only; blank/whitespace-only values are `400`; surrounding whitespace is trimmed. Use `/state` for validated workflow transitions. |
| `POST` | `/validate-image` | Image validation |
| `POST` | `/sign-cloudinary` | Cloudinary upload signature |
| `POST` | `/delete-cloudinary` | Cloudinary asset removal |

> **Naming note:** the implemented create route is `POST /submit-grievance`
> (kept for parity with the legacy client), not `POST /grievances` as
> originally planned below. Interactive docs: `http://localhost:10000/docs`.

### Classification metadata on submission

`POST /submit-grievance` returns `hfEngine.modelInfo.categoryOutcome` with one
of `categorized`, `other`, or `uncertain`, alongside `categorySource` and
`categoryConfidenceSemantics`. These fields describe the classifier result.
Clearly non-civic text is rejected before classification; uncertain text is
still accepted for the existing officer-review workflow. The persisted
category remains the routing value (`other` is the general fallback queue).
The separate `qualityFlag` marks uncertain content flagged by the optional
quality check.

`categoryConfidence` is interpreted together with
`categoryConfidenceSemantics`: `uncalibrated_model_probability` is the local
LogisticRegression score, `uncalibrated_zero_shot_score` is the Hugging Face
zero-shot score, and `unavailable` means no numeric confidence estimate exists
(including keyword/domain rules and Groq). A value of `0.0` with semantics
`unavailable` is a sentinel, not a measured 0% chance of correctness.

The submit route rejects a request with HTTP 400 when the combined title and
description contain no Unicode letters (for example, punctuation-only text),
with a message asking the citizen to describe the issue in words. It does not
reject short, misspelled, or otherwise uncertain text solely based on length;
such submissions remain available for officer review.

Before image validation, classifier/provider calls, reference-ID generation or
any persistence, the submit route locally rejects clear non-civic intent with
HTTP 422: supported patterns include arithmetic questions, joke/creative
requests, general-information questions without civic-problem language, plain
greetings, keyboard-row gibberish and sports-result questions. The response
contains an `error` asking the citizen to describe a public-service problem
and where it is affecting them. It has no `grievanceId`; no grievance,
notification, assignment or SMS side effect is created. This is a conservative
prototype gate, not a complete language-understanding system. Ambiguous,
short, misspelled and multilingual civic complaints continue to classification
or the `other` officer-review path; a civic noun by itself does not make a
generic information request a complaint. The optional quality classifier runs
only when the local classifier abstains, and its failure remains fail-open.

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

### Citizen phone verification (`/phone/*`)

All routes require a citizen (`USER`) access token. `POST /phone/request-otp`
accepts `{ "phone": "9876543210" }` and responds generically; OTP challenges
are HMAC-hashed, expire after five minutes, allow three attempts, and are
limited by account, phone, and client IP. `POST /phone/verify-otp` accepts the
phone and six-digit code. After successful verification, call `POST
/phone/bind` with the same phone. `POST /phone/unbind` requires a separately
verified OTP for the currently linked number. `PATCH /phone/consent` accepts
`{ "enabled": true|false }`; this preference is independent from biometric
consent. In dry-run mode no code is delivered: local testing may explicitly
set `OTP_DEBUG_RETURN_CODE=true`; do not use this in deployments.

Phone numbers remain stored in normalized 10-digit Indian form. Face login by
phone now resolves only accounts with `phoneVerifiedAt`; Citizen ID login is
unchanged.

Citizen SMS stage notifications are best-effort background tasks, currently
`SMS_PROVIDER=dry-run` or `off` only. They require verified phone + explicit
SMS consent, use fixed English-only templates and omit free-text reasons. Live
Twilio delivery is not implemented and requires approved DLT registration.

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

*Face step-up (optional, DEC-024):* when `FACE_AUTH_ENABLED=true` and the
account has `requireLogin2fa` with an enrolled face template, a successful
password login pauses instead of returning tokens:
`{ "two_factor": "face", "token_type": "bearer", "pending_token" }`.
Exchange the short-lived (5 min, `type: "pending_2fa"`) `pending_token` at
`POST /auth/face/verify-second-factor` — or skip via
`POST /auth/complete-pending` — for a full session. Google OAuth redirects
with `?two_factor=face&pending_token=...` for the same step. A pending token
never authorizes protected routes.

---

### POST /auth/complete-pending
Convert a paused privileged login (`pending_2fa` token) into a full session.
**Auth:** pending token.
**Behaviour:** succeeds **only when the account is locked out on face
verification failures** (escape hatch after the per-user lockout is reached);
otherwise returns 403 `{"error": "Face verification required"}`. Face lockout
never blocks the password/Google login itself.
**Response 200:** `{ "access_token", "refresh_token", "token_type": "bearer" }`

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

## /config

### GET /config
Public runtime flags consumed by the UI. No auth.

**Response 200:**
```json
{ "faceAuthEnabled": false }
```
The frontend reads this before rendering any face option; when false every
`/auth/face/*` route also answers 404.

---

## /auth/face

> Present only when `FACE_AUTH_ENABLED=true` (DEC-024); otherwise every route
> below returns 404. The `FaceRouteGuard` middleware additionally enforces
> HTTPS (localhost excepted; `X-Forwarded-Proto` honoured only when
> `TRUST_PROXY=true`) and a 4 MB request-body cap before JSON/base64 parsing.
> All verification failures return generic messages — reason codes are for
> audit logs only. Face templates store a Fernet-encrypted 512-d embedding
> (never images; never returned by any endpoint).

Every verification call requires a single-use `challenge_id` from
`POST /auth/face/challenge` whose prompted `action` the client must satisfy
server-side. Frames are base64 JPEG strings, 5–8 per request, ≤ 1 MB each,
captured un-mirrored.

### POST /auth/face/challenge
No auth. Issues a single-use challenge (30 s TTL).
**Response 200:** `{ "challenge_id", "action", "expires_in" }`
(`action` ∈ `turn_left` | `turn_right` | `blink` | `smile`)

### POST /auth/face/enroll
**Auth:** access token (enrolling user).
**Request:**
```json
{ "challenge_id": "string", "frames": ["base64jpeg", "..."], "consent": true, "require_login_2fa": false }
```
`consent` must be `true` — explicit DPDP biometric consent is required before
any template is stored. `require_login_2fa` (ADMIN/SUPERADMIN only) opts the
account into the optional post-password face step. Re-enrolling replaces the
existing template (audit `face.template_updated`).
**Response 200:** `{ "enrolled": true }`
**Errors:** 401 generic (liveness/quality/match failure), 429 per-user/IP lockout.

### POST /auth/face/login
Public 1:1 face sign-in (alternative to password for any enrolled USER/
RESOLVER; never sufficient alone for privileged roles).
**Request:**
```json
{ "challenge_id": "string", "frames": ["base64jpeg", "..."], "email": "user@example.com" }
```
**Response 200:** same `AuthResponse` as `/auth/login`
(`{ "access_token", "refresh_token", "token_type": "bearer" }`).
**Errors:** 401 generic; 429 when the per-email (5) or per-IP (20) failure
lockout within 15 minutes is active. `MODEL_MISMATCH` (template enrolled
under a different `FACE_MODEL_NAME`) returns 401 and requires re-enrollment;
it never increments lockout counters.

### POST /auth/face/verify-second-factor
Completes a paused privileged login (the `pending_token` from
`POST /auth/login` or the Google callback).
**Auth:** pending token.
**Request:** `{ "challenge_id": "string", "frames": ["base64jpeg", "..."] }`
**Response 200:** full `AuthResponse` (identical shape to password login —
`require_role`/RBAC unchanged).
**Errors:** 401 generic; 429 per-user lockout (5 failures / 15 min).

### GET /auth/face/status
**Auth:** access token.
**Response 200:** `{ "enrolled": boolean }`
(Does not expose the current `requireLogin2fa` value — see profile limitation.)

### PATCH /auth/face/template
**Auth:** ADMIN/SUPERADMIN only.
**Request:** `{ "require_login_2fa": boolean }`
**Response 200:** `{ "requireLogin2fa": boolean }`

### DELETE /auth/face/template
**Auth:** access token. Deletes the caller's own template (biometric-data
deletion on request). Audit `face.template_deleted`.
**Response 200:** `{ "deleted": true }`

### DELETE /auth/face/template/{user_id}
**Auth:** SUPERADMIN only. Revokes another user's template. Audit
`face.template_revoked`.
**Response 200:** `{ "deleted": true }`

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
Legacy partial status/assignee patch. **Auth:** `ADMIN`, `SUPERADMIN`, or
`RESOLVER`. Blank status and assignee values return `400`. This compatibility
route does not replace the canonical state-machine workflow below.

### PATCH /grievances/{grievance_id}/state
Apply a validated workflow transition. **Auth:** authenticated workflow role;
the state machine validates both the transition and role. **Request:**
`{ "to_state": "IN_PROGRESS", "reason": "string" }`. The transition is
persisted to `state` and the legacy lowercase `status` projection, and is
recorded in state history and the audit log.

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
Make the initial department assignment. **Auth:** `ADMIN` or `SUPERADMIN`.
Allowed from `SUBMITTED` or `PENDING_ASSIGNMENT`; a department manager may
route only within their own department. Later employee assignment changes use
`/reassign` so they do not reset active work.
**Request:**
```json
{
  "departmentId": "roads",
  "ownerId": "employee-user-id",
  "dueDate": "optional ISO-8601 date",
  "reason": "Required non-blank human explanation"
}
```
`ownerId` is optional for department routing, but when supplied must identify
an active resolver in the selected department. The department, state, deadline,
assignment history, notification and audit record are updated by the workflow.

### POST /grievances/{grievance_id}/reassign
Assign/reassign an employee. **Auth:** `ADMIN` or `SUPERADMIN`; a department
manager may act only on a grievance and employee in their own department.
Allowed only for active, assignable grievances; closed/resolved/rejected and
withdrawn complaints return `422`. The target must be active and have role
`RESOLVER`.
**Request:** `{ "ownerId": "employee-user-id", "departmentId"?: "roads", "reason": "Required non-blank explanation" }`

The current owner, department, manager, updated timestamp, and assignment/state
history are persisted together before notifications are sent. Reassigning to
the already-current owner is an idempotent no-op and does not duplicate history
or notifications. The response includes `grievanceId` and current `state`.

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


---

## Admin Analytics Endpoints (DEC-054)

All analytics endpoints require authentication and `grievance.view_dept` permission (`ADMIN` or `SUPERADMIN`). `SUPERADMIN` retrieves global data across all departments; department `ADMIN` accounts are automatically scoped to their assigned `departmentId`. Responses return aggregated numbers only and never expose citizen PII (names, emails, phones, user IDs).

### GET /admin/analytics/trends
Time-series distribution of complaints received and resolved.

**Query Parameters:**
- `granularity`: `"daily"` (default), `"weekly"`, or `"monthly"`.
- `date_from`: Optional ISO date string (e.g. `2026-09-01`).
- `date_to`: Optional ISO date string (e.g. `2026-10-01`).

**Response Shape:**
```json
{
  "granularity": "daily",
  "data": [
    { "date": "2026-09-08", "received": 4, "resolved": 1 }
  ]
}
```

### GET /admin/analytics/departments
Department-level workload performance comparison.

**Query Parameters:**
- `date_from`: Optional ISO date string filter on `createdAt`.
- `date_to`: Optional ISO date string filter on `createdAt`.

**Response Shape:**
```json
{
  "data": [
    {
      "department": "roads",
      "received": 14,
      "open": 8,
      "resolved": 6,
      "overdue": 2
    }
  ]
}
```

### GET /admin/analytics/resolution
Resolution speed and SLA compliance metrics.

**Query Parameters:**
- `date_from`: Optional ISO date string filter.
- `date_to`: Optional ISO date string filter.

**Response Shape:**
```json
{
  "overall_mean_days": 3.4,
  "overall_median_days": 2.5,
  "overall_sla_compliance_pct": 87.5,
  "sla_note": "SLA compliance counts only complaints that were assigned a due date (dueDate is set at assignment time). Unassigned complaints are excluded.",
  "by_department": [
    {
      "department": "roads",
      "count": 6,
      "mean_days": 3.2,
      "median_days": 2.1,
      "within_sla": 5,
      "total_with_due": 6
    }
  ]
}
```

### GET /admin/analytics/aging
Backlog aging analysis for active, unresolved complaints (excludes `RESOLVED`, `CLOSED`, `REJECTED`, `WITHDRAWN`).

**Response Shape:**
```json
{
  "reference_time": "2026-10-20T16:00:00Z",
  "buckets": [
    { "label": "0–2 days", "days_min": 0, "days_max": 2, "count": 12 },
    { "label": "3–7 days", "days_min": 3, "days_max": 7, "count": 8 },
    { "label": "8–14 days", "days_min": 8, "days_max": 14, "count": 4 },
    { "label": "15+ days", "days_min": 15, "days_max": null, "count": 2 }
  ]
}
```

### GET /admin/analytics/priorities
Breakdown of stored priority values by current lifecycle state. AI-suggested priorities (`hfEngine.priority`) are kept separate.

**Query Parameters:**
- `date_from`: Optional ISO date string filter.
- `date_to`: Optional ISO date string filter.

**Response Shape:**
```json
{
  "data": [
    { "priority": "high", "status": "IN_PROGRESS", "count": 5 },
    { "priority": "low", "status": "SUBMITTED", "count": 8 }
  ],
  "note": "Priorities shown are stored/human-assigned values. AI-suggested priorities are separate (hfEngine.priority) and not mixed in."
}
```
