# PROJECT_STATE.md — Current Implementation State

> This file describes the **current state** of the project only.
> History belongs in `CHANGELOG.md` and `SESSION_LOG.md`.
> Last updated: 2026-10-10 (plan recorded for India phone numbers, OTP-proven phone↔face binding, and Twilio SMS stage notifications — `memory/TODO.md` §13, **PLANNED**, nothing implemented)

---

## Current Phase

**Migration plan Phases 1–6: COMPLETE** ⬤ (2026-10-01)
- Phase 1 + 1.5 frontend de-Firebase + parity — `1857ee3..0b438b8`
- Phase 2 FastAPI rewrite — `e55a9a3..d1c9c6d`
- Phase 3 MongoDB persistence + Firebase config/Flask retirement — `c44d410..aae4b74`
- Phase 4 legacy UI retirement — `09e83af`
- Phase 5 docs/config alignment — `cfdb7d1`, `4e52990`, `4686f81`
- Phase 6 pytest suite + end-to-end verification — `f6e2890`, `98ec1f3`

(per-item record in git history and `memory/CHANGELOG.md`)

Per DEC-010/DEC-011: `backend/app/` (FastAPI, `uvicorn backend.app.main:app`)
is the serving path; persistence is `MongoRepository` when `MONGODB_URI` is
set, otherwise the in-memory fallback, both behind the `GrievanceRepository`
protocol. `backend/server.py`, `functions/`, `adfbh`, `firebase.json`,
`.firebaserc`, `firestore.rules` and `firestore.indexes.json` are **deleted**.

**Remaining backlog** is no longer migration work: ~~MongoDB Atlas setup (owner)~~
**done 2026-10-02**, Firebase key rotation, deeper department-manager controls,
browser workflow validation, and AI evaluation. Resolver, superadmin, analytics,
live history, and core role-routing surfaces are now present.

---

## Current Architecture

```
backend/app/   — FastAPI service (grievances/images/health routers,          IMPLEMENTED (serving path, DEC-010;
                 classification/image services, MongoRepository +             Mongo behind GrievanceRepository,
                 in-memory fallback, /health reports storage mode)            DEC-011)
tools/         — recategorize.py (batch re-classification over MongoDB;       IMPLEMENTED (imports shared
                 imports shared classifier, supports --dry-run)                classifier)
tests/         — pytest suite (classifier, cascade, endpoints, repository,      IMPLEMENTED (DEC-012/DEC-016; 207 tests +
                 id allocation, image validation, config drift,                 18 frontend contract checks; Mongo
                 security baseline, status vocabularies; Mongo tests            tests skip when no DB is reachable)
                 skip when no DB is reachable)
frontend/      — Next.js 16 (TS, Tailwind v4): REST client, demo auth,       IMPLEMENTED (Firebase removed; live mode
                 admin map/clusters/filters, citizen my-grievances)            works against backend/app; zod schemas
                                                                               pinned by check-contract.mjs)
docs/          — Technical documentation; ARCHITECTURE/API/SECURITY/          IMPLEMENTED (aligned to the real
                 DEVELOPMENT annotated with implemented-vs-planned             stack, DEC-013)
memory/        — AI agent persistent memory                                  IMPLEMENTED
```

---

## Implemented

### Documentation
- `README.md`, `PRD.md`, `AGENTS.md`
- `docs/ARCHITECTURE.md`, `DATABASE.md`, `AI_SYSTEM.md`, `WORKFLOWS.md`
- `docs/API.md`, `SECURITY.md`, `DEVELOPMENT.md`, `PROJECT_CONTEXT.md`
- All `memory/` files

### Frontend (`frontend/`) — Phase 1 + 1.5 complete (2026-09-11)
- Next.js 16 + TypeScript + Tailwind CSS v4 + ESLint — **IMPLEMENTED**
- App Router routes: `/`, `/submit`, `/track`, `/admin`, `/admin/analytics`, `/login`, `/register` (10 build outputs)
- Packages: `axios`, `recharts`, `react-hook-form`, `zod`, `@tanstack/react-query`,
  `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`, `leaflet` (+`@types/leaflet`);
  **`firebase` and `next-auth` removed**
- `lib/session.tsx` — demo localStorage provider (`user`, `liveMode`, `signInDemo`, `signOut`); real auth DEFERRED
- `lib/roles.ts` — admin allowlist + role resolution (source of truth until real auth)
- `lib/grievances.ts` — REST polling (15s) replacing Firestore `onSnapshot`
- `lib/api.ts` — typed client: `submitGrievance`, `listGrievances`, `getGrievance`,
  `updateGrievanceStatus`, image + health helpers
- `lib/tfidf.ts` + `components/admin/AdminMap.tsx` / `AdminClusters.tsx` — legacy parity, now surfaced on `/admin/analytics` (DEC-018)
- `lib/sla.ts` — prototype deterministic SLA indicator (`Overdue`/`On Track`/`Closed`); DEC-018
- `components/admin/AdminBoard.tsx` — lean full-width triage **table** (KPI cards, department tabs, filters, SLA column, pagination); row opens `GrievanceReviewModal` for live assign/resolve
- `components/admin/AdminAnalytics.tsx` + `app/admin/analytics/page.tsx` — executive dashboard (macro metrics, charts, map, clusters); CSV exports built in `lib/report.ts` (`buildComplaintsCsv` flat list + `buildSummaryCsv` department-wise summary)
- `components/admin/{AdminGate,AdminNav,useAdminGrievanceFeed,departments}.tsx|ts` — shared admin chrome/data (DEC-018)
- `components/grievance/MyGrievances.tsx` — citizen's own submissions on `/submit`
- **`lib/firebase.ts` deleted** — frontend has no Firebase dependency
- TypeScript check: **passes with no errors**; `npm run build` passes (9 routes)
- **Live mode works** against `backend/app` (Phase 2) — `GET/PATCH /grievances*`
  implemented and smoke-tested (see Backend)

### Backend (`backend/`)
- `backend/app/` — **FastAPI serving path (DEC-010)**: `main.py` (app, CORS,
  `400 {"error": …}` validation handler), `config.py` (python-dotenv),
  `models.py`, `db.py` (`GrievanceRepository` protocol — `MongoRepository` when
  `MONGODB_URI` set, in-memory fallback otherwise; `/health` reports `storage`),
  `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py`
  (ported verbatim from the old `server.py`; `CATEGORY_KEYS` = frontend `CATEGORIES`) — **IMPLEMENTED**
- Verified: in-process `TestClient` smoke test — health, `POST /submit-grievance`
  (200; AI refinement degrades to keywords without keys), `GET /grievances`
  (+`?userId=` scoping), `GET /grievances/{id}`, `PATCH /grievances/{id}/status`, 404s
- `backend/server.py` — **DELETED** (Phase 3): the legacy Flask + Firestore
  server was retired after its classifier/image logic was ported to `backend/app/`
- `tools/recategorize.py` — batch re-run of classifiers over **MongoDB** (imports
  the shared classifier; `--dry-run` supported) — **IMPLEMENTED**
- ~~`functions/tfidf.js`~~ — **DELETED** (Phase 4); its TS port
  `frontend/lib/tfidf.ts` is the live implementation
- Historic note: the `Idea Lab` FastAPI scaffold was deliberately NOT copied at
  unification (DEC-008) — `backend/app/` is a **fresh** Phase 2 implementation,
  not that scaffold; SQLAlchemy/Alembic/Postgres-era PLANNED items remain SUPERSEDED

### Database
- **MongoDB Atlas (live)** — `MONGODB_URI`/`MONGODB_DB` set in `backend/.env`
  (2026-10-02); `/health` reports `storage: "mongodb"`, the `grievance.grievances`
  collection and both indexes exist on the cluster (server 8.0.34)
- **MongoDB** via `MongoRepository` (`backend/app/db.py`) — **IMPLEMENTED
  (Phase 3, DEC-011)**; selected by `MONGODB_URI`/`MONGODB_DB` (see
  `backend/.env.example`), indexes (`uniq_grievance_id`, `user_created`
  `userId+createdAt` compound) created at startup, `createdAt` stored as BSON date
- **Grievance ids are allocated from stored data** — `GRV-<year>-<seq>` with
  `<seq>` = highest stored tail for the year + 1, retried on unique-index
  collision (**DEC-014**, 2026-10-02). Replaces an `itertools.count` that reset
  per process and made the first submission after any restart fail with
  `DuplicateKeyError`
- **In-memory fallback** (`InMemoryRepository`, same protocol) — **IMPLEMENTED**;
  used when `MONGODB_URI` is unset so the API boots without a database
  (non-persistent by design; `/health` reports `storage: in-memory`)
- ~~Firestore / `firebase-admin`~~ — **DELETED** (Phase 3); `backend/server.py`,
  `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` gone
- ~~Alembic / PostgreSQL / SQLAlchemy~~ — never copied; SUPERSEDED
- `docs/DATABASE.md` — **rewritten for MongoDB** (Postgres entities moved to a roadmap section)

### Authentication — Phase 1 complete (2026-10-03, DEC-017)
- **JWT + Google OAuth 2.0 + RBAC** — **IMPLEMENTED** (DEC-007, DEC-017):
  - `backend/app/auth.py`: stateless JWT encode/decode, access (60m) & refresh (7d) tokens, `get_current_user`, `get_optional_user`, `require_role(["ADMIN", ...])`
  - `backend/app/users_db.py`: `MongoUsersRepository` (MongoDB Atlas `users` collection) + `InMemoryUsersRepository` fallback
  - `backend/app/routers/auth.py`: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/google`, `/auth/google/callback`
  - Server-side RBAC enforced on grievances endpoints: `submit-grievance` derives identity from verified token; `GET /grievances` scopes citizens to own submissions; `PATCH status` requires ADMIN/RESOLVER
  - Idempotent startup admin seeding via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
  - `frontend/lib/session.tsx`: full session provider with `login()`, `register()`, `/auth/me` on mount
  - `frontend/lib/api.ts`: automatic `Bearer` header injection and token refresh on 401
  - `frontend/app/login/page.tsx` & `app/register/page.tsx`: real auth forms + Google OAuth sign-in button
  - `frontend/app/auth/callback/page.tsx`: Google OAuth redirect handler
- **Tests**: `tests/test_auth.py` (30 tests) + inverted `tests/test_security_baseline.py` — 202 passed across full suite

### Face authentication — IMPLEMENTED, flag-off default (2026-10-09, DEC-024, `feature/face-auth`)
- **Optional 1:1 face login** — **IMPLEMENTED** behind `FACE_AUTH_ENABLED`
  (default false; `/auth/face/*` 404s via `FaceRouteGuard`, `GET /config`
  exposes `{faceAuthEnabled}` and the UI hides all face options):
  - `backend/app/services/face_service.py` — lazy InsightFace embedder,
    Fernet-encrypted 512-d templates (never images), fail-closed quality
    (face count/size/blur/det score), server-side liveness
    (turn/blink/smile), optional ONNX anti-spoof, `MODEL_MISMATCH` re-enroll
  - `backend/app/repositories/face_templates.py` — in-memory templates,
    single-use TTL challenges, TTL rate-limit counters
  - `backend/app/routers/face_auth.py` — challenge/enroll/login/
    verify-second-factor/status/template PATCH+DELETE + superadmin revoke;
    generic 401s; audits (`face.*`) with reason codes, never embeddings
  - Privileged optional step-up (`requireLogin2fa`, default off): password/
    Google logins pause with a 5-min `pending_2fa` token; **convenience, not
    a security control** — lockout falls back to password-only and
    `complete-pending` completes only an actually-locked-out account (403
    otherwise). RBAC/`require_role` unchanged (full tokens from face login).
  - Frontend: flag-gated Password/Face tabs on `/login`, `FaceCapture`
    component, 2FA step with skip, `/profile` consent/enroll/re-enroll/
    delete/require-2FA, superadmin "Revoke face", i18n ×11 packs
  - Env-tunable thresholds: `FACE_TURN_MIN_DEGREES`, `FACE_BLINK_EAR_DROP`,
    `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`, `FACE_MIN_FACE_PX`
  - Open follow-ups (TODO §10): real-webcam validation, anti-spoof model
    provisioning, Mongo persistence for face stores, status/`requireLogin2fa`
    readback. Optional deps: `backend/requirements-face.txt`

### India phone numbers, phone↔face binding, Twilio SMS — PLANNED only (2026-10-10, TODO §13)
- **Nothing here is implemented.** Full plan in `memory/TODO.md` §13; no DEC
  recorded yet because the load-bearing choices are still open questions.
- **Already present in the tree** (verified before planning — do not rebuild):
  `normalize_phone()` (`users_db.py:20`, strips `+91`/`91`/`0`, accepts only 10
  digits starting `6-9`), `find_by_phone`, `find_by_identifier`, the
  `uniq_user_phone` index, and `POST /auth/face/login` which **already accepts a
  phone as the identifier**. `/signup/face` already collects phone with consent.
- **Actual gaps**: no E.164 export for the SMS provider; no frontend phone
  validation; phone is **claimed but never verified** (so face-login-by-phone
  authenticates against an unverified identifier — the highest-value fix in the
  plan); no binding of a phone to an existing email account; and no SMS
  transport (`repositories/notifications.py` still reads "in-app v1, no
  email/SMS").
- **Blocking external prerequisite**: TRAI DLT registration — entity, a
  6-character sender ID, and pre-registered content templates. Carriers drop
  unregistered/free-form SMS, so this decides whether the feature works in India
  at all. Marked `CREDENTIALS REQUIRED`.
- **Planned shape**: `SMS_PROVIDER` defaults to `dry-run` so the repo runs with
  zero credentials and only the live-send phase needs DLT; SMS is fire-and-forget
  async and must never fail a grievance state change; message bodies are fixed
  templates with slots and 160-char capped (reasons stay in-app only); a
  `STAGE_SMS_LABEL` map keeps enum values away from citizens; OTP-proven binding
  gates phone login on `phoneVerifiedAt`.
- **HITL (non-negotiable)**: SMS is informational only — no message may trigger
  or authorise an administrative action.
- Two separate DPDP Act 2023 consents are required: face biometrics (exists) and
  SMS updates (new, unchecked by default).

### AI Modules
- Working classifiers in `backend/app/services/classification.py` (ported from
  `backend/server.py`) + `frontend/lib/tfidf.ts` —
  **IMPLEMENTED** (map to AI-02/AI-04/AI-05/AI-06; evaluation status: EXPERIMENTAL
  per DEC-005 — no metrics claimed)
- ~~AI stub files~~ — not copied; SUPERSEDED

### Analytics
- Admin board in `frontend/components/admin/` (queue table, filters, review modal,
  stats) and `/admin/analytics` (charts, map, TF-IDF clusters, CSV export) —
  **IMPLEMENTED** (DEC-018); AI-11 analytics PLANNED
- ~~Legacy admin HTML (`functions/admin.html`, `functions/admin_ui.js`, root `adfbh`)~~ —
  **DELETED** (Phase 4); superseded by the Next.js admin board

### Testing
- `tests/` (13+ files, **355 tests** incl. 106 face + 15 config-drift) +
  `pytest.ini` + `requirements-dev.txt` —
  **IMPLEMENTED (Phase 6, DEC-012; expanded 2026-10-02 per DEC-016; face
  suite 2026-10-09 per DEC-024)**:
  classifier unit tests incl. the `CATEGORY_KEYS` ↔ `CATEGORIES` contract,
  endpoint tests over `TestClient`, both repository implementations + the
  shared list contract, DEC-014 id-allocation regressions, image-validation
  threshold, classifier cascade under provider outage, config drift across
  `config.py` / both `.env.example` files / `render.yaml`, a **security
  baseline** that asserts today's insecure behaviour on purpose, the four
  conflicting status vocabularies, and the face-auth suite (synthetic
  checkerboard frames + a fake detection seam — no camera or model download
  in CI). Mongo tests skip unless `TEST_MONGODB_URI` is reachable —
  `pytest` currently runs **333 passed / 22 failed**; the 22 failures are a
  pre-existing baseline of stale DEC-006/i18n expectations, listed by name in
  `memory/TODO.md` §11, unrelated to face auth.
- `frontend/scripts/check-contract.mjs` — **IMPLEMENTED (2026-10-02)**: 18
  offline checks with a stubbed `fetch` — `roleForEmail`/`isAdminEmail`
  (incl. the `BASELINE` substring escalation), the `useMocks()` switch, and the
  zod schemas against backend-shaped JSON. Runs without a backend
- `frontend/scripts/e2e.mjs` — **IMPLEMENTED (Phase 6)**: imports the real
  `lib/api.ts` so responses are zod-validated by the schemas the UI uses
- Six divergences found and fixed while writing the suite (DEC-016): `limit=0`
  and negative limits meant opposite things per backend; the in-memory list
  broke `createdAt` ties by priority while Mongo did not; `PATCH status=""` was
  stored verbatim; unrouted 404/405 returned `{"detail"}` which the client
  never reads; `/health` claimed `in-memory` while requests went to MongoDB;
  and `hfEngineSchema` omitted `categoryConfidence`, which zod stripped so the
  confidence display worked on mocks but not live data
- Verified end-to-end (Phase 6): live `uvicorn` on `:10000` — submit/list/get/
  PATCH/404/400, and the in-memory fallback when `MONGODB_URI` is unset
- Re-verified against **real MongoDB Atlas (2026-10-02)**: `e2e.mjs` PASSED
  through the real zod-parsing client (submit → track → admin assign/resolve →
  re-read, error path, second citizen); persistence across a **genuinely
  recycled** process (the earlier restart check had silently not restarted);
  `pytest` leaves Atlas untouched; all 7 frontend routes serve
  200; `tsc --noEmit` + `npm run build` clean. *(DOM not driven — no desktop
  browser connected)*
- Cloudinary verified live (2026-10-02): unsigned preset `grievance app` on
  cloud `dnw1p9dnk` accepts uploads, and `/validate-image` (heuristic fallback,
  score 18.4 → rejected below the threshold of 60), `/delete-cloudinary`,
  `/sign-cloudinary` all return 200 — the preset's unsigned-ness is no longer
  an open question
- Component tests (Jest + React Testing Library), state-machine tests and the
  AI evaluation protocol — **PLANNED**

---

## Partially Implemented

- **Worker workflow** — IN PROGRESS: resolver dashboard includes workload metrics, dedicated `GET /resolver/tasks` owner-scoped loading (with assignment-notification recovery), direct task selection, acknowledgement/start, hold reasons, daily updates, escalation, manager-reviewed completion, and activity history. Task queue visibility is independent of department aliases; manager employee lists and assignment validation normalize legacy/display labels to canonical department keys. Load failures are visible, and the queue refreshes periodically. Department employee account management and task allocation are available in `/admin/employees`. Manager ticket responses and browser validation remain.
- **Public reference tracking** — IMPLEMENTED: reference-ID detail lookup works signed out and for non-owner accounts using a limited public status projection; public history contains customer-visible/system entries only. History loading cannot mask a found grievance as missing, IDs are normalized case-insensitively, and full grievance-list access requires authentication.
- **Notifications** — IMPLEMENTED (in-app v1): account-scoped inbox at `/notifications`, unread badges and polling for citizen/staff navigation, toast popups for newly received notifications and key local actions, citizen registration/status updates, employee assignment/reassignment updates, and manager escalation/resolution events. Email/push delivery and browser-level validation remain out of scope.

*(None — scaffolding is complete but no business logic yet)*

---

## Planned

> PHASE 2–4 below assumed the FastAPI/Postgres stack — SUPERSEDED by DEC-008
> and then by DEC-010/DEC-011 (FastAPI + MongoDB now *is* the stack; DEC-002 is
> marked superseded). Retained for reference.
- **PHASE 2 (SUPERSEDED):** ~~PostgreSQL schema, Alembic migrations, SQLAlchemy models~~
- **PHASE 3 (SUPERSEDED):** ~~JWT + Google OAuth + RBAC (FastAPI)~~ — Firebase Auth is the temporary reality
- **PHASE 4 (SUPERSEDED):** ~~Grievance CRUD + lifecycle state machine (original FastAPI plan)~~ — `/submit-grievance` (FastAPI `backend/app`) is the working path (the old Flask path was deleted in Phase 3)
- **PHASE 5**: User / Resolver / Admin UI in Next.js — IN PROGRESS (citizen, admin, resolver `/resolver`, superadmin `/superadmin`, tracking history, and analytics are present; department-manager assignment controls and browser validation remain)
- **PHASE 6**: AI analysis — PARTIALLY IMPLEMENTED via `backend/app/services/classification.py` (ported from the deleted `backend/server.py`; EXPERIMENTAL per DEC-005)
- **PHASE 7**: Assignment recommendation — PLANNED
- **PHASE 8**: Similarity — PARTIALLY IMPLEMENTED via `frontend/lib/tfidf.ts` (client-side); Sentence-Transformers path deferred
- **PHASE 9**: SLA monitoring / escalation — PLANNED
- **PHASE 10**: Resolution quality assessment — PLANNED
- **PHASE 11**: Analytics dashboard — legacy HTML exists; Next.js dashboard PLANNED
- **PHASE 12**: Testing + AI evaluation — backend suite **IMPLEMENTED** (Phase 6,
  DEC-012; expanded to 207 tests + 18 frontend contract checks on 2026-10-02,
  DEC-016); AI evaluation protocol and component tests PLANNED

**Unification follow-ups (this branch's backlog):**
1. ~~Owner confirms canonical backend/DB/auth stack; update `AGENTS.md` + `docs/ARCHITECTURE.md`~~ — **DONE 2026-10-01** (Phase 5; auth stack itself still open)
2. ~~Firebase-removal branch~~ — **DONE** (Phase 4 removed `functions/` + `adfbh`; only the key in git history remains)
3. ~~Wire Next.js frontend to backend~~ — **DONE** (`lib/api.ts` ↔ `backend/app`, both on `:10000`; smoke-tested 2026-09-11)
4. Hygiene — ~~`.gitignore`/`__pycache__`/UTF-16 requirements~~ DONE (all three verified; `backend/requirements.txt` rewritten as ASCII in Phase 3); ~~decide `adfbh`~~ DONE (deleted Phase 4); remaining: **rotate the hardcoded Firebase key**
5. ~~New root README describing the unified repo~~ — DONE 2026-09-11 (root `README.md`)

---

## Known Issues

- `frontend/AGENTS.md` and `frontend/CLAUDE.md` were auto-generated by `create-next-app@16.3.0`.
  Review their content if Next.js AI tooling conflicts with project conventions.
- ~~`AGENTS.md` tech-stack table (FastAPI/PostgreSQL)~~ — **RESOLVED 2026-10-01**
  (Phase 5: Backend annotated `backend/app/`, Database → MongoDB per DEC-011,
  DEC-002 marked SUPERSEDED, Auth row marked *planned*).
- ~~`.gitignore` binary / UTF-16 `requirements.txt` / committed `__pycache__`~~ —
  all FIXED (verified 2026-09-11: `.gitignore` is UTF-8 text with `__pycache__`
  ignored, 0 tracked pyc files, `backend/requirements.txt` is ASCII).
- ~~`adfbh` — unidentified duplicate admin HTML~~ **DELETED** (Phase 4).
- Hardcoded Firebase Web API key (was in `functions/admin_api.js`, file deleted
  in Phase 4) — **still exposed in git history; rotation is mandatory**, and
  deleting the file did not remove it. Open.
- `POST /submit-grievance` now requires a verified JWT and derives `userId`
  from the token; the frontend also gates `/submit` behind sign-in. Legacy
  image/admin routes and some list/status compatibility behavior remain under
  the broader security-hardening backlog.
- **SSRF:** `services/image.py` fetches whatever `imageUrl` the client sends
  (`requests.get`, no scheme/host/IP/size checks) — an internal host such as
  `169.254.169.254` is reachable from the server. Pinned as a `BASELINE` test;
  Phase 1 input validation.
- **`/delete-cloudinary` / `/sign-cloudinary` are unauthenticated** — any
  caller can delete or sign assets on the project's Cloudinary account. Phase 1.
- Client-side demo auth remains available when mocks are enabled; `roleForEmail`
  now uses explicit account patterns and no longer promotes arbitrary
  addresses containing `admin`.
- `/health` reports **configuration, not reachability** (DEC-016 §4): a cluster
  that dies after boot keeps reporting `storage: mongodb`, and a repository that
  cannot answer still yields `status: "ok"`. Intentional — a ping would stall
  the deployment health check for 8 s exactly when the DB is down. A separate
  `/readyz` should carry liveness when hardening happens.
- In-memory fallback repository is non-persistent by design — only used when
  `MONGODB_URI` is unset; `/health` reports which storage is active.
- **`imageValidation` is not persisted.** `SubmitForm` posts `imageUrl` only,
  so the Cloudinary `publicId` and the validation score never reach the
  document — the image cannot later be deleted via `/delete-cloudinary`, and
  there is no audit trail of what the validator decided. Client, model and
  router all need the extra fields.
- The Atlas database password is short (4 digits) and was pasted into a chat
  transcript; combined with a `0.0.0.0/0` network allowlist that is
  brute-forceable. Rotation is the owner's action — same class of problem as
  the Firebase key below.

---

## Current Blockers

- ~~MongoDB Atlas setup~~ — **RESOLVED 2026-10-02**: cluster provisioned,
  `MONGODB_URI`/`MONGODB_DB` set in `backend/.env`, persistence verified across
  a real restart. (Render still needs the same vars filled in for deployment.)
- Auth stack still undecided (DEC-010/DEC-011 cover backend + persistence
  direction; demo/localStorage auth in the frontend remains temporary).
- LLM provider: Groq + HuggingFace in use (`GROQ_API_KEY`, `HF_API_TOKEN`,
  now read by `backend/app/config.py`); OQ-001 in PRD.md effectively answered —
  confirm and close.

---

## Important Integration Points

- Frontend (Next.js) ↔ Backend: REST/JSON — contract defined by
  `frontend/lib/api.ts` and implemented by `backend/app/routers/*`
  (`/submit-grievance`, `/grievances{,/{id}{,/status}}`, `/validate-image`,
  `/sign-cloudinary`, `/delete-cloudinary`, `/health`); FastAPI on `:10000`
  matches `frontend/.env.example` (smoke-tested 2026-09-11).
- Backend ↔ Database (current): `MongoRepository` (pymongo) when `MONGODB_URI`
  is set, in-memory fallback otherwise — both behind `GrievanceRepository`
  (`backend/app/db.py`); `MONGODB_DB` default `grievance`.
- Backend ↔ AI: in-process calls in `backend/app/services/classification.py`
  (HF zero-shot → Groq → keyword fallback; ported from `backend/server.py`).
- Backend ↔ LLM APIs: `GROQ_API_KEY` / `GROQ_MODEL`, `HF_API_TOKEN` env vars.
- Batch re-classification: `tools/recategorize.py` (MongoDB; imports the shared classifier from `backend/app/services/classification.py`).
- Similarity (current): client-side `frontend/lib/tfidf.ts` (port of `functions/tfidf.js`).

---

## Immediate Next Steps

> **Decided roadmap order (2026-10-01, owner-confirmed):** Phase 0 checkpoint
> ship (push + `--no-ff` merge `feature/unified-system` → `app/intialise` →
> `main`) → Phase 1 JWT auth + RBAC → Phase 2 DEC-006 state machine + history →
> Phase 3 UI completeness → Phase 4 AI evaluation (deferred, "later") → ship.
> Auth scope is **JWT only**; Google OAuth deferred.

1. **Phase 0 — checkpoint merge.** Push and `--no-ff` merge
   `feature/unified-system` → `app/intialise` → `main` (owner's call; `main` has
   a protection rule). All work so far is **local and unpushed**.
2. Rotate the hardcoded Firebase Web API key — still in git history; and
   rotate/narrow the Atlas credentials noted under Known Issues.
3. Phase 1: JWT auth + RBAC (`DEC-007`) on a fresh branch, making the server
   derive `userId` from the verified token — closes the documented
   highest-risk gap in `docs/SECURITY.md`.
4. Phase 2: DEC-006's 12 uppercase states as a server-enforced transition
   machine with audit history (`PATCH /grievances/{id}/status` currently accepts
   any string, unauthenticated, with no history).
5. Phase 3 UI completeness; Phase 4 AI evaluation deferred.
6. Fill `MONGODB_URI`/`MONGODB_DB` into the Render environment for deployment.

See `memory/TODO.md` for the full prioritized task backlog.
