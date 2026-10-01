# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-09-11 (Phase 1 + 1.5 of `UNIFIED_MIGRATION_PLAN` committed
> as `1857ee3..0b438b8` on `feature/unified-system` — frontend is now
> Firebase-free and at legacy behavioural parity)

---

## Current Phase

**Frontend de-Firebase (Phase 1) + legacy parity (Phase 1.5)** ⬤ Complete
(committed `1857ee3..0b438b8`; see `UNIFIED_MIGRATION_CHECKLIST.md`)

Per DEC-008: `backend/server.py` (Flask + ML) is authoritative; FastAPI scaffold
discarded (not copied); Firestore kept temporarily server-side; `frontend/`,
`docs/`, `memory/`, `PRD.md`, `AGENTS.md` copied additively from `Idea Lab`.
Next: Phase 2 (FastAPI rewrite / persistence replacement) — backend still has
no `GET/PATCH /grievances*` endpoints the frontend now calls.
See `INTEGRATION.md` at repo root for the source map.

---

## Current Architecture

```
backend/      — Flask ML service (server.py: classifiers, image validation)  IMPLEMENTED (authoritative, see DEC-008)
tools/        — recategorize.py (batch re-classification over Firestore)      IMPLEMENTED
functions/    — TF-IDF similarity + admin UI (HTML/JS, Firebase client)      IMPLEMENTED (legacy reference)
frontend/     — Next.js 16 (TS, Tailwind v4): REST client, demo auth,        IMPLEMENTED (Firebase removed; live mode needs
                admin map/clusters/filters, citizen my-grievances               /grievances endpoints — not in Flask yet)
docs/         — Technical documentation (partially stale, see DEC-008)       IMPLEMENTED (reference only)
memory/       — AI agent persistent memory                                   IMPLEMENTED
firebase.* / firestore.* / .firebaserc — Firestore persistence              IMPLEMENTED (server-side only; kept temporarily, removal deferred)
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
- **Open:** live mode calls `GET /grievances`, `GET /grievances/{id}`,
  `PATCH /grievances/{id}/status` — not implemented in `backend/server.py` yet (Phase 2)

### Backend (`backend/`)
- `backend/server.py` — Flask app: `classify_category` (HF zero-shot → Groq →
  keyword fallback), `classify_priority`, `refine_with_groq`,
  `llm_image_confidence`, `/submit-grievance`, `/validate-image`,
  `/sign-cloudinary`, `/delete-cloudinary`, `/health` — **IMPLEMENTED (authoritative)**
- `tools/recategorize.py` — batch re-run of classifiers over Firestore — **IMPLEMENTED**
- `functions/tfidf.js` — client-side TF-IDF + greedy clustering — **IMPLEMENTED**
- The `Idea Lab` FastAPI scaffold was deliberately NOT copied (DEC-008).
  The following lines describe `Idea Lab` history, NOT this repo — **SUPERSEDED**:
- ~~`app/config.py` — pydantic-settings — IMPLEMENTED~~ — does not exist here
- ~~`app/database.py` — async SQLAlchemy — IMPLEMENTED~~ — does not exist here
- ~~`app/dependencies.py` — RBAC helpers — IMPLEMENTED~~ — does not exist here
- ~~Router/service/AI-module stubs, requirements-*.txt, `backend/.env.example`,
  `backend/uploads/`, `tests/conftest.py`~~ — not copied; PLANNED items below
  that assume FastAPI/Postgres are superseded pending the persistence decision

### Database
- Firestore via `firebase-admin` (`db = firestore.client()` in
  `backend/server.py`) — **IMPLEMENTED (temporary, see DEC-008)**
- ~~Alembic configured~~ — not copied; SUPERSEDED
- `docs/DATABASE.md` schema design is reference-only until rewritten

### Authentication
- **Frontend:** demo localStorage session + `lib/roles.ts` allowlist —
  **IMPLEMENTED (temporary)**; Firebase Auth client removed 2026-09-11
- **Backend/legacy:** Firebase Auth client-side (`functions/admin_api.js`) +
  admin email whitelist (`aryaadmin@gmail.com`, also in `firestore.rules`) —
  **IMPLEMENTED (temporary)**
- ~~JWT + RBAC (PHASE 3)~~ — SUPERSEDED pending canonical-stack decision

### AI Modules
- Working classifiers in `backend/server.py` + `functions/tfidf.js` —
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
- **PHASE 5**: User / Resolver / Admin UI in Next.js — PARTIALLY IMPLEMENTED (submit + my-grievances, track, login/register demo auth, admin board with assignment/filters/map/clusters; resolver workflow and analytics views OPEN; backend wiring blocked on `/grievances*` endpoints)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/server.py` classifiers (EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `functions/tfidf.js` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — PLANNED (no suite yet)

**Unification follow-ups (this branch's backlog):**
1. Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`
2. ~~Firebase-removal branch (see INTEGRATION.md §3)~~ — **frontend half DONE** 2026-09-11 (`lib/firebase.ts` deleted, deps removed); backend/`tools`/`functions`/`render.yaml` + root Firebase config files still pending
3. Wire Next.js frontend to Flask backend — **client side DONE** (`lib/api.ts` targets `NEXT_PUBLIC_API_URL`, default `:10000`); backend must implement `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status` (Phase 2), then port mismatch is resolved
4. Fix `.gitignore` (binary), untrack `__pycache__/`, convert `backend/requirements.txt` to UTF-8, decide `adfbh`, rotate hardcoded Firebase key
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

- **Live mode is non-functional until Phase 2:** `lib/api.ts` calls
  `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status`,
  none of which exist in `backend/server.py` (only `/submit-grievance`,
  `/validate-image`, `/sign-cloudinary`, `/delete-cloudinary`, `/health`).
  Mock mode (`NEXT_PUBLIC_USE_MOCKS=true`, the default) is unaffected.
- `frontend/AGENTS.md` and `frontend/CLAUDE.md` were auto-generated by `create-next-app@16.3.0`.
  Review their content if Next.js AI tooling conflicts with project conventions.
- `AGENTS.md` tech-stack table (FastAPI/PostgreSQL) contradicts DEC-008 — needs owner confirmation.
- `.gitignore` reads as binary, `backend/requirements.txt` is UTF-16, `__pycache__/` is
  committed, `adfbh` is an unidentified duplicate admin HTML — all queued as follow-ups (see INTEGRATION.md).
- Hardcoded Firebase Web API key in `functions/admin_api.js` — must be rotated.

---

## Current Blockers

- Canonical backend/DB/auth stack not yet confirmed (DEC-008 consequence) — gates
  persistence replacement and frontend wiring.
- LLM provider: Groq + HuggingFace already in use by `backend/server.py`
  (`GROQ_API_KEY`, `HF_API_TOKEN`); OQ-001 in PRD.md is effectively answered for
  the Flask path but not formally recorded — confirm and close.

---

## Important Integration Points

- Frontend (Next.js) ↔ Backend: REST/JSON — contract now defined by
  `frontend/lib/api.ts` (`/submit-grievance`, `/grievances{,/{id}{,/status}}`,
  `/validate-image`, `/sign-cloudinary`, `/delete-cloudinary`, `/health`); Flask
  runs on `:10000`, `frontend/.env.example` defaults to `:10000` (aligned;
  grievance CRUD endpoints still missing server-side).
- Backend ↔ Database (current): `firebase-admin` Firestore client (`db` in `backend/server.py`).
- Backend ↔ AI: in-process calls in `backend/server.py` (HF zero-shot → Groq → keyword fallback).
- Backend ↔ LLM APIs: `GROQ_API_KEY` / `GROQ_MODEL`, `HF_API_TOKEN` env vars.
- Batch re-classification: `tools/recategorize.py` (imports from `backend.server`).
- Similarity (current): client-side `frontend/lib/tfidf.ts` (port of `functions/tfidf.js`).

---

## Immediate Next Steps

1. Implement the `/grievances*` endpoints the frontend now calls (Phase 2 of
   `UNIFIED_MIGRATION_PLAN` — FastAPI rewrite or interim Flask shim) so live mode works.
2. Owner decision: canonical stack (confirm Flask + replacement persistence).
3. Server-side Firebase removal per INTEGRATION.md §3 (backend, `tools/`, `functions/`,
   root `firebase.*` config) after persistence replacement.
4. Hygiene: `.gitignore`, `__pycache__/`, UTF-16 requirements, `adfbh`, key rotation.
5. Review + merge `feature/unified-system` → `main` (`--no-ff`) when ready.

See `memory/TODO.md` for the full prioritized task backlog.
