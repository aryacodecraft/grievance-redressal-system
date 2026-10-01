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
- Delete `lib/firebase.ts`; remove the `firebase` dependency.
- Rewrite `lib/session.tsx` as a pure demo provider (strip Firebase auth calls/state).
- Rewrite `lib/grievances.ts` to REST instead of Firestore `onSnapshot`.
- Update `AdminBoard`, `Track`, `Login`, `Register`, `SiteHeader` to the new providers.
- Extend `lib/api.ts` with the new endpoints.
- Keep `lib/mock.ts` only as the `NEXT_PUBLIC_USE_MOCKS` fallback.
- Strip Firebase/NextAuth vars from `frontend/.env.example`.
- Gate: `npm run build` and `tsc --noEmit` both pass.

### Phase 2 — FastAPI rewrite (3–4 days)
- Create the `backend/app/` layout above.
- Port classifier/keyword/risk logic from `server.py` (~L264–668) verbatim into `services/classification.py`.
- Port image analysis (~L669–846) into `services/image.py`.
- Implement all endpoints; keep `CATEGORY_KEYS` and the response shape so zod still validates.
- Update `render.yaml` → `uvicorn backend.app.main:app` on `:10000`.

### Phase 3 — MongoDB (2–3 days)
- Add `pymongo`/`motor`; env `MONGODB_URI`, `MONGODB_DB`.
- Drop `firebase-admin` from both requirements files.
- Create the `grievances` collection + indexes (fresh DB).
- Replace the Firestore write in `/submit-grievance` and in `tools/recategorize.py`.
- Rewrite `docs/DATABASE.md` for MongoDB; mark the other 21 spec'd entities as roadmap.
- Delete `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.

### Phase 4 — Similarity port (1 day)
- Port `functions/tfidf.js` (TF-IDF + greedy clustering) to Python.
- Expose `GET /grievances/{id}/similar`.
- Retire `functions/`.

### Phase 5 — Docs, config, memory (1 day)
- Add a new decision record (proposed **DEC-009**) reversing DEC-008.
- Update `AGENTS.md` stack table, root `README.md`, `INTEGRATION.md`.
- Update `memory/PROJECT_STATE.md`, `memory/TODO.md`, `memory/CHANGELOG.md`, `memory/SESSION_LOG.md`.
- Align `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.
- Rotate the hardcoded Firebase Web API key in `functions/admin_api.js` (it is in git history, so rotation is mandatory, not just deletion).

### Phase 6 — Verification (1 day)
- pytest against a test Mongo database + classifier unit tests.
- `npm run build` passes.
- End-to-end manual check: submit → track → admin view.
- `rg -i "firestore|firebase"` returns nothing in tracked source.

---

## 5. Known gaps / risks

- **`/submit-grievance` trusts `userId` from the request body.** Acceptable for a demo-auth prototype; document it in `docs/SECURITY.md` as a known limitation.
- **Firebase key in git history** — rotate, do not rely on deleting the file.
- **`.env` / `serviceAccountKey.json` are untracked secrets** — never commit them (and they become obsolete after Mongo).
- **One shared worktree across branches** — always check the branch before editing; `git checkout <branch> -- <path>` only for deliberately lifting files.
- **`main` protection** — no commits, resets, or checkouts that modify `main`.

---

## 6. Out of scope (this pass)

- Real authentication / user accounts / RBAC.
- Postgres/pgvector and the 21 non-`grievances` entities in `docs/DATABASE.md`.
- Assignments, SLA, escalations, notifications, analytics beyond the current admin charts.
