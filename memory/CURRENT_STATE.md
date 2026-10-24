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
> **Last updated: 2026-10-24.** Keep this file current after every task — edit
> it in place when implementation state or the backlog changes.

---

## 1. Project at a glance

B.Tech academic prototype: **SAMARTH — System for Accessible Management, Action, Resolution and Tracking of Hearings**
(formerly GrievAI; PRD.md, docs/PROJECT_CONTEXT.md). AI is decision support
only — humans retain assignment, escalation, resolution and closure authority
(AGENTS.md HITL principle). No hard deadline; prototype-grade quality, not production.

| Layer | Current implementation |
|---|---|
| Backend | FastAPI under `backend/app/` (serving path, DEC-010); `uvicorn backend.app.main:app`, port 10000 |
| Database | MongoDB Atlas via `MongoRepository` when `MONGODB_URI` is set; `InMemoryRepository` fallback otherwise (`/health` reports which) |
| Frontend | Next.js 16 + TypeScript + Tailwind v4 in `frontend/`; REST client `lib/api.ts`, session `lib/session.tsx`; SAMARTH official emblem & favicon (DEC-048) |
| Auth | JWT access/refresh + Google OAuth + RBAC (DEC-017); optional face login + phone OTP binding behind flags |
| AI/NLP | Local word+character TF-IDF + LogisticRegression → civic-scope gate → deterministic keyword fallback → HF/Groq only for remaining in-scope uncertainty (`backend/app/services/classification.py`); Sarvam STT for voice; client-side TF-IDF similarity |
| Tests | `tests/` pytest (Mongo tests need `TEST_MONGODB_URI`); `frontend/scripts/check-contract.mjs` + `e2e.mjs`; voice node suites. Citizen-side manual suite documented in `docs/USER_SIDE_TEST_CASES.md` (170 cases + 12 E2E, **not executed**) |
| Docs | Root `README.md` is the evaluation-ready entry point for setup, roles, features, limits, demo accounts/data, tests and deployment; details live in `docs/*` and `memory/rbac/` |

---

## 2. Implemented and working (as of 2026-10-20)

- **Grievance lifecycle** — 15-state machine (`backend/app/services/state_machine.py`),
  role-gated transitions, assignment/history arrays; status PATCH restricted to
  ADMIN/RESOLVER. IMPLEMENTED, TESTED (audit-trail completeness still open — §4).
- **Manager employee assignment** — queue and employee workspace share a
  server-validated assignment path; department manager feeds use authenticated
  role and department scope rather than an email allowlist. Owner and workflow
  histories persist atomically, manager feed refreshes immediately, and
  duplicate owner assignment is idempotent. Employee escalation tickets are
  visible to managers; reassigning them restores an active employee task, and
  manager review feedback is visible to the assigned employee. Recent fixes are
  recorded in the latest `CHANGELOG.md` entries.
- **Citizen experience** — submit (auth required, GPS, image upload, mobile-compact UI — DEC-047, pop-out map modal with click/tap pinning and language-aware structured place search — DEC-050/065), track
  (master-detail, sign-in required; department/priority/employee updates/completion photos hidden from citizens —
  DEC-028/029/030/044/050), notifications inbox v1, profile. Session persistence hardened against network glitches. IMPLEMENTED, TESTED.
- **Resolution feedback and further-action request** — signed-in complainants can
  inspect customer-visible status/progress history on a completed grievance,
  submit a 1–5 rating and comment, or request further action with a required
  explanation. The latter reopens a resolved/closed record and notifies its
  manager. IMPLEMENTED; verification pending.
- **Quality check & suspicious grievance flagging (DEC-049)** — Groq-powered bounded
  quality gate in the submit pipeline; non-civic or fake complaints (e.g. math queries,
  riddles, gibberish, spam) are flagged with `qualityFlag="suspicious"` and reason,
  warned in citizen UI with text and voice (`speakWarning`), and surfaced in the admin
  board under a dedicated "Flagged" filter and review badge without ever silently dropping
  submissions. IMPLEMENTED, TESTED.
- **Staff experience** — tabbed admin queue/board separating active/priority complaints from a Closed archive with All Closed, Resolved, Rejected, and Invalid outcome views (DEC-051/064; stored `closed` status appears in Resolved); interactive triage metrics + detail review modal, comprehensive executive analytics (DEC-054: trends area chart, grouped department performance bar chart, resolution times & SLA compliance metrics, complaint aging buckets, priority distribution, Leaflet hotspot density clustering, TF-IDF clusters whose View action opens a filtered map, CSV export), department-employees workspace, resolver workbench
  (ack / progress / hold / escalate / complete), superadmin (users, departments,
  audit), account-scoped notifications. IMPLEMENTED, TESTED.
- **Auth** — email/password + JWT + refresh, Google OAuth, RBAC guards, signup
  with captcha (DEC-031), seeded demo accounts. IMPLEMENTED, TESTED.
  Brute-force rate limiting NOT implemented (§4).
- **Phone/SMS** — India-normalized phone identity, OTP binding, SMS template set
  + Twilio provider code; `SMS_PROVIDER=dry-run` by default (DEC-025/027).
  IMPLEMENTED, TESTED in dry-run. The production demo uses the Twilio Trial US
  sender/international route (verified number only); setting `SMS_PROVIDER=twilio`
  plus the three `TWILIO_*` values in Render and receiving a live OTP is pending
  owner verification. Full citizen delivery is blocked on Twilio upgrade + DLT
  (§4/§5). OTP text rebranded to SAMARTH (DEC-046).
- **Face auth (flag-gated, default off)** — enrollment, 1:1 login, recovery
  phrase, liveness challenges, lockout counters, `requireLogin2fa` (ADMIN only; SUPERADMIN exempt — DEC-052); in-memory
  stores (DEC-024). IMPLEMENTED, TESTED (face/drift suites); real-webcam
  validation pending (§5). Production packaging (DEC-046) now installs
  `insightface==2.1` + a pruned `buffalo_s` at Render build time; live Render
  2FA/citizen login pending (§5).
- **Voice-assisted lodging (flag-gated, default off)** — consent gate,
  AudioWorklet 16 kHz WAV capture, `/transcribe` → Sarvam. **Conversational
  two-mode intake (DEC-038):** "Tell us your problem" guides listen →
  transcribe → extract → focused follow-up → review → confirm over one shared
  draft; the classic form ("Fill the form manually") is the default branch;
  stateless `POST /grievance-intake/extract` (no DB writes; submission
  unchanged). **Spoken questions + photo step (DEC-039):** the model picks a
  fixed `question_kind`; 24 pre-recorded en/hi/mr clips auto-play with persisted
  mute and replay; the review offers an optional photo before the single
  submit. **Mode consolidation (DEC-041, Stage 14):** the manual branch is
  text-only — the legacy single-shot recorder/append-replace/title-suggestion
  stack (Stages 1–9) is retired; the voice review is read-only and corrections
  go through the shared draft in the manual form. **Bounded providers
  (DEC-040/042):** intake 10 s/attempt with a 25 s cascade budget; submit-path
  classification/refinement 8 s per call with a 20 s pass budget and no SDK
  retries; image validation 8 s. **Spoken opening prompt (DEC-043, Stage 15):**
  tapping "Start speaking" plays an audible opening prompt (`intakeIntro`) in the
  selected language before capture starts, ensuring the assistant speaks first
  without contaminating STT; 3 dedicated intro clips synthesized (27 clips total).
  **Citizen classification privacy (DEC-044, Stage 16):** the success card,
  track-detail modal, voice summary, image upload and submit notification never
  show the AI category/department/priority/confidence; the triage diagnostic is
  staff-only and the confidence pill is gone everywhere.
  Stages 1–16 IMPLEMENTED; one live English smoke + a full live typed-path browser E2E
  (`GRV-2026-0015`, 2026-10-18) passed; live en/hi question playback verified 2026-10-19;
  live spoken hi/mr STT and a post-Stage-14 browser pass pending (§5).
- **Grievance AI (EXPERIMENTAL)** — category/priority/urgency via the cascade;
  category audit in `docs/ML_EVALUATION.md` reports 1,200 rows but only 30
  distinct cleaned training complaints (five/category), so model selection and
  confidence thresholds are not validated (DEC-005/050). Exact duplicates are
  excluded from fitting/evaluation; exact-text conflicts are rejected rather
  than silently labeled. The serving model now fits all 30 unique examples;
  evaluation-only splits do not reduce production training data (DEC-051).
  Submission metadata distinguishes categorized, Other, uncertain, and
  explicit out-of-scope outcomes, with confidence semantics separate from the
  numeric score (DEC-052). The local civic intent gate rejects clearly
  non-civic submissions before any grievance write; uncertain text remains
  reviewable (DEC-057).
  All local model, keyword, HF and Groq Water candidates now pass the same
  contextual evidence gate (DEC-053); the legacy fallback adapter and Mongo
  bulk recategorization use the shared cascade. Title+description containing
  no Unicode letters return 400 before provider work, while short/misspelled
  plausible complaints stay accepted for human review. Clearly unrelated
  requests return 422 locally before image/provider work (DEC-057). The current local policy
  abstains on the one Water item in the six-item split; do not tune from this
  tiny split. On the template holdout, the current policy scores 200/200 and
  has zero Water FP, but it is reused development evidence, not validation.
  The separate 614-row template holdout is not an untouched or representative
  production test; see `docs/ML_CLASSIFICATION_AUDIT_2026-10-20.md`. Similarity
  is client-side TF-IDF only. Citizen
  surfaces never display classification outputs or confidence (DEC-044); the
  triage panel is staff-only.
- **Branding & UI refresh (DEC-045, 2026-10-20)** — project rebranded to
  **SAMARTH** (System for Accessible Management, Action, Resolution and Tracking of Hearings);
  header, footer, sidebar, layout, and all 11 i18n dictionaries updated; logo mark
  updated to "S"; contact email set to `support@samarth.gov.in`; generic "AI" hype copy
  de-emphasized across hero, how-it-works, trust section (replaced BrainCircuit with Layers)
  and admin review; primary orange palette enhanced with brighter vibrant tones
  (`--color-primary-600: #ff5500;` on buttons and accents).
- **Production deployment packaging (DEC-046, 2026-10-20)** — Render build now
  installs the optional face stack (`insightface==2.1` with `--no-deps`,
  pinned `onnxruntime`/headless OpenCV/scikit-image/onnx/tqdm) and
  pre-downloads a pruned `buffalo_s` (detector, 106-point landmarks,
  recognition only) into `FACE_MODEL_ROOT`; `FACE_ORT_THREADS=1` for the free
  instance. Twilio demo uses the Trial US sender/international route
  (verified number only) and the OTP text is rebranded to SAMARTH. Code,
  config, docs and tests IMPLEMENTED (commit `dd6dbea`); live Render Twilio OTP
  + face 2FA/citizen login pending owner verification (§5).
- **Homepage entrance animation** (DEC-036, 2026-10-18) — reveal-only, verified
  in headless Chrome, reduced-motion and no-JS safe.
- **Test suites** — baseline pytest on main reported 516 passed / 32 skipped / 22 failed (2026-10-20; 23rd was the local `.env` face-challenge leak, pinned in conftest). On the classification reliability & civic relevance branch, focused test passes succeeded (124-142 passed, legacy status cases deselected). `npm run build` succeeded with Webpack, TypeScript and all 20 static pages. Includes 3 new prepare-model tests; contract suite 21 checks; voice node suites 80 tests (DEC-041/043/044/053); intake backend suite 28 tests; admin analytics suite 11 tests (DEC-054);
  classification latency tests added (DEC-042).
- **Citizen-side test documentation (2026-10-21, DEC-063)** —
  `docs/USER_SIDE_TEST_CASES.md` is the canonical user-side test plan,
  suite (170 cases), 12 E2E journeys, 70-row RTM, 30-item gap register, and
  automation plan. It is aligned with the DEC-059 letterless 400 and DEC-062
  clear non-civic 422 gates. **Documentation only: all 182 items are `Not
  Run`.** Existing pytest/voice suites are unchanged; findings are static
  inspection, not execution.

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

- Twilio production demo: set `SMS_PROVIDER=twilio` plus the three
  `TWILIO_*` values in the Render dashboard and verify a live OTP to the one
  verified number (Trial restriction). Then complete TRAI DLT registration
  (entity + template set from archived TODO §13.6) and enable the Indian
  domestic route for full citizen delivery — CREDENTIALS REQUIRED.
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
- Run the opt-in cross-stack voice E2E (`VOICE_E2E=1 pytest
  tests/test_voice_e2e.py`) in a standalone terminal; the default suite skips it
  because the harness starts an in-process uvicorn server plus Node/jsdom.
- A post-Stage-14 live browser pass (manual text-only branch + read-only voice
  review + correction via mode switch) is still pending; check that the success
  card, track detail, voice summary, image upload and notifications show no AI
  category/department/priority/confidence (DEC-044).

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

- Render: apply the DEC-046 dashboard settings — `SMS_PROVIDER=twilio` + the
  three `TWILIO_*` secrets; `FACE_AUTH_ENABLED=true` + the existing local
  `FACE_EMBED_KEY`; keep `OTP_DEBUG_RETURN_CODE=false`. The face model path,
  model name, detection size and ORT thread count are already in `render.yaml`.
- Run `tools/backfill_departments.py` against Atlas (legacy grievances missing `departmentId`).
- Optional cleanup: rename `components/admin/AdminNav.tsx` (now only exports `AdminHeader`).

### Testing infrastructure

- Jest + RTL component tests (not installed).
- State-machine transition tests.
- Browser-level role/workflow tests.
- AI evaluation protocol runs (see §5).

---

## 5. Remaining to TEST / VALIDATE

**Live / external (credentials, hardware or authorization needed):**

- Live Hindi/Marathi STT (Sarvam) — mock-covered only; one live English smoke
  passed (re-run 2026-10-18: one `/transcribe`, accurate transcript, stopped at
  review). The 2026-10-18 conversational E2E also exercised the typed path live
  (real LLM extraction + real submission `GRV-2026-0015`). 2026-10-19 verified
  live en/hi question-clip playback, but not live hi/mr speech-to-text.
- Live SMS delivery — Twilio demo path ready (Trial US sender, verified number
  only); set the Render dashboard values and confirm a live receipt. Full
  citizen delivery is blocked on Twilio upgrade + DLT.
- Real-webcam face enroll/login; tune `FACE_TURN_MIN_DEGREES`,
  `FACE_BLINK_EAR_DROP`, `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`,
  `FACE_MIN_FACE_PX` via env (no code change needed). **Render production face
  stack** (DEC-046, pruned `buffalo_s`) live 2FA/citizen login pending.
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
- Mobile `/submit` layout at 320/375/430 px: intake modes side-by-side, labels
  wrap, actions centered, 16px field text (avoids iOS focus zoom); desktop ≥640 px
  unchanged (DEC-047).

**Suite health:**

- Full pytest re-run + triage of the known baseline: 370 passed / 22 failed
  (2026-10-10), ~480 passed / 23 failed (2026-10-14), 503 passed / 31 skipped /
  23 failed (2026-10-18), 508 passed / 31 skipped / 23 failed (2026-10-19),
  511 passed / 32 skipped / 23 failed (2026-10-19 post-Stage-14; the 32nd skip
  is the opt-in voice cross-stack E2E) — same failure set: mostly stale DEC-006
  status-vocabulary and i18n expectations. The +5 in 2026-10-19 are the updated
  conversational-intake tests, then +2 classification latency tests (DEC-042).
  2026-10-20 full run: 516 passed / 32 skipped / 22 failed; the 22 are the same
  status-vocabulary/endpoint baseline with no new failure categories. The
  previously noted env-specific face failure is gone after the conftest pin,
  and the 3 new prepare-model tests pass.
  Exact failure names are in `memory/archive/TODO-until-2026-10-18.md` §11.
  Decide fix vs retire per test.
- `test_face_auth.py::TestFaceService::test_tunable_defaults_are_pinned` is now
  hermetic: `tests/conftest.py` pins `FACE_CHALLENGES` (2026-10-20); previously
  the developer's local `.env` override failed it. Targeted DEC-046 suites:
  162 passed / 3 skipped (SMS, face, face recovery/signup, config drift) plus
  3 new `prepare_face_model` tests; full suite not rerun.
- Frontend lint baseline: 4 pre-existing `FaceCapture` errors + 4 warnings —
  keep at or below; fix when touching that component.
- **Citizen-side suite (DEC-063):** 0/182 executed. Start with the smoke set
  (`USR-AUTH-010`, `USR-AUTH-001`, `USR-GRV-001`, `USR-TRACK-001`, `E2E-01`),
  then the P0 privacy/integrity cases (`USR-SEC-001…007`, `USR-ERR-007/008`,
  `USR-API-005/007`). Record Pass/Fail/Blocked and evidence in
  `docs/USER_SIDE_TEST_CASES.md` §20; do not mark anything TESTED/VALIDATED
  until that record contains real results.

**AI evaluation (DATASET REQUIRED, DEC-005):**

- Nothing may be marked VALIDATED. Metrics/approach are defined in
  `docs/AI_SYSTEM.md`; the evaluation protocol has not been executed.

---

## 6. Known issues / risks

- **Citizen-side audit findings (2026-10-21, static/unexecuted):** the full
  30-item register is `docs/USER_SIDE_TEST_CASES.md` §18. Highest-risk items
  to confirm first: public/non-owner grievance lookup returns title/status/
  category/priority/departmentId for sequential IDs (G-04/G-05), citizens
  cannot see resolution/closure/rejection text or real transition history
  (G-01/G-02), retries after a lost submit response can duplicate (G-08), and
  an image-LLM failure can return 500 and block a photo submission (G-10).
  These are inspection findings, not executed defects.
- Firebase API key compromised in git history (rotation pending); Atlas
  credentials weak + allowlist unset.
- `/health` reports configuration, not DB reachability (by design; `/readyz` missing).
- In-memory fallback is non-persistent when `MONGODB_URI` is absent.
- `imageValidation` not persisted → no image audit trail.
- Voice/SMS quota counters are process-local (reset on restart).
- Twilio Trial US sender: only verified numbers receive messages and the sender
  ID is not preserved; full Indian delivery needs an account upgrade + DLT.
- Render free face inference (512 MB / 0.1 CPU) may be slow or OOM. The pruned
  model loaded at ~193 MB peak RSS on the development machine (not Render);
  production latency/memory is unmeasured. Upgrade if the preload or liveness
  is too slow.
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
  The developer's local gitignored `backend/.env` currently sets
  `TRANSCRIPTION_ENABLED=true` for voice testing and `FACE_AUTH_ENABLED=true`
  with the enrollment key — repo/production defaults remain `false`; DEC-046
  calls for the production dashboard to set `FACE_AUTH_ENABLED=true`.
- SMS: `SMS_PROVIDER=dry-run` default; the production demo requires setting
  `twilio` in Render (Trial US sender, verified number only).
  `OTP_DEBUG_RETURN_CODE` is false in production and returns codes for local
  debugging only.
- Ports: backend `10000`, frontend dev `3000`.
- Render (verified 2026-10-20): `MONGODB_URI`/`MONGODB_DB` set and `/health`
  reports `storage: mongodb`; `CORS_ORIGINS` locked to
  `https://samarth-griev-ai.vercel.app`; `FRONTEND_URL` the same origin.
  Face model defaults: `FACE_MODEL_NAME=buffalo_s`,
  `FACE_MODEL_ROOT=/opt/render/project/src/.insightface`, `FACE_DET_SIZE=320`,
  `FACE_ORT_THREADS=1`.
- Seeded test accounts live on Render (verified 2026-10-20): superadmin + 8
  departments × 2; password login verified for the citizen/admin/manager/resolver
  test users. `SEED_TEST_ACCOUNTS` remains available for future environments.
- Shared demo database cleanup (2026-10-23): 19 default demo accounts remain;
  all 19 documented credentials, roles, and active flags were verified against
  their stored hashes. 28 plausible civic grievance records remain after
  removing 18 explicit test/non-civic entries. Six retained complaints were
  detached from deleted personal accounts; related notifications and face
  templates were removed and phone audit values redacted. See `docs/DATABASE.md`.
- Seeded logins: `SEED_TEST_ACCOUNTS` (backend `.env`) +
  `NEXT_PUBLIC_SHOW_DEV_CREDS` (frontend `.env.local`); account list in
  `frontend/lib/testAccounts.ts`.
- Mock mode: `NEXT_PUBLIC_USE_MOCKS=true` (frontend-only demo path).
- Contract checks: `node frontend/scripts/check-contract.mjs` (keep 18 checks green).
- Browser verification for this repo: use the Playwright Chromium binary —
  the system `google-chrome-stable` wrapper is broken (see SESSION_LOG notes).

---

## 8. Suggested next steps

1. Execute the citizen-side P0 suite and record results in
   `docs/USER_SIDE_TEST_CASES.md` §20; confirm and fix G-04/G-05 (cross-user/
   public read), G-01/G-02 (outcome/history visibility), G-08 (retry
   duplicates) and G-10 (image-AI blocking) before claiming the citizen
   experience is VALIDATED.
2. Fresh full pytest run; triage the baseline failures (§5).
3. Verify the DEC-046 Render release: Twilio OTP to the verified number, then
   superadmin password + face 2FA and citizen face login; start DLT registration
   for full citizen SMS.
4. Security hardening batch: rate limits, SSRF, Cloudinary auth, key rotations (§4).
5. Pick the next AI module (AI-01, AI-07 or AI-10) and persist analysis results
   with module id/model version.
6. Work the manual/live validation queue (§5) as credentials/hardware become available.
