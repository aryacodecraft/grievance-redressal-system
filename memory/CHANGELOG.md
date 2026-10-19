# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

> Older entries (2026-08-06 → 2026-10-13) are archived at
> `memory/archive/CHANGELOG-2026-08-06_to_2026-10-13.md`.

---

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


