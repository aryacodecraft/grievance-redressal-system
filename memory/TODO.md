# TODO.md — Task Backlog

> Remove or mark tasks done when actually completed.
> Each task should be concrete and actionable.
>
> **Unification notes:** the original 2026-09-11 banner (DEC-008: *"the
> authoritative backend is Flask `backend/server.py` with Firestore
> temporary"*) is **itself superseded** — see DEC-010/DEC-011. The serving path
> is `backend/app/` (FastAPI) on MongoDB; `backend/server.py` and all
> Firebase/Firestore files were deleted in Phase 3, and `functions/` + `adfbh`
> in Phase 4. Migration Phases 1–6 are complete as of 2026-10-01; items below
> marked SUPERSEDED refer to the discarded FastAPI/Postgres-era plan, not to
> the current stack. See `INTEGRATION.md` for the source map.

---

## Unification Follow-ups (current branch → merge → next)

- [ ] Review + merge `feature/unified-system` → `main` (`--no-ff`)
- [x] Update `AGENTS.md` stack table + `docs/ARCHITECTURE.md` for the now-real stack (FastAPI + MongoDB per DEC-010/DEC-011) — DONE 2026-10-01 (Phase 5, DEC-013; DEC-002 marked superseded. **Auth stack decision still open** — demo/localStorage auth remains temporary)
- [x] **Implement `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status`** — DONE 2026-09-11 (Phase 2: `backend/app/routers/grievances.py`; smoke-tested in-process + via `uvicorn` on `:10000`)
- [x] **Phase 3 — MongoDB persistence** — DONE 2026-09-11 (`pymongo` + `dnspython`; `MongoRepository` behind `GrievanceRepository`, in-memory fallback when `MONGODB_URI` unset; indexes at startup; `/health` reports `storage`; verified against a local `mongod` incl. BSON dates, compound index, PATCH, and persistence across restart)
- [x] **Phase 4 — retire `functions/` + root `adfbh`** (last Firebase-era code) — DONE 2026-10-01 (`09e83af`; 6 files + `adfbh` deleted; README/INTEGRATION/tfidf.ts references updated. `backend/server.py`, `tools/recategorize.py`, root `firebase.*`/`firestore.*` had gone in Phase 3)
- [x] Hygiene: ~~binary `.gitignore`, tracked `__pycache__/`, UTF-16 `backend/requirements.txt`~~ — all fixed/verified 2026-09-11
- [x] ~~Hygiene remaining: decide fate of `adfbh`~~ — DONE 2026-10-01 (deleted, Phase 4)
- [ ] **Rotate the hardcoded Firebase Web API key** (was in `functions/admin_api.js`, now deleted, but the key is still in git history — rotation mandatory; requires the owner's Google Console action)
- [x] Write new root README describing the unified repo (written 2026-09-11; deliberately not reusing `Idea Lab` README)
- [x] Rewrite `docs/DATABASE.md` for MongoDB — DONE 2026-09-11 (Postgres entities moved to a roadmap section)
- [x] Align `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, root `README.md`, `INTEGRATION.md` with the FastAPI + MongoDB reality (Phase 5) — DONE 2026-10-01 (`cfdb7d1`, `4e52990`; `docs/DEVELOPMENT.md` + `AGENTS.md` too; annotated rather than rewritten per DEC-013)
- [ ] Set real Cloudinary cloud name + upload preset in `frontend/.env.local` (Phase 1.5 checklist leftover)
- [x] Phase 5 — docs/config/memory alignment per `UNIFIED_MIGRATION_PLAN.md` — DONE 2026-10-01 (also `render.yaml` `MONGODB_URI`/`MONGODB_DB` env vars, `4686f81`)
- [x] Phase 6 — verification: pytest vs test Mongo DB, classifier unit tests, `npm run build`, end-to-end manual check, `rg -i "firestore|firebase"` clean in tracked source — DONE 2026-10-01 (85 passed with a local `mongod`, 68 passed / 17 skipped without; e2e via `frontend/scripts/e2e.mjs` incl. restart persistence; `tsc --noEmit` + `npm run build` clean; sweep leaves only past-tense history)

---

## Critical

- [ ] Choose and document LLM API provider (OpenAI, Anthropic, Google, or open-source) — needed before AI module implementation
- [ ] ~~Confirm PostgreSQL setup approach~~ — SUPERSEDED by DEC-011 (MongoDB Atlas; local `mongod` works for development/tests)
- [ ] Owner: create MongoDB Atlas cluster and set `MONGODB_URI`/`MONGODB_DB` in `backend/.env` (without it the API runs on the non-persistent in-memory fallback)

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
- [x] Verify backend starts — DONE 2026-09-11: `uvicorn backend.app.main:app` on `:10000` serves `/health` + `/grievances` (legacy `gunicorn backend.server:app` still available for the Flask reference)
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

## Next — PHASE 5: UI (partially done 2026-09-11 — see UNIFIED_MIGRATION_CHECKLIST Phase 1/1.5)

- [x] User portal: submit + "my grievances" list (`MyGrievances.tsx`), track page, demo auth — DONE (legacy parity)
- [ ] Design and implement Resolver dashboard (assigned grievances, actions, resolution form) — OPEN
- [x] Admin dashboard: queue, assignment/override, filters, search, pagination, map, TF-IDF clusters, stats, mark resolved — DONE 2026-09-11; analytics views still OPEN
- [ ] Implement grievance detail page (timeline, AI insights panel, actions) — OPEN (admin detail panel with AI analysis exists; citizen-facing detail/timeline OPEN)
- [x] Authentication pages (login, register) — DONE as demo/localStorage auth; Google OAuth + real auth OPEN (deferred per migration plan)

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

- [x] Set up `pytest` — DONE 2026-10-01 (Phase 6, DEC-012): root `tests/` +
      `pytest.ini` + `requirements-dev.txt`; **no `pytest-asyncio` needed** — the
      repository protocol is synchronous (DEC-011), so `TestClient` is enough
- [x] Write integration tests for grievance CRUD — DONE 2026-09-11 behaviour,
      locked down 2026-10-01 in `tests/test_endpoints.py` (submit/list/get/PATCH
      + 404s + error shape) and `tests/test_repository.py` (both implementations)
- [x] Classifier unit tests incl. `CATEGORY_KEYS` ↔ frontend `CATEGORIES` — DONE 2026-10-01
      (`tests/test_classification.py`; keyword path only — HF/Groq cascade is
      EXPERIMENTAL per DEC-005 and not asserted)
- [ ] Set up Jest + React Testing Library for frontend tests
- [ ] Write unit tests for grievance state machine transitions (needs the state machine + real auth first)
- [ ] Write integration tests for auth flows (blocked on real auth)
- [ ] Define AI evaluation protocol for each module

---

## Documentation (aligned 2026-10-01 per DEC-013)

- [x] Complete `docs/API.md` with actual implemented endpoints — DONE 2026-10-01 (implemented-endpoints table + corrected `/health`/error shapes; planned surface kept)
- [x] `docs/DATABASE.md` for MongoDB — DONE 2026-09-11 (Postgres entities moved to a roadmap section)
- [x] Add `backend/` directory structure to `docs/ARCHITECTURE.md` — DONE 2026-10-01 (real `backend/app/` tree replacing the proposed one)
- [x] Create `.env.example` files — DONE (`backend/.env.example`, `frontend/.env.example`)
- [x] Document actual development commands in `docs/DEVELOPMENT.md` — DONE 2026-10-01 (incl. a "Running Tests" section)

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
