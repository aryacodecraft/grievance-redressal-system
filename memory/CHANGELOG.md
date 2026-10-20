# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

> Older entries (2026-08-06 → 2026-10-13) are archived at
> `memory/archive/CHANGELOG-2026-08-06_to_2026-10-13.md`.

---

## 2026-10-20 — Executive Analytics Dashboard Reliability & In-Memory Feeds (DEC-054 follow-up)

- Refactored `frontend/components/charts/AnalyticsCharts.tsx` to compute all metrics directly from the live `items` grievance feed (`items: Grievance[]` prop), removing all external network dependencies and eliminating loading stalls, 401 token refresh pauses, and blank charts.
- Restored the cohesive 2-tab layout in `frontend/components/admin/AdminAnalytics.tsx` (`Overview & Trends` and `Location Analysis (Map)`), rendering macro metric cards, complaint trends AreaChart, department performance BarChart, stage distribution PieChart, resolution times & SLA adherence metrics, complaint aging backlog, and priority matrix all in one unified, responsive view.
- Handled React purity rules: moved `Date.now()` calls into external helper utilities to satisfy `react-hooks/purity` ESLint requirements.
- Verification: `npx tsc --noEmit` clean, ESLint clean (0 errors, 0 warnings), contract checks 21/21 passed, Next.js build 20/20 static pages compiled.

## 2026-10-20 — Voice Intake Subsequent Recording Capture Fix (DEC-053)

- `VoiceCapture.ts`: Added explicit `await context.resume()` check right after connecting the audio graph (`source -> worklet -> mute -> destination`) and before posting `"start"`. Resolves the issue where asynchronous operations (`getUserMedia`, `addModule`) caused browsers to leave the audio context in `"suspended"` state, preventing the worklet from receiving audio samples.
- `speech.ts`: In `SpeechPlayer.stopCurrent()`, suspended the player's `AudioContext` when idle to prevent audio output hardware conflicts from stalling the recording context on secondary recordings.
- `VoiceIntake.tsx`:
  - Null out `capture.current` when the active session stops, fails, or completes in `finish()`.
  - Properly dispose orphaned sessions and clear `capture.current` and `busy.current` if `epoch.current !== generation` inside `start()`.
- `voice-processor.js`: Removed `if (!this.recording) return;` guard from `finish()` so the worklet always flushes and posts `{ type: "complete" }` even if recording had already stopped.
- `scripts/voice-capture.test.mjs`: Added regression test verifying sequential sessions (Session 1 stop -> Session 2 start -> stop) record audio and release hardware without errors.
- Verification: `npm run test:voice` 80 passed, `npx tsc --noEmit` 0 errors, `check-contract.mjs` passed (21 checks), Next.js build passed (20/20 routes).

## 2026-10-20 — Superadmin 2FA Exemption (DEC-052)

- `backend/app/routers/auth.py`: In `_face_step_required`, added an explicit exemption for `SUPERADMIN` accounts (`if user.get("role") == "SUPERADMIN": return False`), ensuring superadmin logins never pause for 2FA verification.
- `backend/app/routers/face_auth.py`: Updated `enroll_face` and `update_template` to disallow enabling `requireLogin2fa` on `SUPERADMIN` accounts.
- Database: Updated face template for `superadmin@grievance.local` to `requireLogin2fa: False`.
- Verification: Tested direct token issue on `/auth/login` for superadmin (status 200, access/refresh tokens returned immediately); all 121 pytest face auth tests passed.


## 2026-10-20 — Location Picker Button Harmonization & Modal Map Loading Fix (DEC-050 follow-up)

- `LocationCapture.tsx`:
  - Harmonized "Pick on map" button sizing to be identical to its sibling GPS button: both use `h-10 px-3 text-xs sm:text-sm font-medium`, `variant="outline"`, and `text-ink-800`.
  - Removed emoji (`📍`) from the button label, replaced with clean `<MapPin size={15} />` icon.
  - Fixed popup map loading issue: attached `modalMapRef` directly to a container with guaranteed explicit height (`h-[55vh] sm:h-[420px] min-h-[320px] relative z-0 overflow-hidden bg-ink-100`), preventing height collapse from nested flex `h-full` without explicit ancestor height.
  - Bulletproofed Leaflet initialization: cleans up stale `_leaflet_id` on the DOM node, handles ESM/CommonJS module interop (`(mod as any).default || mod`), catches initialization errors, and triggers staggered `invalidateSize()` (rAF, 100ms, 300ms, 600ms) alongside a `ResizeObserver`.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node frontend/scripts/check-contract.mjs` passed, `npm run build` passed (20/20 static routes).

## 2026-10-20 — Admin Active Queue & Resolved Archive Separation (DEC-051)

- `AdminBoard.tsx`: Separated active/pending complaints from completed complaints with a dedicated tabbed interface (`Active & Priority Queue` vs `Resolved Archive`). Active view hides resolved/closed tickets and automatically surfaces urgent and high-priority tickets first; Resolved view acts as a historical archive sorted chronologically by resolution date.
- Added segmented navigation tab bar above the queue table displaying dynamic counts for active complaints and archived resolutions.
- Converted all 6 Executive Command metric cards into interactive triage switches (Urgent, Unassigned, In-progress, and Flagged cards switch to filtered Active views; Resolved card toggles to Resolved Archive with ring highlight).
- Adapted the Status dropdown options contextually based on the active tab (Active: All Active, Open, Assigned, In Progress, Flagged; Resolved: All in Archive, Resolved, Closed). Contextual empty states and subtitles updated.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node frontend/scripts/check-contract.mjs` passed, `npm run build` passed (20/20 static routes).


## 2026-10-20 — Citizen Privacy Shield, Auth Hardening, and Pop-out Map UX (DEC-050)

- `GrievanceDetailModal.tsx`: When `citizenView` is true, hides "Recent Officer & Field Updates" activity logs, resolver names ("Assigned Officer / Team"), and completion/resolution photos. Citizens see only status, lifecycle timeline, title, description, and location pin. Staff/admin surfaces (`!citizenView`) retain complete details.
- `session.tsx`: Synchronous client-side hydration of `user` state from `localStorage` prevents momentary unauthenticated "Sign in" flashes on page loads or navigation. `initSession` only wipes tokens on explicit 401 unauthenticated responses from backend; transient network errors or cold starts no longer clear sessions.
- `api.ts`: Token refresh retains both access and refresh tokens (`setStoredTokens(data.access_token, data.refresh_token)`); network errors during refresh no longer wipe tokens.
- `app/track/page.tsx`: Displays clean spinner while restoring session instead of abruptly showing the "Sign in to track" card.
- `LocationCapture.tsx`: Overhauled location picker UX with responsive buttons (`flex flex-col sm:flex-row`, `w-full sm:flex-1`, `h-auto min-h-[44px] py-2.5 px-3.5`, `break-words text-center`) preventing text overflow/escape on mobile devices. Replaced inline map with a dedicated Pop-out Map Dialog featuring live search, GPS positioning, a touch-friendly interactive map canvas (`h-[55vh]` mobile, `h-[420px]` desktop), reverse-geocoded place preview, and explicit "Confirm Pin Location" action.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node scripts/check-contract.mjs` passed (18 checks green), `npm run build` passed (20/20 static routes).

## 2026-10-20 — Quality gate & suspicious grievance flagging (DEC-049)

- Added `backend/app/services/quality_check.py` with `check_quality()` using Groq bounded completion within `classification_budget()`; detects non-civic/fake submissions (e.g. arithmetic, riddles, spam) and fails safe to accepted (`is_genuine=True`) on any error or timeout.
- `backend/app/routers/grievances.py`: Integrates `check_quality` into `submit_grievance`; sets `qualityFlag="suspicious"` and `qualityReason` on the document record and returns `flagged: bool` and `flagReason` to the frontend without silently dropping or rejecting submissions.
- `backend/app/db.py`: Forwards `qualityFlag` and `qualityReason` in `to_api()`.
- `frontend/components/grievance/SubmitForm.tsx`: Added genuine complaint guidance banner with listen button; on submission flagged as suspicious, displays an amber warning card with reference ID and explanation, and speaks the warning aloud via `speakWarning` (Web Speech API).
- Added `frontend/lib/voice/speakWarning.ts` for browser speech synthesis guidance.
- Updated all 11 i18n dictionaries (`en`, `hi`, `mr`, and 8 fallback packs) with `formGenuineHint`, `resultFlaggedTitle`, `resultFlaggedSubtitle`, `resultFlaggedWarning`.
- `frontend/components/admin/AdminBoard.tsx`: Added 6th metrics card for "Flagged" grievances with direct filter toggle, added "Flagged for Review" to the status dropdown, and tagged flagged complaints with an amber `Flagged` badge in the table.
- `frontend/components/admin/GrievanceReviewModal.tsx`: Added "Flagged Submission" badge and detailed AI quality alert banner for officers reviewing flagged complaints.
- Added `tests/test_quality_check.py` (5 tests covering genuine, fake/math, fail-safe, and end-to-end admin retrieval). All passed.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node scripts/check-contract.mjs` passed.

## 2026-10-20 — SAMARTH Official Logo & Favicon Integration (DEC-048)

- Converted `Samarth Logo.png` into web assets: `frontend/public/logo.png`, `frontend/app/favicon.ico`, `frontend/public/favicon.ico`, `frontend/app/icon.png` (32x32), and `frontend/app/apple-icon.png` (180x180).
- `frontend/app/layout.tsx`: Configured metadata icons for standard and Apple touch icons.
- `SiteHeader.tsx`: Added official SAMARTH logo (32x32) to the navbar brand link.
- `StaffSidebar.tsx`: Replaced placeholder `S` badge with the logo (32x32) in staff navigation.
- `SiteFooter.tsx`: Replaced placeholder `S` badge with the logo (24x24) in the footer.
- `app/page.tsx`: Embedded emblem (80x80) centered in the hero section above the main headline.
- `app/login/page.tsx` & `app/register/page.tsx`: Added logo (40x40) to authentication card headers.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node scripts/check-contract.mjs` passed, ESLint clean.

## 2026-10-20 — Mobile UI: side-by-side mode toggle, spacious fields & centered buttons (DEC-047)

- `VoiceIntake.tsx`: `IntakeModeToggle` enforces `grid-cols-2` on mobile so manual vs voice options sit side-by-side; titles/hints wrap on mobile (`break-words`) instead of clipping, with desktop sizing/alignment restored via `sm:` overrides; centered voice recorder action buttons (Start/Stop/Cancel/Type instead/Skip), language/mute row, and bottom switch actions on mobile (`justify-center sm:justify-start`).
- `LocationCapture.tsx`: Search suggestions wrap on mobile (`break-words`) and keep their previous desktop truncation (`sm:truncate`); search input uses 16px mobile text (`text-base sm:text-xs`) to avoid iOS focus zoom; search/action buttons use comfortable mobile heights (`h-10 sm:h-9`) with centered button layout (`justify-center sm:justify-start`); map container height adjusted on mobile (`h-48 sm:h-64`).
- `Field.tsx`: Increased mobile touch target height for `Input` and `Select` (`h-12 sm:h-10`) with 16px mobile text (`text-base sm:text-sm`) to avoid iOS focus zoom, plus `px-3.5 py-2.5 sm:py-2` and mobile label/hint spacing (`mb-2 sm:mb-1.5`, `mt-2 sm:mt-1.5`).
- `SubmitForm.tsx`: Increased mobile form spacing (`space-y-6 sm:space-y-5`), taller mobile description area (4 rows + `min-h-32`; desktop stays 4 rows), spaced grid (`gap-6 sm:gap-5`), and centered submit buttons on mobile (`flex items-center justify-center sm:justify-end`).
- `Card.tsx`: `CardHeader` and `CardBody` base padding adjusted (`px-4 py-3.5 sm:px-6 sm:py-4.5` and `px-4 py-4 sm:px-6 sm:py-5`).
- Base classes are mobile-first; `sm:` values restore the previous desktop sizing/spacing. No changes to form fields, state machine, or API contracts.
- Verification: `npx tsc --noEmit` 0 errors, `npm run test:voice` 79 passed, `node scripts/check-contract.mjs` passed, ESLint clean, `npm run build` passed (18/18 static pages).

## 2026-10-20 — Twilio demo + free-first Render face packaging (DEC-046)

- Added `backend/scripts/prepare_face_model.py` (downloads `buffalo_s.zip`, extracts only detector/landmark/recognition ONNX files, removes unused models) and `tests/test_prepare_face_model.py`.
- Updated `render.yaml`: pinned `PYTHON_VERSION=3.14.3`, installed `insightface==2.1 --no-deps` + `backend/requirements-face.txt` + pruned model prep; `FACE_MODEL_ROOT`, `FACE_DET_SIZE=320`, `FACE_ORT_THREADS=1`, `TRUST_PROXY=true`, dashboard-owned `FACE_AUTH_ENABLED`/`FACE_EMBED_KEY`, `OTP_DEBUG_RETURN_CODE=false`.
- Added `FACE_MODEL_ROOT`/`FACE_ORT_THREADS` config + `.env.example` parity; `face_service` passes the root and one-thread ORT session options; `.gitignore` ignores `.insightface/`.
- Replaced the remaining OTP branding with `Your SAMARTH verification code ...`; pinned face dependencies (onnxruntime 1.31.0, headless OpenCV 4.14.0.94, scikit-image, onnx, tqdm) and documented the two-step install.
- Documented the Trial international Twilio demo, DLT follow-up, and Render free-tier face build/upgrade path in `docs/DEVELOPMENT.md`.
- Tests: targeted SMS/face/face-recovery/signup/config-drift suites 162 passed / 3 skipped; new prepare-model tests 3 passed. Full suite 516 passed / 32 skipped / 22 failed — the documented stale status-vocabulary/endpoint baseline, no new failure categories. Clean Python 3.14 venv loaded the pruned model and detected 6 faces in a real image (~193 MB peak RSS, one ORT thread). `render.yaml` parsed with no duplicate env keys.
- Pinned `FACE_CHALLENGES` in `tests/conftest.py` so the tunable-defaults test is hermetic against a local `.env` override.
- Live Render Twilio OTP and face 2FA/citizen login remain pending owner/dashboard verification; no live success is claimed.

## 2026-10-20 — Brand redesign to SAMARTH, de-AI copy, vibrant orange palette & navbar centering (DEC-045)

- Rebranded application from "GrievAI" to **SAMARTH — System for Accessible Management, Action, Resolution and Tracking of Hearings**.
- Updated `SiteHeader.tsx`, `SiteFooter.tsx`, `StaffSidebar.tsx`, `layout.tsx`, and all 11 i18n dictionaries (`en.ts`, `hi.ts`, `mr.ts`, and 8 hidden fallback packs).
- Removed the orange `[S]` rectangle from the navbar title, setting clean brand text `SAMARTH — National Grievance Portal`. Centered the navbar links (`Home`, `Register Grievance`, `Track Grievance`, `Profile`) via balanced `flex-1` flanks.
- Removed the redundant rectangle badge (`SAMARTH — National Grievance Portal`) from above the hero `h1` title in `app/page.tsx`.
- De-AI copy: replaced generic "AI-assisted portal", "AI + Officer", "AI System", "AI inference" phrases with civic-focused terminology ("SAMARTH — National Grievance Portal", "System + Officer", "Triage System", "Automated Categorization"); replaced `BrainCircuit` with `Layers` in Section 6; softened admin queue copy. Preserved field-level "AI suggestion" badge on draft inputs.
- Simplified `SiteFooter.tsx` into a singular, centered civic footer displaying the accountability note and SAMARTH copyright notice, removing separate multi-tiered sections.
- Verification: `npx tsc --noEmit` clean; `npm run test:voice` 79 passed; `node scripts/check-contract.mjs` passed; ESLint clean across all modified files.

## 2026-10-20 — Citizen surfaces hide AI classification + confidence (DEC-044)

- Submit success card no longer renders the AI triage panel; the citizen sees
  only the reference ID and confirmation. The track-detail modal renders the
  "Automated Triage Diagnostic" for staff only (`citizenView` guards the whole
  panel instead of just the badges).
- `AnalysisPanel` is staff-only; the `aiSure` confidence pill is deleted from
  the component and all locale packs (no surface shows a confidence percentage).
- Voice intake summary drops "Suggested category"/"Suggested priority"; the
  classification note, submit-form subtitle and submit-page description now
  promise neutral routing instead of showing department/priority.
- Image upload stops printing the validation score; the backend submit
  notification now reads "Your complaint has been registered and is awaiting
  review." (no category/department).
- Verification: `npm run test:voice` **79 passed**; new backend notification
  test plus a `tests/conftest.py` isolation fix (the grievances router was not
  swapped to the fresh notification store, so endpoint reads missed the
  submit-created record); `tsc`, touched-file ESLint, `next build` clean;
  `test_endpoints.py` 37 passed / 9 documented DEC-006 baseline failures.

## 2026-10-20 — Spoken opening prompt on Start speaking (DEC-043, Stage 15)

- Voice intake starts with an audible prompt: tapping "Start speaking" plays a
  localized opening prompt (`intakeIntro`) in the selected language (`en-IN`,
  `hi-IN`, `mr-IN`) before capture begins, leading the conversation rather than
  recording silently.
- 3 dedicated 16 kHz mono WAV clips (`intro.en-IN.wav`, `intro.hi-IN.wav`,
  `intro.mr-IN.wav`, ~410 kB total) generated via Sarvam `bulbul:v3` and committed
  under `frontend/public/voice/questions/`. Generator extended; no runtime TTS spend.
- Reducer & flow: `PROMPT_STARTED` adds the prompt as the first assistant message
  in the transcript log and sets `phase: "prompting"`; playback is awaited before
  `START` and `session.start()`, avoiding echo contamination in STT; muted mode
  records immediately while still logging text; playback failure falls through to
  recording; follow-up questions do not replay the opener.
- Verification: `npm run test:voice` **77 passed** (6 new tests across UI, speech,
  and intake suites); `npx tsc --noEmit` and touched-file ESLint clean; backend
  `pytest tests/test_voice_intake.py` 28 passed.
- Docs/memory: `VOICE_ASSISTED_COMPLAINT.md` Stage 15, DEC-043, `CURRENT_STATE.md`,
  this log.

## 2026-10-19 — Mode consolidation + bounded submit classification (DEC-041/042)

- Manual `/submit` branch is text-only: removed `VoiceRecorder.tsx`,
  `TranscriptionChoice.tsx`, `lib/voice/title.ts`, their legacy i18n keys, the
  709-line `voice-ui.test.mjs` and the title/browser probes; the 8
  capture-lifecycle tests were ported to `voice-capture.test.mjs`; `test:voice`
  now runs the capture/intake/speech/audio/API suites (**71 passed**).
- Voice review is read-only: title/description render as text plus hidden
  payload inputs, keeping the "AI suggestion" badges; wording is shaped only by
  the conversation, and corrections switch to the manual form on the same RHF
  draft. Copy updated in en/hi/mr (`intakeReviewHint`, `intakeManualHint`).
- Cross-stack voice E2E rebuilt around the intake (real UI → real
  `/transcribe` → mocked Sarvam → canned extraction) and made opt-in
  (`VOICE_E2E=1`) because the in-process uvicorn + Node/jsdom harness is too
  heavy for the default suite/constrained machines; default pytest skips it.
- Submit-path Groq latency bounded (DEC-042): classification and refinement use
  `with_options(max_retries=0)`, an 8 s per-call timeout and a 20 s shared
  `classification_budget()`; image validation is 8 s/no retries. Exhaustion
  falls through to HF/keywords instead of hanging.
- Verification: `tsc` clean, ESLint clean on touched files, `next build` green,
  `npm run test:voice` 71 passed, full pytest **511 passed / 32 skipped / 23
  failed** (documented baseline; the extra skip is the opt-in E2E). The opt-in
  E2E and a live post-consolidation browser check were not run.
- Docs/memory: `VOICE_ASSISTED_COMPLAINT.md` Stage 14, DEC-041/042,
  `CURRENT_STATE.md`, this log.

## 2026-10-19 — Spoken follow-up questions + optional photo step (DEC-039)

- Intake contract: `question` (free text) → `question_kind` (one of eight
  whitelisted kinds, aliases normalized, unknown → null); `asked_questions`
  carries kinds, not wording; dedupe is kind-based. Prompt no longer asks the
  model to write questions. `tests/test_voice_intake.py` updated (26 tests).
- New `frontend/lib/voice/speech.ts`: static clip URLs, persisted mute
  preference, shared gesture-unlocked `AudioContext`, decoded-buffer cache,
  supersede/cancel outcomes, `<audio>` fallback. `VoiceIntake.tsx` auto-plays
  each new question once, adds a mute toggle + "Play again", stops audio when
  the question is answered/skipped/reset, and speaks in the selected language.
- 8 kinds × 3 languages of pre-recorded WAVs (Sarvam `bulbul:v3`, 16 kHz mono,
  ~2.7 MB) committed under `frontend/public/voice/questions/`; one-off
  generator `frontend/scripts/generate-question-audio.mjs` (not run by
  build/test). No runtime TTS endpoint/flag/cost.
- Photo step in the voice review branch only: auto-appears and scrolls into
  view, optional "Choose photo" or "Skip photo" (reopenable), `onBusyChange`
  blocks skip/submit during upload, `imageUrl` stays in the single submit
  request. Manual branch unchanged. i18n keys complete in en/hi/mr.
- Tests: new `scripts/voice-speech.test.mjs` (11); updated intake/UI suites;
  `npm run test:voice` 148 passed; pytest intake 26 passed; `tsc` clean;
  `next build` green; ESLint at the 4-error FaceCapture baseline.
- Live (headless Playwright Chromium, real Groq, no submission): English
  location question auto-played with a running AudioContext; switching to Hindi
  re-rendered and re-spoke the open question, and replay played
  `location.hi-IN.wav`; photo step appeared in view and skipped; zero console
  errors. Docs: `VOICE_ASSISTED_COMPLAINT.md` Stage 13, `API.md`; corrected the
  Stage 12 "live spoken path not re-run" note.
- Latency fix (same day, DEC-040): the intake cascade now disables the Groq
  SDK's automatic retries, caps each model attempt at 10 s and shares a 25 s
  total budget (`504` when exhausted), so a stalled/rate-limited provider can
  no longer keep the spinner running for minutes past the browser's 45 s
  timeout. Success logs the winning model and elapsed time; each failed attempt
  logs a warning. Live extraction stayed at 1.1–1.5 s; new tests cover retries
  disabled and the cascade stopping at the budget (`tests/test_voice_intake.py`
  28 passed).

## 2026-10-18 — Fix: nested form in location search (hydration error on /submit)

- `frontend/components/grievance/LocationCapture.tsx`: the manual location
  search was its own `<form onSubmit={handleSearch}>`, rendered inside
  `SubmitForm`'s outer grievance `<form>` — invalid HTML (nested form tags are
  dropped by the parser during SSR), causing the React hydration error
  `<form> cannot be a descendant of <form>` on `/submit`. It is now a plain
  `<div>`; the Search button is `type="button"` + `onClick`, and the input
  handles Enter via `onKeyDown` (preventDefault + `isComposing` guard + the
  same busy/empty conditions) so Enter searches without submitting the
  grievance. `handleSearch` lost its now-unused event parameter.
- Audited all other `<form>` usages (login, register, signup/face): their
  forms are in mutually exclusive branches — no other nesting exists.
- Verified on the owner's live stack (dev server :3000 + backend :10000 with
  Mongo): seeded citizen login → cold load of `/submit` shows exactly 1 form
  and 0 nested forms, zero form/hydration console errors; Enter with
  "28.6317, 77.2193" pins coordinates and does not submit; Search button
  click works; outer Submit with empty fields still shows the title/description
  validation errors; zero console errors overall. `tsc` clean, ESLint at the
  documented baseline, `next build` green (18 routes). Production-mode
  hydration not exercised (dev + build only).

## 2026-10-18 — Memory logs: rolling rotation + CURRENT_STATE.md (DEC-037)

- Rotated `SESSION_LOG.md` / `CHANGELOG.md` entries older than 2026-10-14 into
  `memory/archive/SESSION_LOG-2026-08-06_to_2026-10-13.md` (94 entries) and
  `memory/archive/CHANGELOG-2026-08-06_to_2026-10-13.md` (90 entries); active
  files keep recent entries + a pointer (~400 / ~285 lines now).
- New `memory/CURRENT_STATE.md` supersedes `PROJECT_STATE.md` + `TODO.md`
  (both archived unchanged as `*-until-2026-10-18.md`); it holds the current
  snapshot plus every remaining implement/test item.
- `AGENTS.md` + `memory/README.md`: memory protocol, handoff list, update
  table and the new rolling-logs rule updated; also corrected the stale
  "auth planned" stack rows (DEC-017 implemented 2026-10-03).
- Verified: dated-heading diff (original vs archive + active) clean — no entry
  content modified or lost. Docs-only change; no code or tests affected.

## 2026-10-18 — Homepage entrance animation (reveal-only, DEC-036)

- Added a reveal-only entrance animation to the public homepage `/`:
  hero elements stagger in via a CSS `fade-up` keyframe (0/80/160/240/320 ms
  steps, 0.6 s, `fill-mode: both`) and the five below-fold sections fade/slide
  in once when scrolled into view. No splash screen, no artificial delay.
- New `frontend/components/ui/Reveal.tsx`: IntersectionObserver wrapper
  (`threshold 0.15`, `rootMargin 0 0 -8% 0`) flipping `data-reveal`
  pending → visible; disconnects after first reveal; rAF fallback when
  IntersectionObserver is unavailable. SetState only in observer callbacks
  (repo lint rule).
- `frontend/app/globals.css`: `--animate-fade-up` theme token + keyframes,
  `[data-reveal]` state styles, scoped `prefers-reduced-motion` overrides
  (new animations off — content immediately visible; existing spinners/pulses
  untouched) and `@media (scripting: none)` so content is never stuck hidden
  without JS.
- Staff overview (`StaffHomeOverview` at `/` for ADMIN/RESOLVER/SUPERADMIN)
  intentionally unchanged; no new i18n keys, no dependencies, no data/timing
  changes.
- Verified: `npx tsc --noEmit` clean; ESLint at the documented baseline
  (4 pre-existing FaceCapture errors + 4 warnings, none in new code);
  `npm run build` green (18 routes). Headless Chrome for Testing 153 over CDP
  against `next start`: hero computed animation (`fade-up`, 0.08 s, 0.6 s,
  both), five hero-animated elements, sections reveal 1→5 on gradual scroll
  (final opacity 1), client-side navigation away + back resets to 5 pending
  (replays), reduced-motion emulation immediate visibility (`animation none`,
  `transition 0s`), zero console errors, no horizontal overflow; screenshots
  reviewed. Firefox/Safari and physical devices remain unverified.

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
- Normalized `CORS_ORIGINS` and `FRONTEND_URL` in `backend/app/config.py` and
  `routers/auth.py` with `.rstrip('/')` so origins with accidental trailing
  slashes still match browser `Origin` headers.

## 2026-10-18 — Voice-assisted conversational intake, two modes (DEC-038)

- New authenticated stateless `POST /grievance-intake/extract`
  (`backend/app/routers/voice_intake.py`, `services/grievance_intake.py`):
  utterances/language/draft/asked-questions → strict-JSON `title`,
  `description`, `location_text`, `category`, `priority`, `question`; deep
  400 validation; provider failures 503/504/502; no DB writes, no schema
  change; submission stays on `POST /submit-grievance`.
- Frontend: pure state machine `lib/voice/intake.ts`; `useVoiceIntake` +
  panel + `IntakeModeToggle` in `components/grievance/VoiceIntake.tsx`
  (hook owned by `SubmitForm`, so the conversation survives mode switches);
  review block with "AI suggestion" badges; one shared RHF draft with
  citizen-edit locks; submit lock; `LocationCapture.suggestedSearch` seeds
  the search only (never auto-pins); 42 new i18n keys complete in en/hi/mr;
  `extractVoiceIntake` client (45 s timeout); shared `lib/voice/errors.ts`;
  level-meter tap in `capture.ts`. Manual remains the default branch.
- Tests: `tests/test_voice_intake.py` 21 passed; new frontend
  `scripts/voice-intake.test.mjs` + `scripts/voice-intake-ui.test.mjs` 19
  passed (wired into `npm run test:voice`, whole suite 132). Full pytest:
  503 passed / 31 skipped / 23 failed = documented pre-existing baseline.
  `tsc` clean, ESLint baseline unchanged, `next build` green.
- Live E2E (owner stack, headless Chromium): login → voice toggle → free
  fake-mic start/listening/cancel smoke (zero `/transcribe` calls, no Sarvam
  spend) → typed conversation with real Groq extraction (3 calls) → location
  follow-up → review (AI title, 240-char description, search seeded
  "Rajpur Road, Delhi, near SBI ATM", category/priority hints) → citizen edit
  dropped one AI badge → coordinate pin → real submission `GRV-2026-0015`;
  zero console/hydration errors. Live spoken Sarvam path NOT re-run
  (retention/credit checks pending); live hi/mr still pending.
- Enable doctrine unchanged: `TRANSCRIPTION_ENABLED=true` only in the
  gitignored local `backend/.env`; repo/production default stays `false`.



## 2026-10-20 — Admin Analytics Aggregation Endpoints & Executive Dashboards (DEC-054)

- Backend Analytics Router (`backend/app/routers/analytics.py`):
  - Endpoints: `GET /admin/analytics/trends`, `GET /admin/analytics/departments`, `GET /admin/analytics/resolution`, `GET /admin/analytics/aging`, `GET /admin/analytics/priorities`.
  - Authenticated and role-scoped: SUPERADMIN has global visibility; ADMIN is scoped to their department.
  - Privacy: responses return strictly aggregate metrics and zero citizen PII.
  - Aggregation architecture: MongoDB aggregation pipelines for production (`storage_mode() == "mongodb"`), in-memory Python fallback for dev/testing.
- Frontend Analytics Charts (`frontend/components/charts/AnalyticsCharts.tsx`):
  - Recharts AreaChart for complaint trends (received vs resolved, daily/weekly/monthly granularity, quick date range selection).
  - Grouped BarChart for department performance (received, open, resolved, overdue).
  - Resolution time & SLA compliance metrics panel with mean/median days and department performance table.
  - Complaint aging bar chart with 0–2, 3–7, 8–14, 15+ days buckets.
  - Priority distribution chart showing stored priority values by lifecycle state.
- Leaflet Map Hotspots (`frontend/components/admin/AdminMap.tsx`):
  - Extended existing Leaflet 1.9.4 map without adding new libraries.
  - Added proximity-based hotspot clustering with density-scaled markers (24px for 2-4 items, 32px with heat rings for 5+ items) and scrollable popup grievance lists.
  - Added view toggle between "Hotspot Density" and "All Pins".
  - Graceful handling of complaints without coordinates with a clear status footer.
- Analytics Page Layout (`frontend/components/admin/AdminAnalytics.tsx`):
  - Added segmented tabs: Overview, Trends, Departments, Resolution & SLA, Location (Map).
- Tests & Validation:
  - Added `tests/test_admin_analytics.py`: 11 passed (100% pass on auth, RBAC, filters, metrics, PII checks).
  - `npx tsc --noEmit` clean, ESLint clean on all touched files, contract checks 21/21 passed, voice tests 80/80 passed, `next build` 20/20 static pages green.
