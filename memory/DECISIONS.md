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
**Status:** SUPERSEDED BY DEC-011 (2026-10-01, Phase 5) — MongoDB is the
database in the serving path. The SQLAlchemy/Alembic choices here never made it
into this repository. Retained as the record of the originally approved stack;
`AGENTS.md`'s stack table was reconciled in Phase 5.

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
**Status:** ACCEPTED — items 1 and 3 SUPERSEDED BY DEC-010 (FastAPI `backend/app/` is the serving path; `backend/server.py` deleted in Phase 3), item 4 SUPERSEDED BY DEC-011 (Firestore/Firebase config files deleted), item 2 partially superseded (`functions/tfidf.js` ported to `frontend/lib/tfidf.ts`; `tools/recategorize.py` rewritten for MongoDB). Item 5 (additive-only merge) remains valid.

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

---

## DEC-009 — Frontend De-Firebase: Demo Auth, REST Polling, Client-Side TF-IDF

**ID:** DEC-009
**Date:** 2026-09-11
**Status:** ACCEPTED (implements UNIFIED_MIGRATION_PLAN Phase 1 + 1.5)

**Context:**
The Next.js frontend was wired to the Firebase client SDK (Auth + Firestore
`onSnapshot`) while the migration plan calls for Firebase removal and a typed
REST client. Phase 1.5 additionally requires behavioural parity with the legacy
HTML UI (`functions/*.html`). Real authentication and the backend rewrite
(Phase 2) do not exist yet.

**Decision:**
1. `frontend/lib/firebase.ts` is deleted; `firebase` and `next-auth` are removed
   from `frontend/package.json`. The admin allowlist moves to
   `frontend/lib/roles.ts` (`ADMIN_EMAILS`, `isAdminEmail`, `roleForEmail`).
2. `frontend/lib/session.tsx` is a demo localStorage provider only
   (`user`, `liveMode` from `NEXT_PUBLIC_USE_MOCKS`, `signInDemo`, `signOut`).
   Real auth is deferred; the persisted demo user id is the identity sent to
   the API. This keeps AI/admin actions human-attributed per the HITL rule
   until server-side auth lands.
3. Firestore `onSnapshot` is replaced by REST polling in
   `frontend/lib/grievances.ts` (15s default) — same admin/citizen scoping
   (admins: all, citizens: own) as the old security rules.
4. TF-IDF clustering stays **client-side** (`frontend/lib/tfidf.ts`, a port of
   `functions/tfidf.js`), matching the legacy HTML behaviour, so the admin
   cluster panel works without backend support; a server-side port is optional.
5. The API contract is defined by `frontend/lib/api.ts`:
   `POST /submit-grievance`, `GET /grievances`, `GET /grievances/{id}`,
   `PATCH /grievances/{id}/status`, plus existing image/health endpoints.

**Reason:**
- Removes the browser-side Firebase dependency (and the leaked web API key
  surface in frontend code) without a persistence gap server-side.
- Polling is deterministic and simple; WebSockets/SSE are unnecessary for a prototype.
- Client-side TF-IDF preserves verified legacy behaviour cheaply.
- Demo auth is explicitly temporary and reversible — swap `session.tsx` for a
  real provider without touching consumers.

**Alternatives Considered:**
- Keep Firebase Auth for live data: rejected — contradicts the migration plan's Phase 1.
- Fake JWT auth in the frontend: rejected — client-issued tokens provide no
  security and would misrepresent auth as implemented.
- Server-side TF-IDF now: rejected — deferred to Phase 2/4; legacy parity does
  not require it.

**Consequences:**
- Live mode calls `GET/PATCH /grievances*`, which `backend/server.py` does not
  implement yet — live reads/writes fail until Phase 2 (documented in
  PROJECT_STATE "Known Issues"); mock mode (`NEXT_PUBLIC_USE_MOCKS=true`) is
  the default and unaffected.
- `firestore.rules` / `functions/admin_api.js` Firebase auth remains for the
  legacy HTML UI only; server-side Firebase removal is still pending.
- Any route can read the localStorage session (no server-side authorization
  yet) — acceptable only for the prototype, must not reach production.

**Affected Components:** `frontend/` (session, data access, admin UI, auth
pages, deps), migration docs, memory

---

## DEC-010 — Phase 2: FastAPI Becomes the Serving Path; In-Process Repository Pending MongoDB

**ID:** DEC-010
**Date:** 2026-09-11
**Status:** ACCEPTED (implements UNIFIED_MIGRATION_PLAN Phase 2; supersedes
DEC-008 items 1, 3 and 4 — see the annotation on DEC-008)

**Context:**
DEC-008 kept `backend/server.py` (Flask + Firestore) authoritative and
discarded the FastAPI scaffold. `UNIFIED_MIGRATION_PLAN` (owner-approved
follow-up) instead calls for a FastAPI rewrite (`Phase 2`), Firestore →
MongoDB replacement (`Phase 3`), and full Firebase removal, with the frontend's
typed REST client (`lib/api.ts`) defining the contract. Phase 1/1.5 had already
removed Firebase from the frontend.

**Decision:**
1. `backend/app/` (FastAPI) is the serving path: `uvicorn
   backend.app.main:app` (render.yaml). Endpoints mirror the legacy contract
   exactly — `POST /submit-grievance` (`message, grievanceId, hfEngine`),
   `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status`,
   image + health routes, `400 {"error": …}` validation shape.
2. Classifier/image logic is ported **verbatim** from `backend/server.py`
   (HF → Groq → keyword cascade); `CATEGORY_KEYS` stays byte-identical to the
   frontend's `CATEGORIES`.
3. Persistence goes behind a `GrievanceRepository` protocol (`db.py`). Phase 2
   ships an in-process repository so every endpoint works end-to-end with no
   external service; Phase 3 swaps in MongoDB (`pymongo`/`motor`,
   `MONGODB_URI`/`MONGODB_DB`) with no router changes.
4. `backend/server.py`, `tools/recategorize.py`, `functions/`, and root
   `firebase.*` remain untouched as legacy reference until Phase 3 + parity
   sign-off; they are excluded from the serving path.
5. `config.py` uses `python-dotenv`, not `pydantic-settings`, to avoid an
   extra dependency.

**Reason:**
- The frontend contract already existed and needed a real server; an
  in-process repository delivers working endpoints without introducing
  MongoDB before the persistence decision is exercised.
- Verbatim porting preserves ML behaviour without an evaluation harness to
  prove a rewrite.
- Protocol-based persistence makes the MongoDB swap a single-file change.

**Alternatives Considered:**
- Keep Flask as authoritative (DEC-008 status quo): rejected — the approved
  migration plan explicitly targets FastAPI, and two backends would diverge.
- Implement MongoDB directly in Phase 2: rejected — plan splits it into
  Phase 3; in-process repo keeps Phase 2 verifiable without external services.
- Fake the API in the frontend: rejected — contradicts the migration plan.

**Consequences:**
- DEC-008 items 1, 3 and 4 are marked partially superseded; Flask remains in
  the repo but is no longer the target architecture.
- In-process persistence is **volatile and single-process** — data is lost on
  restart; acceptable only until Phase 3 lands (documented, not a hidden gap).
- Server-side Firebase removal (Phase 4) still pending: `backend/server.py`,
  `tools/`, `functions/`, `render.yaml` history, root `firebase.*` files.
- `/submit-grievance` degrades gracefully without `GROQ_API_KEY`/
  `HF_API_TOKEN` (keywords-only classification) — matches legacy fallback.

**Affected Components:** `backend/app/`, `backend/server.py` (legacy),
`render.yaml`, requirements files, `frontend/lib/api.ts`/`types.ts`
(null-tolerant schemas), migration docs, memory

---

## DEC-011 — Phase 3: MongoDB Replaces Firestore; Firebase Config and Flask Server Retired

**ID:** DEC-011
**Date:** 2026-09-11
**Status:** ACCEPTED (implements UNIFIED_MIGRATION_PLAN Phase 3; supersedes
DEC-008 item 4). Follow-ups from the Consequences section: **Phase 4 done**
(`functions/` + `adfbh` deleted, `09e83af`) and **Phase 5 done** (AGENTS stack
table + docs reconciled, `cfdb7d1`/`4e52990`, DEC-002 marked superseded).
**Still open:** Firebase Web API key rotation (key remains in git history) and
the owner's MongoDB Atlas setup.

**Context:**
Phase 2 left persistence on an in-process repository with MongoDB planned, and
Firestore config files plus the legacy Flask `backend/server.py` still in the
repo. `UNIFIED_MIGRATION_PLAN` Phase 3 specifies MongoDB (Atlas) as the sole
datastore, and its "definition of done" requires that no Firebase/Firestore
code remains.

**Decision:**
1. `MongoRepository` (pymongo) implements the existing `GrievanceRepository`
   protocol; routers are untouched. `db.py` selects it when `MONGODB_URI` is
   set, else falls back to `InMemoryRepository`. `/health` reports
   `storage: mongodb | in-memory`.
2. Indexes at startup: unique `id` (`uniq_grievance_id`) and compound
   `userId + createdAt` (`user_created`); `createdAt` stored as a BSON date
   and serialised to ISO-8601 in `to_api()`.
3. Dependencies: `pymongo` + `dnspython` (needed for Atlas `mongodb+srv://`)
   added; `firebase-admin`, `Flask`, `gunicorn` and the Google client stack
   removed from both requirements files.
4. `tools/recategorize.py` rewritten for Mongo; it now imports the shared
   classifier from `backend/app/services/classification.py` and supports
   `--dry-run`.
5. Deleted: `backend/server.py`, `firebase.json`, `.firebaserc`,
   `firestore.rules`, `firestore.indexes.json`. `backend/.env.example`
   documents `MONGODB_URI`/`MONGODB_DB`.
6. `docs/DATABASE.md` rewritten for Mongo; the 22 Postgres entities moved to
   a roadmap section.

**Reason:**
- One datastore in the serving path; keeping Firestore alongside Mongo would
  split writes and keep the Firebase credential surface alive.
- The repository protocol made the swap a single-file change — no router or
  frontend edits (verified: in-memory and Mongo paths both pass the same
  smoke test).
- Deleting the Flask server removes the last second backend that could drift.

**Alternatives Considered:**
- Keep Firestore as the Phase 3 datastore: rejected — plan targets Mongo; the
  Firebase service-account env var and rules files were the last Firebase
  dependency in the serving path.
- PostgreSQL + pgvector (per DEC-002 / AGENTS.md): rejected — DEC-002 remains
  on record as the original plan, but MongoDB matches the document shape of
  existing grievance records and the migration plan; the AGENTS.md stack table
  must be reconciled in Phase 5 (open).
- Motor (async pymongo): rejected for now — the repository methods are
  synchronous and FastAPI runs them in the threadpool; switching would ripple
  through the protocol for no measured gain.

**Consequences:**
- Nothing persists until the owner sets `MONGODB_URI` in `backend/.env`
  (in-memory fallback is the default; `/health` makes the mode visible).
- The in-memory fallback is intentionally non-persistent — a development
  convenience, not a store.
- `functions/` (legacy Firebase HTML/JS) and root `adfbh` remain — Phase 4.
- The hardcoded Firebase web API key still exists in git history — rotation
  remains mandatory (Phase 5), independent of these deletions.
- DEC-008 item 4 is superseded; DEC-002 (PostgreSQL) is now in tension with
  the real stack and needs an owner decision recorded in Phase 5.

**Affected Components:** `backend/app/db.py`, `backend/app/routers/health.py`,
requirements files, `tools/recategorize.py`, `docs/DATABASE.md`,
`backend/.env.example`, deleted Firebase config + `backend/server.py`, memory

---

## DEC-012 — Phase 6: Test Strategy (pytest, root-level tests, skip-if-unreachable Mongo)

**ID:** DEC-012
**Date:** 2026-10-01
**Status:** ACCEPTED (implements UNIFIED_MIGRATION_PLAN Phase 6)

**Context:**
Phases 1–5 left no automated tests; every verification so far had been manual
(in-process `TestClient` smoke tests, live `uvicorn` runs, throwaway `mongod`
checks). The migration plan's Phase 6 calls for a pytest suite covering the
classifier, the endpoints, and the repository layer, plus a repo-wide
`rg -i "firestore|firebase"` sweep. The suite had to work on a machine with no
database and no LLM keys — the state a fresh clone is in.

**Decision:**
1. `tests/` at the repository root with `pytest.ini`
   (`testpaths = tests`, `pythonpath = .`) so `backend.app` imports without
   installation. Three files: `test_classification.py` (keyword classifier +
   the `CATEGORY_KEYS` ↔ frontend `CATEGORIES` contract), `test_endpoints.py`
   (real FastAPI app over `TestClient`), `test_repository.py` (both
   `GrievanceRepository` implementations + `_build_repository()` selection).
2. `tests/conftest.py` pins `MONGODB_URI=""`, `MONGODB_DB`, `GROQ_API_KEY=""`
   and `HF_API_TOKEN=""` **before `backend.app` is imported**. This forces the
   deterministic keyword path and the in-memory store, so endpoint tests can
   never reach a real cluster or the network. (`load_dotenv()` does not
   override existing env vars, so pinning wins over `backend/.env`.)
3. An **autouse fixture swaps a fresh `InMemoryRepository` per test** by
   reassigning `backend.app.routers.grievances.repository`. Necessary because
   `db.repository` is module-global and the router binds it at import
   (`from ..db import repository`), so tests would otherwise share state.
4. **Mongo tests skip, they do not fail.** `TEST_MONGODB_URI` defaults to
   `mongodb://127.0.0.1:27017`; a ping with a 750 ms timeout decides. The
   fixture drops the collection before and after each test, and one test drops
   its throwaway database explicitly, so a local `mongod` is left clean.
5. Dev dependencies live in a new `requirements-dev.txt` (`-r requirements.txt`
   + `pytest`). The root `requirements.txt` stays runtime-only because
   Render's `buildCommand` installs it.
6. Repository *selection* is tested by monkeypatching `backend.app.config`
   rather than reloading modules — `_build_repository()` does a function-local
   `from .config import ...`, so the patched attribute is what it reads.

**Reason:**
- Deterministic tests are the point: the HF/Groq cascade is EXPERIMENTAL
  (DEC-005) and needs keys + network, so it is deliberately not asserted.
- Skipping (rather than failing) without a database keeps `pytest` usable on
  any machine while still exercising Mongo where one exists.
- Swapping the router's bound `repository` is the only way to get isolation
  without restructuring production code purely for tests.

**Alternatives Considered:**
- Pointing tests at the owner's Atlas cluster: rejected — tests must not write
  to production data, and the owner is setting Atlas up separately.
- Reloading `backend.app.db` per test to rebuild the repository: rejected —
  import-order fragile, and it would not update the router's already-bound name.
- Requiring a Docker Compose Mongo for the suite: rejected — would make
  `pytest` fail out of the box for contributors without Docker.
- `pytest-asyncio` / async tests: rejected for now — the repository protocol is
  synchronous and FastAPI runs it in the threadpool (same reasoning as DEC-011).

**Consequences:**
- `pytest` green without any database (68 tests) and with one (85 tests).
- The suite does **not** cover the HF/Groq classification branches, auth
  (unimplemented), or the image/Cloudinary services — those remain uncovered.
- `render.yaml` gained `MONGODB_URI` (sync: false) + `MONGODB_DB` in this phase;
  without them a deployment silently runs on the in-memory fallback.

**Affected Components:** `tests/`, `pytest.ini`, `requirements-dev.txt`,
`render.yaml`, `docs/DEVELOPMENT.md`

---

## DEC-013 — Phase 5: Stale Docs Annotated in Place, Not Rewritten

**ID:** DEC-013
**Date:** 2026-10-01
**Status:** ACCEPTED (implements UNIFIED_MIGRATION_PLAN Phase 5)

**Context:**
`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/SECURITY.md` and
`docs/DEVELOPMENT.md` describe a FastAPI/PostgreSQL/JWT design that was proposed
before the repository was unified and before DEC-010/DEC-011 landed. Most of
that content is still the *target* design — only the persistence layer and the
serving entry point changed. Rewriting them from scratch would delete the
reasoning that `AGENTS.md` requires memory to preserve.

**Decision:**
- Correct the factual mismatches (port `:8000` → `:10000`, PostgreSQL →
  MongoDB, `alembic upgrade head` → no migrations, the directory tree → the
  real `backend/app/`, SQLAlchemy/asyncpg → pymongo, the error format → the
  actual `{"error": …}` / 400).
- Mark unimplemented sections with a `**Status: PLANNED — not
  implemented**` banner instead of deleting them (Authentication in
  `ARCHITECTURE.md` and `SECURITY.md`).
- `docs/API.md` gains an "Implemented endpoints" table at the top plus a note
  that the implemented create route is `POST /submit-grievance`, not the
  planned `POST /grievances`; the rest of the file stays as the planned surface.
- `docs/SECURITY.md`'s Known Prototype Limitations now leads with the
  **server-side auth gap** — the API trusts `userId` from the request body and
  performs no authorization; the frontend allowlist is client-side only.
- `AGENTS.md`'s stack table is updated in place (Backend/Database/Auth rows)
  with a dated note, and `INTEGRATION.md` gets a status banner + resolved-loose-
  ends annotation rather than a rewrite, since it is the source map for the
  original merge.
- `README.md` is the one document rewritten wholesale — it described a
  Flask/`server.py` world that no longer exists anywhere in the tree.

**Reason:**
- `AGENTS.md`: "Never replace useful documentation with a shorter generic
  version… Preserve historical decisions, useful explanations." A banner keeps
  the proposed design available while making the current truth unmissable.
- The planned auth design is still the target, so deleting it would make the
  docs *wrong* in a new way rather than right.

**Alternatives Considered:**
- Full rewrite of all four docs: rejected — would discard the RBAC/OAuth/API
  design work and violate the context-preservation rule.
- Leaving them untouched with a "reference only" warning (the Phase 3 state):
  rejected — the plan explicitly requires reconciliation, and a doc that
  contradicts the running system is actively misleading.

**Consequences:**
- Readers must notice the status banners to know what is implemented; the
  "Implemented endpoints" table in `API.md` exists for that reason.
- `docs/DATABASE.md` and `docs/WORKFLOWS.md` were already rewritten/checked in
  Phase 3 and were not revisited here.
- The Auth row in `AGENTS.md` is now honest about the gap between the
  JWT/OAuth target and the demo localStorage session (DEC-009).

**Affected Components:** `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`,
`docs/API.md`, `docs/SECURITY.md`, `docs/DEVELOPMENT.md`, `INTEGRATION.md`

---

## DEC-014 — Phase 6 Follow-up: Grievance IDs Derived From Stored Data, Not a Per-Process Counter

**ID:** DEC-014
**Date:** 2026-10-02
**Status:** ACCEPTED

**Context:**
Cutting over to real MongoDB surfaced a latent defect in `backend/app/db.py`.
`_new_id()` was `f"GRV-{year}-{next(_counter):04d}"` over a module-level
`itertools.count(1)` — a counter that starts at 1 **in every process**. The
first submission after any restart therefore always asked for
`GRV-<year>-0001`. With empty storage that works; once data exists,
`uniq_grievance_id` rejects it:

```
pymongo.errors.DuplicateKeyError: E11000 duplicate key error collection:
grievance.grievances index: uniq_grievance_id dup key: { id: "GRV-2026-0001" }
→ POST /submit-grievance 500
```

i.e. **the API could not create a grievance after a restart** — the most basic
persistence requirement. It had been invisible because every verification run
either started from an empty database or, as later discovered, had not
actually recycled the listening process (a `kill` on a stale PID file silently
failed, so the "restart" test passed against a process that never exited).

**Decision:**
1. Delete `_new_id()` and `_counter`. Id allocation moves into each
   repository implementation, derived from what is stored:
   - `MongoRepository._next_sequence()` reads the highest `id` with
     `{"id": {"$gte": "GRV-<year>-"}}` sorted descending — bounded by the
     current-year prefix, so the lookup rides the `uniq_grievance_id` index
     rather than scanning. Sequence = stored tail + 1.
   - `InMemoryRepository.create()` takes `max(existing tails) + 1` for the
     current year under its lock.
2. `MongoRepository.create()` retries on `DuplicateKeyError` (up to 100 times,
   popping the driver-injected `_id` each attempt) so two concurrent writers
   resolving to the same number cannot 500.
3. Helper functions `_id_for(year, seq)` / `_sequence_of(id)` are shared by
   both implementations; the visible scheme `GRV-<year>-<seq>` is unchanged.

**Alternatives Considered:**
- A `counters` collection with an atomic `find_one_and_update` + `$inc`:
  rejected — a second collection and a second failure mode for a prototype
  whose id space is per-year and whose uniqueness is already guaranteed by an
  index. The read-then-retry approach leans on the index it exists to protect.
- `ObjectId` / ULID: rejected — `docs/DATABASE.md`, `docs/API.md` and the
  frontend `track` UI all publish the human-readable `GRV-…` form.
- Seeding the in-process counter from storage at boot and keeping `itertools`:
  rejected — it fixes restart but not concurrent writers, and keeps two
  sources of truth for the next value.

**Consequences:**
- Restart-safe by construction; a fresh process resumes at the stored tail.
- Two extra small functions in `db.py`, and an indexed read per insert.
- Cross-year edge cases (clock moving backwards, a foreign
  `GRV-2027-…` id) resolve to a still-unique number via the retry.
- A test that asserts ids are allocated from data would have caught this;
  the existing suite only asserts `startswith("GRV-")` (tracked in `TODO.md`).

**Affected Components:** `backend/app/db.py`, `docs/DATABASE.md`

---

## DEC-015 — Phase 6 Follow-up: Env-Var Port Audit; Groq Model Defaults Repaired

**ID:** DEC-015
**Date:** 2026-10-02
**Status:** ACCEPTED

**Context:**
An audit of every environment variable used by `main` against the unified
branch found three drifts introduced while `backend/server.py` was rewritten
into `backend/app/` (Phase 2):

1. `GROQ_MODEL` defaulted to `llama-3.3-70b-versatile`, a model Groq has
   decommissioned — the call 404s, and because failure is swallowed the
   classifier silently degrades to keyword rules while appearing configured.
   The same dead value shipped in `backend/.env.example`, so a fresh clone
   inherited it.
2. `LLAVA_MODEL` was declared in `config.py` and never read: `services/image.py`
   hardcoded `meta-llama/llama-4-scout-17b-16e-instruct`, so overriding the
   variable did nothing.
3. `OPEN_ROUTER_API_KEY` (used by `main`'s image validation) was never ported —
   Phase 2 rewrote `services/image.py` around Groq vision + an image-quality
   heuristic.

**Decision:**
1. `GROQ_MODEL` default and `.env.example` → `openai/gpt-oss-20b`, the model
   verified working against this project's key, with a dated comment recording
   why the old default was removed. `GROQ_MODEL` stays overridable — the right
   value is key-specific, so this is a repair, not a lock-in.
2. `services/image.py` imports and uses `LLAVA_MODEL`, making the variable real
   (behaviour unchanged: the default equals the previously hardcoded value).
3. **`OPEN_ROUTER_API_KEY` is intentionally not ported.** Image validation
   keeps its two-tier design — Groq vision when available, deterministic
   image-quality heuristic otherwise — and does not gain a third provider.
   Recorded rather than silently dropped, so the difference from `main` is a
   decision instead of an omission.

**Alternatives Considered:**
- Re-introducing OpenRouter for image validation to reach feature parity with
  `main`: rejected — it would add a provider, an API key and a second vision
  path for a behaviour the heuristic already covers, and the project has
  not committed to paid vision inference.
- Deleting `LLAVA_MODEL` instead of wiring it: rejected — the vision model
  should be configurable the same way the text model is, and `image.py`'s
  hardcoded literal was the anomaly.
- Keeping `llama-3.3-70b-versatile` as the documented default and only noting
  the 404: rejected — a broken default in `.env.example` is copied verbatim by
  every new setup.

**Consequences:**
- A fresh clone classifies with a model that actually responds; behaviour on
  this project's key is unchanged (`.env` already pinned the working value).
- Image validation has two configurable models (`GROQ_MODEL`, `LLAVA_MODEL`)
  and no OpenRouter dependency.
- Cloudinary remains the only third-party media service; its preset
  unsigned-ness is now confirmed (see `SESSION_LOG.md`, 2026-10-02).

**Affected Components:** `backend/app/config.py`, `backend/app/services/image.py`,
`backend/.env.example`

---

## DEC-016 — Test Suite Policy: Fix Real Bugs, Baseline Known Gaps

**ID:** DEC-016
**Date:** 2026-10-02
**Status:** ACCEPTED (extends DEC-012)

**Context:**
The suite grew from 85 to 207 tests. Writing them surfaced two categories of
failing expectation that had to be resolved differently, and the choice made
once would otherwise be re-litigated by every later agent:

- **Real bugs** — behaviour no one intended, where two code paths disagree.
  Encoding them as passing assertions would freeze the defect into the suite.
- **Known gaps** — behaviour that is *deliberately* deferred to a later phase
  (no auth, no state machine). Failing these today would leave a red suite;
  silently omitting them would lose the measurement Phase 1/2 must be judged by.

**Decision:**
1. **A failing test caused by a real bug is fixed, not encoded.** Applied to:
   `?limit=0`/negative — pymongo reads `.limit(0)` as *unlimited* while a
   Python slice reads it as empty, so one URL returned the whole collection on
   MongoDB and zero rows in-memory; the in-memory list sorted ties by priority
   weight while Mongo ignored it, so dev and production ordered records
   differently; `PATCH status=""` was stored verbatim (only `None` was
   filtered), leaving `Badge` with no match; unrouted `404`/`405` returned
   Starlette's `{"detail"}`, which `lib/api.ts` never reads; `_storage_mode`
   was assigned only after a successful ping, so a cluster down at boot made
   `/health` report `in-memory` while requests went to MongoDB; and
   `hfEngineSchema` omitted `categoryConfidence`, which zod stripped silently —
   the confidence display vanished on live data but kept working on mocks.
2. **A gap deferred to a later phase becomes a `test_BASELINE_*` test** that
   asserts today's behaviour with a docstring stating what must change and a
   message telling the future author to invert it rather than delete it. Used
   for: no auth on read or `PATCH` (`test_security_baseline.py`), identity
   taken from the request body, no rate limiting, arbitrary status strings and
   no history (Phase 2), `roleForEmail`'s `includes("admin")` substring
   escalation, and `/health` not pinging. These pass now and **must fail** when
   the phase lands — a green suite after Phase 1 with the same tests is the
   signal that the gap was not actually closed.
3. **Source-parsing assertions are acceptable where import is not.** JSX
   (`TIMELINE`, `StatusBadge`) cannot load outside a React runtime, so
   `test_status_vocabularies.py` regexes the `.tsx` files; `test_config_drift.py`
   parses `config.py`, both `.env.example` files and `render.yaml`. Brittle by
   design — a refactor that breaks the parse fails loudly instead of silently
   emptying the set an assertion iterates.
4. **`/health` reports configuration, not reachability.** `storage` is
   `"mongodb"` whenever `MONGODB_URI` is set, even if the cluster never
   answered. Adding a ping would hold a deployment health check open for
   `serverSelectionTimeoutMS` (8 s) exactly when the cluster is down, and a
   `503` would trigger restarts that cannot fix an unreachable Atlas. Liveness
   belongs on a separate future `/readyz` with a short timeout; `/health` keeps
   its current 200-always semantics because `render.yaml` and the frontend
   `checkBackendHealth()` both rely on it.

**Alternatives Considered:**
- Marking the known gaps `xfail`: rejected — `xfail` reports as expected, so
  nothing forces a reader to notice *what* is missing, and a strict marker
  would break Phase 1's build for the wrong reason. An explicitly named
  baseline test carries its own explanation and fails at exactly the right
  moment.
- Fixing the security gaps now: rejected — server-side authorisation, the
  status vocabulary and audit history are Phase 1 and Phase 2 by the roadmap
  the owner set on 2026-10-01. Implementing them here would silently expand
  scope, and half-done auth is worse than documented-absent auth.
- Adding a live ping to `/health`: rejected, see Decision 4.

**Consequences:**
- The suite is green today (207 pytest + 18 frontend contract checks) and each
  later phase has a measurable "before" it must break.
- Phase 1 must update `tests/test_security_baseline.py` and the `BASELINE`
  block in `frontend/scripts/check-contract.mjs`; Phase 2 must update
  `test_status_vocabularies.py`'s four-site divergence assertions.
- Six divergences fixed in the same pass are now pinned by regression tests,
  so neither can return unnoticed.

**Affected Components:** `backend/app/db.py`, `backend/app/routers/grievances.py`,
`backend/app/main.py`, `frontend/lib/api.ts`, `render.yaml`,
`backend/.env.example`, `tests/` (9 files), `frontend/scripts/check-contract.mjs`

---

## DEC-017 — Phase 1: JWT Authentication, Google OAuth 2.0 & RBAC Enforcement

**ID:** DEC-017
**Date:** 2026-10-03
**Status:** ACCEPTED (IMPLEMENTED)

**Context:**
Prior to Phase 1, the backend had no authentication or authorization: `userId` was trusted from the request body, `PATCH /grievances/{id}/status` was accessible to any anonymous caller without role checks, and the frontend relied on demo localStorage data. Real authentication with RBAC and Google OAuth was requested.

**Decision:**
1. **Authentication Stack:**
   - Stateless JWT tokens (HMAC-SHA256 via PyJWT).
   - Access tokens (60 min expiry) contain `{sub: user_id, role: role, email: email, type: "access"}`.
   - Refresh tokens (7 days expiry) contain `{sub: user_id, type: "refresh"}`.
   - Password hashing with `bcrypt` (12 rounds) directly.
   - Google OAuth 2.0 integration via redirect (`/auth/google`) and callback (`/auth/google/callback`) with token issuance.
   - Startup seed hook in `backend/app/main.py` using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (idempotent).
2. **Users Storage:**
   - Follows repository pattern in `backend/app/users_db.py`: `MongoUsersRepository` when `MONGODB_URI` is set (`users` collection with unique index on `email`), falling back to `InMemoryUsersRepository` for local development and testing.
3. **RBAC Rules (`DEC-007` implemented):**
   - `POST /submit-grievance`: derives `userId` from verified JWT when authenticated (rejecting body spoofing); accepts body `userId` in unauthenticated/demo mode for backward-compatibility.
   - `GET /grievances`: authenticated citizens (`USER`) are strictly scoped to their own grievances (`userId` derived from token); officers (`ADMIN`, `SUPERADMIN`, `RESOLVER`) can view all grievances or filter by query param.
   - `GET /grievances/{id}`: authenticated citizens can only read their own grievances; admins/resolvers can read any.
   - `PATCH /grievances/{id}/status`: protected with `require_role(["ADMIN", "SUPERADMIN", "RESOLVER"])` dependency; unauthorized callers receive 401/403.
4. **Frontend Integration:**
   - `frontend/lib/session.tsx`: full `Session` state with `login()`, `register()`, `signOut()`, auto-loading profile via `/auth/me` on mount.
   - `frontend/lib/api.ts`: automatic `Authorization: Bearer <token>` injection into API requests; auto-refreshes on 401 using refresh token.
   - UI pages: `app/login/page.tsx` and `app/register/page.tsx` wired to real live auth with Google sign-in button and demo mode fallback; `app/auth/callback/page.tsx` handles Google OAuth redirection.
5. **Testing:**
   - Created `tests/test_auth.py` covering registration, login, refresh, `/auth/me`, and RBAC permissions.
   - Inverted `tests/test_security_baseline.py` to assert secure behavior (rejecting unauthenticated status updates and verifying JWT-derived identity).

**Consequences:**
- The highest-risk security gap documented in `docs/SECURITY.md` is resolved.
- Endpoints enforce authorization server-side without relying on client claims.
- The test suite remains green (202 passed, 27 skipped Mongo integration tests).

**Affected Components:** `backend/app/auth.py`, `backend/app/users_db.py`, `backend/app/routers/auth.py`, `backend/app/routers/grievances.py`, `backend/app/config.py`, `backend/app/models.py`, `backend/app/main.py`, `frontend/lib/session.tsx`, `frontend/lib/api.ts`, `frontend/lib/types.ts`, `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/auth/callback/page.tsx`, `tests/test_auth.py`, `tests/test_security_baseline.py`, `tests/test_endpoints.py`.

---

## DEC-018 — Admin UI Restructuring & Prototype SLA Indicator

**ID:** DEC-018
**Date:** 2026-10-05
**Status:** ACCEPTED (IMPLEMENTED)

**Context:**
The admin portal had grown into a single dense page: a two-column queue +
inline resolver workspace, an embedded geographic map, an inline TF-IDF cluster
panel, and a charts section — all on `/admin`. This made every triage action
compete for space with analytics. The owner approved the modular 3-part design
recorded in `memory/ADMIN_UI_RESTRUCTURING_PLAN.md`. The plan also requires an
`Overdue` / `On Track` SLA indicator on the queue, but the backend has no SLA
configuration yet (PRD OQ-005 is OPEN; monitoring is Phase 9 PLANNED), so no
`due_date` is persisted.

**Decision:**
1. **Split the admin surface into three parts:**
   - `/admin` — lean, full-width queue **table** with KPI cards, department tabs,
     filters, and a row-triggered review dialog. No inline map or charts.
   - `GrievanceReviewModal.tsx` — centered dialog owning ticket metadata,
     evidence, a single-pin Leaflet map, AI triage panel, and officer actions.
   - `/admin/analytics` — dedicated executive page for macro metrics,
     distribution charts, the spatial map, TF-IDF clusters, and CSV export.
2. **Shared admin chrome/hook:** `AdminGate` (authorization), `AdminNav` +
   `AdminHeader`, `useAdminGrievanceFeed`, and a shared `DEPARTMENTS` list are
   reused by both pages so the access/loading contracts do not diverge.
3. **Prototype SLA heuristic (display-only):** `frontend/lib/sla.ts` derives a
   deadline deterministically as `createdAt + DEFAULT_SLA_DAYS[priority]`
   (high = 3d, medium = 7d, low = 14d). It is explicitly a stand-in and must be
   replaced by the server's persisted `due_date` when the SLA configuration
   module (Phase 9 / OQ-005) lands. It is deterministic (no AI), matching the
   AGENTS rule that SLA deadline calculation is backend logic.
4. **Human-in-the-loop preserved:** all transitions and routing remain explicit
   officer actions in the dialog; AI output is presented as decision support
   only (`AnalysisPanel`).

**Alternatives Considered:**
- Reuse the existing `AdminMap` for the single-pin modal view: rejected — its
  fit-to-bounds/focus behaviour is designed for many markers and would need
  callback stability gymnastics inside a dialog; a dedicated `SinglePinMap` is
  simpler and isolated.
- Keep the resolver panel inline and add the table around it: rejected — the
  plan explicitly calls for a centered dialog to give the queue full width.
- Compute a real SLA from a persisted `due_date`: not possible — the field does
  not exist yet.

**Consequences:**
- `/admin` is now a high-throughput triage surface; analytics no longer slows it.
- The `Overdue` count and `SLA Overdue` macro metric depend on the prototype
  heuristic and will under/over-report until real SLA config ships.
- `AdminCharts` gained an optional `items` prop (defaults to the mock registry).
- `tests/test_status_vocabularies.py`'s `AdminBoard` status-filter extractor
  (`Field label="Status"`) already did not match the working tree before this
  change (the filter uses a plain `<label>`), so those failures pre-date DEC-018.

**Affected Components:** `frontend/app/admin/page.tsx`,
`frontend/app/admin/analytics/page.tsx`, `frontend/components/admin/AdminBoard.tsx`,
`frontend/components/admin/AdminAnalytics.tsx`,
`frontend/components/admin/GrievanceReviewModal.tsx`,
`frontend/components/admin/SinglePinMap.tsx`, `frontend/components/admin/AdminNav.tsx`,
`frontend/components/admin/AdminGate.tsx`,
`frontend/components/admin/useAdminGrievanceFeed.ts`,
`frontend/components/admin/departments.ts`, `frontend/components/charts/AdminCharts.tsx`,
`frontend/lib/sla.ts`

---

## DEC-019 — Testing-Phase Seed Accounts (Per-Department Manager + Employee)

**ID:** DEC-019
**Date:** 2026-10-08
**Status:** ACCEPTED

**Context:**
Testing the role-based workflow (manager assigns, employee works, citizen
tracks, superadmin oversees) needs one login per role per department.
Creating 19 accounts by hand per environment is slow and inconsistent, and
the `/login` page only advertised admin + citizen.

**Decision:**
1. `backend/app/seed_test_accounts.py` seeds, idempotently (existing emails
   untouched): `superadmin@grievance.local` (SUPERADMIN) plus
   `<dept>.manager@grievance.local` (ADMIN, `departmentId=<dept>`) and
   `<dept>.employee@grievance.local` (RESOLVER, `departmentId=<dept>`) for
   each of the 8 `CATEGORY_KEYS` departments. Departments themselves are
   created if missing.
2. Gated by `SEED_TEST_ACCOUNTS` (default false; dev/testing only) with
   `SEED_TEST_PASSWORD` override; otherwise documented built-in dev
   passwords (`SuperAdmin@2026!`, `Manager@2026!`, `Resolver@2026!`).
   Existing admin/citizen seeding is unchanged.
3. `frontend/lib/testAccounts.ts` mirrors the matrix; `/login` renders all
   19 accounts with one-click Autofill only when
   `NEXT_PUBLIC_SHOW_DEV_CREDS=true`. The flag and the seed gate must both
   stay off in production.

**Reason:**
- Department taxonomy equals the classifier taxonomy, so assignment,
  scoping and SLA tests exercise real keys instead of fixtures.
- Idempotency ("leave it if already exists") protects owner-created
  accounts with the same emails.
- Dev passwords are published (as the existing admin/citizen ones are) —
  acceptable only because seeding and display are both dev-gated.

**Alternatives Considered:**
- One shared manager/employee pair for all departments: rejected — cannot
  test cross-department isolation (the `roads.employee` vs `water.employee`
  403 case in `tests/test_seed_accounts.py`).
- Seeding unconditionally at startup: rejected — production Atlas would
  gain 17 known-password accounts on boot.
- Storing per-user passwords in the repo: rejected — single shared dev
  passwords via env override, same posture as the existing seeded accounts.

**Consequences:**
- Local testing requires `SEED_TEST_ACCOUNTS=true` in `backend/.env` plus
  `NEXT_PUBLIC_SHOW_DEV_CREDS=true` in `frontend/.env.local`.
- `tests/test_seed_accounts.py` pins the matrix, idempotency, and the
  taxonomy-equals-`CATEGORY_KEYS` invariant.

**Affected Components:** `backend/app/seed_test_accounts.py`,
`backend/app/main.py`, `backend/app/config.py`, `backend/.env.example`,
`tests/test_seed_accounts.py`, `tests/conftest.py`,
`frontend/lib/testAccounts.ts`, `frontend/app/login/page.tsx`,
`frontend/.env.example`, `README.md`

---

## DEC-020 — Migration Close-Out: Plan Docs Retired, Model Files Kept

**ID:** DEC-020
**Date:** 2026-10-08
**Status:** ACCEPTED

**Context:**
`UNIFIED_MIGRATION_PLAN.md` (all phases ✅) and
`memory/ADMIN_UI_RESTRUCTURING_PLAN.md` (all items [x]) served their purpose;
both were superseded by the records that outlived them (git history,
`memory/CHANGELOG.md`, DEC-018). Two loose ends from the plan needed a
verdict before removal: the `backend/grievance_model.py` +
`backend/llm_fallback.py` keep-or-drop question, and the `memory/TODO.md`
vs `memory/NEW_TODO_TASKS.md` filename split.

**Decision:**
1. **Kept** `grievance_model.py` + `llm_fallback.py` — they are live code
   (`services/classification.py:37,62` imports them; `test_fallback.py` and
   `backend/evaluate.py` consume them), so the plan's "recommendation: drop"
   is rejected by reality.
2. Retired `UNIFIED_MIGRATION_PLAN.md` (deleted; history preserved in git),
   slimmed `INTEGRATION.md` to a historical pointer, deleted the stock
   `frontend/README.md` (create-next-app boilerplate, zero references).
3. Deleted `memory/ADMIN_UI_RESTRUCTURING_PLAN.md` — outcome fully recorded
   in DEC-018 and implemented in code.
4. Canonical backlog filename is `memory/TODO.md` (what `AGENTS.md` and
   `memory/README.md` mandate); `NEW_TODO_TASKS.md` moved there verbatim.
5. Left `frontend/AGENTS.md` + `frontend/CLAUDE.md` in place — they are
   regenerated by `next dev` on deletion, so removing them is futile.

**Reason:**
- AGENTS.md: "Do Not Destroy Context" — every removed fact survives in
  git history, CHANGELOG/SESSION_LOG narrative, or a named decision.
- A plan doc whose every checkbox is ✅ is a liability, not context: readers
  mistake it for current instruction.

**Alternatives Considered:**
- Archiving under `docs/archive/`: rejected — a second docs graveyard
  recreates the discovery problem; git history is the archive.

**Consequences:**
- `memory/PROJECT_STATE.md` no longer points at the (already missing)
  `UNIFIED_MIGRATION_CHECKLIST.md`; `docs/WORKFLOWS.md` points at
  `memory/rbac/GRIEVANCE_WORKFLOW.md` as the normative state spec.

**Affected Components:** `UNIFIED_MIGRATION_PLAN.md` (deleted),
`memory/ADMIN_UI_RESTRUCTURING_PLAN.md` (deleted),
`frontend/README.md` (deleted), `INTEGRATION.md` (slimmed),
`memory/TODO.md` (renamed), `frontend/AGENTS.md` (kept, tool-managed)

---

## DEC-021 — Visual Identity: Bright Orange Accent, Black CTAs, Blue Retired

**ID:** DEC-021
**Date:** 2026-10-09
**Status:** ACCEPTED

**Context:**
The frontend used an indigo-blue `primary` palette with a blue-tinted `slate`
`ink` grey scale. The owner asked for a bright-orange accent with some black
buttons and explicitly required that no blue remain in the UI.

**Decision:**
1. `--color-primary-*` in `frontend/app/globals.css` is a bright orange scale
   with `600 = #ff6b00` as the signature accent and `700 = #c24a00` as the
   text-safe orange.
2. `--color-ink-*` is a true neutral (zinc) scale, replacing slate, so no blue
   cast survives in greys. `--foreground` = `#18181b`.
3. The default `Button` variant (`primary`) is **solid black**
   (`bg-ink-950` / hover `bg-ink-800`). Orange drives accents — links, badges,
   active nav, icons, borders, focus rings, progress bars, map pins — and a
   separate `orange` variant (`bg-primary-700`) is available when an
   accent-colored button is wanted.
4. **Contrast rule:** `#ff6b00` is only ~2.9:1 against white in *both*
   directions, so 600 is decorative-only (text-free fills and borders). Any
   orange that meets readable text, or acts as a focus ring / form-control
   indicator, uses 700 (4.9:1). This is why `text-primary-600`,
   `bg-primary-600 text-white`, `ring-primary-*` focus states and
   `accent-primary-*` were all moved to 700.
5. The official Google brand logo colors (`#4285F4`, `#34A853`, `#FBBC05`,
   `#EA4335`) are deliberately retained on the Google sign-in buttons —
   recoloring them violates Google brand guidelines. They are the only blue
   left in `frontend/`.

**Reason:**
- Bright orange is the requested accent; black CTAs give the high-contrast,
  civic/safety-signage pairing the owner asked for.
- Splitting "decorative orange" from "text-safe orange" keeps the accent vivid
  without shipping unreadable text.
- Keeping `blue` renamed to `orange` in `Badge.tsx` (rather than left as an
  alias) prevents the vocabulary from surviving as a lie.

**Alternatives Considered:**
- White text on `#ff6b00` for filled orange buttons: rejected — 2.9:1 fails WCAG AA.
- Black text on pure `#ff6b00` fills: viable (7.4:1) and more "signage" in feel;
  not chosen because white-on-deeper-orange reads as a conventional button.
- Orange primary buttons with black only on secondary/dark variants: rejected —
  owner picked black for main CTAs.
- Keeping the slate `ink` greys: rejected — slate is blue-cast and the brief
  was "no blue color should be left."

**Consequences:**
- New accent-colored buttons must use `variant="orange"` (or 700+ tokens), not
  `bg-primary-600`, whenever they contain text.
- Future chart/map colors should draw from `#ff6b00` + neutrals.
- Historic CHANGELOG/SESSION_LOG entries describing the old blue palette
  remain unedited (per DEC-013 / "Do Not Destroy Context").

**Affected Components:** `frontend/app/globals.css`, `frontend/components/ui/Button.tsx`,
`frontend/components/ui/Badge.tsx`, `frontend/components/ui/{SiteHeader,SiteFooter,StaffSidebar,Field,Feedback}.tsx`,
`frontend/app/{page,track,login}.tsx`, `frontend/components/admin/*`,
`frontend/components/grievance/*`, `frontend/components/home/RequestLifecycle.tsx`,
`frontend/components/resolver/ResolverWorkspace.tsx`

---

## DEC-022 — Department Workforce Operations Workspace

**ID:** DEC-022
**Date:** 2026-10-09
**Status:** ACCEPTED

**Context:** Employee account operations and employee task allocation had been
placed inside the grievance queue and review dialog, mixing workforce
administration with grievance triage.

**Decision:** Department managers manage employee accounts and team workload
through a dedicated `/admin/employees` workspace. They may also assign a
grievance directly to an employee from its review dialog; that dialog offers
employees from their department instead of the department routing selector.
The grievance queue remains focused on department review and triage. API
authorization derives department scope from the authenticated manager; account
deletion is blocked while an employee owns active grievances.

**Reason:** This gives workforce operations one predictable home and prevents
cross-department employee discovery or assignments.

**Consequences:** Account creation/removal and workload overview belong in
`DepartmentEmployeesWorkspace`; per-grievance assignment is also available at
the point of review. Backend scoping remains authoritative.

---

## DEC-023 — Public Reference-ID Tracking Projection

**ID:** DEC-023
**Date:** 2026-10-09
**Status:** ACCEPTED

**Context:** Citizens must be able to check a grievance's progress using its
reference ID without signing in. The tracking page previously fetched detail
and authenticated history as one operation, so a history `401` made an already
found grievance appear not to exist. Public lookup also needs a defined privacy
boundary.

**Decision:** Reference-ID detail lookup is available to anonymous visitors and
non-owner accounts as a limited projection of current status and basic
classification. Account/assignment identifiers, coordinates, images, AI
internals, and internal workflow history are excluded. Public history includes
customer-visible/system updates only. Detail and history requests are
independent, and history failure does not invalidate successful detail lookup.
Reference IDs are case-insensitive at lookup. The full grievance-list endpoint
requires authentication; public tracking is by reference ID, not enumeration.

**Reason:** Public tracking is a core citizen workflow; least-privilege
projection prevents it from becoming a general grievance-data endpoint.

**Consequences:** API documentation and tests preserve the public/private field
boundary and verify progress remains searchable after worker updates.

---

## DEC-024 — Optional Face-Recognition Login (1:1, Feature-Flagged)

**ID:** DEC-024
**Date:** 2026-10-09
**Status:** ACCEPTED

**Context:** The owner requested an optional face-recognition login layer on
top of the existing JWT + RBAC stack (the TODO item deferred at DEC-017 time).
Hard requirements: flag-gated and off by default, no change to the token
contract (`require_role`/RBAC untouched), never mandatory for any role, and
embeddings treated as biometric data (DPDP consent, encrypted at rest,
deletable on request).

**Decision:**
- **1:1 verification only** — email + face against that user's own template;
  never 1:N search.
- `FACE_AUTH_ENABLED=false` default; `/auth/face/*` returns 404 via
  `FaceRouteGuard` (which also enforces HTTPS and a 4 MB body cap) and the
  UI hides every face option; `GET /config` exposes `{faceAuthEnabled}`.
- USER/RESOLVER: face is an alternative sign-in. ADMIN/SUPERADMIN: never
  face-only; an extra step after password/Google only when the account opts
  into `requireLogin2fa` (default off) — **convenience, not a security
  control**, because the face lockout falls back to password-only login and
  `POST /auth/complete-pending` is a lockout escape hatch (403 otherwise).
- Server-side liveness against a single-use 30 s challenge action
  (turn/blink/smile), fail-closed quality gates (one face, bbox minimum,
  blur floor, det score), optional ONNX anti-spoof, generic 401s, per-IP
  (20) / per-email (5) / per-user (5) TTL lockout counters. `MODEL_MISMATCH`
  (template vs `FACE_MODEL_NAME`) forces re-enrollment and never increments
  lockouts; no unauthenticated request can touch the per-user counter.
- Embeddings only (never images), Fernet-encrypted at rest
  (`FACE_EMBED_KEY`), deletable by the owner or revoked by admins/
  superadmins, explicit consent required at enrollment; every lifecycle event
  audited (`face.*`) without embeddings. Liveness/quality thresholds
  env-tunable (`FACE_TURN_MIN_DEGREES`, `FACE_BLINK_EAR_DROP`,
  `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`, `FACE_MIN_FACE_PX`).
- Pending token: JWT `type: "pending_2fa"`, 5 min TTL; never authorizes
  protected routes; Google callback forwards it via `?two_factor=face`.

**Reason:** Biometric convenience without weakening the deterministic auth
path — every failure mode degrades to the existing password/Google flows,
and AI/biometric components never make a final access decision alone.

**Consequences:** `backend/app/services/face_service.py`,
`repositories/face_templates.py`, `routers/face_auth.py` + auth-router
step-up; flag-gated frontend (login tabs, 2FA step, `/profile` enrollment,
superadmin revoke, i18n ×11); optional deps isolated in
`requirements-face.txt`; 106 tests on a synthetic-frame/fake-detection seam.
Known limitations (tracked in `memory/TODO.md`): templates/challenges/
counters are in-memory (reset on restart), `GET /status` does not expose the
current `requireLogin2fa` value, and no physical-webcam validation has been
run yet (thresholds are tunable via env for that purpose).

---

### DEC-024 Amendment — Citizen Passwordless Face Auth & Recovery (2026-10-10)

- **Data Model:** Citizens (`role: USER`) may register with `auth_method: "face_only"`, nullable email and password, normalized 10-digit phone number, and unique server-generated `citizen_id` (`CIT-<8 digits>`). Existing password and Google authentication remain unaffected.
- **Signup:** Two-step flow via `POST /auth/face/signup/start` (mints short-lived 5-minute signup token carrying phone + full name + liveness challenge) and `POST /auth/face/signup/complete` (verifies quality/liveness/identity binding, stores template, and creates citizen account atomically).
- **Login:** `POST /auth/face/login` strictly 1:1 against the citizen's own template loaded via `find_by_identifier` (phone or Citizen ID, with email preserved for backwards compatibility). Restricted strictly to role USER; privileged roles (ADMIN, SUPERADMIN, RESOLVER) and unknown identifiers receive the same generic 401. Standard rate limiting (5 fails/15 min per identifier, 20 fails/15 min per IP); `MODEL_MISMATCH` never counts toward lockouts. Management 2FA step-up stays optional convenience.
- **Recovery:** `POST /auth/face/admin-reset/{user_id}` (restricted to ADMIN/SUPERADMIN, audited) deletes template and returns a single-use 24-hour re-enrollment token for staff to deliver in person. `POST /auth/face/re-enroll` allows the citizen to capture a new template and burns the token on success.
- **Frontend:** Single-field "Mobile number or Citizen ID" on the Face tab without email references; 3-failure municipal office reset prompt; dedicated public `/re-enroll` page; Superadmin UI reset button with one-time token display; profile warning on biometric deletion for face-only citizens.

## DEC-025 — OTP-Proven Indian Phone Binding and Dry-Run Citizen SMS

**ID:** DEC-025
**Date:** 2026-10-10
**Status:** ACCEPTED (prototype scope)

**Context:** TODO §13 found that face login treated an unverified signup phone
as an account identifier. Owner approved implementation with OTP for binding
only, OTP-required unbinding, citizen-only English SMS, no WhatsApp/staff SMS,
and no live provider credentials in scope.

**Decision:** Keep normalized 10-digit storage; `to_e164()` is a provider
boundary helper. Face login by phone requires `phoneVerifiedAt`. OTP is
HMAC-hashed, expires in five minutes, allows three attempts, and is limited by
account, HMAC(phone), and hashed IP. SMS is consent-gated, informational, and
background-dispatched. Only `dry-run` and `off` are supported; dry-run does not
log message bodies or OTPs. An explicit local-only flag may return a demo OTP
to exercise binding. SMS consent remains distinct from biometric consent.

**Reason:** Fix account phone ownership without expanding into external
delivery or changing the administrative authority model.

**Consequences:** Phone routes, profile controls, stage labels, notifications,
and tests are added. Mongo TTL storage exists for OTP challenges; rate counters
and SMS dedup/caps remain process-local. Twilio is deferred pending DLT,
credentials, and carrier validation; the feature remains EXPERIMENTAL until
endpoint and browser workflows are validated.

---

## DEC-026 — Frontend Language Scope: English/Hindi/Marathi Picker, Hidden Packs Kept, Staff English-Only

**ID:** DEC-026
**Date:** 2026-10-11
**Status:** ACCEPTED

**Context:**
The frontend carried 11 locale packs (`frontend/lib/i18n/`) with the picker
offering all of them, but only `en`/`hi`/`mr` are needed. Four packs
(`kn`, `ml`, `pa`, `or`) had fallen 131 keys behind `en.ts` (the uncommitted
homepage-redesign keys), which was a latent `tsc` failure since every pack is
typed `Record<MessageKey, string>`. Staff surfaces were partially translated
with no decision on whether that was required.

**Decision:**
1. The UI picker (`LANGUAGES` in `frontend/lib/i18n/index.tsx`, rendered only
   by the citizen `SiteHeader`) offers exactly `en` / `hi` / `mr`.
2. All 11 packs stay in-tree and in the `translations` registry — nothing is
   deleted. Unhiding a language is one line: re-add its `[code, label]` entry
   to `LANGUAGES`. No completeness threshold or other gating.
3. The 4 stale packs are backfilled with English placeholder values under a
   `TODO i18n` section header (identical to the runtime English fallback, so
   no user-visible change) to keep strict typing green.
4. A saved `localStorage` language code outside the picker set falls back to
   `en` (grandfathered selections are not honored).
5. Staff surfaces (`/admin`, `/resolver`, `/superadmin`, `/notifications` and
   their components) are English-only by decision. Existing `t()` calls there
   are frozen in place — not reverted, not extended — and hardcoded English
   staff strings are not bugs.

**Alternatives Considered:**
- Deleting the 8 hidden packs: rejected by the owner — keep them for a future
  translation pass.
- Relaxing locale typing to `Partial<Messages>`: rejected — the strict type is
  the mechanism that caught this exact staleness; placeholders preserve it.

**Consequences:**
- `TODO.md` §5 frontend-i18n scope is en/hi/mr citizen surfaces; backend
  complaint translation and multilingual AI remain deferred.
- A future agent finishing a hidden language backfills real translations over
  the placeholders and re-adds the one picker line.

**Affected Components:** `frontend/lib/i18n/index.tsx`,
`frontend/lib/i18n/{kn,ml,or,pa}.ts`, `frontend/components/ui/SiteHeader.tsx`
(unchanged — maps over `LANGUAGES`)

---

## DEC-027 — Live Twilio SMS Provider (Code Complete, Credentials Pending)

**ID:** DEC-027
**Date:** 2026-10-11
**Status:** ACCEPTED (implementation; delivery blocked on operator vars)

**Context:**
DEC-025 scoped SMS to `dry-run`/`off` with no live provider code. The owner
has now approved building the full Twilio implementation ahead of receiving
credentials, DLT registration, and a sender setup, and will supply the vars
later.

**Decision:**
1. `SMS_PROVIDER=twilio` delivers stage updates and OTP codes through a
   Twilio Messaging Service (`messages.create` with `messaging_service_sid`,
   `to` in E.164, `body`). The `twilio` client is built lazily so the package
   is only required when live; a seam (`_twilio_client`) keeps it testable.
2. Fail-closed without credentials: empty SID/token/service-SID refuses to
   send (warning, `False`) instead of erroring. Any provider exception is
   caught — dispatch never disrupts a grievance workflow or an OTP request.
3. At-most-once preserved: dedup/rate-cap bookkeeping runs before dispatch,
   so a failed send burns its `(grievanceId, stage)` slot rather than
   retrying into a duplicate.
4. OTP responses stay generic regardless of delivery outcome (no oracle);
   `debug_code` remains dry-run-only. OTP bodies must match the registered
   DLT template verbatim (`render_otp_message`), as must stage bodies.
5. New env contract (all empty by default, secrets never in git):
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_MESSAGING_SERVICE_SID`, `DLT_ENTITY_ID`, `DLT_TEMPLATE_ID_STAGE`,
   `DLT_TEMPLATE_ID_OTP` — mirrored in `backend/.env.example` and
   `render.yaml` (`sync: false`), enforced by the config-drift suite.

**Alternatives Considered:**
- Raw Twilio phone number (`From`) instead of Messaging Service: rejected —
  Indian delivery requires the DLT-registered sender header, which rides the
  Messaging Service (TODO §13 Phase 0 finding).
- Retrying failed sends: rejected — violates the at-most-once dedup rule;
  the OTP challenge survives failure so re-request covers it.

**Consequences:**
- `twilio>=9.0.0` added to `backend/requirements.txt` (verified installable;
   test suite fakes the client, so CI needs no credentials or network).
- SMS remains `dry-run` by default; live delivery is still `CREDENTIALS
  REQUIRED` (DLT registration, approved templates, carrier verification).
- The 160-char cap is now load-bearing for DLT: over-long bodies are skipped
  before dispatch, so the track-link length must be settled before template
  registration.

**Affected Components:** `backend/app/services/sms.py`,
`backend/app/routers/phone.py` (`request-otp` delivery call),
`backend/app/config.py`, `backend/requirements.txt`,
`backend/.env.example`, `render.yaml`, `tests/test_phone_sms.py`,
`docs/DEVELOPMENT.md`

---

## DEC-028 — Reference-ID Search Removed from Citizen Surfaces

**ID:** DEC-028
**Date:** 2026-10-14
**Status:** ACCEPTED (owner-directed)

**Context:**
`/track` offered "My grievances" and "Search by ID" tabs, and the homepage
hero carried a reference-ID tracking panel (`HomeTrackPanel`). The owner
wants ID-based lookup gone for normal users (citizens and signed-out
visitors); staff never used these surfaces (admin/resolver workspaces have
their own queue search).

**Decision:**
1. `/track` is personal-grievances only. The tab switcher, search form,
   results, `?id=` deep-link handling, and the search-tab department totals
   are deleted. Signed-out visitors keep the existing sign-in prompt card —
   tracking is now sign-in-or-nothing.
2. The homepage hero panel is deleted (`HomeTrackPanel.tsx` removed) and the
   hero reflows to a single centered column reusing existing copy/CTAs.
3. Backend untouched: public lookup endpoints and the admin queue search
   remain. Shared lib helpers (`fetchGrievanceById`, `findMockGrievance`,
   `getDepartmentCounts`) stay exported — dead for now, zero runtime cost.
4. Orphaned i18n keys (`searchById`, `trackFind*`, `hp*`, …) stay in all 11
   packs so strict typing stays green; marked with a TODO in `en.ts`. The
   English `trackSubtitle` drops the reference-ID mention; other locales
   keep stale wording pending the native-reader pass (TODO §5).

**Consequences:**
- SMS "Track:" links land on a sign-in-gated personal list. Accepted by the
  owner; SMS link handling unchanged.

**Affected Components:** `frontend/app/track/page.tsx`,
`frontend/app/page.tsx`, `frontend/components/home/HomeTrackPanel.tsx`
(deleted), `frontend/lib/i18n/en.ts` (subtitle + TODO note)

---

## DEC-029 — Citizen Tracking Is a Master-Detail Dashboard, No Department Totals

**ID:** DEC-029
**Date:** 2026-10-14
**Status:** SUPERSEDED BY DEC-030 (2026-10-14) — the owner rejected the UI
rework ("keep it as it was"). The master-detail layout and
`GrievanceDetailPanel` extraction were reverted the same day; only the
intent (user-scoped numbers, no global registry view) survived, and it was
already satisfied by the restored code. Retained as the record of the
reverted direction.

**Context:**
After DEC-028 removed reference-ID search, `/track` showed personal
grievance cards (details hidden behind a modal) plus a per-department totals
grid. The owner wants no department breakdown on the tracking page and the
user's grievance details visible directly on the dashboard.

**Decision:**
1. Delete the personal department-totals grid from `/track` (counting logic
   and its now-unused imports go with it).
2. `/track` becomes master-detail: selectable grievance list (left) with an
   inline full-detail panel (right, sticky on desktop, auto-selects the
   first grievance). The detail body is extracted from
   `GrievanceDetailModal` into `GrievanceDetailPanel` (timeline, description,
   metadata, map, photo, history, AI triage); the modal becomes a thin
   overlay wrapper so `/submit`'s `MyGrievances` behavior is unchanged.
   Panel remounts per grievance via `key` (same pattern as
   `GrievanceReviewModal`), which also satisfies the
   `react-hooks/set-state-in-effect` lint rule.
3. `myByDeptTitle/Text` join the DEC-028 orphan-keys note; backend untouched.

**Affected Components:** `frontend/app/track/page.tsx`,
`frontend/components/grievance/GrievanceDetailPanel.tsx` (new),
`frontend/components/grievance/GrievanceDetailModal.tsx` (wrapper),
`frontend/lib/i18n/en.ts` (TODO note)

---

## DEC-030 — Citizens Do Not See Department or Priority (Display-Layer Hide)

**ID:** DEC-030
**Date:** 2026-10-14
**Status:** ACCEPTED (owner-directed; supersedes the reverted DEC-029)

**Context:**
Citizen grievance views (tracking list/popup, submit-page history) showed
internal routing: department chips, priority badges, and an "Assigned
Department" row. The owner wants those hidden from normal users. The shared
`GrievanceCard` is also rendered by the staff review modal, so the hide
cannot be unconditional.

**Decision:**
1. Opt-in `citizenView` prop on `GrievanceCard`, `GrievanceDetailModal`, and
   `AnalysisPanel` (default off = current behavior). Citizen call sites
   (`/track`, `MyGrievances`) pass it; the staff review modal and the
   submit-form AI preview do not.
2. Citizen mode hides: priority badges, department chips, and the full
   "Assigned Department" metadata row. Status, title, ID, dates, timeline,
   history, and AI explanation/keywords stay. Assignee display unchanged
   (out of the stated scope).
3. Display-layer only: the API still ships the fields (citizen projection
   unchanged). Restricting the projection is a separate, larger change.
4. Verified finding, no code needed: `/track` counts already derive from the
   signed-in user's own grievances in live mode (`listGrievances({userId})`,
   server-scoped); only mock/demo mode shows sample data, by design.

**Affected Components:** `frontend/components/grievance/GrievanceCard.tsx`,
`frontend/components/grievance/GrievanceDetailModal.tsx`,
`frontend/components/grievance/MyGrievances.tsx`,
`frontend/app/track/page.tsx`

---

## DEC-031 — First-Time Signup Hardening: Profile Fields, Self-Hosted Captcha, Proven Phone for Face-Only

**ID:** DEC-031
**Date:** 2026-10-14
**Status:** ACCEPTED (owner-directed; uncommitted workdir state)

**Context:**
Password signup collected only name/email/password, face-only signup
claimed a phone without proving it (the DEC-025 gap), and no signup path
had bot friction — while each face-signup OTP costs real SMS money once
live. Google OAuth signup is out of scope (Google already CAPTCHAs; profile
backfill is a follow-up).

**Decision:**
1. Both signup paths collect address (10–500 chars), DOB (ISO date, age
   13–120), occupation (2–100 chars), gender (female/male/other/
   prefer_not_to_say), validated identically in
   `backend/app/profile_fields.py` and stored on the user doc + profile.
2. Self-hosted text captcha (5-char SVG, hashed server-side in the OTP
   store, 5-min TTL, single-use, 3-strike burn, never logged): required on
   `POST /auth/register` and face `signup/start`, minted via public
   `GET /auth/captcha` (per-IP capped). Prototype-grade friction, documented
   as weaker than reCAPTCHA; chosen to avoid a new vendor.
3. Face-only signup proves the phone inline: public
   `signup/request-otp` + `signup/verify-otp` bound to the signup token
   (the authed `/phone/*` routes are unusable pre-account); `signup/complete`
   requires the OTP proof marker (burned on success) and stamps
   `phoneVerifiedAt`/`otp_sms` at creation — so these accounts pass the
   DEC-025 face-login gate immediately.
4. Tests stay hermetic via deterministic secrets in a shared
   `tests/_signup_helpers.py` (tightly scoped save/restore — a broad
   `secrets` patch corrupts face-challenge selection on the same module
   object). `conftest.py` pins dry-run SMS without debug codes.
5. i18n: 20 new keys, real copy in en/hi/mr, English placeholders in the
   other 8 (native review already open under TODO §5).

**Consequences:**
- Full suite: 376 passed / 23 failed — the 23 are byte-identical to the
  TODO §11 baseline (verified programmatically); +13 new tests green.
- Citizen `hi`/`mr` for the new keys landed unreviewed, like the rest.

**Affected Components:** `backend/app/profile_fields.py` (new),
`backend/app/services/captcha.py` (new), `backend/app/auth.py`
(signup-token profile claim), `backend/app/routers/{auth,face_auth}.py`,
`tests/_signup_helpers.py` (new), `tests/test_{signup_fields_captcha,auth,
face_signup,face_login_recovery,rbac_workflow,security_baseline,
seed_accounts,face_auth}.py`, `frontend/{app/register,app/signup/face,
components/ui/Captcha.tsx,lib/{api,session,types},lib/i18n/*.ts}`



## DEC-032 — Voice-assisted complaints: WAV-only Sarvam backend (2026-10-13)

**Status:** ACCEPTED — owner authorized Stage 4B backend/mock implementation.
**Decision:** Authenticated POST /transcribe, direct httpx to Sarvam saaras:v4
with mode=transcribe and en-IN/hi-IN/mr-IN. Classic mono 16-bit 16 kHz PCM WAV,
30 seconds, 1 MiB file/2 MiB body caps. Disabled by default. No database writes,
classification changes or frontend implementation.

**Reason:** WAV frame validation is deterministic and avoids a new compressed
audio decoder. Separate router/services fit the existing FastAPI architecture.
Thread-lock reservations enforce process-local quotas and concurrency before
paid attempts. Same-key results replay briefly; failed/expired attempt tombstones
prevent silent retry after uncertain billing. No automatic provider retries.

**Consequences:** Browser must produce genuine WAV; compressed formats require
separate decoder/deployment work. Limits reset on restart and multiply across
workers; use one worker/instance, not a claimed durable monetary ceiling.
Root runtime manifest now declares httpx/multipart plus auth/SMS dependencies
already present in backend/requirements.txt. Provider retention must be configured
separately before live citizen audio. Recognition is unvalidated; no live calls.

**Session handoff:** memory/SESSION_LOG.md is intentionally untouched under the
owner's explicit preservation instruction (SHA256 recorded during verification).
Implementation/verification handoff lives in PROJECT_STATE, CHANGELOG and TODO.
See docs/VOICE_ASSISTED_COMPLAINT.md. No changes to real backend/.env.

## DEC-033 — AudioWorklet voice drafting frontend (2026-10-13)

**Status:** ACCEPTED — owner authorized Stage 5 frontend implementation/mocks.
**Decision:** AudioWorklet captures PCM after an explicit click/permission. Average
input channels to mono, cap source frames to 30 seconds, resample via a bounded
32-tap Hann-windowed sinc low-pass filter to 16 kHz, encode classic little-endian
16-bit PCM WAV (maximum 480000 frames/960044 bytes). No MediaRecorder container
renaming, recording library or deprecated ScriptProcessor fallback.

**Reason:** Fits the Stage 4B strict WAV contract without changing backend behavior.
Audio-thread frame caps complement delayed main-thread timers. Pure conversion
is testable with synthetic audio and actual Python validation, without credits.

**Integration:** VoiceRecorder below the description; native accessible confirmation
before upload for existing text, again if the description differs after response.
React Hook Form setValue updates validation/dirty/touched flags. Normal submission
remounts/cancels voice to protect resets. Multipart request uses the existing JWT
and 401 refresh conventions, same idempotency key/body on that retry, 70-second
client deadline and no other automatic retries. Cancelled refresh does not log out.

**Testing:** Reuse Node's test runner and installed TypeScript compiler. Add jsdom
26.1.0 as dev-only DOM environment for actual React/Form tests; no new application
framework. en/hi/mr voice translations are centralized; eight retained hidden packs
spread the English fallback to preserve exhaustive MessageKey typing (DEC-026).

**Limitations:** Modern HTTPS/localhost browser APIs required; 8–96 kHz source
rates supported. Real browser/device support, quality, pronunciation/recognition
and native Hindi/Marathi copy review remain pending. Main-thread resampling can
briefly block slower devices. Hardware teardown awaits main-thread callbacks if
it is suspended, while worklet-retained audio remains capped. Backend stays OFF.
No real Sarvam calls, real recordings, schema/auth backend changes or commits.
SESSION_LOG.md remains untouched per the owner's explicit preservation instruction.

## DEC-034 — Local extractive voice title suggestions (2026-10-13)

**Status:** ACCEPTED — owner authorized Stage 8 frontend-only implementation.
**Decision:** Pure TypeScript helper selects an original-language phrase after
transcript acceptance. Normalize whitespace; skip finite en/hi/mr greetings and
filler; recognize sentence punctuation/decimals; cap 12 words/80 graphemes without
splitting words. Abstain on unusable input, missing Intl.Segmenter or long clauses
with recognized negation. No backend endpoint, model, translation or paid request.

**Integration:** Preserve complete description. Read current title at response
completion; fill only if empty, including protection for in-flight title edits.
Existing/earlier generated titles require explicit suggested-title action and
confirmation. Hide/recheck suggestion against accepted description after edits.
Use React Hook Form setValue validation/dirty/touched flags and useWatch for
candidate visibility. Submission payload and department/priority pipeline remain
unchanged. No draft persistence; reset suggestion on successful submission.

**Limitations:** Extractive heuristics cannot guarantee semantic importance or
complete context; multilingual greeting/negation lists are finite. Native-reader
review and mocked browser accessibility checks remain pending. No live calls.

## DEC-035 — Stage 9 explicit description append/replace choices (2026-10-14)

**Status:** ACCEPTED — newly authorized Stage 9 enhancement, not a recovered
original 11-stage roadmap definition.
**Decision:** Native HTML dialog offers Append/Replace/Cancel before uploading
nonempty descriptions and after in-flight edits. Async prepare/accept callbacks
carry the recorder AbortSignal and epoch checks. Cancel/Escape before upload costs
zero requests; after response preserves fields without another upload. Recheck
latest text after every asynchronous choice. Discard/unmount resolves choices as
cancel. Native modal provides focus containment; Cancel initially focused.
**Append:** Preserve existing text verbatim; insert two newlines only if no trailing
whitespace, then full transcript. No translation/deduplication/semantic merging.
**Compatibility:** Empty-description behavior unchanged. Stage 8 manual/current
and pending-edited title protection retained; candidate tied to resulting combined
text. React Hook Form validation/dirty/touched flags remain. No backend/API/STT
configuration/submission changes. Native dialog browser accessibility verification
pending; mock-tested only. Existing single live English test remains historical.

**Stage 9 validation follow-up (2026-10-14):** Hydrated Chrome/Edge found StrictMode
cleanup cancelled choices during effect replay; use generation-guarded deferred
cleanup for real unmount only. Explicit Tab/Shift+Tab boundary wrapping and focus
return required. Return to opener when enabled; otherwise editable Description
while upload disables Transcribe. Navigation must not focus detached old controls.
Three focused regressions and hydrated browser checks pass; no API/backend change.

**Stage 9 title-quality follow-up (2026-10-14):** Remove only finite anchored
reporting/existence introductions in en/hi/mr. Preserve remaining issue wording,
location/ownership, negation/quantities and Unicode decimals. Supersedes the initial
prefix-clipping behavior for long nonnegated clauses: return null if a complete
phrase exceeds 12 words/80 graphemes rather than risk losing important details.
Descriptions and existing/manual-title safeguards unchanged. Representative
street-light fixture is not the unsaved live transcript; no live evaluation added.

### 2026-10-14 ? Stage 10 diagnostic initialization guard

Use a default-false initialization-only guard across MongoDB repositories, including SLA default seeding and OTP constructor indexes. Preserve endpoint behavior and authorization. Keep lifespan off and verified TLS for controlled diagnostic starts; launcher asserts MongoUsersRepository identity and read-only connectivity before serving. This is not a read-only API mode.

### 2026-10-14 ? Stage 11 final voice handoff

Stage 11 handoff separates implementation completeness from operational/production readiness. Historical mock/browser/live evidence remains distinct; no live Hindi/Marathi or resolved-login claim. Document corrected proposed TLS options by omitting tlsInsecure while retaining verified TLS and hostname checks; no launcher execution/code change is authorized by documentation work. Diagnostic guard defaults false and preserves normal initialization; it is not an endpoint read-only control.

## DEC-036 — Homepage Entrance Animation: Reveal-Only, No Splash (2026-10-18)

**Context:** the public homepage rendered instantly with no transition; the
owner asked for a simple load animation where everything appears smoothly.

**Decision (owner-confirmed via plan-mode questions):**
- **Reveal-only, no splash screen.** No loader overlay and no artificial
  delay — content animates as it paints and as sections enter the viewport.
- **Scope: public homepage only** (`/` for anonymous/citizen visitors). The
  staff overview returned to ADMIN/RESOLVER/SUPERADMIN at the same route is
  intentionally unchanged.
- **Hero:** deterministic CSS `fade-up` keyframe (`--animate-fade-up`, 0.6 s,
  `fill-mode: both`) with fixed `[animation-delay:…]` steps of 80 ms
  (badge → title → subtitle → CTAs → trust row).
- **Sections:** one-shot scroll reveal via `components/ui/Reveal.tsx`
  (IntersectionObserver, `threshold 0.15`, `rootMargin 0 0 -8% 0`) driven by
  `data-reveal="pending|visible"` styles in `globals.css`. The observer
  disconnects after the first reveal; sections skipped by an instant jump
  reveal when they actually enter the viewport.
- **Accessibility/safety:** `prefers-reduced-motion: reduce` disables only the
  new animations/transitions (existing spinners/pulses untouched);
  `@media (scripting: none)` forces the revealed state so content cannot be
  stuck hidden without JS; browsers without IntersectionObserver reveal via a
  requestAnimationFrame callback.
- **Replay:** "every time" is satisfied by natural remount — navigating back
  to `/` resets all five reveals to pending and replays the hero stagger.

**Alternatives rejected:** branded splash/loading overlay (repetitive on
every visit, artificial delay); `app/loading.tsx` (static page — rarely
triggers and could double-flash); per-card stagger wrappers (layout risk for
equal-height grid cards; section-level reveal chosen instead).

**Verification (2026-10-18):** `tsc` clean, ESLint at the documented baseline,
`next build` green (18 routes); headless Chrome 153 CDP checks — computed hero
animation (`fade-up`, 0.08 s, 0.6 s, both), 5 reveals progress 1→5 on scroll
and settle at opacity 1, client-side nav away/back resets to 5 pending
(replays), reduced-motion emulation shows content immediately (animation
`none`, transition `0s`), zero console errors, no horizontal overflow.
Firefox/Safari and physical devices remain unverified.

## DEC-037 — Memory System: Rolling Logs + Single CURRENT_STATE.md (2026-10-18)

**Context:** the mandated per-session reads had grown heavy — `SESSION_LOG.md`
~2,889 lines and `CHANGELOG.md` ~2,058 lines (~74k tokens combined) — and
"what exists" vs "what remains" was split across two mandatory files
(`PROJECT_STATE.md` + `TODO.md`). The owner asked to archive the old context
and keep one current-state memory doc that also carries the remaining work.

**Decision:**
- `memory/CURRENT_STATE.md` is the single current-state entry point:
  snapshot + all remaining implement/test work. It supersedes
  `PROJECT_STATE.md` + `TODO.md`, which are archived unchanged at
  `memory/archive/PROJECT_STATE-until-2026-10-18.md` and
  `memory/archive/TODO-until-2026-10-18.md`.
- `SESSION_LOG.md` and `CHANGELOG.md` are rolling files: keep roughly the last
  two weeks (minimum ~10 entries). When appending and the active file exceeds
  ~400 lines, move the oldest entries **unchanged** to
  `memory/archive/<FILE>-<first>_to_<last>.md` with a pointer line at the top.
  Entries are never edited or deleted — rotation only relocates them.
  Initial rotation (2026-10-18) archived everything before 2026-10-14:
  `SESSION_LOG-2026-08-06_to_2026-10-13.md` (94 entries) and
  `CHANGELOG-2026-08-06_to_2026-10-13.md` (90 entries).
- Log entries stay lean: what changed / verified / unverified / pointers to
  DEC or CURRENT_STATE items. Process ceremony belongs in neither file.
- `DECISIONS.md` remains append-only and complete; read it by grep/topic, not
  as a full read every session.
- `AGENTS.md` and `memory/README.md` memory protocol updated accordingly.

**Rationale:** mandated per-session reading drops substantially, while full
history stays in-repo (greppable, git-tracked); the handoff standard is
preserved via CURRENT_STATE + logs + decisions.

**Alternatives rejected:** deleting old logs (violates "do not destroy
context"); compressing entries in place (rewrites history); keeping the
PROJECT_STATE/TODO split (owner asked for a single current doc).

## DEC-038 — Conversational Voice Intake: Two Modes, Stateless LLM Extraction (2026-10-18)

**Context:** the owner asked for a complete voice-assisted submission: the
original "Voice transcription is unavailable or disabled" error traced to a
configuration-only cause (local `TRANSCRIPTION_ENABLED` false), and beyond the
fix the feature should guide the citizen conversationally — listen, transcribe,
understand, ask focused follow-ups, merge into the draft, review, confirm —
while keeping the classic form. No new grievance schema, no new STT provider,
no autonomous AI actions (HITL: AI prepares, the human submits).

**Decision:**
- New stateless backend endpoint `POST /grievance-intake/extract` (JWT
  required): utterances + language + optional draft snapshot + asked questions
  → strict-JSON `{title, description, location_text, category, priority,
  question}`. No DB writes, no grievance, no idempotency cache; submission
  stays on `POST /submit-grievance` whose classifier cascade remains
  authoritative. Deep validation in the service (uniform 400s); Groq with the
  verified model fallback list; deterministic post-validation; `503`
  unconfigured (`Complaint understanding is not configured`), `504` timeout,
  `502` other provider failures; no automatic retry.
- Frontend: pure state machine in `frontend/lib/voice/intake.ts`
  (`idle|listening|transcribing|processing|awaiting_answer|ready_for_review|error`)
  with transition guards; `useVoiceIntake` owned by `SubmitForm` so the
  conversation survives mode switches; both modes share the one RHF draft.
- Merge policy: AI fills only empty/unlocked fields; citizen-typed content is
  locked (`dirtyFields` + AI-fill tracking via
  `setValue(..., { shouldDirty: false })`); AI-owned fields may be refreshed.
  AI-filled fields carry an "AI suggestion" badge that disappears when edited.
- Question policy: ≤ 1 question per missing kind (usable description ≥ 20
  chars; explicit location; at most ONE optional AI clarification), one at a
  time, all skippable. Voice-derived place names only seed the existing
  LocationCapture search — never auto-pin, GPS never used by the conversation.
- Default mode stays "manual" with the voice card rendered first in orange:
  keeps the existing classic flow and its ~40 voice-UI tests valid while voice
  is one click away.
- STT enablement doctrine unchanged and local-only: `TRANSCRIPTION_ENABLED=true`
  in the gitignored `backend/.env` only; repo/production defaults stay false.
  Intake extraction needs only the existing Groq configuration.
- Incident date/duration have no schema field → folded into description text
  (documented limitation).

**Rationale:** stateless extraction keeps the AI advisory and reversible, adds
no schema or privacy surface, and makes every voice failure local to the
conversation — the manual branch and final submission are never blocked by a
voice/STT/LLM outage.

**Alternatives rejected:** server-side conversation sessions (schema +
privacy cost); auto-pinning GPS from voice (wrong-place risk, no explicit
consent); letting the conversation set the authoritative category/priority
(classification stays in the submit pipeline); defaulting to voice mode
(needless churn for existing flows/tests).

**Verification (2026-10-18):** `tests/test_voice_intake.py` 21 passed; full
pytest 503 passed / 31 skipped / 23 failed = the documented pre-existing
baseline. Frontend: `tsc` clean; ESLint at the documented baseline; `next
build` green; `npm run test:voice` 132 passed (19 new: 13 logic+API, 6 UI
flow). Live E2E on the owner's stack (headless Chromium): login → toggle →
free fake-mic start/cancel smoke (zero `/transcribe` calls) → typed
conversation with real Groq extraction (3 extract calls) → review (AI title +
240-char description, seeded location search, category/priority hints) →
citizen edit removed one AI badge → coordinate pin → real submission, ticket
`GRV-2026-0015`; zero console errors. Live spoken Sarvam path not re-run
(credit/retention checks not performed); historical single live English smoke
remains the live STT evidence.

---

## DEC-039 — Spoken Question Templates + Optional Photo Step (2026-10-19)

**Context:** Stage 12's conversational intake was silent — the citizen had to
read every follow-up question, which defeats the voice-assisted premise for
low-literacy users. The owner asked for the questions to be spoken in the
selected language, with automatic playback, a persistent mute, and a replay
control, plus an optional photo opportunity before final submission. Runtime
TTS per question would add recurring cost, latency and a hard dependency on
Sarvam availability; the owner chose fixed template questions so audio can be
generated once.

**Decision:**
- The extraction contract changes from free-text `question` to
  `question_kind` ∈ {details, location, when, frequency, affected, danger,
  landmark, clarify} | null, whitelisted/alias-normalized server-side.
  `asked_questions` carries the kinds already asked (last 3), never wording;
  repeated kinds are dropped server-side and client-side.
- Wording comes from the existing i18n templates (`lib/i18n/voice.ts`) in
  en/hi/mr. The model only decides *which* fact is missing, preserving the
  Stage 12 deterministic policy: `details`/`location` remain required rules;
  the model's kind fills at most one optional question per conversation.
- 24 pre-recorded WAV clips (8 kinds × 3 languages, Sarvam `bulbul:v3`,
  16 kHz mono) are committed under `frontend/public/voice/questions/`.
  `frontend/scripts/generate-question-audio.mjs` is a manual one-off generator
  (skips existing files, `--force` to redo). No backend TTS endpoint, no
  runtime TTS call, no new flag/quota/cache, no recurring provider cost.
- `lib/voice/speech.ts` owns playback: static URL mapping, localStorage mute
  preference, a shared `AudioContext` unlocked from an earlier real tap
  (start/send/retry/replay), decoded-buffer caching, correct supersede/cancel
  outcomes, and an `<audio>` fallback if the context stays suspended.
- Every new question auto-plays once (keyed to the question message id);
  mute stops playback and persists; replay is explicit and works while muted;
  changing the spoken language re-renders and re-speaks an open question;
  leaving the question stops audio.
- The voice review branch gains an optional photo section **before** submit,
  after location: it auto-appears and scrolls into view, supports
  "Choose photo" or "Skip photo" (reopenable), disables skip/submit while an
  upload is in flight, and includes `imageUrl` in the existing single
  `POST /submit-grievance`. The manual branch is unchanged; no post-submit
  image-attach endpoint is added.
- HITL unchanged: review fields stay editable with "AI suggestion" badges and
  the citizen explicitly submits.

**Rationale:** template questions make spoken guidance free at runtime,
deterministic, testable and resilient to provider outages, while keeping the
LLM's role advisory (choose the missing fact). Static assets also avoid the
browser autoplay problems of a post-LLM network TTS call: the clip is local and
plays through an already-unlocked context.

**Alternatives rejected:** runtime TTS per question (recurring cost, latency,
provider dependency); browser `SpeechSynthesis` (inconsistent Indic voice
quality across devices); letting the LLM keep writing free text and caching it
(unbounded cache and no pre-generated assets); a backend TTS proxy (new
surface and quota handling for no prototype benefit); attaching images after
submission (extra endpoint and a second write).

**Verification (2026-10-19):** `tests/test_voice_intake.py` 26 passed;
`npm run test:voice` 148 passed (new `scripts/voice-speech.test.mjs` 11 tests:
24-asset completeness, mute persistence, playback/cache/supersede/cancel/
fallback/dispose; updated intake + UI suites for kinds, spoken-language wording
and language switching, auto-play, mute/replay, photo skip/attach); `tsc --noEmit` clean; `next build` green; ESLint at the
documented baseline (4 pre-existing FaceCapture errors + 4 warnings). Live
verification on the real stack (headless Playwright Chromium, real Groq): typed
conversation → location question auto-played from
`/voice/questions/location.en-IN.wav` with a running AudioContext (clock
advanced ~3 s) → language switched to Hindi (the open question re-rendered and
auto-played) and "Play again" replayed `location.hi-IN.wav` → review → photo
step in view → skipped → no submission; zero console errors. No new
grievance/ticket was created.

---

## DEC-040 — Bound Intake Provider Latency (2026-10-19)

**Context:** `POST /grievance-intake/extract` sits on the conversational
critical path: the next question cannot be shown until it returns. It tries the
configured Groq model plus two fallbacks, and the Groq SDK retries transient
failures twice by default. With a 25 s per-attempt timeout, a stalled or
rate-limited provider could occupy the request for several minutes while the
browser aborted at 45 s; the abandoned requests kept retrying server-side.

**Decision:** treat provider latency as a bounded resource. Disable the SDK's
automatic retries for intake (`with_options(max_retries=0)`), cap each model
attempt at 10 s, and share a 25 s total budget across the cascade; return `504`
when the budget is exhausted. The frontend's 45 s timeout is unchanged. Log the
winning model plus elapsed time, and a warning per failed attempt.

**Alternatives rejected:** keeping the SDK retries (multiplies the worst case);
raising the browser timeout (longer waits and more pile-up); racing all models
in parallel (extra provider cost for a rare failure); dropping the LLM and
asking a deterministic question immediately (loses the advisory extraction and
changes the established intake contract).

**Verification (2026-10-19):** `tests/test_voice_intake.py` 28 passed (new:
SDK retries disabled; cascade stops at the total budget); live extraction
1.1–1.5 s; typed Send→question 1.26 s; spoken Stop→question 1.92 s. Full pytest
**510 passed / 31 skipped / 23 failed** (documented DEC-006 baseline unchanged,
+2 new tests); frontend voice suite **148 passed**.

**Reversible:** the timeout constants and `max_retries` setting live only in
`grievance_intake.py`; reverting the commit restores the previous behavior.

---

## DEC-041 — Manual and Voice Modes Are Single-Purpose (2026-10-19)

**Context:** `/submit` had two overlapping text-entry surfaces. The "Fill the
form manually" branch still carried the Stage 1–9 single-shot recorder
(`VoiceRecorder` + `TranscriptionChoice` + local title suggestion) even though
the conversational intake (DEC-038/039) now owns voice assistance. The voice
review also rendered editable title/description inputs, duplicating the manual
form inside the voice flow.

**Decision:** separate the modes by input method and keep one shared draft.

- The manual branch is plain text entry only: title, description, optional
  photo, location, submit. The legacy recorder, its append/replace/cancel
  confirmation dialog, title suggestion and their i18n/test assets are retired.
- The voice branch shapes the text only through the conversation (spoken or
  "Type instead"). Its review renders the captured title/description as
  read-only text, keeps the "AI suggestion" badges and hidden form payload
  inputs, and retains the photo step, location capture and explicit submit.
  Corrections go through "Switch to manual form", which edits the same
  react-hook-form draft and then submits normally.
- The cross-stack E2E is rebuilt around the intake (real UI → real `/transcribe`
  → mocked Sarvam → canned extraction) and made opt-in (`VOICE_E2E=1`) because
  its in-process uvicorn + Node/jsdom harness is too heavy for the default
  suite and constrained dev machines.

**Alternatives rejected:** keeping the mic in the manual form (two voice
surfaces, duplicate consent/recording UX); a fully read-only voice review with
no edit path (citizens could not correct AI wording); removing the manual form
(typing remains a required accessible fallback); keeping the deleted recorder
tests (they assert a UI that no longer exists).

**HITL:** unchanged and explicit — AI text is labelled, the citizen reviews it,
and submission remains a human action. The manual form is the correction
surface, so AI text never becomes an uneditable final decision.

**Verification (2026-10-19):** `npx tsc --noEmit` clean; ESLint clean on touched
files; `next build` green; `npm run test:voice` **71 passed** (the legacy recorder
UI suite was removed and the 8 capture-lifecycle tests were ported to
`voice-capture.test.mjs`; intake/speech/audio/API coverage retained); full
pytest **511 passed / 32 skipped / 23 failed** (documented DEC-006 baseline;
the opt-in E2E is the extra skip). Live post-consolidation browser check not
run.

**Reversible:** the removed components are recoverable from git history; the
review fields can be made editable again in `SubmitForm.tsx` without backend
changes.

---

## DEC-042 — Bound Submit-Path Groq Latency (2026-10-19)

**Context:** `POST /submit-grievance` runs up to four Groq calls inline while
the citizen waits: category classification, priority classification,
refinement, and image validation when a photo is attached. None had an explicit
timeout, and the Groq SDK retries twice by default, so a stalled or
rate-limited provider could occupy a submit for minutes — the same failure
mode DEC-040 fixed for intake.

**Decision:** treat submit-path provider calls as a bounded resource.

- `classification.py` owns a single bounded helper (`_groq_complete`):
  `client.with_options(max_retries=0)`, an 8 s per-call timeout, and a 20 s
  shared budget per classification pass via `classification_budget()`
  (context variable; the router wraps category → priority → refinement).
  Budget exhaustion or a provider failure returns `None`, so the cascade falls
  through to HuggingFace/keywords instead of hanging.
- `image.py` bounds multimodal validation the same way (8 s, no SDK retries);
  its existing heuristic fallback remains the failure path.
- Timeouts are deliberately small because these calls only enrich the stored
  analysis; the grievance must still be accepted quickly.

**Alternatives rejected:** the intake's 10 s/25 s per-call shape (three
sequential calls would allow ~75 s); racing models in parallel (extra provider
cost for a rare outage); moving classification to a background job (changes the
submit API contract and the frontend's immediate analysis panel).

**Verification (2026-10-19):** `tests/test_classification_cascade.py` and
`tests/test_classification.py` pass, including new tests that assert
`max_retries=0`, the per-call `timeout` kwarg, and that a spent budget skips the
Groq call; full pytest **511 passed / 32 skipped / 23 failed** (baseline only).
Live submit latency after the change not re-measured.

**Reversible:** constants and the budget helper live in `classification.py`
(`GROQ_CALL_TIMEOUT_SECONDS`, `GROQ_TOTAL_BUDGET_SECONDS`) and `image.py`
(`IMAGE_LLM_TIMEOUT_SECONDS`).

---

## DEC-043 — Spoken Opening Prompt for Conversational Intake (2026-10-20)

**Context:** On `/submit`, clicking "Start speaking" in voice mode began recording silently ("Listening — 0 / 30 seconds") and expected the citizen to speak unprompted. The assistant's first question only auto-played after the citizen's first utterance was transcribed and extracted. Low-literacy or first-time citizens expected the voice assistant to speak first, greet them, and ask what the problem is. If they waited silently, nothing was ever spoken.

**Decision:**
- Add an audible opening prompt (`intakeIntro`) played on the first "Start speaking" tap before microphone capture begins.
- Synthesize dedicated 16 kHz mono WAV clips (`intro.en-IN.wav`, `intro.hi-IN.wav`, `intro.mr-IN.wav`) using Sarvam `bulbul:v3` and commit them under `frontend/public/voice/questions/` (3 clips, ~410 kB total).
- The opener kind (`intro`) remains client-only and is excluded from `INTAKE_QUESTION_KINDS` so the backend planner/extractor never plans or confuses it with diagnostic follow-up questions.
- Autoplay compliance: `getPlayer().unlock()` is invoked synchronously within the "Start speaking" click gesture.
- Sequence:
  - If muted: skips audio playback, appends the localized opener prompt to the transcript log as the first assistant message, and immediately begins recording.
  - If not muted: sets `phase: "prompting"`, appends the opener message to the transcript log, and plays the clip (`await getPlayer().play(introUrl)`).
  - Playback finish (`"played"` or `"failed"`/timeout): transitions `phase` to `"listening"` (`dispatch({ type: "START" })`) and starts `VoiceCapture`. The mic never records while the intro plays, preventing echo contamination in STT.
  - User cancellation (`intake.actions.cancelRecording()` / `reset()`): stops playback and resets to `"idle"`.
- Follow-ups ("Answer by voice") do not replay the opener (`state.messages.length > 0`).

**Alternatives rejected:**
- Browser `speechSynthesis`: inconsistent Indic voice quality across OS/browsers; contradicts the static clip architecture of DEC-039.
- Reusing `details.<lang>.wav`: phrasing ("Could you describe the problem in a little more detail?") is confusing as a first opening greeting.
- Triggering on mode toggle ("Tell us your problem"): autoplay policy blocks audio without an explicit gesture directly targeted at audio/interaction.
- Backend runtime TTS: recurring provider cost, latency, and reliability dependency.

**Verification (2026-10-20):**
- Generated 3 intro clips via `scripts/generate-question-audio.mjs`.
- `scripts/voice-speech.test.mjs` (12 tests) asserts WAV completeness and URL mapping.
- `scripts/voice-intake.test.mjs` (15 tests) asserts reducer `PROMPT_STARTED` and cancel transitions.
- `scripts/voice-intake-ui.test.mjs` (15 tests) asserts opener plays on first Start before capture, appears in the transcript log, muted skips audio, playback failure falls through to recording, and follow-up does not replay opener.
- `npm run test:voice` passes 77 tests (0 failures).
- `npx tsc --noEmit` and ESLint on touched files clean. Backend `pytest tests/test_voice_intake.py` 28 passed.

**Reversible:** Remove `PROMPT_STARTED` dispatch in `start()` to restore silent recording.

---

## DEC-044 — Citizen Surfaces Never Show AI Classification or Confidence (2026-10-20)

**Context:** After registering a grievance, the citizen saw the AI triage panel on the success card: the classified department/category, priority, "AI is X% sure", explanation and keywords. The same panel leaked on the citizen track-detail modal (`citizenView` hid only the badges, not the confidence/explanation/keywords), the voice intake summary showed "Suggested category" and "Suggested priority", the submit notification said "Your complaint was classified under {category}", and the image upload printed its validation score. Owner direction: users must not see the classified department or the confidence score in any section.

**Decision:**
- Remove the AI triage panel from the citizen success card (`SubmitForm.tsx`); the view shows only the reference ID and confirmation.
- Render the "Automated Triage Diagnostic" in `GrievanceDetailModal.tsx` only for staff (`!citizenView`); the whole panel is hidden, not just the badges.
- Make `AnalysisPanel` staff-only and delete the `aiSure` confidence pill; no surface renders the confidence percentage anywhere (the owner had already hidden it in the staff review modal).
- Drop "Suggested category"/"Suggested priority" rows from the voice intake summary (`VoiceIntake.tsx`); the running summary shows only citizen-provided issue/location.
- Neutralize form-level copy that promised visible classification: `formSubtitle`, `submitPageDesc` (en/hi/mr), `intakeClassificationNote`.
- Stop printing the image validation score; the upload reports plain accepted/rejected copy (`imgAcceptedScore` key removed).
- Replace the submit notification message with "Your complaint has been registered and is awaiting review." (no category/department).
- Keep: the "AI suggestion" badges on voice-filled fields (they flag AI origin for HITL, not classification results); the human-confirmation assignment notification naming the department; the generic homepage AI copy; `hfEngine`/`categoryConfidence` in API responses, zod schemas and types (UI-only change).
- Hidden locale packs drop the removed keys (`aiSure`, `imgAcceptedScore`); changed copy is updated in the three live languages en/hi/mr, hidden packs keep their existing values for keys they still define (not selectable, DEC-026).

**Alternatives rejected:**
- Passing `citizenView + hideConfidence` to the panel: the explanation and keywords still reveal the predicted category; the existing partial hiding already proved leaky.
- Keeping confidence for staff/resolvers: contradicts the earlier owner directive and now has no visible use.
- Stripping `hfEngine` from API responses: citizens and staff share the serialization; role-dependent shaping is a larger contract risk, and the requirement is about what the UI shows.

**Verification (2026-10-20):**
- `npm run test:voice` **79 passed** — added assertions that the intake summary shows no category/priority/confidence, the success card never renders "AI Suggestion" / "AI is X% sure", and the citizen detail modal shows no triage panel while the staff modal still shows it without the confidence pill.
- New backend test `test_submit_notification_hides_the_classification` passes. `tests/conftest.py` now also swaps `notif_repository` on the grievances router: the submit path bound the import-time store while the notifications endpoint read the fresh one, so endpoint reads previously missed submit-created notifications.
- `npx tsc --noEmit`, ESLint on touched files, `next build` clean. `tests/test_endpoints.py`: 37 passed / 9 failed — the documented DEC-006 status-vocabulary baseline.
- Not verified: live browser pass (still pending together with the Stage 14/15 pass).

**Reversible:** Restore the panel render in `SubmitForm.tsx` / `GrievanceDetailModal.tsx` and the confidence block in `AnalysisPanel`; classification data is still stored on `hfEngine`.

---

## DEC-045 — Brand Redesign to SAMARTH, De-AI Copy, and Vibrant Primary Orange Palette (2026-10-20)

**Context:** The portal brand name was updated from prototype working title "GrievAI" to the official civic project identity: **`SAMARTH` — System for Accessible Management, Action, Resolution and Tracking of Hearings**. In addition, the UI contained generic AI buzzwords ("AI-assisted civic grievance portal", "AI + Officer", "AI System", "AI inference", "BrainCircuit" icons) which detracted from the authentic civic and departmental authority. Finally, the primary orange palette used `#c24a00` as the button background (`Button.tsx`), which rendered as a dull, muddy dark rust/brown instead of an energetic, bright civic orange.

**Decision:**
- **Rebranding:**
  - Application title and branding updated across `SiteHeader.tsx`, `SiteFooter.tsx`, `StaffSidebar.tsx`, `layout.tsx`, and all i18n language packs (`en.ts`, `hi.ts`, `mr.ts`, and 8 hidden locale packs).
  - Logo initial updated from `G` to `S`.
  - Brand expansion subtitle: "System for Accessible Management, Action, Resolution and Tracking of Hearings" (or concise header variant "System for Accessible Management, Action, Resolution & Tracking of Hearings").
  - Support contact email updated in footer to `support@samarth.gov.in` (replacing `support@grievai.example`).
  - Internal testing contracts and tokens (e.g. `ADMIN@GrievAI.TEST` in `check-contract.mjs`, localStorage keys like `grievai-voice-muted`) remain untouched for backward compatibility.
- **De-AI Copy & Civic Tone:**
  - Replaced generic AI claims across homepage and administrative surfaces:
    - `heroBadge`: "AI-Assisted Civic Grievance Portal" → "SAMARTH — National Grievance Portal".
    - `heroTrustHuman`: "Human-in-the-loop decisions" → "Accountable officer decisions".
    - `homeStep2Text` / `principle2Text`: "AI-assisted triage" → "Structured triage" / "Automated triage".
    - `ovActorAiOfficer` / `lcActorAi`: "AI + Officer" / "AI System" → "System + Officer" / "Triage System".
    - `trustBadge` / `trustTitle` / `trust1Title`: "Accountability & Technology" → "Accountability & Oversight", "Structured triage with accountable human decisions", "Automated Categorization".
    - Admin queue subtitle & review modal: replaced "see the AI's suggestion" and "AI recommends;" with "verify suggested routing" and "System recommends; the authorized officer decides".
    - Section 6 trust icon: replaced `BrainCircuit` with `Layers` from `lucide-react`.
    - Preserved field-level "AI suggestion" badge on draft inputs to maintain transparency on machine-extracted form values.
- **Brighter Orange Accent Palette:**
  - Refined `--color-primary-*` scale in `frontend/app/globals.css`:
    - `--color-primary-500: #ff6f00;`
    - `--color-primary-600: #ff5500;` (vivid, electric civic orange)
    - `--color-primary-700: #e04800;` (rich saturated deep orange with high contrast, replacing muddy `#c24a00`)
  - Updated `Button.tsx` `orange` variant: `bg-primary-600 hover:bg-primary-500 active:bg-primary-700 focus-visible:ring-primary-500` so orange action buttons pop brightly.
  - Updated logo badges in header, footer, and sidebar to `bg-primary-600`.

**Alternatives rejected:**
- Keeping the "AI" emphasis in the civic header and badges: contradicts government portal expectations where municipal accountability takes precedence over technical implementation details.
- Retaining `bg-primary-700` (`#c24a00`) for buttons: dark brownish appearance failed to read as orange.

**Verification (2026-10-20):**
- `npx tsc --noEmit` in `frontend/`: passes with 0 errors.
- `npm run test:voice`: all 79 tests pass.
- `node scripts/check-contract.mjs`: passes all contract assertions.
- `npx eslint`: 0 errors, 0 warnings across all modified components, pages, and i18n files.

**Reversible:** Revert the CSS palette hex codes and restore previous string constants in i18n dictionaries.
