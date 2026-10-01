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

### Backend (FastAPI, port `10000`)

```bash
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then set values; never commit .env
uvicorn backend.app.main:app --host 0.0.0.0 --port 10000
```

Environment: `MONGODB_URI`/`MONGODB_DB` (MongoDB Atlas — **without it the API
runs on a non-persistent in-memory fallback**; `GET /health` reports which),
`GROQ_API_KEY`, `HF_API_TOKEN`, Cloudinary vars. Swagger UI at `/docs`.

Endpoints: `POST /submit-grievance`, `GET /grievances`,
`GET /grievances/{id}`, `PATCH /grievances/{id}/status`, `POST /validate-image`,
`POST /sign-cloudinary`, `POST /delete-cloudinary`, `GET /health`.

### Frontend (Next.js, port `3000`)

```bash
cd frontend
cp .env.example .env.local   # then set values; never commit .env.local
npm install
npm run dev                  # or: npm run build && npm start
```

> `frontend/.env.example` points at `NEXT_PUBLIC_API_URL=http://localhost:10000`,
> matching the backend. `NEXT_PUBLIC_USE_MOCKS=true` (default) explores the UI
> without a backend; set it to `false` for live data.

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
