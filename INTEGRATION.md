# INTEGRATION.md — Unified Repo Source Map (`feature/unified-system`)

> Created: 2026-09-11. Branch `feature/unified-system` based off `app/intialise`
> (note: branch name typo `intialise` is pre-existing; left as-is).
> Target merge path: `feature/unified-system` → `app/intialise` → `main`.

> **⚠️ STATUS 2026-09-11 — migration executed (Phases 1–4 complete).**
> This document is the *original* unification record; several rows below now
> describe files that no longer exist. Current reality:
> - `backend/server.py`, `functions/`, `adfbh`, `firebase.json`, `.firebaserc`,
>   `firestore.rules`, `firestore.indexes.json` — **DELETED** (DEC-010/DEC-011).
> - `render.yaml` → `uvicorn backend.app.main:app`; `FIREBASE_SERVICE_ACCOUNT` removed.
> - `frontend/` is a working REST client (Firebase deps removed), wired to `backend/app` on `:10000`.
> - Database is MongoDB (`MONGODB_URI`); `tools/recategorize.py` rewritten for it.
> - The historical rows and follow-up list below are kept intentionally as the
>   source map for the original merge — see `UNIFIED_MIGRATION_PLAN.md` for
>   current status and `memory/PROJECT_STATE.md` for live state.

---

## What came from where

| Path in this repo | Origin | Notes |
|---|---|---|
| `backend/server.py`, `backend/requirements.txt` | `Idea Lab2` (`app/intialise`) — **authoritative backend, untouched** | Flask + ML classifiers; `render.yaml` start command `backend.server:app` depends on this path |
| `tools/recategorize.py` | `Idea Lab2` — **untouched** | Imports `from server import ...` via `sys.path → backend/`; do not rename `backend/` |
| `functions/` (`tfidf.js`, `admin_api.js`, `admin_ui.js`, `*.html`) | `Idea Lab2` — **untouched** | Client-side TF-IDF + admin UI; `admin_api.js` contains a hardcoded Firebase Web API key — rotate, do not copy further |
| `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` | `Idea Lab2` — **kept temporarily** | Firestore is still the database in this branch (decision DEC-008); removal is a follow-up branch |
| `render.yaml`, `requirements.txt` | `Idea Lab2` — **untouched** | Still references `FIREBASE_SERVICE_ACCOUNT` |
| `frontend/` | `Idea Lab` (`main` @ `83f5cfd`) — full copy | Next.js 16 scaffold; `.env.example` points at `NEXT_PUBLIC_API_URL=http://localhost:8000`, which does **not** match the Flask backend (`PORT=10000`). Rewiring is a follow-up, not this branch |
| `docs/` | `Idea Lab` — full copy | Architecture/database/AI specs; `DATABASE.md`/`API.md` describe the discarded FastAPI design — treat as reference, not ground truth |
| `memory/` | `Idea Lab` — full copy, then updated (see below) | `TODO.md` FastAPI/PHASE tasks marked superseded where they conflict with DEC-008 |
| `PRD.md`, `AGENTS.md` | `Idea Lab` — full copy | Still authoritative for scope and agent operating rules |
| Idea Lab `backend/` (FastAPI scaffold, Alembic, tests) | **deliberately NOT copied** | Per owner decision; recorded in DEC-008 |
| Idea Lab root `README.md` | **deliberately NOT copied as root README** | It describes the discarded FastAPI/Postgres stack; new root README is a follow-up |

---

## Verification performed on `feature/unified-system` (2026-09-11, uncommitted)

- `git diff app/intialise -- backend tools functions render.yaml requirements.txt
  firebase.json firestore.rules firestore.indexes.json .firebaserc adfbh` → empty
  (all pre-existing files untouched).
- New files limited to: `AGENTS.md`, `INTEGRATION.md`, `PRD.md`, `docs/`,
  `frontend/`, `memory/` (all untracked, no secrets — no `.env`/`.env.local`/
  `serviceAccountKey.json` present or staged).
- `python3 -m py_compile backend/server.py tools/recategorize.py` → OK
  (stray `.pyc` artifacts from the check were deleted).
- `cd frontend && npm install` → 423 packages OK; `npm run build` → passes
  (prerendered `/` + `/_not-found`). Note: bare `npx tsc --noEmit` reports
  `Cannot find name 'LayoutProps'` in `app/layout.tsx` — pre-existing
  `create-next-app@16.3.0` scaffold quirk (file identical to `Idea Lab` source;
  Next generates the global during build), not caused by this merge.
- Not committed — commit + push (`git push -u origin feature/unified-system`)
  left for owner review.

---

## Known mismatches / loose ends (follow-ups, not this branch)

> **Resolved since writing** (2026-09-11): 1 (port now `:10000` both sides),
> 2 (`.gitignore` is UTF-8), 3 (no tracked `__pycache__`), 4 (`adfbh` dropped),
> 5 (requirements rewritten as ASCII). Item 6's file `functions/admin_api.js`
> is deleted, **but the key is still in git history — rotation remains open.**

1. **Port mismatch**: `frontend/.env.example` → `:8000`; Flask backend → `:10000`. ~~resolved~~
2. **`Idea Lab2/.gitignore` reads as binary** (`file` reports `data`) — needs rewrite as UTF-8 text; verify `serviceAccountKey.json`, `.env`, `venv/`, `node_modules/` are ignored. ~~resolved~~
3. **Committed `__pycache__/`** (`backend/__pycache__/`, `tools/__pycache__/`) — should be untracked. ~~resolved~~
4. **`adfbh`** (31 KB HTML at root) is an earlier/duplicate copy of the admin dashboard — decide keep/drop in review. ~~resolved (dropped, Phase 4)~~
5. **`backend/requirements.txt` is UTF-16** — breaks `pip install` on Linux; convert to UTF-8 in a follow-up. ~~resolved~~
6. **Secret hygiene**: hardcoded Firebase Web API key in `functions/admin_api.js` — rotate the key; never commit `serviceAccountKey.json` or `.env` files. *(file deleted; rotation open)*
