# SESSION_LOG.md — AI Agent Session Log

> Append new entries. Never rewrite previous entries.
> Entries are chronological. Most recent entry is at the bottom.

---

> Older entries (2026-08-06 → 2026-10-13) are archived at
> `memory/archive/SESSION_LOG-2026-08-06_to_2026-10-13.md`.

---

## 2026-10-14 — Removed reference-ID search from citizen surfaces (DEC-028)

### Request
Owner: remove the search-by-ID option entirely for normal users; handle the
frontend accordingly. Confirmed: guests lose all tracking, SMS links landing
on My-grievances is acceptable.

### What changed
- `frontend/app/track/page.tsx`: rewritten to personal-grievances only
  (header + sign-in gate + grid/detail modal + personal dept totals).
- `frontend/app/page.tsx`: hero to single centered column (CTAs centered);
  `HomeTrackPanel` import/usage removed.
- `frontend/components/home/HomeTrackPanel.tsx`: deleted.
- `frontend/lib/i18n/en.ts`: subtitle drops the reference-ID mention; TODO
  note on orphaned keys. Backend, shared helpers, and other locales untouched.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean on touched files,
  `node scripts/check-contract.mjs` passed, `npm run build` green (18 routes).
- Memory updated: DEC-028, TODO §4E annotation, CHANGELOG, this log.

---

## 2026-10-14 — Tracking master-detail dashboard, no department totals (DEC-029)

### Request
Owner (same branch): on track-grievances, drop the by-department view;
the dashboard should carry the user's grievance details.

### What changed
- `/track`: department grid + counting deleted; master-detail layout (list
  left, sticky inline detail panel right, first grievance auto-selected,
  selected card ring highlight, stacked on mobile).
- New `GrievanceDetailPanel.tsx` (detail body extracted from the modal);
  `GrievanceDetailModal` is now an overlay wrapper — `/submit`
  `MyGrievances` behavior unchanged. Per-grievance `key` remount also fixes
  a `set-state-in-effect` lint error.
- `myByDeptTitle/Text` added to the DEC-028 orphan-keys note. Backend untouched.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean, contract checks passed,
  `npm run build` green (18 routes).
- Memory updated: DEC-029, CHANGELOG, this log.

---

## 2026-10-14 — Course correction: UI kept as-was, citizen visibility hide (DEC-030, uncommitted)

### Request
Owner: the master-detail rework went too far — keep the UI as it was, make
dashboard numbers user-scoped, and do the planned popup hiding. No commit
until told.

### What changed (workdir only)
- Reverted `/track` and `GrievanceDetailModal` to the DEC-028 versions;
  deleted the `GrievanceDetailPanel` extraction. DEC-029 marked SUPERSEDED.
- Numbers finding (no code needed): live-mode counts already derive from the
  signed-in user's own grievances; only mock/demo mode shows sample data.
- Hiding via opt-in `citizenView` prop on `GrievanceCard`,
  `GrievanceDetailModal`, `AnalysisPanel` (staff review modal untouched):
  priority badges, department chips, and the Assigned-Department row hidden
  on `/track` + `MyGrievances`. Status/timeline/history/AI text unchanged.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean, contract checks passed,
  `npm run build` green (18 routes).
- NOT committed per owner instruction; memory updated in workdir (DEC-029
  superseded, DEC-030, this log).

---

## 2026-10-14 — Track grid follow-up: by-department section deleted (uncommitted)

### Request
Owner: the "Grievances by department" section should go — page is just "my
grievances".

### What changed (workdir only)
- Deleted the personal department-totals grid from `/track` (counting logic
  + `CATEGORIES`/`departmentKey` imports). Page is now header + sign-in gate
  + grievance cards + detail popup, nothing else.
- `myByDeptTitle/Text` were already on the DEC-028 orphan-keys note; no i18n
  edits needed.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean, contract checks passed,
  `npm run build` green (18 routes).
- NOT committed per owner instruction.

---

## 2026-10-14 — Personal dashboard strip on /track (uncommitted)

### Request
Owner: the My-grievances section feels empty — add a small numbers-only
dashboard of the user's history.

### What changed (workdir only)
- 4-chip strip (Total · Open · In Progress · Resolved) above the list,
  replacing the old total pill; counts derive from the user's own
  grievances with a documented status-bucket grouping (rejected/withdrawn
  count toward Total only). Labels reuse existing i18n keys — zero new
  translation keys, all 11 locales covered.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean, contract checks passed,
  `npm run build` green (18 routes).
- NOT committed per owner instruction.

---

## 2026-10-14 — Signup hardening: profile, captcha, proven phone (DEC-031, uncommitted)

### Request
Owner: proper first-time signup form (name, address, DOB, occupation,
gender, captcha, optional face binding); face-scan-only signup must at
least bind a phone number. Chose self-hosted captcha + fixed gender set.

### What changed (workdir only)
- Backend: `profile_fields.py` (shared validator) + `services/captcha.py`
  (SVG mint/verify, OTP-store backed) new; `RegisterRequest` /
  `FaceSignupStartRequest` extended; public `GET /auth/captcha`; face
  `signup/request-otp` + `signup/verify-otp` bound to the signup token;
  `signup/complete` requires the OTP proof and stamps `phoneVerifiedAt`.
- Frontend: register + face-signup forms (profile fields, gender select,
  shared `CaptchaField`), face signup gains a mandatory OTP step before
  camera capture; 20 i18n keys (en/hi/mr real, 8 placeholders); session +
  API clients extended.
- Tests: `tests/_signup_helpers.py` shared module; updated auth/face-signup/
  recovery/rbac/security/seed/face suites; new
  `test_signup_fields_captcha.py` (13 tests).

### Verification
- Full pytest: 376 passed / 23 failed — failure set programmatically
  verified byte-identical to TODO §11 baseline (incl. the env-specific
  tunable test); +13 new tests green.
- `npx tsc --noEmit` clean, `npx eslint` clean, `npm run build` green
  (18 routes), contract checks passed.
- NOT committed per owner instruction. Open follow-up: Google-OAuth signup
  collects no profile/captcha.

---

## 2026-10-14 — Post-register phone step (uncommitted)

### Request
Owner: ask for phone at signup; bind it so face login accepts it.

### What changed (workdir only)
- `/register`: after account creation (live mode), a phone step — +91 input
  → send code → 6-digit verify → bind via the existing authed `/phone/*`
  endpoints (no new backend). Success card links onward to `/submit` and
  face enrollment on `/profile`; skip link throughout so an SMS failure can
  never brick signup. A verified number passes the DEC-025 face-login gate,
  which is the "bind with face login" wiring.
- 8 new i18n keys (en/hi/mr real, 8 placeholders).
- Aligned backend signup age to 18+ (`profile_fields.py`) to match the
  date-picker cap already in the form; hoisted the picker's `MAX_DOB` to
  module scope for the purity lint rule.

### Verification
- `tsc`/`eslint`/`build`/contract green; signup captcha suite 13 passed.
- NOT committed per owner instruction.

---

## 2026-10-14 — Phone-OTP login + in-form phone (uncommitted)

### Request
Owner: phone sign-in on the login form; phone number belongs in the signup
form itself (not only the post step).

### What changed (workdir only)
- Backend: `POST /auth/login/phone/request-otp` (generic response, no
  oracle; issues only for USER + verified phone) and `/verify` (tokens on
  success; role/verified re-checked). `/auth/register` accepts `phone`
  (400 invalid, 409 duplicate instead of a 500).
- Frontend: login form gains a Phone tab (password/phone/face); register
  form has the +91 field, pre-filled into the post-register verify step.
- Tests: `TestPhoneLogin` (5 tests incl. white-box role-gate); shared
  helper issues deterministic unique phones; full suite 383 passed with
  failures byte-identical to TODO §11.
- 4 new i18n keys (`errPhoneInvalid`, phone-tab/login strings).

### Verification
- Full pytest + `tsc`/`eslint`/`build`/contract green (only baseline fails).
- NOT committed per owner instruction.

---

## 2026-10-14 — Phone-OTP sign-in on login (uncommitted)

### Request
Owner: add phone-number sign-in to the login form.

### What changed (workdir only)
- Backend: `POST /auth/login/phone/request-otp` (generic response, issues
  only for USER + verified phone; per-phone/IP caps) and `/verify` (tokens
  on success; role + verified re-checked; challenge consumed).
- Frontend: Phone tab on login (password/phone always in live mode, face
  tab stays flag-gated); send-code → verify → role-routed landing.
- Tests: `TestPhoneLogin` (5 tests: generic unknown, unverified blocked,
  happy path, 3-strike burn, white-box non-USER rejection).
- 4 new i18n keys (en/hi/mr + placeholders).

### Verification
- `TestPhoneLogin` green; `tsc`/`eslint`/`build`/contract green.
- NOT committed per owner instruction.

---

## 2026-10-14 — Admin popup: AI confidence % hidden (uncommitted)

### Request
Owner: in the admin-dashboard grievance popup, remove the AI-given score
in % for all admins and managers.

### What changed (workdir only)
- `AnalysisPanel` gains opt-in `hideConfidence`; the review modal
(`GrievanceReviewModal`, shared by global admins + department managers)
passes it. Staff keep priority/category badges, explanation, keywords —
only the "NN% sure" chip is gone. Citizen surfaces unchanged.
- Verified `tsc`/`eslint`/`build` green. NOT committed per instruction.

---

## 2026-10-14 — Phone inside the register form (uncommitted)

### Request
Owner: the phone field must be in the signup form itself, not only in the
post-register step.

### What changed (workdir only)
- Backend `/auth/register` accepts an optional `phone`: normalized, 409 on
  invalid or already-registered, stored unverified (`phoneVerifiedAt: None`
  — the post-register OTP+bind step proves it).
- `/register` form has a +91 phone field (live-mode required); the value
  carries into the post-register verify step pre-filled.
- `registerUser`/session `register()` take the phone through; one new i18n
  key (`errPhoneInvalid`, en/hi/mr + placeholders).
- Backend tests: unverified-store, invalid→400, duplicate→409.

### Verification
- Targeted pytest green (only the known baseline failure); `tsc`/`eslint`/
  `build`/contract green.
- NOT committed per owner instruction.

---

## 2026-10-14 — Login form stretched to signup width (uncommitted)

### Request
Owner: login form should be as wide as the signup form.

### What changed (workdir only)
- `frontend/app/login/page.tsx`: card widened `max-w-md` → `max-w-4xl`,
  outer padding aligned to the register page. Content untouched.
- Verified `tsc`/`eslint`/`build` green. NOT committed per instruction.

---

## Session — 2026-10-14

**Goal:** UX/UI improvements to login and register pages (no new design elements).

**Changes made:**

### `frontend/app/login/page.tsx`
- Show/hide password toggle: added `focus-visible:ring-2` for keyboard accessibility
- Error alert: scoped top-level alert to face/pending modes only; password-mode form now shows error inline above the submit button (always visible without scrolling)
- "Forgot password?" label changed to "Reset via email ✉" with a `title` tooltip to set expectations (opens mail client)
- "New here?" link wrapped in a chip-style `bg-ink-50` container with `font-semibold` and `→` arrow to be visually distinct

### `frontend/app/register/page.tsx`
- Added `Eye`/`EyeOff` show/hide toggle to the password field (was missing; login had it)
- Added 3-segment password strength bar (Weak/Fair/Strong) that appears while typing
- Added `min="1900-01-01"` to DOB; `max` now enforces 18+ (was just "today")
- Added age requirement hint below DOB field
- Form visually grouped into two sections with a section label + divider: "Personal info" (Name, DOB, Gender, Occupation) and "Account & contact" (Email, Password, Address)
- Error alert moved from top of form to just above the submit button
- Added captcha context hint text in live mode
- Added `successNotice` state: shows "Account created!" alert for ~1.2s before redirecting
- "Already registered?" link wrapped in same chip-style container as login for symmetry

### `frontend/lib/i18n/en.ts` + all 10 locale files
- Added keys: `errInvalidEmail`, `ageRequirementHint`, `captchaHint`, `accountCreatedNotice`, `passwordStrengthWeak`, `passwordStrengthFair`, `passwordStrengthStrong`
- Changed `forgotPassword` value from "Forgot password?" → "Reset via email"

**Status:** TypeScript clean (0 errors).

### Layout Update — Horizontal Form Stretch (2026-10-14)
- Updated `frontend/app/register/page.tsx`:
  - Expanded container from `max-w-md` to `max-w-4xl` when in registration form mode.
  - Converted the form into a responsive 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8`):
    - Left column: "Personal info" (Name, DOB & Gender, Occupation dropdown with Other input).
    - Right column: "Account & contact" (Email, Password with strength bar, Residential address, Captcha).
  - Merged action buttons into a side-by-side row (Submit and Google Sign Up) directly below the columns.
  - Placed "Already registered? Sign in →" in the card header for desktop, reducing overall vertical height so the entire page fits within standard viewport heights without scrolling.
- Adjusted `frontend/app/login/page.tsx` wrapper padding and header margins to maintain compact vertical fit across laptop displays.

---

## 2026-10-14 — Merged main into feature/aarohi (voice branch merge-ready)

### State found
- `feature/aarohi` = base `e93cdd2` (PR #6) + 1 voice commit (~6k lines:
  Sarvam STT backend, recorder UI, i18n voice pack, pytest + node suites,
  961-line voice guide). 22 commits behind `main` the other way.

### What changed
- `git merge origin/main` into the branch; 4 conflicts resolved
  (render/Sarvam vars kept + PORT pin re-dropped, voice recorder kept +
  removed dept-select dropped, types combined, both DEVELOPMENT sections).
- Voice DECs 028–031 → 032–035 across DECISIONS/TODO/guide/config/audio/
  PROJECT_STATE/CHANGELOG (collided with main's DECs); TODO §3 updated to
  implemented-behind-flag (`TRANSCRIPTION_ENABLED=false` default).
- Committed as `dfc15cb`.

### Verification
- `tsc`/`eslint`/`build`/contract green. Full pytest: 480 passed, 23 failed
  = TODO §11 baseline byte-identical. Voice node: api/audio/UI(59/59) pass;
  title-browser + UI-CDP scripts need real Chrome (this box has a broken
  wrapper only) — owner-side.
- NOT live-tested against Sarvam: no `SARVAM_API_KEY` in `backend/.env`.
  Memory updated: CHANGELOG, TODO §§3/14, PROJECT_STATE, this log.

---

## 2026-10-14 — Render deploy index conflict fix + root descriptor route

### Request
Diagnose why `https://grievance-ai-backend.onrender.com/` failed on Render after deployment.

### Findings
1. Atlas had an existing non-sparse index named `uniq_user_email`. During startup `ensure_indexes()`, Atlas returned MongoDB error code 86 (`IndexKeySpecsConflict`), which was uncaught (code only handled 85). As a result, `_build_users_repo()` caught the exception and fell back to `InMemoryUsersRepository`, so user registrations did not persist.
2. Render probes and browser navigation hit `GET /` directly, which returned 404 Not Found since no handler was registered for root `/`.
3. Background face model preloader logged `ModuleNotFoundError: No module named 'insightface'` because `FACE_AUTH_ENABLED=true` was enabled on Render while face dependencies belong to `requirements-face.txt`.

### Changes Applied
- `backend/app/users_db.py`: caught MongoDB error codes 85 and 86 in `ensure_indexes()`, dropping and recreating conflicting indexes with `sparse: true`.
- `backend/app/repositories/face_templates.py`: caught codes 85 and 86 for TTL indexes.
- `backend/app/routers/health.py`: added `GET /` root service-descriptor endpoint returning `{ "service": "grievance-ai-backend", "status": "ok", "docs": "/docs", "health": "/health" }`.
- `tests/test_endpoints.py`: added `test_root_descriptor_answers_200`.
- `backend/app/config.py` & `backend/app/routers/auth.py`: stripped trailing slashes from `CORS_ORIGINS` and `FRONTEND_URL` to prevent CORS rejection when URLs are entered with a trailing slash.

### Verification
- Targeted pytest (`tests/test_endpoints.py -k "root or health"`) passed 3/3; `tests/test_config_drift.py` passed 16/16.

---

## 2026-10-18 — Homepage entrance animation (reveal-only)

### Request
Homepage "just loads directly" — add a simple loading animation every time,
with everything appearing smoothly.

### Context Read
AGENTS.md, `memory/PROJECT_STATE.md`, `memory/TODO.md` (§11–§14),
`HANDOFF_SUMMARY.md`, `frontend/AGENTS.md`, Next.js 16 docs (CSS / client
components), `frontend/app/page.tsx`, `globals.css`, `layout.tsx`,
`components/ui/*`.

### Decisions
DEC-036 (owner-confirmed in plan mode): reveal-only, no splash; public
homepage only; hero CSS keyframe stagger + IntersectionObserver section
reveal; reduced-motion and no-JS fallbacks; staff overview untouched.

### Changes
- `frontend/app/globals.css`: `--animate-fade-up` token + `fade-up` keyframes;
  `[data-reveal="pending|visible"]` transition states; scoped
  `prefers-reduced-motion` overrides; `@media (scripting: none)` fallback.
- `frontend/components/ui/Reveal.tsx` (new): one-shot IntersectionObserver
  wrapper; rAF fallback when the observer is unavailable; setState only in
  callbacks (repo lint rule).
- `frontend/app/page.tsx`: hero gets `animate-fade-up [animation-delay:…]`;
  five section containers converted from `<div>` to `<Reveal className=…>`.

### Verification
- `npx tsc --noEmit` clean; ESLint 4 errors + 4 warnings = documented
  FaceCapture baseline (none in new code); `npm run build` green (18 routes).
- Headless Chrome for Testing 153 (Playwright binary; the system wrapper is
  broken as documented) over CDP against `next start` on :3100: hero animation
  name/delay/duration/fill correct; five `.animate-fade-up` elements; scroll
  reveals progress 1→5 (final opacities all 1); navigating to `/submit` and
  back resets to 5 pending (replays); reduced-motion emulation gives immediate
  visibility (`animation none`, `transition 0s`); 0 console errors;
  scrollWidth == clientWidth (1440). Screenshots reviewed from
  `/tmp/opencode/shots/` (top, mid, bottom, reduced-motion).
- No backend/API/dependency/i18n changes.

### Note
Firefox/Safari and physical devices not verified; the `scripting: none`
fallback is a CSS-level guarantee and was not runtime-exercised.

---

## 2026-10-18 — Memory restructure: rolling logs + CURRENT_STATE.md (DEC-037)

### Request
Owner: archive the heavy session-log/changelog context; keep one current
memory doc that also contains the remaining work.

### Changes
- Rotation: `SESSION_LOG.md` / `CHANGELOG.md` entries before 2026-10-14 moved
  unchanged to `memory/archive/` (94 + 90 entries) with pointer lines left in
  the active files.
- `memory/CURRENT_STATE.md` (new): snapshot (§1–3) + remaining implement/test
  work (§4–5) + risks, defaults, next steps (§6–8). Supersedes
  `PROJECT_STATE.md` + `TODO.md` (archived unchanged as
  `PROJECT_STATE-until-2026-10-18.md` / `TODO-until-2026-10-18.md`).
- `AGENTS.md` + `memory/README.md`: protocol, handoff list, update table and
  rolling-logs rule updated; stale "auth planned" stack rows corrected
  (DEC-017 landed 2026-10-03).
- DEC-037 added.

### Verification
- Dated-heading diff (original vs archive + active) clean for both logs; no
  entry content modified or lost. Docs-only change — no code touched, tests
  not run.

### Note
Rolling rule: keep ~2 weeks / min ~10 entries; rotate to `memory/archive/`
when the active file passes ~400 lines — never edit or delete entries.

---

## 2026-10-18 — Fix: nested <form> in location search (hydration error on /submit)

### Request
Owner pasted the dev-console error: `<form> cannot be a descendant of <form>`
+ hydration warning on /submit.

### Changes
- `frontend/components/grievance/LocationCapture.tsx`: the manual location
  search rendered its own `<form onSubmit={handleSearch}>` inside
  `SubmitForm`'s outer form. Now a `<div>`: Search button is `type="button"`
  + `onClick`; Enter in the input runs the search via `onKeyDown`
  (preventDefault, `isComposing` guard, same busy/empty conditions) instead of
  implicitly submitting the grievance; dropped the unused event parameter.
- Audited all other forms (login, register, signup/face) — mutually exclusive
  branches, no other nesting.
- Clarified the rolling-log rule in `AGENTS.md` + `memory/README.md`: rotate
  only entries older than the two-week window, never below the ~10-entry floor.

### Verification (owner's live stack: dev :3000 + backend :10000, Mongo)
- Citizen login via seeded account (Citizen@2026!); cold load of `/submit`:
  1 form, 0 nested forms, zero form/hydration console errors, zero console
  errors overall.
- Enter in the search box ("28.6317, 77.2193") pinned Delhi coords, cleared
  the input, and did NOT trigger grievance validation/submission; Search
  button click pinned Mumbai coords; outer Submit with empty fields still
  produces the title/description validation errors (wiring intact).
- `npx tsc --noEmit` clean; ESLint 4 errors + 4 warnings = documented baseline
  (none in touched code); `next build` green (18 routes).

### Note
Production-mode hydration not exercised; the owner's dev server was left
untouched (fresh headless profile, one login). Screenshot:
/tmp/opencode/shots/submit-form-live.png.

---

## 2026-10-18 — Voice-assisted conversational intake, two modes (DEC-038)

### Request
Deliver the complete voice-assisted grievance submission: eliminate the
"Voice transcription is unavailable or disabled" dead end and add a guided
conversation ("Tell us your problem") alongside the retained manual form; one
shared draft across modes; LLM extraction with focused follow-ups; review with
clearly marked AI suggestions; explicit human confirmation; no grievance
schema changes; real ticket via the existing submission pipeline.

### What changed
- Backend: stateless `POST /grievance-intake/extract` (JWT) — Groq strict-JSON
  extraction with deterministic post-validation (`services/grievance_intake.py`),
  router mounted in `main.py`, request models in `models.py`; deep validation
  (1–8 utterances, ≤ 1000 chars each / 4000 total; language, category and
  priority whitelists); 503 unconfigured / 504 timeout / 502 provider mapping;
  provider timeout 25 s; model fallbacks mirror the classification cascade.
  No DB writes, no grievance created.
- Frontend: `lib/voice/intake.ts` state machine + question planner +
  merge/lock rules; `VoiceIntake.tsx` hook + panel + `IntakeModeToggle`;
  SubmitForm integration (mode toggle, voice branch, review section,
  `AiSuggestionBadge`, submit lock, reset on success); `LocationCapture`
  `suggestedSearch` prop; `lib/api.ts` `extractVoiceIntake`; `lib/voice/errors.ts`
  shared error mapping (VoiceRecorder refactored onto it); level-meter tap in
  `capture.ts`; 42 new i18n keys complete in en/hi/mr. Manual remains the
  default branch (rationale + alternatives in DEC-038).
- Original outage was configuration-only: local `backend/.env` line 58
  `TRANSCRIPTION_ENABLED=true` (gitignored); repo/production defaults remain
  false. No transcription-path code bug was found.

### Verification
- Backend: 21 focused tests; full pytest 503 passed / 31 skipped / 23 failed —
  that failure set is the documented pre-existing baseline (CURRENT_STATE §5).
- Frontend: 19 new tests (13 logic/API + 6 UI flow); `npm run test:voice` 132
  passed; `tsc` clean; ESLint at the documented 4-error FaceCapture baseline;
  `next build` green (18 routes).
- Live (owner's local stack; grievance frontend served on :3010 because :3000
  was occupied by an unrelated project; backend :10000): full typed-path E2E —
  citizen login, default manual branch confirmed, voice toggle, free fake-mic
  start/listening/cancel smoke (zero `/transcribe` calls), typed conversation
  with real Groq extraction (3 extract calls), location follow-up, review (AI
  title "Broken streetlight on Rajpur Road", 240-char description, search
  seeded, category/priority hints), citizen edit removed one AI badge,
  coordinate pin, real submission → `GRV-2026-0015`
  (`POST /submit-grievance 200`), zero console/hydration errors. Screenshots:
  /tmp/opencode/shots/voice-intake-*.png.

### Note
The live spoken Sarvam path was intentionally NOT re-run this session
(retention/credit verification pending, per the doc's operational rules); the
historical single live English smoke remains the live STT evidence, and live
Hindi/Marathi remain pending. The task-created grievance `GRV-2026-0015` is
marked "[E2E TEST]" in its description. Local-only enablement
(`backend/.env` TRANSCRIPTION_ENABLED=true) must not be copied to tracked
files. No commits were made by this session.



---

## 2026-10-19 — Spoken follow-up questions + optional photo step (DEC-039)

### Request
Make voice intake fully audio-guided: speak each follow-up in the selected
language (en/hi/mr), auto-play with a persistent mute and replay control, then
offer an optional photo step before final submission. Keep one atomic submit,
editable review with AI badges, the shared draft, the manual branch and
explicit human confirmation. Fixed template questions were chosen so audio is
generated once per language (no recurring TTS cost).

### What changed
- Backend `services/grievance_intake.py`: prompt/response `question` →
  `question_kind` (8 kinds + aliases, unknown → null); `asked_questions` is a
  kind list (last 3); kind-based dedupe. Router docstring updated. Backend
  tests updated to 26.
- Frontend `lib/voice/intake.ts`: 8-kind `IntakeQuestionKind`, kind-based
  `asked` tracking, `planNextStep` lets the model fill only the optional slot;
  `lib/api.ts` Zod schema now validates `question_kind`.
- New `lib/voice/speech.ts` + `scripts/generate-question-audio.mjs`; 24 WAV
  clips in `public/voice/questions/` (bulbul:v3, 16 kHz mono, ~2.7 MB).
- `VoiceIntake.tsx`: auto-play per new question, gesture unlock on
  start/send/retry/replay, persisted mute toggle, "Play again", stop on
  answer/skip/reset/unmount; i18n keys in en/hi/mr.
- `SubmitForm.tsx` / `ImageUpload.tsx`: voice-only optional photo section
  before submit (auto-scroll, skip/reopen, upload-in-flight guard); manual
  branch unchanged; `imageUrl` still in the single submit payload.
- Tests: new `scripts/voice-speech.test.mjs` (11), updated intake/UI suites,
  `package.json` test script.

### Verification
- `npm run test:voice` 148 passed; `pytest tests/test_voice_intake.py` 26
  passed; full pytest 508 passed / 31 skipped / 23 known DEC-006 baseline
  failures; `tsc --noEmit` clean; `next build` green; ESLint 4 pre-existing
  FaceCapture errors + 4 warnings (unchanged baseline).
- Live (headless Playwright Chromium on the owner's stack, real backend/Mongo/
  Groq; no grievance submitted): typed description → location question
  auto-played `location.en-IN.wav` with a running AudioContext (clock advanced
  ~3 s) → switched to Hindi (the open question re-rendered and auto-played) and
  "Play again" replayed `location.hi-IN.wav` → review → photo step in view →
  "Skip photo" → "No photo added"; zero console errors/exceptions. Harness:
  `/tmp/opencode/voice-speech-live.mjs`.
- Docs updated: `VOICE_ASSISTED_COMPLAINT.md` Stage 13 (+ Stage 12 spoken-smoke
  correction), `API.md`, `DECISIONS.md` DEC-039, `CURRENT_STATE.md`.

### Not verified / notes
- Live spoken Hindi/Marathi STT still unvalidated (Hindi *question playback*
  was verified; STT was not re-run).
- No live Cloudinary photo upload/submission was exercised; the photo payload
  path is covered by UI tests with a mocked uploader.
- 24 clips add ~2.7 MB to the repo; regeneration is manual and documented.
- `GROQ compound*` retirement cleanup remains in the working tree and has now
  been folded into this task (see `llm_fallback.py` / `grievance_intake.py`).

---

## 2026-10-19 — Intake question latency bounded (DEC-040)

### Request
Owner: "the questions load very slow, almost 2 minuets slow, please check and
fix."

### Diagnosis
- Both dev servers were down when the check started; restarted them cleanly.
- Fresh-stack timings: typed Send → question text + audio start **1.26 s**;
  spoken Stop → question **1.92 s** (Sarvam STT 0.5 s + extraction 1.2 s);
  direct extraction **0.87 s**; a question WAV over the dev server **~2 ms**.
  The reported 2-minute delay did **not** reproduce after the restart.
- The one code path that can legitimately stall for minutes was the intake
  provider cascade: Groq's SDK retries twice by default, the service allowed
  25 s per attempt, and three models were tried → up to ~225 s. The browser
  aborts at 45 s, so a slow/rate-limited provider produced a long spinner and
  every retry left another stalled request running server-side.

### What changed
- `backend/app/services/grievance_intake.py`: `_call_llm` now uses
  `client.with_options(max_retries=0)`; per-attempt timeout 10 s; a shared
  25 s budget across all models; `504` when the budget is exhausted. Success
  logs the winning model + elapsed time; each failed attempt logs a warning.
- `tests/test_voice_intake.py`: provider stub supports `with_options`; new
  tests for retries disabled and budget enforcement (28 passed).
- `docs/VOICE_ASSISTED_COMPLAINT.md`: Stage 13 provider latency-bound note.
- `memory/DECISIONS.md`: DEC-040. `CHANGELOG.md`, `CURRENT_STATE.md` updated.

### Verification
- `pytest tests/test_voice_intake.py` **28 passed**; `npm run test:voice`
  **148 passed** (frontend unchanged, re-run to confirm).
- Full pytest: **510 passed / 31 skipped / 23 failed** — the documented DEC-006
  status-vocabulary baseline is unchanged, and the pass count is the prior 508
  plus the two new latency tests.
- Live backend after restart: extraction 200 in **1.12 s** and **1.45 s**
  (real Groq), same structured reply as before.
- No grievance was submitted; frontend code unchanged.

### Not verified / notes
- Root cause of the owner's specific 2-minute observation is not confirmed;
  it may have been the stale/stopped dev servers (a production `next build`
  had previously run while the dev server was live, which can stall Turbopack
  compilation). If it recurs, the new backend warnings show which model
  attempt stalls and for how long.
- Do not run `next build` while `next dev` is serving the same `.next`
  directory; restart the dev server after a build.

---

## 2026-10-19 — Mode consolidation + bounded submit classification (DEC-041/042)

### Request
Owner: remove the legacy voice fields and the manual text-filling form from the
mode that should not own them, and fix anything else in the pipeline. Confirmed
scope: manual branch becomes text-only; the voice review becomes read-only with
corrections via the manual form; harden submit-time classification like intake.

### What changed
- Manual branch: plain text entry only (title, description, image, location,
  submit). Deleted `VoiceRecorder.tsx`, `TranscriptionChoice.tsx`,
  `lib/voice/title.ts`, their legacy i18n keys and the 709-line recorder test
  suite (its 8 capture-lifecycle cases were ported to
  `voice-capture.test.mjs`); `test:voice` now runs 6 suites.
- Voice review: read-only title/description plus hidden registered inputs; AI
  badges kept; the conversation (spoken or "Type instead") is the only text
  input, and copy points to "Switch to manual form" for wording changes.
- Cross-stack pytest E2E rebuilt for the intake and made opt-in
  (`VOICE_E2E=1`) because the in-process uvicorn + Node/jsdom harness proved
  too heavy for default/constrained runs; it covers 3 language paths, the
  read-only review, 4 provider-failure modes and transport rejections.
- `classification.py`: `_groq_complete` uses `max_retries=0`, 8 s per call and a
  shared 20 s `classification_budget` (wrapped around the submit cascade);
  `image.py` bounded at 8 s/no retries. New tests cover retries, the timeout
  kwarg and budget exhaustion.

### Verification
- `npx tsc --noEmit`, ESLint on touched files, `next build` — clean.
- `npm run test:voice` **71 passed**; full pytest **511 passed / 32 skipped /
  23 failed** (baseline unchanged; the 32nd skip is the opt-in E2E). Targeted
  classification/image suites pass; one imageUrl assertion fails at HEAD too.
- The heavy E2E was attempted twice and coincided with extension-host restarts;
  it was not re-run. Do not launch it from the agent terminal.

### Not verified / notes
- Post-consolidation live browser pass (manual text-only branch, read-only
  review, switch-to-manual correction) is pending.
- The opt-in cross-stack E2E needs a standalone terminal or CI run; if it still
  destabilizes a machine, reduce it to the 3 language scenarios or retire it.

---

## 2026-10-20 — Spoken opening prompt for conversational intake (DEC-043, Stage 15)

### Request
Owner reported: "Start speaking" begins recording silently — the voice assistant
never speaks first. Expected: tapping "Start speaking" plays an audible opening
prompt in the selected language, then starts recording the citizen's response.
Confirmed design choices:
1. Trigger on "Start speaking" tap within the user gesture.
2. Generate dedicated intro clips via Sarvam TTS.
3. Display the opener as the first assistant message in the conversation log.

### What changed
- `frontend/lib/i18n/voice.ts`: added `intakeIntro` and `intakeSpeaking` keys in
  en-IN, hi-IN, mr-IN and all fallback packs.
- Generated 3 dedicated 16 kHz mono WAV clips (`intro.en-IN.wav`, `intro.hi-IN.wav`,
  `intro.mr-IN.wav`, ~410 kB total) using Sarvam `bulbul:v3`; extended
  `frontend/scripts/generate-question-audio.mjs`. `intro` is kept client-only and
  out of `INTAKE_QUESTION_KINDS`.
- `frontend/lib/voice/intake.ts`: added `prompting` phase to `IntakePhase`,
  `PROMPT_STARTED` action, and transitions in `intakeReducer` and `ALLOWED`.
- `frontend/components/grievance/VoiceIntake.tsx`:
  - `start()` detects `isFirstStart = messages.length === 0 && utterances.length === 0`.
  - Dispatches `PROMPT_STARTED`, logs the assistant message.
  - If not muted: sets `phase: "prompting"`, awaits `getPlayer().play(introUrl)` (with 10 s fallback guard).
  - Silencing effect ignores `phase === "prompting"`.
  - Once settled (`played` or `failed`), dispatches `START` and starts `VoiceCapture`.
  - If muted: starts recording immediately while keeping message in log.
  - Controls: "Start speaking" and "Type instead" disabled while prompting; Cancel stops playback and resets to idle.
  - Follow-up "Answer by voice" bypasses the intro.
- Tests:
  - `frontend/scripts/voice-speech.test.mjs`: added intro asset completeness and URL mapping (12 passed).
  - `frontend/scripts/voice-intake.test.mjs`: added reducer transitions for `PROMPT_STARTED` and cancel (15 passed).
  - `frontend/scripts/voice-intake-ui.test.mjs`: added 4 new tests for opener playback timing, transcript log visibility, muted path, playback failure, and follow-up suppression (15 passed).

### Verification
- `npm run test:voice`: **77 passed** (0 failures).
- `npx tsc --noEmit` and ESLint on touched files clean.
- `node scripts/check-contract.mjs` passed (21 checks).
- Backend `pytest tests/test_voice_intake.py` **28 passed**.
- Documentation & memory: `docs/VOICE_ASSISTED_COMPLAINT.md` Stage 15, DEC-043,
  `memory/CURRENT_STATE.md`, `memory/CHANGELOG.md`, this log.

### Not verified / notes
- Real microphone capture and real speaker playback on physical hardware (tested
  via fake capture and fake audio contexts in the Node test suite; unit test assertions
  verify that capture does not start until intro audio playback resolves).


## 2026-10-20 — Citizen surfaces hide AI classification + confidence (DEC-044)

### Request
Owner: after registering, the system showed the classified department and the
confidence score; remove the "AI is sure" text from everywhere on the user side —
users must not see the classification in any section.

### What changed
- `SubmitForm.tsx`: dropped `AnalysisPanel` from the success card (ref ID +
  confirmation only).
- `GrievanceDetailModal.tsx`: the triage diagnostic is now staff-only; the
  `citizenView` guard wraps the whole panel.
- `GrievanceCard.tsx`: `AnalysisPanel` is staff-only; removed the confidence
  pill and the `hideConfidence`/`citizenView` props; admin review-modal caller
  updated.
- `VoiceIntake.tsx` + `lib/i18n/voice.ts`: the running summary shows only
  issue/location; `intakeClassificationNote` rewritten to neutral routing copy
  (en/hi/mr).
- `ImageUpload.tsx`: plain "Image accepted." (no validation score); `score`
  removed from `UploadedImage`.
- `backend/app/routers/grievances.py`: submit notification now says "Your
  complaint has been registered and is awaiting review." (category removed).
- i18n: `aiSure`, `imgAcceptedScore`, `intakeSummaryCategory`,
  `intakeSummaryPriority` removed from every pack; `formSubtitle` and
  `submitPageDesc` neutralized in en/hi/mr.
- Tests: intake-summary/success-card/citizen-vs-staff modal assertions in
  `voice-intake-ui.test.mjs`; new
  `tests/test_endpoints.py::test_submit_notification_hides_the_classification`;
  `tests/conftest.py` now swaps `notif_repository` on the grievances router too
  (endpoint reads previously missed submit-created notifications).
- `check-contract.mjs`: categoryConfidence rationale updated — retained for API
  parity, no longer rendered.

### Verification
- `npm run test:voice` **79 passed** (0 failures).
- `npx tsc --noEmit` clean; ESLint clean on touched files (repo-wide lint still
  shows 4 pre-existing `FaceCapture.tsx` errors and `ResolverWorkspace.tsx`
  warnings, untouched by this change); `next build` green.
- `pytest tests/test_endpoints.py`: 37 passed / 9 failed = documented DEC-006
  status-vocabulary baseline; the new notification test passes.

### Not verified / notes
- Live browser pass still pending (success card, track detail, voice summary,
  image upload, notification inbox).
- `hfEngine.categoryConfidence` still travels in API responses/types (UI-only
  change); stripping it from citizen-facing payloads would be a separate
  contract decision (DEC-044 alternatives).

---

## 2026-10-20 — Brand redesign to SAMARTH, de-AI copy & vibrant orange palette (DEC-045)

### Request
Owner:
1. Change frontend branding from "GrievAI" to "SAMARTH - System for Accessible Management, Action, Resolution and Tracking of Hearings".
2. Remove generic AI copy and graphics across frontend.
3. Switch orange accent to a brighter, vibrant orange palette.
4. "SAMARTH — National Grievance Portal , remove this rectangle form title, center the navbar elements": remove the orange rectangle logo box from the navbar brand, set clean title "SAMARTH — National Grievance Portal", remove the redundant rectangle badge above the hero title, and center the navbar links.

### What changed
- Rebranding & Navbar Clean-up:
  - Header (`SiteHeader.tsx`): removed the orange `[S]` rectangle box from the brand link; updated to clean text `SAMARTH` and `— National Grievance Portal`.
  - Centered navigation: wrapped left and right header elements in balanced `flex-1` flanks, placing `<nav>` in the dead center of the navbar container.
  - Homepage hero (`app/page.tsx`): removed the rectangle badge (`SAMARTH — National Grievance Portal`) from above the `h1` title so the hero opens directly with the prominent headline.
  - Footer (`SiteFooter.tsx`), Sidebar (`StaffSidebar.tsx`), and App layout metadata (`layout.tsx`) updated to SAMARTH. Contact email set to `support@samarth.gov.in`.
  - Updated copyright and footer copy across all 11 i18n dictionaries (`en.ts`, `hi.ts`, `mr.ts`, and 8 fallback packs).
- De-AI copy & visual design:
  - Rewrote hero badge, principles, overview actors (`System + Officer`), lifecycle actors (`Triage System`), trust section ("Accountability & Oversight", "Structured triage with accountable human decisions", "Automated Categorization") in `en.ts`, `hi.ts`, and `mr.ts`.
  - Replaced `BrainCircuit` with `Layers` in Section 6 (`app/page.tsx`).
  - Softened admin queue header and review modal text (`AdminHeader.tsx`, `GrievanceReviewModal.tsx`).
- Vibrant orange palette:
  - Refined `--color-primary-*` scale in `app/globals.css`: `--color-primary-600: #ff5500;`, `--color-primary-700: #e04800;`.
  - Updated `Button.tsx` `orange` variant from `bg-primary-700` (`#c24a00`, muddy dark rust/brown) to `bg-primary-600 hover:bg-primary-500 active:bg-primary-700 focus-visible:ring-primary-500` (electric civic orange).
  - Updated logo badges in sidebar to `bg-primary-600`.
  - Refactored `SiteFooter.tsx` into a singular, centered footer containing the accountability note and SAMARTH copyright line without separate stacked sections.

### Verification
- `npx tsc --noEmit` in `frontend/`: 0 errors.
- `npm run test:voice` in `frontend/`: 79 passed, 0 failures.
- `node scripts/check-contract.mjs`: all contract checks passed.
- `npx eslint` on all touched files: 0 errors, 0 warnings.

---

## 2026-10-20 — Twilio demo config + Render face packaging (DEC-046)

### Request
Owner: implement the agreed production plan after Plan mode — keep the live
backend (`NEXT_PUBLIC_USE_MOCKS=false`, CORS locked to Vercel), use the Twilio
Trial/international route for the demo with DLT later, rebrand the OTP to
SAMARTH, deploy face auth on Render free first, and reuse the local
`FACE_EMBED_KEY` so existing templates stay valid.

### What changed
- `render.yaml`: build installs `backend/requirements.txt`, then
  `insightface==2.1 --no-deps`, `backend/requirements-face.txt`, and runs the
  pruned model prep; pinned `PYTHON_VERSION=3.14.3`; added `FACE_MODEL_NAME`/
  `FACE_MODEL_ROOT`/`FACE_DET_SIZE`/`FACE_ORT_THREADS`, dashboard-owned
  `FACE_AUTH_ENABLED`/`FACE_EMBED_KEY`, `TRUST_PROXY=true`, and
  `OTP_DEBUG_RETURN_CODE=false`.
- New `backend/scripts/prepare_face_model.py` + `tests/test_prepare_face_model.py`;
  pinned `backend/requirements-face.txt`; added `FACE_MODEL_ROOT`/
  `FACE_ORT_THREADS` config; `face_service` passes the root and one-thread ORT
  session options; updated `.env.example`/`.gitignore`.
- OTP body changed from `GrievAI` to `SAMARTH`; updated `docs/DEVELOPMENT.md`
  (Trial demo path, DLT follow-up, Render face build/upgrade path).
- Pinned `FACE_CHALLENGES` in `tests/conftest.py` to keep the tunable-defaults
  test hermetic against the local `.env`.
- Memory: DEC-046, CURRENT_STATE §2/§4/§5/§6/§7/§8, CHANGELOG.

### Verification
- Targeted pytest: SMS, face auth, face login recovery, face signup, face
  Mongo rate-limit (skipped without `MONGODB_URI_TEST`), config drift — 162
  passed / 3 skipped; new prepare-model tests 3 passed.
- Full pytest: 516 passed / 32 skipped / 22 failed; the 22 are the documented
  stale status-vocabulary/endpoint baseline, with no new failure categories.
- Real `buffalo_s.zip`: only `det_500m`, `2d106det`, `w600k_mbf` extracted;
  stale `1k3d68.onnx` removed; second run idempotent.
- Clean Python 3.14 venv with the pinned stack: `FaceAnalysis` loaded the
  pruned model and detected 6 faces in a real image, with 106-point landmarks
  and 512-D embeddings; ~0.12 s inference with one ORT thread, ~193 MB peak
  RSS on the development machine.
- `render.yaml` parsed successfully (43 env keys, no duplicates); Python
  compile checks passed.
- Not verified: live Render Twilio OTP delivery; Render face 2FA/citizen
  login; free-tier latency; DLT domestic SMS. See CURRENT_STATE §5.
- Commit `dd6dbea` pushed to `origin/main`; Render deploy pending.

---

## 2026-10-20 — Mobile UI layout: side-by-side mode toggle, spacious fields & centered buttons (DEC-047)

### Request
Owner: Selection of manual vs voice should be side by side (not above and below). Other fields should be big and spaced out. Buttons should be centered on mobile. Zero changes to desktop view; no changes to functional fields or validation logic.

### What changed
- `frontend/components/grievance/VoiceIntake.tsx`: `IntakeModeToggle` uses `grid-cols-2` at base so options sit side-by-side on mobile screens; titles/hints wrap on mobile (`break-words`) instead of clipping, with desktop sizing/alignment restored via `sm:`; voice recorder action buttons (Start/Stop/Cancel/Type instead/Skip), language/mute row, and bottom switch actions centered on mobile (`justify-center sm:justify-start`).
- `frontend/components/grievance/LocationCapture.tsx`: Search suggestions wrap on mobile (`break-words`) and keep desktop truncation (`sm:truncate`); search input uses 16px mobile text (`text-base sm:text-xs`) to avoid iOS focus zoom; upgraded search input & GPS/Map action button heights (`h-10 sm:h-9`) with centered button layout (`justify-center sm:justify-start`); map height `h-48 sm:h-64`.
- `frontend/components/ui/Field.tsx`: Increased input and select base touch height (`h-12 sm:h-10`) with 16px mobile text (`text-base sm:text-sm`) to avoid iOS focus zoom, plus `py-2.5 sm:py-2` padding and mobile label/hint spacing (`mb-2 sm:mb-1.5`, `mt-2 sm:mt-1.5`).
- `frontend/components/grievance/SubmitForm.tsx`: Mobile form spacing (`space-y-6 sm:space-y-5`), taller mobile description area (`rows={4}` + `min-h-32 sm:min-h-0`; desktop stays 4 rows), spaced manual grid (`gap-6 sm:gap-5`), submit buttons centered on mobile (`justify-center sm:justify-end`).
- `frontend/components/ui/Card.tsx`: Adjusted `CardHeader` and `CardBody` base padding to `px-4 py-3.5` and `px-4 py-4`; desktop values preserved via `sm:px-6 sm:py-4.5` and `sm:px-6 sm:py-5`.
- Base classes are mobile-first; `sm:` values restore the previous desktop styling. No functional or validation changes.

### Verification
- `npx tsc --noEmit`: 0 errors.
- `npm run test:voice`: 79 passed.
- `node scripts/check-contract.mjs`: passed.
- ESLint clean on all modified files.
- `npm run build`: passed; 18/18 static pages generated.
- Memory updated: DEC-047, CHANGELOG.md, CURRENT_STATE.md, this log.

---

## 2026-10-20 — SAMARTH logo and favicon integration (DEC-048)

### Request
Owner: Use the provided `Samarth Logo.png` from root folder as the favicon and place the logo everywhere needed in the frontend.

### What changed
- Processed `Samarth Logo.png` (1254x1254 RGBA) into web assets: `frontend/public/logo.png`, `frontend/app/favicon.ico`, `frontend/public/favicon.ico`, `frontend/app/icon.png` (32x32), and `frontend/app/apple-icon.png` (180x180).
- `frontend/app/layout.tsx`: Configured metadata icons for standard and Apple touch icons.
- `SiteHeader.tsx`: Added official SAMARTH logo (32x32) to the navbar brand link.
- `StaffSidebar.tsx`: Replaced placeholder `S` badge with the logo (32x32) in staff navigation.
- `SiteFooter.tsx`: Replaced placeholder `S` badge with the logo (24x24) in the footer.
- `app/page.tsx`: Embedded emblem (80x80) centered in the hero section above the main headline.
- `app/login/page.tsx` & `app/register/page.tsx`: Added logo (40x40) to authentication card headers.

### Verification
- `npx tsc --noEmit`: 0 errors.
- `npm run test:voice`: 79 passed.
- `node scripts/check-contract.mjs`: passed.
- ESLint clean on all modified files.
- Memory updated: DEC-048, CHANGELOG.md, CURRENT_STATE.md, this log.

---

## 2026-10-20 — Quality gate & suspicious grievance handling (DEC-049)

### Request
Owner: When registering a fake/non-acceptable grievance (e.g. arithmetic question "what is the answer of 1+2?"), it registered on citizen UI but didn't show up for admin review. For such grievances:
1. Admin should be able to review these (never silently dropped).
2. Citizen should be warned both in text and voice to enter a valid grievance.
3. System should not blindly accept anything; if registered, admin must review.

### What changed
- `backend/app/services/quality_check.py`: Created fast Groq-powered `check_quality(title, description)` bounded inside `classification_budget()`; returns `{"is_genuine": bool, "reason": str}`; fail-safe defaults to `is_genuine=True` on any error/timeout.
- `backend/app/routers/grievances.py`: In `submit_grievance`, runs `check_quality` within budget; persists `qualityFlag="suspicious"` and `qualityReason` on the record; returns `flagged: bool` and `flagReason` to the client.
- `backend/app/db.py`: Forwards `qualityFlag` and `qualityReason` in `to_api()`.
- `frontend/lib/types.ts`: Added `qualityFlag` & `qualityReason` to `Grievance`, and `flagged` & `flagReason` to `SubmitResult`.
- `frontend/lib/voice/speakWarning.ts`: Utility using Web Speech API (`speechSynthesis`) to speak audible warnings in citizen's selected language.
- `frontend/lib/i18n/*.ts`: Added `formGenuineHint`, `resultFlaggedTitle`, `resultFlaggedSubtitle`, `resultFlaggedWarning` across all 11 locale dictionaries.
- `frontend/components/grievance/SubmitForm.tsx`: Added form guidance banner with listen button; on flagged submission, displays an amber warning card with reference ID and explanation, and automatically speaks the audible warning aloud.
- `frontend/components/admin/AdminBoard.tsx`: Added 6th metric card for "Flagged" complaints with direct filter toggle, added "Flagged for Review" to status dropdown, and added an amber `Flagged` badge in the grievance table.
- `frontend/components/admin/GrievanceReviewModal.tsx`: Added "Flagged Submission" header badge and AI quality alert banner explaining why it was flagged.
- `tests/test_quality_check.py`: 5 tests verifying genuine complaint acceptance, fake/math question flagging, LLM unavailable fail-safe, malformed JSON fail-safe, and end-to-end admin retrieval.

### Verification
- `.venv/bin/pytest tests/test_quality_check.py`: 5 passed in 1.04s.
- `npx tsc --noEmit`: 0 errors.
- `node scripts/check-contract.mjs`: passed (18 checks green).
- `npm run test:voice`: 79 passed.
- Memory updated: DEC-049, CHANGELOG.md, CURRENT_STATE.md, this log.

---

## 2026-10-20 — ML pipeline reliability audit (DEC-055)

### Request
Owner asked to create a branch and improve the existing ML classification
pipeline while retaining its production model absent clear evaluation evidence.

### What changed
- Created `codex/ml-pipeline-reliability` from clean `main`.
- Confirmed production model: lazy-trained word/character TF-IDF + balanced
  LogisticRegression, no serialized artifact. Cleaned exact duplicates and
  conflicting-label groups before train/test splitting and fitting.
- Narrowed Water override evidence, stopped broad keyword results from
  replacing category predictions, added scope/uncertainty handling, and removed
  unconditional submit-time Groq refinement. Groq category answers now carry
  zero calibrated confidence; source/latency/failure/token telemetry is logged.
- Bounded and validated the otherwise unused `llm_fallback.py` path. Preserved
  category/API schema and added staff-side uncertainty explanation.
- Replaced misleading evaluator behavior: unique-text evaluation; 414 holdout
  rows in unsupported categories are excluded rather than counted as correct
  `Other`. Added `docs/ML_EVALUATION.md` with audit, metrics and limitations.

### Verification
- Dataset: 1,200 rows, 30 distinct cleaned complaints (five/category), 97.5%
  exact duplicates, zero exact-label conflicts; holdout 614 unique texts, 200
  in-taxonomy; no exact overlap and no char-TFIDF cross-set pairs >=0.85.
- Prior raw model vs updated local policy on 200 known holdout rows: Water
  precision/recall 0.606/1.000 vs 1.000/1.000. Both policy pipelines scored
  1.000 overall on this template-style set; train-only unique test is only six
  examples and cannot establish generalization.
- Focused classification, legacy fallback, direct submit and quality-check
  tests: 69 passed; 5 submit/admin integration cases deselected. Evaluation
  script and Python compile checks passed; provider calls were mocked/not made.
- Full backend suite, frontend checks and live-provider cost impact not run.

### Remaining
Collect more independent, label-audited complaint texts and scope labels before
tuning thresholds or considering an alternative model. `docs/ML_EVALUATION.md`
records the current recommendation: retain LogisticRegression.

## 2026-10-20 — Independent classification pipeline verification (DEC-051)

### Request
Owner requested an evidence-based audit of the 2026-10-20 classification
report, including dataset counts, metrics, production path, Water edge cases,
provider behavior, and the complete test suite. Preserve TF-IDF +
LogisticRegression and make only confirmed minimal fixes.

### What changed
- Created `docs/ML_CLASSIFICATION_AUDIT_2026-10-20.md`; updated
  `docs/ML_EVALUATION.md` and `docs/AI_SYSTEM.md` with corrected comparisons
  and limitations.
- Found that lazy production initialization inherited the 80/20 evaluation
  split and fit only 24/30 cleaned texts. Serving now passes `test_size=0`;
  stratified splits remain evaluation-only (DEC-051).
- Fixed two reproducible Water gaps: common Hinglish “paani ki supply” now
  triggers the explicit Water phrase rule, and a nearby/completed pipe mention
  does not force Water against a competing Road signal. Added tests for each.
- Added a submit endpoint regression asserting that the classified response
  category matches the persisted grievance category.
- Reproduced the reported full-data raw ablation (0.860), but the historical
  production split uses 958 duplicate-weighted rows and scores 0.855 raw;
  both prior domain policy and current local policy score 1.000 on the
  template holdout. The current known-category score is not independent
  validation because the Water rule was changed after inspecting holdout
  errors.

### Verification
- `.venv\\Scripts\\python.exe backend/evaluate.py`: reproduced 1,200 rows,
  30 cleaned unique texts, 97.50% duplication, zero conflicts, 24/6 split,
  614-row holdout, 200 known-category and 414 out-of-taxonomy rows, zero exact
  overlap, and combined-fit char-TFIDF max 0.492. Train-only fit max is 0.665.
- Full pytest with HF/Groq/Sarvam keys blank and temp under workspace:
  567 passed / 24 failed / 5 skipped. Separate collection says 595 items but
  full-run summary totals 596; discrepancy unexplained. No classification
  tests failed; failures are unrelated status/config/image/RBAC checks.
- Focused new fit-size, Water, and persisted-category tests: 5 passed.
- `git diff --check` and `py_compile` passed. No serialized backend model
  artifact found.
- An early standalone probe attempted HF and Groq before environment keys were
  cleared; requests failed DNS/connection before returning provider results.
  Billing cannot be verified. No later evaluation/test made live provider calls.

### Remaining
Collect independent human-labeled complaints and labeled out-of-scope and
multi-issue samples. Treat the template holdout as development evidence, not a
production accuracy estimate. See `docs/ML_CLASSIFICATION_AUDIT_2026-10-20.md`.

## 2026-10-20 — Classification audit follow-up: bulk recategorization

### What changed
- Repository-wide search found `tools/recategorize.py` still performing a
  second keyword overwrite and unconditional Groq refinement after the shared
  classifier. Replaced those steps with the shared bounded category/priority
  cascade; category and source are preserved in modelInfo.
- Added `tests/test_recategorize.py` to verify the classifier result survives
  and refinement is not called. No MongoDB operation was run.

### Verification
- Focused classification/recategorization suite: 38 passed.
- Full pytest with provider keys blank: 568 passed, 24 failed, 5 skipped.
  The 24 failures concern status vocabulary/state expectations, Render
  transcription configuration, image validation, and assignment/RBAC. A
  separate collection reports 596 items while run totals 597; discrepancy
  remains unexplained. The 5 skips are optional Mongo and voice E2E cases.
- `py_compile` and `git diff --check` passed. Evaluation metrics were unchanged.

See `docs/ML_CLASSIFICATION_AUDIT_2026-10-20.md` for the full audit, test list,
and provider-call disclosure.

## 2026-10-20 — Clarified classifier outcome metadata (DEC-052)

### What changed
- Added `categoryOutcome` to distinguish a categorized result, a model-selected
  `other`, uncertainty, and explicit out-of-scope text. Added
  `categoryConfidenceSemantics` so uncalibrated LogisticRegression and
  zero-shot scores are not confused with rule/Groq results where confidence is
  unavailable.
- Preserved the existing `other` routing category and submission behavior.
  Out-of-scope classification is recorded and explained as pending officer
  review; it is not a rejection. `qualityFlag` remains a separate signal.
- Updated API/AI documentation, frontend types and Zod parsing, backend
  persistence tests, contract fixture, DEC-052, and current state.

### Verification
- Focused backend classifier/submit/recategorization tests: 45 passed,
  45 deselected. `py_compile` passed.
- `node frontend/scripts/check-contract.mjs` passed, including assertions that
  outcome and confidence semantics survive Zod parsing. `npx tsc --noEmit`
  passed. A full suite was not rerun after this additive metadata change; the
  preceding full run is documented in the audit report.
- No real provider calls or token usage were measured; provider behavior
  remains mocked/offline.

## 2026-10-20 — Propagated outcome metadata to recategorization

- Updated `tools/recategorize.py` to persist the classifier's outcome and
  confidence semantics in the same `hfEngine.modelInfo` shape as submission;
  explicit out-of-scope text receives the same officer-review explanation.
- Final focused backend run: 45 passed, 45 deselected. `py_compile` and
  `git diff --check` passed. Frontend contract check passed with metadata
  assertions, and `npx tsc --noEmit` passed.
- Did not rerun the full backend suite after this additive metadata update;
  the previous full run's 24 unrelated failures remain documented in the audit.

## 2026-10-20 — Emergency demo stabilization

- Kept work on `codex/ml-pipeline-reliability`; no branch switch or commit.
- Fixed optional-auth department context, cross-department progress checks,
  resolver history authorization, initial assignment scope, legal admin state
  actions, and Water main phrase coverage. Updated API, workflow, AI and
  development docs; added DEC-055/056.
- Focused offline backend suite: 142 passed, 10 legacy status tests excluded.
  Frontend production build passed with Webpack (20 static pages). Full-suite
  rerun was interrupted after progress stalled without a summary. Mongo read
  ping and in-memory local `/health` + `/` smoke succeeded; no live writes or
  provider calls. Deployed smoke was unavailable because deployment tokens and
  production URLs were not configured.
- Demo setup note: ignored local frontend config targets port 10001 while
  backend env/docs default to 10000. Start the backend explicitly on 10001 or
  set `NEXT_PUBLIC_API_URL` to the backend's actual port.

## 2026-10-20 — Contextual classifier reliability follow-up (DEC-053/054)

- Applied Water context validation to model, keyword, HF and Groq candidates;
  routed the legacy adapter and Mongo bulk recategorization through the shared
  category cascade. Added staged Groq latency/failure/token telemetry without
  complaint content. Added a pre-provider submit guard for title+description
  with no Unicode letters; short and misspelled inputs remain accepted.
- Focused offline classifier, endpoint, recategorization, quality and evaluator
  suite: 137 passed, 9 deselected. Python compile checks passed. Offline
  `backend/evaluate.py`: current local policy 5/6 on the 24/6 split (Water
  support 1, P/R/F1 0/0/0, FP 0, FN 1); 200/200 on the already reused template
  holdout with zero Water FP. The raw all-row holdout model has 28 Water FP
  (27 Road, one Sanitation). Metrics and caveats documented in the ML reports.
- Full suite: 588 passed, 24 failed, 5 skipped. The 24 failures are in older
  status vocabulary/state, Render transcription config-drift, image validation
  and assignment/RBAC tests. Collect-only found 616 tests vs 617 counted by
  run summary; discrepancy remains unexplained. Frontend contract, `tsc
  --noEmit`, and `git diff --check` passed. Provider keys blank; no live calls.
---

## 2026-10-20 — Citizen Privacy Shield, Auth Hardening, and Pop-out Map UX (DEC-050)

### Request
Owner:
1. Citizen should only see status of complaints; employee updates and photos should only be visible to managers or admins.
2. Frontend forgets user is signed in and shows "Sign in"; harden session handling.
3. Mobile view overflow fixes: buttons and texts overflowing (e.g. "Use my location" text escaping the box).
4. Harden location picker UI logic, use a pop-out map modal window for bigger visual and better UX on mobile and desktop.

### What changed
- `GrievanceDetailModal.tsx`: When `citizenView` is true, hides "Recent Officer & Field Updates" activity log, resolver names ("Assigned Officer / Team"), and completion/resolution photos. Citizens see only status, lifecycle timeline, title, description, and location pin. Staff/admin surfaces (`!citizenView`) retain complete details.
- `session.tsx`: Synchronous client-side hydration of `user` state from `localStorage` prevents momentary unauthenticated "Sign in" flashes on page loads or navigation. `initSession` only wipes tokens on explicit 401 unauthenticated responses from backend; transient network errors or cold starts no longer clear sessions.
- `api.ts`: Token refresh retains both access and refresh tokens (`setStoredTokens(data.access_token, data.refresh_token)`); network errors during refresh no longer wipe tokens.
- `app/track/page.tsx`: Displays clean spinner while restoring session instead of abruptly showing the "Sign in to track" card.
- `LocationCapture.tsx`: Overhauled location picker UX with responsive buttons (`flex flex-col sm:flex-row`, `w-full sm:flex-1`, `h-auto min-h-[44px] py-2.5 px-3.5`, `break-words text-center`) preventing text overflow/escape on mobile devices. Replaced inline map with a dedicated Pop-out Map Dialog featuring live search, GPS positioning, a touch-friendly interactive map canvas (`h-[55vh]` mobile, `h-[420px]` desktop), reverse-geocoded place preview, and explicit "Confirm Pin Location" action.

### Verification
- `npx tsc --noEmit`: 0 errors.
- `npm run test:voice`: 79 passed.
- `node scripts/check-contract.mjs`: passed (18 checks green).
- `npm run build`: passed (20/20 static routes generated).
- Pytest quality and lifecycle test suites passed.
- Memory updated: DEC-050, CHANGELOG.md, CURRENT_STATE.md, this log.

---

## 2026-10-20 — Admin Active Queue & Resolved Archive Separation (DEC-051)

### Request
Owner: In admin view, only active and priority problems should be at the top; resolved problems should go to a separated tab, like an archive, while preserving all historical data.

### What changed
- `AdminBoard.tsx`:
  - Added `queueTab: "active" | "resolved"` state; filters out resolved/closed items in "active" queue, and non-resolved in "resolved" archive.
  - Active queue pins high-urgency and high-priority tickets to the top using the existing urgency weight comparator without resolved tickets cluttering triage.
  - Resolved archive sorts historical records by newest resolution timestamp (`resolvedAt || createdAt`).
  - Added segmented tab navigation bar above the table (`Active & Priority Queue` and `Resolved Archive`) with dynamic count pills.
  - Made all 6 Executive Command metric cards interactive 1-click triage filters with visual active indicators.
  - Dynamically altered Status dropdown options to show Active statuses on the Active tab and Archive statuses on the Resolved tab.
  - Contextualized table subtitles and empty states for active vs archive modes.

### Verification
- `cd frontend && npx tsc --noEmit`: 0 errors.
- `cd frontend && npm run test:voice`: 79/79 passed.
- `node frontend/scripts/check-contract.mjs`: passed (21 checks green).
- `cd frontend && npm run build`: 20/20 static routes generated successfully.
- Memory updated: DEC-051, CHANGELOG.md, CURRENT_STATE.md, this log.

---

## 2026-10-20 — Location Picker Button Harmonization & Modal Map Loading Fix (DEC-050 follow-up)

### Request
Owner: Pick location map button is too big, make it same as the button next to it, don't use the emoji, and fix the map not loading in the popup.

### What changed
- `LocationCapture.tsx`:
  - Harmonized "Pick on map" and "Use my location" button sizing: both use `h-10 px-3 text-xs sm:text-sm font-medium`, `variant="outline"`, and `text-ink-800`, fitting side-by-side cleanly without expanding or wrapping.
  - Removed emoji (`📍`) from the button label, replaced with clean `<MapPin size={15} />` icon.
  - Fixed popup map loading issue: attached `modalMapRef` directly to a container with guaranteed explicit height (`h-[55vh] sm:h-[420px] min-h-[320px] relative z-0 overflow-hidden bg-ink-100`), eliminating the nested flex `h-full` height collapse bug where Leaflet computed container height as 0px.
  - Bulletproofed Leaflet initialization: cleans up stale `_leaflet_id` on DOM nodes, handles ESM/CJS interop (`(mod as any).default || mod`), catches errors, and triggers staggered `invalidateSize()` (rAF, 100ms, 300ms, 600ms) with a `ResizeObserver`.

### Verification
- `cd frontend && npx tsc --noEmit`: 0 errors.
- `cd frontend && npm run test:voice`: 79/79 passed.
- `node frontend/scripts/check-contract.mjs`: passed (21 checks green).
- `cd frontend && npm run build`: 20/20 static routes generated successfully.
- Memory updated: CHANGELOG.md, this log.

---

## 2026-10-20 — Superadmin 2FA Exemption (DEC-052)

### Request
Owner: remove 2fa from superadmin.

### What changed
- `backend/app/routers/auth.py`: In `_face_step_required`, added an explicit exemption for `SUPERADMIN` accounts (`if user.get("role") == "SUPERADMIN": return False`), ensuring superadmin logins never pause for 2FA verification on password or Google login.
- `backend/app/routers/face_auth.py`: Updated `enroll_face` and `update_template` to disallow enabling `requireLogin2fa` on `SUPERADMIN` accounts.
- Database: Updated stored face template for `superadmin@grievance.local` to `requireLogin2fa: False`.

### Verification
- Tested login via TestClient on `/auth/login` for `superadmin@grievance.local`: status 200, returned `access_token` and `refresh_token` directly (no 2FA pause).
- `.venv/bin/pytest tests/test_face_auth.py`: all 121 tests passed.
- `node frontend/scripts/check-contract.mjs`: passed (21 checks green).
- Memory updated: DEC-052, CURRENT_STATE.md, CHANGELOG.md, this log.

---

## 2026-10-20 — Voice Intake Subsequent Recording Capture Fix (DEC-053)

### Request
Owner: "in any langauge the 2nd voice recording is not being captureed: No audio was captured. Record again and speak into the microphon"

### What changed
- `capture.ts`:
  - Added explicit check and resume on `this.context.state !== "running"` right after connecting the audio graph (`source -> worklet -> mute -> destination`) and before posting `"start"`. Resolves the issue where asynchronous operations (`getUserMedia`, `addModule`) caused browsers to leave the audio context in `"suspended"` state, preventing the worklet from receiving audio samples.
- `speech.ts`:
  - In `SpeechPlayer.stopCurrent()`, suspended the player's `AudioContext` when idle to prevent audio output hardware conflicts from stalling the recording context on secondary recordings.
- `VoiceIntake.tsx`:
  - Null out `capture.current` when the active session stops, fails, or completes in `finish()`.
  - Properly dispose orphaned sessions and clear `capture.current` and `busy.current` if `epoch.current !== generation` inside `start()`.
- `voice-processor.js`:
  - Removed `if (!this.recording) return;` guard from `finish()` so the worklet always flushes and posts `{ type: "complete" }` even if recording had already stopped.
- `scripts/voice-capture.test.mjs`:
  - Added regression test verifying sequential sessions (Session 1 stop -> Session 2 start -> stop) record audio and release hardware without errors.

### Verification
- `npm run test:voice`: 80 passed (0 failures).
- `npx tsc --noEmit`: 0 errors.
- `node scripts/check-contract.mjs`: passed (21 checks green).
- `npm run build`: passed (20/20 static pages generated).
- Pytest `test_voice_intake.py`: 28 passed.
- Memory updated: DEC-053, CHANGELOG.md, CURRENT_STATE.md, this log.





---

## 2026-10-20 — Admin Analytics Aggregation Endpoints & Executive Dashboards (DEC-054)

### Request
Implement meaningful admin analytics for the SAMARTH grievance system using the existing stack (Next.js/TypeScript, Recharts 3.10.1, Leaflet 1.9.4, FastAPI, MongoDB Atlas).
Deliver:
- A. Complaint Trends (AreaChart: received vs resolved over time, daily/weekly/monthly, date-range filtering)
- B. Department Performance (Grouped BarChart: received, open, resolved, overdue)
- C. Resolution Time & SLA Compliance (median & mean resolution days, SLA compliance %, department table)
- D. Complaint Aging (0–2, 3–7, 8–14, 15+ days buckets)
- E. Priority Distribution (low, medium, high, urgent by status, separating stored from AI priorities)
- F. Geographic Hotspots (Leaflet density-scaled markers and clusters, graceful handling of missing coordinates)
- Fast aggregation endpoints (avoid loading 1000 records into memory; MongoDB aggregation + in-memory fallback)
- Privacy (zero citizen PII in aggregate responses)

### What changed
- `backend/app/routers/analytics.py` (new):
  - Five authenticated, role-scoped endpoints: `GET /admin/analytics/trends`, `/departments`, `/resolution`, `/aging`, `/priorities`.
  - Scoped by `grievance.view_dept` permission; SUPERADMIN has full visibility, department ADMIN has departmental scope.
  - Zero citizen PII returned.
  - MongoDB pipelines using `$match`, `$group`, `$dateToString`, `$divide`, `$bucket`, `$cond`. In-memory fallback for testing and dev mode.
- `backend/app/main.py`: Mounted `analytics_router.router`.
- `frontend/lib/api.ts`:
  - Added typed analytics API client functions: `fetchAnalyticsTrends`, `fetchAnalyticsDepartments`, `fetchAnalyticsResolution`, `fetchAnalyticsAging`, `fetchAnalyticsPriorities`.
  - Added honest mock-data generators for demo mode when `NEXT_PUBLIC_USE_MOCKS=true`.
- `frontend/components/charts/AnalyticsCharts.tsx` (new):
  - Built 5 dedicated analytics components (`ComplaintTrendsChart`, `DepartmentChart`, `ResolutionStatsPanel`, `AgingChart`, `PriorityChart`) using Recharts 3.10.1 with brand palette (`#ff5500`), clean loading spinners, retryable error states, and empty states.
- `frontend/components/admin/AdminMap.tsx`:
  - Extended Leaflet map with proximity-based hotspot clustering (~2km).
  - Density-scaled markers (24px badge for 2-4 items, 32px badge with heat rings for 5+ items) with multi-complaint scrollable popups.
  - Mode toggle: "Hotspot Density" vs "All Pins".
  - Graceful coordinate footer showing count of mapped items and excluded uncoordinated items.
- `frontend/components/admin/AdminAnalytics.tsx`:
  - Updated layout with 5 clear segmented tabs: Overview, Trends, Departments, Resolution & SLA, Location (Map).
- `tests/test_admin_analytics.py` (new):
  - 11 unit & integration tests covering authorization, scoping, daily/weekly/monthly trends, department counts, date range filters, SLA metrics, aging buckets, priority distribution, and zero-PII guarantees.
- Documentation & Memory:
  - `docs/API.md`: Documented all 5 new analytics endpoints.
  - `memory/DECISIONS.md`: Recorded DEC-054.
  - `memory/CURRENT_STATE.md`, `memory/CHANGELOG.md`, this log.

### Verification
- `.venv/bin/pytest tests/test_admin_analytics.py`: 11 passed (100%).
- `cd frontend && npx tsc --noEmit`: 0 errors.
- `cd frontend && npx eslint components/admin/AdminAnalytics.tsx components/admin/AdminMap.tsx components/charts/AnalyticsCharts.tsx lib/api.ts`: 0 errors, 0 warnings.
- `node frontend/scripts/check-contract.mjs`: passed (21 checks green).
- `cd frontend && npm run test:voice`: 80/80 passed.
- `cd frontend && npm run build`: passed (all 20/20 static pages generated).


---

## 2026-10-20 — Executive Analytics Dashboard Reliability & Layout Harmonization (DEC-054 follow-up)

### Request
Owner: "the newle added dashboards arent working, if its possible to make them work then do, or else remove"

### Diagnosis
- The newly added charts in `AnalyticsCharts.tsx` previously fired isolated asynchronous fetch requests (`fetchAnalyticsTrends`, etc.) independently of the existing grievance feed. If backend routes were unavailable or pending deployment, or if tokens were missing, the charts got stuck in loading or threw network errors.
- Fragmenting the dashboard across 5 disparate tabs hid the charts from the main overview and caused Recharts container layout/height calculations to fail on unmounted tab switches.

### What changed
- `AnalyticsCharts.tsx`:
  - Refactored all 5 charts (`ComplaintTrendsChart`, `DepartmentPerformanceChart`, `ResolutionSlaPanel`, `ComplaintAgingChart`, `PriorityDistributionChart`) to receive `items: Grievance[]` directly from the parent feed.
  - Dynamically calculates all time-series trends, department aggregates, SLA resolution times, aging backlog buckets, and priority distributions client-side from the active grievance set.
  - Ensured reliable dimensions on all Recharts containers with explicit `minWidth={0}` and numeric `minHeight` bounds, preventing container collapse bugs.
  - Satisfied `react-hooks/purity` by moving timestamp references outside effect and render scopes.
- `AdminAnalytics.tsx`:
  - Restored the cohesive 2-tab layout (`Overview & Trends` and `Location Analysis (Map)`).
  - Placed macro metric cards, complaint trends AreaChart, department performance BarChart, stage distribution PieChart, resolution times & SLA adherence metrics, complaint aging backlog, priority matrix, and similarity clusters into a clear visual hierarchy.

### Verification
- `cd frontend && npx tsc --noEmit`: 0 errors.
- `cd frontend && npx eslint components/admin/AdminAnalytics.tsx components/charts/AnalyticsCharts.tsx`: 0 errors, 0 warnings.
- `node frontend/scripts/check-contract.mjs`: 21 passed.
- `cd frontend && npm run build`: 20/20 static pages compiled successfully.

---

## 2026-10-21 — Citizen-side test suite (documentation only, DEC-063)

### Request
Create a comprehensive, scenario-driven Markdown test-case suite for the
citizen/user-facing experience. Explicitly documentation only — no test code.

### What changed
- Inspected the citizen frontend pages/components, auth/session/API client,
  voice intake, tracking, notifications, profile, relevant backend routers,
  state machine, persistence/projection, captcha/image validation, and
  existing pytest/voice/contract suites.
- Added `docs/USER_SIDE_TEST_CASES.md`: test plan, **170 module cases**,
  **12 E2E journeys**, 70-row requirements traceability matrix, 30-item gap
  register, and automation recommendations. All items are `Not Run`.
- Aligned submission cases with DEC-059 (letterless 400) and DEC-062 (clear
  non-civic 422 before side effects); ambiguous text remains reviewable.
- Added a pointer in `docs/DEVELOPMENT.md`.
- Recorded DEC-063; updated `CURRENT_STATE.md`, `CHANGELOG.md`, and this log.
- No application code or test code was changed.

### Verification
- Structural/documentation checks only: 170 unique module rows (14 fields
  each), 12 unique E2E journeys, valid P0–P3 priorities and `Not Run` status,
  no dangling USR/G references, no placeholder markers.
- No app, pytest, or frontend test run was needed for this documentation task;
  no feature status was upgraded.

### Not done / next
- Execute the smoke set (`USR-AUTH-010/001`, `USR-GRV-001`, `USR-TRACK-001`,
  `E2E-01`) and then P0 security/integrity cases. Confirm and fix the highest
  risks first: G-04/G-05 (cross-user/public lookup), G-01/G-02 (outcome/
  history visibility), G-08 (retry duplicates), G-10 (image-AI blocking).

## 2026-10-23 — Closed admin queue outcome tabs (DEC-064)

### Request
Rename the resolved complaint tab to Closed, with Resolved, Rejected, and
Invalid complaints separated under it.

### What changed
- `AdminBoard.tsx`: added Closed as the terminal-complaint queue, with All
  Closed, Resolved, Rejected, and Invalid sub-tabs and counts. Stored `closed`
  outcomes remain visible in Resolved. Active filters remain active-only.
- Updated `docs/WORKFLOWS.md`, `memory/DECISIONS.md` (DEC-064), and
  `memory/CURRENT_STATE.md`.

### Verification
- `npx tsc --noEmit` passed.
- `npx eslint components/admin/AdminBoard.tsx` passed.
- `node scripts/check-contract.mjs` passed (22 checks).
- `git diff --check` passed. No browser visual pass was run.

## 2026-10-23 — Location picker tap and place-name improvements (DEC-065)

### Request
Allow confirming a map-selected location by click/tap without dragging, and
improve place-name suggestions from typed and voice-derived locations.

### What changed
- `LocationCapture.tsx`: short pointer gestures place a pin; pans and map
  controls are ignored. Voice search uses the spoken language, and geocoder
  choices stay explicit.
- `lib/location.ts`: request structured Nominatim addresses in the chosen
  language and compact results to a named place/locality/city/state hierarchy.
- Added offline label-format contract checks; updated DEC-065, workflow docs,
  and current state.

### Verification
- `npx tsc --noEmit`, focused ESLint, `node scripts/check-contract.mjs`
  (23 checks), and `git diff --check` passed.
- `voice-intake.test.mjs` and `voice-intake-ui.test.mjs` passed. The full
  `npm run test:voice` runner did not return a final summary, so its overall
  result is not claimed.

## 2026-10-23 — Reliable manager employee assignment (DEC-066)

### Request
Fix manager assignment from the grievance queue and employee tab when the
assigned employee did not update consistently in the platform or frontend.

### What changed
- Made assignment/reassignment state and audit-history persistence atomic in
  both repository implementations; removed silent history-write failures.
- Validated nonblank reason and eligible workflow state; same-owner assignment
  returns idempotently. Queue assignment now refreshes immediately, prevents
  stale polls overwriting fresh data, and displays employee ownership.
- Added repository/RBAC coverage and synchronized API, database, workflow, and
  project memory docs.

### Verification
- `tests/test_repository.py`: 22 passed; 22 MongoDB-backed cases skipped
  because no test database is available. The focused manager RBAC workflow
  did not return a result summary and was interrupted.
- Backend compile, frontend TypeScript, focused ESLint, and diff checks passed.

## 2026-10-23 — Fix Similar complaint groups View action

### Request
Make the View action in the admin Similar complaint groups section work.

### What changed
- The action now switches to Location Analysis and filters its map and area
  clusters to the selected TF-IDF wording group. The map summary identifies
  the selected group and offers a Show all locations action to clear the filter.
- Updated group help text because similar wording does not establish that
  reports came from the same area.

### Verification
- `npx tsc --noEmit`, focused ESLint, and `git diff --check` passed.
- No tests or browser visual check were run.
