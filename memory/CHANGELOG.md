# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

---

## 2026-10-01 — Migration Phases 4, 5, 6: Legacy UI Retired, Docs Aligned, Test Suite Added — committed

### Added
- `tests/` (4 files, 85 tests) — pytest suite: `test_classification.py` (keyword
  category inference, urgency/risk/priority rules, sentiment normalisation, and
  the `CATEGORY_KEYS` ↔ `frontend/lib/types.ts` `CATEGORIES` contract test),
  `test_endpoints.py` (real FastAPI app over `TestClient`: health, submit,
  scoped/limited/newest-first list, get, PATCH, 404s, flat `{"error": …}` shape),
  `test_repository.py` (both `GrievanceRepository` implementations behind one
  parametrised contract, Mongo-specific BSON/index/persistence checks, and
  `_build_repository()` selection)
- `pytest.ini` — `testpaths = tests`, `pythonpath = .` (imports `backend.app`
  without installation)
- `requirements-dev.txt` — `-r requirements.txt` + `pytest`; kept separate
  because Render's `buildCommand` installs the root `requirements.txt`
- `frontend/scripts/e2e.mjs` — end-to-end check that imports the **real**
  `frontend/lib/api.ts` (so responses are zod-parsed by the same schemas the UI
  uses) and drives submit → track → admin assign/resolve → re-read against a
  live backend; needs a running backend, not part of `pytest`
- `render.yaml` — `MONGODB_URI` (sync: false) + `MONGODB_DB` env vars; without
  them a deployment silently runs on the in-memory fallback

### Changed
- `AGENTS.md` — stack table reconciled with reality: Backend row annotated
  `backend/app/` (DEC-010), Database row PostgreSQL → MongoDB (DEC-011),
  Auth row marked *planned* vs. the demo localStorage session (DEC-009), plus a
  dated stack note
- `README.md` — rewritten sections (repository layout, quickstart, port, key
  decisions, follow-ups) to describe FastAPI + MongoDB instead of Flask +
  `server.py`; stale-docs warning removed now that docs are aligned
- `docs/ARCHITECTURE.md` — overview/port/diagram corrected to MongoDB + `:10000`,
  backend tree replaced with the real `backend/app/` layout, Auth section marked
  PLANNED, Database + boundaries sections rewritten for pymongo
- `docs/API.md` — status header rewritten, base URL `:8000` → `:10000`, added an
  "Implemented endpoints" table (incl. the `POST /submit-grievance` naming note),
  `/health` response and the error format corrected to the actual shapes
- `docs/DEVELOPMENT.md` — prerequisites/setup/migrations/commands/conventions/
  troubleshooting rewritten for MongoDB + uvicorn; new "Running Tests" section
- `docs/SECURITY.md` — Authentication marked PLANNED; Known Prototype
  Limitations now leads with the server-side auth gap (API trusts request-body
  `userId`, no authorization on list/PATCH, frontend allowlist is client-side only)
- `INTEGRATION.md` — status banner (Phases 1–4 executed) + loose-ends items
  annotated as resolved; original source map preserved verbatim
- `frontend/lib/tfidf.ts` — comment notes `functions/tfidf.js` was retired

### Removed
- `functions/` (6 files: `tfidf.js`, `admin_api.js`, `admin_ui.js`,
  `admin.html`, `grievance-app.html`, `download.jpg`) — last Firebase-era code
- root `adfbh` — unidentified duplicate admin HTML

### Verified
- `pytest`: **85 passed** with a local `mongod`; **68 passed, 17 skipped**
  without one (Mongo tests skip rather than fail)
- Test DBs cleaned up after runs (only `admin`/`config`/`local` remained);
  `mongod --shutdown` used afterwards
- **End-to-end via the real frontend client** (`node frontend/scripts/e2e.mjs`
  against live `uvicorn` + `mongod`): submit → track-by-id → unknown-id `null`
  → admin global/scoped/empty lists → assign → resolve → re-read persists the
  changes and keeps other fields → submit without `userId` rejects with the
  backend's `{error}` message → second citizen proves the queue is multi-user.
  All responses passed the frontend's zod schemas.
- HTTP-level: all 6 frontend routes (`/`, `/submit`, `/track`, `/admin`,
  `/login`, `/register`) return 200 with the dev server on `:3000`.
  *No desktop browser was connected to this session, so the DOM was not driven —
  `frontend/scripts/e2e.mjs` covers the same contract minus rendering.*
- End-to-end against live `uvicorn` on `:10000` with `MONGODB_URI` set:
  health `storage: mongodb`, submit ×2, list (all + `?userId=` scoped), get,
  PATCH status+assignee, 404s, `400 {"error": "description: Field required; …"}`,
  **data survives a process restart** (including the PATCH), and the same server
  with no `MONGODB_URI` reports `storage: in-memory` and an empty list
- `tsc --noEmit` clean; `npm run build` passes (9 routes)
- `rg -i "firestore|firebase"` over source + docs: only past-tense historical
  comments remain (`tools/recategorize.py`, `frontend/lib/{roles,grievances}.ts`,
  `INTEGRATION.md`, plus the key-rotation notices in `README.md`/`SECURITY.md`);
  no `firebase`/`firestore` dependency in `frontend/package.json`, no
  `firebase*`/`firestore*` files outside `venv/`
- Hygiene: 0 tracked `__pycache__` (incl. the new `tests/__pycache__`),
  `venv/` gitignored and untracked

### Repository State at End of This Entry
- 6 new commits `09e83af..98ec1f3` on `feature/unified-system` (+ memory commit);
  `UNIFIED_MIGRATION_PLAN.md` / `UNIFIED_MIGRATION_CHECKLIST.md` marked Phases
  4–6 complete (only the key rotation, Cloudinary preset and an unrelated
  `main`-branch file question remain unticked)
- **Migration plan Phases 1–6 complete**; DEC-002 marked SUPERSEDED BY DEC-011;
  DEC-011's Phase 4/5 follow-ups closed; new DEC-012 (test strategy) and
  DEC-013 (docs annotated rather than rewritten)
- Still open: owner's MongoDB Atlas setup (`MONGODB_URI`), Firebase Web API key
  rotation (in git history), real auth, unpushed local commits

---


### Added
- `MongoRepository` in `backend/app/db.py` — pymongo implementation of the existing `GrievanceRepository` protocol; selected when `MONGODB_URI` is set, in-memory fallback otherwise; indexes at startup (unique `id`, compound `userId + createdAt`); `createdAt` stored as BSON date
- `/health` now reports `storage: mongodb | in-memory` (`backend/app/routers/health.py`)
- `backend/.env.example` — `MONGODB_URI`/`MONGODB_DB`, LLM keys, Cloudinary, server config

### Changed
- `tools/recategorize.py` — rewritten for MongoDB; imports the shared classifier from `backend/app/services/classification.py` (no longer `backend.server`); adds `--dry-run`
- `requirements.txt` / `backend/requirements.txt` — `+pymongo`, `+dnspython`; `-firebase-admin`, `-Flask`, `-gunicorn`, Google client stack; pins refreshed (`backend/requirements.txt` is now ASCII, fixing the old UTF-16 issue)
- `docs/DATABASE.md` — rewritten for MongoDB (22 Postgres entities moved to a roadmap section)
- `frontend/lib/types.ts` — stale `CATEGORY_KEYS` comment repointed from deleted `server.py` to `services/classification.py`

### Removed
- `backend/server.py` (legacy Flask + Firestore server — logic already ported to `backend/app/`)
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`

### Verified
- Local throwaway `mongod`: `storage: mongodb`, create → scoped list → get → PATCH, BSON `createdAt`, both indexes present, data survives process restart
- In-memory fallback (`MONGODB_URI=""`): same smoke test passes, `storage: in-memory`
- `tools/recategorize.py --help` runs without `server.py`; `pip install --dry-run -r backend/requirements.txt` resolves; `tsc --noEmit` clean
- Hygiene re-verified: `.gitignore` is UTF-8 text, 0 tracked `__pycache__` files

### Repository State at End of This Entry
- 4 new commits `c44d410..aae4b74` on `feature/unified-system` (+ memory commit)
- DEC-011 recorded; DEC-008 item 4 superseded — **no Firebase/Firestore code in the serving path or root config**; remaining Firebase: `functions/` + root `adfbh` (Phase 4) and the key in git history (rotation required)
- Blocker: owner must create the Atlas cluster + set `MONGODB_URI` in `backend/.env`

---

## 2026-09-11 — Phase 2: FastAPI Rewrite — committed

### Added
- `backend/app/` — FastAPI service (13 files): `main.py` (app + CORS + `400 {"error": …}` validation handler matching the legacy contract), `config.py` (python-dotenv, no pydantic-settings), `models.py`, `db.py` (`GrievanceRepository` protocol + in-process implementation — Phase 3 swaps in MongoDB with no router changes), `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py` (classifier/keyword/risk + image logic ported verbatim from `backend/server.py`, HF → Groq → keyword cascade, `CATEGORY_KEYS` byte-identical to the frontend's `CATEGORIES`)

### Changed
- `render.yaml` — start command `gunicorn … backend.server:app` → `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`; `FIREBASE_SERVICE_ACCOUNT` removed; `CORS_ORIGINS` + Cloudinary env vars added
- `requirements.txt`, `backend/requirements.txt` — `fastapi`, `uvicorn`, `starlette`, `pydantic`/`annotated-doc` added
- `frontend/lib/api.ts` + `frontend/lib/types.ts` — optional grievance fields (`userId`, `imageUrl`, `latitude`, `longitude`, `hfEngine`, `assignee`) changed to `null`-tolerant (`nullish` / `| null`) so FastAPI's explicit-null responses parse

### Verified
- In-process `TestClient` smoke test: `health` 200, `POST /submit-grievance` 200 (AI refinement gracefully skipped without keys), `GET /grievances` 200 + `?userId=` scoping, `GET /grievances/{id}` 200, `PATCH /grievances/{id}/status` 200 (status + assignee), unknown id 404.
- `tsc --noEmit` clean; `npm run build` passes (9 routes).
- `__pycache__`/`.pyc` deliberately **not** staged (existing hygiene debt not extended).

### Repository State at End of This Entry
- 4 new commits `e55a9a3..d1c9c6d` on `feature/unified-system` (+ memory commit)
- **DEC-008 partially superseded** (see DEC-010): FastAPI `backend/app/` is now the serving path (per `UNIFIED_MIGRATION_PLAN`); `backend/server.py` (Flask + Firestore) remains as legacy reference; frontend live mode works against the new backend
- Next: Phase 3 (MongoDB persistence) — `db.py` protocol swap

---

## 2026-09-11 — Frontend de-Firebase (Phase 1) + Legacy Parity (Phase 1.5) — committed

### Added
- `frontend/lib/roles.ts` — admin allowlist + `roleForEmail` (extracted from the deleted `lib/firebase.ts`; single source of admin detection until real auth lands)
- `frontend/lib/tfidf.ts` — TypeScript port of `functions/tfidf.js` (client-side TF-IDF + greedy clustering)
- `frontend/components/admin/AdminMap.tsx` — Leaflet map with markers/image popups for the filtered set
- `frontend/components/admin/AdminClusters.tsx` — cluster panel; "View" filters the queue
- `frontend/components/grievance/MyGrievances.tsx` — citizen's own submissions on `/submit`
- `frontend/lib/api.ts` — `listGrievances`, `getGrievance`, `updateGrievanceStatus` + grievance zod schemas (plus a shared `requestJson` helper)

### Changed
- `frontend/lib/session.tsx` — demo-only localStorage provider; `liveMode` (from `NEXT_PUBLIC_USE_MOCKS`) replaces the Firebase session; `signInDemo(email, role?, name?)`, synchronous `signOut`
- `frontend/lib/grievances.ts` — REST polling (15s default) replaces Firestore `onSnapshot`; admins → all, citizens → own
- `frontend/components/admin/AdminBoard.tsx` — priority/category/status filters, free-text search, pagination (5/10/20/50), Leaflet map, TF-IDF clusters, legacy stat cards (total / high-open / medium-open / resolved), per-row urgent badge + created + userId, live `PATCH /grievances/{id}/status` for assign/resolve with local overrides in mock mode
- `frontend/app/login/page.tsx`, `register/page.tsx` — Firebase sign-in/sign-up removed; demo sign-in with role resolution
- `frontend/app/track/page.tsx` — `liveMode` instead of `user.live`
- `frontend/.env.example` — Firebase/NextAuth vars stripped; `NEXT_PUBLIC_SHOW_DEV_CREDS` added
- `frontend/package.json` / `package-lock.json` — `-firebase`, `-next-auth`, `+leaflet`, `+@types/leaflet` (lock regenerated via clean reinstall)
- `frontend/components/grievance/ImageUpload.tsx` — unused `Button` import removed

### Removed
- `frontend/lib/firebase.ts` (Firestore + Firebase Auth client)

### Verified
- `tsc --noEmit` clean; `npm run build` passes (9 routes) on the final tree.

### Repository State at End of This Entry
- 7 new commits `1857ee3..0b438b8` on `feature/unified-system` (memory update committed after)
- Frontend is Firebase-free; live mode now expects `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status` — **these do not exist in `backend/server.py` yet** (Phase 2 FastAPI rewrite pending), so live reads/writes 404 until then (UI surfaces the error banner)

---

## 2026-09-11 — Frontend White Theme & Sleek UI Modernization

### Changed
- `frontend/app/globals.css` — Removed dark mode system overrides, set default pure white background `#ffffff` with slate/ink typography tokens and modern blue primary palette.
- `frontend/app/layout.tsx` — Enforced pure white background (`bg-white`), modern selection highlights, and consistent container styling.
- `frontend/components/ui/Card.tsx` — Upgraded Card styling to sleek rounded-xl, subtle borders (`border-ink-200/80`), soft shadows, and refined padding.
- `frontend/components/ui/Button.tsx` — Upgraded button variants with rounded-lg corners, micro-interactions, subtle shadows, and crisp focus rings.
- `frontend/components/ui/Field.tsx` — Modernized inputs, textareas, selects, and field labels with crisp borders and focus rings.
- `frontend/components/ui/Badge.tsx` — Updated status and priority badges with clean semantic pastel tone borders and backgrounds (emerald, amber, rose, blue, slate).
- `frontend/components/ui/SiteHeader.tsx` & `SiteFooter.tsx` — Streamlined header and footer with sleek typography, backdrop blur, and pure white styling.
- `frontend/components/ui/Feedback.tsx` — Redesigned Alert, Spinner, and EmptyState components with modern borders and icons.
- `frontend/app/page.tsx`, `components/grievance/GrievanceCard.tsx`, `LocationCapture.tsx`, `ImageUpload.tsx` — Removed all blinking/pulsing status dots and live indicator dots globally for a clean, distraction-free aesthetic.
- `frontend/app/page.tsx`, `submit/page.tsx`, `track/page.tsx`, `admin/page.tsx`, `login/page.tsx`, `register/page.tsx` — Complete UI polish for seamless white background presentation across all views.
- Verified: `npm run build` succeeds cleanly with zero errors.

---

## 2026-09-11 — Unification Commit + Root README (`feature/unified-system`)

### Added
- Root `README.md` — unified-repo layout, backend/frontend quickstart, branch
  strategy, stale-docs warnings, follow-ups (written fresh; `Idea Lab` README
  deliberately not reused)

### Changed
- Deleted local branch `app/intialise` (was `2d8dfa5`, never on origin) — `main` untouched
- Committed unification baseline as `e0d363f` (42 additive-only files) and pushed
  `origin/feature/unified-system`; verified `npm run build` passes and
  `backend/` diff vs `main` is empty
- `memory/TODO.md` — root README follow-up marked done
- `memory/PROJECT_STATE.md` — unification marked committed/pushed; `app/intialise` refs removed
- `memory/SESSION_LOG.md` — this session entry appended

### Repository State at End of This Entry
- `main` pristine at `2d8dfa5`; `app/intialise` deleted; `feature/unified-system`
  at `e0d363f` (tracked upstream)
- Unification complete; real frontend work deferred to a new branch

---

## 2026-09-11 — Repo Unification (`feature/unified-system`)

### Added
- `frontend/` — Next.js 16 + TypeScript + Tailwind v4 scaffold (copied from `Idea Lab`; not yet wired to Flask backend)
- `docs/` — full technical documentation set (copied from `Idea Lab`; DATABASE/API docs are reference-only per DEC-008)
- `memory/` — agent persistent memory (copied from `Idea Lab`, then updated: DEC-008, PROJECT_STATE ground truth, TODO annotations)
- `PRD.md`, `AGENTS.md` — scope source of truth + agent operating rules (copied from `Idea Lab`; AGENTS.md stack table stale per DEC-008)
- `INTEGRATION.md` — unification source map, `backend/` collision record, follow-up backlog

### Changed
- `memory/DECISIONS.md` — DEC-008 accepted (Flask authoritative, FastAPI discarded, Firestore temporary)
- `memory/PROJECT_STATE.md` — rewritten to Flask/Firestore ground truth; FastAPI-era claims superseded
- `memory/TODO.md` — FastAPI/Postgres-conflicting tasks marked SUPERSEDED
- `memory/SESSION_LOG.md` — unification session entry appended

### Deliberately Excluded
- `Idea Lab` `backend/` (FastAPI scaffold, Alembic, tests) — discarded per owner decision
- `Idea Lab` root `README.md` — describes discarded stack; new root README is a follow-up

### Repository State at End of This Entry
- Branch `feature/unified-system` (off `app/intialise`); `app/intialise` + `main` untouched
- Additive-only merge: no existing `Idea Lab2` file modified or deleted
- Firestore still the working database; Firebase removal deferred to follow-up branch

---

## 2026-08-06 — Project Initialization

### Added
- `README.md` — Project overview, lifecycle, actors, stack, setup instructions, repository map
- `PRD.md` — Full Product Requirements Document with traceable requirement IDs
- `AGENTS.md` — Mandatory AI agent operating rules and memory protocol
- `docs/PROJECT_CONTEXT.md` — Academic background, research context, problem statement
- `docs/ARCHITECTURE.md` — Proposed system architecture (monorepo, frontend/backend/DB/AI boundaries)
- `docs/DATABASE.md` — Proposed domain model and database design
- `docs/AI_SYSTEM.md` — AI module specifications (AI-01 through AI-11)
- `docs/WORKFLOWS.md` — Grievance lifecycle workflows and state transitions
- `docs/API.md` — Planned API endpoint documentation
- `docs/SECURITY.md` — Security design (auth, RBAC, input validation, secrets)
- `docs/DEVELOPMENT.md` — Local development setup guide
- `memory/README.md` — Memory system explanation and agent instructions
- `memory/PROJECT_STATE.md` — Initial project state (documentation phase)
- `memory/DECISIONS.md` — Initial architecture decisions (DEC-001 through DEC-007)
- `memory/CHANGELOG.md` — This file
- `memory/TODO.md` — Initial task backlog
- `memory/SESSION_LOG.md` — Initial session log entry

### Repository State at End of This Entry
- No application code exists
- Documentation foundation established
- Architecture proposed but not implemented
- All features: PLANNED
