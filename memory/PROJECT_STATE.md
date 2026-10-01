# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-09-11 (Phase 2 FastAPI rewrite committed `e55a9a3..d1c9c6d`
> on `feature/unified-system` — `backend/app/` is now the serving path;
> DEC-010 supersedes DEC-008 items 1, 3, 4)

---

## Current Phase

**Phase 2: FastAPI rewrite** ⬤ Complete (committed `e55a9a3..d1c9c6d`;
see `UNIFIED_MIGRATION_CHECKLIST.md`)
*(preceded by Phase 1 + 1.5 — frontend de-Firebase + legacy parity,
`1857ee3..0b438b8`)*

Per DEC-010 (supersedes DEC-008 items 1, 3, 4): `backend/app/` (FastAPI,
`uvicorn backend.app.main:app`) is the serving path; `backend/server.py`
(Flask + Firestore) remains as legacy reference; persistence is an in-process
repository behind the `GrievanceRepository` protocol pending Phase 3 (MongoDB).
Next: Phase 3 — MongoDB swap, then Phase 4 — remove remaining Firebase code.
See `INTEGRATION.md` at repo root for the source map.

---

## Current Architecture

```
backend/app/   — FastAPI service (grievances/images/health routers,            IMPLEMENTED (serving path, DEC-010;
                 classification/image services, in-process repo)                 Phase 3 → MongoDB)
backend/       — Flask `server.py` + ML (legacy reference, superseded)        IMPLEMENTED (legacy, DEC-010)
tools/         — recategorize.py (batch re-classification over Firestore)      IMPLEMENTED (legacy)
functions/     — TF-IDF similarity + admin UI (HTML/JS, Firebase client)      IMPLEMENTED (legacy reference)
frontend/      — Next.js 16 (TS, Tailwind v4): REST client, demo auth,        IMPLEMENTED (Firebase removed; live
                 admin map/clusters/filters, citizen my-grievances)              mode works against backend/app)
docs/          — Technical documentation (partially stale, see DEC-008)       IMPLEMENTED (reference only)
memory/        — AI agent persistent memory                                   IMPLEMENTED
firebase.* / firestore.* / .firebaserc — Firestore (legacy path only;        IMPLEMENTED (kept until Phase 4;
                 out of the serving path)                                       removal pending)
```

---

## Implemented

### Documentation
- `README.md`, `PRD.md`, `AGENTS.md`
- `docs/ARCHITECTURE.md`, `DATABASE.md`, `AI_SYSTEM.md`, `WORKFLOWS.md`
- `docs/API.md`, `SECURITY.md`, `DEVELOPMENT.md`, `PROJECT_CONTEXT.md`
- All `memory/` files

### Frontend (`frontend/`) — Phase 1 + 1.5 complete (2026-09-11)
- Next.js 16 + TypeScript + Tailwind CSS v4 + ESLint — **IMPLEMENTED**
- App Router routes: `/`, `/submit`, `/track`, `/admin`, `/login`, `/register` (9 build outputs)
- Packages: `axios`, `recharts`, `react-hook-form`, `zod`, `@tanstack/react-query`,
  `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`, `leaflet` (+`@types/leaflet`);
  **`firebase` and `next-auth` removed**
- `lib/session.tsx` — demo localStorage provider (`user`, `liveMode`, `signInDemo`, `signOut`); real auth DEFERRED
- `lib/roles.ts` — admin allowlist + role resolution (source of truth until real auth)
- `lib/grievances.ts` — REST polling (15s) replacing Firestore `onSnapshot`
- `lib/api.ts` — typed client: `submitGrievance`, `listGrievances`, `getGrievance`,
  `updateGrievanceStatus`, image + health helpers
- `lib/tfidf.ts` + `components/admin/AdminMap.tsx` / `AdminClusters.tsx` — legacy parity
- `components/admin/AdminBoard.tsx` — filters, search, pagination, map, clusters, stats, live assign/resolve
- `components/grievance/MyGrievances.tsx` — citizen's own submissions on `/submit`
- **`lib/firebase.ts` deleted** — frontend has no Firebase dependency
- TypeScript check: **passes with no errors**; `npm run build` passes (9 routes)
- **Live mode works** against `backend/app` (Phase 2) — `GET/PATCH /grievances*`
  implemented and smoke-tested (see Backend)

### Backend (`backend/`)
- `backend/app/` — **FastAPI serving path (DEC-010)**: `main.py` (app, CORS,
  `400 {"error": …}` validation handler), `config.py` (python-dotenv),
  `models.py`, `db.py` (`GrievanceRepository` protocol + in-process impl),
  `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py`
  (ported verbatim from `server.py`; `CATEGORY_KEYS` = frontend `CATEGORIES`) — **IMPLEMENTED**
- Verified: in-process `TestClient` smoke test — health, `POST /submit-grievance`
  (200; AI refinement degrades to keywords without keys), `GET /grievances`
  (+`?userId=` scoping), `GET /grievances/{id}`, `PATCH /grievances/{id}/status`, 404s
- `backend/server.py` — Flask + Firestore original (classifiers, `/submit-grievance`,
  image routes) — **IMPLEMENTED (legacy reference, superseded by DEC-010)**
- `tools/recategorize.py` — batch re-run of classifiers over Firestore — **IMPLEMENTED (legacy)**
- `functions/tfidf.js` — client-side TF-IDF + greedy clustering — **IMPLEMENTED (legacy; ported to `frontend/lib/tfidf.ts`)**
- Historic note: the `Idea Lab` FastAPI scaffold was deliberately NOT copied at
  unification (DEC-008) — `backend/app/` is a **fresh** Phase 2 implementation,
  not that scaffold; SQLAlchemy/Alembic/Postgres-era PLANNED items remain SUPERSEDED

### Database
- **In-process repository** behind `GrievanceRepository` protocol
  (`backend/app/db.py`) — **IMPLEMENTED (Phase 2; volatile, single-process)**;
  Phase 3 swaps in MongoDB with no router changes
- Firestore via `firebase-admin` (`backend/server.py`, `tools/`) —
  **IMPLEMENTED (legacy path only, out of serving path; removal = Phase 4)**
- ~~Alembic configured~~ — not copied; SUPERSEDED
- `docs/DATABASE.md` schema design is reference-only until rewritten for MongoDB

### Authentication
- **Frontend:** demo localStorage session + `lib/roles.ts` allowlist —
  **IMPLEMENTED (temporary)**; Firebase Auth client removed 2026-09-11
- **Backend/legacy:** Firebase Auth client-side (`functions/admin_api.js`) +
  admin email whitelist (`aryaadmin@gmail.com`, also in `firestore.rules`) —
  **IMPLEMENTED (temporary)**
- ~~JWT + RBAC (PHASE 3)~~ — SUPERSEDED pending canonical-stack decision

### AI Modules
- Working classifiers in `backend/app/services/classification.py` (ported from
  `backend/server.py`) + `frontend/lib/tfidf.ts` —
  **IMPLEMENTED** (map to AI-02/AI-04/AI-05/AI-06; evaluation status: EXPERIMENTAL
  per DEC-005 — no metrics claimed)
- ~~AI stub files~~ — not copied; SUPERSEDED

### Analytics
- Admin HTML dashboards (`functions/admin.html`, root `adfbh`) — **IMPLEMENTED (legacy UI)**

### Testing
- No test suite in this repo — **PLANNED**

---

## Partially Implemented

*(None — scaffolding is complete but no business logic yet)*

---

## Planned

> PHASE 2–4 below assumed the FastAPI/Postgres stack — SUPERSEDED by DEC-008
> pending the canonical-stack decision. Retained for reference.
- **PHASE 2 (SUPERSEDED):** ~~PostgreSQL schema, Alembic migrations, SQLAlchemy models~~
- **PHASE 3 (SUPERSEDED):** ~~JWT + Google OAuth + RBAC (FastAPI)~~ — Firebase Auth is the temporary reality
- **PHASE 4 (SUPERSEDED):** ~~Grievance CRUD + lifecycle state machine (FastAPI)~~ — `/submit-grievance` (Flask + Firestore) is the working path
- **PHASE 5**: User / Resolver / Admin UI in Next.js — PARTIALLY IMPLEMENTED (submit + my-grievances, track, login/register demo auth, admin board with assignment/filters/map/clusters; resolver workflow and analytics views OPEN; backend wiring DONE in Phase 2)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/app/services/classification.py` (ported from `backend/server.py`; EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `frontend/lib/tfidf.ts` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — PLANNED (no suite yet)

**Unification follow-ups (this branch's backlog):**
1. Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`
2. ~~Firebase-removal branch (see INTEGRATION.md §3)~~ — **frontend DONE, serving path DONE** (`backend/app/` is Firebase-free, `render.yaml` drops `FIREBASE_SERVICE_ACCOUNT`); legacy `backend/server.py`/`tools/`/`functions/` + root `firebase.*` still pending (Phase 4)
3. ~~Wire Next.js frontend to backend~~ — **DONE** (`lib/api.ts` ↔ `backend/app`, both on `:10000`; smoke-tested 2026-09-11)
4. Fix `.gitignore` (binary), untrack `__pycache__/`, convert `backend/requirements.txt` to UTF-8, decide `adfbh`, rotate hardcoded Firebase key
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

- `frontend/AGENTS.md` and `frontend/CLAUDE.md` were auto-generated by `create-next-app@16.3.0`.
  Review their content if Next.js AI tooling conflicts with project conventions.
- `AGENTS.md` tech-stack table (FastAPI/PostgreSQL) — FastAPI now matches DEC-010,
  but the database row (PostgreSQL) contradicts the MongoDB plan — needs owner confirmation.
- `.gitignore` reads as binary, `backend/requirements.txt` is UTF-16, `__pycache__/` is
  committed (and new `backend/app/**/__pycache__` is left untracked), `adfbh` is an
  unidentified duplicate admin HTML — all queued as follow-ups (see INTEGRATION.md).
- Hardcoded Firebase Web API key in `functions/admin_api.js` — must be rotated (legacy path).
- In-process grievance repository is volatile (data lost on restart) and
  single-process — accepted for Phase 2, replaced in Phase 3 (MongoDB).

---

## Current Blockers

- Auth stack still undecided (DEC-010 covers backend + persistence direction;
  demo/localStorage auth in the frontend remains temporary).
- LLM provider: Groq + HuggingFace in use (`GROQ_API_KEY`, `HF_API_TOKEN`,
  now read by `backend/app/config.py`); OQ-001 in PRD.md effectively answered —
  confirm and close.

---

## Important Integration Points

- Frontend (Next.js) ↔ Backend: REST/JSON — contract defined by
  `frontend/lib/api.ts` and implemented by `backend/app/routers/*`
  (`/submit-grievance`, `/grievances{,/{id}{,/status}}`, `/validate-image`,
  `/sign-cloudinary`, `/delete-cloudinary`, `/health`); FastAPI on `:10000`
  matches `frontend/.env.example` (smoke-tested 2026-09-11).
- Backend ↔ Database (current): in-process repository behind
  `GrievanceRepository` (`backend/app/db.py`) — Phase 3 → MongoDB.
- Backend ↔ AI: in-process calls in `backend/app/services/classification.py`
  (HF zero-shot → Groq → keyword fallback; ported from `backend/server.py`).
- Backend ↔ LLM APIs: `GROQ_API_KEY` / `GROQ_MODEL`, `HF_API_TOKEN` env vars.
- Batch re-classification: `tools/recategorize.py` (legacy; imports from `backend.server`).
- Similarity (current): client-side `frontend/lib/tfidf.ts` (port of `functions/tfidf.js`).

---

## Immediate Next Steps

1. Phase 3: MongoDB persistence — add `pymongo`/`motor`, `MONGODB_URI`/`MONGODB_DB`,
   swap `InMemoryRepository` for Mongo behind `GrievanceRepository` in `backend/app/db.py`.
2. Phase 4: remove remaining Firebase/Firestore code (`backend/server.py`,
   `tools/`, `functions/`, root `firebase.*`) once parity is signed off.
3. Owner decision: auth stack (demo auth is temporary) + confirm MongoDB over
   PostgreSQL; then update `AGENTS.md` stack table + `docs/ARCHITECTURE.md`.
4. Hygiene: `.gitignore`, `__pycache__/` (incl. new untracked `backend/app/**/__pycache__`),
   UTF-16 requirements, `adfbh`, key rotation.
5. Review + merge `feature/unified-system` → `main` (`--no-ff`) when ready.

See `memory/TODO.md` for the full prioritized task backlog.
