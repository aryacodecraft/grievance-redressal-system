# DECISIONS.md — Architecture Decision Records

> Never delete an old decision because it changed.
> Mark superseded decisions with: **SUPERSEDED BY DEC-XXX**
> This preserves reasoning history.

---

## DEC-001 — Monorepo Repository Organization

**ID:** DEC-001
**Date:** 2026-08-06
**Status:** ACCEPTED

**Context:**
The project has a distinct frontend (Next.js) and backend (FastAPI) with shared documentation.
A decision is required on whether to use a monorepo or separate repositories.

**Decision:**
Single monorepo with `frontend/`, `backend/`, `docs/`, and `memory/` directories at root.

**Reason:**
- Simplifies coordination for an academic prototype
- A single repository makes cross-cutting concerns (schema changes, API contract changes) easier to track
- Keeps documentation co-located with code
- Easier for multiple AI agents and developers to read the full project in one context

**Alternatives Considered:**
- Separate frontend/backend repos: rejected — increases coordination overhead for prototype scale
- Turborepo/Nx monorepo tooling: deferred — unnecessary complexity for current phase

**Consequences:**
- All frontend and backend code lives under one repository root
- `frontend/` and `backend/` have their own dependency files and env configs
- CI/CD must be configured to handle both

**Affected Components:** Repository structure, CI/CD

---

## DEC-002 — PostgreSQL as Primary Database

**ID:** DEC-002
**Date:** 2026-08-06
**Status:** ACCEPTED

**Context:**
The approved tech stack specifies PostgreSQL. A relational database is appropriate given
the structured domain model (users, grievances, assignments, audit logs) and need for
relational integrity.

**Decision:**
PostgreSQL 15+ as the sole primary database.
ORM: SQLAlchemy (async where practical).
Migrations: Alembic.

**Reason:**
- Approved by project synopsis
- Relational model fits the grievance domain well
- Strong support for JSONB (useful for storing AI analysis results flexibly)
- Mature Alembic migration tooling

**Alternatives Considered:**
- MongoDB: not approved; grievance domain has strong relational structure
- SQLite: not suitable for multi-user concurrent access

**Consequences:**
- All persistent data goes through PostgreSQL
- AI analysis outputs stored as JSONB columns or structured tables (TBD per module)
- Vector similarity search may require pgvector extension (see DEC-004)

**Affected Components:** Backend, all data models

---

## DEC-003 — Human Approval Required for AI Assignment

**ID:** DEC-003
**Date:** 2026-08-06
**Status:** ACCEPTED

**Context:**
AI assignment recommendation (AI-07) is a core feature. A design choice is required
on whether AI assignment is automatic or requires human approval.

**Decision:**
AI provides ranked assignment recommendations. An authorized Admin must approve, modify,
or override the assignment before it becomes effective.

**Reason:**
- Core human-in-the-loop principle
- Academic project must demonstrate controlled AI decision support
- Assignment has real operational consequences — wrong assignments waste resolver time
- Admin override must be preserved in the audit trail

**Alternatives Considered:**
- Fully automatic AI assignment: rejected — violates human-in-the-loop principle
- Automatic assignment with override window: deferred as a possible future enhancement

**Consequences:**
- Grievance enters `PENDING_ASSIGNMENT` state after AI analysis
- Admin sees AI recommendation with confidence/reasoning
- Admin action (approve/modify/override) is recorded with actor and timestamp
- Final assignment record stores both AI recommendation and human decision

**Affected Components:** AI-07, Assignment workflow, Admin UI, Grievance state machine

---

## DEC-004 — Semantic Embedding Strategy for Similarity Detection

**ID:** DEC-004
**Date:** 2026-08-06
**Status:** ACCEPTED (approach selected; implementation PLANNED)

**Context:**
Related grievance detection (AI-06) requires semantic similarity computation.
Multiple approaches are available.

**Decision:**
Use Sentence Transformers (e.g., `all-MiniLM-L6-v2` or similar) to generate grievance
embeddings. Store embeddings for similarity lookup. Use cosine similarity for matching.
Evaluate pgvector for PostgreSQL-native vector storage and ANN search.

**Reason:**
- Sentence Transformers approved in project synopsis
- pgvector provides native PostgreSQL integration, avoiding a separate vector DB
- Cosine similarity is well-understood and interpretable
- `all-MiniLM-L6-v2` is fast and reasonably accurate for short/medium text

**Alternatives Considered:**
- Separate vector DB (Pinecone, Weaviate, Qdrant): deferred — unnecessary infrastructure for prototype
- BM25/TF-IDF: considered as a baseline/fallback; may be used for hybrid retrieval
- OpenAI/LLM embeddings: possible alternative; more expensive but potentially more accurate

**Consequences:**
- Grievance embeddings must be computed and stored at submission time
- pgvector extension must be enabled on PostgreSQL instance
- Similarity results must distinguish duplicates, related grievances, and recurring patterns
- Embedding model choice must be documented and revisitable

**Affected Components:** AI-06, Database (embeddings column/table), Backend AI service

---

## DEC-005 — AI Module Dataset Strategy

**ID:** DEC-005
**Date:** 2026-08-06
**Status:** ACCEPTED

**Context:**
Several AI modules (classification, severity, assignment) may benefit from
fine-tuned or trained models. However, no labelled grievance dataset exists yet.

**Decision:**
- Use LLM API (prompt-based) as the primary approach for initial prototyping of
  classification, summarization, severity, and priority modules
- Use Sentence Transformers for embedding-based similarity (no training required for baseline)
- Mark all AI modules explicitly as PROTOTYPE / EXPERIMENTAL until evaluated against real data
- Do not fabricate accuracy metrics or training results
- Evaluate feasibility of dataset collection or use of publicly available grievance datasets
  (e.g., public government portal datasets, CPGRAMS-style datasets) as the project progresses

**Reason:**
- Honest about research uncertainty
- LLM API allows rapid prototyping before labeled data exists
- Avoids false claims of model performance
- Keeps AI modules replaceable as better data/approaches become available

**Consequences:**
- AI module implementations initially depend on LLM API availability and cost
- Fallback behavior must be designed for LLM API unavailability
- Evaluation metrics must be defined before claiming any module is VALIDATED

**Affected Components:** AI-01 through AI-11, docs/AI_SYSTEM.md

---

## DEC-006 — Grievance State Machine Design

**ID:** DEC-006
**Date:** 2026-08-06
**Status:** ACCEPTED (documented; implementation PLANNED)

**Context:**
The grievance lifecycle requires a well-defined set of states and transitions.
These must be enforced server-side and be auditable.

**Decision:**
Implement a formal state machine with the following states:

```
SUBMITTED
  → AI_PROCESSING
  → PENDING_ASSIGNMENT
  → ASSIGNED
  → IN_PROGRESS
  → PENDING_ESCALATION
  → ESCALATED
  → RESOLVED
  → UNDER_REVIEW        (resolution quality review)
  → CLOSED
  → REJECTED            (admin decision)
  → WITHDRAWN           (user-initiated)
```

Valid transitions are enforced server-side. Every transition is recorded in
`grievance_status_history` with actor, timestamp, and reason.

**Reason:**
- Auditability requirement
- Prevents invalid state transitions
- Enables meaningful SLA and monitoring logic (deadline from ASSIGNED state)
- State history is essential for analytics and escalation detection

**Alternatives Considered:**
- Simpler open-ended status strings: rejected — too ambiguous for monitoring and audit
- External workflow engine: deferred — unnecessary for prototype scale

**Consequences:**
- Backend must validate all state transitions
- State history table required in database
- Frontend must render current state and history clearly

**Affected Components:** Grievance model, Backend workflow service, Database, Admin/Resolver UI

---

## DEC-007 — RBAC Role Structure

**ID:** DEC-007
**Date:** 2026-08-06
**Status:** ACCEPTED (documented; implementation PLANNED)

**Context:**
The system requires role-based access control. The synopsis identifies at least three
human actor types: User, Resolver, and Admin. A decision is required on role granularity.

**Decision:**
Initial roles:

| Role | Description |
|---|---|
| `USER` | Grievance raiser — submit and track own grievances |
| `RESOLVER` | Department staff — view and act on assigned grievances |
| `ADMIN` | Decision authority — full oversight, assignment, configuration |
| `SUPERADMIN` | System-level administration (user management, role assignment) |

Roles stored in database. Permissions enforced server-side via middleware/dependency injection.
JWT payload includes user ID and role. Role claims verified server-side on every protected endpoint.

**Reason:**
- Four roles covers current actor model with room for superadmin separation
- Server-side enforcement is non-negotiable for security
- JWT-based roles allow stateless authorization per request

**Alternatives Considered:**
- Fine-grained permission bitfields: deferred — unnecessary complexity for prototype
- Separate department-level roles: possible future extension

**Consequences:**
- Every protected API endpoint must declare required role(s)
- Role assignment is an admin/superadmin function
- Role changes take effect on next token refresh

**Affected Components:** Auth system, all API endpoints, User model, JWT middleware

---

## DEC-008 — Unified Repo: Flask Backend Kept, FastAPI Scaffold Discarded, Firestore Temporary

**ID:** DEC-008
**Date:** 2026-09-11
**Status:** ACCEPTED

**Context:**
Two codebases existed: `Idea Lab` (FastAPI + PostgreSQL scaffold, Next.js frontend,
docs/memory) and `Idea Lab2` (Flask `backend/server.py` with working ML classifiers,
TF-IDF similarity, Firebase/Firestore persistence, admin HTML UI). Both had a
top-level `backend/`, so a blind merge would have collided. Owner decisions:
keep `Idea Lab2`'s backend + Python/ML logic; keep `Idea Lab`'s project context +
frontend + memory; remove Firebase eventually but keep Firestore working for now.

**Decision:**
1. `backend/server.py` (Flask) is the authoritative backend. Its ML logic —
   `classify_category`, `classify_priority`, `refine_with_groq`,
   `llm_image_confidence`, keyword lists, `/submit-grievance`, `/validate-image` —
   must not be broken by the merge.
2. `tools/recategorize.py` and `functions/tfidf.js` are preserved as the reference
   implementations for AI-02/AI-04/AI-05 (classification/priority) and AI-06
   (similarity) respectively.
3. The `Idea Lab` FastAPI scaffold (`backend/app/`, Alembic, SQLAlchemy models) is
   deliberately NOT copied into this repo.
4. Firebase/Firestore (`firebase.json`, `.firebaserc`, `firestore.rules`,
   `firestore.indexes.json`, `FIREBASE_SERVICE_ACCOUNT`) stays functional in the
   `feature/unified-system` branch. Its removal + persistence replacement is a
   separate follow-up branch.
5. `frontend/` (Next.js), `docs/`, `memory/`, `PRD.md`, `AGENTS.md` are copied from
   `Idea Lab` additively. No `Idea Lab2` file was modified or deleted in the merge.

**Reason:**
- The Flask backend contains the only working, tuned ML logic (HF zero-shot →
  Groq refinement → keyword fallback chain); rewriting it onto FastAPI before
  evaluation would risk regressing classification quality.
- Keeping Firestore temporarily avoids a no-database gap (`/submit-grievance`
  returns 500 when `db is None`).
- Additive-only merge keeps the diff reviewable and `app/intialise`/`main` safe.

**Alternatives Considered:**
- Port Flask ML logic onto FastAPI now: rejected — large blast radius, no
  evaluation harness yet to prove parity.
- Delete Firebase files in the same branch: rejected — leaves persistence gap;
  deferred to follow-up.
- Nest `Idea Lab` content under `grievance-system/`: rejected — no path
  collisions exist for `frontend/`, `docs/`, `memory/` (only `backend/`
  collided, and it was excluded), so top-level copy is cleaner.

**Consequences:**
- `AGENTS.md` "Approved Technology" table (FastAPI/PostgreSQL) is now STALE and
  contradicts this decision — owner must confirm the canonical stack and update
  `AGENTS.md` + `docs/ARCHITECTURE.md` accordingly in a follow-up.
- `docs/DATABASE.md` / `docs/API.md` describe the discarded FastAPI design —
  reference only until rewritten against the Flask + (future) persistence design.
- `frontend/.env.example` (`:8000`) does not match the Flask backend (`:10000`) —
  rewiring deferred to frontend-integration follow-up.
- `memory/TODO.md` PHASE 1–4 FastAPI/Postgres tasks are SUPERSEDED where they
  conflict with this decision (annotated in TODO.md).

**Affected Components:** Repository layout, backend authority, persistence plan,
frontend wiring, all `docs/` and `memory/` files copied from `Idea Lab`

**Source map:** see `INTEGRATION.md` at repo root.
