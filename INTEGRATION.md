# INTEGRATION.md — Unified Repo Source Map (`feature/unified-system`)

> Created: 2026-09-11. Branch `feature/unified-system` based off `app/intialise`
> (note: branch name typo `intialise` is pre-existing; left as-is).
> Target merge path: `feature/unified-system` → `app/intialise` → `main`.

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

1. **Port mismatch**: `frontend/.env.example` → `:8000`; Flask backend → `:10000`.
2. **`Idea Lab2/.gitignore` reads as binary** (`file` reports `data`) — needs rewrite as UTF-8 text; verify `serviceAccountKey.json`, `.env`, `venv/`, `node_modules/` are ignored.
3. **Committed `__pycache__/`** (`backend/__pycache__/`, `tools/__pycache__/`) — should be untracked.
4. **`adfbh`** (31 KB HTML at root) is an earlier/duplicate copy of the admin dashboard — decide keep/drop in review.
5. **`backend/requirements.txt` is UTF-16** — breaks `pip install` on Linux; convert to UTF-8 in a follow-up.
6. **Secret hygiene**: hardcoded Firebase Web API key in `functions/admin_api.js` — rotate the key; never commit `serviceAccountKey.json` or `.env` files.
