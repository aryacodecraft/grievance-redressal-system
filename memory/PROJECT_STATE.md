# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-09-11 (Phase 3 MongoDB committed `c44d410..aae4b74` on
> `feature/unified-system`; Firebase config files and `backend/server.py`
> deleted — DEC-011 supersedes DEC-008 item 4)

---

## Current Phase

**Phase 3: MongoDB persistence + Firebase config retirement** ⬤ Complete
(committed `c44d410..aae4b74`; see `UNIFIED_MIGRATION_CHECKLIST.md`)
*(preceded by Phase 2 FastAPI rewrite `e55a9a3..d1c9c6d`, Phase 1 + 1.5
frontend de-Firebase + parity `1857ee3..0b438b8`)*

Per DEC-010/DEC-011: `backend/app/` (FastAPI, `uvicorn backend.app.main:app`)
is the serving path; persistence is `MongoRepository` when `MONGODB_URI` is
set, otherwise the in-memory fallback, both behind the `GrievanceRepository`
protocol. `backend/server.py`, `firebase.json`, `.firebaserc`,
`firestore.rules` and `firestore.indexes.json` are **deleted**.
Next: Phase 4 (retire `functions/` + `adfbh`, rotate leaked key), Phase 5
(docs/config/memory alignment), Phase 6 (pytest + repo-wide verification).
See `INTEGRATION.md` at repo root for the source map.

---

## Current Architecture

```
backend/app/   — FastAPI service (grievances/images/health routers,          IMPLEMENTED (serving path, DEC-010;
                 classification/image services, MongoRepository +             Mongo behind GrievanceRepository,
                 in-memory fallback, /health reports storage mode)            DEC-011)
tools/         — recategorize.py (batch re-classification over MongoDB;       IMPLEMENTED (imports shared
                 imports shared classifier, supports --dry-run)                classifier)
functions/     — TF-IDF similarity + admin UI (HTML/JS, Firebase client)     IMPLEMENTED (legacy; Phase 4 retirement pending)
frontend/      — Next.js 16 (TS, Tailwind v4): REST client, demo auth,       IMPLEMENTED (Firebase removed; live mode
                 admin map/clusters/filters, citizen my-grievances)            works against backend/app)
docs/          — Technical documentation (DATABASE rewritten for Mongo;       IMPLEMENTED (others pending
                 others pending Phase 5 alignment)                            Phase 5 alignment)
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
- `functions/tfidf.js` — client-side TF-IDF + greedy clustering — **IMPLEMENTED (legacy; ported to `frontend/lib/tfidf.ts`)**
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
- **Backend/legacy:** Firebase Auth client-side in `functions/admin_api.js`
  (admin email whitelist; the allowlist `firestore.rules` file was DELETED in
  Phase 3) — **IMPLEMENTED (legacy only; `functions/` retires in Phase 4)**
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
- **PHASE 4 (SUPERSEDED):** ~~Grievance CRUD + lifecycle state machine (original FastAPI plan)~~ — `/submit-grievance` (FastAPI `backend/app`) is the working path (the old Flask path was deleted in Phase 3)
- **PHASE 5**: User / Resolver / Admin UI in Next.js — PARTIALLY IMPLEMENTED (submit + my-grievances, track, login/register demo auth, admin board with assignment/filters/map/clusters; resolver workflow and analytics views OPEN; backend wiring DONE in Phase 2)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/app/services/classification.py` (ported from the deleted `backend/server.py`; EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `frontend/lib/tfidf.ts` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — PLANNED (no suite yet)

**Unification follow-ups (this branch's backlog):**
1. Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`
2. ~~Firebase-removal branch (see INTEGRATION.md §3)~~ — **DONE except `functions/` + key rotation** (frontend, `backend/app`, `tools/`, `render.yaml`, root `firebase.*`/`firestore.*` all cleared; `functions/` legacy HTML/JS retires in Phase 4)
3. ~~Wire Next.js frontend to backend~~ — **DONE** (`lib/api.ts` ↔ `backend/app`, both on `:10000`; smoke-tested 2026-09-11)
4. Hygiene — ~~`.gitignore`/`__pycache__`/UTF-16 requirements~~ DONE (all three verified 2026-09-11; `backend/requirements.txt` rewritten as ASCII in Phase 3); remaining: decide `adfbh`, rotate hardcoded Firebase key
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

- `frontend/AGENTS.md` and `frontend/CLAUDE.md` were auto-generated by `create-next-app@16.3.0`.
  Review their content if Next.js AI tooling conflicts with project conventions.
- `AGENTS.md` tech-stack table (FastAPI/PostgreSQL) — FastAPI now matches DEC-010,
  but the database row (PostgreSQL) contradicts the MongoDB plan — needs owner confirmation.
- ~~`.gitignore` binary / UTF-16 `requirements.txt` / committed `__pycache__`~~ —
  all FIXED (verified 2026-09-11: `.gitignore` is UTF-8 text with `__pycache__`
  ignored, 0 tracked pyc files, `backend/requirements.txt` is ASCII).
- `adfbh` is an unidentified duplicate admin HTML — decide fate (Phase 4).
- Hardcoded Firebase Web API key in `functions/admin_api.js` — still exposed in
  git history; **rotation is mandatory**, not just file deletion (Phase 5).
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
   (the only thing standing between the app and persistent storage).
2. Phase 4: retire `functions/` + root `adfbh` (last Firebase-era code).
3. Phase 5: align `AGENTS.md` stack table, root `README.md`, `INTEGRATION.md`,
   `docs/API.md`/`ARCHITECTURE.md`/`SECURITY.md`; record the migration decision
   (DEC-011); rotate the leaked Firebase key (it is in git history).
4. Phase 6: pytest against a test Mongo DB + classifier unit tests, `npm run
   build`, end-to-end manual check, `rg -i "firestore|firebase"` returns nothing.
5. Review + merge `feature/unified-system` → `main` (`--no-ff`) when ready.

See `memory/TODO.md` for the full prioritized task backlog.
