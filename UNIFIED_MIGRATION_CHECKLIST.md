# Unified System Migration — Checklist

Tick items as work completes. Plan: [UNIFIED_MIGRATION_PLAN.md](./UNIFIED_MIGRATION_PLAN.md)

> Constraint: **`main` must stay untouched and uncompromised.** All work happens on `feature/unified-system`.

---

## Phase 0 — Branch prep

- [x] Confirm current branch is `feature/unified-system` (never touch `main`)
- [x] Fast-forward merge finished UI from `app/frontend` (`frontend/.env.local` preserved)
- [x] Delete `app/frontend` branch locally
- [x] Delete remote `origin/app/frontend`
- [x] Untrack `backend/__pycache__/`
- [x] Untrack `tools/__pycache__/`
- [x] Add `__pycache__/` to `.gitignore`
- [x] Rewrite root `.gitignore` as UTF-8/LF (repaired corrupted UTF-16 tail)
- [x] Convert `backend/requirements.txt` from UTF-16 to UTF-8

## Phase 1 — Frontend de-Firebase

- [x] Delete `frontend/lib/firebase.ts`
- [x] Extract admin allowlist into new `frontend/lib/roles.ts`
- [x] Remove `firebase` dependency from `frontend/package.json`
- [x] Remove unused `next-auth` dependency
- [x] Rewrite `frontend/lib/session.tsx` as demo localStorage provider only
- [x] Rewrite `frontend/lib/grievances.ts` to REST polling (drop Firestore `onSnapshot`)
- [x] Update `frontend/components/admin/AdminBoard.tsx` (REST + wired assignment buttons)
- [x] Update `frontend/app/track/page.tsx`
- [x] Update `frontend/app/login/page.tsx`
- [x] Update `frontend/app/register/page.tsx`
- [x] `frontend/components/ui/SiteHeader.tsx` (already consumer-only — no change needed)
- [x] Extend `frontend/lib/api.ts` with list/get/update endpoints
- [x] Keep `frontend/lib/mock.ts` as `NEXT_PUBLIC_USE_MOCKS` fallback only
- [x] Strip Firebase/NextAuth vars from `frontend/.env.example`
- [x] Regenerate `frontend/package-lock.json` (`npm ci` clean reinstall)
- [x] `tsc --noEmit` passes
- [x] `npm run build` passes (9 routes)

**Phase 1 complete.** Remaining lint output is the two pre-existing `setState`-in-effect errors (AdminBoard + session hydration) and one pre-existing unused-import warning.

## Phase 1.5 — Legacy parity (behaviour must match the old HTML)

Source of truth: `functions/grievance-app.html` (citizen), `functions/admin.html` + `admin_ui.js` + `admin_api.js` + `tfidf.js` (admin). Design may differ; **behaviour must match**.

### Citizen
- [x] "My grievances" list of own submissions (`components/grievance/MyGrievances.tsx` on `/submit`)
- [ ] Confirm Cloudinary cloud name + preset configured (legacy hardcoded `dnw1p9dnk` / `grievance app`) — **needs real values in `frontend/.env.local`**

### Admin
- [x] Priority filter (high / medium / low)
- [x] Category filter (7 categories)
- [x] Free-text search over title + description
- [x] Leaflet map with markers for the filtered set + image popups (`components/admin/AdminMap.tsx`)
- [x] "Open on Map" action from the detail panel
- [x] Pagination (page sizes 5/10/20/50, Prev/Next/numbered)
- [x] Stat "Medium priority open" (legacy: total / high-open / medium-open / resolved)
- [x] Per-row: urgent badge, created date, userId
- [x] Detail panel: created timestamp, userId, keywords, lat/lon, "Open original" image link
- [x] "Mark Resolved" action
- [x] Sort order: createdAt desc, then priority, then id
- [x] TF-IDF cluster panel with View → filter list (`lib/tfidf.ts` port of `functions/tfidf.js`, client-side)
- [x] `userId` added to `Grievance` type + API schema

**Phase 1.5 complete.** Frontend reaches legacy behavioural parity. Note: TF-IDF now runs client-side (as it did in the legacy HTML), making the Phase 4 server-side port optional rather than required.

## Phase 2 — FastAPI rewrite

- [x] Create `backend/app/main.py`
- [x] Create `backend/app/config.py` (python-dotenv, not pydantic-settings — avoids a new dep)
- [x] Create `backend/app/db.py` (repository abstraction; in-memory impl for Phase 2)
- [x] Create `backend/app/models.py` (Pydantic request models)
- [x] Port classifier/keyword/risk logic → `services/classification.py`
- [x] Port image analysis → `services/image.py`
- [x] Port Cloudinary signing/deletion → `services/cloudinary.py`
- [x] `POST /submit-grievance` (shape: `message, grievanceId, hfEngine`)
- [x] `POST /validate-image`
- [x] `POST /sign-cloudinary`
- [x] `POST /delete-cloudinary`
- [x] `GET /grievances`
- [x] `GET /grievances?userId=<id>`
- [x] `GET /grievances/{id}`
- [x] `PATCH /grievances/{id}/status`
- [x] `GET /health`
- [x] `GET /test`
- [x] Confirm `CATEGORY_KEYS` matches frontend `CATEGORIES` (identical: water, roads, electricity, sanitation, health, governance, other)
- [x] Update `render.yaml` → `uvicorn backend.app.main:app` on `:10000`
- [x] Add `fastapi`/`uvicorn` to both requirements files
- [x] CORS middleware + legacy `400 {"error": …}` validation shape
- [x] Install `fastapi`/`uvicorn` into `venv/`
- [x] Smoke test: health/test/submit/list/get/patch/404 all pass
- [x] Integration test: frontend zod schema parses the live API response

**Phase 2 complete.** Note: `db.py` uses an in-process repository — Phase 3 swaps it for MongoDB behind the same interface.

**Known limitation:** `/submit-grievance` trusts `userId` from the request body (demo auth) — document in `docs/SECURITY.md`.

## Phase 3 — MongoDB

- [x] Add `pymongo`/`motor` — chose **pymongo** (sync; FastAPI sync endpoints run in a threadpool) + `dnspython` for `mongodb+srv://`
- [x] Add `MONGODB_URI` / `MONGODB_DB` config
- [x] Drop `firebase-admin` from root `requirements.txt` (also dropped Flask/Flask-Cors/gunicorn)
- [x] Drop `firebase-admin` from `backend/requirements.txt` (file rewritten as an accurate freeze of the new stack)
- [x] Create `grievances` collection with today's field set
- [x] Unique index on `id` (`uniq_grievance_id`)
- [x] Compound index on `userId + createdAt` (`user_created`)
- [x] Store `createdAt` as BSON date
- [x] Replace Firestore write in `/submit-grievance` (now `MongoRepository.create`)
- [x] Rewrite `tools/recategorize.py` for MongoDB (now imports `backend.app.services`, has `--dry-run`)
- [x] Rewrite `docs/DATABASE.md` for MongoDB
- [x] Delete `firebase.json`
- [x] Delete `.firebaserc`
- [x] Delete `firestore.rules`
- [x] Delete `firestore.indexes.json`
- [x] Retire legacy `backend/server.py`
- [x] Add `backend/.env.example` with Atlas setup instructions
- [x] Verify: clean-venv install from `backend/requirements.txt` + app import
- [x] Verify against a real MongoDB (local `mongod`): indexes created, `createdAt` is a BSON `Date`, scoped list, PATCH, **persistence across restart**
- [x] Verify in-memory fallback when `MONGODB_URI` is unset

**Phase 3 complete** (code side).

**Your setup (Atlas) — the only remaining blocker:**
1. Create a free **M0** cluster at cloud.mongodb.com
2. Database Access → create a DB user; Network Access → add your IP (or `0.0.0.0/0`)
3. Connect → Drivers → copy the URI into `backend/.env` as `MONGODB_URI` (set `MONGODB_DB=grievance`)
4. Boot and confirm `GET /health` reports `"storage": "mongodb"`

**Left for you:** delete `backend/serviceAccountKey.json` (obsolete Firebase key) and any `FIREBASE_*` vars in `backend/.env`.

## Phase 4 — Similarity port

- [x] ~~Port TF-IDF + greedy clustering from `functions/tfidf.js` to Python~~ —
  **N/A by design**: the Phase 1.5 TS port `frontend/lib/tfidf.ts` already runs
  client-side, exactly as the legacy HTML did (see Phase 1.5 note above and
  plan §4 "optional / partly done"). No Python port.
- [x] ~~Add `GET /grievances/{id}/similar`~~ — **deliberately skipped**: with
  TF-IDF running client-side there is no server consumer for it; adding a route
  nothing calls would only expand the API surface. Revisit if/when a
  Sentence-Transformers path (AI-06) lands server-side.
- [x] Retire `functions/` (delete legacy admin files) — `09e83af` (6 files:
  `tfidf.js`, `admin_api.js`, `admin_ui.js`, `admin.html`,
  `grievance-app.html`, `download.jpg`); references updated in `README.md`,
  `INTEGRATION.md` and the `frontend/lib/tfidf.ts` header comment.
- [x] Delete stray root `adfbh` — `09e83af`

**Phase 4 complete.** The two porting items are closed as not-applicable rather
than done — recorded here so the next reader doesn't chase them. What remains
Firebase-ish is only the leaked web API key in git history (Phase 5 item).

## Phase 5 — Docs, config, memory

- [x] Add decision record DEC-009 (reverses DEC-008) — written in the Phase 1
  round; the backend/persistence side is covered by DEC-010 and DEC-011
- [x] Update `AGENTS.md` stack table — `cfdb7d1` (Backend → `backend/app/`,
  Database → MongoDB, Auth marked *planned*; DEC-002 marked SUPERSEDED BY DEC-011)
- [x] Update root `README.md` — `cfdb7d1` (layout, quickstart, `:10000`, key
  decisions, follow-ups)
- [x] Update `INTEGRATION.md` — status banner + loose-ends annotated (done with
  `09e83af`; original source map preserved)
- [x] Update `memory/PROJECT_STATE.md`
- [x] Update `memory/TODO.md`
- [x] Update `memory/CHANGELOG.md`
- [x] Update `memory/SESSION_LOG.md`
- [x] Align `docs/API.md` — implemented-endpoints table, base URL, real
  `/health` + error shapes
- [x] Align `docs/ARCHITECTURE.md` — plus `docs/DEVELOPMENT.md` and
  `docs/SECURITY.md` (all in `4e52990`, DEC-013)
- [x] Document `/submit-grievance` auth limitation in `docs/SECURITY.md` — now
  the first item under Known Prototype Limitations (API trusts request-body
  `userId`; list/PATCH unauthorised; frontend allowlist is client-side only)
- [ ] **Rotate the hardcoded Firebase Web API key (in git history) — OPEN,
  owner action required.** The file is deleted; the key is not.
- [x] *Added beyond the plan:* `render.yaml` gained `MONGODB_URI` (sync: false)
  + `MONGODB_DB` — without them a deployment silently uses the in-memory
  fallback (`4686f81`)

**Phase 5 complete** except the key rotation, which needs the owner's Google
Console access and cannot be done from the repo. Memory files updated in the
same round (DEC-002 superseded, DEC-011 follow-ups closed, DEC-013 added).

## Phase 6 — Verification

- [x] Add pytest suite against a test Mongo DB — `tests/test_repository.py`
  (both `GrievanceRepository` implementations behind one parametrised contract,
  BSON dates, indexes, unique-id enforcement, restart persistence, plus
  `_build_repository()` selection) — **85 passed** with a local `mongod`,
  **68 passed / 17 skipped** without one (Mongo tests skip, never fail)
- [x] Add classifier unit tests — `tests/test_classification.py` (keyword
  category inference, urgency/risk/priority, sentiment normalisation, and the
  `CATEGORY_KEYS` ↔ `frontend/lib/types.ts` `CATEGORIES` contract). HF/Groq
  branches deliberately unasserted — EXPERIMENTAL per DEC-005
- [x] Endpoint tests — `tests/test_endpoints.py` (submit/list/get/PATCH, scoping,
  limits, sort order, 404s, flat `{"error": …}` shape) via `TestClient`;
  `tests/conftest.py` pins `MONGODB_URI`/`GROQ_API_KEY`/`HF_API_TOKEN` before
  `backend.app` imports (DEC-012)
- [x] `npm run build` passes — 9 routes; `tsc --noEmit` clean
- [x] End-to-end: submit → track → admin view — `frontend/scripts/e2e.mjs`
  drives the **real** `lib/api.ts` client (zod-validated) against a live
  backend + `mongod`: submit, track-by-id, unknown-id → null, admin global +
  scoped lists, assign → resolve, re-read persistence, and error propagation.
  Also verified at HTTP level: 6 frontend routes return 200, and a process
  restart keeps the data (incl. a PATCH). *(No desktop browser was connected to
  this session, so the DOM itself was not driven — the script covers the same
  contract minus rendering.)*
- [x] `rg -i "firestore|firebase"` returns nothing in tracked source — only
  past-tense history comments remain (`tools/recategorize.py`,
  `frontend/lib/{roles,grievances}.ts`, `INTEGRATION.md`, key-rotation notices
  in `README.md`/`SECURITY.md`); no firebase/firestore dependency in
  `frontend/package.json` and no such files outside `venv/`
- [x] *Added beyond the plan:* `requirements-dev.txt` + `pytest.ini` so the
  suite runs from a clean clone (DEC-012)

**Phase 6 complete.** Verification artifacts: `tests/` (85 tests),
`pytest.ini`, `requirements-dev.txt`, `frontend/scripts/e2e.mjs`.

## Open questions

- [ ] Decide fate of `backend/grievance_model.py` + `backend/llm_fallback.py` from `main` (recommend: drop, record in decision log)
