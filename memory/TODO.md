# TODO.md — Strategic Feature Roadmap & Tasks

> **Created:** 2026-10-03  
> **Source:** Direct owner instruction  
> **Status tracking:** Items marked [x] are IMPLEMENTED. Items marked [ ] are PLANNED.

---

## 1. Role-Based Access Control (RBAC) & Server-Side Authorization
*(Completed: 2026-10-03, DEC-017)*

- [x] **Define Server-Side Role Model**
  - Canonical roles: `USER` (`CITIZEN`), `RESOLVER` (department staff), `ADMIN` (municipal officer), `SUPERADMIN`.
  - Roles strictly embedded in cryptographic JWT payload and checked on every protected endpoint.
- [x] **Enforce Server-Side Endpoint Protection**
  - Derive authenticated `user_id` and `role` from verified JWT.
  - Apply `Depends(require_role([...]))` on sensitive endpoints:
    - Status updates (`PATCH /grievances/{id}/status`) → `ADMIN` / `RESOLVER` only.
    - Full grievance listing → `ADMIN` sees all; citizens scoped strictly to own records (`userId == current_user.id`).
- [x] **Resource-Level Authorization Guards**
  - Citizens cannot inspect other citizens' grievance details (`GET /grievances/{id}` enforces owner check for `USER` role).
- [ ] **Audit Trail Integration** (Phase 2 state machine DEC-006)
  - Log actor (`userId`), previous state, new state, timestamp, and source (Human Officer vs. AI) on every state modification.

---

## 2. Comprehensive Authentication & Identity System

### A. Email / Password + JWT *(Completed: 2026-10-03, DEC-017)*
- [x] **User Registration & Password Security**
  - Secure password hashing using `bcrypt` (12 rounds).
  - Input validation (length, format) via Pydantic / Zod.
- [x] **Token Issuance & Lifecycle**
  - Short-lived Access Token (60m, HS256) + Long-lived Refresh Token (7d).
  - Silent token renewal (`POST /auth/refresh`) and automatic retry on 401 in frontend API client.

### B. Google OAuth 2.0 *(Completed: 2026-10-03, DEC-017)*
- [x] **OAuth 2.0 Authorization Flow**
  - Sign in with Google on Next.js frontend (`/auth/callback` page).
  - Secure backend exchange (`/auth/google/callback`) validating Google ID token.
  - Account linking / auto-creation of citizen profile matching verified Google email.

### C. Facial Recognition Authentication (Advanced Biometric Layer)
*(IMPLEMENTED 2026-10-09, DEC-024 — see section 10 for follow-ups)*
- [x] **Camera Capture & Liveness Detection**
  - WebRTC / HTML5 camera capture in frontend modal for biometric enrollment and verification.
  - Anti-spoofing / liveness check (e.g., blink or head turn verification).
- [x] **Face Embedding & Match Service**
  - Face feature extraction (e.g., FaceNet / InsightFace / MediaPipe FaceMesh).
  - Encrypted storage of 128/512-dimensional face embeddings in MongoDB.
  - Cosine distance matching for 1:1 citizen verification.

---

## 3. Voice-Based Grievance Registration

- [ ] **In-Browser Audio Recording**
  - Micro-service / client audio capture with recording controls (Start, Pause, Stop, Waveform visualization).
  - Mobile-responsive one-tap voice input on complaint submission form.
- [ ] **Speech-to-Text (STT) Processing**
  - Integration with STT engine (OpenAI Whisper / Groq Whisper API `whisper-large-v3` / Bhashini for Indian languages).
  - Multilingual support: Hindi, English, regional languages, and Hinglish transliteration.
- [ ] **AI-Powered Structured Field Extraction**
  - Feed raw transcript to LLM to automatically infer:
    - Subject / Title
    - Detailed Description
    - Location landmarks mentioned in audio
    - Intended department / category
  - Pre-fill submission form so citizen can review and confirm before final submission.

---

## 4. UI Overhaul & Departmental Portals

### A. Design System *(Partially Completed: 2026-10-03)*
- [x] **Border Radius Halved Across All Components**
  - `Button`, `Field`, `Card`, `Badge`, `Feedback`, `SiteHeader`, `SiteFooter`, `GrievanceCard`, `AnalysisPanel`, `AdminBoard` queue items — all halved.
  - CSS variables in `globals.css` (`--radius-lg: 4px` etc.) set baseline.
- [x] **Full-Screen Width Layout**
  - Removed all `max-w-3xl` / `max-w-6xl` centered column constraints from every page.
  - Consistent `px-4 sm:px-6 lg:px-8` padding model across header, footer, all pages.
- [x] **Professional Page Layouts**
  - Home: true 50/50 hero split + 2×2 stats grid + icon department cards + joined step row.
  - Submit: two-column `[1fr_380px]` — form left, MyGrievances sidebar right.
  - Track: full-width search bar strip, two-panel results (grievance+AI left, timeline right), grid for recent.
  - Admin: full-bleed, no max-w constraint.
  - Login: dark branding panel left + form right (SaaS-style auth).
- [x] **Real Icons — No Emojis**
  - All emoji icons replaced with `lucide-react` SVG icons (Droplets, Construction, Zap, Trash2, HeartPulse, Landmark, FolderOpen, FileText, BrainCircuit, CheckCircle2).
  - Department cards use styled icon containers with hover state color transitions.
- [x] **Micro-interactions & Polish**
  - Real-time status tracker with visual progress milestones (`StatusTimeline` in `GrievanceCard.tsx`).
  - Loading & warning alert feedback in `Feedback.tsx`.
- [x] **Register Page — Split Layout**
  - Same dark-panel-left + form-right treatment as login page.

### B. Department-Specific Portals & Resolver Command Center *(Completed: 2026-10-04)*
- [x] **Dedicated Department Portal Views**
  - Interactive top navigation tab bar filtering entire dashboard, queue, metrics, and map markers:
    - 💧 Water Supply & Sewerage Board
    - 🛣️ Roads & Infrastructure Division
    - ⚡ Electricity & Power Distribution
    - 🗑️ Municipal Sanitation & Waste
    - 🏥 Public Health & Medical Services
    - 🏛️ Civic Governance & Citizen Services
    - 📋 Other / Uncategorized
  - Live department ticket counters on tabs.
- [x] **Dedicated Resolver / Officer Workspace**
  - Resolver action center in `AdminBoard.tsx` with direct lifecycle transitions (`Open` → `Assigned` → `In Progress` → `Resolved` → `Rejected`).
  - Municipal department assignment routing with field notes / resolution memo recording.
  - Attached photographic proof inspection with full-resolution links.
### C. Admin Structural Reorganization (Completed: 2026-10-05, DEC-018)
*(Completed: 2026-10-05, DEC-018)*
- [x] **Top Navigation Sub-Tabs**: Add `Grievance Queue` (`/admin`) vs `Executive Analytics` (`/admin/analytics`) sub-tabs on Admin header. (`AdminNav.tsx`)
- [x] **Lean `/admin` Triage Table**: Refactor `/admin` to show numerical KPI cards, filters, and full-width queue table with SLA status indicators (`Overdue` / `On Track`). Remove inline maps and charts from main board.
- [x] **Centered Grievance Review Modal (`GrievanceReviewModal.tsx`)**: Build overlay dialog for reviewing ticket details, photographic evidence, single-pin map, AI triage panel, and action controls.
- [x] **Executive Analytics Page (`/admin/analytics`)**: Move spatial cluster map, TF-IDF semantic clusters, volume charts, and CSV report exporter to dedicated analytics page.

> **Note (DEC-018):** the SLA indicator uses the display-only prototype heuristic in
> `frontend/lib/sla.ts` until the Phase 9 / OQ-005 SLA configuration persists a real
> `due_date`.

### D. Frontend workflow completion (in progress)
- [x] Expand resolver workspace into worker dashboard with assignment acknowledgement, progress/hold updates, structured escalation, completion submission, and timeline.
- [ ] Add manager-facing escalation ticket response controls.
- [x] Add account-scoped notification inbox, unread badges, polling/toasts, and citizen/employee workflow notifications.
- [x] Fix resolver queue's implicit `other` department filter and link assignment notifications to the selected task.
- [x] Normalize department aliases consistently across manager employee lists, assignment validation, and worker queues; add a Roads/Roads & Transport/Traffic & Transport Operations assignment regression.
- [x] Fix public grievance lookup so history authorization failures cannot show “not found”; expose a limited tracking projection and customer-visible history to non-owners, while requiring authentication for full-list access.
- [x] Use a shared employee task loader for overview/workbench; recover missing list rows from own assignment notifications and surface queue errors instead of zero counts.
- [x] Resolver workbench at `/resolver` with assigned queue, state actions, progress notes, resolution submission, and activity history.
- [x] Superadmin overview at `/superadmin` with users, departments, and audit data.
- [x] Citizen tracking consumes live recent grievances and history updates when authenticated.
- [x] Add superadmin user role/active-state and department create/enable controls.
- [x] Add department-manager employee account management and grievance allocation in the dedicated `/admin/employees` dashboard; remove employee operations from the grievance queue.
- [ ] Add browser-level role/workflow tests and visual validation.

### E. Citizen experience
- [x] Improve home page guidance and request lifecycle explanation.
- [x] Improve navbar active states and role-specific labels.
- [x] Clarify and display required incident location capture in the complaint form.
- [x] Require authentication before lodging a complaint in both frontend and API.
- [x] Split tracking into personal grievances and reference-ID search tabs with department totals.

---

## 5. Full Multilingual System Support & Dynamic Translation

- [ ] **Frontend Internationalization (i18n)**
  - Language selector in top navigation bar (English, Hindi, Marathi, Tamil, Telugu, Bengali, Kannada, Gujarati, etc.).
  - Localization framework (e.g. `next-intl` or `react-i18next`) for UI copy, forms, status badges, timelines, and alerts.
- [ ] **Dynamic Bi-Directional Complaint Translation**
  - Translate citizen submissions (text and voice transcripts in regional languages/Hinglish) into standardized English for administrative review and backend AI processing.
  - Store original language text alongside translated text in the grievance document (`originalText`, `detectedLanguage`, `translatedText`).
  - Translate officer resolution notes, status updates, and official communications back into the citizen's chosen language.
- [ ] **Multilingual AI / NLP Pipeline Support**
  - Ensure the classification cascade (ML model, HF DeBERTa, Groq, keyword fallback) seamlessly handles multilingual inputs either via translation-before-classification or multilingual embeddings (e.g., IndicBERT / IndicTrans2 / Google Cloud Translation / Bhashini API).
  - Multilingual sentiment and urgency keyword detection (Hinglish/Hindi/regional idioms like "paani nahi hai", "bijli gul", "sadak tuti hai").

---

## 6. RBAC Spec Suite (`memory/rbac/`, docs-only, 2026-10-06)

- [x] **Spec suite written** — 12 files in `memory/rbac/` (index, RBAC + SUPERADMIN-over-ADMIN matrix, auth reality, role interfaces, workflow/state machine, progress flow + customer timeline, ticket/assignment/priority/deadline, backend layers, API contracts, DB deltas, notification/audit/risks, phased checklist).
- [ ] **Owner confirmations** — role-name mapping (`RESOLVER`→EMPLOYEE etc.), department model (enum vs collection), UPPER-state canonical, demo-mode flag, who publishes customer updates.
- [ ] **Phase 0 build** — follow `memory/rbac/IMPLEMENTATION_CHECKLIST.md` order (0→6); fix stale `docs/SECURITY.md` / `docs/API.md` auth headers during build.

---

## 7. Testing-Phase Seed Accounts (2026-10-08, DEC-019)

- [x] **Backend matrix** — `backend/app/seed_test_accounts.py` (superadmin + 8 managers + 8 employees, idempotent, departments auto-created, taxonomy == `CATEGORY_KEYS`); wired into startup behind `SEED_TEST_ACCOUNTS` + `SEED_TEST_PASSWORD` (`backend/app/config.py`, `backend/app/main.py`, `backend/.env.example`).
- [x] **Sign-in surface** — `frontend/lib/testAccounts.ts` + `/login` dev box lists all 19 accounts with Autofill (gated by `NEXT_PUBLIC_SHOW_DEV_CREDS`); `frontend/.env.example` + `README.md` updated.
- [x] **Tests** — `tests/test_seed_accounts.py` (matrix, idempotency, untouched-existing, cross-department 403 flow); `tests/conftest.py` pins seed flags off.
- [ ] **Owner run** — set `SEED_TEST_ACCOUNTS=true` in `backend/.env` and `NEXT_PUBLIC_SHOW_DEV_CREDS=true` in `frontend/.env.local`, restart both, verify logins.
- [ ] Run `python tools/backfill_departments.py` against the configured MongoDB deployment for legacy grievances missing `departmentId`.

---

## 8. Orange/Black Visual Identity (2026-10-09, DEC-021)

- [x] **Palette swap** — `frontend/app/globals.css`: orange `primary` (600 `#ff6b00`, text-safe 700 `#c24a00`), neutral `ink` greys replacing slate; all hardcoded blues (AdminBoard `blue-*`, map-pin `#026bc7`, chart/popup slate hexes, hero gradient) removed.
- [x] **Black CTAs** — default `Button` variant + hero Register link are solid black; new `orange` variant available for accent buttons.
- [x] **Verified** — `npm run lint` + `npm run build` pass; grep sweep shows no blue outside the Google brand logo.
- [ ] **Browser visual pass** — no desktop browser was connected during the change; eyeball `/`, `/login`, `/submit`, `/track`, `/admin`, `/admin/analytics`, `/resolver` for badge/focus-ring/map-pin/chart color and fix anything that reads off.

---

## 9. Staff Navigation Consolidation (2026-10-09)

- [x] **Top `AdminNav` strip removed** — `/admin`, `/admin/analytics`, `/admin/employees` now rely solely on `StaffSidebar` (the strip was an exact duplicate, including role gating).
- [x] **Department Portals tabs → one dropdown** — labelled `<select>` above the queue table; options show per-department counts; still hidden for department managers.
- [x] **Employee panels stacked** — `Employee Accounts` + `Assign Tasks` render one after the other in `DepartmentEmployeesWorkspace`.
- [x] **Verified** — `npm run lint` + `npm run build` pass; grep shows no `role="tab"`/`tablist` left in staff surfaces (only citizen `/track`).
- [ ] **Optional cleanup** — `components/admin/AdminNav.tsx` now exports only `AdminHeader`; rename the file when the repo is quiet (other work is landing concurrently).
- [ ] **Browser pass** — confirm the department dropdown alignment in the queue card header on `/admin` at ~1024px (sidebar + 5 controls).

---

## 10. Face authentication & Citizen Passwordless Auth (DEC-024, updated 2026-10-10)

Shipped on `feature/face-auth` (DEC-024 base `7fc2c0e`..`be7266f`, accuracy/perf `c9f041e`/`5b0bd68`, citizen signup/login/recovery implemented):
- [x] **Citizen Passwordless Signup** — `POST /auth/face/signup/start` + `POST /auth/face/signup/complete` with 10-digit normalized phone, generated `citizen_id`, and frontal template creation.
- [x] **Citizen 1:1 Login** — `POST /auth/face/login` strictly 1:1 for `role: USER` with phone / Citizen ID / email identifier; privileged accounts and unknown identifiers return identical generic 401; lockout counters intact with MODEL_MISMATCH no-count.
- [x] **Recovery & Admin Reset** — `POST /auth/face/admin-reset/{user_id}` (admin/superadmin audited, 24h single-use token) + public `POST /auth/face/re-enroll` (burns token on success); Superadmin UI reset button; citizen `/re-enroll` page.
- [ ] **Real-webcam validation** — run enrollment/login on physical cameras and tune `FACE_TURN_MIN_DEGREES`, `FACE_BLINK_EAR_DROP`, `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`, `FACE_MIN_FACE_PX` via env (no code change needed).
- [ ] **Anti-spoof model not provisioned** — `FACE_ANTISPOOF_MODEL_PATH` wiring exists but no SilentFace ONNX model is bundled; drop a model path into `backend/.env` to enable.
- [ ] **Mongo persistence for face stores** — templates, challenges and rate-limit counters are in-memory only (reset on restart); port `repositories/face_templates.py` to a `face_templates` collection behind the same repository interface.
- [ ] **`GET /auth/face/status` does not expose `requireLogin2fa`** — the profile toggle starts unchecked on a fresh page load (PATCH still works; the value is stored on the template).
- [ ] **Browser pass** — eyeball `/login` face tab, the 2FA step, `/signup/face`, `/re-enroll`, and `/profile` on a real camera.

---

## 11. Known pre-existing test baseline (NOT face auth, as of 2026-10-10)

Full suite: **370 passed / 22 failed**. The 22 failures predate DEC-024
(stale DEC-006 status-machine and i18n/vocabulary expectations) and are
unrelated to face auth — all 140 face & drift tests pass:

- `tests/test_auth.py::TestGrievanceRBAC::test_admin_can_patch_status`
- `tests/test_endpoints.py::test_grievance_optional_fields_are_null_tolerated`
- `tests/test_endpoints.py::test_patch_status_and_assignee`
- `tests/test_endpoints.py::test_patch_partial_update_leaves_other_fields`
- `tests/test_endpoints.py::test_blank_status_is_rejected`
- `tests/test_endpoints.py::test_status_surrounding_whitespace_is_trimmed`
- `tests/test_endpoints.py::test_patch_assignee_without_status`
- `tests/test_endpoints.py::test_patch_status_without_assignee`
- `tests/test_endpoints.py::test_unknown_status_values_are_accepted_verbatim`
- `tests/test_endpoints.py::test_unknown_submit_fields_are_ignored`
- `tests/test_image_validation.py::test_submit_accepts_an_image_at_the_threshold`
- `tests/test_rbac_workflow.py::TestAssignRBAC::test_assign_invalid_state_422`
- `tests/test_rbac_workflow.py::TestLifecycle::test_resolver_cannot_read_unassigned_history`
- `tests/test_status_vocabularies.py::test_every_vocabulary_source_still_parses`
- `tests/test_status_vocabularies.py::test_backend_default_status_renders_as_a_badge`
- `tests/test_status_vocabularies.py::test_backend_default_status_is_absent_from_the_timeline`
- `tests/test_status_vocabularies.py::test_the_four_vocabularies_are_not_identical`
- `tests/test_status_vocabularies.py::test_admin_filter_covers_every_mock_status`
- `tests/test_status_vocabularies.py::test_admin_filter_misses_the_timeline_endpoints`
- `tests/test_status_vocabularies.py::test_all_current_vocabs_are_lowercase`
- `tests/test_status_vocabularies.py::test_dec_006_states_are_disjoint_from_the_current_lowercase_set`
- `tests/test_status_vocabularies.py::test_no_component_already_speaks_dec_006`

---

## 12. Open auth gap: password login / refresh have no rate limiting

- [ ] `POST /auth/login`, `POST /auth/refresh` and `POST /auth/register` have
  **no brute-force throttling** (`docs/SECURITY.md` Known Limitations). The
  face endpoints carry per-IP/per-email/per-user TTL lockout counters
  (DEC-024), but that does not protect the password paths. Add per-IP +
  per-account throttling (in-memory v1 acceptable, mirroring
  `repositories/face_templates.py` counters) — also gap #8 in
  `memory/rbac/AUTHENTICATION.md`.

---

## 13. India phone numbers, phone↔face binding, Twilio SMS stage notifications (PLAN, 2026-10-10)

> **Status: PLAN — nothing below is implemented.** Written against `main` @
> `11949d2` (face-auth / DEC-024 merged). Full working copy of this plan also
> lives outside the repo at `/home/arsen1c/.opencode/plan/india-phone-face-bind-twilio-sms.md`;
> this section is the in-repo source of truth.
>
> `DECISIONS.md` was deliberately **not** updated — the load-bearing choices
> (§13.9) are still open questions, so there is no accepted DEC to record yet.

### 13.1 Already exists — do NOT rebuild

Verified present in the tree before planning:

- `backend/app/users_db.py:20` `normalize_phone()` — strips spaces/dashes/dots/
  parens and leading `+91`, `91` (12-digit), `0` (11-digit); accepts only 10
  digits starting `6-9`; else `ValueError`.
- `find_by_phone()` (`users_db.py:132`, `:341`), `find_by_identifier()` (`:155`,
  dispatch: `CIT-` → citizen_id, `@` → email, else phone), `uniq_user_phone`
  index (`:269`), duplicate-phone rejection (`:84`).
- `POST /auth/face/login` already accepts **`identifier` = phone OR citizen_id**
  (`routers/face_auth.py:665`), with identifier validator (`:127`) and
  per-identifier/per-IP lockouts (`:281-313`).
- Frontend: `app/signup/face/page.tsx` already collects `phone` (required, with
  consent gate at `:200`); `phone` carried through `lib/types.ts:70,86`,
  `lib/session.tsx:64,128`, `app/auth/callback/page.tsx:63`.
- Notification infra: `_notify()` at `routers/assignments.py:40` with **16 call
  sites**, all in `assignments.py`. `repositories/notifications.py:1` still
  reads `"""...in-app v1, no email/SMS."""`.
- State machine: 15 `GrievanceState` values (`state_machine.py:14`),
  role-gated transitions (`:41`, `:104`).

**Real gaps:** no E.164 export (Twilio needs `+91…`, storage is bare 10 digits);
no frontend phone validation (`signup/face` only does `phone.trim()`); phone is
**unverified**; no way to bind a phone to an existing email account; no SMS
transport at all.

### 13.2 Phase 0 — blocking prerequisites

- [ ] **TRAI DLT registration** (`CREDENTIALS REQUIRED`) — entity registration,
  a **6-character sender ID/header**, and **pre-registered content templates**.
  Carriers drop unregistered/free-form SMS. This is the #1 reason the feature
  "works in the Twilio console but no citizen receives anything."
- [ ] Twilio project with India SMS enabled; prefer `TWILIO_MESSAGING_SERVICE_SID`
  over a raw number (it carries the registered header). Note: trial accounts can
  only message **verified** destinations.
- [ ] Decide **demo (`dry-run`) vs production** before writing send code.
- [ ] Set up an **installable backend test env** — `pytest` is not installed
  here and there is no venv (same reason the face suites were never re-run).
  Without this the work ships unverified, like the 22 baseline failures on `main`.

### 13.3 Workstream A — India phone hardening

- [ ] `to_e164()` in `users_db.py` — bare 10 digits → `+91XXXXXXXXXX`. **Keep
      `normalize_phone` as the single internal canonical form; do not change the
      stored format or the existing unique index.** Reject non-Indian shapes
      loudly rather than silently coercing.
- [ ] Frontend validation mirroring the backend rule exactly (`^[6-9]\d{9}$`
      after normalization); render `+91` as a fixed non-editable prefix.
- [ ] Add error i18n keys to **all 11 locales** (`MessageKey` derives from
      `en.ts`, so an `en.ts`-only key is a TypeScript error).
- [ ] Mask phone (`98***43210`) in logs, audit entries and the superadmin list
      (`SuperadminWorkspace` currently prints `u.phone` raw).
- [ ] Defer phone collection on the legacy `/register` path — cover it via the
      binding flow in B instead, keeping `/register` unchanged.

### 13.4 Workstream B — OTP-proven phone↔face binding (security-critical)

Phone is currently *claimed*, not *proven*, so face-login-by-phone authenticates
against an unverified identifier. This is the highest-value item in the plan.

- [ ] User fields (both repos): `phoneVerifiedAt`, `phoneVerifiedMethod`
      (`"otp_sms"`), `smsConsent`, `smsOptOutAt`.
- [ ] `find_by_identifier` must **prefer verified phones** for login; an
      unverified phone must not be a sufficient login identifier.
- [ ] `services/otp.py` — 6-digit code, **hashed at rest**, 5-min TTL, max 3
      attempts, burn-on-success, regeneration invalidates the previous code.
      Per-phone **and** per-IP rate limits, mirroring the face lockout pattern.
      Codes must never be logged (follow the face module's "never logs
      embeddings" rule).
- [ ] `repositories/otp_codes.py`, modelled on `notifications.py` conventions.
- [ ] New `routers/phone.py` mounted in `main.py`:
      `POST /phone/request-otp` (rate-limited, generic response — do not leak
      whether a phone is registered, honours `smsOptOutAt`),
      `POST /phone/verify-otp`, `POST /phone/bind` (JWT + **step-up auth**;
      reject if the phone is already bound to another user),
      `POST /phone/unbind`.
- [ ] Gate `routers/face_auth.py` phone login on `phoneVerifiedAt`; leave
      `citizen_id` behaviour unchanged.
- [ ] Audit every bind/unbind via `audit_repository` (who / old→new / when /
      reason / human-vs-system), per the AGENTS.md auditability requirement.
- [ ] Frontend: Profile phone card (add → OTP → verified badge, explains *why*),
      Login Face-tab hint for unverified numbers, re-enroll messaging, 11 locales.

### 13.5 Workstream C — Twilio SMS stage notifications

- [ ] `config.py` + `backend/.env.example`: `SMS_PROVIDER=dry-run|twilio|off`
      (**default `dry-run`** so the repo runs with zero credentials), plus
      `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`,
      `SMS_FROM` (DLT header), `SMS_DRY_RUN_LOG_BODY`,
      `SMS_RATE_LIMIT_PER_USER_HOUR`, `SMS_RATE_LIMIT_PER_GRIEVANCE_DAY`.
      Startup must **not** fail when Twilio is unconfigured — degrade to
      in-app only, mirroring the `GROQ_API_KEY` fallback.
- [ ] `services/sms.py` — `send_sms()` / `send_stage_update()`. **Never raises
      into the caller**; returns `False` and logs a warning. Send via
      `BackgroundTasks` (a synchronous Twilio call inside a state-transition
      request would add hundreds of ms to every officer action).
- [ ] Respect `smsConsent` + `smsOptOutAt`; skip silently when either says no.
- [ ] **Dedup** — never SMS the same `grievanceId` + `stage` twice (retries,
      reassignment, reopen loops).
- [ ] Hook into `_notify()` (`assignments.py:40`) rather than editing 16 sites;
      also cover submission (`routers/grievances.py`) and progress
      (`routers/progress.py`), which have their own notification paths.
- [ ] Consent checkbox at `/signup/face`, **separate from and unchecked by
      default** alongside the existing face-biometrics consent (DPDP Act 2023:
      specific, granular, withdrawable, timestamped, purpose-limited).

### 13.6 Canonical message set — register exactly these with DLT

Keep it small; **citizen-facing only** (staff notifications stay in-app):

| `template_key` | Trigger |
|---|---|
| `grievance_received` | `SUBMITTED` |
| `grievance_assigned` | `ASSIGNED` / department routed |
| `grievance_in_progress` | `IN_PROGRESS` |
| `grievance_blocked` | `BLOCKED` |
| `grievance_resolved` | `RESOLVED` |
| `grievance_rejected` | `REJECTED` |
| `grievance_closed` | `CLOSED` |
| `otp_code` | OTP request |

- [ ] **`STAGE_SMS_LABEL` map** — human words per state. Enum values must never
      reach a citizen (`RESOLUTION_SUBMITTED` → "awaiting review").
- [ ] Add a test that **fails if a new `GrievanceState` is added without a
      label**.
- [ ] **160 GSM-7 char cap.** Strip reason/comment free-text — it is unbounded,
      would blow past one segment, and would break the registered template.
      Keep reasons in-app only.
- [ ] Bodies are fixed with slots only, e.g.
      `GRV: Grievance {{id}} is now {{stage}}. Track: {{link}}` — never
      ad-hoc `f"...{state.title()}"`.

### 13.7 Sequencing

| Phase | Scope | Depends on |
|---|---|---|
| 0 | Twilio + DLT; demo-vs-prod decision; working test env | — |
| 1 | A: `to_e164` + frontend validation | — |
| 2 | C: SMS service in `dry-run` + config | — |
| 3 | C: canonical templates + `_notify` hook, `dry-run` end-to-end | 2 |
| 4 | B: OTP + binding + face-login gate | 1, 2 |
| 5 | Frontend: binding UI, consent, login hints, 11 locales | 3, 4 |
| 6 | Live Twilio send + carrier verification | 0, 3 |
| 7 | Docs + memory | all |

Phases 1–3 and 5 are deliverable **without** Twilio credentials via `dry-run`.
Only Phase 6 needs real DLT.

### 13.8 Security, compliance, project rules

- [ ] No secrets in git — env vars only; every new key documented in
      `backend/.env.example` with a comment, matching existing style.
- [ ] Server-side authority — validate phone with `normalize_phone` even when
      the client already checked; never trust a client consent/role claim.
- [ ] PII minimisation — masked phone in logs/audit/UI; **no OTP in logs ever**.
- [ ] **HITL (non-negotiable, AGENTS.md)** — SMS is informational only. No SMS
      may trigger or authorise an administrative action; no message links that
      mutate state. Citizens track through the authenticated app.
- [ ] Mark Twilio-dependent pieces `CREDENTIALS REQUIRED` and the OTP/biometric
      binding `EXPERIMENTAL` until validated. Do **not** claim delivery rates.

### 13.9 Open questions (resolve before Phase 2+)

1. DLT registered already, or is `dry-run` the deliverable for now?
2. Is the §13.6 stage set right? Especially SMS on `BLOCKED`/`REJECTED` (can
   surprise citizens), and skipping `AI_PROCESSING`/`UNDER_REVIEW`?
3. OTP for binding only, or also a phone+OTP passwordless login?
4. **Unbind policy** — a *face-only* account that unbinds its phone loses its
   only login identifier. Require an alternative credential first?
5. WhatsApp too? Same Twilio account, different registration regime and
   template set.
6. English only, or per-user locale? DLT templates are per-language and multiply
   the registration burden.
7. SMS the staff (manager/employee) notifications too, or citizens only?

### 13.10 Risks

| Risk | Mitigation |
|---|---|
| DLT missing → zero delivery in India while the Twilio console looks fine | `dry-run` default; Phase 0 gate; carrier-level verification in Phase 6 |
| SMS failure breaking officer workflows | fire-and-forget async, never raises, explicit isolation test |
| Unverified phone becomes a login identifier | gate `face/login` on `phoneVerifiedAt` |
| OTP brute force | 3 attempts, hashed at rest, per-phone + per-IP caps reusing the face lockout pattern |
| Template drift vs DLT registration | one central template registry, bodies in a single file, listed in docs |
| Cost / segment overrun | 160-char cap, no free-text reasons, per-user and per-grievance caps |
| Shipping unverified | Phase 0 includes a working backend test env |

### 13.11 Testing

- Unit: `normalize_phone` edge cases (`+91…`, `91…`, `0…`, separators, `+1`
  rejection, `6-9` first digit); `to_e164` round-trip; OTP expiry / max
  attempts / burn-on-success / regeneration; `STAGE_SMS_LABEL` covers all 15
  states.
- Integration: request→verify→bind; bind rejected when the phone belongs to
  another user; unbind forced-review path; face login by **unverified** phone
  rejected vs **verified** accepted; state transition → correct template +
  variables.
- **Isolation: the SMS provider raising must not fail the state change** — this
  is the critical one.
- Isolation: `smsConsent=False` and `smsOptOutAt` set → no send.
- Rate: per-user hourly / per-grievance daily caps; OTP per-phone + per-IP caps.
- `node frontend/scripts/check-contract.mjs` for the new API helpers.

### 13.12 Documentation required when this is implemented

`docs/API.md` (`/phone/*`, login identifier change), `docs/WORKFLOWS.md`
(binding + SMS journeys, opt-out), `docs/SECURITY.md` (OTP threat model,
binding as a credential change, PII), `docs/DEVELOPMENT.md` (Twilio setup, DLT,
`dry-run`, trial limits), `backend/.env.example`, and new DEC entries in
`memory/DECISIONS.md` once §13.9 is answered.
