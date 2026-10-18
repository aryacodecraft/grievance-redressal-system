# CURRENT_STATE.md — Project Snapshot & Remaining Work

> **Single memory entry point** — what exists today and what is left to do.
> This file supersedes the former `PROJECT_STATE.md` and `TODO.md` (archived
> unchanged at `memory/archive/PROJECT_STATE-until-2026-10-18.md` and
> `memory/archive/TODO-until-2026-10-18.md`; consult them for deeper detail
> and pre-2026-10-18 backlog rationale).
> Recent history: `CHANGELOG.md` / `SESSION_LOG.md`; older: `memory/archive/`.
> Decisions: `DECISIONS.md` (grep by topic). Status vocabulary: AGENTS.md
> (PLANNED / IN PROGRESS / IMPLEMENTED / TESTED / VALIDATED / DEFERRED / OPTIONAL).
>
> **Last updated: 2026-10-18.** Keep this file current after every task — edit
> it in place when implementation state or the backlog changes.

---

## 1. Project at a glance

B.Tech academic prototype: **AI-Enabled Grievance Redressal and Decision Support System**
(source of truth: `PRD.md`, `docs/PROJECT_CONTEXT.md`). AI is decision support
only — humans retain assignment, escalation, resolution and closure authority
(AGENTS.md HITL principle). No hard deadline; prototype-grade quality, not production.

| Layer | Current implementation |
|---|---|
| Backend | FastAPI under `backend/app/` (serving path, DEC-010); `uvicorn backend.app.main:app`, port 10000 |
| Database | MongoDB Atlas via `MongoRepository` when `MONGODB_URI` is set; `InMemoryRepository` fallback otherwise (`/health` reports which) |
| Frontend | Next.js 16 + TypeScript + Tailwind v4 in `frontend/`; REST client `lib/api.ts`, session `lib/session.tsx` |
| Auth | JWT access/refresh + Google OAuth + RBAC (DEC-017); optional face login + phone OTP binding behind flags |
| AI/NLP | Keyword → HF Transformers → Groq cascade (`backend/app/services/classification.py`); Sarvam STT for voice; client-side TF-IDF similarity |
| Tests | `tests/` pytest (Mongo tests need `TEST_MONGODB_URI`); `frontend/scripts/check-contract.mjs` + `e2e.mjs`; voice node suites |
| Docs | `docs/*` (ARCHITECTURE, API, DATABASE, SECURITY, DEVELOPMENT, AI_SYSTEM, WORKFLOWS, VOICE_ASSISTED_COMPLAINT) + `memory/rbac/` (docs-only RBAC spec suite) |

---

## 2. Implemented and working (as of 2026-10-18)

- **Grievance lifecycle** — 15-state machine (`backend/app/services/state_machine.py`),
  role-gated transitions, assignment/history arrays; status PATCH restricted to
  ADMIN/RESOLVER. IMPLEMENTED, TESTED (audit-trail completeness still open — §4).
- **Citizen experience** — submit (auth required, GPS, image upload), track
  (master-detail, sign-in required; department/priority not shown to citizens —
  DEC-028/029/030), notifications inbox v1, profile. IMPLEMENTED, TESTED.
- **Staff experience** — admin queue/board + detail modal, analytics (charts,
  map, TF-IDF clusters, CSV), department-employees workspace, resolver workbench
  (ack / progress / hold / escalate / complete), superadmin (users, departments,
  audit), account-scoped notifications. IMPLEMENTED, TESTED.
- **Auth** — email/password + JWT + refresh, Google OAuth, RBAC guards, signup
  with captcha (DEC-031), seeded demo accounts. IMPLEMENTED, TESTED.
  Brute-force rate limiting NOT implemented (§4).
- **Phone/SMS** — India-normalized phone identity, OTP binding, SMS template set
  + Twilio provider code; `SMS_PROVIDER=dry-run` by default (DEC-025/027).
  IMPLEMENTED, TESTED in dry-run; live delivery blocked on DLT/credentials (§4).
- **Face auth (flag-gated, default off)** — enrollment, 1:1 login, recovery
  phrase, liveness challenges, lockout counters, `requireLogin2fa`; in-memory
  stores (DEC-024). IMPLEMENTED, TESTED (face/drift suites); real-webcam
  validation pending (§5).
- **Voice-assisted lodging (flag-gated, default off)** — consent gate,
  AudioWorklet 16 kHz WAV capture, `/transcribe` → Sarvam, title suggestion,
  append/replace/cancel flow (DEC-032–035). Stages 1–11 IMPLEMENTED + handoff
  documented; one live English smoke passed; hi/mr live validation pending (§5).
- **Grievance AI (EXPERIMENTAL)** — category/priority/urgency via the cascade;
  no metrics claimed (DEC-005). Similarity is client-side TF-IDF only.
- **Homepage entrance animation** (DEC-036, 2026-10-18) — reveal-only, verified
  in headless Chrome, reduced-motion and no-JS safe.
- **Test suites** — last full pytest run (2026-10-14): ~480 passed with a known
  failure baseline (§5); contract suite 18 checks; voice node suites 113 tests.

---

## 3. Partial / in progress

- **Worker (resolver) workflow** — mostly complete; manager-facing escalation
  *response* controls missing (§4).
- **Notifications** — in-app only; email/push out of scope for the prototype.
- **Public tracking** — projection works; no dedicated tests.
- **i18n** — en/hi/mr live; 8 packs hidden placeholders; native review pending (§5).
- **Similarity** — client TF-IDF; sentence-transformers deferred until a dataset exists.

---

## 4. Remaining to IMPLEMENT

### AI/ML modules (academic core)

| Module | Status |
|---|---|
| AI-01 Summarization | PLANNED (priority) |
| AI-02 Category classification | prototype cascade, EXPERIMENTAL |
| AI-03 Entity extraction | PLANNED |
| AI-04 Priority/severity | prototype cascade, EXPERIMENTAL |
| AI-05 Urgency/emotion | prototype cascade, EXPERIMENTAL |
| AI-06 Similar/duplicate detection | partial (client TF-IDF only) |
| AI-07 Assignment recommendation | PLANNED |
| AI-08 Delay-risk estimation | PLANNED |
| AI-09 Escalation support | PLANNED |
| AI-10 Resolution quality | PLANNED (priority) |
| AI-11 Insights | OPTIONAL |

- **AI analysis persistence** — store module id, model version, timestamp and
  confidence alongside each analysis result (PLANNED).

### Security & audit hardening

- Brute-force rate limiting on `/auth/login`, `/auth/refresh`, `/auth/register`
  (in-memory v1 acceptable; mirror the face lockout counters). Also open gap #8
  in `memory/rbac/AUTHENTICATION.md`.
- Rotate the Firebase web API key (compromised key in git history) and Atlas
  credentials; restrict the Atlas IP allowlist.
- Fix SSRF in `backend/app/services/image.py`; add auth to the
  `/delete-cloudinary` and `/sign-cloudinary` endpoints.
- Persist `imageValidation`/`publicId` so image decisions are auditable.
- Add `/readyz` (liveness separate from the config-only `/health`).
- Verify audit-trail completeness: every state modification should log actor,
  previous → new state, timestamp and source (Human vs AI). (Old TODO §1 item;
  no such logging found on the status path yet.)

### Face auth

- Mongo persistence for templates/challenges/rate-limit counters (currently
  in-memory, reset on restart).
- Anti-spoof model: `FACE_ANTISPOOF_MODEL_PATH` wiring exists, no ONNX bundled.
- `GET /auth/face/status` should expose `requireLogin2fa`.

### SMS / phone

- TRAI DLT registration (entity + template set from archived TODO §13.6) and
  Twilio with India SMS enabled (prefer Messaging Service SID) — CREDENTIALS REQUIRED.
- Durable dedup + rate-limit counters shared across workers.
- Update face-auth test expectations for the verified-phone login gate; add
  endpoint tests for phone flows.
- Defer phone collection on the legacy `/register` path.
- Error i18n keys for all 11 locales (`MessageKey`-derived set).

### Voice

- Department/category inference from transcripts (not yet built).
- Shared/durable quota accounting before running multiple workers/instances.
- Finish guarded-launcher runtime verification (Stage 10 diagnostic guard).
  Local Mongo-backed login was verified working on 2026-10-18, so the Stage 11
  "not restored" note is no longer current.

### Staff workflows & i18n

- Manager-facing escalation ticket response controls.
- Deeper department-manager controls.
- RBAC spec suite (`memory/rbac/`): owner confirmations (role-name mapping,
  department model, UPPER-state canonical, demo-mode flag) + Phase 0 build per
  `memory/rbac/IMPLEMENTATION_CHECKLIST.md`; fix stale `docs/SECURITY.md` /
  `docs/API.md` auth headers during that build.
- Multi-item translation work (dynamic bidirectional translation, multilingual
  AI/NLP pipeline) — DEFERRED until an AI workstream starts.

### Ops & environment

- Render: set `MONGODB_URI` / `MONGODB_DB` environment variables.
- Run `tools/backfill_departments.py` against Atlas (legacy grievances missing `departmentId`).
- Owner run: `SEED_TEST_ACCOUNTS=true` + `NEXT_PUBLIC_SHOW_DEV_CREDS=true`,
  restart both, verify seeded logins.
- Optional cleanup: rename `components/admin/AdminNav.tsx` (now only exports `AdminHeader`).

### Testing infrastructure

- Jest + RTL component tests (not installed).
- State-machine transition tests.
- Browser-level role/workflow tests.
- AI evaluation protocol runs (see §5).

---

## 5. Remaining to TEST / VALIDATE

**Live / external (credentials, hardware or authorization needed):**

- Live Hindi/Marathi STT (Sarvam) — mock-covered only; one live English smoke passed.
- Live SMS delivery — blocked on DLT + Twilio credentials.
- Real-webcam face enroll/login; tune `FACE_TURN_MIN_DEGREES`,
  `FACE_BLINK_EAR_DROP`, `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`,
  `FACE_MIN_FACE_PX` via env (no code change needed).
- Voice provider checks: workspace retention, auto-recharge disabled, concurrency
  limits (separately authorized).
- Production-level HTTPS/CORS/load checks.

**Manual / accessibility / cross-browser:**

- Screen-reader passes: voice keywords/focus (Stage 7), whole-page flow (Stage 9)
  on NVDA/Narrator/VoiceOver.
- Keyboard flow on real pages; Firefox + Safari; physical/mobile devices.
- Visual passes: orange/black palette across `/`, `/login`, `/submit`, `/track`,
  `/admin`, `/admin/analytics`, `/resolver`; department dropdown at ~1024px;
  face tabs (`/login` face tab, `2FA` step, `/signup/face`, `/re-enroll`, `/profile`).

**Suite health:**

- Full pytest re-run + triage of the known baseline: 370 passed / 22 failed
  (2026-10-10) and ~480 passed / 23 failed (2026-10-14) — mostly stale DEC-006
  status-vocabulary and i18n expectations. Exact failure names are in
  `memory/archive/TODO-until-2026-10-18.md` §11. Decide fix vs retire per test.
- Env-specific: `test_face_auth.py::TestFaceService::test_tunable_defaults_are_pinned`
  fails only with the developer's local `backend/.env` `FACE_CHALLENGES` override
  (passes with the stock `.env.example`).
- Frontend lint baseline: 4 pre-existing `FaceCapture` errors + 4 warnings —
  keep at or below; fix when touching that component.

**AI evaluation (DATASET REQUIRED, DEC-005):**

- Nothing may be marked VALIDATED. Metrics/approach are defined in
  `docs/AI_SYSTEM.md`; the evaluation protocol has not been executed.

---

## 6. Known issues / risks

- Firebase API key compromised in git history (rotation pending); Atlas
  credentials weak + allowlist unset.
- `/health` reports configuration, not DB reachability (by design; `/readyz` missing).
- In-memory fallback is non-persistent when `MONGODB_URI` is absent.
- `imageValidation` not persisted → no image audit trail.
- Voice/SMS quota counters are process-local (reset on restart).
- Local stack is environment-dependent: it was down at the Stage 11 handoff,
  but backend + Mongo + citizen login were verified working locally on 2026-10-18.
- `frontend/AGENTS.md` and `CLAUDE.md` are create-next-app artifacts, not project rules.
- **Contract-sensitive surfaces** (don't break without updating tests/contracts):
  REST routes (contract checker), 11-locale i18n message keys, status vocabulary,
  seeded test accounts (`frontend/lib/testAccounts.ts`).

---

## 7. Operational defaults & quick facts

- Flags default **OFF**: `TRANSCRIPTION_ENABLED`, `FACE_AUTH_ENABLED`.
  `DIAGNOSTIC_SKIP_INITIALIZATION_WRITES` is a diagnostic-only guard — keep false.
- SMS: `SMS_PROVIDER=dry-run` default; `OTP_DEBUG_RETURN_CODE` returns codes for
  local debugging only.
- Ports: backend `10000`, frontend dev `3000`.
- Seeded logins: `SEED_TEST_ACCOUNTS` (backend `.env`) +
  `NEXT_PUBLIC_SHOW_DEV_CREDS` (frontend `.env.local`); account list in
  `frontend/lib/testAccounts.ts`.
- Mock mode: `NEXT_PUBLIC_USE_MOCKS=true` (frontend-only demo path).
- Contract checks: `node frontend/scripts/check-contract.mjs` (keep 18 checks green).
- Browser verification for this repo: use the Playwright Chromium binary —
  the system `google-chrome-stable` wrapper is broken (see SESSION_LOG notes).

---

## 8. Suggested next steps

1. Fresh full pytest run; triage the baseline failures (§5).
2. Security hardening batch: rate limits, SSRF, Cloudinary auth, key rotations (§4).
3. Restore local Mongo login + set the Render env vars (§4 Ops).
4. Pick the next AI module (AI-01, AI-07 or AI-10) and persist analysis results
   with module id/model version.
5. Work the manual/live validation queue (§5) as credentials/hardware become available.
