# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

## 2026-10-14 — Merged main into feature/aarohi (voice branch merge-ready)

- Merged `origin/main` (PRs #7–#9: overhaul UI, signup hardening, Twilio,
  i18n scope, deploy config) into the voice branch. Conflicts resolved in
  `render.yaml` (Sarvam vars kept, reintroduced `PORT` pin dropped),
  `SubmitForm.tsx` (voice recorder kept, removed dept-select dropped),
  `types.ts`, `docs/DEVELOPMENT.md` (both sections kept).
- Voice DECs renumbered 028–031 → **032–035** (collided with main's DECs);
  updated in DECISIONS, TODO §14, voice guide, config/audio comments,
  PROJECT_STATE, CHANGELOG. TODO §3 marked implemented-behind-flag.
- Verified: `tsc` clean, `eslint` clean, `npm run build` green, contract
  checks passed, full pytest 480 passed with failures byte-identical to the
  TODO §11 baseline; voice node suites pass except the two CDP browser
  tests (no usable Chrome on this box — broken wrapper binary).
- Open: `SARVAM_API_KEY` for a live transcription check; browser voice tests
  need a real Chrome.

## 2026-10-14 — Signup hardening: profile fields, captcha, proven phone (DEC-031, uncommitted)

- Both signup paths collect address/DOB/occupation/gender (shared backend
  validator, age 13–120, fixed gender set); stored on the user + profile.
- Self-hosted SVG captcha required on `/auth/register` and face
  `signup/start` (hashed, 5-min, single-use, 3-strike, never logged).
- Face-only signup proves its phone inline (token-bound OTP request/verify);
  `signup/complete` requires the proof and stamps `phoneVerifiedAt`, so new
  accounts pass the DEC-025 login gate immediately.
- 20 new i18n keys (en/hi/mr real, 8 placeholders); `tests/_signup_helpers.py`
  shared module; full suite 376 passed with failures byte-identical to the
  TODO §11 baseline.
- Verified: targeted + full pytest, `tsc`/`eslint`/`build`/contract green.
- Open follow-up: Google-OAuth signup collects no profile/captcha.

## 2026-10-14 — Tracking dashboard: master-detail, no department totals (DEC-029)

- `/track`: department-totals grid deleted; page is now a master-detail
  dashboard — selectable grievance list + inline full-detail panel
  (timeline, description, metadata, map, photo, history, AI triage),
  auto-selecting the first grievance.
- New `GrievanceDetailPanel.tsx` extracted from `GrievanceDetailModal`
  (now a thin wrapper — `/submit` behavior unchanged); per-grievance remount
  via `key`.
- Verified: `tsc` clean, `eslint` clean, `npm run build` green (18 routes),
  contract checks passed.

## 2026-10-14 — Removed reference-ID search from citizen surfaces (DEC-028)

- `/track` is now personal-grievances only: tab switcher, search form/results,
  `?id=` deep-link handling, and the search-tab department grid deleted.
  Signed-out visitors keep the sign-in prompt — tracking is sign-in-or-nothing.
- Homepage hero tracker deleted (`HomeTrackPanel.tsx` removed); hero reflowed
  to a single centered column reusing existing copy/CTAs.
- Backend untouched; shared lookup helpers stay exported (dead, zero cost).
  Orphaned i18n keys kept in all 11 packs (strict typing); English subtitle
  updated, other locales pending native review.
- Verified: `tsc` clean, `eslint` clean, `npm run build` green (18 routes),
  contract checks passed.

## 2026-10-13 — Deploy readiness: render vars + runbook

- `render.yaml`: added missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  (Google login was broken without them), and `FRONTEND_URL` (SMS links
  defaulted to localhost) — all `sync: false`. Fixed own goal on the way:
  a comment tripped the no-localhost drift assertion.
- `docs/DEVELOPMENT.md`: new "Deploying" runbook (Render backend first,
  Vercel `frontend/` root + build-time env, Google console URIs, prod smoke test).
- Verified: drift suite 15 passed.

## 2026-10-13 — Merge prep: main into frontend-overhaul, two test-hardening fixes

- Merged `main` (incl. render deploy fix `b060933`) into
  `feat/frontend-overhaul`; clean auto-merge, branch pushed merge-ready.
- `tests/test_config_drift.py`: dropped `PORT` from the render-required set —
  Render injects it and pinning a value was the deploy bug `b060933` fixed.
- `tests/conftest.py`: pins `SMS_PROVIDER=dry-run` +
  `OTP_DEBUG_RETURN_CODE=false` so a developer's live-testing `backend/.env`
  can no longer break the OTP suite's hermeticity (or send real SMS from tests).
- Gates on merge result: `tsc` clean, `npm run build` green (18 routes),
  contract checks passed, full pytest 363 passed / 23 failed = documented
  baseline exactly (TODO §11).

## 2026-10-13 — Consistent Department Names and Canonical IDs

- Canonical Department Taxonomy:
  - Standardized the 7 official civic departments across all backend services, seed accounts, database models, admin review modals, superadmin views, analytics charts, and reports:
    1. `water`: **Water Supply & Sewerage Board**
    2. `roads`: **Roads & Transport Authority**
    3. `electricity`: **Electricity & Power Distribution**
    4. `sanitation`: **Municipal Sanitation & Waste**
    5. `health`: **Public Health & Medical Services**
    6. `governance`: **Civic Governance & Citizen Services**
    7. `other`: **General Urban Administration**
- `backend/app/services/departments.py`:
  - Defined `CANONICAL_DEPARTMENTS` mapping with exact IDs and names.
  - Maintained backward compatibility aliases so legacy inputs (e.g. `transport`, `road`, `waste`, `power`) cleanly canonicalize to their official IDs.
- `frontend/lib/departments.ts` & `frontend/components/admin/departments.ts`:
  - Exported canonical `DEPARTMENTS` definitions and `getDepartmentLabel` helper.
  - Unified admin departments list to re-export the single source of truth from `lib/departments.ts`.
- `frontend/components/admin/AdminBoard.tsx`:
  - Replaced hardcoded `DEPARTMENT_TABS` with `DEPARTMENTS`.
  - Updated department filter, department counters, queue table, and review dialog to use canonical IDs and standardized labels.
- `frontend/components/superadmin/SuperadminWorkspace.tsx`:
  - Standardized department listing to display canonical names alongside their lowercase keys.
- `frontend/components/charts/AdminCharts.tsx` & `frontend/lib/report.ts`:
  - Synchronized department dropdown options and CSV report headers to canonical labels.
- `frontend/components/admin/DepartmentEmployeesWorkspace.tsx`:
  - Standardized department heading using `getDepartmentLabel(departmentId)`.
- Verified: Backend pytest suite passed (36/36 tests in classification and seed accounts); `npm run build` compiled with 0 errors across 18/18 routes.

## 2026-10-13 — Mobile Navbar Hamburger Menu

- `frontend/components/ui/SiteHeader.tsx`:
  - Replaced the bottom horizontal scrolling bar on mobile with a clean, collapsible burger menu on the right side of the navbar.
  - Burger toggle button (`Menu` / `X` icon from `lucide-react`) is displayed exclusively on mobile viewports (`md:hidden`).
  - Desktop view remains entirely untouched (`hidden md:flex` for inline links, language picker, user identity, notifications, and sign in/out).
  - Mobile dropdown drawer contains:
    - All primary navigation links (Home, Register Grievance, Track Grievance, Profile) with active state highlights.
    - Integrated language switcher dropdown with full accessibility.
    - User account identification pill with citizen badge, and full-width sign-out button when logged in.
    - Direct sign-in button when logged out.
    - Automatically closes when any navigation link or action is clicked.
  - Verified: `npm run build` compiled with 0 errors across all 18 routes.

## 2026-10-13 — Citizen Views Mobile Responsiveness Pass

- `frontend/components/grievance/GrievanceDetailModal.tsx`:
  - Adjusted modal padding from `p-4 sm:p-6` to `p-2 sm:p-4 md:p-6` and margins to `my-2 sm:my-4` to fit mobile viewports cleanly.
  - Responsive header padding (`px-4 py-4 sm:px-6 sm:py-5`) with wrapping badges and title size scaling (`text-base sm:text-lg break-words`).
  - Mobile-optimized scrollable body (`max-h-[calc(85vh-7rem)] sm:max-h-[calc(85vh-9rem)] px-4 py-5 sm:px-6 sm:py-6`) and full-width close button on mobile (`w-full sm:w-auto`).
- `frontend/app/submit/page.tsx`:
  - Changed two-column layout divider on mobile from vertical border (`border-r`) to horizontal border (`border-b lg:border-b-0 lg:border-r`).
  - Scaled container padding to `py-6 sm:py-8` for compact mobile screens.
- `frontend/app/track/page.tsx`:
  - Made search form stack vertically on mobile (`flex-col sm:flex-row`) with full-width search button (`w-full sm:w-auto`).
- `frontend/app/profile/page.tsx`:
  - Responsive phone verification input layout: stacked on mobile (`flex-col sm:flex-row flex-wrap gap-2`), full width input and buttons (`w-full sm:w-auto`).
- `frontend/components/home/HomeTrackPanel.tsx`:
  - Made tracking form input and action button stack vertically on mobile (`flex-col sm:flex-row`) with full-width button (`w-full sm:w-auto sm:shrink-0`).
- `frontend/components/ui/SiteHeader.tsx`:
  - Constrained language selector dropdown width on small mobile screens (`max-w-[110px] sm:max-w-none`) to prevent navigation clipping.
- `frontend/app/login/page.tsx` & `frontend/app/register/page.tsx`:
  - Optimized container padding on mobile screens (`px-3 py-6 sm:px-4 sm:py-12`, card padding `p-5 sm:p-8`).
  - Allowed remember-me and forgot-password row to wrap cleanly on narrow screens (`flex-wrap`).
- Verified: `npm run build` compiled cleanly (18/18 routes), zero TypeScript or lint errors.

## 2026-10-13 — Citizen Grievance Detail & Progress Modal Popup

- `frontend/components/grievance/GrievanceDetailModal.tsx`:
  - Created a comprehensive modal popup dialog for citizens to inspect their grievances.
  - Displays complete grievance title, ID, category, submission timestamp, live status badge, and priority badge.
  - Includes full milestone `StatusTimeline`, detailed description, assigned department, assigned officer/team, SLA due date, and formatted address/landmark.
  - Renders interactive OpenStreetMap with pinned coordinates (`SinglePinMap`) and an external OpenStreetMap link.
  - Shows attached photo evidence preview and automated AI triage explanation (`AnalysisPanel`).
  - Fetches and displays recent officer field notes and status updates from `getGrievanceHistory(id)`.
  - Accessible dialog with backdrop click dismiss, Esc key shortcut, and close button.
- `frontend/components/grievance/GrievanceCard.tsx`:
  - Added optional `onClick` handler and interactive card styling (hover elevation, ring accent, button role with keyboard Enter/Space activation, and "View progress & details →" prompt).
- `frontend/components/grievance/MyGrievances.tsx`:
  - Connected click interaction on grievance items to open the `GrievanceDetailModal`.
- `frontend/app/track/page.tsx`:
  - Connected click interaction on citizen grievance cards in the "My grievances" tab to open the `GrievanceDetailModal`.
- Verified: `npm run build` compiled cleanly (18/18 routes), `node scripts/check-contract.mjs` passed (all 21 checks), ESLint passed with 0 errors across all touched files.

## 2026-10-13 — Global UI Scale Increased by 20%

- `frontend/app/globals.css`:
  - Configured `:root` typography baseline to `font-size: 120%` with `-webkit-text-size-adjust: 100%` and `text-size-adjust: 100%`.
  - Because Tailwind CSS v4 scales all rem-based typography, spacing, paddings, margins, component containers, buttons, inputs, cards, and modal dialogs proportionally relative to root font size, every view and component scales up cleanly by exactly 20% without horizontal overflow or broken viewport layouts.
- Verified: `npm run build` compiled cleanly (18/18 routes), `node scripts/check-contract.mjs` passed (all 21 checks).

## 2026-10-13 — Manual Location Typing, Unrestricted Map Picker & Department Field Removal

- `frontend/components/grievance/SubmitForm.tsx`:
  - Removed "Suggested department (optional)" dropdown field (`categoryHint`). Grievance classification is completely automated via the backend AI classification cascade (`backend/app/services/classification.py`), removing unnecessary cognitive load from citizens.
  - Cleaned up unneeded schema fields, `Select` import, and query param prefill hook.
- `frontend/components/grievance/LocationCapture.tsx`:
  - Added manual address/landmark search using OpenStreetMap Nominatim forward geocoding (`forwardGeocode` in `frontend/lib/location.ts`), supporting area names, landmarks, and explicit coordinate input.
  - Removed the 25 km radius limitation (`MAX_DISTANCE_KM`), allowing citizens to pick or drag pins to any location across India.
  - Removed the prerequisite of capturing GPS before opening the map; the map picker is now always accessible.
  - Retained one-click GPS geolocation alongside manual typing and map pinning.
  - Displays selected location place name and formatted coordinates with a quick clear/change action.
- `frontend/components/grievance/SubmitForm.tsx`, `frontend/lib/types.ts`, `frontend/lib/api.ts`:
  - Added support for optional `address` string in `Coords`, `SubmitPayload`, and `Grievance`.
- `backend/app/models.py`, `backend/app/routers/grievances.py`:
  - Added `address: str | None = None` to `SubmitGrievanceRequest` and persisted in the grievance document when provided.
- Verified: `npm run build` passed cleanly (18/18 routes), `node scripts/check-contract.mjs` passed (all 21 checks), ESLint clean across all touched files.

## 2026-10-13 — Separate tab for Location Analysis (Map) in Admin Analytics & India Bounds

- `frontend/components/admin/AdminAnalytics.tsx`: Added segmented tab navigation separating "Overview & Trends" from "Location Analysis (Map)".
  - "Overview & Trends" tab contains the macro KPI metric cards, distribution charts (`AdminCharts`), and similarity clusters (`AdminClusters`).
  - "Location Analysis (Map)" tab contains the spatial grievance map (`AdminMap`) and geographical hotspots (`AdminAreaClusters`).
  - Centered the map container (`w-full max-w-2xl mx-auto`) and adjusted dimensions to an almost square shape (`h-[28rem] sm:h-[32rem]` viewport).
  - Both main admin (`ADMIN`) and super admin (`SUPERADMIN`) utilize this updated view on `/admin/analytics`.
- `frontend/components/admin/AdminMap.tsx`:
  - Enforced geographical boundaries restricted to India via `INDIA_BOUNDS` (`[6.0, 68.0]` to `[38.0, 98.0]`).
  - Configured Leaflet with `maxBounds: INDIA_BOUNDS`, `maxBoundsViscosity: 1.0` (prevents dragging outside India), `minZoom: 4`, and full natural tile rendering within the bounds.
  - Filtered markers and bounds fitting so invalid/out-of-bounds coordinates never break the map, and default view fits India when no points are present.
- Verified: `npm run build` passed cleanly (18/18 routes), `check-contract.mjs` passed, ESLint clean on touched components.

## 2026-10-11 — Twilio SMS provider implementation (DEC-027, vars pending)

- `SMS_PROVIDER=twilio` now delivers stage updates and OTP codes through a
  Twilio Messaging Service (`backend/app/services/sms.py`): lazy client,
  fail-closed without credentials, at-most-once dedup preserved, never raises
  into workflows. `POST /phone/request-otp` sends the code when live; the
  response stays generic and `debug_code` remains dry-run-only.
- New env contract (`backend/.env.example` + `render.yaml`, all empty by
  default): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_MESSAGING_SERVICE_SID`, `DLT_ENTITY_ID`, `DLT_TEMPLATE_ID_STAGE`,
  `DLT_TEMPLATE_ID_OTP`. `twilio>=9.0.0` added to requirements (install verified).
- 6 new tests in `tests/test_phone_sms.py` (fake-client dispatch, incomplete
  creds, failure isolation, OTP body + no-code-in-logs, unsupported provider,
  live OTP request without oracle). Targeted suites: 28 passed. Full suite:
  363 passed / 23 failed — 22 known baseline plus one env-specific
  `FACE_CHALLENGES` failure from the local `backend/.env` (fails on clean
  tree too; recorded in TODO §11).
- `docs/DEVELOPMENT.md` gains the operator checklist (Messaging Service,
  DLT registration order, trial limits, 160-char cap warning).

## 2026-10-11 — Frontend language scope cut to English/Hindi/Marathi (DEC-026)

- `frontend/lib/i18n/index.tsx`: the UI picker (`LANGUAGES`) now offers only
  `en` / `hi` / `mr`. All 11 packs stay imported in the `translations`
  registry — nothing deleted; unhiding a language is a one-line picker entry.
  Saved `localStorage` codes outside the picker set fall back to `en`.
- `frontend/lib/i18n/{kn,ml,or,pa}.ts`: backfilled the 131 missing homepage
  keys each with English placeholders under a `TODO i18n` header. This fixes a
  latent `tsc` failure on the working tree (strict `Record<MessageKey, string>`
  typing); runtime behavior is unchanged (the provider already fell back to
  English for missing keys).
- Staff surfaces (`/admin`, `/resolver`, `/superadmin`, `/notifications`) are
  English-only by owner decision; existing `t()` calls there are frozen.
- Verified: `npx tsc --noEmit` clean, `npx eslint` clean, `npm run build`
  green (18 routes), `node scripts/check-contract.mjs` passed.

## 2026-10-11 — Homepage redesign (action-first, citizen-centric portal)

- Redesigned `frontend/app/page.tsx` according to `memory/Redesign_homepage.md`:
  - Hero with strong civic headline, primary "Report a Grievance" and secondary "Track Existing Grievance" actions, and trust statement.
  - Added `frontend/components/home/HomeTrackPanel.tsx`: real-time reference ID tracking with keyboard submission, validation, sample ID, status preview, and direct transition to full activity timeline.
  - Compact 3-stage grievance workflow overview (Submit, Review & Assign, Track & Resolve).
  - Category explorer with clean cards, issue examples, and direct links to `/submit?category=<id>` with preselection support in `SubmitForm.tsx`.
  - Realistic lifecycle breakdown (Submitted → Assisted Triage → Assigned → In Progress → Reviewed & Resolved) with SLAs and accountability notes.
  - "Prepare Before Reporting" checklist (description, GPS location, optional photo, contact).
  - Trust & AI transparency section distinguishing AI-assisted categorization from human officer decisions.
- Updated `frontend/app/track/page.tsx` to read `?id=` query parameter on mount and trigger immediate status search.
- Updated header labels in `frontend/components/ui/SiteHeader.tsx` and `frontend/lib/i18n/en.ts` to consistent "Register Grievance" and "Track Grievance" naming.
- Removed obsolete `frontend/components/home/RequestLifecycle.tsx` per Section 12 of `Redesign_homepage.md`.
- Polished ESLint warnings in `page.tsx`, `HomeTrackPanel.tsx`, and `track/page.tsx`.

## 2026-10-11 — Optional completed work photo in employee submission form

- Added optional completed work photo attachment in `frontend/components/resolver/ResolverWorkspace.tsx`
  under the "Submit your work for review" section, with file selection, Cloudinary upload,
  preview, and removal support.
- Updated `submitResolution` call to pass `completionPhotoUrl` to `POST /grievances/{id}/resolution`.
- Updated `frontend/lib/types.ts` and `frontend/lib/api.ts` with `resolution` object typing including `completionPhotoUrl`.
- Updated `backend/app/db.py` (`to_api`) to include the `resolution` object in serialized grievance payloads.
- Added completed work photo and resolution notes display in `frontend/components/admin/GrievanceReviewModal.tsx`
  so reviewing managers can inspect submitted proof of work before approving.

## 2026-10-10 — Phone binding and citizen SMS dry-run prototype (DEC-025)

- Added India E.164 conversion while retaining normalized 10-digit storage;
  phone-based face login now requires OTP verification. Added hashed, expiring
  OTP challenges, per-account/phone/IP request throttles, citizen bind/unbind
  routes, consent tracking, and masked audit/user-list output.
- Added Profile phone controls and separate optional SMS consent; face signup
  now validates a 10-digit Indian mobile and records optional SMS consent.
  Updated translated signup/login copy in all 11 locales.
- Added citizen-only English stage templates and best-effort background
  dry-run hooks for submission, assignment, key lifecycle transitions,
  resolution approval, closure, and rejection. No provider sends messages.
- `tests/test_phone_sms.py`: 7 passed. Python compile checks, TypeScript, and
  frontend contract checks pass. `next build` was blocked because the sandbox
  denied Turbopack worker port binding. Full endpoint/browser workflow and live
  delivery remain unvalidated/deferred.

## 2026-10-10 — Plan recorded: India phone, phone↔face binding, Twilio SMS (PLANNED, no code)

- Recorded a plan for India phone numbers, OTP-proven facial-recognition
  binding keyed on the phone number, and Twilio SMS grievance-stage
  notifications. **Nothing is implemented** — this is documentation only.
- The survey found that much of the phone work already exists from face-auth:
  `normalize_phone()` already enforces 10-digit Indian mobiles starting `6-9`
  and strips `+91`/`91`/`0`, there is a `uniq_user_phone` index plus
  `find_by_phone`/`find_by_identifier`, and `POST /auth/face/login` already
  accepts a phone as its identifier. The plan records this explicitly so it is
  not rebuilt.
- Real gaps identified: no E.164 export for the SMS provider, no frontend
  phone validation, no OTP, and no SMS transport.
- Two findings drive the design. First, **phone is currently claimed rather
  than proven**, so face-login-by-phone authenticates against an unverified
  identifier — OTP-proven binding is ranked above the SMS work. Second, **TRAI
  DLT registration** (entity, 6-character sender ID, pre-registered templates)
  decides whether SMS is deliverable in India at all, which forces fixed
  template bodies with slots, human stage labels instead of enum values, and a
  160-char cap with reason text kept in-app only.
- `SMS_PROVIDER` defaults to `dry-run` so the repository keeps running with zero
  credentials; SMS is fire-and-forget async and must never fail a grievance
  state change; SMS stays informational only per the HITL principle.
- Written to `memory/TODO.md` §13 with a matching `memory/PROJECT_STATE.md`
  section. `memory/DECISIONS.md` was intentionally left alone — the
  load-bearing choices are still open questions, so no DEC has been accepted.

## 2026-10-10 — Merge `main` into `feature/face-auth` (conflict resolution)

- Merged `main` (`9bef326`) into `feature/face-auth` (`f744be0`) so the face-auth
  PR could be merged. Four conflicts, all resolved by keeping **both** sides:
  - `components/admin/AdminGate.tsx` — the signed-in-as line: face-auth's
    `{user.email || user.citizen_id || user.name}` fallback (face-only accounts
    have no email) kept **inside** main's plain-language rewrite of the
    sentence. Picking either side verbatim would have lost either the fallback
    or the wording pass.
  - `components/superadmin/SuperadminWorkspace.tsx` — the user-card row
    (face-auth's `userLabel`/`userSub`/`isFaceOnly`, "Reset face login" token
    reveal and "Revoke face" buttons) merged with main's department-card copy
    ("Departments currently in use", placeholder "Short code"). The file stores
    the grid as one mega-line, so the conflict was a single-line union.
  - `memory/CHANGELOG.md`, `memory/SESSION_LOG.md` — both sides appended new
    sections; both sets kept. The session log was re-ordered so main's
    2026-10-09 entries precede face-auth's 2026-10-09 → 10-10 run, preserving
    the file's append-chronological convention.
- Auto-merged and verified rather than assumed: `lib/i18n/en.ts` kept main's
  plain-language values (`formTitleLabel: "Issue title"`, `locPin`,
  `emailLabel`, `passwordHint` all confirmed) **and** gained face-auth's new
  keys (249 → 326); the other ten locales carry 55 face keys each;
  `StaffSidebar.tsx` kept main's "Analytics" label and face-auth's
  Profile/Notifications links.
- Verification: `tsc --noEmit` clean, `npm run build` succeeds (18 routes,
  including `/profile`, `/re-enroll`, `/signup/face`),
  `node frontend/scripts/check-contract.mjs` passes, `py_compile` OK across 11
  backend files, no conflict markers, no blue in the UI.
- **Pre-existing on the branch, not introduced by this merge:** `npm run lint`
  reports 4 errors in `components/FaceCapture.tsx` (3 ×
  `react-hooks/set-state-in-effect`, 1 × conditional `useEffect` /
  `rules-of-hooks`). `FaceCapture.tsx` is byte-identical to the branch tip, so
  these predate the merge. Backend face tests remain **unverified here** —
  `pytest` is not installed and `requirements-face.txt` pulls heavy
  face-recognition dependencies.

## 2026-10-10 — Citizen Passwordless Face Authentication: Login & Recovery (`feature/face-auth`)

### Added
- **Citizen 1:1 Face Login (`POST /auth/face/login`)**:
  - Accepts `identifier` (10-digit phone, Citizen ID `CIT-...`, or email for legacy accounts).
  - Strictly 1:1 lookup using `find_by_identifier`; template matching compares strictly against the loaded user's template.
  - Restricted strictly to role `USER`. Privileged roles (`ADMIN`, `SUPERADMIN`, `RESOLVER`) and unknown identifiers return identical generic 401 `{"error": "Face sign-in failed"}`.
  - Rate limiting & lockouts: 5 fails/15 min per-identifier, 20 fails/15 min per-IP. `MODEL_MISMATCH` never counts toward lockout counters and emits `X-Face-Reason: MODEL_MISMATCH`. Public login never touches internal user counter.
- **Recovery & Admin Reset Flow**:
  - `POST /auth/face/admin-reset/{user_id}`: ADMIN/SUPERADMIN only, audited. Deletes the user's template and issues a 24-hour single-use `re_enroll` token. Restricted to `face_only` accounts.
  - `POST /auth/face/re-enroll`: Public endpoint accepting token, identifier, challenge_id, and frames. Runs full enrollment pipeline and replaces template. Burns token only upon success (remains valid on verification failure until 24-hr expiry).
- **Frontend**:
  - Login page Face tab: Single field "Mobile number or Citizen ID" plus camera without email references. 3-failure municipal office reset prompt. Clear re-enroll message on `MODEL_MISMATCH`. Link to `/re-enroll`.
  - Superadmin UI: Flag-gated "Reset face login" button for `face_only` citizens revealing single-use token for in-person handoff.
  - Profile page: Warning on biometric deletion for `face_only` users explaining removal of their sole sign-in method; link to `/re-enroll`.
  - Public Recovery Page: `/re-enroll` allowing citizens holding a token to capture and store a new face template.
  - i18n: Added 14 new keys (English strings) across all 11 language packs (`en`, `hi`, `bn`, `gu`, `kn`, `ml`, `mr`, `or`, `pa`, `ta`, `te`).
- **Tests & Verification**:
  - 6 new core integration tests in `tests/test_face_login_recovery.py` covering login, role gating, lockouts, admin reset, and token burning.
  - All 140 face & drift tests pass; full suite confirms exactly the 22 known baseline failures (370 passed); TypeScript and Next.js production build clean.

## 2026-10-10 — Face authentication accuracy and performance optimizations (`feature/face-auth`)

### Added & Optimized
- **Accuracy fixes (`c9f041e`)**:
  - Webcam capture upgraded to 640x480 @ JPEG quality 0.92 (drastically improving landmark detection on laptop webcams).
  - Preview mirror via CSS `-scale-x-100` while preserving natural un-mirrored frame orientation for liveness heading checks.
  - Frontal-only 3-frame template matching: recognition extracts and compares embeddings only on the top 3 frontal frames (lowest `|yaw|`, highest `det_score`).
  - `FACE_CONSISTENCY_THRESHOLD` (default 0.30) added to `config.py` and `.env.example` for pairwise consistency across captured frontal frames, decoupled from `FACE_MATCH_THRESHOLD` (0.45).
  - Comprehensive `[FACE_DEBUG]` line logging raw metrics without logging embeddings, images, or tokens.
  - Safe camera lifecycle management via `lib/camera.ts` (stopping tracks on capture completion, cancel, error, unmount, visibility change, and pagehide).
- **Performance optimizations (`5b0bd68`)**:
  - Model pruning: `allowed_modules=["detection", "landmark_2d_106", "recognition"]` avoids loading gender/age modules.
  - Detector resolution: `det_size = max(320, config.FACE_DET_SIZE)` with `FACE_DET_SIZE=320` default for CPU speed.
  - 3-frame embedding path: deferred recognition via `_real_embed` seam runs ArcFace only on the top 3 frontal frames instead of all 6 frames.
  - Multi-threaded inference: `opts.intra_op_num_threads = min(4, os.cpu_count() or 1)` in ONNX Runtime with thread-safe lock.
  - Frame tolerance: `FaceCapture.tsx` captures 6 frames at 250ms intervals; backend accepts 5-8 frames and tolerates 1 failed quality frame out of 6 as long as >=5 valid candidates exist and 3 frontal pass.
  - Visual feedback: "Still working…" status indicator appears if face verification exceeds 5 seconds.
  - Database round-trip optimizations:
    - Atomic 1-RTT rate limits via MongoDB aggregation pipeline `find_one_and_update` with TTL (`windowExpiresAt`).
    - Batch rate pre-check via `rate_counts` combining IP and email queries into a single round trip.
    - MongoDB index conflict handler in `ensure_indexes` catching code 85 and migrating legacy indexes to `expireAfterSeconds=0`.
    - Asynchronous startup preload thread `_warmup_face_auth` preventing cold-start latency spikes.
  - All 112 unit tests and 15 config drift tests passing; TypeScript, Next.js production build, and contract checks passing cleanly.

## 2026-10-09 — Optional face-recognition login (DEC-024, `feature/face-auth`)

### Added
- **Backend face auth** (flag `FACE_AUTH_ENABLED`, default off; `7fc2c0e`,
  `a3d65a7`): `/auth/face/*` (challenge, enroll, login, verify-second-factor,
  status, template PATCH/DELETE, superadmin revoke) behind `FaceRouteGuard`
  (404 when off, HTTPS enforcement, 4 MB body cap); Fernet-encrypted
  InsightFace templates; server-side liveness (turn/blink/smile) with
  fail-closed quality gates; per-IP/per-email/per-user TTL lockout counters;
  `MODEL_MISMATCH` re-enroll path that never counts toward lockout;
  `GET /config` → `{faceAuthEnabled}`; optional deps in
  `backend/requirements-face.txt`.
- **Privileged optional step-up** — password/Google logins pause with a
  5-minute `pending_2fa` token when `requireLogin2fa` is set;
  `POST /auth/complete-pending` completes only a locked-out account (403
  otherwise); face lockout always falls back to password-only login.
- **Frontend** (`f6fd67f`): flag-gated Password/Face login tabs, 1:1 face
  sign-in, 2FA step with skip, `/profile` consent/enroll/re-enroll/delete/
  require-2FA toggle, superadmin "Revoke face", `FaceCapture` webcam
  component, pending tokens under their own storage key, 45 i18n keys in all
  11 packs.
- **Env-tunable liveness/quality thresholds** (`be7266f`):
  `FACE_TURN_MIN_DEGREES` (15.0), `FACE_BLINK_EAR_DROP` (0.7),
  `FACE_SMILE_MOUTH_WIDEN` (1.08), `FACE_MIN_BLUR_VARIANCE` (30.0),
  `FACE_MIN_FACE_PX` (80) — read at call time, mirrored in
  `backend/.env.example`, for real-webcam tuning without code changes.
- **Tests** — `tests/test_face_auth.py` (106) on synthetic frames + a fake
  detection seam (no camera/model in CI), incl. the complete-pending gate,
  MODEL_MISMATCH no-count, and unauthenticated-counter-protection checks.
- **Docs/memory** — `docs/API.md` (`/config`, `/auth/face`, login pause,
  complete-pending), `docs/SECURITY.md` (step-up is convenience not control;
  embeddings = biometric data, consent, deletion), `docs/WORKFLOWS.md`,
  `docs/DEVELOPMENT.md` + `README.md` install notes, DEC-024,
  `memory/rbac/AUTHENTICATION.md`, TODO baseline (22 pre-existing failures
  listed by name; password/refresh rate-limit gap).
## 2026-10-09 — Department-wise summary export on the admin analytics dashboard

- Added an “Export summary (CSV)” button to `/admin/analytics` (available to
  ADMIN and SUPERADMIN, and scoped to their own department for department
  managers). It downloads a two-block report: a per-department count block
  (total, open, in progress, resolved/closed, urgent, past deadline,
  % resolved), then a detail block listing every registered complaint grouped
  under its department with description, AI summary, keywords, priority,
  status, assignee, registered/due/resolved dates, coordinates and a map link.
- Extracted the CSV builders to `frontend/lib/report.ts` (`buildComplaintsCsv`,
  `buildSummaryCsv`) — pure functions, no React/DOM — so both buttons share one
  implementation. The existing flat export is now labelled “Export complaints
  (CSV)”; its output is unchanged.
- Verified by executing the builder against fixtures (department grouping and
  counts, description/summary/keyword/location columns, CSV quoting, blank
  location handling), plus `tsc`/`build`/`lint`.

## 2026-10-09 — Admin and employee interface wording made plainer

- Same plain-language pass applied to the admin and employee (resolver)
  surfaces. Employee view: page title “My work”, “Employee access required”
  gate, friendlier hold/update/problem-report copy, and clearer action buttons
  (“Raise ticket” → “Send to manager”, “Submit completion” → “Send for
  review”, “In Progress” → “Mark in progress”).
- Admin view: page title “Administrative Control Centre” → “Admin dashboard”;
  access screens rewritten (“Verifying administrative privileges…” →
  “Checking your access…”, “Authentication Required” → “Sign in required”,
  “Sign in as Administrator” → “Sign in”); queue table headers (“Assignee” →
  “Assigned to”, “Fix-by Date” → “Due by”, “Age” → “Waiting”); review-modal
  action buttons (“Review department assignment” → “Assign to this
  department”); analytics headings (“Spatial analysis” → “Where complaints
  are happening”, “Area concentration analysis” → “Hotspots by area”,
  “Export CSV Report” → “Download report (CSV)”). Sidebar “Executive
  Analytics” → “Analytics”, superadmin gate/title copy simplified.
- Domain terms (grievance/ticket, status/role/department names, issue types,
  CSV column headers) and code identifiers were left unchanged.

## 2026-10-09 — Input field wording made plainer (English)

- Reworded the citizen-facing form copy in `frontend/lib/i18n/en.ts` to plain,
  non-technical language: “Subject / Short Title” → “Issue title”, “Detailed
  Description” → “Describe the issue”, “Intended Department (Optional)” →
  “Suggested department (optional)”, “Evidence Photograph” → “Photo of the
  issue”, “Incident location” → “Issue location”, “Pin My Current Location” →
  “Use my current location”, “Let system auto-classify” → “Not sure? Choose
  for me”, and the submit button “Submitting & Classifying…” → “Submitting…”.
  Hints, placeholders and error text were tightened the same way.
- Staff-facing hardcoded labels: “Officer Notes (Optional)” → “Note for the
  citizen (optional)”, “Assign to employee”/“Assign to Department” → “Assign
  to an employee”/“Assign to a department” (`GrievanceReviewModal`), “Hold
  reason” → “Reason for hold” (`ResolverWorkspace`), admin filters “Priority
  Filter”/“Sort Order” → “Priority”/“Sort by” and a spelled-out search
  placeholder (`AdminBoard`), employee form “Name” → “Full name”,
  “Temporary password” → “Set a temporary password”
  (`DepartmentEmployeesWorkspace`), superadmin “key” → “Short code”.
- English only. `MessageKey` is derived from `en.ts`, so keys were left intact
  and the ten translated locale files were not touched (requested); those
  locales keep their existing translations.

## 2026-10-09 — Request lifecycle label clarified

- Renamed the timeline stage “AI Triage & Categorization” to “Department
  Assigned” and updated its translation in all ten supported Indian locales.

## 2026-10-09 — Public reference tracking after employee progress updates

- Fixed the Track page so a history request failure cannot overwrite a
  successfully fetched grievance with the “not found” state.
- Made detail/history lookups available to anonymous and non-owner tracking
  with a limited public projection and customer-visible/system updates only;
  private identities, assignment metadata, coordinates, images, and internal
  history stay out of that response. Reference IDs are case-insensitive.
- Required authentication for the full grievance-list endpoint so public
  reference tracking cannot be bypassed by enumerating the collection.
- Added a regression for a worker-started grievance searched signed out and by
  another signed-in citizen, and documented the public tracking contract.

## 2026-10-09 — Footer trust bar removed

### Removed
- The `SiteFooter` "Trust bar" strip and its three copy strings: "Audited &
  tamper-evident records", "Built for local civic workflows", and "Academic
  research prototype". The auditability claim over-promised for a prototype,
  and the research-prototype label is internal context (`AGENTS.md`, `PRD.md`,
  `README.md`), not citizen-facing UI.
- Deleted `footerTrustRecords`, `footerTrustLocal`, and `footerTrustPrototype`
  from `en.ts` and all ten translated locales. Required rather than optional:
  `Messages = Record<MessageKey, string>` is derived from `en.ts`, so leftover
  keys would be a TypeScript error. No other component referenced them.
- Dropped the now-unused `ShieldCheck` import from `SiteFooter.tsx`; `MapPin`
  and `Mail` are still used by the contact list. The main footer columns are
  unchanged.

## 2026-10-09 — Worker assignment visibility across department aliases

- Added shared backend and frontend department normalization for canonical keys,
  legacy IDs, and display labels, including Roads & Transport variations.
- Added `GET /resolver/tasks`, scoped strictly to the authenticated worker's
  owner ID; employee dashboards no longer depend on a department-filtered
  general grievance list. Assignment notification recovery remains owner-checked.
- Applied canonical department matching to manager employee lists and assignment
  eligibility, preventing valid workers from being excluded or incorrectly
  rejected because their stored department uses a display/legacy name.
- Added an end-to-end regression covering manager visibility, assignment,
  worker queue visibility, starting work, and isolation from another department.

## 2026-10-09 — Left-nav-only navigation: three content-area tab bars removed

### Changed
- **Top `AdminNav` strip** (Grievance Queue · Executive Analytics · Employees)
  deleted from `components/admin/AdminNav.tsx` and from its three call sites
  (`app/admin/page.tsx`, `app/admin/analytics/page.tsx`,
  `app/admin/employees/page.tsx`). It was an exact duplicate of the
  `StaffSidebar` links — role gating already matched (`ADMIN && departmentId`).
  `AdminHeader` (title/badge/identity) is kept; the file still exports only it.
- **Department Portals tab row** in `components/admin/AdminBoard.tsx` (All
  Departments / Water Supply / Roads… with per-department count chips) replaced
  by a single labelled `<select id="queue-department-filter">` in the Grievance
  Queue card header, directly above the table. Options carry the counts
  (`Water Supply (3)`), so `deptCounts` is still used. Same visibility rule as
  before — hidden for department managers, who are server-scoped to one dept.
  `DEPARTMENT_TABS` stays (it also drives `categoryLabel()` and the table
  subtitle) but lost its now-unused `Icon` field and the 7 icon imports.
- **Employee Accounts / Assign Tasks switcher** in
  `components/admin/DepartmentEmployeesWorkspace.tsx` removed; both panels now
  stack (create/list cards, then the assign-tasks card). `activeTab` state and
  the `role="tablist"` markup are gone; `Users` / `BriefcaseBusiness` icons
  remain in use inside the panels.
- Result: the left `StaffSidebar` is the only tab navigation for staff.

### Verified
- Grep for `role="tab|tablist|setActiveTab|setSelectedDeptTab` → only
  `app/track/page.tsx` (citizen page, top header, out of scope) and the
  dropdown's `setSelectedDeptTab` handler remain.
- `npm run lint` (0 errors, 1 pre-existing `<img>` warning) and
  `npm run build` (15 routes) both pass.

### Follow-up
- `components/admin/AdminNav.tsx` now exports only `AdminHeader`; renaming it
  to `AdminHeader.tsx` was skipped to avoid churn while other work is landing
  in this repo.

---

## 2026-10-09 — UI accent: bright orange + black CTAs, all blue removed

### Changed
- `frontend/app/globals.css`: replaced the indigo-blue `--color-primary-*`
  scale with a bright orange scale (600 = `#ff6b00`, 700 = `#c24a00`); replaced
  the blue-tinted slate `--color-ink-*` scale with true neutral (zinc) greys;
  `--foreground` → `#18181b`. Because every `primary-*` / `ink-*` class reads
  from these tokens, ~70 references across 26 files restyled automatically.
- `Button.tsx`: default `primary` variant is now solid black
  (`bg-ink-950`, hover `ink-800`) — Submit/Sign in/Post update CTAs; added a new
  `orange` variant (`bg-primary-700`) for accent-colored buttons; `outline`,
  `secondary`, `ghost`, `dark` unchanged in structure.
- `app/page.tsx`: hero "Register Complaint" CTA link switched to black to match;
  hero dot-pattern gradient → `rgba(255,107,0,0.12)`.
- Contrast rule applied: orange that meets **text** uses 700 (4.9:1) — all
  `text-primary-600` → `text-primary-700`, all `bg-primary-600 text-white` →
  `bg-primary-700 text-white`, focus rings/borders and `accent-primary-*`
  → 700 (bright 600 is 2.9:1 on white and stays decorative only: progress
  bars, card/selected borders, map pins, hover states).
- Hardcoded blues removed: `AdminBoard.tsx` `blue-*` card classes → `primary-*`;
  map-pin hex `#026bc7` → `#ff6b00` in `AdminMap.tsx`, `SinglePinMap.tsx`,
  `LocationCapture.tsx`; `AdminCharts.tsx` `GREYS` → neutral hexes with
  `#ff6b00` as the lead pie slice; `AdminMap.tsx` popup label `#64748b` →
  `#71717a`; tooltip border `#e2e8f0` → `#e4e4e7`.
- `Badge.tsx`: `tone="blue"` renamed to `tone="orange"` (2 call sites).
- **Kept:** the official Google brand logo colors (`#4285F4` etc.) in
  `login/page.tsx` and `register/page.tsx` — altering them breaks brand rules.

### Verified
- Repo-wide grep for `blue|indigo|sky|cyan|azure|navy|slate` + hex sweep →
  only the Google logo and an explanatory comment remain.
- `npm run lint` (1 pre-existing `<img>` warning, 0 errors) and
  `npm run build` (13 routes) both pass.
- Not browser-verified: no desktop browser was connected to this session.

---

## 2026-10-08 — Navbar: CTA removal + staff chrome split

### Changed
- `SiteHeader.tsx`: removed the "File Grievance" header button (`/submit`
  stays in the nav as "Register Complaint" for citizens and in
  `app/page.tsx` CTAs + `SiteFooter`); header is now citizen/logged-out only.
- New `components/ui/AppShell.tsx` picks page chrome by role: staff
  (ADMIN, RESOLVER, SUPERADMIN) get no top header — a persistent sticky
  left sidebar (`components/ui/StaffSidebar.tsx`, `sticky top-0 h-screen`,
  per-role links with icons + active states, account footer with sign out)
  with content/footer in the right column; citizens keep the original
  sticky header + mobile link row.
- Sidebar collapses to a 64px icon rail below `sm` (no burger needed).
- Superseded intermediates (right drawer → left drawer → burger sub-strip,
  all in earlier revisions of this entry's session) removed;
  `StaffDrawer.tsx` deleted.

### Verified
- `npx tsc --noEmit`, `npx eslint` on touched files, `node scripts/check-contract.mjs`,
  `npm run build` all green.

---

## 2026-10-08 — Frontend workflow surfaces

- Added `/resolver` with assigned-ticket queue, canonical state transitions,
  progress updates, resolution submission, and activity history.
- Added `/superadmin` with user, department, and audit overview panels.
- Expanded typed API helpers for workflow actions and grievance list filters.
- Updated tracking to use live recent grievances and customer-visible history.
- Fixed the existing session lint error and removed unused frontend variables.
- TypeScript, ESLint, and offline contract checks pass; Next production build
  remains blocked in this sandbox by a Turbopack process/port permission error.

### Follow-up
- Added explicit superadmin actions for user role/active-state changes and
  department enable/disable/create operations.
- Migrated demo role resolution away from substring-based admin escalation;
  resolver and superadmin test accounts now route to their own portals.
- Added client-side image MIME-type and 10 MB size validation.

## 2026-10-08 — Citizen home and navigation usability

- Reworked the home hero copy and calls to action around the citizen journey.
- Added an interactive, auto-progressing five-stage request lifecycle explainer
  covering submission, review, assignment, work, and resolution.
- Improved navbar active-state styling, role labels, and role-specific links.
- Clarified the complaint location field as a required incident location,
  explained why it is needed, and displayed captured coordinates.

## 2026-10-08 — Require sign-in before complaint submission

- Gated `/submit` behind authenticated user state with a sign-in prompt and
  return path.
- Changed `POST /submit-grievance` to require a verified JWT and derive the
  grievance owner from the token instead of trusting a body `userId`.
- Updated login redirect handling, API/security documentation, and frontend
  verification.

## 2026-10-08 — Two-tab grievance tracking

- Restructured `/track` into `My grievances` and `Search by ID` tabs.
- Added centered reference-ID lookup with authorized-result messaging.
- Added department request totals below the search area and in the personal
  view, using the currently available live/mock registry data.
- Added aggregate `GET /grievances/department-counts` so department cards use
  registry totals without exposing individual grievance records.
- Added a signed-out-state prompt in the personal tab: “Sign in to check
  status”, with a return path to `/track` after authentication.
- Expanded canonical state timeline handling and live tracking history.
- Added department ID to authenticated profiles/tokens so ADMIN feeds can be
  scoped server-side to their department.
- Added department-manager assignment integration: the admin review modal now
  loads resolver candidates and uses the canonical assignment endpoint.

## 2026-10-08 — Geolocated demo grievance dataset

- Added `backend/seed_demo_data.py`, an idempotent seeder for eight curated
  civic grievances covering every current category, with Indian city
  coordinates, department keys, realistic descriptions, curated triage
  metadata, and bundled attachment URLs.
- Added one generated civic-inspection image per domain under
  `frontend/public/demo-assets/`.
- Documented the command and `DEMO_IMAGE_BASE_URL` override in `README.md`.

---

## 2026-10-08 — Doc cleanup: retired plan docs, single TODO (DEC-020)

### Removed (history preserved in git)
- `UNIFIED_MIGRATION_PLAN.md` — all phases ✅; open items already tracked
  elsewhere (key rotation) or resolved (model files kept, see DEC-020).
- `memory/ADMIN_UI_RESTRUCTURING_PLAN.md` — IMPLEMENTED, all [x]; outcome
  lives in DEC-018, code, and `memory/rbac/ROLE_INTERFACES.md`.
- `frontend/README.md` — stock create-next-app boilerplate, zero references.

### Changed
- `INTEGRATION.md` slimmed to a historical pointer (kept: linked from
  `README.md` + DEC-008).
- `memory/NEW_TODO_TASKS.md` → `memory/TODO.md` verbatim (the name
  `AGENTS.md` + `memory/README.md` mandate); §4C link repointed to DEC-018.
- `docs/WORKFLOWS.md` names `memory/rbac/GRIEVANCE_WORKFLOW.md` as the
  normative state spec; `memory/PROJECT_STATE.md` dead checklist link fixed.
- `memory/DECISIONS.md` DEC-020 (close-out record).
- Kept `frontend/AGENTS.md` + `CLAUDE.md` — regenerated by `next dev`.

### Verified
- Full `pytest` green except the 8 pre-existing vocab parser failures;
  contract checks pass; no live references to removed files.

---

## 2026-10-08 — Analytics map stacking + similar-complaint city/state labels

### Fixed
- Map-over-navbar on `/admin/analytics`: `AdminMap.tsx` and `SinglePinMap.tsx`
  containers now form their own stacking context (`relative z-0`), containing
  Leaflet's internal panes (z 200–1000) below the sticky header (`z-40`) and
  the review modal (`z-50`). Header z-index deliberately untouched so it
  stays under the modal overlay.

### Added
- Similar-complaint groups now show a "City, State" line (`AdminClusters.tsx`
  + new `useClusterLocations.ts` hook): majority vote of member coordinates
  via cached Nominatim reverse geocoding (`reverseCityState` in
  `lib/location.ts`). Best-effort — groups without pins keep the
  text-derived area label; no backend migration (display-only).
- `parseCityState`/`formatCityState` pure parsers pinned by 10 new
  `check-contract.mjs` assertions (offline, no network).

### Verified
- `npx tsc --noEmit` clean, `npx eslint` clean on touched files,
  `node scripts/check-contract.mjs` passed, `npm run build` 9 routes.

---

## 2026-10-08 — Testing-phase seed accounts per department (DEC-019)

### Added
- `backend/app/seed_test_accounts.py` — idempotent superadmin + 8× MANAGER/EMPLOYEE matrix (departments auto-created, taxonomy == `CATEGORY_KEYS`); wired into startup behind `SEED_TEST_ACCOUNTS`/`SEED_TEST_PASSWORD` (`backend/app/main.py`, `backend/app/config.py`, `backend/.env.example`).
- `frontend/lib/testAccounts.ts` — `/login` dev box now lists all 19 accounts with Autofill (gated by `NEXT_PUBLIC_SHOW_DEV_CREDS`); `frontend/.env.example` + `README.md` test-account docs updated.
- `tests/test_seed_accounts.py` (4 tests) — matrix, idempotency, existing-untouched, cross-department flow; `tests/conftest.py` pins seed flags off.
- `memory/DECISIONS.md` DEC-019 (seed strategy + dev-gating rationale).

### Verified
- `pytest tests/test_seed_accounts.py` → 4 passed. `npx tsc --noEmit` clean, contract checks pass.

---

## 2026-10-06 — RBAC workflow coverage + frontend auth fix

### Added
- `tests/test_rbac_workflow.py` (11 tests): assign RBAC, full resolve→close lifecycle with visibility filtering, unassigned-history 403, cross-citizen escalate 403, users/roles, departments, audit + notifications fan-out.
- `frontend/lib/api.ts` workflow clients: `assignGrievance`, `transitionGrievanceState`, `addProgressUpdate`, `getGrievanceHistory`, `listUsers`, `listDepartments`, `listAudit`, `listNotifications`; schema extended with `state/departmentId/ownerId/managerId/dueDate/resolvedAt/closedAt`.

### Fixed
- `frontend/lib/api.ts:194-210` IDOR: `getGrievance()` now uses authenticated `requestJson` (Bearer + refresh) instead of raw `fetch`; 404 still returns `null` (matches `check-contract.mjs:184-187`).
- `tests/conftest.py` isolation: `fresh_repository` rebinds grievance/users/audit/progress/notification/department/SLA stores on every router module (fixes cross-test leakage where assignments wrote old singletons while reads used fresh ones).

### Verified
- `pytest tests/test_rbac_workflow.py tests/test_auth.py` → 33 passed. Full suite → 206 passed, 27 skipped, 8 pre-existing `test_status_vocabularies.py` parser failures (DEC-018 restructuring).
- `npx tsc --noEmit` clean; `node scripts/check-contract.mjs` passed.

---

## 2026-10-06 — RBAC Phase 0-2 test alignment (canonical UPPER states)

### Fixed
- `backend/.env.example` — added `SEED_SUPERADMIN_EMAIL/PASSWORD`, `ALLOW_DEMO_SUBMIT` (closes `test_config_drift` gap: keys read by `backend/app/config.py:66-68` were undocumented).
- `backend/app/db.py:361-368` — restored `assignee` in `to_api()` passthrough (legacy `PATCH /status` compat; new code uses `ownerId/departmentId`).
- `tests/test_auth.py`, `tests/test_endpoints.py`, `tests/test_repository.py` — updated to canonical UPPER states (`SUBMITTED/ASSIGNED/IN_PROGRESS/RESOLVED/CLOSED`) emitted by `to_api()`; unknown-status test now asserts canonicalisation (`Banana`→`BANANA`, `OPEN`→`SUBMITTED`).
- `tests/conftest.py` — `fresh_repository` now swaps `db.repository` on `assignments/progress/admin` routers and resets in-memory audit/progress/notification/department/SLA stores (prevents cross-test leakage on new endpoints).

### Verified
- `pytest tests/test_auth.py tests/test_endpoints.py tests/test_repository.py tests/test_config_drift.py` → 100 passed, 20 skipped.
- Full `pytest` → 195 passed, 27 skipped, 8 failed — all 8 in `tests/test_status_vocabularies.py` are pre-existing parser failures (TIMELINE/filter restructured in DEC-018, noted 2026-10-05), not regressions.
- TestClient smoke: `/health` 200 `in-memory`, `/departments` + `/users` 401 unauthenticated, unknown grievance 404.

---

## 2026-10-06 — RBAC Spec Suite (`memory/rbac/`)

### Added
- `memory/rbac/` (12 files): `README`, `RBAC`, `AUTHENTICATION`, `ROLE_INTERFACES`, `GRIEVANCE_WORKFLOW`, `PROGRESS_FLOW`, `TICKET_MANAGEMENT`, `BACKEND_ARCHITECTURE`, `API_CONTRACTS`, `DATABASE_CHANGES`, `NOTIFICATION_FLOW`, `IMPLEMENTATION_CHECKLIST`.
- SUPERADMIN vs ADMIN split per owner spec (admin/role/permission/department management → SUPERADMIN only); CUSTOMER/EMPLOYEE/MANAGER mapping to `USER/RESOLVER/ADMIN`; all proposals tagged `[EXISTING]/[MODIFY]/[NEW]/[DEPRECATED]` grounded in `backend/app/auth.py`, `routers/grievances.py`, `routers/auth.py`, `db.py`, `users_db.py`, `frontend/lib/roles.ts|session.tsx|api.ts|sla.ts`.
- No code migrated; docs-only. Stale-auth headers (`docs/SECURITY.md`, `docs/API.md`) flagged for Phase 0 fix, not edited here.

---

## 2026-10-05 — Analytics Map Viewport Enlarged

### Changed
- `frontend/components/admin/AdminMap.tsx` — added an optional
  `heightClassName` prop (default `"h-80"`, preserving prior behaviour) so the
  map viewport height is owned by the consuming page instead of hardcoded.
- `frontend/components/admin/AdminAnalytics.tsx` — the Geographic Distribution
  map now uses a larger, responsive height (`h-[24rem] sm:h-[30rem] lg:h-[34rem]`
  = 384px / 480px / 544px, previously a fixed `h-80` = 320px) and tighter card
  padding (`p-4` → `p-3`) to give the map more usable area.

### Verification
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint components/admin/AdminMap.tsx components/admin/AdminAnalytics.tsx` — clean (exit 0).
- `npm run build` — zero errors; all 9 routes compile, `/admin/analytics` included.
- Confirmed Tailwind emitted the new arbitrary utilities in the production CSS
  (`.h-[24rem]`, `@media (min-width:40rem){.sm:h-[30rem]}`, `@media (min-width:64rem){.lg:h-[34rem]}`) — they were not silently dropped.

---

## 2026-10-05 — Admin UI Restructuring (3-Part Modular Architecture)

Implemented the owner-approved design in `memory/ADMIN_UI_RESTRUCTURING_PLAN.md`:
one lean triage board, one centered review dialog, one executive analytics page.

### Added
- `frontend/app/admin/analytics/page.tsx` — new `/admin/analytics` route (auth-gated).
- `frontend/components/admin/AdminAnalytics.tsx` — executive dashboard: macro metric cards, distribution charts, geographic map, TF-IDF clusters, and CSV report export.
- `frontend/components/admin/GrievanceReviewModal.tsx` — centered review dialog with ticket metadata, evidence photo, single-pin map, AI triage panel, and officer action controls (`Assign & Route`, `In Progress`, `Mark Resolved`, `Reject / Close`).
- `frontend/components/admin/SinglePinMap.tsx` — single-location Leaflet map for the review dialog.
- `frontend/components/admin/AdminNav.tsx` — `AdminNav` sub-tabs (`Grievance Queue` | `Executive Analytics`) + shared `AdminHeader`.
- `frontend/components/admin/AdminGate.tsx` — shared admin authorization wrapper (loading / unauthenticated / forbidden states).
- `frontend/components/admin/useAdminGrievanceFeed.ts` — shared live/mock grievance feed hook for the queue and analytics pages.
- `frontend/components/admin/departments.ts` — shared nodal department list.
- `frontend/lib/sla.ts` — deterministic prototype SLA helper (`Overdue` / `On Track` / `Closed`); see DEC-018.

### Changed
- `frontend/components/admin/AdminBoard.tsx` — **refactored** from the 2-column queue + inline resolver workspace into a full-width triage **table** (Ticket, Department, Priority, Status, Assignee, SLA, Age). Inline map, TF-IDF clusters, and chart panel were removed from the triage board; clicking a row opens the review modal. KPI cards, department portal tabs, and filters retained.
- `frontend/app/admin/page.tsx` — reduced to the shared `AdminGate` + `AdminHeader` + `AdminNav` shell; inline `AdminCharts` removed (moved to analytics).
- `frontend/components/charts/AdminCharts.tsx` — accepts an optional `items` prop so the analytics page reflects live data (defaults to mock registry).

### Verification
- `npm run build` — zero errors; `/admin` and `/admin/analytics` compile and return 200 under `next start`.
- `npx eslint components/admin app/admin lib/sla.ts` — clean.
- `pytest -q` — 196 passed, 27 skipped; the 7 failures in `tests/test_status_vocabularies.py` are **pre-existing** (they parse a `TIMELINE` array in `GrievanceCard.tsx` and `Field label="Status"` in `AdminBoard.tsx`, both already absent in the working tree before this task) and are unrelated to the admin restructuring.

---

## 2026-10-04 — Admin Portal Overhaul, Resolver Action Center & Citizen Experience Elevation

### Added / Upgraded — Admin Control Center
- `frontend/components/admin/AdminBoard.tsx`:
  - **Department Portal Tabs**: Interactive top navigation tab strip filtering the entire dashboard, metrics, queue, and map markers across all civic departments (Water, Roads, Power, Sanitation, Health, Governance, Other) with real-time ticket counters.
  - **Executive Command Metrics**: Added real-time KPI overview (Total Grievances, Urgent Attention with pulse alert, Needs Triage/Assignment, In Remediation, and Verified Resolution rate percentage).
  - **Dedicated Resolver Action Center**: Officer workspace supporting direct lifecycle updates (`Open` → `Assigned` → `In Progress` → `Resolved` → `Rejected`), department assignment routing, and official resolution memo recording.
  - **Queue Filters & Sorting**: Instant search with clear button, priority filter, lifecycle status filter, and multi-mode sorting (Urgency first, Newest first, Oldest first).
- `frontend/components/admin/AdminClusters.tsx` & `AdminMap.tsx`: Halved border radii (`rounded-lg` → `rounded-md`) for design system consistency.

### Added / Upgraded — Citizen Experience
- `frontend/app/register/page.tsx`: Overhauled to modern full-height split-screen layout with dark branding panel left (`lg:w-[420px]`), matching `app/login/page.tsx`.
- `frontend/components/grievance/GrievanceCard.tsx`: Upgraded `StatusTimeline` into a milestone progress tracker with status icons (`CheckCircle2`, `CircleDot`, `Clock`, `AlertCircle`), descriptive step subtitles, and accurate status mapping (`open`/`submitted`, `triaged`, `assigned`, `in_progress`, `resolved`).
- `frontend/components/ui/Feedback.tsx`: Added `warning` tone support for `Alert`.

---

## 2026-10-03 — UI Overhaul & Universal Cross-Platform Setup Documentation

### Modified — Frontend UI & Layout
- Replaced emoji icons across the frontend with `lucide-react` SVG icons (`Droplets`, `Construction`, `Zap`, `Trash2`, `HeartPulse`, `Landmark`, `FolderOpen`, `FileText`, `BrainCircuit`, `CheckCircle2`) with proper TypeScript typing.
- Halved corner radiuses across base UI components (`Button`, `Field`, `Card`, `Badge`, `Feedback`, `SiteHeader`, `SiteFooter`, `GrievanceCard`, `AdminBoard`).
- Redesigned all page layouts to use full screen width instead of narrow centered columns (`max-w-3xl`/`max-w-6xl` removed; 50/50 split hero, sticky 2-column submit view, full-width tracking panel, and modern split auth page).

### Modified — Documentation
- `README.md` — Added universal cross-platform local setup guide covering Windows (PowerShell and cmd.exe), macOS, Linux (Bash, Zsh, Fish), with virtual environments (`venv`) and without virtual environments (Conda, Docker, direct Python). Added guidance on `NEXT_PUBLIC_USE_MOCKS` and MongoDB fallback.
- `docs/DEVELOPMENT.md` — Harmonized backend setup commands with cross-shell activation and universal `python -m uvicorn` execution.
- `memory/NEW_TODO_TASKS.md` — Updated strategic task checklist reflecting completed UI overhaul, layout, and icon items.

---

## 2026-10-03 — Phase 1: JWT Authentication, Google OAuth 2.0 & Server-Side RBAC (DEC-017)

### Added — Backend
- `backend/app/auth.py` — Stateless JWT utilities (PyJWT), access tokens (60m) & refresh tokens (7d), password hashing via `bcrypt`, FastAPI dependencies (`get_current_user`, `get_optional_user`, `require_role`)
- `backend/app/users_db.py` — Users collection persistence (`MongoUsersRepository` with unique index on email, `InMemoryUsersRepository` fallback)
- `backend/app/routers/auth.py` — `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/google`, `/auth/google/callback`
- `tests/test_auth.py` — 21 unit & integration tests covering registration, duplicate rejection, login, token refresh, `/auth/me`, and RBAC enforcement on grievances endpoints

### Added — Frontend
- `frontend/app/auth/callback/page.tsx` — Handles Google OAuth redirect, exchanges query tokens, fetches user profile, and routes to appropriate portal
- `frontend/lib/api.ts` — Authentication API helpers (`loginUser`, `registerUser`, `getCurrentUser`, `getGoogleAuthUrl`), token storage helpers, and automatic `Authorization: Bearer <token>` injection with transparent 401 refresh retry

### Modified
- `backend/app/routers/grievances.py` — Enforced RBAC: `POST /submit-grievance` derives citizen ID from verified JWT (prevents client spoofing); `GET /grievances` auto-scopes citizens to their own submissions; `PATCH /grievances/{id}/status` restricted to `ADMIN`, `SUPERADMIN`, `RESOLVER` roles
- `backend/app/models.py` — Updated `SubmitGrievanceRequest`: `userId` made optional in payload (server extracts identity from verified JWT; body value accepted only in demo/mock mode for backward compatibility)
- `backend/app/main.py` — Mounted auth router, enabled CORS credentials, added idempotent startup seeding for admin account (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`)
- `backend/app/config.py` & `backend/.env.example` — Added JWT secret, token expiry, admin seed, and Google OAuth configuration settings
- `frontend/lib/session.tsx` — Replaced demo-only state with full authentication session (`login()`, `register()`, `signOut()`, auto `/auth/me` on mount) while preserving demo mock mode
- `frontend/app/login/page.tsx` & `frontend/app/register/page.tsx` — Connected forms to real auth backend, added Google OAuth button, updated validation rules (8-char password)
- `tests/test_security_baseline.py` — Inverted security baseline tests to assert secure behavior (401 on unauthenticated status updates, 403 on citizen role status updates, token-derived identity)

---

## 2026-10-02 — Automated Test Suite (85 → 207), Six Divergences Fixed (DEC-016)

### Added — tests (all network-free; `conftest.py` still pins `MONGODB_URI=""`)
- `tests/test_id_allocation.py` — DEC-014 regression: seeds existing ids and
  asserts the next continues from them; year rollover, out-of-order ids,
  unparseable ids, 8/32-way concurrent creates (exercises Mongo's
  `DuplicateKeyError` retry), plus the exact endpoint-level reproduction
- `tests/test_image_validation.py` — `/validate-image` contract (field aliases,
  zod shape), the accept/reject threshold boundary (59.99 / 60.00 / 60.01),
  submit-time rejection not persisting, a raising scorer, and a `BASELINE`
  proving the server fetches any URL it is handed
- `tests/test_classification_cascade.py` — HF → Groq → keyword cascade,
  provider-outage fallback, every `HIGH_PRIORITY_KEYWORDS` phrase resolving to
  `high`, and `modelInfo` not claiming a model that never ran
- `tests/test_config_drift.py` — `config.py` ↔ `backend/.env.example` ↔
  `render.yaml` ↔ `frontend/.env.example`, secret-leak and wildcard-CORS checks
- `tests/test_security_baseline.py` — **asserts today's insecure behaviour on
  purpose** (unauthenticated read/write, body-supplied identity, no rate
  limiting); the measurable "before" Phase 1 must invert
- `tests/test_status_vocabularies.py` — parses the four conflicting status
  vocabularies (backend default, `TIMELINE`, `StatusBadge`, admin filter,
  `mock.ts`) and pins their divergence against DEC-006's 12 uppercase states
- `tests/test_repository.py` — shared-list-contract tests (`limit<=0`, tie-break)
- `frontend/scripts/check-contract.mjs` — **18 offline frontend checks** with a
  stubbed `fetch`: `roleForEmail`/`isAdminEmail` (incl. the `BASELINE`
  escalation), `useMocks()` semantics, and the zod schemas against
  backend-shaped JSON
- `tests/conftest.py` — the parametrised `repo` fixture moved here so every
  module can assert against both repository implementations

### Fixed — found by writing those tests
- **`?limit=0`/negative meant opposite things per backend.** pymongo reads
  `.limit(0)` as *unlimited* and `.limit(-n)` as "take n"; a Python slice reads
  `[:0]` as empty — one URL returned the whole collection on MongoDB and zero
  rows in-memory. `limit` is now `Query(50, ge=1, le=1000)` at the router, and
  both repositories return nothing for `limit<=0`
- **List ordering diverged on ties.** The in-memory fallback sorted by
  `(createdAt, priority weight, id)` while Mongo sorted `[createdAt, id]`, so
  dev and production ordered records differently. Both now `(createdAt, id)` desc
- **`PATCH status=""` was stored verbatim** (`update()` only filtered `None`),
  leaving `Badge` with no match and the timeline pinned to step 0. Blank
  `status`/`assignee` are now `400`; surrounding whitespace is trimmed
- **Unrouted `404`/`405` returned Starlette's `{"detail"}`**, which
  `lib/api.ts` never reads — users saw a bare "Request failed (404)". A
  `StarletteHTTPException` handler in `main.py` maps them to the flat
  `{"error"}` shape the docs already promised
- **`/health` could report `in-memory` while requests went to MongoDB.**
  `_storage_mode` was assigned only after a successful ping, so a cluster down
  at boot left the mode at its initial value. It is now set as soon as
  `MONGODB_URI` is present (DEC-016 §4: configuration, not reachability)
- **`hfEngineSchema` stripped `categoryConfidence`** (and `rawCategoryLabel`,
  `urgentMatches`, `modelInfo`) — z.object() drops undeclared keys without
  failing, so the confidence display worked on mock data but silently vanished
  on live data. `grievanceSchema` also now declares `imageValidation`
- **`render.yaml` pinned `CORS_ORIGINS=http://localhost:3000`**, which would
  have blocked the deployed frontend with no server-side error to explain it;
  now `sync: false` with a comment requiring the real origin
- **`HUGGINGFACE_API_TOKEN`** (an alias `config.py` reads) was absent from
  `backend/.env.example`

### Changed
- `docs/API.md` — `?limit` bounds, `/health` semantics, the flat 404/405 shape,
  `PATCH` blank-status rejection
- `docs/DATABASE.md` — new "Shared list contract" section (ordering + limit
  rules both implementations must honour)
- `docs/DEVELOPMENT.md` — "Running Tests" now lists nine files, documents the
  `test_BASELINE_*` convention and the `check-contract.mjs` script

### Verified
- `pytest` — **207 passed** (with a local `mongod`; Atlas is never touched)
- `node frontend/scripts/check-contract.mjs` — 18 checks pass (offline)
- `node frontend/scripts/e2e.mjs` — PASSED against live `uvicorn` + Atlas
  (`GRV-2026-0010`), after restarting the backend to pick up these changes
- Live probes of every fix against Atlas: `limit=0`/`-5`/`1001` → `400`,
  unknown route → `{"error":"Not Found"}`, `DELETE /health` → `405` flat,
  blank status → `400`, `"  assigned  "` → stored as `assigned`
- `tsc --noEmit` clean; `npm run build` — 7 routes
- Four commits, each verified in isolation (working tree stashed down to the
  staged set before running the suite): `925b89c`, `c1e47eb`, `d2f7151`, `dd867ea`

---

## 2026-10-02 — MongoDB Atlas Cutover, Restart-Safe IDs (DEC-014), Env Audit Fixes (DEC-015)

### Added
- `MONGODB_URI` / `MONGODB_DB` in `backend/.env` (untracked, gitignored) pointing
  at the owner's Atlas cluster — the API now persists to MongoDB instead of the
  in-memory fallback; `/health` reports `storage: "mongodb"`

### Fixed
- **`backend/app/db.py` — grievance ids are now derived from stored data, not a
  per-process counter (DEC-014).** `_new_id()` used `itertools.count(1)`, which
  resets to 1 on every process start, so the first submission after any restart
  requested an existing `GRV-<year>-0001` and failed with `DuplicateKeyError`
  → `POST /submit-grievance 500`. Reproduced against Atlas, then verified fixed:
  after a genuine process recycle the next submit is `GRV-2026-0005`, and
  back-to-back submits after a second restart yield `0006`, `0007` with no
  duplicate ids. `MongoRepository` retries on unique-index collision;
  `InMemoryRepository` seeds from its own stored ids.
- `backend/app/config.py` + `backend/.env.example` — `GROQ_MODEL` default was
  `llama-3.3-70b-versatile`, decommissioned by Groq (404s), which silently
  dropped classification to the keyword fallback while looking configured;
  now `openai/gpt-oss-20b` with a comment recording why (DEC-015)
- `backend/app/services/image.py` — imports `LLAVA_MODEL` instead of hardcoding
  the vision model, so the declared variable is no longer dead (DEC-015)

### Changed
- `backend/.env.example` — documents the repaired `GROQ_MODEL` default and adds
  `LLAVA_MODEL`
- `docs/DATABASE.md` — the `GRV-<year>-<seq>` scheme now documents how `<seq>`
  is allocated and why (restart safety)

### Verified
- **Atlas connectivity** — SRV resolution, TLS, credentials and IP allowlist all
  pass (`ping`, server 8.0.34); `grievance.grievances` created on first boot
  with `uniq_grievance_id` (unique) and `user_created` (`userId` + `createdAt`)
- **Persistence across a real restart** — submit → kill the listening PID →
  fresh process → same document with status/assignee intact
- **Test isolation** — `pytest` leaves Atlas untouched (grievance count 3 → 3
  across the run); `conftest.py` pins `MONGODB_URI=""` so tests can never reach
  the cluster. **85 passed** with a local `mongod`, **68 passed / 17 skipped**
  without one
- **End-to-end** — `frontend/scripts/e2e.mjs` passes against live `uvicorn` +
  Atlas: submit → track → admin assign/resolve → re-read, 9 items / 5 users
- **Cloudinary (open checklist item resolved)** — unsigned preset
  `grievance app` on cloud `dnw1p9dnk` accepted a real upload (HTTP 200);
  `/validate-image` (heuristic fallback, score 18.4 → correctly rejected below
  the threshold of 60), `/delete-cloudinary` and `/sign-cloudinary` all 200
- `tsc --noEmit` clean; `npm run build` renders all 6 routes

### Notes
- `OPEN_ROUTER_API_KEY` was deliberately **not** ported from `main` — image
  validation stays on Groq vision + heuristic (DEC-015).
- 9 automated test records remain in `grievance.grievances` (probes + e2e);
  harmless, wiped on request.

---

## 2026-10-01 — Migration Phases 4, 5, 6: Legacy UI Retired, Docs Aligned, Test Suite Added — committed

### Added
- `tests/` (4 files, 85 tests) — pytest suite: `test_classification.py` (keyword
  category inference, urgency/risk/priority rules, sentiment normalisation, and
  the `CATEGORY_KEYS` ↔ `frontend/lib/types.ts` `CATEGORIES` contract test),
  `test_endpoints.py` (real FastAPI app over `TestClient`: health, submit,
  scoped/limited/newest-first list, get, PATCH, 404s, flat `{"error": …}` shape),
  `test_repository.py` (both `GrievanceRepository` implementations behind one
  parametrised contract, Mongo-specific BSON/index/persistence checks, and
  `_build_repository()` selection)
- `pytest.ini` — `testpaths = tests`, `pythonpath = .` (imports `backend.app`
  without installation)
- `requirements-dev.txt` — `-r requirements.txt` + `pytest`; kept separate
  because Render's `buildCommand` installs the root `requirements.txt`
- `frontend/scripts/e2e.mjs` — end-to-end check that imports the **real**
  `frontend/lib/api.ts` (so responses are zod-parsed by the same schemas the UI
  uses) and drives submit → track → admin assign/resolve → re-read against a
  live backend; needs a running backend, not part of `pytest`
- `render.yaml` — `MONGODB_URI` (sync: false) + `MONGODB_DB` env vars; without
  them a deployment silently runs on the in-memory fallback

### Changed
- `AGENTS.md` — stack table reconciled with reality: Backend row annotated
  `backend/app/` (DEC-010), Database row PostgreSQL → MongoDB (DEC-011),
  Auth row marked *planned* vs. the demo localStorage session (DEC-009), plus a
  dated stack note
- `README.md` — rewritten sections (repository layout, quickstart, port, key
  decisions, follow-ups) to describe FastAPI + MongoDB instead of Flask +
  `server.py`; stale-docs warning removed now that docs are aligned
- `docs/ARCHITECTURE.md` — overview/port/diagram corrected to MongoDB + `:10000`,
  backend tree replaced with the real `backend/app/` layout, Auth section marked
  PLANNED, Database + boundaries sections rewritten for pymongo
- `docs/API.md` — status header rewritten, base URL `:8000` → `:10000`, added an
  "Implemented endpoints" table (incl. the `POST /submit-grievance` naming note),
  `/health` response and the error format corrected to the actual shapes
- `docs/DEVELOPMENT.md` — prerequisites/setup/migrations/commands/conventions/
  troubleshooting rewritten for MongoDB + uvicorn; new "Running Tests" section
- `docs/SECURITY.md` — Authentication marked PLANNED; Known Prototype
  Limitations now leads with the server-side auth gap (API trusts request-body
  `userId`, no authorization on list/PATCH, frontend allowlist is client-side only)
- `INTEGRATION.md` — status banner (Phases 1–4 executed) + loose-ends items
  annotated as resolved; original source map preserved verbatim
- `frontend/lib/tfidf.ts` — comment notes `functions/tfidf.js` was retired

### Removed
- `functions/` (6 files: `tfidf.js`, `admin_api.js`, `admin_ui.js`,
  `admin.html`, `grievance-app.html`, `download.jpg`) — last Firebase-era code
- root `adfbh` — unidentified duplicate admin HTML

### Verified
- `pytest`: **85 passed** with a local `mongod`; **68 passed, 17 skipped**
  without one (Mongo tests skip rather than fail)
- Test DBs cleaned up after runs (only `admin`/`config`/`local` remained);
  `mongod --shutdown` used afterwards
- **End-to-end via the real frontend client** (`node frontend/scripts/e2e.mjs`
  against live `uvicorn` + `mongod`): submit → track-by-id → unknown-id `null`
  → admin global/scoped/empty lists → assign → resolve → re-read persists the
  changes and keeps other fields → submit without `userId` rejects with the
  backend's `{error}` message → second citizen proves the queue is multi-user.
  All responses passed the frontend's zod schemas.
- HTTP-level: all 6 frontend routes (`/`, `/submit`, `/track`, `/admin`,
  `/login`, `/register`) return 200 with the dev server on `:3000`.
  *No desktop browser was connected to this session, so the DOM was not driven —
  `frontend/scripts/e2e.mjs` covers the same contract minus rendering.*
- End-to-end against live `uvicorn` on `:10000` with `MONGODB_URI` set:
  health `storage: mongodb`, submit ×2, list (all + `?userId=` scoped), get,
  PATCH status+assignee, 404s, `400 {"error": "description: Field required; …"}`,
  **data survives a process restart** (including the PATCH), and the same server
  with no `MONGODB_URI` reports `storage: in-memory` and an empty list
- `tsc --noEmit` clean; `npm run build` passes (9 routes)
- `rg -i "firestore|firebase"` over source + docs: only past-tense historical
  comments remain (`tools/recategorize.py`, `frontend/lib/{roles,grievances}.ts`,
  `INTEGRATION.md`, plus the key-rotation notices in `README.md`/`SECURITY.md`);
  no `firebase`/`firestore` dependency in `frontend/package.json`, no
  `firebase*`/`firestore*` files outside `venv/`
- Hygiene: 0 tracked `__pycache__` (incl. the new `tests/__pycache__`),
  `venv/` gitignored and untracked

### Repository State at End of This Entry
- 6 new commits `09e83af..98ec1f3` on `feature/unified-system` (+ memory commit);
  `UNIFIED_MIGRATION_PLAN.md` / `UNIFIED_MIGRATION_CHECKLIST.md` marked Phases
  4–6 complete (only the key rotation, Cloudinary preset and an unrelated
  `main`-branch file question remain unticked)
- **Migration plan Phases 1–6 complete**; DEC-002 marked SUPERSEDED BY DEC-011;
  DEC-011's Phase 4/5 follow-ups closed; new DEC-012 (test strategy) and
  DEC-013 (docs annotated rather than rewritten)
- Still open: owner's MongoDB Atlas setup (`MONGODB_URI`), Firebase Web API key
  rotation (in git history), real auth, unpushed local commits

---


### Added
- `MongoRepository` in `backend/app/db.py` — pymongo implementation of the existing `GrievanceRepository` protocol; selected when `MONGODB_URI` is set, in-memory fallback otherwise; indexes at startup (unique `id`, compound `userId + createdAt`); `createdAt` stored as BSON date
- `/health` now reports `storage: mongodb | in-memory` (`backend/app/routers/health.py`)
- `backend/.env.example` — `MONGODB_URI`/`MONGODB_DB`, LLM keys, Cloudinary, server config

### Changed
- `tools/recategorize.py` — rewritten for MongoDB; imports the shared classifier from `backend/app/services/classification.py` (no longer `backend.server`); adds `--dry-run`
- `requirements.txt` / `backend/requirements.txt` — `+pymongo`, `+dnspython`; `-firebase-admin`, `-Flask`, `-gunicorn`, Google client stack; pins refreshed (`backend/requirements.txt` is now ASCII, fixing the old UTF-16 issue)
- `docs/DATABASE.md` — rewritten for MongoDB (22 Postgres entities moved to a roadmap section)
- `frontend/lib/types.ts` — stale `CATEGORY_KEYS` comment repointed from deleted `server.py` to `services/classification.py`

### Removed
- `backend/server.py` (legacy Flask + Firestore server — logic already ported to `backend/app/`)
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`

### Verified
- Local throwaway `mongod`: `storage: mongodb`, create → scoped list → get → PATCH, BSON `createdAt`, both indexes present, data survives process restart
- In-memory fallback (`MONGODB_URI=""`): same smoke test passes, `storage: in-memory`
- `tools/recategorize.py --help` runs without `server.py`; `pip install --dry-run -r backend/requirements.txt` resolves; `tsc --noEmit` clean
- Hygiene re-verified: `.gitignore` is UTF-8 text, 0 tracked `__pycache__` files

### Repository State at End of This Entry
- 4 new commits `c44d410..aae4b74` on `feature/unified-system` (+ memory commit)
- DEC-011 recorded; DEC-008 item 4 superseded — **no Firebase/Firestore code in the serving path or root config**; remaining Firebase: `functions/` + root `adfbh` (Phase 4) and the key in git history (rotation required)
- Blocker: owner must create the Atlas cluster + set `MONGODB_URI` in `backend/.env`

---

## 2026-09-11 — Phase 2: FastAPI Rewrite — committed

### Added
- `backend/app/` — FastAPI service (13 files): `main.py` (app + CORS + `400 {"error": …}` validation handler matching the legacy contract), `config.py` (python-dotenv, no pydantic-settings), `models.py`, `db.py` (`GrievanceRepository` protocol + in-process implementation — Phase 3 swaps in MongoDB with no router changes), `routers/{grievances,images,health}.py`, `services/{classification,image,cloudinary}.py` (classifier/keyword/risk + image logic ported verbatim from `backend/server.py`, HF → Groq → keyword cascade, `CATEGORY_KEYS` byte-identical to the frontend's `CATEGORIES`)

### Changed
- `render.yaml` — start command `gunicorn … backend.server:app` → `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`; `FIREBASE_SERVICE_ACCOUNT` removed; `CORS_ORIGINS` + Cloudinary env vars added
- `requirements.txt`, `backend/requirements.txt` — `fastapi`, `uvicorn`, `starlette`, `pydantic`/`annotated-doc` added
- `frontend/lib/api.ts` + `frontend/lib/types.ts` — optional grievance fields (`userId`, `imageUrl`, `latitude`, `longitude`, `hfEngine`, `assignee`) changed to `null`-tolerant (`nullish` / `| null`) so FastAPI's explicit-null responses parse

### Verified
- In-process `TestClient` smoke test: `health` 200, `POST /submit-grievance` 200 (AI refinement gracefully skipped without keys), `GET /grievances` 200 + `?userId=` scoping, `GET /grievances/{id}` 200, `PATCH /grievances/{id}/status` 200 (status + assignee), unknown id 404.
- `tsc --noEmit` clean; `npm run build` passes (9 routes).
- `__pycache__`/`.pyc` deliberately **not** staged (existing hygiene debt not extended).

### Repository State at End of This Entry
- 4 new commits `e55a9a3..d1c9c6d` on `feature/unified-system` (+ memory commit)
- **DEC-008 partially superseded** (see DEC-010): FastAPI `backend/app/` is now the serving path (per `UNIFIED_MIGRATION_PLAN`); `backend/server.py` (Flask + Firestore) remains as legacy reference; frontend live mode works against the new backend
- Next: Phase 3 (MongoDB persistence) — `db.py` protocol swap

---

## 2026-09-11 — Frontend de-Firebase (Phase 1) + Legacy Parity (Phase 1.5) — committed

### Added
- `frontend/lib/roles.ts` — admin allowlist + `roleForEmail` (extracted from the deleted `lib/firebase.ts`; single source of admin detection until real auth lands)
- `frontend/lib/tfidf.ts` — TypeScript port of `functions/tfidf.js` (client-side TF-IDF + greedy clustering)
- `frontend/components/admin/AdminMap.tsx` — Leaflet map with markers/image popups for the filtered set
- `frontend/components/admin/AdminClusters.tsx` — cluster panel; "View" filters the queue
- `frontend/components/grievance/MyGrievances.tsx` — citizen's own submissions on `/submit`
- `frontend/lib/api.ts` — `listGrievances`, `getGrievance`, `updateGrievanceStatus` + grievance zod schemas (plus a shared `requestJson` helper)

### Changed
- `frontend/lib/session.tsx` — demo-only localStorage provider; `liveMode` (from `NEXT_PUBLIC_USE_MOCKS`) replaces the Firebase session; `signInDemo(email, role?, name?)`, synchronous `signOut`
- `frontend/lib/grievances.ts` — REST polling (15s default) replaces Firestore `onSnapshot`; admins → all, citizens → own
- `frontend/components/admin/AdminBoard.tsx` — priority/category/status filters, free-text search, pagination (5/10/20/50), Leaflet map, TF-IDF clusters, legacy stat cards (total / high-open / medium-open / resolved), per-row urgent badge + created + userId, live `PATCH /grievances/{id}/status` for assign/resolve with local overrides in mock mode
- `frontend/app/login/page.tsx`, `register/page.tsx` — Firebase sign-in/sign-up removed; demo sign-in with role resolution
- `frontend/app/track/page.tsx` — `liveMode` instead of `user.live`
- `frontend/.env.example` — Firebase/NextAuth vars stripped; `NEXT_PUBLIC_SHOW_DEV_CREDS` added
- `frontend/package.json` / `package-lock.json` — `-firebase`, `-next-auth`, `+leaflet`, `+@types/leaflet` (lock regenerated via clean reinstall)
- `frontend/components/grievance/ImageUpload.tsx` — unused `Button` import removed

### Removed
- `frontend/lib/firebase.ts` (Firestore + Firebase Auth client)

### Verified
- `tsc --noEmit` clean; `npm run build` passes (9 routes) on the final tree.

### Repository State at End of This Entry
- 7 new commits `1857ee3..0b438b8` on `feature/unified-system` (memory update committed after)
- Frontend is Firebase-free; live mode now expects `GET /grievances`, `GET /grievances/{id}`, `PATCH /grievances/{id}/status` — **these do not exist in `backend/server.py` yet** (Phase 2 FastAPI rewrite pending), so live reads/writes 404 until then (UI surfaces the error banner)

---

## 2026-09-11 — Frontend White Theme & Sleek UI Modernization

### Changed
- `frontend/app/globals.css` — Removed dark mode system overrides, set default pure white background `#ffffff` with slate/ink typography tokens and modern blue primary palette.
- `frontend/app/layout.tsx` — Enforced pure white background (`bg-white`), modern selection highlights, and consistent container styling.
- `frontend/components/ui/Card.tsx` — Upgraded Card styling to sleek rounded-xl, subtle borders (`border-ink-200/80`), soft shadows, and refined padding.
- `frontend/components/ui/Button.tsx` — Upgraded button variants with rounded-lg corners, micro-interactions, subtle shadows, and crisp focus rings.
- `frontend/components/ui/Field.tsx` — Modernized inputs, textareas, selects, and field labels with crisp borders and focus rings.
- `frontend/components/ui/Badge.tsx` — Updated status and priority badges with clean semantic pastel tone borders and backgrounds (emerald, amber, rose, blue, slate).
- `frontend/components/ui/SiteHeader.tsx` & `SiteFooter.tsx` — Streamlined header and footer with sleek typography, backdrop blur, and pure white styling.
- `frontend/components/ui/Feedback.tsx` — Redesigned Alert, Spinner, and EmptyState components with modern borders and icons.
- `frontend/app/page.tsx`, `components/grievance/GrievanceCard.tsx`, `LocationCapture.tsx`, `ImageUpload.tsx` — Removed all blinking/pulsing status dots and live indicator dots globally for a clean, distraction-free aesthetic.
- `frontend/app/page.tsx`, `submit/page.tsx`, `track/page.tsx`, `admin/page.tsx`, `login/page.tsx`, `register/page.tsx` — Complete UI polish for seamless white background presentation across all views.
- Verified: `npm run build` succeeds cleanly with zero errors.

---

## 2026-09-11 — Unification Commit + Root README (`feature/unified-system`)

### Added
- Root `README.md` — unified-repo layout, backend/frontend quickstart, branch
  strategy, stale-docs warnings, follow-ups (written fresh; `Idea Lab` README
  deliberately not reused)

### Changed
- Deleted local branch `app/intialise` (was `2d8dfa5`, never on origin) — `main` untouched
- Committed unification baseline as `e0d363f` (42 additive-only files) and pushed
  `origin/feature/unified-system`; verified `npm run build` passes and
  `backend/` diff vs `main` is empty
- `memory/TODO.md` — root README follow-up marked done
- `memory/PROJECT_STATE.md` — unification marked committed/pushed; `app/intialise` refs removed
- `memory/SESSION_LOG.md` — this session entry appended

### Repository State at End of This Entry
- `main` pristine at `2d8dfa5`; `app/intialise` deleted; `feature/unified-system`
  at `e0d363f` (tracked upstream)
- Unification complete; real frontend work deferred to a new branch

---

## 2026-09-11 — Repo Unification (`feature/unified-system`)

### Added
- `frontend/` — Next.js 16 + TypeScript + Tailwind v4 scaffold (copied from `Idea Lab`; not yet wired to Flask backend)
- `docs/` — full technical documentation set (copied from `Idea Lab`; DATABASE/API docs are reference-only per DEC-008)
- `memory/` — agent persistent memory (copied from `Idea Lab`, then updated: DEC-008, PROJECT_STATE ground truth, TODO annotations)
- `PRD.md`, `AGENTS.md` — scope source of truth + agent operating rules (copied from `Idea Lab`; AGENTS.md stack table stale per DEC-008)
- `INTEGRATION.md` — unification source map, `backend/` collision record, follow-up backlog

### Changed
- `memory/DECISIONS.md` — DEC-008 accepted (Flask authoritative, FastAPI discarded, Firestore temporary)
- `memory/PROJECT_STATE.md` — rewritten to Flask/Firestore ground truth; FastAPI-era claims superseded
- `memory/TODO.md` — FastAPI/Postgres-conflicting tasks marked SUPERSEDED
- `memory/SESSION_LOG.md` — unification session entry appended

### Deliberately Excluded
- `Idea Lab` `backend/` (FastAPI scaffold, Alembic, tests) — discarded per owner decision
- `Idea Lab` root `README.md` — describes discarded stack; new root README is a follow-up

### Repository State at End of This Entry
- Branch `feature/unified-system` (off `app/intialise`); `app/intialise` + `main` untouched
- Additive-only merge: no existing `Idea Lab2` file modified or deleted
- Firestore still the working database; Firebase removal deferred to follow-up branch

---

## 2026-08-06 — Project Initialization

### Added
- `README.md` — Project overview, lifecycle, actors, stack, setup instructions, repository map
- `PRD.md` — Full Product Requirements Document with traceable requirement IDs
- `AGENTS.md` — Mandatory AI agent operating rules and memory protocol
- `docs/PROJECT_CONTEXT.md` — Academic background, research context, problem statement
- `docs/ARCHITECTURE.md` — Proposed system architecture (monorepo, frontend/backend/DB/AI boundaries)
- `docs/DATABASE.md` — Proposed domain model and database design
- `docs/AI_SYSTEM.md` — AI module specifications (AI-01 through AI-11)
- `docs/WORKFLOWS.md` — Grievance lifecycle workflows and state transitions
- `docs/API.md` — Planned API endpoint documentation
- `docs/SECURITY.md` — Security design (auth, RBAC, input validation, secrets)
- `docs/DEVELOPMENT.md` — Local development setup guide
- `memory/README.md` — Memory system explanation and agent instructions
- `memory/PROJECT_STATE.md` — Initial project state (documentation phase)
- `memory/DECISIONS.md` — Initial architecture decisions (DEC-001 through DEC-007)
- `memory/CHANGELOG.md` — This file
- `memory/TODO.md` — Initial task backlog
- `memory/SESSION_LOG.md` — Initial session log entry

### Repository State at End of This Entry
- No application code exists
- Documentation foundation established
- Architecture proposed but not implemented
- All features: PLANNED

## 2026-10-08 — Staff Navbar Navigation

### Changed
- Removed Home and Track Status buttons from the privileged-role navbar.
- Kept the left-side menu trigger as the entry point to role-specific navigation.
- Citizen and signed-out public navigation remains unchanged.

## 2026-10-08 — Authenticated Navbar Sign Out

### Changed
- Added a right-aligned Sign out button for authenticated staff users.
- Existing authenticated citizen sign out behavior remains available.

### Verification
- Frontend TypeScript check and ESLint pass.

## 2026-10-08 — Test Account Login Fix

### Fixed
- Enabled the local-only `SEED_TEST_ACCOUNTS=true` setting so the department
  manager and employee accounts shown on the login page are created at backend
  startup.
- This resolves the mismatch where frontend demo credentials were visible while
  their backend users had not been seeded.

### Required Follow-up
- Restart the backend once so its startup hook creates the accounts.

## 2026-10-08 — Complaint Form Alignment

### Changed
- Centered the complaint form within a responsive max-width content column.
- Constrained the page heading to the same centered content rhythm.
- Unified the incident-location field with the shared `Field` component and
  standard control height used by the other form fields.
- Tightened the desktop relationship between the form and the grievance-history
  panel while preserving centered mobile layout.
- Centered the complete form/history module as one bounded desktop layout.

## 2026-10-08 — Guest Home Navigation

### Changed
- Removed Track Status from the navbar for signed-out visitors.
- Kept Track Status available to authenticated citizens.
- Simplified the signed-out home page into a basic dashboard with the public
  overview, statistics, department categories, and registration CTA.

## 2026-10-08 — Spatial Analytics Section

### Added
- Separated the complaint map into a dedicated Spatial Analysis section.
- Added coordinate-based area clustering for geographic hotspot analysis.
- Added hotspot cards showing location, volume, high-priority count, and open count.

## 2026-10-08 — Department Review Assignment Workflow

### Changed
- New grievances now persist their classified department and enter
  `PENDING_ASSIGNMENT` automatically.
- Admin review now assigns or confirms only the department; officer selection
  was removed from the admin modal.
- Employee assignment remains available to the department manager workflow.
- Corrected department identifiers so assignment uses canonical department keys.

## 2026-10-08 — Track View Switcher Alignment

### Changed
- Centered the “My grievances” / “Search by ID” tab switcher within the Track
  Status page.

## 2026-10-08 — Public Homepage Redesign

### Changed
- Replaced the public homepage with a clear civic-service landing experience.
- Removed fabricated live statistics and random-looking content.
- Added focused registration/tracking CTAs, service principles, request journey,
  department guidance, and an accountability section.
- Preserved the separate role-aware staff operational dashboard.

## 2026-10-08 — Sign-in and Footer Accuracy

### Changed
- Redesigned the sign-in page with the light visual language used by the new
  homepage.
- Removed national-platform claims, government-style contact details, toll-free
  numbers, and unsupported certification claims from the footer.
- Replaced them with accurate prototype and local civic-workflow messaging.

## 2026-10-08 — Citizen Multilingual UI

### Added
- Added persisted language selection for citizen-facing layouts.
- Added English plus Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada,
  Malayalam, Punjabi, and Odia translations for shared navigation and core
  authentication, tracking, and complaint-form labels.

## 2026-10-08 — Corrected Non-Normal Navigation Scope

### Changed
- Restored Track Status and the full home experience for signed-out visitors
  and normal citizen users.
- Removed Track Status from staff sidebar navigation only.
- Kept the simplified basic dashboard behavior for admin, resolver, and
  superadmin home views.

## 2026-10-08 — Staff Home Overview

### Changed
- Replaced the staff home view with a dedicated operational overview.
- Added role-specific workspace links and summary metrics without reusing the
  citizen-facing homepage layout.
- Scoped staff metrics to the viewer: department admins see their department,
  resolvers see assigned complaints, and superadmins see global totals.

## 2026-10-08 — Staff Sidebar Home Routing

### Fixed
- Staff sidebar Home now routes to the role-specific operational workspace:
  admin, resolver, or superadmin.
- Staff users can no longer reach the citizen homepage through the sidebar Home
  link.

## 2026-10-08 — Staff Sidebar React Key Fix

### Fixed
- Made sidebar link keys unique by combining each link label and destination,
  preventing duplicate-key warnings when multiple staff links share a route.
## 2026-10-08 — Worker workflow foundation

- Added the `ACCEPTED` state and owner-only assignment acknowledgement.
- Expanded resolver workspace into a worker dashboard with workload metrics,
  progress percentage, task details, location/evidence, hold reasons, daily
  updates, structured escalation, completion submission, and activity history.
- Extended escalation and completion API payloads while preserving manager
  review as the final resolution authority.

## 2026-10-08 — Legacy department backfill command

- Added `tools/backfill_departments.py` to populate missing `departmentId`
  values from existing grievance categories without changing workflow state or
  employee ownership.

## 2026-10-08 — Department manager scoping

- Department managers now see only their own department in the grievance queue
  and analytics, including demo-mode fallback data.
- Removed redundant department portal filters from the manager view; the
  cross-department selector remains available to superadmins.

## 2026-10-08 — Automatic legacy department routing repair

- Added a startup backfill for grievances missing `departmentId`, using their
  existing classified category and preserving state/worker ownership.
- Added an API compatibility fallback so legacy records are immediately
  exposed with their category as department even before backend restart.

## 2026-10-08 — Department reassignment after initial assignment

- Admin department review can now change the department of active grievances,
  including assigned, accepted, in-progress, blocked, and escalated records.
- Reassignment preserves the current workflow state and employee owner; only
  the department routing and manager audit record change.

## 2026-10-09 — Dedicated department employee workspace

- Moved employee account creation/removal and team workload management into
  `/admin/employees`; per-grievance assignment is also available in its review dialog.
- Scoped employee discovery to the authenticated manager's department,
  including legacy Roads & Transport account records.
- Prevented employee deletion while active grievances remain assigned; added
  matching API documentation and workflow notes.

## 2026-10-09 — Assign employees from grievance review

- Department managers now see an employee selector in the grievance review
  dialog instead of department routing controls.
- Assigning a pending grievance to a worker now transitions it to `ASSIGNED`,
  sets its initial SLA due date, and records state history.

## 2026-10-09 — Split employee accounts and task assignment tabs

- Added separate Employee Accounts and Assign Tasks tabs in the department
  manager Employees dashboard.
## 2026-10-09 — In-app notification center and action feedback

- Added a notification inbox with account-scoped read/unread state, unread nav
  badges, periodic refresh, and toast popups for newly arriving notifications.
- Added immediate toast feedback for grievance submission, assignment,
  reassignment/status changes, employee creation/deletion, and worker actions.
- Notify citizens when their grievance is registered/routed/updated/resolved;
  notify employees on assignment/reassignment and managers on key workflow
  events. Mongo notification results now expose their IDs for read operations.
- Documented notification response fields and workflow behavior. Email/push
  delivery and browser-level validation remain deferred.

## 2026-10-09 — Resolver assignment visibility and deep links

- Fixed `GET /grievances` for resolver accounts: an omitted department filter
  was passed through `canonical_department(None)` and defaulted to `other`,
  hiding owned grievances in all other departments. Owner scoping remains
  enforced server-side.
- Assignment notifications now open `/resolver` with the grievance selected;
  the workbench refreshes every 30 seconds so newly assigned tasks appear
  without reauthentication.
- Added regression coverage for an assigned Roads grievance appearing in a
  resolver's unfiltered queue. Frontend lint/typecheck pass; focused pytest did
  not return output in this environment and remains to be confirmed.

## 2026-10-09 — Employee dashboard task loading

- Added a shared resolver task loader used by both the employee overview cards
  and the resolver workbench. It combines the authenticated task queue with
  assignment-notification IDs and uses owner-protected grievance lookup to
  recover missing list rows.
- Added visible loading and error states, periodic refresh, notification deep
  links, and explicit task-row affordances so workers can open details and use
  the existing Accept/Start work actions.
- `npm run lint` and `npx tsc --noEmit` pass (one existing `<img>` warning).
  `next build` was blocked by the sandbox (`Operation not permitted` while
  Turbopack tried to spawn/bind a worker process).

## 2026-10-13 — Stage 4B voice-assisted complaint backend (DEC-032)

- Created transcription router, audio/body guards, strict PCM WAV validator,
  direct httpx Sarvam service and lock-protected process-local quota/idempotency
  module. No retries, database writes, frontend or grievance/auth behavior changes.
- Added off-by-default settings and examples/Render secret declaration; reconciled
  root runtime dependencies with existing backend auth/SMS requirements.
- Created docs/VOICE_ASSISTED_COMPLAINT.md and targeted API/architecture/security/
  workflow/AI/development notes. Updated project state, DEC-032 and TODO section 14.
- Protected pre-existing SESSION_LOG.md exactly: SHA256
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB.
  Owner explicitly prohibited editing/staging/committing it; this entry is the
  session handoff instead. Stayed on feature/aarohi; no git mutations.
- Created ignored workspace .venv using Python 3.13. Installed requirements-dev.txt
  with pip; sandboxed installs stalled and were stopped, then the approved command
  succeeded: .\.venv\Scripts\python.exe -m pip --isolated install --index-url
  https://pypi.org/simple --timeout 15 --retries 0 -r requirements-dev.txt.
- Initial feature run: 73 passed, 4 setup/teardown errors from enormous pytest
  byte-fixture IDs exceeding Windows environment limits. Corrected compact IDs;
  rerun of feature/audio/limits/config-drift: 75 passed. Added concurrency,
  cancellation, OpenAPI, no-grievance-write and deep-JSON regression checks.
- Final command: .\.venv\Scripts\python.exe -m pytest tests/test_transcription.py
  tests/test_audio_validation.py tests/test_transcription_limits.py
  tests/test_config_drift.py tests/test_classification_cascade.py -q --tb=short
  => 98 passed, 1 Starlette TestClient httpx deprecation warning (27.56 s).
- Regression command: .\.venv\Scripts\python.exe -m pytest tests/test_endpoints.py
  tests/test_security_baseline.py -q --tb=short => 44 passed, 9 failed (35.26 s).
  All nine failed endpoint names match the existing TODO section 11 baseline
  (stale SUBMITTED/status adapter expectations versus PENDING_ASSIGNMENT);
  no affected submission/auth/classifier/test source was changed.
  An earlier regression command named nonexistent tests/test_cascade.py and
  collected no tests; corrected to tests/test_classification_cascade.py above.
- pip check: no broken requirements. git diff --check: passed.
- No real backend/.env display/edit; no live Sarvam calls/credits, provider account
  changes, production enablement, install of Sarvam SDK or compressed audio decoder.
- Backend TESTED with mocks; speech recognition remains EXPERIMENTAL/unvalidated.
  Next: frontend genuine WAV recording/resampling and review/replacement flow,
  followed only by separately authorized live provider/retention/billing checks.

## 2026-10-13 — Stage 5 voice-assisted complaint frontend (DEC-033)

- Created VoiceRecorder.tsx, lib/voice/{audio,capture}.ts, public/voice-processor.js
  and lib/i18n/voice.ts. Explicit permission/start, manual/30-second stop, playback,
  re-record/discard, explicit Transcribe, accessible status/error controls and
  original-language text insertion. Genuine bounded mono PCM WAV via 32-tap
  low-pass resampling; no recording/upload starts automatically.
- SubmitForm integrates immediately below description; confirms before paid upload
  and again after in-flight edits. Failure/cancel preserve text. Existing validation,
  submission payload and endpoint unchanged; submit/reset cancels pending voice.
- Extended typed multipart API with Zod, existing access-token/refresh path and
  same-key retry only after 401. 70-second deadline, cancel support, HTTP status
  for localized feedback. JSON Content-Type and existing grievance contracts remain.
- Updated en/hi/mr copy and eight hidden locale English fallbacks without removing
  packs or changing picker scope. Added dev-only jsdom and npm test:voice script,
  reusing Node/TypeScript (no new app/test framework). No existing locked package
  versions changed; lockfile adds jsdom/transitive dependencies and metadata.
- Dedicated feature doc plus targeted DEVELOPMENT/WORKFLOWS/AI_SYSTEM updates;
  PROJECT_STATE, DEC-033 and TODO handoff. Stage 4B backend files preserved.
- Frontend npm installs initially failed (UNABLE_TO_VERIFY_LEAF_SIGNATURE surfaced
  as Exit handler never called). Approved retry using Node --use-system-ca,
  registry.npmjs.org and ignored workspace .npm cache succeeded with TLS validation
  enabled. Read installed Next.js Client Components/public-folder guides.
- Mock tests: npm.cmd run test:voice initially 43 passed; final expanded command
  node --test --test-reporter=spec scripts/voice-audio.test.mjs
  scripts/voice-api.test.mjs scripts/voice-ui.test.mjs => 48 passed, 0 failed (3.05 s).
  Includes actual Python Stage 4B validation of generated 30-second WAV, concurrent
  description edits, resource cleanup, refresh cancellation and form reset behavior.
  Node emits an experimental MockTimers warning; no live network transcription.
- node scripts/check-contract.mjs => all 21 existing checks passed.
- node node_modules/typescript/bin/tsc --noEmit => passed.
- npm.cmd run build => passed; Next.js 16.3.0, 18 static outputs.
- Targeted eslint over changed components, API/types, voice/i18n, new test files and
  public worklet => passed. Full npm.cmd run lint => 4 errors in unchanged
  FaceCapture.tsx (3 synchronous-effect state errors, 1 conditional hook), 4 warnings
  (2 FaceCapture unused constants, 2 ResolverWorkspace img warnings).
  One initial new test-loader module-variable lint error was fixed before final run.
- git diff --check passed. Still feature/aarohi; nothing staged/committed/pushed.
  SESSION_LOG.md SHA256 preserved exactly:
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB.
- No actual backend/.env or secret values displayed/edited, no Sarvam calls/credits,
  backend flag/configuration changes, frontend credential exposure or schema changes.
- Remaining: real browser/microphone/playback/accessibility checks, native hi/mr copy
  review and separately authorized live provider/retention/billing verification.

## 2026-10-13 — Source ZIP and local readiness handoff

- Confirmed origin is https://github.com/aryacodecraft/grievance-redressal-system.
  Read-only git ls-remote --heads origin refs/heads/feature/aarohi completed with
  no matching remote branch. Local feature/aarohi has no upstream; no push done.
- Created artifacts/grievai-feature-aarohi-source-2026-10-13.zip from tracked and
  non-ignored untracked source, retaining current unfinished Stage 4B/5 changes.
  Includes frontend/backend/tests/docs/memory and setup manifests/demo assets.
  Excludes .git, node_modules, venvs, build/cache folders, actual .env files,
  credential/private-key files, logs, recordings and archives. Blank .env.example
  templates retained. Checked ZIP integrity/member exclusions and scanned selected
  files for common private-key/API-token patterns without displaying matches.
- Verified real frontend production server /submit and backend /health both return
  HTTP 200. Backend ran with dotenv loading disabled, in-memory Mongo fallback,
  fresh ephemeral JWT secret, external providers/transcription/face auth disabled
  and no administrator/test seeding. Did not open/display real backend/.env.
  Both temporary local servers were terminated after checks; actual configured
  MongoDB connectivity and live-provider readiness were not tested.
- Used ignored .venv/source_handoff.py helper; no application source changes.
  Rebuilt final ZIP after this note. SESSION_LOG.md SHA256 remains unchanged:
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB.
- Branch remains feature/aarohi. No staging/commit/push/stash/branch changes;
  current working-tree changes preserved. Source archive is a local download,
  not a GitHub upload or publication.

## 2026-10-13 — Submit-page loading recovery

- localhost:3000/submit initially refused the connection; frontend was stopped.
- Started npm.cmd run dev -- --hostname 127.0.0.1 in frontend/ and verified
  http://127.0.0.1:3000/submit returns HTTP 200. Development server left running
  for the owner. Backend was not started or reconfigured; no live STT calls.
- No application code changes. SESSION_LOG.md remains byte-for-byte preserved;
  branch remains feature/aarohi. If the reported failure instead refers to
  Transcribe, backend readiness/configuration still needs separate diagnosis.

## 2026-10-13 — Voice playback StrictMode ref cleanup fix

- Traced worklet sample/complete ordering, stop promise, sample retention until
  WAV creation, Blob URL ownership and audio ref/effect cleanup. Capture and WAV
  encoding were valid: regression verifies 4800 source frames -> 1600 nonzero
  16 kHz PCM frames, before failing specifically because player src became null.
- Root cause: React StrictMode replays audio ref detach/attach on mount. The ref
  cleanup removed src and called load(), resetting metadata; reattachment did not
  restore the unchanged React-owned src prop. No premature URL revocation was needed
  to reproduce the bug. Previous tests omitted StrictMode and missed this behavior.
- Minimal fix in VoiceRecorder.tsx: keep pause on ref detach, remove destructive
  removeAttribute(src)/load calls. Actual discard/unmount still revoke the URL.
  No capture/audio/worklet/backend/API/credential changes.
- Added regression to voice-ui.test.mjs: StrictMode, actual captured WAV bytes,
  no transcription, preserved src across unrelated renders, proper discard cleanup.
  Before fix: failed (src null). After: passed.
- node --test --test-reporter=spec scripts/voice-audio.test.mjs
  scripts/voice-api.test.mjs scripts/voice-ui.test.mjs => 49 passed, 0 failed.
- node node_modules/typescript/bin/tsc --noEmit => passed.
- node node_modules/eslint/bin/eslint.js components/grievance/VoiceRecorder.tsx
  scripts/voice-ui.test.mjs => passed. Existing MockTimers warnings only.
- Isolated headless Chrome check with generated synthetic WAV: 64044 bytes,
  decoded 32000 frames, mono 16000 Hz, nonzero samples, audio.duration=2 seconds,
  readyState=4, playbackStarted=true. Browser network/background activity disabled,
  sound muted; no actual microphone, backend, Sarvam or account credentials used.
  First virtual-time-only harness ended pending; real-time CDP polling completed.
  Verification helpers live only in ignored .venv, not project source/export.
- Updated feature doc/state/TODO; manual real Chrome microphone pass remains:
  refresh /submit, record 3–5 seconds, finite duration, Play, re-record/discard,
  automatic 30-second stop, no Transcribe request, microphone indicator stops.
- Branch feature/aarohi; preserved existing work and SESSION_LOG.md SHA256
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB.
  No commits/push/branch switch/backend enablement/live API calls.

## 2026-10-13 — Stage 5 mocked description replacement validation

- Owner reports real Chrome recording/playback/re-record/discard/automatic 30-second
  stop tests passed. Recorded that as owner-reported browser validation, without
  claiming a new agent-run microphone test or evaluated recognition accuracy.
- Inspected SubmitForm/VoiceRecorder/API, backend router/guard/service and existing
  transcription tests. Nonempty text confirms before API call. Cancel retains text
  with zero calls. Backend disabled flag returns 503; frontend localized unavailable
  message is expected. It does not block pre-upload confirmation/cancellation, but
  successful insertion/post-response confirmation must use mocks while disabled.
- Existing tests already covered cancellation/confirmed replacement, English
  empty insertion, hi/mr Unicode and later edits. Focused additions to
  frontend/scripts/voice-ui.test.mjs fill gaps: hi/mr empty insertion with no prompt,
  network/504 preservation and initially empty -> typed during pending request,
  both accept/cancel outcomes. Strengthened English no-prompt and 503 prompt-order
  assertions. No application/backend/configuration/credential code changes.
- In frontend/: node --test --test-reporter=spec scripts/voice-audio.test.mjs
  scripts/voice-api.test.mjs scripts/voice-ui.test.mjs => 55 passed, 0 failed (2.93 s).
- node node_modules/typescript/bin/tsc --noEmit => passed.
- node node_modules/eslint/bin/eslint.js scripts/voice-ui.test.mjs
  components/grievance/SubmitForm.tsx components/grievance/VoiceRecorder.tsx
  lib/api.ts => passed. Only Node experimental MockTimers warnings in tests.
- Targeted feature docs/state/TODO updated. Branch feature/aarohi, no staging,
  commits, pushes, branch switch, provider calls or live Sarvam enablement.
  SESSION_LOG.md remains untouched with SHA256
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB.

## 2026-10-13 — Stage 6 mocked cross-stack voice integration

- Added tests/test_voice_e2e.py and opt-in cases in frontend/scripts/voice-ui.test.mjs.
  Temporary loopback Uvicorn connects actual worklet/capture/WAV, frontend API and
  React form, JWT authentication, backend validation and mock-only Sarvam transport.
  Ten scenarios pass: en/hi/mr insertion, cancellation zero HTTP/provider calls,
  confirmed replacement, disabled/provider failure/timeout/malformed response,
  and authentication/multipart/audio rejection. No application defect found.
- Provider assertions inspect outgoing multipart/model/language and nonempty
  mono 16-bit/16 kHz WAV (1600 frames). Repository create is a failure tripwire;
  repository stays empty. Upload close/temp-spool cleanup assertions pass.
  External HTTP/socket connections are forbidden. Configuration and synthetic
  credential overrides are confined to tests, never deployment or actual secrets.
- Relevant pytest command: .venv\Scripts\python.exe -m pytest
  tests/test_voice_e2e.py tests/test_transcription.py tests/test_audio_validation.py
  tests/test_transcription_limits.py tests/test_config_drift.py -q --tb=short
  => 80 passed, 1 existing Starlette/httpx warning (25.56 s).
- Frontend node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 55 passed, 0 failed/skipped (4.09 s); existing
  experimental MockTimers warnings. TypeScript --noEmit => passed.
- Targeted ESLint of SubmitForm/VoiceRecorder/api, voice capture/audio/worklet and
  four voice test scripts => passed. Initial harness needed to await real HTTP
  rather than synchronous mocks, ASCII-safe Windows output and removal of a this
  alias. After that final test-only lint edit, cross-stack pytest rerun => 1 passed
  (all ten Node scenarios), 1 existing warning (5.86 s); targeted lint => passed.
- Updated VOICE_ASSISTED_COMPLAINT, PROJECT_STATE and TODO. Browser CORS/HTTPS,
  other devices/accessibility and live recognition remain unvalidated. Existing
  owner-reported Chrome control tests are distinct from this synthetic/jsdom test.
- Stayed on feature/aarohi; no commits, pushes, branch switches, credential edits,
  live feature enablement or external calls. SESSION_LOG.md remains untouched;
  handoff recorded here in accordance with the owner's preservation constraint.

## 2026-10-13 — Stage 7 partial browser/accessibility validation

- No production code defect found; no application/configuration/credential changes.
  Added eight CORS regressions in tests/test_transcription.py and three React UI
  regressions in frontend/scripts/voice-ui.test.mjs (secure-context early rejection,
  names/native controls/live status, navigation playback pause/URL revocation).
- Added frontend/scripts/voice-browser-check.mjs, opt-in via test_voice_e2e.py.
  Isolated loopback origins, temporary Chrome/Edge profiles, fake microphone and
  mock-only Sarvam transport. Existing real CORS middleware is reconfigured only
  in the test process and restored. Count OPTIONS separately from actual POST.
  Generated WAV uses the actual frontend resampler/encoder.
- Real headless Chrome 155.0.8059.39 and Edge 155.0.4283.45 passed: browser-generated
  OPTIONS/authenticated multipart POST, readable 200/401/415/503, blocked-origin
  preflight with zero POST/provider calls; secure localhost/insecure test hostname;
  fake microphone grant/denial/track stop; Tab/Enter/Space native activation and
  computed visible focus ring; AX control names; native confirm accept/cancel;
  nonempty 1600-frame mono 16 kHz WAV decoding, duration 0.1 and playback.
- These browser probes use server-rendered recorder markup plus a test click
  listener, not hydrated React or the whole Next.js page. React statuses/errors,
  actual lifecycle/cleanup are covered in jsdom. Physical hardware, screen-reader
  speech, dynamic browser focus/dialog keys, Firefox/Safari and TLS/mixed-content
  remain manual gaps. Firefox installed but no automation driver; Safari absent.
- Browser renderer CDP timed out inside the sandbox; authorized outside-sandbox
  reruns worked. Initial probe failures came from test CDP key/permission settings
  and treating OPTIONS as POST, corrected in the harness. No browser security
  flags were disabled. Temporary profile deletion is checked against temp root.
- Final backend command: VOICE_BROWSER_CHECKS=1; .venv\Scripts\python.exe -m pytest
  tests/test_voice_e2e.py tests/test_transcription.py tests/test_audio_validation.py
  tests/test_transcription_limits.py tests/test_config_drift.py -q -s --tb=short
  -p no:cacheprovider => 88 passed, 1 existing Starlette/httpx warning (44.72 s).
  Includes ten Stage 6 Node scenarios and both browser probes. Cache plugin was
  disabled for outside-sandbox run to avoid existing Windows cache permissions.
- Frontend node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 58 passed, 0 failed/skipped (3.39 s); existing Node
  MockTimers warnings. TypeScript --noEmit and targeted ESLint of VoiceRecorder,
  SubmitForm, voice capture/audio, api and UI/browser scripts => passed.
- Updated voice docs, PROJECT_STATE and TODO. Stage 7 automated subset passes;
  not fully VALIDATED or ready for final live sign-off until manual gaps are closed.
  Live paid tests require separate authorization; feature remains disabled.
- Branch feature/aarohi, all prior uncommitted work preserved. No commits, pushes,
  switching branches, secrets/credentials edits or live provider/API-credit use.
  SESSION_LOG.md deliberately not edited per owner; handoff is recorded here.

## 2026-10-13 — Stage 8 local voice title suggestions

- Added frontend/lib/voice/title.ts: independent pure extractive helper, original
  en/hi/mr script, whitespace/punctuation/decimal handling, finite greeting/filler
  skip, complete-word/80-grapheme/12-word bounds, conservative long-negation
  abstention and null for unusable input/missing Intl.Segmenter.
- SubmitForm generates only after description acceptance, preserves complete text,
  checks current title before empty-only auto-fill, protects pending edits and
  re-transcription, and offers localized explicit confirmed replacement. Candidate
  hidden/rechecked after description edits. Both fields editable with RHF flags;
  no extra requests or backend changes. Successful submission resets candidate.
- Added en/hi/mr title copy in lib/i18n/voice.ts, 13 utility cases in voice-audio
  tests and 11 UI cases in voice-ui tests. Existing submission/voice tests retained.
- Final frontend command: node --test scripts/voice-audio.test.mjs
  scripts/voice-api.test.mjs scripts/voice-ui.test.mjs => 82 passed, 0 failed/skipped
  (4.55 s). Existing Node MockTimers warnings. Initial decimal terminal punctuation
  regression corrected; useWatch replaced watch to avoid React Compiler warning.
- node node_modules/typescript/bin/tsc --noEmit => passed.
  node node_modules/eslint/bin/eslint.js components/grievance/SubmitForm.tsx
  lib/voice/title.ts lib/i18n/voice.ts scripts/voice-ui.test.mjs
  scripts/voice-audio.test.mjs => passed, no warnings/errors.
- Voice docs, PROJECT_STATE/TODO and DEC-034 updated. Stage 8 ready for mocked
  browser validation, not live sign-off; finite heuristics and lost shortening
  context require citizen review. No new browser/live-provider tests executed.
- feature/aarohi retained. No backend, credentials, commits, pushes, branch changes,
  external providers or API-credit consumption. Prior work preserved; SESSION_LOG
  deliberately untouched per owner; session handoff recorded here instead.

## 2026-10-13 — Stage 8 hydrated browser functional validation

- Added frontend/scripts/voice-title-browser.test.mjs. Reuses actual current-source
  Next.js /submit dev server (127.0.0.1:3000); real hydrated React/RHF handlers,
  worklet/capture/WAV and frontend API. Headless browser fake microphone and CDP
  request fulfillment for synthetic session, API reads and transcription responses.
  All API writes except mocked transcription forbidden before network transport.
- Chrome 155.0.8059.39 and Edge 155.0.4283.45: 12 scenarios passed each (24 total),
  nine mocked multipart uploads each, zero grievance submissions/other writes.
  Tests en/hi/mr original script and full descriptions, manual/pending-entered
  titles, explicit replacement cancellation/confirmation, editable fields,
  re-transcription, provider-style 503, pre-upload cancel and discard/late response.
- No confirmed Stage 8 defect; no application fixes or backend/config changes.
  Initial harness-only wait expected every form button enabled; unrelated controls
  can stay disabled, so removed that broad assertion. Re-ran both browsers passed.
- Attempt to start isolated Next dev on 3218 detected owner's existing server;
  did not stop or alter it, reused port 3000. Headless commands run outside sandbox
  with authorization (renderer restriction established during Stage 7).
- node scripts/voice-title-browser.test.mjs => Chrome 12 passed, Edge 12 passed.
  node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 82 passed, 0 failed/skipped (4.76 s); existing
  experimental MockTimers warnings. TypeScript --noEmit passed. Targeted ESLint
  scripts/voice-title-browser.test.mjs components/grievance/SubmitForm.tsx
  lib/voice/title.ts lib/i18n/voice.ts => passed without warnings/errors.
- Updated VOICE_ASSISTED_COMPLAINT, PROJECT_STATE and TODO. Browser tests mock the
  HTTP transcription boundary, not provider transport; no backend/DB contacted.
  Fake hardware, headless Chromium, DOM clicks and trusted CDP typing; other
  browsers, keyboard-only/screen-reader/manual device checks and recognition or
  native-speaker title quality remain unverified. No live authorization implied.
- feature/aarohi retained; no commits/push/switch, live calls or credit use, actual
  credential edits, backend enablement or SESSION_LOG edits. Profiles cleaned;
  all existing uncommitted work preserved. Handoff here per preservation constraint.

## 2026-10-14 — Stage 8 successful controlled live English test (user-verified)

- Recorded the user's verified outcome: one live English Sarvam STT request
  succeeded on a 7-second real microphone recording. Full transcript populated
  Description; frontend deterministic extractor automatically populated Issue Title.
  Both fields remained editable. No grievance was submitted.
- Title was accurate but conversational and lengthy. Recorded title-concision
  limitation/future review task; no algorithm or application changes made.
- User confirmed restarting backend with TRANSCRIPTION_ENABLED=false afterward.
  Recorded as user confirmation, not a fresh agent runtime verification.
- Distinguished this single live English smoke test from existing mocked en/hi/mr
  unit/form/cross-stack/hydrated-browser results. Live Hindi/Marathi remain
  unvalidated; no general accuracy, latency, billing or production-readiness claim.
- Updated docs/VOICE_ASSISTED_COMPLAINT.md, memory/PROJECT_STATE.md,
  memory/TODO.md and this CHANGELOG only. No transcript/audio/title text or secrets
  recorded. Documentation review/diff check only; no new automated or live tests.
- feature/aarohi retained. No source/configuration/credential changes, transcription
  enablement, provider calls, commits, pushes or branch switching. Existing work
  preserved; SESSION_LOG.md not modified (handoff recorded here instead).

## 2026-10-14 — Voice field-behavior and README documentation alignment

- Added the requested Manual Input and Voice Transcription — Field Behavior table
  to docs/VOICE_ASSISTED_COMPLAINT.md, with empty/manual fields, cancellation,
  failures/discard and in-flight edits. Clarified unchanged fields while recording,
  editable/generated titles, explicit confirmed title replacement, confirmed
  description replacement (no append/merge), and weak-input abstention. Corrected
  workflow ordering to place existing-description confirmation before upload.
- Updated root README voice overview/local setup only: supported en/hi/mr, local
  title extraction, authenticated backend, secure context/CORS, backend-only key,
  disabled default/restart behavior and process-local live-test limitations.
  Explicitly noted data mock-mode switch does not mock transcription.
- Inspected README locations: frontend/README.md and backend/README.md do not
  exist; no new READMEs created. Preserved root structure and unrelated features.
- Reflected the user-verified single seven-second live English success and disabled
  restart; title accurate but conversational/lengthy. Live Hindi/Marathi remain
  unvalidated; no general accuracy or full accessibility/compatibility claims.
- Documentation-only changes: root README, voice guide and this CHANGELOG.
  git diff --check passed. No application/tests/configuration/credential changes,
  provider calls, enablement, commits, pushes or branch switch. feature/aarohi
  retained; all existing work and SESSION_LOG.md preserved unchanged.

## 2026-10-14 — Stage 9 Append Transcription

- Added TranscriptionChoice.tsx: localized native modal Append/Replace/Cancel,
  accessible labels, initial Cancel focus, Escape and AbortSignal cancellation.
  SubmitForm preserves full/latest description on append, explicitly replaces,
  cancels without changing fields, and rechecks after asynchronous choices/edits.
  Empty-description flow and Stage 8 title protections unchanged; suggestion bound
  to combined text. VoiceRecorder supports async callbacks with abort/epoch guards
  before upload and before/after accepted insertion. No backend or API changes.
- Added en/hi/mr chooser copy. Adapted existing UI regressions to drive actual
  dialog buttons, added 12 append/latest-text/spacing/Unicode/Escape/abort cases.
  Updated existing hydrated Stage 8 browser harness for new HTML chooser; not run
  this stage. Backend mock cross-stack test rerun to check callback integration.
- node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 94 passed, 0 failed/skipped (4.40 s); existing
  experimental MockTimers warnings. TypeScript --noEmit passed. Targeted ESLint
  SubmitForm, VoiceRecorder, TranscriptionChoice, i18n/voice, voice-ui and
  voice-title-browser scripts passed without warnings/errors. git diff --check passed.
- .venv\Scripts\python.exe -m pytest tests/test_voice_e2e.py -q --tb=short
  -p no:cacheprovider => 1 passed (ten Node mock cross-stack scenarios), one
  existing Starlette/httpx deprecation warning (4.75 s). No provider calls.
- Updated voice guide/current field behavior, README relevant append wording,
  PROJECT_STATE, TODO, DEC-035 and this CHANGELOG. Native dialog focus/keyboard,
  screen-reader/localized UI and hydrated latest-edit/navigation checks remain
  manual with mocks; modern native dialog support needed. Prior single live
  English success is not new Stage 9 live or multilingual validation.
- Stayed feature/aarohi. No credentials, provider configuration, backend, commits,
  pushes, merges or branches changed. Sarvam not called/enabled; previous work and
  SESSION_LOG.md preserved unchanged. Handoff recorded here instead.

## 2026-10-14 — Stage 9 hydrated dialog/keyboard/cleanup validation

- Executed/expanded actual hydrated Next.js /submit harness, Chrome 155.0.8059.39
  and Edge 155.0.4283.45, fake microphone and CDP API interception only. Each passed
  25 scenarios: 12 Stage 8 regressions + 13 Stage 9 empty/three choices, keyboard,
  localized AX/Escape, latest-edit choices and recording/playback/pending navigation.
  Each made 16 mocked multipart requests, zero grievance submissions/application
  writes. Next diagnostic POSTs (Chrome five/Edge four) separately intercepted and
  blocked, not backend/database calls. Browser console-error summaries empty.
- Found actual Stage 9 StrictMode replay cleanup resolved Cancel prematurely.
  Focused regression failed 0 uploads versus expected 1 before fix, passed after.
  Generation-guarded deferred cleanup distinguishes replay from genuine unmount.
- Keyboard probe found Tab escaping native chooser and focus lost when removed.
  Added explicit boundary Tab/Shift+Tab wrap, opener focus return and editable
  Description fallback when Transcribe disabled. Three focused unit tests added.
  Fixed only TranscriptionChoice.tsx; adapted UI/browser regression scripts.
- Final browser command node scripts/voice-title-browser.test.mjs => Chrome 25
  passed, Edge 25 passed (50 total), 0 final failures. Outside-sandbox execution
  authorized due known renderer restrictions. Owner's dev server untouched.
- node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 97 passed, 0 failed/skipped (9.90 s), existing
  MockTimers warnings. TypeScript --noEmit and targeted ESLint TranscriptionChoice,
  SubmitForm, VoiceRecorder, voice-ui and voice-title-browser scripts => passed.
  git diff --check passed. No backend suite rerun required for this frontend fix.
- Read configured TRANSCRIPTION_ENABLED=False without exposing key/credentials;
  no flag changes. Backend/API/provider never contacted by browser harness.
- Automated dialog/AX/status checks are not manual screen-reader speech. Firefox
  NOT TESTED (installed but no driver); Safari NOT TESTED (unavailable Windows).
  Physical/mobile device, whole-page keyboard-only, native-reader quality and
  HTTPS/live multilingual remain unverified. Existing live English record unchanged.
- Updated voice guide, PROJECT_STATE, TODO, DEC-035 follow-up and this CHANGELOG.
  feature/aarohi retained; existing work preserved, SESSION_LOG unchanged. No live
  Sarvam, credentials, backend/config, unrelated features, commits/push/merge/switch.

## 2026-10-14 — Stage 9 deterministic title concision refinement

- Updated only frontend/lib/voice/title.ts application logic: finite anchored
  en/hi/mr reporting/existence-intro removal, safe retention of quantity expressions
  (a few/a little/a lot/a number), Unicode decimal punctuation. All remaining
  words retained. Oversized complete clauses now abstain instead of clipping
  important details. No AI/backend requests, rewriting, inferred facts or urgency.
- Representative street-light fixture: There is a broken street light near my
  house -> broken street light near my house. Exact successful live-test wording
  was not recorded; no invented live transcript. Marathi reporting intro removed
  while location/count/negation retained; Hindi and decimal quantities covered.
- Added 14 utility cases and two form regressions; retained existing description,
  manual-title, in-flight, append/replace/cancel, validation/submission protections.
  Updated hydrated harness with one street-light case and hi/mr reporting fixtures.
- Final frontend node --test scripts/voice-audio.test.mjs scripts/voice-api.test.mjs
  scripts/voice-ui.test.mjs => 113 passed, 0 failed/skipped (4.85 s), existing
  MockTimers warnings. TypeScript --noEmit and targeted ESLint title.ts plus
  voice-audio, voice-ui and voice-title-browser scripts passed without warnings.
- Final node scripts/voice-title-browser.test.mjs => Chrome 155.0.8059.39 and
  Edge 155.0.4283.45 each 26 hydrated scenarios passed (52 total), 17 mock multipart
  uploads each, zero submissions/application writes. API intercepted before
  transport; no backend/provider contacted. Five Chrome/four Edge diagnostic
  requests separately blocked; console-error summaries empty. Outside-sandbox
  execution authorized for known renderer restrictions. git diff --check passed.
- Updated voice guide, PROJECT_STATE, TODO, DEC-035 follow-up and this CHANGELOG.
  Finite phrases and first-sentence selection do not guarantee semantic/main-issue
  coverage; longer clauses may require typed title. Native-speaker quality,
  screen-reader speech, physical/mobile and Firefox/Safari still unvalidated.
  Historical single live English result unchanged; no new live/multilingual test.
- feature/aarohi unchanged; no credentials, backend/API/configuration, live Sarvam,
  commits/push/merge/branch changes. Existing work and SESSION_LOG preserved exactly.

### 2026-10-14 ? Stage 10 write-free diagnostic initialization guard

- Added default-false DIAGNOSTIC_SKIP_INITIALIZATION_WRITES configuration and
  example documentation. Guard covers initialization index creation/drop/rebuild
  in nine MongoDB repositories (users, grievances, audit, departments, face,
  notifications, progress, SLA, OTP), SLA default seeding, and main startup
  backfill/account seeding. Endpoint behavior/auth rules remain unchanged.
- Final relevant suite: 105 passed, one existing Starlette/httpx deprecation
  warning (41.86s): diagnostic initialization, seed accounts, transcription,
  transcription limits, configuration drift. Includes 25 focused diagnostic tests.
- Broader exploratory run: 182 passed, 10 failed (77.91s). All ten legacy
  grievance-status failures reproduced with new initialization guards removed
  in memory (10 failed, 7.66s); no source rewrites or unrelated fixes performed.
- Python compile checks passed for 13 files, documented launcher syntax passed,
  git diff --check passed. Ruff/mypy unavailable in current venv; no lint/type
  checker installed or downloaded. No frontend changes, so no frontend checks.
- Exact process-local, verified-CA launcher and MongoDB auth singleton/read-only
  lookup verification documented in docs/VOICE_ASSISTED_COMPLAINT.md. Launcher
  not executed. Running backend untouched; no live database/provider calls made.
- Existing uncommitted work preserved. SESSION_LOG.md not modified; SHA256
  C2035F4888FBA86D3AE753E548E0C80E5320AC70AE03FE7F71D5AEA8F65D8EFB unchanged.

### 2026-10-14 ? Stage 11 final voice handoff

Documentation-only final voice handoff: audited frontend/backend/STT/initialization paths and full working tree; created HANDOFF_SUMMARY.md, expanded voice architecture/configuration/file inventory/operational evidence, corrected incompatible TLS combination in documented proposal only, and linked root README. Frontend rerun: 113 passed/0 failed/skipped (5.139s), TypeScript and targeted ESLint passed. Backend historical: 105 targeted passed; broader 182 passed/10 legacy failures reproduced without guards. Historical Chrome/Edge 26 hydrated scenarios each; one owner-confirmed live seven-second English request only. Login remains unresolved; last backend listener absent after failed controlled launches. Added tracked diff/untracked text credential scans found no matches; no tracked private env/key files; stale 242-entry ZIP path audit found no sensitive paths, not full archive/history audit. No servers restarted, database/provider calls, credential edits, commits/pushes/merges or branch changes. SESSION_LOG.md untouched.

Stage 11 final checks: documentation links and corrected proposed launcher syntax/options passed; git diff --check passed; protected SESSION_LOG SHA-256 unchanged. No runtime launcher validation performed.

### 2026-10-14 - Voice testing enablement documentation

Added Enabling Voice Transcription for Testing to HANDOFF_SUMMARY.md: local backend env/key setup, retained attempt/concurrency/duration limits, authorized login and short en/hi/mr recording, actual Append/Replace/Cancel confirmation timing, and disable/restart after testing. Explicitly records credit consumption, server-only credentials, unverified live Hindi/Marathi, default-off diagnostic guard and unresolved login prerequisite. Documentation only; no configuration/credential changes, service restart or provider/database calls. SESSION_LOG.md preserved.

## 2026-10-14 — Render deploy: Mongo index key specs conflict + root route

- Handled MongoDB error code 86 (`IndexKeySpecsConflict`) in `users_db.py`
  and `face_templates.py`: when MongoDB Atlas has an existing index with
  differing options (e.g. non-sparse `uniq_user_email`), the repo drops the
  conflicting index and recreates it with `sparse: true`, preventing a silent
  fallback to `InMemoryUsersRepository`.
- Added `GET /` service descriptor route in `backend/app/routers/health.py`
  returning HTTP 200 with service info, `/docs`, and `/health` pointers to
  satisfy Render root health checks and browser direct visits instead of 404.
- Added regression test `test_root_descriptor_answers_200` in
  `tests/test_endpoints.py`.

