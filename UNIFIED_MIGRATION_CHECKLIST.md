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

- [ ] Delete `frontend/lib/firebase.ts`
- [ ] Remove `firebase` dependency from `frontend/package.json`
- [ ] Rewrite `frontend/lib/session.tsx` as demo localStorage provider only
- [ ] Rewrite `frontend/lib/grievances.ts` to REST (drop Firestore `onSnapshot`)
- [ ] Update `frontend/components/admin/AdminBoard.tsx`
- [ ] Update `frontend/app/track/page.tsx`
- [ ] Update `frontend/app/login/page.tsx`
- [ ] Update `frontend/app/register/page.tsx`
- [ ] Update `frontend/components/SiteHeader.tsx`
- [ ] Extend `frontend/lib/api.ts` with new endpoints
- [ ] Keep `frontend/lib/mock.ts` as `NEXT_PUBLIC_USE_MOCKS` fallback only
- [ ] Strip Firebase/NextAuth vars from `frontend/.env.example`
- [ ] `npm run build` passes
- [ ] `tsc --noEmit` passes

## Phase 2 — FastAPI rewrite

- [ ] Create `backend/app/main.py`
- [ ] Create `backend/app/config.py` (pydantic-settings)
- [ ] Create `backend/app/db.py`
- [ ] Create `backend/app/models.py`
- [ ] Port classifier/keyword/risk logic → `services/classification.py`
- [ ] Port image analysis → `services/image.py`
- [ ] Port Cloudinary signing/deletion → `services/cloudinary.py`
- [ ] `POST /submit-grievance` (shape: `message, grievanceId, hfEngine`)
- [ ] `POST /validate-image`
- [ ] `POST /sign-cloudinary`
- [ ] `POST /delete-cloudinary`
- [ ] `GET /grievances`
- [ ] `GET /grievances?userId=<id>`
- [ ] `GET /grievances/{id}`
- [ ] `PATCH /grievances/{id}/status`
- [ ] `GET /health`
- [ ] `GET /test`
- [ ] Confirm `CATEGORY_KEYS` matches frontend `CATEGORIES`
- [ ] Update `render.yaml` → `uvicorn backend.app.main:app` on `:10000`

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
