# DEVELOPMENT.md — Local Development Setup

> Update this file when scaffold, commands, or configuration changes.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Backend |
| Node.js | 20+ | Frontend |
| npm | 10+ | Frontend package manager |
| PostgreSQL | 15+ | Database |
| Git | any recent | Version control |

Optional but recommended:
- `pyenv` for Python version management
- `nvm` for Node.js version management
- Docker (for PostgreSQL, if preferred over direct install)

---

## Repository Structure

```
/
├── frontend/       — Next.js (TypeScript) app
├── backend/        — FastAPI (Python) app
├── docs/           — Technical documentation
└── memory/         — AI agent persistent memory
```

---

## Database Setup

### Option A: Direct PostgreSQL Install (Linux)

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER grievance_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE grievance_db OWNER grievance_user;"
sudo -u postgres psql -d grievance_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Option B: Docker

```bash
docker run -d \
  --name grievance-postgres \
  -e POSTGRES_DB=grievance_db \
  -e POSTGRES_USER=grievance_user \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  ankane/pgvector:latest
```

*Using `ankane/pgvector` image which includes the pgvector extension.*

---

## Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in your values

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

Backend API available at: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs` (Swagger UI)
Alternative docs: `http://localhost:8000/redoc`

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

```env
# Database
DATABASE_URL=postgresql+asyncpg://grievance_user:yourpassword@localhost:5432/grievance_db

# JWT
JWT_SECRET_KEY=your-secret-key-here-use-openssl-rand-hex-32
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# LLM API
LLM_API_KEY=your-llm-api-key
LLM_API_BASE_URL=https://api.openai.com/v1  # or your chosen provider

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# App
DEBUG=true
APP_ENV=development
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

> Generate a JWT secret: `openssl rand -hex 32`
> Generate a NextAuth secret: `openssl rand -base64 32`

---

## Database Migrations

```bash
cd backend
source venv/bin/activate

# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "add_grievance_embeddings_table"

# Downgrade one step (use with caution)
alembic downgrade -1

# View migration history
alembic history

# View current revision
alembic current
```

---

## Development Commands

### Backend

| Command | Description |
|---|---|
| `uvicorn app.main:app --reload` | Start dev server with hot reload |
| `pytest` | Run all tests |
| `pytest tests/test_auth.py` | Run specific test file |
| `pytest -v` | Verbose test output |
| `alembic upgrade head` | Apply migrations |
| `alembic revision --autogenerate -m "..."` | Create migration |
| `python -m ruff check app/` | Lint with Ruff |
| `python -m ruff format app/` | Format with Ruff |

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
- FastAPI routers in `app/routers/` — one file per domain
- Business logic in `app/services/` — not in routers
- SQLAlchemy models in `app/models/`
- Pydantic schemas in `app/schemas/`
- AI modules in `app/ai/` — one file per AI module
- No hardcoded configuration values — use `app/config.py` via pydantic-settings

### Frontend (TypeScript)

- Strict TypeScript (`strict: true` in tsconfig)
- React Server Components by default; use `"use client"` only when needed
- Shared types in `lib/types.ts`
- API calls centralized in `lib/api.ts`
- Component files: `PascalCase.tsx`
- Utility files: `camelCase.ts`

---

## Common Issues

**pgvector extension not found:**
```
Make sure you're using PostgreSQL with pgvector installed.
Run: CREATE EXTENSION IF NOT EXISTS vector;
Or use the ankane/pgvector Docker image.
```

**Alembic can't find models:**
```
Ensure all SQLAlchemy models are imported in alembic/env.py
before target_metadata is referenced.
```

**CORS error from frontend:**
```
Check ALLOWED_ORIGINS in backend .env matches the frontend origin exactly.
```

**Google OAuth callback fails:**
```
Verify NEXTAUTH_URL in frontend .env.local and that the callback URL
is registered in Google Cloud Console:
http://localhost:3000/api/auth/callback/google
```
