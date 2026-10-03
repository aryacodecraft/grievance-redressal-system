# Unified System Migration Plan

**Branch:** `feature/unified-system`
**Constraint:** `main` must remain untouched and uncompromised at all times.
**Status:** Plan finalized, implementation not started.
**Tracking:** see [UNIFIED_MIGRATION_CHECKLIST.md](./UNIFIED_MIGRATION_CHECKLIST.md)

---

## 1. Goal

Move the grievance-redressal project onto one fresh stack:

| Layer    | Before (today)                              | After (target)                       |
| -------- | ------------------------------------------- | ------------------------------------ |
| Frontend | Next.js UI on `feature/unified-system` (merged from `app/frontend`), wired to Firebase Firestore + Firebase Auth | Next.js UI on `feature/unified-system`, wired to our own REST API |
| Backend  | Flask (`backend/server.py`) + `firebase-admin` | FastAPI (`backend/app/`), no Firebase SDK |
| Database | Firestore (`grievances` collection only)    | MongoDB (fresh, `grievances` collection) |
| Auth     | Firebase Auth + demo localStorage session   | Demo localStorage session only (this pass) |
| Uploads  | Cloudinary (backend signs, browser uploads) | Cloudinary (unchanged)               |
| Admin    | Legacy `functions/*.html` + `admin_api.js`, stray `adfbh` | Retired; admin lives in the Next.js frontend |
| Similarity | `functions/tfidf.js` (client-side)        | Ported to Python, served by FastAPI  |

**Definition of done:** every field and button in the frontend works against the FastAPI backend, the backend runs cleanly, MongoDB is the only datastore, no Firebase/Firestore code remains, and `main` is untouched.

---

## 2. Confirmed decisions

- **Work directly on `feature/unified-system`.** No separate worktree, no merge into `main`.
- **Demo/mock session only** this pass — no JWT, no `users` collection, no Google OAuth. (Saves ~3–5 days.)
- **Keep Cloudinary** for uploads: FastAPI signs the upload, the browser uploads directly.
- **Port TF-IDF similarity** (from `functions/tfidf.js`) into the FastAPI backend.
- **Retire** `functions/admin*.html`, `functions/admin_api.js`, `functions/admin_ui.js`, and the stray root `adfbh`.
- **Consolidate onto one branch:** the finished UI was fast-forward merged from `app/frontend`, and that branch was deleted locally and on `origin` before starting the phases.
- **Estimated effort:** ~9–12 working days total.

### Open small item
- Decide whether to pull `backend/grievance_model.py` + `backend/llm_fallback.py` from `main` into the FastAPI backend, or explicitly drop them. Recommendation: **drop** (the classifier logic already lives inside `server.py` and is what gets ported); record the drop in the decision log.

---

## 3. Target architecture

```
backend/
  app/
    main.py                 # FastAPI app + router registration
    config.py               # pydantic-settings (env)
    db.py                   # Mongo client + index setup
    models.py               # Pydantic request/response models
    routers/
      grievances.py         # submit, list, get, status
      images.py             # validate-image, sign-cloudinary, delete-cloudinary
      similarity.py         # similar grievances
      health.py             # /health, /test
    services/
      classification.py     # ported classifier/keyword/risk logic
      image.py              # ported image analysis logic
      cloudinary.py         # Cloudinary signing + deletion
      similarity.py         # ported TF-IDF + clustering

frontend/
  lib/
    api.ts                  # REST client (single source of truth for calls)
    session.tsx             # demo localStorage provider only
    grievances.ts           # REST reads (no Firestore)
    types.ts                # shared types
    mock.ts                 # NEXT_PUBLIC_USE_MOCKS fallback only
  app/…, components/…       # real UI lifted from app/frontend
```

**API surface (must keep response shape backward-compatible with the frontend zod schemas):**

- `POST /submit-grievance` → `{ message, grievanceId, hfEngine }`
- `POST /validate-image`
- `POST /sign-cloudinary`
- `POST /delete-cloudinary`
- `GET /grievances` (admin: all, newest first, limit)
- `GET /grievances?userId=<id>` (citizen: own)
- `GET /grievances/{id}`
- `PATCH /grievances/{id}/status`
- `GET /grievances/{id}/similar`
- `GET /health`, `GET /test`

**Mongo `grievances` document (matches today's Firestore fields):**
`title, description, userId, status, createdAt, hfEngine{category, priority, isUrgent, keywords, explanation}, imageUrl, latitude, longitude, assignee`
Indexes: unique on `grievanceId`; compound `userId + createdAt`; `createdAt` stored as BSON date.

---

## 4. Phases

### Phase 0 — Branch prep (0.5–1 day)
- ✅ On `feature/unified-system`; `main` still at `db66f16`, untouched.
- ✅ Finished UI fast-forward merged from `app/frontend` (`8157723`); `frontend/.env.local` preserved as an untracked file.
- ✅ `app/frontend` deleted locally and on `origin` (only `feature/unified-system` + `main` remain remotely).
- ✅ Untracked `backend/__pycache__/` + `tools/__pycache__/` and deleted them from disk; added `__pycache__/`, `*.py[cod]` to `.gitignore`.
- ✅ Rewrote root `.gitignore` as clean UTF-8/LF — repaired the corrupted tail (32 NUL bytes from a UTF-16 fragment spliced after `.dataconnect`); also added `.env*.local`, `.next/`, `out/`, `.venv/`, `venv/`.
- ✅ Converted `backend/requirements.txt` from UTF-16/CRLF to UTF-8/LF.
- **Phase 0 complete.**

### Phase 1 — Frontend de-Firebase (2–3 days)
- ✅ Deleted `lib/firebase.ts`; removed `firebase` and the unused `next-auth` deps.
- ✅ Extracted the admin allowlist into new `lib/roles.ts` (`isAdminEmail`, `roleForEmail`).
- ✅ Rewrote `lib/session.tsx` as a pure demo localStorage provider; exposes `user`, `liveMode`, `signInDemo`, `signOut`.
- ✅ Rewrote `lib/grievances.ts` to REST polling (admins → all, citizens → own); `fetchGrievanceById` now hits `GET /grievances/{id}`.
- ✅ Extended `lib/api.ts` with `listGrievances`, `getGrievance`, `updateGrievanceStatus`.
- ✅ Updated `AdminBoard` (REST subscribe + assignment buttons now PATCH when live), `Track`, `Login`, `Register`; `SiteHeader` needed no change.
- ✅ `lib/mock.ts` remains only as the `NEXT_PUBLIC_USE_MOCKS` fallback.
- ✅ Stripped Firebase/NextAuth vars from `frontend/.env.example`; added `NEXT_PUBLIC_SHOW_DEV_CREDS`.
- ✅ Gate passed: `tsc --noEmit` clean, `npm run build` builds all 9 routes.
- **Phase 1 complete.**

### Phase 1.5 — Legacy parity (required: behaviour must match the old HTML)
- ✅ Citizen "my grievances" list added to `/submit` (`MyGrievances.tsx`).
- ✅ Admin: priority filter, category filter, free-text search, Leaflet map + markers + popups, "Open on Map", pagination (5/10/20/50), "Medium priority open" stat, per-row urgent badge / created date / userId, detail-panel created + userId + lat/lon + "Open original", "Mark Resolved", and the createdAt→priority→id sort.
- ✅ TF-IDF clusters: `lib/tfidf.ts` is a direct port of `functions/tfidf.js` and runs client-side (as legacy did), so it works without the backend. The Phase 4 server-side port is therefore optional.
- ✅ `userId` added to the `Grievance` type + API schema; `leaflet` + `@types/leaflet` added.
- Remaining: Cloudinary cloud name / upload preset values in `frontend/.env.local`.
- **Phase 1.5 complete — frontend reaches legacy behavioural parity.**

### Phase 2 — FastAPI rewrite (3–4 days)
- ✅ Created `backend/app/` — `main.py`, `config.py`, `models.py`, `db.py`, `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py`.
- ✅ Ported classifier/keyword/risk logic and image analysis verbatim (cascade: HF → Groq → keywords), preserving `CATEGORY_KEYS`, which is byte-identical to the frontend's `CATEGORIES`.
- ✅ Implemented every endpoint the frontend calls; `POST /submit-grievance` keeps the `message, grievanceId, hfEngine` shape the zod schemas validate.
- ✅ Added CORS and a `400 {"error": …}` validation handler so error handling matches the legacy Flask contract.
- ✅ `db.py` exposes a `GrievanceRepository` protocol with an in-process implementation — Phase 3 swaps in MongoDB with no router changes.
- ✅ `render.yaml` → `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`; `fastapi`/`uvicorn` added to both requirements files.
- ✅ Verified: full smoke test (health/test/submit/list/get/patch/404), plus an integration test proving the frontend's real zod schema parses the live API response.
- **Phase 2 complete.** Note: `config.py` uses `python-dotenv` rather than `pydantic-settings` to avoid a new dependency.

### Phase 3 — MongoDB (2–3 days)
- ✅ Added `pymongo` + `dnspython` (`dnspython` is required for Atlas `mongodb+srv://`); dropped `firebase-admin` from both requirements files.
- ✅ `MongoRepository` implements the existing `GrievanceRepository` protocol — routers untouched; `db.py` picks Mongo when `MONGODB_URI` is set and falls back to the in-memory store otherwise (logged clearly, reported as `"storage"` from `/health`).
- ✅ Indexes created at startup: unique `id`, compound `userId + createdAt`; `createdAt` stored as a BSON `Date`.
- ✅ Firestore write replaced by `MongoRepository.create`; `tools/recategorize.py` rewritten for Mongo (and now imports the shared classifier, with `--dry-run`).
- ✅ `docs/DATABASE.md` rewritten for MongoDB; the 22 Postgres entities moved to a roadmap section.
- ✅ Deleted `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, and retired `backend/server.py`.
- ✅ Added `backend/.env.example` documenting the Atlas setup.
- ✅ Verified against a real MongoDB: indexes, BSON date, scoped list, PATCH, and persistence across a server restart. Also verified a clean-venv install from `backend/requirements.txt` and the in-memory fallback.
- **Phase 3 complete.** Remaining: the user's Atlas setup (cluster + `MONGODB_URI`), which is the only blocker.

**Your Atlas setup** — the only remaining blocker (cluster + `MONGODB_URI`). Also delete `backend/serviceAccountKey.json` and any `FIREBASE_*` entries in `backend/.env`.

### Phase 4 — Similarity port (1 day) — optional / partly done
- ✅ TF-IDF + greedy clustering ported to TypeScript (`frontend/lib/tfidf.ts`) and wired into the admin cluster panel — works without the backend, exactly as the legacy HTML did.
- ✅ Retired `functions/` (6 files) and deleted the stray root `adfbh` (`09e83af`); references cleaned in `README.md`, `INTEGRATION.md`, `frontend/lib/tfidf.ts`.
- ➖ `GET /grievances/{id}/similar` **not built** — TF-IDF runs client-side, so there is no server consumer. Closed as not-applicable rather than left open.
- **Phase 4 complete.**

### Phase 5 — Docs, config, memory (1 day)
- ✅ Decision records: **DEC-009** (frontend de-Firebase) exists, plus **DEC-010** (FastAPI serving path) and **DEC-011** (MongoDB), which cover the backend side the proposed DEC-009 was standing in for. **DEC-002** (PostgreSQL) marked SUPERSEDED BY DEC-011; **DEC-013** records the annotate-don't-rewrite approach.
- ✅ Updated `AGENTS.md` stack table, root `README.md`, `INTEGRATION.md` (`cfdb7d1`, `09e83af`).
- ✅ Updated `memory/PROJECT_STATE.md`, `memory/TODO.md`, `memory/CHANGELOG.md`, `memory/SESSION_LOG.md`.
- ✅ Aligned `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` (+ `docs/DEVELOPMENT.md`) — implemented-vs-planned status banners rather than rewrites (`4e52990`, DEC-013). `docs/SECURITY.md` now leads its Known Limitations with the trusted-`userId` gap.
- ✅ *Beyond the plan:* `render.yaml` gained `MONGODB_URI`/`MONGODB_DB` env vars (`4686f81`).
- ⬜ **Rotate the hardcoded Firebase Web API key — still open (owner action).** The file is gone; the key is in git history.
- **Phase 5 complete** except the key rotation.

### Phase 6 — Verification (1 day)
- ✅ pytest against a test Mongo database + classifier unit tests — `tests/` (4 files, 85 tests) + `pytest.ini` + `requirements-dev.txt` (DEC-012). **85 passed** with a local `mongod`; **68 passed / 17 skipped** without one. Endpoint tests force the in-memory path by pinning `MONGODB_URI` before `backend.app` imports.
- ✅ `npm run build` passes (9 routes); `tsc --noEmit` clean.
- ✅ End-to-end: submit → track → admin view — `frontend/scripts/e2e.mjs` drives the real `lib/api.ts` client (zod-parsed) against a live backend + `mongod`, covering submit, track-by-id, unknown-id → null, admin global/scoped lists, assign → resolve, persistence, and error propagation. HTTP-level checks confirm all 6 frontend routes serve and a process restart keeps the data. *(No desktop browser was connected this session, so the DOM itself was not driven.)*
- ✅ `rg -i "firestore|firebase"` returns nothing in tracked source — only past-tense history comments remain.
- **Phase 6 complete.** `rg`/hygiene re-verified (0 tracked `__pycache__`, `venv/` untracked).

---

## 5. Known gaps / risks

- **`/submit-grievance` trusts `userId` from the request body.** Acceptable for a demo-auth prototype; document it in `docs/SECURITY.md` as a known limitation.
- **Firebase key in git history** — rotate, do not rely on deleting the file. *(File deleted in Phase 4; rotation still open — owner action.)*
- **`.env` / `serviceAccountKey.json` are untracked secrets** — never commit them (and they become obsolete after Mongo).
- **One shared worktree across branches** — always check the branch before editing; `git checkout <branch> -- <path>` only for deliberately lifting files.
- **`main` protection** — no commits, resets, or checkouts that modify `main`.

---

## 6. Out of scope (this pass)

- Real authentication / user accounts / RBAC.
- Postgres/pgvector and the 21 non-`grievances` entities in `docs/DATABASE.md`.
- Assignments, SLA, escalations, notifications, analytics beyond the current admin charts.
