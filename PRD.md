# PRD.md — Product Requirements Document

**Project:** AI-Enabled Grievance Redressal and Decision Support System
**Type:** B.Tech Academic Prototype
**Version:** 0.1 (Initial)
**Date:** 2026-08-06

---

## Table of Contents

1. Product Overview
2. Background
3. Problem Statement
4. Goals
5. Non-Goals
6. Users / Actors
7. User Needs
8. Functional Requirements
9. Non-Functional Requirements
10. Role & Permission Requirements
11. Grievance Lifecycle
12. User Workflows
13. Admin Workflows
14. Resolver Workflows
15. AI Requirements
16. Assignment Requirements
17. Monitoring & Escalation Requirements
18. Resolution Quality Assessment
19. Analytics Requirements
20. Notification Requirements
21. Auditability Requirements
22. Data Requirements
23. Security Requirements
24. API Requirements
25. UI/Page Requirements
26. Error/Edge Cases
27. Acceptance Criteria
28. Prototype Scope
29. Out-of-Scope Features
30. Future Extensions
31. Open Questions

---

## 1. Product Overview

The AI-Enabled Grievance Redressal and Decision Support System is an end-to-end grievance
management platform that applies NLP and LLM-based AI at every stage of the grievance lifecycle.
The system provides intelligent decision support to administrators and resolvers while preserving
human authority over consequential administrative decisions.

---

## 2. Background

Institutional and public grievance management is largely manual, inconsistent, and opaque.
High complaint volumes overwhelm administrators. Critical issues are delayed. Recurring patterns
go undetected. Resolution quality is unverifiable. This project investigates whether AI-assisted
decision support can address these gaps in a human-controlled, academically sound prototype.

---

## 3. Problem Statement

Current grievance systems lack:
- Intelligent triage and categorization of incoming complaints
- Systematic severity and priority assessment
- Detection of related, duplicate, or recurring grievances
- Assignment support based on category, expertise, and workload
- Automated SLA and deadline monitoring
- Evaluation of whether resolutions actually address complaints
- Organizational analytics for data-driven administration

---

## 4. Goals

- Build a complete grievance lifecycle platform with audit trail
- Provide AI decision support at every major lifecycle stage
- Keep human administrators in control of consequential decisions
- Prototype and evaluate NLP/LLM-based AI modules
- Deliver a defensible academic research prototype

---

## 5. Non-Goals

- Production government or institutional deployment
- Legally binding autonomous AI decisions
- Replacing human administrative authority
- Multilingual support (optional/feasibility-dependent)
- Multimodal input (optional/feasibility-dependent)
- National-scale deployment

---

## 6. Users / Actors

| Actor | Code | Description |
|---|---|---|
| Grievance Raiser | USER | Submits and tracks own grievances |
| Department Staff / Resolver | RESOLVER | Handles assigned grievances |
| Administrator | ADMIN | Oversees all grievances, approves assignments |
| Super Administrator | SUPERADMIN | Manages users, roles, system config |
| AI System | AI | Decision-support layer |

---

## 7. User Needs

### Grievance Raiser
- Submit a grievance easily with title, description, and optional attachments
- Receive immediate acknowledgement and a reference number
- Track grievance status and see a timeline of events
- Receive updates when status changes
- Provide feedback on resolution quality

### Resolver
- View a clear queue of assigned grievances
- Access AI-generated analysis (summary, category, severity) alongside grievance details
- Update status, add notes, and record actions
- Submit resolution with actions taken

### Admin
- See pending grievances with AI recommendations
- Approve, modify, or override assignments
- Monitor all grievances including at-risk and escalated ones
- Review analytics and identify patterns
- Manage categories, SLA configuration, and departments

---

## 8. Functional Requirements

### Authentication (FR-AUTH)

| ID | Requirement |
|---|---|
| FR-AUTH-001 | System must support email/password registration and login |
| FR-AUTH-002 | System must support Google OAuth 2.0 login |
| FR-AUTH-003 | System must issue JWT access tokens (short-lived) and refresh tokens |
| FR-AUTH-004 | System must support token refresh without re-login |
| FR-AUTH-005 | System must enforce RBAC — roles: USER, RESOLVER, ADMIN, SUPERADMIN |
| FR-AUTH-006 | SUPERADMIN must be able to assign and revoke roles |

### Grievance Management (FR-GRV)

| ID | Requirement |
|---|---|
| FR-GRV-001 | USER must be able to submit a grievance with title, description, category (optional), and attachments (optional) |
| FR-GRV-002 | System must assign a unique reference number on submission |
| FR-GRV-003 | System must acknowledge submission with reference number and timestamp |
| FR-GRV-004 | Grievance must have a formal status with defined valid transitions |
| FR-GRV-005 | Every status transition must be recorded with actor, timestamp, and reason |
| FR-GRV-006 | USER must be able to view all own grievances and their current status |
| FR-GRV-007 | USER must be able to view the timeline of a grievance |
| FR-GRV-008 | ADMIN must be able to view all grievances with filterable list |
| FR-GRV-009 | RESOLVER must be able to view assigned grievances only |
| FR-GRV-010 | Grievance detail must show: title, description, status, category, severity, priority, AI analysis, assignment, comments, history, attachments |
| FR-GRV-011 | RESOLVER and ADMIN must be able to add comments (internal or public) |
| FR-GRV-012 | USER must be able to withdraw own grievance (with reason) |
| FR-GRV-013 | ADMIN must be able to reject a grievance (with reason) |
| FR-GRV-014 | System must support file attachments with type and size validation |

### AI Analysis (FR-AI)

| ID | Requirement |
|---|---|
| FR-AI-001 | System must automatically trigger AI analysis on grievance submission |
| FR-AI-002 | AI must generate a concise summary of each grievance (AI-01) |
| FR-AI-003 | AI must predict grievance category with confidence score (AI-02) |
| FR-AI-004 | AI must extract named entities from grievance text (AI-03) |
| FR-AI-005 | AI must assess grievance severity: LOW/MEDIUM/HIGH/CRITICAL (AI-04) |
| FR-AI-006 | AI must estimate grievance priority 1–5 (AI-05) |
| FR-AI-007 | All AI analysis results must be stored persistently with module ID and model version |
| FR-AI-008 | AI analysis must not block grievance processing if a module fails |
| FR-AI-009 | ADMIN must be able to view AI analysis results for any grievance |
| FR-AI-010 | ADMIN must be able to override AI-generated category and severity |

### Similarity / Related Grievance Detection (FR-SIM)

| ID | Requirement |
|---|---|
| FR-SIM-001 | System must generate a semantic embedding for each grievance at submission |
| FR-SIM-002 | System must identify similar grievances using cosine similarity (AI-06) |
| FR-SIM-003 | Similarity results must distinguish: DUPLICATE, RELATED, RECURRING_PATTERN |
| FR-SIM-004 | ADMIN must be able to confirm or reject suggested duplicate links |
| FR-SIM-005 | Recurring pattern flags must be surfaced to the admin dashboard |

### Assignment (FR-ASG)

| ID | Requirement |
|---|---|
| FR-ASG-001 | System must generate an assignment recommendation after AI analysis (AI-07) |
| FR-ASG-002 | Assignment recommendation must include department, resolver (if available), confidence, and reasoning |
| FR-ASG-003 | ADMIN must approve, modify, or override assignment before it takes effect |
| FR-ASG-004 | Assignment record must store both AI recommendation and final human decision |
| FR-ASG-005 | ADMIN must be able to reassign any grievance with a reason |
| FR-ASG-006 | System must set a due date (SLA deadline) when a grievance is assigned |

### Workflow & Status (FR-WKF)

| ID | Requirement |
|---|---|
| FR-WKF-001 | System must enforce valid state transitions server-side |
| FR-WKF-002 | RESOLVER must be able to update assigned grievance status to IN_PROGRESS |
| FR-WKF-003 | RESOLVER must be able to record actions and add comments |
| FR-WKF-004 | System must track current assignment (department, resolver) on each grievance |
| FR-WKF-005 | Grievance must track: assigned_at, due_date, resolved_at, closed_at |

### Monitoring & Escalation (FR-MON)

| ID | Requirement |
|---|---|
| FR-MON-001 | System must monitor grievances for SLA deadline proximity |
| FR-MON-002 | System must detect prolonged inactivity on assigned grievances |
| FR-MON-003 | AI must generate escalation recommendations for at-risk grievances (AI-08, AI-09) |
| FR-MON-004 | ADMIN must receive alerts for at-risk grievances |
| FR-MON-005 | ADMIN must approve escalation before it is enacted |
| FR-MON-006 | Escalation record must store: reason, AI recommendation, approving admin, target |

### Resolution (FR-RES)

| ID | Requirement |
|---|---|
| FR-RES-001 | RESOLVER must be able to submit a resolution with resolution text and actions taken |
| FR-RES-002 | System must automatically trigger AI-10 resolution quality assessment on submission |
| FR-RES-003 | AI-10 must produce relevance score, completeness score, and issues-addressed list |
| FR-RES-004 | Resolutions below quality threshold must be flagged for human review |
| FR-RES-005 | Flagged resolutions must NOT be automatically rejected |
| FR-RES-006 | ADMIN must review flagged resolutions before closure is allowed |
| FR-RES-007 | USER must be able to provide satisfaction feedback after resolution |
| FR-RES-008 | ADMIN must be able to return a resolution to IN_PROGRESS if unsatisfactory |
| FR-RES-009 | ADMIN or system must close grievance after review/feedback window |

### Analytics (FR-ANA)

| ID | Requirement |
|---|---|
| FR-ANA-001 | System must provide grievance volume over time (daily/weekly/monthly) |
| FR-ANA-002 | System must show category distribution |
| FR-ANA-003 | System must show resolution time averages by category and department |
| FR-ANA-004 | System must show resolver/department workload distribution |
| FR-ANA-005 | System must show escalation patterns and rates |
| FR-ANA-006 | System must surface recurring grievance patterns detected by AI |
| FR-ANA-007 | Analytics must be accessible to ADMIN and SUPERADMIN |

---

## 9. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-PERF-001 | Grievance submission API response < 500ms (excluding AI processing, which is async) |
| NFR-PERF-002 | Grievance list pages load within 2 seconds for up to 1000 grievances |
| NFR-SEC-001 | All secrets stored in environment variables; none in source code |
| NFR-SEC-002 | All protected endpoints enforce role-based authorization server-side |
| NFR-SEC-003 | Passwords hashed with bcrypt |
| NFR-SEC-004 | JWT tokens expire and are refreshable |
| NFR-SEC-005 | All significant actions recorded in audit log |
| NFR-MAINT-001 | Backend modules separated by domain: routers, services, models, schemas, ai |
| NFR-MAINT-002 | No hardcoded configuration values — all via environment |
| NFR-TEST-001 | Core state machine transitions covered by unit tests |
| NFR-TEST-002 | Authentication flows covered by integration tests |
| NFR-DOC-001 | Every API endpoint documented in docs/API.md |
| NFR-DOC-002 | Every AI module documented in docs/AI_SYSTEM.md |

---

## 10. Role & Permission Requirements

See `docs/SECURITY.md` — Permission Matrix section for full table.

Key non-negotiable rules:
- Server-side enforcement on every request (never trust client role claims)
- USER can only access own grievances
- RESOLVER can only access assigned grievances
- All assignment, reassignment, escalation, and closure decisions are ADMIN-only
- Role management is SUPERADMIN-only

---

## 11. Grievance Lifecycle

See `docs/WORKFLOWS.md` — Grievance State Machine section.

States: SUBMITTED → AI_PROCESSING → PENDING_ASSIGNMENT → ASSIGNED → IN_PROGRESS →
[PENDING_ESCALATION → ESCALATED →] RESOLVED → [UNDER_REVIEW →] CLOSED
Terminal states: REJECTED, WITHDRAWN

---

## 12–14. Workflows

See `docs/WORKFLOWS.md` for detailed step-by-step workflows for:
- User submission and tracking (Workflow 1, 9)
- AI analysis pipeline (Workflow 2)
- Admin assignment (Workflow 3)
- Resolver handling and resolution (Workflow 4)
- Resolution quality review (Workflow 5)
- Escalation (Workflow 6)
- Reassignment (Workflow 7)
- Closure (Workflow 8)

---

## 15. AI Requirements

See `docs/AI_SYSTEM.md` for full specifications of AI-01 through AI-11.

Core AI requirements summary:

| Module | Required? | Status |
|---|---|---|
| AI-01 Summarization | Yes | PLANNED |
| AI-02 Classification | Yes | PLANNED |
| AI-03 Entity Extraction | Yes | PLANNED |
| AI-04 Severity Assessment | Yes | PLANNED |
| AI-05 Priority Estimation | Yes | PLANNED |
| AI-06 Similarity Detection | Yes | PLANNED |
| AI-07 Assignment Recommendation | Yes | PLANNED |
| AI-08 Delay/Risk Assessment | Yes | PLANNED |
| AI-09 Escalation Recommendation | Yes | PLANNED |
| AI-10 Resolution Quality Assessment | Yes (research priority) | PLANNED |
| AI-11 Insight Generation | Optional | PLANNED |

---

## 16. Assignment Requirements

See FR-ASG-001 through FR-ASG-006.

Key principle: AI recommends, human decides (DEC-003).

---

## 17. Monitoring & Escalation Requirements

See FR-MON-001 through FR-MON-006 and AI-08, AI-09 in `docs/AI_SYSTEM.md`.

---

## 18. Resolution Quality Assessment

See FR-RES-001 through FR-RES-009 and AI-10 in `docs/AI_SYSTEM.md`.

Research importance: This is the highest-research-value AI module. Evaluation against
human-rated resolution quality is a primary academic contribution.

---

## 19. Analytics Requirements

See FR-ANA-001 through FR-ANA-007 and AI-11 in `docs/AI_SYSTEM.md`.

---

## 20. Notification Requirements

| ID | Requirement |
|---|---|
| FR-NOT-001 | USER notified on: acknowledgement, status changes, resolution, closure |
| FR-NOT-002 | RESOLVER notified on: assignment, reassignment, escalation |
| FR-NOT-003 | ADMIN notified on: new pending assignment, at-risk grievances, escalation flags, flagged resolutions |
| FR-NOT-004 | Notifications stored in database and retrievable via API |
| FR-NOT-005 | Notifications marked as read/unread |

---

## 21. Auditability Requirements

| ID | Requirement |
|---|---|
| FR-AUD-001 | All grievance state transitions recorded with actor, timestamp, reason |
| FR-AUD-002 | All assignment decisions recorded including AI recommendation and human override |
| FR-AUD-003 | All escalation decisions recorded with AI reasoning and human approval |
| FR-AUD-004 | AI-generated actions distinguished from human actions in history |
| FR-AUD-005 | Audit log records who changed what, when, from what to what |

---

## 22. Data Requirements

| ID | Requirement |
|---|---|
| FR-DAT-001 | Grievance data retained even after closure (no physical delete) |
| FR-DAT-002 | Status history is immutable — never overwritten |
| FR-DAT-003 | AI analysis results stored with model version for reproducibility |
| FR-DAT-004 | Grievance embeddings stored for ongoing similarity search |
| FR-DAT-005 | Priority history preserved (original_priority, current_priority, reason) |

---

## 23. Security Requirements

See `docs/SECURITY.md` for full security design.
Key requirements: NFR-SEC-001 through NFR-SEC-005.

---

## 24. API Requirements

See `docs/API.md` for planned endpoint documentation.

All APIs must:
- Follow REST conventions
- Return consistent error format `{ detail, code }`
- Enforce auth and RBAC
- Validate input via Pydantic schemas
- Not expose internal stack traces

---

## 25. UI/Page Requirements

| Page | Actor | Description |
|---|---|---|
| Login / Register | All | Email/password + Google OAuth |
| User Dashboard | USER | Grievance list with status, submit button |
| Submit Grievance | USER | Form: title, description, category, attachments |
| Grievance Detail (User) | USER | Status, timeline, comments, resolution, feedback form |
| Admin Dashboard | ADMIN | Pending assignments, at-risk queue, analytics summary |
| Admin Grievance List | ADMIN | Filterable full list |
| Admin Grievance Detail | ADMIN | Full detail + AI analysis panel + assignment actions |
| Admin Analytics | ADMIN | Charts: volume, categories, resolution times, workload |
| Resolver Queue | RESOLVER | Assigned grievances queue |
| Resolver Grievance Detail | RESOLVER | Detail + AI analysis + action forms |
| Notifications | All | Inbox with read/unread |

---

## 26. Error / Edge Cases

| Case | Expected Behavior |
|---|---|
| AI analysis fails for a module | Log error; store partial results; continue; do not block workflow |
| LLM API unavailable | Fall back to rule-based defaults; mark AI modules as UNASSESSED |
| Invalid state transition attempted | Return HTTP 422 with descriptive error |
| Duplicate submission detected | Surface as related grievance; not auto-rejected |
| File too large or invalid type | Return 400 with specific error before processing |
| Admin assigns to unavailable resolver | Validation warning; allow override with explicit confirmation |
| Resolution flagged but admin disagrees | Admin can override quality flag and close with note |
| Grievance withdrawn mid-processing | Allow withdrawal; record reason; AI processing may complete harmlessly |

---

## 27. Acceptance Criteria

A feature is considered IMPLEMENTED when:
1. Code exists and basic integration works end-to-end
2. API endpoint returns correct response for happy path
3. RBAC enforcement verified (unauthorized role returns 403)

A feature is considered TESTED when:
1. Unit or integration tests exist and pass for happy path + key error cases

An AI module is considered VALIDATED when:
1. Ground truth evaluation dataset defined
2. Metrics computed against that dataset
3. Results documented in evaluation report

---

## 28. Prototype Scope

This is an academic prototype. Scope includes:
- Complete grievance lifecycle management
- All AI modules AI-01 through AI-10 (AI-11 optional)
- Human-in-the-loop design throughout
- Basic analytics dashboard
- Core security (auth, RBAC, input validation)
- Evaluation of at least AI-10 (resolution quality) for academic contribution

---

## 29. Out-of-Scope Features

- Real government portal integration
- Email/SMS notifications (optional future feature)
- Mobile app
- Multilingual input (optional)
- Voice/audio input (optional)
- PDF/CSV report export (optional)
- Production-scale infrastructure

---

## 30. Future Extensions

- Email and SMS notification channels
- Multilingual grievance support
- Voice/audio grievance submission
- Mobile-responsive PWA
- Integration with institutional portals
- Public transparency dashboard
- Advanced ML classifier trained on labeled domain dataset
- Export functionality (PDF reports, CSV data)

---

## 31. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-001 | Which LLM API provider to use? (OpenAI, Anthropic, Google, open-source?) | Project team | OPEN |
| OQ-002 | Which Sentence Transformer model? (all-MiniLM-L6-v2 vs. alternatives?) | Project team | OPEN (DEC-004 proposes default) |
| OQ-003 | What grievance dataset will be used for AI evaluation? | Project team | OPEN (DEC-005 documents uncertainty) |
| OQ-004 | File storage: local filesystem vs. object storage? | Project team | OPEN |
| OQ-005 | What SLA defaults should be configured for prototype? | Project team | OPEN |
| OQ-006 | Should user feedback close the grievance or require admin confirmation? | Project team | OPEN |
| OQ-007 | Dynamic priority: what signals trigger priority re-evaluation? | Project team | OPEN |
