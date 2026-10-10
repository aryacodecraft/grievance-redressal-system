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
# 1. (Optional) Create and activate virtual environment:
python -m venv venv
# Linux/macOS (Bash/Zsh): source venv/bin/activate
# Linux (Fish):          source venv/bin/activate.fish
# Windows (PowerShell):  .\venv\Scripts\Activate.ps1
# Windows (cmd.exe):     venv\Scripts\activate.bat
# (Skip venv creation if using Conda, Docker, or system Python)

# 2. Install dependencies
pip install -r requirements.txt          # runtime — what Render installs
pip install -r requirements-dev.txt      # runtime + pytest (local dev/tests)

# 2b. (Optional) face-auth stack — only needed to run with FACE_AUTH_ENABLED=true
pip install -r requirements-face.txt     # insightface, onnxruntime, opencv-python-headless

# 3. Configure environment
cp backend/.env.example backend/.env    # Windows PowerShell: Copy-Item backend\.env.example backend\.env
# Edit backend/.env and fill in your values (or leave blank to use in-memory mode)

# 4. Start development server (universal python -m runner)
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 10000
```

Backend API available at: `http://localhost:10000`
Interactive docs: `http://localhost:10000/docs` (Swagger UI)
Alternative docs: `http://localhost:10000/redoc`

### Phone OTP and SMS prototype

The default `SMS_PROVIDER=dry-run` sends no external messages. To exercise
phone binding locally, set `OTP_DEBUG_RETURN_CODE=true` in the local
`backend/.env`; the authenticated OTP request returns a demo code in its JSON
response. Keep this false outside local testing. `SMS_PROVIDER=off` disables
stage dispatch entirely. Twilio delivery is not implemented; it will require
credentials, Indian DLT entity/header/template registration, and carrier-level
validation before it can be enabled.

> Run `uvicorn` from the **repository root** (not from inside `backend/`) so
> that `backend.app` resolves as a package.

---

## Running Tests

```bash
# From the repository root
pip install -r requirements-dev.txt
pytest                      # all tests
pytest tests/test_endpoints.py -v
```

The suite has grown well past its original nine files; the face-auth suite is
the newest addition:

| File | Covers |
|---|---|
| `tests/test_classification.py` | Keyword classifier, priority/urgency rules, sentiment normalisation, and the `CATEGORY_KEYS` ↔ frontend `CATEGORIES` contract |
| `tests/test_classification_cascade.py` | The HF → Groq → keyword cascade, including provider-outage fallback and the submit-time `modelInfo` shape |
| `tests/test_config_drift.py` | Drift between `config.py`, `backend/.env.example`, `frontend/.env.example` and `render.yaml` — plus secret-leak and wildcard-CORS checks |
| `tests/test_endpoints.py` | HTTP behaviour of the real FastAPI app (request/response shapes, status codes, error format, limit bounds, unicode/injection round-trips) |
| `tests/test_face_auth.py` | Face auth (DEC-024): liveness/quality units, endpoints, pending-token step-up, lockouts, MODEL_MISMATCH, tunable thresholds — synthetic frames + a fake detection seam, no camera or model download |
| `tests/test_id_allocation.py` | DEC-014: ids derived from stored data — restart resumption, year rollover, out-of-order ids, concurrent creates |
| `tests/test_image_validation.py` | `/validate-image` contract and the accept/reject threshold boundary, plus the (documented) SSRF surface |
| `tests/test_repository.py` | Both `GrievanceRepository` implementations + repository selection + the shared list contract |
| `tests/test_security_baseline.py` | **Asserts current insecure behaviour on purpose** — the "before" state Phase 1 must invert |
| `tests/test_status_vocabularies.py` | The four conflicting status vocabularies DEC-006 must migrate together, parsed from source |

Tests named `test_BASELINE_*` document a known gap rather than a requirement:
they pass today and are meant to **fail** once the corresponding phase lands,
which is the signal to rewrite them as assertions of the new behaviour.

**Endpoint and in-memory tests always run** — `tests/conftest.py` pins
`MONGODB_URI=""` (and disables LLM keys) before `backend.app` is imported, so
they never touch a real database or the network.

**MongoDB tests skip unless a test database is reachable.** They default to
`mongodb://127.0.0.1:27017` and drop their collection before/after each test:

```bash
mongod --dbpath /path/to/scratch --port 27017 --fork --logpath /tmp/mongod.log
pytest                                  # Mongo tests now run
mongod --dbpath /path/to/scratch --shutdown
```

Override with `TEST_MONGODB_URI` / `TEST_MONGODB_DB` to point elsewhere.

### End-to-end check (frontend client ↔ live backend)

```bash
# terminal 1 — backend (with or without MONGODB_URI)
uvicorn backend.app.main:app --host 127.0.0.1 --port 10000

# terminal 2 — the real frontend API client against it
NEXT_PUBLIC_API_URL=http://localhost:10000 node frontend/scripts/e2e.mjs
```

`frontend/scripts/e2e.mjs` imports `frontend/lib/api.ts` itself, so every
response is validated by the same zod schemas the UI uses — submit → track →
admin assign/resolve → re-read. It needs **Node 23.6+** (TypeScript type
stripping is on by default there — earlier versions need
`--experimental-strip-types`) and a backend already running; it is **not** part
of `pytest`.

### Contract checks (frontend only — no backend needed)

```bash
node frontend/scripts/check-contract.mjs
```

Stubs `fetch` rather than calling anything, so it runs offline and gates CI.
It pins `roleForEmail` / `isAdminEmail` (including the deliberate `BASELINE`
escalation that Phase 1 must remove), the `useMocks()` switch — which turns
mocks off **only** for the exact string `"false"`, so `"FALSE"` or `0` silently
serves fabricated data — and the zod schemas against backend-shaped JSON.

That last part matters because `z.object()` strips undeclared keys without
failing: a field the backend sends but the schema omits parses cleanly and
then simply never reaches the UI. `hfEngine.categoryConfidence` shipped that
way for a while — live data lost the confidence display that mock data kept.

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

# Face auth (optional, DEC-024 — off by default; see backend/.env.example)
FACE_AUTH_ENABLED=false
# FACE_EMBED_KEY (required when the flag is on), FACE_MODEL_NAME,
# FACE_MATCH_THRESHOLD, and the tunable liveness thresholds
# (FACE_TURN_MIN_DEGREES, FACE_BLINK_EAR_DROP, FACE_SMILE_MOUTH_WIDEN,
#  FACE_MIN_BLUR_VARIANCE, FACE_MIN_FACE_PX) are documented in .env.example
```

> JWT auth (DEC-017) reads `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
> `REFRESH_TOKEN_EXPIRE_DAYS` and the seed/Google OAuth vars from
> `backend/.env` — see `backend/.env.example`.

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
