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
| `backend/server.py` | **Authoritative backend** — Flask + ML classifiers (HF zero-shot → Groq → keyword fallback), image validation, Cloudinary signing | Working (see DEC-008) |
| `tools/recategorize.py` | Batch re-classification over Firestore | Working |
| `functions/` | Client-side TF-IDF similarity (`tfidf.js`) + legacy admin UI (HTML/JS) | Working (legacy UI) |
| `frontend/` | Next.js 16 + TypeScript + Tailwind CSS v4 scaffold | Scaffold only — not yet wired to backend |
| `docs/` | Technical specs (partly reference-only, see note below) | Reference |
| `memory/` | AI-agent persistent memory (state, decisions, backlog, logs) | Maintained |
| `firebase.json`, `.firebaserc`, `firestore.*` | Firestore persistence | Temporary (removal is a planned follow-up) |

**Stale-docs warning:** `docs/DATABASE.md` and `docs/API.md` still describe the
discarded FastAPI/PostgreSQL design — treat as reference only until rewritten
against the Flask backend (DEC-008). Likewise the `AGENTS.md` stack table
(FastAPI/PostgreSQL) contradicts DEC-008 and awaits owner confirmation.

---

## Quickstart

### Backend (Flask, port `10000`)

```bash
pip install -r requirements.txt          # root reqs (deploy)
pip install -r backend/requirements.txt # service reqs (note: file is UTF-16 — convert to UTF-8 if pip chokes)
python backend/server.py
# or: gunicorn -w 2 -b 0.0.0.0:10000 backend.server:app
```

Required env vars: `GROQ_API_KEY`, `HF_API_TOKEN`, Cloudinary vars,
`FIREBASE_SERVICE_ACCOUNT` (Firestore, temporary). Health check: `GET /health`.

Endpoints: `POST /submit-grievance`, `POST /validate-image`,
`POST /sign-cloudinary`, `POST /delete-cloudinary`, `GET /health`, `GET /test`.

### Frontend (Next.js, port `3000`)

```bash
cd frontend
cp .env.example .env.local   # then set values; never commit .env.local
npm install
npm run dev                  # or: npm run build && npm start
```

> **Port mismatch (known):** `frontend/.env.example` points at
> `NEXT_PUBLIC_API_URL=http://localhost:8000`, but the Flask backend serves on
> `:10000`. Rewiring the frontend to the Flask API contract is a follow-up task.

---

## Branch strategy

- `main` — stable. Do not push experiments here.
- `feature/unified-system` — this unification baseline.
- Real frontend work happens on a separate branch (e.g. `feature/frontend`).

## Key decisions

- **DEC-008** (`memory/DECISIONS.md`): Flask backend is authoritative; FastAPI
  scaffold discarded; Firestore kept temporarily; Firebase removal is a
  follow-up branch.
- **Human-in-the-loop** (non-negotiable): AI recommends, humans decide.

## Follow-ups (see `memory/TODO.md`)

1. Owner confirms canonical backend/DB/auth stack.
2. Firebase-removal + persistence replacement (separate branch).
3. Wire Next.js frontend to Flask backend (port + API contract).
4. Hygiene: binary `.gitignore`, committed `__pycache__/`, UTF-16 requirements,
   unidentified `adfbh`, hardcoded Firebase key rotation.
