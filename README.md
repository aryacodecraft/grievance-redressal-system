# AI-Enabled Grievance Redressal and Decision Support System

B.Tech academic research prototype. AI acts as a **decision-support mechanism** —
humans retain final control over assignment, escalation, resolution, and closure.

> **Scope source of truth:** [`PRD.md`](PRD.md), [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).
> **Agent operating rules:** [`AGENTS.md`](AGENTS.md) (mandatory read before contributing).
> **Unification source map:** [`INTEGRATION.md`](INTEGRATION.md).

---

## Repository layout

| Path | What it is | Status |
|---|---|---|
| `backend/app/` | **Serving backend** — FastAPI + ML classifiers (HF zero-shot → Groq → keyword fallback), image validation, Cloudinary signing (DEC-010) | Working |
| `tools/recategorize.py` | Batch re-classification over MongoDB | Working |
| `frontend/` | Next.js 16 + TypeScript + Tailwind CSS v4 — REST client, demo auth, admin + citizen views | Working (wired to `backend/app`) |
| `docs/` | Technical specs (see note below) | Reference |
| `memory/` | AI-agent persistent memory (state, decisions, backlog, logs) | Maintained |

**Stack:** Next.js 16 (TypeScript) frontend ↔ FastAPI backend ↔ MongoDB
(DEC-010, DEC-011). `docs/` files are aligned with this stack as of
2026-09-11 (see `AGENTS.md` for the full table).

---

## Quickstart

> Full walkthrough (tests, troubleshooting, commands): [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

### Backend (FastAPI, port `10000`)

All commands run from the **repository root** — `backend.app` only resolves as
a package from there.

```bash
python3 -m venv venv                     # see note below — do NOT skip this
venv/bin/pip install -r requirements.txt         # runtime — what Render installs
venv/bin/pip install -r requirements-dev.txt     # runtime + pytest (local dev/tests)
cp backend/.env.example backend/.env             # then set values; never commit .env
venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 10000
```

> **Why the virtualenv is not optional:** on most Linux distros the system
> Python is marked `EXTERNALLY-MANAGED` (PEP 668), so a bare
> `pip install -r requirements.txt` fails with
> `error: externally-managed-environment`. And `uvicorn` is only on `PATH`
> *inside* the venv — invoking it bare gives `command not found: uvicorn`.
> If you prefer activating the venv instead, `source venv/bin/activate` and
> then plain `pip`/`uvicorn` work as written elsewhere in the docs.
>
> `venv/` is gitignored, so a fresh clone never has it.

Environment: `MONGODB_URI`/`MONGODB_DB` (MongoDB Atlas — **without it the API
runs on a non-persistent in-memory fallback**; `GET /health` reports which),
`GROQ_API_KEY`, `HF_API_TOKEN`, Cloudinary vars. Swagger UI at `/docs`.

Endpoints: `POST /submit-grievance`, `GET /grievances`,
`GET /grievances/{id}`, `PATCH /grievances/{id}/status`, `POST /validate-image`,
`POST /sign-cloudinary`, `POST /delete-cloudinary`, `GET /health`.

### Frontend (Next.js, port `3000`)

```bash
cd frontend
cp .env.example .env.local   # skip if .env.local already exists; never commit it
npm install
npm run dev                  # or: npm run build && npm start
```

> **Mock mode is the default and catches everyone.** `useMocks()` returns
> `true` unless `NEXT_PUBLIC_USE_MOCKS` is exactly `"false"`, so out of the box
> the UI serves demo data and **never calls your backend** — submissions,
> tracking and the admin board all look broken. For live data set
> `NEXT_PUBLIC_USE_MOCKS=false` in `frontend/.env.local`.
>
> `NEXT_PUBLIC_*` values are inlined when the dev server **starts**: you must
> restart `npm run dev` after editing `.env.local`, or you stay in mock mode.
> `NEXT_PUBLIC_API_URL=http://localhost:10000` already matches the backend.

---

## Branch strategy

- `main` — stable. Do not push experiments here.
- `feature/unified-system` — this branch: unification + migration Phases 1–4.

## Key decisions

- **DEC-010** (`memory/DECISIONS.md`): FastAPI `backend/app/` is the serving
  path; the legacy Flask `backend/server.py` was retired.
- **DEC-011**: MongoDB replaces Firestore; Firebase config files deleted.
- **Human-in-the-loop** (non-negotiable): AI recommends, humans decide.

## Follow-ups (see `memory/TODO.md`)

1. Owner: create the MongoDB Atlas cluster + set `MONGODB_URI` in `backend/.env`.
2. Phase 5 docs alignment (this README, `AGENTS.md`, `docs/*`).
3. Phase 6 verification: pytest suite + end-to-end check.
4. Rotate the hardcoded Firebase Web API key — it is still in git history,
   so rotation is mandatory even though the file is deleted.
