# ARCHITECTURE.md — System Architecture

---

## Overview

The system follows a three-tier architecture:

- **Frontend** — Next.js (TypeScript) single-page application served via Node.js
- **Backend** — FastAPI (Python) REST API handling business logic and AI orchestration (`backend/app/`, port `10000`)
- **Database** — MongoDB for all persistent data (DEC-011; originally PostgreSQL, superseded)

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
│            FastAPI Backend (Port 10000)        │
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
│  MongoDB        │    │  External AI APIs        │
│  (Atlas)        │    │  LLM API (Groq/HF)       │
│                │    │  Sentence Transformers   │
│  grievances    │    │  (local inference)       │
│  collection    │    │                          │
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
- FastAPI running under `uvicorn`; repository-based persistence (`GrievanceRepository` protocol) with `pymongo` — no ORM, no migrations (DEC-011)
- Dependency injection for current user and role checks *(planned)*
- Schema evolution handled by flexible documents rather than Alembic migrations
- Pydantic v2 for request/response validation and serialization
- Background tasks (FastAPI `BackgroundTasks`) for heavier AI processing

**Actual directory structure (implemented):**
```
backend/
├── app/
│   ├── main.py           (app factory, CORS, validation error handler)
│   ├── config.py         (settings from env vars via python-dotenv)
│   ├── db.py             (GrievanceRepository protocol; Mongo + in-memory impls)
│   ├── models.py         (Pydantic request/response models)
│   │
│   ├── routers/          (grievances, images, health)
│   ├── services/         (classification, image, cloudinary)
│   └── __init__.py
│
├── .env.example
└── requirements.txt
```

> The `alembic/`, `database.py`, `models/` (SQLAlchemy), `schemas/`,
> `dependencies/`, `ai/`, `utils/`, `tests/` entries previously shown here were
> the *proposed* FastAPI/Postgres layout from before DEC-008; `backend/app/`
> above is what actually exists (DEC-010/DEC-011). A `tests/` directory is
> planned for Phase 6.

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

> **Status: PLANNED — not implemented.** The current prototype uses a demo
> localStorage session in the frontend (`frontend/lib/session.tsx`) with an
> email allowlist for admin role (`frontend/lib/roles.ts`); the API trusts a
> `userId` supplied in the request body. This is a documented known limitation
> (see `docs/SECURITY.md`). The target design below remains the plan.

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

See `docs/DATABASE.md` for full schema documentation (rewritten for MongoDB,
DEC-011).

**Key design choices (current):**
- Documents carry `id`, `createdAt`; unique index on `id`, compound index on `userId + createdAt`
- Flexible documents absorb AI analysis output (no JSONB column concept needed)
- Embeddings column via `pgvector` — **superseded**: deferred until a
  Sentence-Transformers path is built (see `docs/DATABASE.md` roadmap)
- Audit/history trail: **not yet implemented** — planned alongside real auth

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
| Backend ↔ MongoDB | pymongo driver | `MONGODB_URI` env var (Atlas) |
| Backend ↔ LLM API | HTTPS/REST | API key via env var (`GROQ_API_KEY`, `HF_API_TOKEN`) |
| Backend ↔ Sentence Transformers | Python function call | Local model inference *(planned)* |
| Backend ↔ Google OAuth | HTTPS/OAuth2 | *(planned — see Authentication Architecture)* |

---

## Scalability Note

This architecture is designed for **prototype scale**.
Single-process FastAPI with background tasks is sufficient.
Celery, Redis, and horizontal scaling are not required for this phase.
