# AGENTS.md — Mandatory AI Agent Operating Rules

> **This file contains mandatory instructions for ANY AI coding agent working on this repository.**
> Read this file completely before touching any code.

---

## Mandatory Memory Protocol

### AT THE START OF EVERY SESSION

1. Read this file (`AGENTS.md`)
2. Read `memory/README.md`
3. Read `memory/PROJECT_STATE.md`
4. Read `memory/DECISIONS.md`
5. Read `memory/TODO.md`
6. Read the latest relevant entries in `memory/SESSION_LOG.md`
7. Read relevant technical documentation in `docs/` for the task at hand
8. Inspect the actual source files affected by the requested task

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
| `memory/PROJECT_STATE.md` | Implementation state changed |
| `memory/DECISIONS.md` | Architectural decision made |
| `memory/CHANGELOG.md` | Any meaningful change — always |
| `memory/TODO.md` | Tasks completed, new tasks discovered |
| `memory/SESSION_LOG.md` | Every session — append new entry |

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
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Auth | JWT + Google OAuth 2.0 + RBAC |
| AI/NLP | LLM API, Hugging Face Transformers, Sentence Transformers |
| ML | PyTorch, Scikit-learn |
| Visualization | Chart.js / Recharts |

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
- `memory/PROJECT_STATE.md`
- `memory/TODO.md`
- `memory/SESSION_LOG.md`
- `memory/DECISIONS.md`

---

## Do Not Destroy Context

Never replace useful documentation with a shorter generic version.
Prefer targeted edits over rewrites.
Preserve: historical decisions, useful explanations, unresolved questions, previous session context.
Do not delete memory history to make files "cleaner."

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
