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
| `backend/app/` | **Serving backend** — FastAPI + ML classifiers (HF zero-shot → Groq → keyword fallback), image validation, Cloudinary signing, JWT Auth & RBAC (DEC-010, DEC-017) | Working |
| `tools/recategorize.py` | Batch re-classification over MongoDB | Working |
| `frontend/` | Next.js 16 + TypeScript + Tailwind CSS v4 — REST client, auth flows, admin + citizen portals | Working (wired to `backend/app`) |
| `docs/` | Technical specs and architecture references | Reference |
| `memory/` | AI-agent persistent memory (state, decisions, backlog, logs) | Maintained |

**Stack:** Next.js 16 (TypeScript) frontend ↔ FastAPI backend ↔ MongoDB
(DEC-010, DEC-011). Full specifications are detailed in `docs/` and `AGENTS.md`.

---

## Universal Local Setup Guide

Follow these steps to run both the backend and frontend on your machine. This guide covers **Windows (PowerShell / Command Prompt)**, **macOS**, and **Linux (Bash / Zsh / Fish)**.

### Prerequisites

| Requirement | Recommended Version | Notes |
|---|---|---|
| **Python** | 3.11 – 3.14 | Ensure Python is added to your system `PATH`. |
| **Node.js** | 20+ (LTS recommended) | Includes `npm`. |
| **MongoDB** | Atlas cluster or local (v7+) | *Optional for quick dev*: the backend runs an in-memory database if no URI is supplied. |

---

### Step 1: Backend Setup (FastAPI on port `10000`)

> ⚠️ **Important:** Always execute backend and test commands from the **root of the repository** (where this `README.md` is located), so Python can resolve `backend.app` as a package.

#### 1. (Optional but recommended) Set up a Python environment

If you use a virtual environment (`venv`) to keep dependencies isolated:

<details open>
<summary><b>Choose your operating system & shell</b></summary>

- **Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
  *(If PowerShell displays an execution policy error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first).*

- **Windows (Command Prompt / cmd.exe)**:
  ```cmd
  python -m venv venv
  venv\Scripts\activate.bat
  ```

- **Linux / macOS (Bash / Zsh)**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

- **Linux (Fish Shell)**:
  ```fish
  python3 -m venv venv
  source venv/bin/activate.fish
  ```

</details>

> **Note for Conda, Docker, or system-wide Python users:**  
> If you prefer not to use `venv` (e.g. inside a Conda environment, dev container, or system installation), you can **skip creating a venv** and proceed directly to installing requirements.

#### 2. Install Python dependencies

Install runtime and development packages:

```bash
# Using pip with your active Python environment:
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

*(Or explicitly via `python -m pip install -r requirements-dev.txt`)*

#### 3. Configure backend environment variables

Create your local `.env` file from the provided example template:

- **Linux / macOS / Git Bash**:
  ```bash
  cp backend/.env.example backend/.env
  ```
- **Windows (PowerShell)**:
  ```powershell
  Copy-Item backend\.env.example backend\.env
  ```
- **Windows (cmd.exe)**:
  ```cmd
  copy backend\.env.example backend\.env
  ```

**Key environment settings in `backend/.env`:**
- `MONGODB_URI`: Connection string to MongoDB Atlas or local MongoDB. If left empty, the server automatically boots using an **in-memory mock store** (great for instant local testing).
- `JWT_SECRET_KEY`: Secret string for signing auth tokens (defaults to a dev fallback if empty).
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: Default admin credentials seeded automatically on startup:
  - **Email:** `admin@grievance.local`
  - **Password:** `Admin@2026!`

#### 4. Start the backend server

Run via the Python module runner so it works universally regardless of shell path:

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 10000 --reload
```

- **API Base:** `http://127.0.0.1:10000`
- **Interactive API Docs (Swagger UI):** `http://127.0.0.1:10000/docs`
- **Health Check:** `http://127.0.0.1:10000/health` (indicates whether storage is `mongodb` or `in-memory`)

---

### Step 2: Frontend Setup (Next.js on port `3000`)

Open a separate terminal window and navigate into the `frontend` folder:

```bash
cd frontend
```

#### 1. Configure frontend environment variables

- **Linux / macOS / Git Bash**:
  ```bash
  cp .env.example .env.local
  ```
- **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env.local
  ```
- **Windows (cmd.exe)**:
  ```cmd
  copy .env.example .env.local
  ```

> ⚡ **Connecting to the live backend vs. mock mode:**  
> By default, `NEXT_PUBLIC_USE_MOCKS` in `.env.local` controls data mode:
> - **Live backend mode (Recommended):** Set `NEXT_PUBLIC_USE_MOCKS=false`. The frontend will make real API calls to `http://localhost:10000`.
> - **Standalone mock mode:** Set `NEXT_PUBLIC_USE_MOCKS=true`. The frontend will operate in offline demo mode using sample data without contacting the backend.
>
> *Note:* Next.js reads `NEXT_PUBLIC_*` variables at server startup. Always restart `npm run dev` after changing `.env.local`.

#### 2. Install dependencies & launch dev server

```bash
npm install
npm run dev
```

Open your browser to:
👉 **`http://localhost:3000`**

- **Register complaints:** `/submit`
- **Track grievance status:** `/track`
- **Admin triage & control center:** `/admin` (strictly restricted to Admin accounts)
- **Sign in / Sign up:** `/login` & `/register`

---

## Pre-Seeded Test Accounts

The backend seeds ready-to-use testing accounts on startup (existing emails are
left untouched):

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Citizen** (Standard User) | `citizen@grievance.local` | `Citizen@2026!` | Citizen portal access: `/submit` complaint registration, personal complaint tracking sidebar, `/track` lookup. Cannot access `/admin`. |
| **Admin** (Municipal Officer) | `admin@grievance.local` | `Admin@2026!` | Full administrative access: `/admin` triage board, cluster maps, category/priority review, and officer assignment/status updates. |
| **Superadmin** (System Owner) | `superadmin@grievance.local` | `SuperAdmin@2026!` | System control: admin/user management, role assignment, department management, audit trail. Seeded when `SEED_TEST_ACCOUNTS=true` (or via `SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD`). |

Department test accounts are seeded only when `SEED_TEST_ACCOUNTS=true` in
`backend/.env` (dev/testing only — keep `false` in production):

| Department | Manager (`ADMIN`) | Employee (`RESOLVER`) |
|---|---|---|
| Water | `water.manager@grievance.local` | `water.employee@grievance.local` |
| Roads | `roads.manager@grievance.local` | `roads.employee@grievance.local` |
| Transport | `transport.manager@grievance.local` | `transport.employee@grievance.local` |
| Electricity | `electricity.manager@grievance.local` | `electricity.employee@grievance.local` |
| Sanitation | `sanitation.manager@grievance.local` | `sanitation.employee@grievance.local` |
| Health | `health.manager@grievance.local` | `health.employee@grievance.local` |
| Governance | `governance.manager@grievance.local` | `governance.employee@grievance.local` |
| Other | `other.manager@grievance.local` | `other.employee@grievance.local` |

- Manager password: `Manager@2026!` — Employee password: `Resolver@2026!`
  (unless `SEED_TEST_PASSWORD` overrides both).
- Managers see their department queue and assign work; employees see only
  tickets assigned to them (`ownerId`).

> 💡 **Tip:** Set `NEXT_PUBLIC_SHOW_DEV_CREDS=true` in `frontend/.env.local`
> and open `/login` — the dev box lists every account above with one-click
> **Autofill**. Never enable that flag in production.
>
> You can also register any new citizen account on `/register` (minimum 8-character password).

---

## Running Automated Tests

Run backend tests from the **repository root**:

```bash
# Run the test suite:
python -m pytest

# Run with verbose output:
python -m pytest -v

# Run only authentication & RBAC tests:
python -m pytest tests/test_auth.py -v
```

Verify frontend build integrity:

```bash
npm --prefix frontend run build
```

---

## Branch strategy

- `main` — stable. Do not push experiments here.
- `feature/unified-system` — active development: unification, auth/RBAC, and UI overhaul.

## Key decisions

- **DEC-010** (`memory/DECISIONS.md`): FastAPI `backend/app/` is the active serving backend.
- **DEC-011**: MongoDB is the primary database.
- **DEC-017**: Cryptographic JWT authentication, role-based access control (RBAC), and Google OAuth support.
- **Human-in-the-loop** (non-negotiable): AI provides advisory triage, human officers make all administrative decisions.
