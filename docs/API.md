# API.md — API Endpoint Documentation

> Status: PLANNED — documents intended endpoints before implementation.
> Update with actual route paths, request/response shapes, and error codes as the backend is built.
> Authentication: All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <token>`.

---

## Base URL

Development: `http://localhost:8000`

---

## /health

### GET /health
No auth required.

**Response 200:**
```json
{ "status": "ok", "version": "0.1.0" }
```

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
List grievances. **Auth:** Role-filtered.

- USER: own grievances only
- RESOLVER: assigned grievances only
- ADMIN/SUPERADMIN: all grievances

**Query params:** `status`, `category_id`, `severity`, `priority`, `assigned_to`, `from_date`, `to_date`, `search`, `page`, `page_size`

**Response 200:** `{ "items": [...], "total": N, "page": N, "page_size": N }`

---

### GET /grievances/{grievance_id}
Get grievance detail. **Auth:** Role-filtered (same as list).

**Response 200:**
```json
{
  "id", "reference_number", "title", "description",
  "status", "severity", "current_priority",
  "category", "submitter", "assignment",
  "due_date", "submitted_at", "updated_at",
  "ai_analysis": { "summary", "category_prediction", "severity", "priority", "entities" },
  "similar_grievances": [...],
  "status_history": [...],
  "comments": [...],
  "attachments": [...]
}
```

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
Get status history timeline. **Auth:** USER (own), RESOLVER (assigned), ADMIN.

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
**Query params:** `is_read`, `page`, `page_size`

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
