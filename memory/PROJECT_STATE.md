# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-09-11 (unification committed as e0d363f, pushed to
> origin/feature/unified-system; stale local branch app/intialise deleted;
> root README written; real frontend deferred to a new branch)

---

## Current Phase

**Unification (`feature/unified-system`, committed `e0d363f`, pushed)** ⬤ Complete
(stale local branch `app/intialise` deleted; `main` untouched)

Per DEC-008: `backend/server.py` (Flask + ML) is authoritative; FastAPI scaffold
discarded (not copied); Firestore kept temporarily; `frontend/`, `docs/`,
`memory/`, `PRD.md`, `AGENTS.md` copied additively from `Idea Lab`.
Firebase removal + persistence replacement is a follow-up branch.
See `INTEGRATION.md` at repo root for the source map.

---

## Current Architecture

```
backend/      — Flask ML service (server.py: classifiers, image validation)  IMPLEMENTED (authoritative, see DEC-008)
tools/        — recategorize.py (batch re-classification over Firestore)      IMPLEMENTED
functions/    — TF-IDF similarity + admin UI (HTML/JS, Firebase client)      IMPLEMENTED
frontend/     — Next.js 16 (TypeScript, Tailwind v4, App Router) scaffold     IMPLEMENTED (not yet wired to Flask backend — port mismatch :8000 vs :10000)
docs/         — Technical documentation (partially stale, see DEC-008)       IMPLEMENTED (reference only)
memory/       — AI agent persistent memory                                   IMPLEMENTED
firebase.* / firestore.* / .firebaserc — Firestore persistence               IMPLEMENTED (kept temporarily, removal deferred)
```

---

## Implemented

### Documentation
- `README.md`, `PRD.md`, `AGENTS.md`
- `docs/ARCHITECTURE.md`, `DATABASE.md`, `AI_SYSTEM.md`, `WORKFLOWS.md`
- `docs/API.md`, `SECURITY.md`, `DEVELOPMENT.md`, `PROJECT_CONTEXT.md`
- All `memory/` files

### Frontend (`frontend/`)
- Next.js 16 + TypeScript + Tailwind CSS v4 + ESLint — scaffold **IMPLEMENTED**
- App Router with default placeholder page (`app/page.tsx`, `app/layout.tsx`)
- Packages installed: `next-auth@beta`, `axios`, `recharts`, `react-hook-form`,
  `zod`, `@tanstack/react-query`, `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`
- Directory structure: `app/`, `components/ui|grievance|admin|charts/`, `lib/`, `public/`
- Config: `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- `frontend/.env.example` created
- TypeScript check: **passes with no errors**

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
- Firebase Auth client-side (`functions/admin_api.js`) + admin email whitelist
  (`aryaadmin@gmail.com`, also in `firestore.rules`) — **IMPLEMENTED (temporary)**
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
- **PHASE 5**: User / Resolver / Admin UI in Next.js — OPEN (frontend scaffold copied, not wired; port mismatch `:8000` vs `:10000`)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/server.py` classifiers (EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `functions/tfidf.js` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — PLANNED (no suite yet)

**Unification follow-ups (this branch's backlog):**
1. Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`
2. Firebase-removal branch (see INTEGRATION.md §3)
3. Wire Next.js frontend to Flask backend (resolve port + API contract)
4. Fix `.gitignore` (binary), untrack `__pycache__/`, convert `backend/requirements.txt` to UTF-8, decide `adfbh`, rotate hardcoded Firebase key
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

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

- Frontend (Next.js, planned) ↔ Backend: REST/JSON — contract TBD; Flask runs on
  `:10000`, `frontend/.env.example` defaults to `:8000` (mismatch, follow-up).
- Backend ↔ Database (current): `firebase-admin` Firestore client (`db` in `backend/server.py`).
- Backend ↔ AI: in-process calls in `backend/server.py` (HF zero-shot → Groq → keyword fallback).
- Backend ↔ LLM APIs: `GROQ_API_KEY` / `GROQ_MODEL`, `HF_API_TOKEN` env vars.
- Batch re-classification: `tools/recategorize.py` (imports from `backend.server`).
- Similarity (current): client-side `functions/tfidf.js`.

---

## Immediate Next Steps

1. Review + merge `feature/unified-system` → `main` (`--no-ff`) when ready.
2. Create `feature/frontend` for real UI work (typed API client, submission form, track/admin views).
2. Owner decision: canonical stack (confirm Flask + replacement persistence).
3. Firebase-removal branch per INTEGRATION.md §3.
4. Wire Next.js frontend to Flask backend (port + API contract).
5. Hygiene: `.gitignore`, `__pycache__/`, UTF-16 requirements, `adfbh`, key rotation, root README.

See `memory/TODO.md` for the full prioritized task backlog.
