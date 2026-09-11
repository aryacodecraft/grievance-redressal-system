# TODO.md — Task Backlog

> Remove or mark tasks done when actually completed.
> Each task should be concrete and actionable.
>
> **2026-09-11 unification note (DEC-008):** tasks assuming the FastAPI/PostgreSQL
> stack are marked **SUPERSEDED** — the authoritative backend is Flask
> `backend/server.py` with Firestore (temporary). Unification follow-ups are
> listed first; see `INTEGRATION.md`.

---

## Unification Follow-ups (current branch → merge → next)

- [ ] Review + merge `feature/unified-system` → `app/intialise` → `main` (`--no-ff`)
- [ ] Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` stack table + `docs/ARCHITECTURE.md`
- [ ] Firebase-removal branch: delete `firebase.json`/`.firebaserc`/`firestore.*`, strip `firebase-admin` from `backend/server.py` + `tools/recategorize.py`, remove `FIREBASE_SERVICE_ACCOUNT` from `render.yaml`, replace `/submit-grievance` persistence
- [ ] Wire Next.js `frontend/` to Flask backend (resolve `:8000` vs `:10000` + API contract)
- [ ] Hygiene: rewrite binary `.gitignore` as UTF-8, untrack `__pycache__/`, convert `backend/requirements.txt` from UTF-16 to UTF-8, decide fate of `adfbh`, rotate hardcoded Firebase key in `functions/admin_api.js`
- [x] Write new root README describing the unified repo (written 2026-09-11; deliberately not reusing `Idea Lab` README)
- [ ] Rewrite `docs/DATABASE.md` + `docs/API.md` against the Flask + replacement-persistence design

---

## Critical

- [ ] Choose and document LLM API provider (OpenAI, Anthropic, Google, or open-source) — needed before AI module implementation
- [ ] Confirm PostgreSQL setup approach (local Docker vs. direct install vs. managed) for development

---

## Current Sprint — PHASE 1: Repository Scaffolding (SUPERSEDED where FastAPI-specific)

- [ ] ~~Initialize Next.js frontend~~ — DONE via copy (`frontend/` from `Idea Lab`)
- [ ] ~~Initialize FastAPI backend~~ — SUPERSEDED (Flask `backend/server.py` is authoritative, DEC-008)
- [ ] Create `backend/.env.example` with all required environment variable names — SUPERSEDED (Flask uses `GROQ_API_KEY`/`HF_API_TOKEN`/Cloudinary env; document in follow-up)
- [x] Create `frontend/.env.example` — DONE via copy (note port mismatch `:8000` vs Flask `:10000`)
- [ ] Add `.gitignore` entries for `.env`, `__pycache__`, `node_modules`, `.venv`, build artifacts — OPEN (`.gitignore` is binary-flagged; fix queued)
- [ ] Configure `alembic` in `backend/` — SUPERSEDED (no Alembic; Firestore is current DB)
- [ ] Set up basic FastAPI app with health check — SUPERSEDED (Flask `/health` already exists in `backend/server.py`)
- [ ] Set up basic Next.js app with placeholder landing page — DONE via copy
- [ ] Verify backend starts — OPEN (`gunicorn ... backend.server:app` per `render.yaml`, or `python backend/server.py`)
- [ ] Verify frontend starts: `npm run dev` — OPEN

---

## Next — PHASE 2: Core Domain Model (SUPERSEDED — Postgres/Alembic/SQLAlchemy path discarded, DEC-008)

- [ ] ~~Design Alembic migrations / SQLAlchemy models / Pydantic schemas / grievance CRUD (dev-only) / DB connectivity~~ — SUPERSEDED; persistence replacement will be designed against the Flask backend in the Firebase-removal follow-up

---

## Next — PHASE 3: Authentication & RBAC (SUPERSEDED as FastAPI/JWT plan — Firebase Auth is the temporary reality)

- [ ] ~~JWT auth, Google OAuth via FastAPI, RBAC middleware, role protection, auth tests~~ — SUPERSEDED pending canonical-stack decision; current: Firebase Auth + admin email whitelist (`functions/admin_api.js`, `firestore.rules`)

---

## Next — PHASE 4: Grievance CRUD & Lifecycle (SUPERSEDED as FastAPI plan — working path is Flask `/submit-grievance` + Firestore)

- [ ] ~~Submission endpoint (USER), state machine, status history, filtered list/detail, admin assign, resolver workflow, attachments (FastAPI)~~ — SUPERSEDED; equivalent future work must target `backend/server.py` + replacement persistence. Grievance state machine (DEC-006) and human-in-the-loop assignment (DEC-003) remain valid requirements.

---

## Next — PHASE 5: UI

- [ ] Design and implement User portal (submit, track, view grievance history)
- [ ] Design and implement Resolver dashboard (assigned grievances, actions, resolution form)
- [ ] Design and implement Admin dashboard (overview, assignment, analytics navigation)
- [ ] Implement grievance detail page (timeline, AI insights panel, actions)
- [ ] Implement authentication pages (login, Google OAuth)

---

## AI / Research (partially IMPLEMENTED — see DEC-008; `backend/server.py` + `functions/tfidf.js` are the working baselines, all EXPERIMENTAL per DEC-005)

- [ ] Select and document LLM API provider — record in DECISIONS.md
- [ ] Prototype AI-01 (Summarization) — LLM prompt-based
- [ ] Prototype AI-02 (Classification) — LLM prompt-based + evaluate zero-shot transformer alternative
- [ ] Prototype AI-03 (Entity Extraction) — LLM prompt-based
- [ ] Prototype AI-04 (Severity Assessment) — LLM prompt-based
- [ ] Prototype AI-05 (Priority Estimation) — combine severity + category + urgency signals
- [ ] Set up Sentence Transformer inference: install `sentence-transformers`, load model, test embedding generation
- [ ] Enable pgvector on PostgreSQL; create embeddings table/column
- [ ] Prototype AI-06 (Similarity Detection) — cosine similarity on Sentence Transformer embeddings
- [ ] Design AI-07 (Assignment Recommendation) — rule-based + similarity baseline first
- [ ] Design AI-08 (Delay/Risk Assessment) — rule-based SLA + optional ML risk score
- [ ] Design AI-09 (Escalation Recommendation) — trigger-based rules + AI override signal
- [ ] Prototype AI-10 (Resolution Quality Assessment) — LLM-based evaluation
- [ ] Define evaluation metrics for each AI module before claiming VALIDATED
- [ ] Investigate publicly available grievance datasets (CPGRAMS, Open Government Data)

---

## Testing

- [ ] Set up `pytest` with `pytest-asyncio` for async FastAPI tests
- [ ] Set up Jest + React Testing Library for frontend tests
- [ ] Write unit tests for grievance state machine transitions
- [ ] Write integration tests for auth flows
- [ ] Write integration tests for grievance CRUD
- [ ] Define AI evaluation protocol for each module

---

## Documentation (partially DONE via copy — DATABASE/API/ARCHITECTURE need rewrite per DEC-008)

- [ ] Complete `docs/API.md` with actual implemented endpoints (update as backend is built)
- [ ] Complete `docs/DATABASE.md` with actual schema once migrations exist
- [ ] Add `frontend/` and `backend/` directory structure diagrams to `docs/ARCHITECTURE.md`
- [ ] Create `.env.example` files
- [ ] Document actual development commands in `docs/DEVELOPMENT.md` once scaffold exists

---

## Technical Debt

*(None yet — track here as it accumulates)*

---

## Future / Optional

- [ ] Multilingual grievance support (feasibility study)
- [ ] Voice/audio grievance input (multimodal — feasibility-dependent)
- [ ] Email/SMS notification integration
- [ ] Mobile-responsive progressive web app enhancements
- [ ] Export reports (PDF, CSV)
- [ ] Public transparency dashboard
- [ ] AI-11 (Administrative Insight Generation) — advanced analytics and pattern clustering
