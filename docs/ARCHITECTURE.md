# ARCHITECTURE.md — System Architecture

---

## Overview

The system follows a three-tier architecture:

- **Frontend** — Next.js (TypeScript) single-page application served via Node.js
- **Backend** — FastAPI (Python) REST API handling business logic and AI orchestration
- **Database** — PostgreSQL for all persistent data

The AI/NLP layer is co-located with the backend as Python modules/services, not as a
separate HTTP microservice. This reduces operational complexity for an academic prototype.

---

## High-Level Diagram

```
┌──────────────────────────────────────────────┐
│               Browser / Client                │
└──────────────────┬───────────────────────────┘
                   │ HTTPS / REST
┌──────────────────▼───────────────────────────┐
│            Next.js Frontend (Port 3000)        │
│                                               │
│  Pages / App Router                           │
│  ├── /login                                   │
│  ├── /dashboard (role-specific)               │
│  ├── /grievances (list, submit, detail)       │
│  ├── /admin (assignments, analytics)          │
│  └── /resolver (queue, actions)               │
│                                               │
│  State: React Server Components + client state│
│  Auth: NextAuth.js (JWT + Google OAuth)       │
└──────────────────┬───────────────────────────┘
                   │ REST API (JSON)
┌──────────────────▼───────────────────────────┐
│            FastAPI Backend (Port 8000)         │
│                                               │
│  Routers                                      │
│  ├── /auth          Auth & token management   │
│  ├── /users         User management           │
│  ├── /grievances    Grievance CRUD + lifecycle│
│  ├── /assignments   Assignment management     │
│  ├── /ai            AI analysis endpoints     │
│  ├── /escalations   Escalation management     │
│  ├── /resolutions   Resolution management     │
│  ├── /analytics     Analytics & insights      │
│  └── /notifications Notification management  │
│                                               │
│  Services                                     │
│  ├── GrievanceService    Lifecycle, state     │
│  ├── AssignmentService   Assignment logic     │
│  ├── AIService           Orchestrates AI      │
│  ├── MonitoringService   SLA, deadline, risk  │
│  ├── AnalyticsService    Insights generation  │
│  └── NotificationService Alerts, updates      │
│                                               │
│  AI/NLP Modules (Python, co-located)          │
│  ├── summarizer.py       AI-01                │
│  ├── classifier.py       AI-02                │
│  ├── entity_extractor.py AI-03                │
│  ├── severity_estimator.py AI-04              │
│  ├── priority_estimator.py AI-05              │
│  ├── similarity_engine.py  AI-06              │
│  ├── assignment_recommender.py AI-07          │
│  ├── risk_assessor.py      AI-08              │
│  ├── escalation_recommender.py AI-09          │
│  ├── resolution_assessor.py  AI-10            │
│  └── insight_generator.py   AI-11             │
└────────┬─────────────────────┬────────────────┘
         │                     │
┌────────▼───────┐    ┌────────▼────────────────┐
│  PostgreSQL DB  │    │  External AI APIs        │
│  (Port 5432)   │    │  LLM API (OpenAI/etc.)   │
│                │    │  Sentence Transformers   │
│  pgvector ext  │    │  (local inference)       │
└────────────────┘    └─────────────────────────┘
```

---

## Frontend Architecture

**Framework:** Next.js 14+ with App Router (TypeScript)

**Key decisions:**
- App Router for server-side rendering where appropriate
- React Server Components for data-heavy pages (grievance lists, analytics)
- Client components for interactive elements (forms, status updates)
- NextAuth.js for session management, JWT handling, and Google OAuth callback
- Tailwind CSS for styling (default with Next.js scaffold)

**Directory structure (proposed):**
```
frontend/
├── app/
│   ├── (auth)/login/
│   ├── (user)/dashboard/
│   ├── (user)/grievances/
│   ├── (resolver)/queue/
│   ├── (admin)/dashboard/
│   ├── (admin)/grievances/
│   ├── (admin)/analytics/
│   └── api/auth/[...nextauth]/
├── components/
│   ├── ui/           (shared UI components)
│   ├── grievance/    (grievance-specific components)
│   ├── admin/        (admin-specific components)
│   └── charts/       (analytics visualization)
├── lib/
│   ├── api.ts        (API client)
│   ├── auth.ts       (NextAuth config)
│   └── types.ts      (shared TypeScript types)
└── public/
```

---

## Backend Architecture

**Framework:** FastAPI (Python 3.11+)

**Key decisions:**
- Async FastAPI with `asyncpg`-backed SQLAlchemy for async DB access
- Dependency injection for database sessions, current user, and role checks
- Alembic for database migrations
- Pydantic v2 for request/response validation and serialization
- Background tasks (FastAPI `BackgroundTasks` or Celery for heavier AI processing)

**Directory structure (proposed):**
```
backend/
├── app/
│   ├── main.py           (FastAPI app factory)
│   ├── config.py         (settings from env vars)
│   ├── database.py       (SQLAlchemy engine + session)
│   ├── dependencies.py   (shared DI: db session, current user, roles)
│   │
│   ├── models/           (SQLAlchemy ORM models)
│   ├── schemas/          (Pydantic request/response schemas)
│   ├── routers/          (FastAPI routers, one per domain)
│   ├── services/         (Business logic layer)
│   ├── ai/               (AI/NLP modules)
│   └── utils/            (helpers, validators)
│
├── alembic/              (migration scripts)
├── tests/
├── requirements.txt
└── .env.example
```

---

## AI Layer Architecture

The AI layer is implemented as Python modules within `backend/app/ai/`.

**Design principles:**
1. Each AI module has a defined input, output, and fallback behavior
2. All AI modules are invoked through `AIService` which handles orchestration
3. LLM calls are made through a configurable provider client (abstracted)
4. Embedding generation is handled locally via Sentence Transformers
5. AI outputs are stored in the database alongside grievances, not only returned transiently
6. Every AI output is tagged with: module ID, model/version used, confidence score where available, timestamp

**AI processing flow:**
```
Grievance submitted
       ↓
AIService.analyze_grievance(grievance_id)
       ↓
┌──────┴───────────────────────────────────────┐
│ Run in parallel (or sequentially if needed): │
│  AI-01: summarize()                          │
│  AI-02: classify()                           │
│  AI-03: extract_entities()                   │
│  AI-04: assess_severity()                    │
│  AI-05: estimate_priority()                  │
└──────────────────────────────────────────────┘
       ↓
Generate and store embedding (AI-06 prerequisite)
       ↓
AI-06: find_similar_grievances()
       ↓
AI-07: recommend_assignment()
       ↓
Store all AI analysis results in database
       ↓
Grievance state → PENDING_ASSIGNMENT
```

---

## Authentication Architecture

```
User → POST /auth/login (email/password) → JWT access + refresh tokens
User → GET /auth/google → Google OAuth 2.0 → JWT tokens

JWT payload: { user_id, role, exp }

Every protected request:
  Authorization: Bearer <access_token>
       ↓
FastAPI dependency: get_current_user()
       ↓
Decode JWT → verify signature → load user from DB
       ↓
Role check dependency: require_role(["ADMIN"])
       ↓
Handler proceeds or 403 Forbidden
```

---

## Database Architecture

See `docs/DATABASE.md` for full schema documentation.

**Key design choices:**
- All tables have `id` (UUID), `created_at`, `updated_at`
- Soft deletes where data must be preserved for audit purposes
- JSONB columns for flexible AI analysis storage
- `pgvector` extension for grievance embeddings
- Audit log table for all significant state changes

---

## Grievance Lifecycle Architecture

```
States: SUBMITTED → AI_PROCESSING → PENDING_ASSIGNMENT → ASSIGNED
        → IN_PROGRESS → [PENDING_ESCALATION → ESCALATED]
        → RESOLVED → [UNDER_REVIEW] → CLOSED
        → REJECTED | WITHDRAWN (terminal states)

Every transition:
  - Validated server-side (invalid transitions return 422)
  - Recorded in grievance_status_history (actor, previous_state, new_state, reason, timestamp)
  - May trigger AI processing, notifications, or monitoring updates
```

---

## Monitoring Architecture

A background monitoring process (scheduled task or polling loop) periodically evaluates:
- Grievances approaching SLA deadline
- Grievances with no activity for N days
- Escalated grievances with no action
- Repeatedly reassigned grievances

Results in AI-08/AI-09 recommendations stored in the database and surfaced to admins.

---

## External Boundaries

| Boundary | Protocol | Notes |
|---|---|---|
| Frontend ↔ Backend | REST/JSON over HTTP | Documented in `docs/API.md` |
| Backend ↔ PostgreSQL | SQLAlchemy async | Internal only |
| Backend ↔ LLM API | HTTPS/REST | API key via env var |
| Backend ↔ Sentence Transformers | Python function call | Local model inference |
| Backend ↔ Google OAuth | HTTPS/OAuth2 | Client ID/secret via env var |

---

## Scalability Note

This architecture is designed for **prototype scale**.
Single-process FastAPI with background tasks is sufficient.
Celery, Redis, and horizontal scaling are not required for this phase.
