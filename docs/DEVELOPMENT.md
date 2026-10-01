# DEVELOPMENT.md — Local Development Setup

> Update this file when scaffold, commands, or configuration changes.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Backend |
| Node.js | 20+ | Frontend |
| npm | 10+ | Frontend package manager |
| MongoDB | 7+ (or an Atlas free cluster) | Database |
| Git | any recent | Version control |

Optional but recommended:
- `pyenv` for Python version management
- `nvm` for Node.js version management
- Docker (for a local MongoDB, if preferred over Atlas)

---

## Repository Structure

```
/
├── frontend/       — Next.js (TypeScript) app
├── backend/app/    — FastAPI (Python) app
├── tools/          — batch recategorization script
├── docs/           — Technical documentation
└── memory/         — AI agent persistent memory
```

---

## Database Setup

The backend needs `MONGODB_URI` to persist data. **Without it the API still
boots** and uses a non-persistent in-memory store — `GET /health` tells you
which is active (`"storage": "mongodb"` or `"in-memory"`).

### Option A: MongoDB Atlas (recommended, free tier)

1. Atlas → Database → Add → Free (M0) → Connect → Drivers → copy the URI.
2. Put it in `backend/.env` (see below). The `grievances` collection and its
   indexes are created automatically on first boot.

### Option B: Local MongoDB (Docker)

```bash
docker run -d --name grievance-mongo -p 27017:27017 mongo:7
# then: MONGODB_URI=mongodb://localhost:27017
```

### Option C: Local MongoDB (system package)

```bash
mongod --dbpath /path/to/data --port 27017
```

**No migrations** — MongoDB is schemaless; the indexes (`uniq_grievance_id`,
`user_created`) are created at startup by `backend/app/db.py`.

---

## Backend Setup

```bash
# From the repository root
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your values (MONGODB_URI at minimum)

# Start development server
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 10000
```

Backend API available at: `http://localhost:10000`
Interactive docs: `http://localhost:10000/docs` (Swagger UI)
Alternative docs: `http://localhost:10000/redoc`

> Run `uvicorn` from the **repository root** (not from inside `backend/`) so
> that `backend.app` resolves as a package.

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and fill in your values

# Start development server
npm run dev
```

Frontend available at: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

See `backend/.env.example` for the authoritative list. The ones that matter
day-to-day:

```env
# Database (leave empty to use the non-persistent in-memory fallback)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DB=grievance

# LLM classification (optional — keyword rules are used without them)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
HF_API_TOKEN=

# CORS
CORS_ORIGINS=http://localhost:3000

# Server
PORT=10000
```

> JWT / Google OAuth vars are **not yet read by the backend** — real auth is
> still a planned feature (see `docs/SECURITY.md`).

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:10000
NEXT_PUBLIC_USE_MOCKS=true        # false = talk to the live backend
NEXT_PUBLIC_SHOW_DEV_CREDS=false  # local only, never enable in production
```

> NextAuth / Google OAuth vars were removed along with the Firebase client —
> auth is a demo/localStorage session for now.

---

## Schema Changes

There is **no migration tool** — MongoDB is schemaless. To change the shape of
a grievance:

1. Update `backend/app/models.py` (Pydantic) and `backend/app/db.py`.
2. Existing documents keep their old shape; read paths should tolerate missing
   fields (`to_api()` in `db.py` already defaults them).
3. If an index needs to change, drop/recreate it in `ensure_indexes()`
   (`backend/app/db.py`).

For a one-off data fix, use `tools/recategorize.py --dry-run` first, then drop
`--dry-run` to apply.

---

## Development Commands

### Backend

| Command | Description |
|---|---|
| `uvicorn backend.app.main:app --reload --port 10000` | Start dev server with hot reload (from repo root) |
| `pytest` | Run all tests (from repo root) |
| `pytest tests/test_endpoints.py -v` | Run specific test file |
| `python tools/recategorize.py --dry-run` | Preview batch re-classification |
| `python -m ruff check backend/app/` | Lint with Ruff |
| `python -m ruff format backend/app/` | Format with Ruff |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production build |
| `npm run test` | Run tests |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type check |

---

## Git Workflow

1. Work on feature branches: `git checkout -b feature/phase-1-scaffold`
2. Commit meaningful units of work with clear messages
3. Never commit to `main` directly without review
4. Update `memory/` files as part of the feature branch (not as a separate commit)
5. PR description should reference relevant PRD requirement IDs (e.g., `FR-AUTH-001`)

---

## Conventions

### Backend (Python)

- Follow PEP 8 / Ruff defaults
- Use type hints throughout
- FastAPI routers in `backend/app/routers/` — one file per domain
- Business logic in `backend/app/services/` — not in routers
- Pydantic request/response models in `backend/app/models.py`
- Persistence behind the `GrievanceRepository` protocol in `backend/app/db.py`
- No hardcoded configuration values — read them in `backend/app/config.py` via
  `python-dotenv`

### Frontend (TypeScript)

- Strict TypeScript (`strict: true` in tsconfig)
- React Server Components by default; use `"use client"` only when needed
- Shared types in `lib/types.ts`
- API calls centralized in `lib/api.ts`
- Component files: `PascalCase.tsx`
- Utility files: `camelCase.ts`

---

## Common Issues

**`"storage": "in-memory"` in `/health`:**
```
MONGODB_URI is empty or unreachable. Set it in backend/.env and restart.
Data written while in-memory is lost on restart.
```

**MongoDB index/ping failed at startup:**
```
The URI is set but the cluster isn't reachable (network, IP allowlist, or
bad credentials). The API will error on reads/writes until it connects.
```

**CORS error from frontend:**
```
Check CORS_ORIGINS in backend/.env matches the frontend origin exactly
(default: http://localhost:3000).
```

**Frontend shows demo data instead of live data:**
```
NEXT_PUBLIC_USE_MOCKS must be "false" in frontend/.env.local, and the backend
must be running on :10000. Check the error banner in the UI.
```

**`ModuleNotFoundError: No module named 'backend'`:**
```
Run uvicorn from the repository root, not from inside backend/.
```
