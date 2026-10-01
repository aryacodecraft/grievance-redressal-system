# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-10-01 (Phases 4–6 committed `09e83af..98ec1f3` on
> `feature/unified-system`; legacy Firebase UI deleted, docs aligned, pytest
> suite added — **migration plan Phases 1–6 complete**)

---

## Current Phase

**Migration plan Phases 1–6: COMPLETE** ⬤ (2026-10-01)
- Phase 1 + 1.5 frontend de-Firebase + parity — `1857ee3..0b438b8`
- Phase 2 FastAPI rewrite — `e55a9a3..d1c9c6d`
- Phase 3 MongoDB persistence + Firebase config/Flask retirement — `c44d410..aae4b74`
- Phase 4 legacy UI retirement — `09e83af`
- Phase 5 docs/config alignment — `cfdb7d1`, `4e52990`, `4686f81`
- Phase 6 pytest suite + end-to-end verification — `f6e2890`, `98ec1f3`

(see `UNIFIED_MIGRATION_CHECKLIST.md` for the per-item record)

Per DEC-010/DEC-011: `backend/app/` (FastAPI, `uvicorn backend.app.main:app`)
is the serving path; persistence is `MongoRepository` when `MONGODB_URI` is
set, otherwise the in-memory fallback, both behind the `GrievanceRepository`
protocol. `backend/server.py`, `functions/`, `adfbh`, `firebase.json`,
`.firebaserc`, `firestore.rules` and `firestore.indexes.json` are **deleted**.

**Remaining backlog** is no longer migration work: MongoDB Atlas setup (owner),
Firebase key rotation, real auth, resolver/analytics UI, AI evaluation.
See `INTEGRATION.md` at repo root for the source map.

---

## Current Architecture

```
backend/app/   — FastAPI service (grievances/images/health routers,          IMPLEMENTED (serving path, DEC-010;
                 classification/image services, MongoRepository +             Mongo behind GrievanceRepository,
                 in-memory fallback, /health reports storage mode)            DEC-011)
tools/         — recategorize.py (batch re-classification over MongoDB;       IMPLEMENTED (imports shared
                 imports shared classifier, supports --dry-run)                classifier)
tests/         — pytest suite (classifier, endpoints, repository;             IMPLEMENTED (DEC-012; 85 tests,
                 Mongo tests skip when no DB is reachable)                     68 without a DB)
frontend/      — Next.js 16 (TS, Tailwind v4): REST client, demo auth,       IMPLEMENTED (Firebase removed; live mode
                 admin map/clusters/filters, citizen my-grievances)            works against backend/app)
docs/          — Technical documentation; ARCHITECTURE/API/SECURITY/          IMPLEMENTED (aligned to the real
                 DEVELOPMENT annotated with implemented-vs-planned             stack, DEC-013)
memory/        — AI agent persistent memory                                  IMPLEMENTED
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
  `models.py`, `db.py` (`GrievanceRepository` protocol — `MongoRepository` when
  `MONGODB_URI` set, in-memory fallback otherwise; `/health` reports `storage`),
  `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py`
  (ported verbatim from the old `server.py`; `CATEGORY_KEYS` = frontend `CATEGORIES`) — **IMPLEMENTED**
- Verified: in-process `TestClient` smoke test — health, `POST /submit-grievance`
  (200; AI refinement degrades to keywords without keys), `GET /grievances`
  (+`?userId=` scoping), `GET /grievances/{id}`, `PATCH /grievances/{id}/status`, 404s
- `backend/server.py` — **DELETED** (Phase 3): the legacy Flask + Firestore
  server was retired after its classifier/image logic was ported to `backend/app/`
- `tools/recategorize.py` — batch re-run of classifiers over **MongoDB** (imports
  the shared classifier; `--dry-run` supported) — **IMPLEMENTED**
- ~~`functions/tfidf.js`~~ — **DELETED** (Phase 4); its TS port
  `frontend/lib/tfidf.ts` is the live implementation
- Historic note: the `Idea Lab` FastAPI scaffold was deliberately NOT copied at
  unification (DEC-008) — `backend/app/` is a **fresh** Phase 2 implementation,
  not that scaffold; SQLAlchemy/Alembic/Postgres-era PLANNED items remain SUPERSEDED

### Database
- **MongoDB** via `MongoRepository` (`backend/app/db.py`) — **IMPLEMENTED
  (Phase 3, DEC-011)**; selected by `MONGODB_URI`/`MONGODB_DB` (see
  `backend/.env.example`), indexes (`uniq_grievance_id`, `user_created`
  `userId+createdAt` compound) created at startup, `createdAt` stored as BSON date
- **In-memory fallback** (`InMemoryRepository`, same protocol) — **IMPLEMENTED**;
  used when `MONGODB_URI` is unset so the API boots without a database
  (non-persistent by design; `/health` reports `storage: in-memory`)
- ~~Firestore / `firebase-admin`~~ — **DELETED** (Phase 3); `backend/server.py`,
  `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` gone
- ~~Alembic / PostgreSQL / SQLAlchemy~~ — never copied; SUPERSEDED
- `docs/DATABASE.md` — **rewritten for MongoDB** (Postgres entities moved to a roadmap section)

### Authentication
- **Frontend:** demo localStorage session + `lib/roles.ts` allowlist —
  **IMPLEMENTED (temporary)**; Firebase Auth client removed 2026-09-11
- ~~Backend/legacy: Firebase Auth client-side in `functions/admin_api.js`~~ —
  **DELETED** (Phase 4; the `firestore.rules` allowlist went in Phase 3)
- **Backend: no authentication at all** — the API trusts `userId` from the
  request body and authorises nothing; documented as the highest-risk gap in
  `docs/SECURITY.md` with the JWT/RBAC mitigation path
- JWT + Google OAuth + RBAC — **PLANNED** (target design kept in
  `docs/ARCHITECTURE.md` / `docs/SECURITY.md`; DEC-007 role structure stands)

### AI Modules
- Working classifiers in `backend/app/services/classification.py` (ported from
  `backend/server.py`) + `frontend/lib/tfidf.ts` —
  **IMPLEMENTED** (map to AI-02/AI-04/AI-05/AI-06; evaluation status: EXPERIMENTAL
  per DEC-005 — no metrics claimed)
- ~~AI stub files~~ — not copied; SUPERSEDED

### Analytics
- Admin board in `frontend/components/admin/` (queue, filters, map, clusters,
  stats) — **IMPLEMENTED**; standalone analytics views and AI-11 PLANNED
- ~~Legacy admin HTML (`functions/admin.html`, `functions/admin_ui.js`, root `adfbh`)~~ —
  **DELETED** (Phase 4); superseded by the Next.js admin board

### Testing
- `tests/` (4 files, 85 tests) + `pytest.ini` + `requirements-dev.txt` —
  **IMPLEMENTED (Phase 6, DEC-012)**: classifier unit tests incl. the
  `CATEGORY_KEYS` ↔ `CATEGORIES` contract, endpoint tests over `TestClient`,
  both repository implementations + selection logic. Mongo tests skip unless
  `TEST_MONGODB_URI` is reachable — `pytest` is green with **85 passed** (with a
  DB) or **68 passed / 17 skipped** (without)
- `frontend/scripts/e2e.mjs` — **IMPLEMENTED (Phase 6)**: imports the real
  `lib/api.ts` so responses are zod-validated by the schemas the UI uses
- Verified end-to-end (Phase 6): live `uvicorn` on `:10000` — submit/list/get/
  PATCH/404/400, persistence across a process restart, and the in-memory
  fallback when `MONGODB_URI` is unset; the e2e script covers submit → track →
  admin assign/resolve; all 6 frontend routes serve 200; `tsc --noEmit` +
  `npm run build` clean. *(DOM not driven — no desktop browser connected)*
- Frontend tests (Jest + React Testing Library), state-machine tests and the
  AI evaluation protocol — **PLANNED**

---

## Partially Implemented

*(None — scaffolding is complete but no business logic yet)*

---

## Planned

> PHASE 2–4 below assumed the FastAPI/Postgres stack — SUPERSEDED by DEC-008
> and then by DEC-010/DEC-011 (FastAPI + MongoDB now *is* the stack; DEC-002 is
> marked superseded). Retained for reference.
- **PHASE 2 (SUPERSEDED):** ~~PostgreSQL schema, Alembic migrations, SQLAlchemy models~~
- **PHASE 3 (SUPERSEDED):** ~~JWT + Google OAuth + RBAC (FastAPI)~~ — Firebase Auth is the temporary reality
- **PHASE 4 (SUPERSEDED):** ~~Grievance CRUD + lifecycle state machine (original FastAPI plan)~~ — `/submit-grievance` (FastAPI `backend/app`) is the working path (the old Flask path was deleted in Phase 3)
- **PHASE 5**: User / Resolver / Admin UI in Next.js — PARTIALLY IMPLEMENTED (submit + my-grievances, track, login/register demo auth, admin board with assignment/filters/map/clusters; resolver workflow and analytics views OPEN; backend wiring DONE in Phase 2)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/app/services/classification.py` (ported from the deleted `backend/server.py`; EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `frontend/lib/tfidf.ts` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — backend suite **IMPLEMENTED** (Phase 6,
  85 tests); AI evaluation protocol and frontend tests PLANNED

**Unification follow-ups (this branch's backlog):**
1. ~~Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`~~ — **DONE 2026-10-01** (Phase 5; auth stack itself still open)
2. ~~Firebase-removal branch (see INTEGRATION.md §3)~~ — **DONE** (Phase 4 removed `functions/` + `adfbh`; only the key in git history remains)
3. ~~Wire Next.js frontend to backend~~ — **DONE** (`lib/api.ts` ↔ `backend/app`, both on `:10000`; smoke-tested 2026-09-11)
4. Hygiene — ~~`.gitignore`/`__pycache__`/UTF-16 requirements~~ DONE (all three verified; `backend/requirements.txt` rewritten as ASCII in Phase 3); ~~decide `adfbh`~~ DONE (deleted Phase 4); remaining: **rotate the hardcoded Firebase key**
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

- `frontend/AGENTS.md` and `frontend/CLAUDE.md` were auto-generated by `create-next-app@16.3.0`.
  Review their content if Next.js AI tooling conflicts with project conventions.
- ~~`AGENTS.md` tech-stack table (FastAPI/PostgreSQL)~~ — **RESOLVED 2026-10-01**
  (Phase 5: Backend annotated `backend/app/`, Database → MongoDB per DEC-011,
  DEC-002 marked SUPERSEDED, Auth row marked *planned*).
- ~~`.gitignore` binary / UTF-16 `requirements.txt` / committed `__pycache__`~~ —
  all FIXED (verified 2026-09-11: `.gitignore` is UTF-8 text with `__pycache__`
  ignored, 0 tracked pyc files, `backend/requirements.txt` is ASCII).
- ~~`adfbh` — unidentified duplicate admin HTML~~ **DELETED** (Phase 4).
- Hardcoded Firebase Web API key (was in `functions/admin_api.js`, file deleted
  in Phase 4) — **still exposed in git history; rotation is mandatory**, and
  deleting the file did not remove it. Open.
- The API performs **no server-side authentication**: it trusts `userId` from
  the request body, and list/PATCH have no authorization; the frontend
  allowlist is client-side only. Documented in `docs/SECURITY.md` — must be
  closed before any deployment handling real data.
- In-memory fallback repository is non-persistent by design — only used when
  `MONGODB_URI` is unset; `/health` reports which storage is active.

---

## Current Blockers

- **MongoDB Atlas setup is the user's call** — nothing persists until a real
  `MONGODB_URI` is set in `backend/.env` (in-memory fallback is the default).
- Auth stack still undecided (DEC-010/DEC-011 cover backend + persistence
  direction; demo/localStorage auth in the frontend remains temporary).
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
- Backend ↔ Database (current): `MongoRepository` (pymongo) when `MONGODB_URI`
  is set, in-memory fallback otherwise — both behind `GrievanceRepository`
  (`backend/app/db.py`); `MONGODB_DB` default `grievance`.
- Backend ↔ AI: in-process calls in `backend/app/services/classification.py`
  (HF zero-shot → Groq → keyword fallback; ported from `backend/server.py`).
- Backend ↔ LLM APIs: `GROQ_API_KEY` / `GROQ_MODEL`, `HF_API_TOKEN` env vars.
- Batch re-classification: `tools/recategorize.py` (MongoDB; imports the shared classifier from `backend/app/services/classification.py`).
- Similarity (current): client-side `frontend/lib/tfidf.ts` (port of `functions/tfidf.js`).

---

## Immediate Next Steps

1. Owner: create MongoDB Atlas cluster + set `MONGODB_URI` in `backend/.env`
   (the only thing standing between the app and persistent storage; `render.yaml`
   also has `MONGODB_URI`/`MONGODB_DB` placeholders to fill for deployment).
2. Rotate the hardcoded Firebase Web API key — still in git history.
3. Real auth: implement the JWT/RBAC design in `docs/SECURITY.md` and make the
   server derive `userId` from the verified token (closes the documented
   highest-risk gap).
4. Review + merge `feature/unified-system` → `app/intialise` → `main` (`--no-ff`)
   — all work so far is **local and unpushed**.
5. Beyond the migration plan: resolver dashboard + analytics views (Phase 5 UI),
   AI evaluation protocol (Phase 12), frontend tests (Jest + RTL).

See `memory/TODO.md` for the full prioritized task backlog.
