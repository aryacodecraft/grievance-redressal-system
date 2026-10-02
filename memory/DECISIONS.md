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
