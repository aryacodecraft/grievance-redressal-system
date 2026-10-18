# AGENTS.md — Mandatory AI Agent Operating Rules

> **This file contains mandatory instructions for ANY AI coding agent working on this repository.**
> Read this file completely before touching any code.

---

## Mandatory Memory Protocol

### AT THE START OF EVERY SESSION

1. Read this file (`AGENTS.md`)
2. Read `memory/README.md`
3. Read `memory/CURRENT_STATE.md` (current state + remaining work — the single entry point)
4. Read `memory/DECISIONS.md` (grep for the decisions relevant to the task; full read only when making decisions)
5. Read the latest relevant entries in `memory/CHANGELOG.md` and `memory/SESSION_LOG.md` (rolling files; older history in `memory/archive/`)
6. Read relevant technical documentation in `docs/` for the task at hand
7. Inspect the actual source files affected by the requested task

**Do not begin implementation based solely on the user's latest prompt.**
Understand the existing project state first.

---

### BEFORE MAKING CHANGES

Determine:

- What currently exists in the codebase
- What is actually implemented vs. what is only planned
- Relevant architectural decisions (see `memory/DECISIONS.md`)
- Relevant database schema and API contracts
- Dependencies on other modules
- Whether the requested change conflicts with documented scope

**Search first. Never assume a feature does not exist because you haven't seen it.**

Inspect: repository tree, relevant source files, imports, schemas, migrations,
API routes, services, tests, documentation, memory.

---

### DURING THE TASK

- Follow existing architecture unless the task explicitly changes it
- Do not silently introduce competing patterns alongside existing ones
- Maintain compatibility with existing interfaces where reasonable
- Document meaningful architectural decisions in `memory/DECISIONS.md`
- Distinguish temporary workarounds from intended architecture (add a comment)
- Keep documentation synchronized with code changes

---

### AFTER EVERY MEANINGFUL TASK

Update project memory. Evaluate whether updates are needed to:

| File | Update When |
|---|---|
| `memory/CURRENT_STATE.md` | Implementation state or remaining-work list changed |
| `memory/DECISIONS.md` | Architectural decision made |
| `memory/CHANGELOG.md` | Any meaningful change — always (rolling; keep entries lean) |
| `memory/SESSION_LOG.md` | Every session — append entry (rolling; keep entries lean) |

> **Rolling logs (2026-10-18, DEC-037):** `CHANGELOG.md` and `SESSION_LOG.md` keep
> roughly the last two weeks (minimum ~10 entries). When appending, if the active
> file exceeds ~400 lines, rotate only the entries older than that two-week window
> — **unchanged** — into `memory/archive/<FILE>-<first>_to_<last>.md` (create or
> extend the archive file for the period) and update the pointer line at the top.
> Never rotate below the ~10-entry floor, and never edit or delete entries —
> rotation only relocates them. Keep new entries to what changed / what was
> verified / what was not / pointers to DEC or CURRENT_STATE items; process
> ceremony belongs in neither file.

If architecture changed → update `docs/ARCHITECTURE.md`
If database changed → update `docs/DATABASE.md`
If API contracts changed → update `docs/API.md`
If AI behavior changed → update `docs/AI_SYSTEM.md`
If workflows changed → update `docs/WORKFLOWS.md`
If setup/development changed → update `docs/DEVELOPMENT.md` and/or `README.md`

> **A task is not complete until relevant memory and documentation are updated.**

---

## Project Identity and Scope

**Project name:** AI-Enabled Grievance Redressal and Decision Support System
**Type:** B.Tech academic research prototype
**Source of truth:** [`PRD.md`](PRD.md), [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)

Do not silently expand the project beyond approved scope.

If an implementation decision is not defined in the approved documentation:
1. Identify that the decision is not explicitly defined
2. Choose a reasonable prototype-oriented solution
3. Document the decision in `memory/DECISIONS.md`
4. Make the decision reversible where practical

---

## Human-in-the-Loop Principle (Non-Negotiable)

AI is a **decision-support mechanism**, not an autonomous authority.

AI may: analyze, summarize, categorize, recommend, flag, estimate, detect patterns.

Humans retain final control over: assignment, reassignment, escalation,
resolution approval, and closure.

Do not implement AI as the final decision-maker on any administrative action
unless the decision is explicitly documented and approved.

---

## Technology Stack

Use the approved stack. Do not introduce new frameworks or languages without documenting the reason.

| Layer | Approved Technology |
|---|---|
| Frontend | Next.js (TypeScript) |
| Backend | FastAPI (Python) — `backend/app/` is the serving path (DEC-010) |
| Database | MongoDB (DEC-011; supersedes the original PostgreSQL plan in DEC-002) |
| Auth | JWT + Google OAuth 2.0 + RBAC *(implemented 2026-10-03 — DEC-017; the demo localStorage session remains only as the mock-mode fallback — see DEC-009)* |
| AI/NLP | LLM API, Hugging Face Transformers, Sentence Transformers |
| ML | PyTorch, Scikit-learn |
| Visualization | Chart.js / Recharts |

> **Stack note (2026-09-11):** rows above reflect the state after migration
> Phases 1–3 (owner approved executing the migration plan, which supersedes
> DEC-008).
> **Update (2026-10-18):** real auth (JWT + Google OAuth + RBAC) landed
> 2026-10-03 (DEC-017); the demo localStorage session now exists only as the
> mock-mode fallback.

Prefer TypeScript over plain JavaScript for all substantial frontend code.

---

## Implementation Status Terminology

Use these terms consistently and accurately:

| Term | Meaning |
|---|---|
| `PLANNED` | Defined but not implemented |
| `IN PROGRESS` | Started but incomplete |
| `IMPLEMENTED` | Code exists and basic integration works |
| `TESTED` | Implementation has passed defined tests |
| `VALIDATED` | Feature/AI module evaluated against its intended criteria |
| `DEFERRED` | Intentionally postponed |
| `OPTIONAL` | Not required for core prototype |

**Do not call something IMPLEMENTED merely because files for it exist.**

---

## AI Development Rules

### Do NOT use AI where deterministic logic is appropriate

Deterministic/backend logic is correct for:
- permissions and authorization
- status transition enforcement
- timestamps and audit logs
- exact SLA deadline calculations
- database integrity constraints

AI/ML is appropriate for uncertain semantic tasks:
- grievance understanding and summarization
- classification and entity extraction
- severity/priority interpretation
- semantic similarity
- assignment recommendation
- delay-risk estimation
- resolution quality assessment

### Dataset and Model Uncertainty

Do not assume datasets already exist.

When an AI feature depends on unavailable data, mark it clearly:
- `DATASET REQUIRED`
- `EXPERIMENTAL`
- `PROTOTYPE USING BASELINE/LLM`

Do not fabricate training results, model accuracy, evaluation metrics, or dataset characteristics.

---

## Auditability Requirements

Important grievance actions must be traceable. Preserve:

- Who performed the action
- What changed (previous value → new value)
- Timestamp
- Reason/comment
- Whether the action originated from human input or AI recommendation

AI recommendations must be distinguishable from final human decisions in the data model.

---

## Security Rules

- **Never** commit secrets, API keys, OAuth credentials, JWT secrets, or passwords
- Use environment variables; provide `.env.example`
- Enforce role-based authorization server-side (never trust client-side role claims)
- Validate all inputs server-side
- Validate all file attachments (type, size)

---

## Code Quality Rules

- Match the style, naming conventions, and idioms of the surrounding code
- No giant monolithic files — keep modules focused
- No hardcoded secrets
- No duplicate business logic across modules
- No unnecessary microservices or premature scaling
- No fabricated functionality (never claim a feature works unless verified)

---

## Handoff Standard

Every task must leave the repository in a state where another agent can continue
without asking "What were you doing?"

The next agent must be able to determine that from:
- `memory/CURRENT_STATE.md`
- `memory/SESSION_LOG.md` / `memory/CHANGELOG.md`
- `memory/DECISIONS.md`

---

## Do Not Destroy Context

Never replace useful documentation with a shorter generic version.
Prefer targeted edits over rewrites.
Preserve: historical decisions, useful explanations, unresolved questions, previous session context.
Do not delete memory history to make files "cleaner."

Long memory logs are rotated into `memory/archive/` when they grow (see the
rolling-logs rule above) — rotated entries are preserved verbatim, never
deleted or edited.

---

## Recommended Implementation Order

Unless project state suggests otherwise:

| Phase | Scope |
|---|---|
| PHASE 0 | Documentation + architecture (current) |
| PHASE 1 | Repository structure + environment scaffolding |
| PHASE 2 | PostgreSQL + core domain model + migrations |
| PHASE 3 | Authentication + RBAC |
| PHASE 4 | Basic grievance CRUD + lifecycle |
| PHASE 5 | User / resolver / admin interfaces |
| PHASE 6 | Basic grievance AI analysis (summarization, classification, severity) |
| PHASE 7 | Assignment recommendation |
| PHASE 8 | Related-grievance / similarity detection |
| PHASE 9 | Monitoring + SLA + escalation support |
| PHASE 10 | Resolution quality assessment |
| PHASE 11 | Analytics dashboard |
| PHASE 12 | Testing + AI evaluation + refinement |

Do not attempt sophisticated AI before the underlying grievance workflow and data model are stable.
