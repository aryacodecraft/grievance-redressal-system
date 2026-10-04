# WORKFLOWS.md — Grievance Lifecycle Workflows

> Labels used throughout:
> **[SYSTEM]** — Automated action
> **[AI]** — AI recommendation or analysis (not a final decision)
> **[HUMAN]** — Required human decision

---

## Grievance State Machine

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
