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

- [ ] Add `pymongo`/`motor`
- [ ] Add `MONGODB_URI` / `MONGODB_DB` config
- [ ] Drop `firebase-admin` from root `requirements.txt`
- [ ] Drop `firebase-admin` from `backend/requirements.txt`
- [ ] Create `grievances` collection with today's field set
- [ ] Unique index on `grievanceId`
- [ ] Compound index on `userId + createdAt`
- [ ] Store `createdAt` as BSON date
- [ ] Replace Firestore write in `/submit-grievance`
- [ ] Rewrite `tools/recategorize.py` for MongoDB
- [ ] Rewrite `docs/DATABASE.md` for MongoDB
- [ ] Delete `firebase.json`
- [ ] Delete `.firebaserc`
- [ ] Delete `firestore.rules`
- [ ] Delete `firestore.indexes.json`

## Phase 4 — Similarity port

- [ ] Port TF-IDF + greedy clustering from `functions/tfidf.js` to Python
- [ ] Add `GET /grievances/{id}/similar`
- [ ] Retire `functions/` (delete legacy admin files)
- [ ] Delete stray root `adfbh`

## Phase 5 — Docs, config, memory

- [ ] Add decision record DEC-009 (reverses DEC-008)
- [ ] Update `AGENTS.md` stack table
- [ ] Update root `README.md`
- [ ] Update `INTEGRATION.md`
- [ ] Update `memory/PROJECT_STATE.md`
- [ ] Update `memory/TODO.md`
- [ ] Update `memory/CHANGELOG.md`
- [ ] Update `memory/SESSION_LOG.md`
- [ ] Align `docs/API.md`
- [ ] Align `docs/ARCHITECTURE.md`
- [ ] Document `/submit-grievance` auth limitation in `docs/SECURITY.md`
- [ ] Rotate the hardcoded Firebase Web API key (in git history)

## Phase 6 — Verification

- [ ] Add pytest suite against a test Mongo DB
- [ ] Add classifier unit tests
- [ ] `npm run build` passes
- [ ] End-to-end: submit → track → admin view
- [ ] `rg -i "firestore|firebase"` returns nothing in tracked source

## Open questions

- [ ] Decide fate of `backend/grievance_model.py` + `backend/llm_fallback.py` from `main` (recommend: drop, record in decision log)
