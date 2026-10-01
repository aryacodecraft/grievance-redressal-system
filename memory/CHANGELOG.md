# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

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
