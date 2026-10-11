# WORKFLOWS.md — Grievance Lifecycle Workflows

> Implementation delta: `memory/rbac/GRIEVANCE_WORKFLOW.md` is the normative
> spec (canonical UPPER states, transition table, legacy lowercase adapter).
> This document keeps the narrative workflows and actor step tables.
>
> Labels used throughout:
> **[SYSTEM]** — Automated action
> **[AI]** — AI recommendation or analysis (not a final decision)
> **[HUMAN]** — Required human decision

---

## Grievance State Machine

### Citizen phone and SMS preferences

Citizens may link a mobile number from Profile after OTP verification. The
stored phone stays in normalized 10-digit form; phone-based face login is
available only after the server records `phoneVerifiedAt`. Unlinking requires
OTP verification of the current number and automatically opts the account out
of SMS updates. SMS consent is a separate, unchecked-by-default preference.
With the prototype's dry-run provider, stage notification intent is logged
without phone numbers, message bodies, or OTP values; no external SMS is sent.

```
                    ┌─────────────┐
              ┌────▶│  SUBMITTED  │
              │     └──────┬──────┘
              │            │ [SYSTEM] AI processing triggered
              │     ┌──────▼──────────┐
              │     │  AI_PROCESSING  │
              │     └──────┬──────────┘
              │            │ [SYSTEM] AI analysis complete
              │     ┌──────▼──────────────┐
              │     │  PENDING_ASSIGNMENT  │
              │     └──────┬──────────────┘
              │            │ [HUMAN] Admin approves / assigns
              │     ┌──────▼──────┐
              │     │  ASSIGNED    │
              │     └──────┬──────┘
              │            │ [HUMAN] Resolver begins work
              │     ┌──────▼──────┐
              │     │ IN_PROGRESS  │◀─────────────────────┐
              │     └──────┬───────┘                      │
              │            │                              │
              │     ┌──────▼────────────┐        [HUMAN] Reassigned
              │     │ PENDING_ESCALATION │─────────────────┘
              │     └──────┬────────────┘
              │            │ [HUMAN] Admin approves escalation
              │     ┌──────▼──────┐
              │     │  ESCALATED   │
              │     └──────┬──────┘
              │            │ [HUMAN] Resolver submits resolution
              │     ┌──────▼──────┐
              │     │  RESOLVED    │
              │     └──────┬──────┘
              │            │ [SYSTEM] AI-10 quality assessment
              │     ┌──────▼──────────┐
              │     │  UNDER_REVIEW    │ (if flagged)
              │     └──────┬──────────┘
              │            │ [HUMAN] Admin reviews
              │     ┌──────▼──────┐
  WITHDRAWN ◀─┤     │   CLOSED    │
  REJECTED ◀──┘     └─────────────┘
```

---

## Workflow 1 — Grievance Submission

**Actor:** User (Grievance Raiser)

| Step | Actor | Action |
|---|---|---|
| 1 | User | Authenticates and navigates to grievance submission form |
| 2 | User | Fills in: title, description, category (optional), attachments (optional) |
| 3 | **[SYSTEM]** | Validates input; assigns reference number; records `submitted_at` |
| 4 | **[SYSTEM]** | Status → SUBMITTED; creates `grievance_status_history` entry |
| 5 | **[SYSTEM]** | Sends acknowledgement to user (in-app notification) |
| 6 | **[SYSTEM]** | Triggers AI analysis pipeline asynchronously |

---

## Workflow 2 — AI Analysis Pipeline

**Actor:** AI System

| Step | Actor | Action |
|---|---|---|
| 1 | **[SYSTEM]** | Status → AI_PROCESSING |
| 2 | **[AI]** | AI-01: Summarize grievance text → store summary + key issues |
| 3 | **[AI]** | AI-02: Classify category → store predicted category + confidence |
| 4 | **[AI]** | AI-03: Extract entities → store entity list |
| 5 | **[AI]** | AI-04: Assess severity → store severity + reasoning |
| 6 | **[AI]** | AI-05: Estimate priority → store priority + reasoning |
| 7 | **[SYSTEM]** | Generate Sentence Transformer embedding → store in `grievance_embeddings` |
| 8 | **[AI]** | AI-06: Find similar grievances → store similarity results and relationship links |
| 9 | **[AI]** | AI-07: Generate assignment recommendation → store in `grievance_assignments` |
| 10 | **[SYSTEM]** | Status → PENDING_ASSIGNMENT |
| 11 | **[SYSTEM]** | Notify admin of new grievance pending assignment |

*If any AI step fails:* Log error, store partial results, continue processing remaining steps.
*AI processing must not block grievance from reaching PENDING_ASSIGNMENT.*

---

## Workflow 3 — Assignment (Admin)

**Actor:** Admin

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Views grievance in pending queue — sees AI analysis panel |
| 2 | Admin | Reviews: summary, category, severity, priority, AI recommendation, similar grievances |
| 3 | **[HUMAN]** | Admin approves AI recommendation, modifies it, or assigns manually |
| 4 | **[SYSTEM]** | Records assignment: department + resolver, assigned_by, AI recommendation stored |
| 5 | **[SYSTEM]** | Sets `due_date` from SLA configuration based on category + severity |
| 6 | **[SYSTEM]** | Status → ASSIGNED |
| 7 | **[SYSTEM]** | Notifies assigned resolver |

---

## Workflow 4 — Resolver Workflow

**Actor:** Resolver / Department Staff

| Step | Actor | Action |
|---|---|---|
| 1 | Resolver | Views assigned grievance in dashboard |
| 2 | Resolver | Reviews grievance details, AI analysis, and history |
| 3 | **[HUMAN]** | Resolver begins work — status → IN_PROGRESS |
| 4 | Resolver | Adds comments/notes (internal or submitter-visible) |
| 5 | Resolver | Takes actions, uploads supporting documents as needed |
| 6 | Resolver | Continues updating progress until ready to resolve |
| 7 | **[HUMAN]** | Resolver submits resolution: resolution text + actions taken |
| 8 | **[SYSTEM]** | Records resolution → status → RESOLVED |
| 9 | **[SYSTEM]** | Triggers AI-10 resolution quality assessment |

---

## Workflow 5 — Resolution Quality Review

**Actor:** AI System + Admin (if flagged)

| Step | Actor | Action |
|---|---|---|
| 1 | **[AI]** | AI-10: Assess resolution quality → compute scores |
| 2 | **[AI]** | If overall_score < threshold → flagged_for_review = TRUE |
| 3 | **[SYSTEM]** | If flagged: status → UNDER_REVIEW; notify admin |
| 4 | **[SYSTEM]** | If not flagged: status → CLOSED (or await user feedback period) |
| 5 | **[HUMAN]** | Admin reviews flagged resolution |
| 6 | **[HUMAN]** | Admin decision: approve closure → CLOSED, or return to IN_PROGRESS |

*Flagged resolutions are never automatically rejected. Human review is required.*

---

## Workflow 6 — Escalation

**Actor:** AI System + Admin

| Step | Actor | Action |
|---|---|---|
| 1 | **[SYSTEM]** | AI-08 risk assessment runs periodically (background job) |
| 2 | **[AI]** | AI-09 generates escalation recommendation with reason |
| 3 | **[SYSTEM]** | If recommendation flagged: status → PENDING_ESCALATION; alert admin |
| 4 | **[HUMAN]** | Admin reviews escalation recommendation |
| 5 | **[HUMAN]** | Admin approves escalation → status → ESCALATED; records escalation target + notes |
| 6 | **[HUMAN]** | Admin may also override priority during escalation |
| 7 | **[SYSTEM]** | Notifies escalation target and assigned resolver |

*Admin may also initiate escalation manually without AI recommendation.*

---

## Workflow 7 — Reassignment

**Actor:** Admin

| Step | Actor | Action |
|---|---|---|
| 1 | **[HUMAN]** | Admin decides to reassign (reason: resolver unavailable, wrong department, etc.) |
| 2 | **[SYSTEM]** | Previous assignment marked inactive (`is_active = false`) |
| 3 | **[SYSTEM]** | New assignment recorded; reassignment_count incremented |
| 4 | **[SYSTEM]** | Status → ASSIGNED (resets to assigned state) |
| 5 | **[SYSTEM]** | Notifies new resolver and previous resolver |
| 6 | **[SYSTEM]** | AI-08 flags if reassignment_count exceeds threshold (risk signal) |

---

## Workflow 8 — Grievance Closure

**Actor:** System / Admin (with or without user feedback)

| Step | Actor | Action |
|---|---|---|
| 1 | **[SYSTEM]** | Grievance reaches RESOLVED or UNDER_REVIEW (after review) |
| 2 | **[SYSTEM]** | User notified of resolution |
| 3 | User (optional) | Submits satisfaction feedback (rating + comment) |
| 4 | **[SYSTEM]** | After feedback window or admin approval → status → CLOSED |
| 5 | **[SYSTEM]** | Records `closed_at` timestamp |

---

## Workflow 9 — User Tracking

**Actor:** User (Grievance Raiser)

| Step | Actor | Action |
|---|---|---|
| 1 | User | Logs in and navigates to grievance list |
| 2 | User | Views current status, timeline, and comments |
| 3 | User | Receives in-app notifications on status changes |
| 4 | User | May add clarifying comments where permitted |
| 5 | User | Submits feedback after resolution |

Notifications are available from the signed-in user's notification inbox. The
citizen receives an acknowledgement when a grievance is registered and updates
when it is routed, changes status, is resolved, or is closed/rejected. Employees
receive an in-app notification when a grievance is assigned or reassigned to
them, and managers receive workflow notifications for escalations and submitted
resolutions. The frontend shows toast popups for newly received notifications
and immediate feedback for actions taken in the current session; the inbox is
account-scoped and supports marking one or all items read.

---

## State Transition Rules

All transitions are enforced server-side. Invalid transitions return HTTP 422.

| From | To | Permitted Actor(s) |
|---|---|---|
| SUBMITTED | AI_PROCESSING | SYSTEM |
| AI_PROCESSING | PENDING_ASSIGNMENT | SYSTEM |
| PENDING_ASSIGNMENT | ASSIGNED | ADMIN |
| ASSIGNED | IN_PROGRESS | RESOLVER, ADMIN |
| IN_PROGRESS | PENDING_ESCALATION | SYSTEM (AI-09), ADMIN |
| IN_PROGRESS | RESOLVED | RESOLVER |
| PENDING_ESCALATION | ESCALATED | ADMIN |
| PENDING_ESCALATION | IN_PROGRESS | ADMIN (reject escalation) |
| ESCALATED | IN_PROGRESS | ADMIN |
| ESCALATED | RESOLVED | RESOLVER |
| RESOLVED | UNDER_REVIEW | SYSTEM (AI-10 flag) |
| RESOLVED | CLOSED | SYSTEM, ADMIN |
| UNDER_REVIEW | CLOSED | ADMIN |
| UNDER_REVIEW | IN_PROGRESS | ADMIN (return for rework) |
| ANY | REJECTED | ADMIN |
| SUBMITTED | WITHDRAWN | USER, ADMIN |
| IN_PROGRESS | WITHDRAWN | USER (with admin approval), ADMIN |
## Worker execution workflow

Workers are represented by the existing `RESOLVER` role. A department manager
assigns an owner; the worker can acknowledge `ASSIGNED → ACCEPTED`, start work,
post daily updates, place work on hold with a required reason, or raise a
structured escalation ticket. Completion is submitted as
`RESOLUTION_SUBMITTED`, preserving the required manager approval step before
the grievance becomes `RESOLVED`.

The worker queue uses `GET /resolver/tasks`, scoped by authenticated `ownerId`
and independent of department filters/aliases. Assignment eligibility, manager
employee lists, and department scopes share canonical department normalization,
so legacy/display labels (for example `transport`, `Roads & Transport`, and
`Traffic & Transport Operations`) resolve to the same department. Assignment
notifications link directly to the named task;
the queue refreshes periodically so tasks assigned while it is open appear
without requiring a sign-out/sign-in cycle. If a queue response omits an
assignment, the client can recover it from that employee's own assignment
notifications and fetch the grievance through the same server-side owner
authorization used by direct grievance lookup. Loading errors are shown rather
than rendered as a zero-work dashboard.

## Public reference tracking

Anyone can search a grievance by reference ID, including while signed out.
Visitors and non-owner accounts receive a limited current-status projection;
identity, assignment, exact coordinates, images, and internal workflow data
remain restricted. Public history includes only customer-visible/system
updates. Detail and history load independently, so a history failure cannot
incorrectly show the grievance as missing. Full grievance lists require
authentication, so public lookup does not expose an enumerable case list.

## Department employee management

Department managers use `/admin/employees` with separate **Employee Accounts**
and **Assign Tasks** tabs. The accounts tab handles employee creation and
removal; the tasks tab reviews team workload and allocates grievances. Managers
can also allocate a grievance directly from its review dialog, which offers only active
employees from their department. The server derives manager scope from the
authenticated account, limits employee lists and assignment targets to that
department, and audits account changes. Assigning a pending grievance moves it
to `ASSIGNED` and starts its SLA deadline. Employees with active grievances
must have those tasks reassigned before their account can be removed.

## Face authentication login (optional, DEC-024)

Face login is opt-in and off by default (`FACE_AUTH_ENABLED=false`). When off,
every face route 404s and the UI hides all face options; no role ever requires
a face template.

**Enrollment (signed-in user, `/profile`):** the user gives explicit biometric
consent, starts a single-use challenge, and captures 5–8 webcam frames while
performing the prompted action (head turn / blink / smile). The server repeats
the liveness and quality checks, computes the mean face embedding, encrypts it
(Fernet), and stores the template. Re-enrolling replaces the template;
deletion removes it on request. Admins/superadmins may additionally opt into
`requireLogin2fa` at enrollment or later via `PATCH /auth/face/template`.

**Citizen / Resolver sign-in (alternative to password):** the login page's
Face tab issues a challenge, captures frames, and posts them with the email.
A liveness-passed 1:1 match against that user's template returns the same JWT
session a password login would. Failures are generic 401s; repeated failures
lock the face path per email (5), per user (5), and per IP (20) within 15
minutes — password/Google login is never blocked by these counters.

**Admin / Superadmin step-up (optional convenience, not a control):** after a
successful password or Google sign-in, accounts with `requireLogin2fa` pause
with a short-lived `pending_2fa` token and must satisfy a face challenge
(`POST /auth/face/verify-second-factor`). The user may skip —
`POST /auth/complete-pending` issues a full session only once the account is
actually locked out on face failures, otherwise 403. Because the lockout falls
back to password-only login and no privileged login is ever face-only, this
step hardens UX but does not raise the assurance floor.

**Revocation:** owners delete their own template from `/profile`; superadmins
can revoke any user's template from the users workspace. Every enrollment,
match, failure, lockout, and deletion is audited (`face.*` actions) without
storing embeddings or images in the audit trail.
