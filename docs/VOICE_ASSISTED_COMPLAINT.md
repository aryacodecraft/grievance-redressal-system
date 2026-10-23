# VOICE_ASSISTED_COMPLAINT.md — Voice-Assisted Complaint Lodging

> Stages 4-15, updated 2026-10-20, DEC-032/DEC-033/DEC-034/DEC-035/DEC-038/
> DEC-039/DEC-040/DEC-041/DEC-042/DEC-043.
> Backend and frontend IMPLEMENTED and TESTED with mocks; one user-verified live
> English smoke test passed, the Stage 12 conversational flow passed a full
> live typed-path browser E2E (real LLM extraction + real submission
> `GRV-2026-0015`, 2026-10-18), and Stage 13 question playback was verified live
> in English and Hindi (2026-10-19). Stage 14 (DEC-041) retires the single-shot
> recorder surfaces from Stages 1–9: the manual branch is now text-only and the
> conversational review is read-only. Stage 15 (DEC-043) adds an audible opening prompt
> on the first "Start speaking" tap before microphone capture begins. Live spoken Hindi/Marathi STT remain
> unvalidated; execution results are in memory/CHANGELOG.md. Speech accuracy
> EXPERIMENTAL, not VALIDATED. Disabled by default, including Render.

---

## Overview and scope

Sarvam STT helps citizens draft descriptions. Transcription creates no grievance,
does no classification or administrative action, and writes no database records.
The user edits text before ordinary `POST /submit-grievance`. No MongoDB schema,
auth endpoint behavior or grievance submission logic changes. Stage 10 separately
adds an opt-in initialization-only diagnostic guard; see its operational section. Translation, streaming,
diarization and audio archival are out of scope.

## Supported languages

English `en-IN`, Hindi `hi-IN`, Marathi `mr-IN`. Transcription preserves
original-language Unicode, including Devanagari; no romanization or translation.

## Citizen workflow — IMPLEMENTED, mock TESTED

> **Historical (Stages 1–9, retired by Stage 14/DEC-041, 2026-10-19):** the
> single-shot recorder described in this section is no longer rendered. The
> current workflow is the two-mode intake in Stages 12–14: "Tell us your
> problem" (conversation) or "Fill the form manually" (plain text entry).

1. Select a language and record up to 30 seconds.
2. Stop, play back or re-record without contacting Sarvam.
3. Explicitly click Transcribe; choose Append, Replace or Cancel for a non-empty
   description before audio upload. Cancellation makes no transcription request.
4. Accept the transcript; reconfirm if the description changed while waiting.
   An empty title auto-fills when local extraction succeeds.
5. Review/edit both fields, then submit normally.

VoiceRecorder sits immediately below the existing description field. Recording,
playback, re-record/discard, localized feedback and explicit Transcribe controls
are implemented. All actions use type=button and never submit a grievance.
Renaming MediaRecorder WebM/MP4 to WAV is invalid: this implementation captures
PCM directly. The API helper supports FormData without forcing Content-Type;
the browser sets the boundary and existing JSON requests keep their JSON header.

## Manual Input and Voice Transcription — Field Behavior

> **Historical for the retired recorder surface (Stage 14/DEC-041).** The
> manual branch is now plain text entry; the voice branch owns recording and
> the conversational review is read-only.

| Situation | Expected behavior |
| --- | --- |
| Title empty, Description empty | Accepted transcript fills Description and generates a title when extraction succeeds. |
| Title manually entered, Description empty | Preserve the existing title; accepted transcript fills Description. |
| Title empty, Description manually entered | Offer Append, Replace and Cancel; generate a title only after transcript acceptance. |
| Both fields manually entered | Preserve the title; offer Append, Replace and Cancel for Description. |
| User cancels replacement | Preserve both existing fields. |
| Transcription fails or is discarded | Preserve both existing fields. |
| User edits a field during transcription | Protect the new edits; require reconfirmation where applicable. |

Recording alone never changes either field. Generated titles are editable.
Existing titles can only be replaced through the explicit "Use suggested title"
action and confirmation. Titles entered while transcription is pending are also
preserved. A changed description requires reconfirmation before insertion.

Stage 9 supports explicit **Append** or **Replace**: append preserves existing
text and adds the full transcript; replace substitutes the full transcript.
It does not semantically merge, summarize or deduplicate text. Weak transcripts may produce no title suggestion,
leaving the title for manual entry. No grievance is saved until Submit Grievance.
See the Stage 8 live-English record below for the successful seven-second test
and its accurate-but-conversational/lengthy title limitation; mocked multilingual
coverage is distinct from live validation.

## Architecture and data flow

### Frontend recording architecture (Stage 5)

An explicit click creates/resumes an AudioContext and requests getUserMedia
permission. AudioWorklet loads /voice-processor.js from Next.js public assets.
The processor starts only after a Start message, averages input channels into
mono, and transfers batches of at most 2048 Float32 samples to the main thread.
Its silent output passes through zero gain: microphone audio is never monitored.
Both a 30-second timer and a sampleRate*30 worklet frame cap stop capture. The
worklet cap still bounds recorded audio if browser main-thread timers are delayed.

VoiceCapture stores a fixed maximum of 30 seconds at source rates 8–96 kHz
(at most 11.52 MB of Float32 samples at 96 kHz). It flushes on Stop, releases
microphone tracks/ports/nodes/context before conversion, then resamples with
a 32-tap Hann-windowed sinc low-pass filter to 16 kHz. At 16 kHz no resampling
is needed. encodeWav clamps samples, writes little-endian signed 16-bit PCM and
the exact 44-byte classic RIFF/WAVE header. Output is capped to 480000 frames
and 960044 bytes, below the backend's 1 MiB file limit. Conversion runs on the
main thread and may briefly occupy it on slower devices; speech quality is not
validated. Synthetic DC/tone tests cover counts and alias suppression, and the
generated maximum-length WAV passes the actual Python validator.

### Browser compatibility and accessibility

Requires a secure context (HTTPS or trustworthy localhost), getUserMedia,
AudioContext, AudioWorkletNode and audioWorklet.addModule. Intended for modern
Chrome/Edge, Firefox and Safari. Stage 7 includes isolated headless Chrome/Edge
probes; full device/assistive-technology validation remains pending (see below).
No deprecated ScriptProcessor fallback or recording
library is added. Unsupported browsers retain the typed form and show clear
feedback. Microphone denial, absent/busy devices and processor failures are handled.
The spoken language selector is independent of interface language, defaulting to
its en/hi/mr value. English/Hindi/Marathi labels, keyboard-operable buttons,
native audio controls, polite status announcements and alert errors are included.
See [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
and the installed Next.js Client Components/public-folder guides.

### Transcription lifecycle and replacement confirmation

No audio upload occurs until an explicit Transcribe click. The API client sends
the access JWT, WAV, selected language and a cryptographically generated unique
idempotency key per deliberate attempt; Zod validates the response. A 70-second
client deadline bounds upload/provider/refresh time. Only the existing 401 token
refresh path may resend the request, using identical body/key; no paid-request
retries occur for network/provider/429 errors. Cancellation during refresh does
not clear the stored session. Status-specific UI feedback is localized.

SubmitForm reads the current description using getValues. Non-whitespace text
requires a labelled native modal dialog with Append/Replace/Cancel BEFORE upload. Cancellation
preserves text and consumes no attempt. The description snapshot is checked again
when the result arrives: if it differs, another explicit choice protects newer
edits and uses the latest description. Confirmed insertion uses setValue with validation, dirty and touched state.
Failure never overwrites text; the transcript stays editable. Starting ordinary
form submission remounts the recorder, aborts its request/resources and prevents
late results from applying after reset. Title/image/location validation and the
submitGrievance payload/endpoint are unchanged.

### Frontend cleanup and privacy

Recordings and playback Blob URLs remain in memory; no localStorage audio/text
or automatic upload. Re-record/discard/unmount revoke URLs and pause playback.
The audio ref never removes React's src attribute or calls load() during ref
detach: React Strict Mode replays detach/attach when mounting a new player, so
that cleanup previously erased a valid new source and left duration NaN. The
StrictMode regression verifies nonempty PCM, preserved src across replay/renders,
and URL revocation only on real discard/unmount. The capture/encoder needed no change.
Capture cleanup stops microphone tracks, closes ports/context and clears timers;
late permission resolution after cancellation immediately stops newly granted
tracks. Navigation/discard aborts pending HTTP and ignores stale responses.
Abort after upload cannot cancel already-running provider billing; do not claim
cancelled in-flight requests consume no credits. If the main thread is suspended,
the worklet stops retaining samples at the cap, while hardware teardown awaits
the main thread's completion callback.

Browser WAV + JWT -> bounded body guard -> authenticated multipart router ->
PCM validation -> atomic attempt reservation -> Sarvam HTTPS -> bounded response
validation -> original-language transcript for human review. There are no
database writes. A short-lived process-local result supports idempotent replay.

## Sarvam API integration

Rechecked official documentation on 2026-10-13:

- POST https://api.sarvam.ai/speech-to-text, api-subscription-key header.
- Multipart file; model=saaras:v4, mode=transcribe, explicit language_code.
- Response: transcript, nullable language_code, optional/nullable request_id.
- Direct httpx.AsyncClient, no retries, redirects or environment proxies.
- Connection timeout 5 seconds, configurable 45-second total deadline.
- Maximum response 64 KiB and transcript 16000 characters. Errors are sanitized.

Sources: [REST reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe),
[Saaras guide](https://docs.sarvam.ai/api/getting-started/models/saaras),
[REST guide](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api),
[SDK guide](https://docs.sarvam.ai/api/getting-started/sdks).
The reference has a stale v3-only mode sentence; the current model guide supports
v4 transcribe. At that documentation check, no live verification was claimed;
the subsequent single English smoke test is recorded below. The numerical provider file-size
ceiling for synchronous REST remains unverified; application caps are independent.

## Backend endpoint contract

POST /transcribe with Authorization: Bearer <application-access-token>.
Exactly two multipart parts: one file and language_code=en-IN|hi-IN|mr-IN.
Extra/duplicate files/fields are rejected. Filename/MIME alone do not validate audio.
Optional Idempotency-Key: 1–128 ASCII letters, digits, underscore or hyphen.
Omitting the key starts a new attempt; use a new key only for an explicit new
transcription action. Keys are scoped to the verified JWT user.

Illustrative response, not a live result:

```json
{"transcript":"पाणीपुरवठा बंद आहे.","language_code":"mr-IN","request_id":"example-id"}
```

language_code may be null; request_id is omitted if absent. No invented confidence.

| HTTP | Flat `{"error":"..."}` response condition |
|---|---|
| 400 | Missing/extra fields, invalid key/language, empty/malformed/truncated/over-duration WAV |
| 401 | Missing/invalid/expired/wrong-type application access JWT |
| 408 | Upload deadline exceeded |
| 409 | Idempotency conflict, in-flight duplicate, failed/expired replay |
| 413 | File or complete body cap exceeded |
| 415 | Unsupported container or PCM properties |
| 429 | User time-window/active-user/global-concurrency limit; Retry-After included |
| 503 | Disabled/missing/invalid configuration, lifetime budget exhausted, provider auth/credit/rate error |
| 502 | Other upstream failure, malformed/missing/oversized provider transcript |
| 504 | Provider timeout; attempt may already have consumed credits |

When disabled the guard returns 503 before auth/parsing. When enabled,
get_current_user rejects invalid JWTs before multipart parsing. The complete-body
guard bounds bytes before routing, independently of authentication.

## Audio specifications and validation

Classic RIFF/WAVE PCM format tag 1, mono, 16-bit, 16000 Hz. At most 480000
actual frames (30 seconds); 480001 rejected. Maximum file 1 MiB; complete body
2 MiB. Settings can lower these three ceilings but cannot raise v1 caps.
Check RIFF sizes, all chunk boundaries/padding, one fmt/data pair, byte rate,
block alignment, complete non-empty frames. Reconstruct a clean PCM WAV without
metadata before forwarding. File reading is bounded; the guard checks both
Content-Length and actual chunks, including requests without Content-Length.
Multipart parsing permits one file, one field and 1 KiB text parts. Upload
deadline defaults to 15 seconds for the whole body.

## Environment setup

Keep SARVAM_API_KEY in backend/.env or Render's secret environment settings only.
Never in NEXT_PUBLIC variables, tracked source, test fixtures or logs. The task
does not edit backend/.env or enable live transcription.

| Variable | Default |
|---|---|
| SARVAM_API_KEY | empty secret placeholder |
| SARVAM_STT_MODEL | saaras:v4 (required in v1) |
| TRANSCRIPTION_ENABLED | false |
| TRANSCRIPTION_MAX_FILE_BYTES | 1048576 |
| TRANSCRIPTION_MAX_REQUEST_BYTES | 2097152 |
| TRANSCRIPTION_MAX_SECONDS | 30 |
| TRANSCRIPTION_USER_MINUTE_LIMIT | 3 |
| TRANSCRIPTION_USER_HOUR_LIMIT | 10 |
| TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT | 20 |
| TRANSCRIPTION_MAX_CONCURRENT | 2 |
| TRANSCRIPTION_IDEMPOTENCY_TTL_SECONDS | 300 |
| TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS | 15 |
| SARVAM_TIMEOUT_SECONDS | 45 |
| DIAGNOSTIC_SKIP_INITIALIZATION_WRITES | false; diagnostics only |

Root requirements.txt is the actual Render/local documented runtime manifest.
It now declares httpx/python-multipart and previously missing auth/SMS
dependencies from backend/requirements.txt. No FFmpeg or Sarvam SDK is required.
Use one worker/instance while limits are process-local.

## Authentication and security

Use existing get_current_user unchanged. Identity comes from the JWT, never a
multipart userId. It does not recheck current account activity; revocation is
not immediate. Existing CORS policy applies. The provider URL is fixed HTTPS;
clients cannot supply a URL, model, translation mode or credentials.
No audio, transcript, credentials, multipart content or raw upstream error is
logged by the integration. Configuration errors fail before a paid attempt.

## Privacy and audio retention

No audio is stored in MongoDB or permanent application files. UploadFile may
spool to an ephemeral temporary file; the form context closes it on success and
failure. The guard buffers a bounded body in memory. Many simultaneous uploads
can still use substantial memory: edge ingress limits are needed for public use.
Only short-lived transcripts, content fingerprints and attempt metadata exist
in process memory for replay; no raw audio is retained in the limiter.
Sarvam retention is separate: the official page states unset retention can be
indefinite and Model APIs support zero retention. Verify the workspace setting
before citizen live testing. [Retention](https://docs.sarvam.ai/api/platform/data-retention)

## Credit protection and operational limitations

Lock-protected reservations precede provider calls: 3/user/minute,
10/user/hour, 20/global/process lifetime, one active/user and two active globally.
Once reserved, failures/timeouts count; no automatic retries. Finally cleanup
releases active slots, including cancellation. Same-key/same-content completed
requests replay for 300 seconds from reservation. In-flight/conflicting/failed/
expired attempts return 409; a new deliberate action needs a new key.
Attempt tombstones are bounded by the lifetime budget and contain no audio.
Expired transcript caches are cleared on the next reservation (no background timer).

Temporary prototype architecture: restarts reset quotas, multiple workers have
independent budgets, and usage elsewhere shares provider credits. These limits
do not guarantee zero spend or a durable monetary ceiling. Keep auto-recharge
disabled and monitor the provider dashboard. Signup credit is INR 100 worth;
the 2026-10-13 documentation check listed base STT price INR 30/hour. These
historical figures are not current billing verification. The user later reported
99.94 credits before the blocked Hindi/Marathi session; no independent balance
check was performed. Handle both exhausted-credit 402 and quota 429, since docs differ.
[Credits/rates](https://docs.sarvam.ai/api/getting-started/ratelimits),
[Pricing](https://docs.sarvam.ai/api/getting-started/pricing),
[Billing](https://docs.sarvam.ai/api/platform/billing).

## Implementation file map

| File | Purpose |
|---|---|
| backend/app/routers/transcription.py | Auth, multipart validation, orchestration |
| backend/app/transcription_guard.py | Body cap and upload deadline |
| backend/app/services/audio_validation.py | WAV validation/reconstruction |
| backend/app/services/transcription_limits.py | Atomic local quotas/idempotency |
| backend/app/services/sarvam.py | Bounded mockable HTTP request |
| backend/app/main.py, config.py | Registration/settings |
| tests/test_transcription*.py, test_audio_validation.py | Mock integration, concurrency, boundaries |
| frontend/components/grievance/VoiceIntake.tsx | Conversational panel; spoken question playback, mute/replay, typed fallback; owns the intake hook |
| frontend/components/grievance/SubmitForm.tsx | Shared draft across modes; text-only manual branch; read-only voice review + photo/location/submit |
| frontend/lib/voice/{capture,audio}.ts | Capture lifecycle, bounded resampling and WAV encoding |
| frontend/public/voice-processor.js | AudioWorklet mono capture and frame cap |
| frontend/lib/api.ts, types.ts | Typed multipart STT, intake extraction, deadline, Zod contract |
| frontend/lib/i18n/voice.ts | en/hi/mr copy; hidden locale packs use English fallback |
| frontend/scripts/voice-*.test.mjs, voice-test-loader.mjs | Node mocks, actual React DOM in jsdom; `voice-e2e.test.mjs` is opt-in (`VOICE_E2E=1`) |

## Mock-testing instructions

Install requirements-dev.txt; from repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_transcription.py tests/test_audio_validation.py tests/test_transcription_limits.py tests/test_config_drift.py -q
```

Tests force the Sarvam key environment empty before app imports and inject only
a synthetic mock-only placeholder. Provider transport is MockTransport, never
the real network. Generated silent PCM validates handling, not recognition.
Execution commands/results are recorded in memory/CHANGELOG.md after testing.

Frontend uses the existing Node/TypeScript tooling plus development-only jsdom
for actual React DOM/form tests, not a new application framework/test runner.
In frontend/:

```powershell
npm.cmd ci
npm.cmd run test:voice
node scripts/check-contract.mjs
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Stage 5's 55 frontend tests mock browser microphone/worklet APIs and API responses;
no Sarvam request or citizen recording. Tests cover WAV/PCM/downmix/resampling,
30-second caps, permission/device errors, cleanup, language/Unicode, JWT refresh,
no retries, idempotency, replacement cancellation/new edits and normal submission
reset. Node's MockTimers API currently emits an experimental warning. Existing
21 contract checks also pass. Full lint has four pre-existing FaceCapture errors
and four existing warnings; targeted lint of Stage 5 files is clean. TypeScript
and production build pass. The owner reports real Chrome recording, playback,
re-record, discard and automatic 30-second stopping passed. Other browsers,
accessibility and speech recognition evaluation remain pending.

Description workflow validation (mock TESTED): nonempty text confirms before
the first API call; Cancel keeps text and makes zero transcription calls. Empty
English/Hindi/Marathi descriptions receive exact original-language transcripts
without confirmation. Existing text is replaced only after consent; network,
timeout and provider errors preserve it. Editing during a pending request,
including typing into an initially empty field, asks again before insertion;
cancelling that second prompt preserves newer text without another upload.
The disabled-feature message is expected for HTTP 503. It does not block the
pre-upload confirmation: test it with typed text and Cancel while the backend
stays disabled. Confirming permits the request but returns 503, so success and
post-response replacement checks use automated mock responses, not live Sarvam.

Playback fix verification (2026-10-13): a separate isolated headless Chrome check
decoded a synthetic two-second generated WAV into 32000 nonzero mono frames at
16000 Hz. HTML audio loaded metadata with duration=2, readyState=4 and playback
started. No real microphone, backend or transcription requests were involved.
The owner reports the following real Chrome microphone checks passed:
reload /submit, record 3–5 seconds, stop, wait for finite duration, play, re-record,
discard and repeat with the automatic 30-second stop. Keep Transcribe untouched;
verify no /transcribe requests and that the microphone indicator stops after Stop.

## Stage 6 cross-stack integration — mock TESTED (2026-10-13)

`tests/test_voice_e2e.py` starts a temporary loopback Uvicorn server and runs ten
opt-in scenarios from `frontend/scripts/voice-ui.test.mjs`. The actual public
AudioWorklet processor receives synthetic stereo samples; actual capture and
resampling generate nonempty mono 16-bit/16 kHz WAV. The actual React form and
frontend API send authenticated multipart HTTP to the production backend route,
validation and Sarvam service. Only the provider transport is mocked. Provider
assertions inspect the outgoing model, language and WAV (1600 nonzero frames).

English, Hindi and Marathi transcripts reach the description unchanged. Tests
verify confirmation before upload, cancellation with zero HTTP/provider calls,
consented replacement, and description preservation for disabled transcription,
provider failure, timeout and malformed responses. Missing/invalid authentication,
invalid/truncated WAV, missing multipart fields and oversized uploads are rejected
without provider calls. Repository creation is forbidden during the test and the
repository remains empty. Uploaded files are closed and named temporary spools
are removed; the service does not permanently store audio.

Configuration overrides and synthetic credentials exist only inside the test
process. Deployment transcription remains disabled. HTTP is restricted to the
temporary loopback origin and Python rejects external socket connections.

From the repository root (installed backend and frontend dependencies required):

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_voice_e2e.py tests/test_transcription.py tests/test_audio_validation.py tests/test_transcription_limits.py tests/test_config_drift.py -q
```

Verified: 80 pytest tests passed (including the cross-stack test's ten Node
scenarios); the ordinary frontend suite passed 55 tests. TypeScript and targeted
ESLint passed. Existing Starlette/httpx deprecation and Node MockTimers warnings
remain. No application integration defect was found; additions are test coverage.

This is loopback HTTP integration with jsdom and synthetic microphone input,
not a new real-browser microphone test. The owner-reported Chrome control tests
remain separate. Browser CORS/HTTPS/network behavior, other devices/browsers,
accessibility and live provider compatibility, recognition accuracy and latency
remain unvalidated. The expected disabled-feature 503 message prevents successful
live insertion, but does not prevent pre-upload confirmation/cancellation testing.

## Stage 7 browser integration/accessibility — partially TESTED (2026-10-13)

No production code defect was found. Added eight backend CORS regressions and
three frontend regressions for insecure-context rejection before permission,
labelled native controls/live status/playback name, and playback pause/URL
revocation on navigation unmount. Existing tests cover denied/unavailable/busy
microphones, missing APIs, granted capture, late permission, cleanup, alerts,
pending-request cancellation and confirmation ordering.

Final verification: **88 backend tests passed**, including ten Stage 6 Node
cross-stack scenarios and both opt-in browser probes; one existing Starlette/httpx
deprecation warning. **58 frontend tests passed**, zero failures/skips (existing
MockTimers warnings). TypeScript --noEmit and targeted ESLint passed. Earlier
probe attempts failed on sandbox renderer restrictions and test-harness keyboard,
permission and OPTIONS-count assumptions; these were corrected, not application
behavior changes.

Executed real headless Chrome **155.0.8059.39** and Edge **155.0.4283.45** with
temporary profiles, synthetic microphone hardware and loopback servers only:

- Authenticated multipart WAV POST generated OPTIONS preflight. Allowed origin
  read success/401/415/503 responses. Unlisted origin received a blocked
  preflight: no POST or provider invocation followed. Test-only allowlist
  overrides are restored; deployment/environment settings were not changed.
- HTTP localhost was a secure context with media/worklet APIs. A test hostname
  mapped to loopback over ordinary HTTP was insecure, with no mediaDevices.
  Explicit permission grant captured fake microphone tracks and stopped them;
  denial returned NotAllowedError. Real missing/busy-device conditions are
  covered with frontend mocks, not demonstrated using physical hardware here.
- Tab reached the labelled select then Start recording; Enter and Space each
  activated the native button. The existing build CSS produced a visible focus
  ring. Browser accessibility trees exposed button and selector names. Native
  confirm accepted/cancelled through CDP; dialog keyboard traversal was not tested.
- The actual frontend resampler/encoder generated a nonempty WAV that decoded
  to 1600 mono samples at 16 kHz (0.1 seconds), loaded native audio metadata and
  played in both browsers. Probe playback was paused and its URL revoked.

The probe serves **server-rendered recorder markup**, with a test click listener;
it does not hydrate the React component or test the complete Next.js page.
React state transitions, statuses/errors and navigation cleanup are verified in
jsdom. This distinction matters for dynamic keyboard focus and screen readers.
No actual screen-reader speech or physical microphone was exercised by the agent.
The owner's earlier Chrome recording/control pass remains separately recorded.

Run the opt-in probe and backend regressions from the root (Node/dependencies,
installed Chrome/Edge and existing frontend build CSS required):

```powershell
$env:VOICE_BROWSER_CHECKS='1'
.\.venv\Scripts\python.exe -m pytest tests/test_voice_e2e.py tests/test_transcription.py tests/test_audio_validation.py tests/test_transcription_limits.py tests/test_config_drift.py -q -s -p no:cacheprovider
Remove-Item Env:VOICE_BROWSER_CHECKS
```

In a restricted Windows sandbox, browser renderer commands timed out; executed
probes passed outside that sandbox. No production HTTPS was configured/deployed.
Secure-context checks do not verify a TLS certificate, deployed CORS origin,
HTTPS API connectivity or mixed-content blocking. Production requires trustworthy
HTTPS for microphone access, HTTPS API access from HTTPS pages, and the correct
frontend origin in the backend allowlist. HTTP localhost is suitable locally.

### Remaining manual checks and live-test readiness

Firefox is installed but no Firefox automation driver is available; no Firefox
checks were executed. Safari is unavailable on this Windows environment. Both
remain unverified. Chrome/Edge probes do not establish compatibility there.

1. On the actual /submit page, use only Tab/Shift+Tab/Enter/Space through recording,
   Stop, playback, re-record, discard and language selection. Verify visible focus
   and a usable focus destination when buttons become disabled or disappear.
2. Type a description, record, then Transcribe with the backend still disabled.
   Test native confirmation using keyboard accept/Cancel/Escape; cancellation must
   preserve text and send no POST. Acceptance should show the expected 503 message.
3. With NVDA/Narrator (and VoiceOver on Safari), verify names, language options,
   status/error announcements and playback controls. Check announcement frequency
   during recording and keyboard access to the native audio controls.
4. While recording, playing and awaiting permission/transcription, navigate away;
   verify the microphone indicator, playback and requests stop without stale text.
5. Repeat supported-browser/device checks and test an existing HTTPS environment
   with a mock provider, including mixed-content/CORS behavior; do not deploy TLS
   or enable live transcription just to run these checks.

Automated Stage 7 checks passed, but Stage 7 is **not fully VALIDATED or ready for
final live sign-off** while these manual gaps remain. No live permission is
implied. Any later paid smoke test needs separate authorization and the existing
live-testing checklist; feature configuration remains disabled.

## Stage 8 automatic title suggestions — IMPLEMENTED and mock TESTED

`frontend/lib/voice/title.ts` is a pure, deterministic extractive helper. It
normalizes whitespace, recognizes sentence punctuation including danda (।) and
decimal numbers, skips a small en/hi/mr greeting/filler list and selects the first
usable phrase. Original issue wording/script is retained. Titles are bounded to
12 words/80 graphemes; after safe introductory trimming, oversized clauses now
abstain instead of clipping potentially important meaning (see Stage 9 refinement).
Empty,
greeting-only, single-word/unusable input or missing Intl.Segmenter returns null.
No translation, inferred location, urgency/severity, external service or model.

Only an accepted transcript invokes the helper. SubmitForm retains the complete
transcript in the description, checks the title's current value at response time,
and fills it only when whitespace-empty. Existing titles (including in-flight
edits and previous generated titles) remain intact. A localized suggestion and
non-submit "Use suggested title" button offer explicit replacement, with native
confirmation for a nonempty current title. Cancel keeps the title. Suggestions
are hidden after description edits and checked against the accepted description
again when applied. Both fields remain editable; setValue updates validation,
dirty and touched state. Successful submission clears suggestion/form state.

Existing description confirmation, cancellation, error and stale-response guards
run before title generation. No added requests, backend changes or draft storage.
Grievance submission and subsequent department/priority processing are unchanged;
that processing still receives the final citizen-reviewed title and description.

Verified 2026-10-13: **82 frontend tests passed**, zero failed/skipped; TypeScript
--noEmit and targeted ESLint passed without warnings. 24 added cases cover
English/Hindi/Marathi, greeting/filler/whitespace/punctuation, decimal preservation,
grapheme/word bounds, long negation abstention, unsupported segmentation, empty
versus pending-edited titles, explicit replacement/cancellation, re-transcription,
description edits, failed/cancelled/discarded/stale results, editable fields and
validation/submission/reset. Existing Node MockTimers warnings remain.

Hydrated mocked Chrome/Edge functional validation passed (see below); this is
not a claim of live recognition or
native-language quality validation. Check automatic fill, explicit replacement
confirmation, keyboard/focus and screen-reader announcements on the actual page
with mocked transcription in all three languages. The heuristic is not semantic
summarization: greeting lists/negation recognition are finite, the first usable
phrase may not describe the main issue, and selecting one sentence can omit later context. Citizen
review remains necessary. Older browsers without Intl.Segmenter retain typed title
entry and the full transcript. Live Sarvam remains disabled.

### Stage 8 hydrated browser validation (2026-10-13)

`frontend/scripts/voice-title-browser.test.mjs` drives the actual running Next.js
`/submit` page in headless Chrome 155.0.8059.39 and Edge 155.0.4283.45. No static
markup substitute, source-loader React mock or alternate form is used. The real
hydrated React handlers, React Hook Form, AudioContext/AudioWorklet, WAV capture
and frontend transcription API run. Browser fake microphone hardware supplies
audio; CDP fulfills `/transcribe` at the HTTP boundary with contract-shaped mock
transcripts/errors, including a held response for in-flight edits/discard. Session
and API reads are mocked; synthetic tokens exist only in temporary browser profiles.

**12 scenarios passed per browser (24 total)**: English/Hindi/Marathi empty-title
fill with complete descriptions; manual title preservation; explicit replacement
Cancel/Confirm; editing both generated fields; title typed during pending request;
re-transcription preservation; failed transcription; pre-upload cancellation; and
discard with a late/aborted response. Each browser made **nine mocked multipart
transcription requests**, with **zero grievance submissions and zero other writes**.
API requests are fulfilled/blocked before transport: no backend, database or
Sarvam provider was contacted. This validates frontend UI integration, not the
provider service/JWT/backend contract already covered separately in Stage 6.

Run against an existing current-source Next.js dev server on trustworthy localhost:

```powershell
cd frontend
$env:VOICE_PAGE_URL='http://127.0.0.1:3000'
node scripts/voice-title-browser.test.mjs
Remove-Item Env:VOICE_PAGE_URL
```

Installed Chrome/Edge, Node 22+, and permission to run headless browsers are
required. The owner's existing dev server was reused without stopping it or
changing environment files. Temporary profiles were removed. Final ordinary
frontend suite: **82 passed**, zero failed/skipped; TypeScript and targeted lint
passed. No application changes were needed; an initial harness-only assertion
incorrectly expected all unrelated form buttons to be enabled and was removed.

Limitations: headless Chromium on Windows with fake hardware and mocked API
responses; no Firefox/Safari, physical microphone, assistive-technology speech,
keyboard-only workflow, native-speaker quality evaluation or production HTTPS
validation in this run. Trusted CDP typing exercises actual RHF events; button
activation uses browser DOM clicks rather than a keyboard-only interaction pass.
Existing heuristic/Stage 7 manual limitations and live-call authorization remain.

### Stage 8 controlled live English test — user-verified (2026-10-14)

The user reports **one successful live English Sarvam STT request**, using a
**7-second real microphone recording**. The complete transcript populated
Description, and the frontend deterministic extractor automatically populated
Issue Title. Both fields remained editable. **No grievance was submitted.**
The user confirmed restarting the backend with **TRANSCRIPTION_ENABLED=false**
afterward. This documentation-only session did not independently inspect the
running flag, make another provider call or enable transcription.

Title quality limitation: the generated title was **accurate but conversational
and lengthy**. Successful automatic fill does not establish concise headline
quality; citizen review/editing remains necessary. Title refinement is a future
task, not an application change made during this documentation update.

This is a single live **English smoke test**, distinct from the previously passed
mocked English/Hindi/Marathi utility, form, cross-stack and hydrated browser tests.
**Live Hindi and Marathi remain unvalidated.** No transcript, title text, audio,
credentials, numerical recognition score, latency or billing amount is recorded.
One success does not establish general recognition accuracy, broad multilingual
compatibility or production readiness. Other browser/accessibility and provider
account/retention checks remain pending unless separately verified.

## Stage 9 Append Transcription — IMPLEMENTED and mock TESTED

This is a newly owner-authorized enhancement, not a recovered definition from
an original 11-stage roadmap. Nonempty descriptions offer localized Append,
Replace and Cancel buttons in a native modal dialog. Cancel is initially focused;
Escape cancels. Replace is the explicit confirmation of destructive replacement.
Empty descriptions still accept the transcript without a pre-upload chooser.

Append preserves the existing description exactly and adds the full accepted
transcript. It inserts two newlines unless the description already ends in
whitespace, which is retained as the separator. No translation or deduplication.
Any description change while waiting triggers another choice based on latest
text, even if initially empty. Programmatic edits while choosing are checked
again before insertion. Post-response choices make no additional upload.

Async choices share the recorder's AbortSignal. Discard/navigation/reset resolves
pending choices as cancellation; epoch/signal checks prevent stale field changes.
Existing/manual/in-flight titles remain protected. Title extraction runs only
after transcript acceptance, using the transcript; suggested-title visibility
is bound to the resulting combined/replaced description. Submission/backend/STT
configuration are unchanged; live transcription stays disabled.

Initial implementation verification: **94 frontend tests passed**, zero failed/skipped; TypeScript,
targeted ESLint and git diff --check passed. Twelve additional tests exercise
append in en/hi/mr, separator preservation, latest-text Append/Replace/Cancel,
edits while choosing, Escape cancellation and abort while awaiting a choice.
Existing empty-description, replacement, title, errors, stale-result and normal
submission tests still pass. The existing mock cross-stack test passed (one
pytest test containing ten Node scenarios). Only existing MockTimers/Starlette
warnings remain. Prior Stage 8 browser harness was adapted for the new chooser
but not re-executed during that initial implementation; the follow-up below
records actual hydrated Stage 9 browser validation.

Modern native HTML dialog support is required. Existing field length/submission
validation still applies to an appended description. Use mocks for additional
checks and keep Sarvam disabled.

### Stage 9 hydrated browser follow-up (2026-10-14)

Executed the actual hydrated Next.js /submit harness in headless Chrome
**155.0.8059.39** and Edge **155.0.4283.45** with fake microphone hardware and
intercepted API responses. **25 scenarios passed per browser (50 total)**,
including 12 prior Stage 8 regressions and 13 Stage 9 checks per browser:

- Empty-description insertion without opening a chooser; nonempty descriptions
  display all three choices. Append retains original text/full transcript,
  Replace uses the full transcript, Cancel preserves both fields/zero uploads.
- Enter/Space activation, forward Tab wraparound, initial Cancel focus, visible
  focus ring and return to Transcribe (or editable Description while Transcribe
  is disabled during upload). Reverse Tab wraparound also has a unit regression.
- English/Hindi/Marathi chooser labels and dialog accessible name/description
  in the browser accessibility tree; Escape cancellation in all three locales.
  Polite status semantics and accepted-transcript status text verified.
- In-flight description edits require a new Append/Replace/Cancel choice on
  latest text, without another upload; manual titles preserved.
- Client-side navigation during recording stops tracks; during playback pauses
  audio/revokes its Blob URL; during pending transcription prevents late insertion.

Each browser made **16 mocked multipart transcription requests**, with **zero
grievance submissions/other application writes**. Next.js diagnostic POSTs were
intercepted separately (five Chrome/four Edge) and never reached transport; these
are not backend/database writes. API/session requests were mocked before transport,
and no backend/provider was contacted by the harness. The configured backend flag
was independently read as false without displaying credentials or changing it.

Confirmed/fixed Stage 9 regressions: Strict Mode effect replay prematurely resolved
Cancel; cleanup now distinguishes replay from genuine unmount. Native Tab could
leave the chooser and removal lost focus; explicit Tab/Shift+Tab boundary wrapping
and safe focus return were added. Three focused unit regressions cover replay,
focus wrapping/cancellation return and disabled-opener fallback. The replay test
failed before the fix and passed afterward. **97 frontend tests passed**, zero
failed/skipped; TypeScript, targeted ESLint and git diff --check passed. Existing
MockTimers warnings remain. No backend/API/configuration changes.

**NOT TESTED:** Firefox (installed, no automation driver) and Safari (unavailable
on Windows). Accessibility-tree/DOM assertions are automated, not actual manual
NVDA/Narrator/VoiceOver speech testing. Remaining: actual screen-reader announcements,
physical microphones/mobile devices, native-speaker copy review, whole-page
keyboard-only flow and production HTTPS. Dialog keyboard activation is automated;
some setup/navigation actions use DOM clicks. Live Hindi/Marathi remain unvalidated;
the earlier single live English result is separate, not repeated here.

### Stage 9 concise title refinement (2026-10-14)

The frontend helper now removes a small anchored set of reporting/existence
introductions: "There is/are", "I want/would like to report [that]", Hindi
"मैं बताना/शिकायत करना चाहता/चाहती हूँ कि", and Marathi
"मला सांगायचे/तक्रार करायची आहे की". It changes only the candidate title,
not the full accepted description or append/replace behavior. Issue wording,
ownership/location, explicit quantities and negation remain intact. Article
removal retains quantity phrases such as "a few", "a little", "a lot" and
"a number". Decimal punctuation recognizes Unicode digits, including Devanagari.

After trimming, a complete phrase must fit the existing 12-word/80-grapheme
bounds. If not, return no suggestion instead of cutting off a location, count,
negation or qualifier. This deliberately produces fewer suggestions for long
clauses. No model, translation, inferred urgency or backend/API change.

Representative before/after fixtures (the exact live street-light wording was
not recorded; these are **not quotations from the live test**):

| Before | After |
| --- | --- |
| There is a broken street light near my house | broken street light near my house |
| No suggestion for the overlong "I want to report that two street lights near Gate 3 are not working" | two street lights near Gate 3 are not working |
| मला सांगायचे आहे की आमच्या गल्लीत तीन दिवे चालू नाहीत | आमच्या गल्लीत तीन दिवे चालू नाहीत |

Verified: **113 frontend tests passed**, zero failed/skipped; TypeScript,
targeted ESLint and git diff --check passed. Sixteen added unit/form regressions
cover the representative street light, reporting phrases, Hindi/Marathi,
quantities/negation, decimal and sentence punctuation, long-input abstention,
complete description retention and manual-title replacement confirmation.
Hydrated Chrome 155.0.8059.39 and Edge 155.0.4283.45 each passed **26 scenarios**
(52 total), including the new street-light fixture and updated Hindi/Marathi
reporting fixtures alongside Stage 8/9 safeguards. Each made 17 mocked uploads,
zero grievance submissions/application writes; no backend/provider contacted.
Next.js diagnostic requests were separately blocked. Existing MockTimers warnings
remain. No new live test or live Hindi/Marathi validation was performed.

Limitations: finite anchored phrases, no semantic summarization or grammar repair;
unrecognized introductions remain and the first usable sentence may omit later
issue details. Long clauses can leave title empty, requiring manual entry.
Native-speaker quality review, actual assistive-technology speech, physical/mobile
devices and Firefox/Safari remain unvalidated. Citizen review/editing stays required.

## Further live-testing checklist — PLANNED

1. Obtain explicit live-call authorization; check branch, account balance and plan.
2. Verify Model API retention and auto-recharge settings.
3. Use one worker/instance, conservative quotas and HTTPS ingress.
4. Enable only the authorized environment with the operator secret.
5. Test short consenting/non-sensitive English, Hindi and Marathi samples.
6. Review Devanagari, dialect/code-mixed speech, latency and dashboard usage.
7. Disable afterwards; record outcomes without keys/audio/transcript logs.

## Known limitations and future improvements

### Stage 10 diagnostic initialization guard (2026-10-14)

`DIAGNOSTIC_SKIP_INITIALIZATION_WRITES` defaults to false. When true, all nine
MongoDB repositories skip initialization index commands (including conflict-driven
drops/rebuilds), SLA default seeding, and main startup seeding/backfill. Repository
objects still initialize. Normal behavior is unchanged when false. This is **not
a read-only API mode**: endpoint writes and authorization remain unchanged. Face
startup validation/warmup remain unchanged. Do not submit/register/edit data during
the diagnostic session.

The read-only users index audit found a unique but non-sparse email index and
missing phone/citizen-ID indexes; ordinary initialization can modify these indexes.
`--lifespan off` alone cannot suppress import-time writes. Both original and
expanded trusted-CA bundles eventually passed read-only ping; TLS failure remains
intermittent. Citizen account existence was verified, but restored browser login
and live Hindi/Marathi remain pending. No backend restart was performed for this
guard implementation.

After separately authorizing shutdown of the current disabled backend, this exact
PowerShell command is the corrected proposal for one guarded worker from the repository root; it has not successfully launched a backend. All
overrides remain inside the child process. It validates the previously verified
temporary CA bundle, preserves unrelated URI options, and fails before serving if
authentication is not MongoDB-backed or reads fail. Do not print full connection
exceptions or replace a missing bundle with unverified certificates.

```powershell
@'
import os, logging, hashlib
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
os.environ['DIAGNOSTIC_SKIP_INITIALIZATION_WRITES'] = 'true'
os.environ['TRANSCRIPTION_ENABLED'] = 'false'
logging.disable(logging.CRITICAL)
try:
    from backend.app import config
    bundle = Path(os.environ['TEMP']) / 'grievai-mongodb-trusted-ca-41ld381s.pem'
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == (
        'd74661f3384c19287386d1836b2d402ab4e426478cafd54c0e0916d16006eb85'
    )
    parts = urlsplit(config.MONGODB_URI)
    tls_keys = {'tls', 'ssl', 'tlscafile', 'tlsinsecure',
                'tlsallowinvalidcertificates', 'tlsallowinvalidhostnames'}
    options = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
               if k.lower() not in tls_keys]
    options += [('tls', 'true'), ('tlsCAFile', str(bundle)),
                ('tlsAllowInvalidCertificates', 'false'),
                ('tlsAllowInvalidHostnames', 'false')]
    config.MONGODB_URI = urlunsplit(parts._replace(query=urlencode(options)))
    os.environ['MONGODB_URI'] = config.MONGODB_URI
    from backend.app.main import app
    from backend.app.users_db import users_repository, MongoUsersRepository
    from backend.app.routers import auth
    assert isinstance(users_repository, MongoUsersRepository)
    assert auth.users_repository is users_repository
    users_repository._col.database.client.admin.command('ping')
    assert users_repository._col.find_one(
        {'email': 'citizen@grievance.local'}, {'_id': 1}
    ) is not None
    assert config.TRANSCRIPTION_ENABLED is False
    print('MongoDB auth verified; citizen exists; transcription disabled.')
except Exception as exc:
    print('Diagnostic startup refused:', type(exc).__name__)
    raise SystemExit(1)
import uvicorn
uvicorn.run(app, host='127.0.0.1', port=10000, workers=1,
            reload=False, lifespan='off', access_log=False, log_level='error')
'@ | .\.venv\Scripts\python.exe -B -
```

After startup, check GET `/health` and frontend availability, then ask the citizen
to retry their existing login in their own browser. Do not request credentials or
capture tokens. `/health` alone reports configured grievance storage; the launcher
assertions verify the actual authentication singleton and read-only connectivity.
This implementation does not authorize another enabled transcription process.

Frontend is IMPLEMENTED and mock TESTED; Chrome controls passed owner-reported
checks. One user-verified live English request succeeded (see Stage 8 record).
Other browser/device compatibility, live Hindi/Marathi, broader provider
compatibility, recognition accuracy, latency and billing remain unvalidated.
Generated titles can still be conversational/lengthy for unrecognized introductions;
the Stage 9 refinement improves a small set of reporting phrases only.
No shared/durable usage accounting, balance polling,
IP limiter or provider circuit breaker. Future: shared limits, compressed-audio
decoding, accessibility, dialect evaluation and optionally approved translation
while retaining the original transcript.

Diagnostic guard validation: 25 focused mocked tests; final relevant backend suite
105 passed (one existing Starlette/httpx deprecation warning). Python compile and
launcher syntax checks and git diff --check passed. Broader exploratory tests had
10 legacy status failures, all reproduced without the new guards in memory.
Ruff/mypy unavailable; no dependency installation. Backend restart remains pending.

## Stage 11 final handoff ? actual state, 2026-10-14

Implementation of recording, authenticated STT, multilingual drafting, title
suggestions, Append/Replace/Cancel and initialization-only diagnostics is complete.
This is IMPLEMENTED/mock TESTED, not a production-readiness or multilingual speech
accuracy claim. The owner-designated Stage 11 documents the implemented work;
no original complete eleven-stage roadmap was recovered earlier, so this section
does not invent historical stage objectives. See [HANDOFF_SUMMARY.md](../HANDOFF_SUMMARY.md) for the teammate checklist.

### Current authentication blocker and failed launches

Read-only MongoDB DNS/TCP and verified TLS checks succeeded. PyMongo also produced
ServerSelectionTimeoutError with CERTIFICATE_VERIFY_FAILED / unable to get local
issuer certificate on earlier attempts. Standard Python trusted more CAs than the
inherited PyMongo bundle. A temporary bundle exported from existing trusted CAs
passed ping and existing-citizen lookup; a later original-bundle ping also passed.
Thus the TLS failure is intermittent, not proved to be a single missing root or
Atlas IP-allowlist failure. Do not disable TLS/hostname checks or reset accounts.

Authentication can fall back to empty in-memory storage if its import-time
initialization fails; /health only describes configured grievance storage. Actual
running authentication type was never conclusively verified. The read-only users
index audit confirmed that ordinary initialization could modify shared indexes.
The default-off diagnostic guard prevents those initialization commands and seeds,
but does not make endpoints read-only or automatically verify repository reachability.
Leave it **false in normal operation**, where expected index/default initialization
must continue; diagnostic sessions must avoid data-changing endpoints.

The old disabled backend was stopped. The first guarded launch exited with
ModuleNotFoundError because a temporary script lacked the repository import path.
That path was corrected. The one authorized retry exited with InvalidURI because
PyMongo forbids tlsInsecure alongside tlsAllowInvalidCertificates, even when both
values are false. No listener remained on port 10000 at the last verification;
frontend /submit returned 200 before that retry. MongoDB-backed browser login is
NOT restored; the guarded server never successfully started. No Hindi/Marathi
provider request was made. The earlier two-attempt budget remained unused.

The guide's proposed launcher above now omits tlsInsecure while retaining TLS,
CA verification and hostname verification. This documentation correction was
syntax/configuration-checked offline, **not run against MongoDB or used to restart**.
The temporary launcher outside the repository still contains the incompatible
options and must be explicitly reviewed/corrected before any authorized next start.
Its bundle/path are machine-specific and not a portable deployment configuration.

### Final source and configuration inventory additions

- frontend/components/grievance/TranscriptionChoice.tsx: native accessible action
  dialog, focus/Escape behavior; frontend/lib/voice/title.ts: conservative extraction.
- frontend/app/submit/page.tsx: existing page composing SubmitForm; no new route.
- frontend/lib/i18n/voice.ts and locale packs: voice labels/copy; other interface
  languages fall back to English voice copy, not additional spoken-language support.
- frontend/scripts/voice-title-browser.test.mjs and voice-browser-check.mjs:
  historical hydrated/isolated Chrome/Edge mock browser harnesses.
- tests/test_voice_e2e.py: real loopback frontend/backend path with mocked Sarvam;
  tests/test_diagnostic_initialization.py: 25 mocked initialization guard cases.
- backend/app/{db,users_db}.py and repositories/{audit,departments,face_templates,
  notifications,otp_codes,progress,sla_config}.py: initialization guards.
- backend/.env.example, root requirements.txt, backend/requirements.txt,
  frontend/package.json/package-lock.json, render.yaml: setup/deployment surfaces.
- NEXT_PUBLIC_API_URL (localhost:10000 locally), NEXT_PUBLIC_USE_MOCKS=false for
  real application API integration, MONGODB_URI/MONGODB_DB, JWT_SECRET_KEY and
  explicit CORS_ORIGINS are prerequisite existing settings. Never expose Sarvam
  or MongoDB secrets in frontend variables. USE_MOCKS does not mock STT.
- Existing auth endpoints POST /auth/login, POST /auth/refresh and GET /auth/me;
  GET /health for liveness/configured storage; POST /transcribe drafts only;
  POST /submit-grievance alone persists an ordinary accepted complaint.

### Integration, deployment and teardown

Review the complete working tree and include required new source/tests/docs;
copying only tracked diffs omits untracked voice files. Install frontend lockfile
with npm ci and backend runtime requirements plus requirements-dev.txt for tests
in an isolated environment. Use existing /submit and authenticated citizen flow.
First validate with mocked transports and transcription disabled. Do not run the
hydrated harness without reviewing its interception prerequisites; it needs a
running frontend, uses fake media/JWTs, and is not a live provider or login test.

Keep TRANSCRIPTION_ENABLED=false and DIAGNOSTIC_SKIP_INITIALIZATION_WRITES=false
for ordinary deployments. Only a separately authorized operator may configure a
backend-only provider secret and explicitly enable STT. Verify account retention,
auto-recharge, available credits and allowed attempt count first. Use a single
worker/instance with bounded quotas; restarts reset budgets. After any approved
live window, stop the enabled process and start with transcription false, then
verify disabled behavior. Previously unused authorization is not blanket permission
to start another live session. No live enablement occurs during handoff.

Production requires secure HTTPS for page/API, correct credentialed CORS allowlist
and Authorization/Idempotency-Key preflight headers, gateway upload/time limits,
verified TLS trust and durable shared quotas before scaling. Do not deploy the
Windows temp bundle, diagnostic launcher or diagnostic flag. Build the frontend
with its correct API URL; no Sarvam browser SDK or FFmpeg is required. Existing
root auth/SMS dependency additions are adjacent deployment fixes that need review,
not a separate voice backend. No production deployment/build was performed here.

### Evidence ledger and Git review

- Stage 6 historical: 80 backend tests, 55 frontend tests and 10 mocked cross-stack
  scenarios passed. Stage 7 historical: 88 backend / 58 frontend tests including
  synthetic Chrome/Edge CORS/preflight/permission probes passed.
- Stage 9 historical hydrated Chrome 155.0.8059.39 and Edge 155.0.4283.45: each
  26 scenarios passed (52 total), 17 intercepted multipart uploads per browser,
  zero grievance submissions/application writes. These were automated fake-device
  checks, not manual assistive-technology speech or live STT.
- Owner-confirmed real Chrome microphone recording/playback/re-record/discard and
  automatic 30-second stop passed. One seven-second live ENGLISH request passed:
  complete editable description and editable title, no grievance submitted; owner
  confirmed transcription disabled afterward. No live Hindi or Marathi validation.
- Latest backend guard suite: 105 passed, including 25 focused cases; one existing
  Starlette/httpx deprecation warning. Broader exploratory run: 182 passed / 10
  legacy grievance-status failures; all ten reproduced with guards removed in
  memory. No unrelated workflow repairs. Ruff/mypy unavailable.
- Stage 11 rerun: frontend voice suite 113 passed, zero failed/skipped (5.139s);
  TypeScript --noEmit --incremental false and targeted ESLint passed. MockTimers
  experimental warnings only. npm.ps1 was blocked by PowerShell policy; npm.cmd
  ran successfully without changing policy. Browser/backend suites not rerun here.
- Review of added tracked diff and untracked text found no URI/private-key/token
  credential patterns; no tracked private env/key files were identified. This
  bounded pattern scan is not a full secret-history audit. Existing built-in demo
  credentials and historical security tasks remain; do not copy their values.
- Untracked artifacts/grievai-feature-aarohi-source-2026-10-13.zip is a stale
  242-entry snapshot. ZIP path audit found zero .env/.venv/node_modules/private-key
  paths; contents were not exhaustively secret-scanned. Do not stage or use it as
  the final source handoff. Generated/temp files were not deleted or changed.
- No unrelated functionality was changed during Stage 11. Existing dependency,
  localization, setup/deployment and memory changes remain in the working tree.
  SESSION_LOG has a pre-existing change and must remain untouched/unstaged.

Remaining: controlled MongoDB-backed login restoration; corrected launcher runtime
verification; separately authorized live Hindi/Marathi tests; native-speaker title
quality; manual screen-reader and full keyboard flow; physical/mobile devices;
Firefox/Safari; production HTTPS/CORS and load/shared-quota validation. Feature is
safe to hand off **for review and continuation**, not ready for an unreviewed merge
or production deployment. No commits, pushes, merges or branch changes occurred.

---

## Stage 12 — Conversational two-mode intake (DEC-038) — IMPLEMENTED, mock TESTED, live typed-path E2E passed (2026-10-18)

### What this stage adds

The submit page now offers two modes over one shared draft (`IntakeModeToggle`):

1. **"Tell us your problem" (voice-assisted card, orange primary styling):** a
   guided conversation. The citizen speaks (the existing Sarvam
   `POST /transcribe` contract) or types; each turn is extracted into draft
   fields; at most one focused follow-up question is asked at a time; when
   enough is known, the ordinary form fields appear in a review block with
   "AI suggestion" badges and the citizen confirms via the normal submit button.
2. **"Fill the form manually":** the Stage 4–9 form unchanged (recorder, title
   suggestion, append/replace/cancel) and still the default branch.

The modes share one React Hook Form draft: switching mid-conversation never
loses typed or extracted content, and a citizen edit is never overwritten by a
later extraction. No grievance schema changes; submission still goes through
`POST /submit-grievance`, whose classifier cascade remains authoritative.

### Backend — `POST /grievance-intake/extract` (stateless, JWT required)

Request JSON: `utterances` (1–8 items, ≤ 1000 chars each, ≤ 4000 total),
`language` (`en-IN`|`hi-IN`|`mr-IN`), optional `draft` snapshot
(`title` ≤ 120 / `description` ≤ 4000 chars, advisory context only) and
`asked_questions` (last 3, ≤ 300 chars each, advisory). Response JSON:
`{ title, description, location_text, category, priority, question }` —
category ∈ the eight canonical keys (aliases normalized), priority ∈
low|medium|high, all fields nullable and all ≤ their field caps.

> **Superseded by Stage 13 (DEC-039):** `question` (free text) is now
> `question_kind` (one of eight fixed kinds, or null) and `asked_questions`
> carries kinds rather than wording. The Stage 12 history below is preserved;
> see Stage 13 for the current contract.

The service builds a strict-data prompt (framework-derived instructions, "never
invent", one-question policy), calls Groq with the configured model then the
verified fallback list, and deterministically post-validates (never trusts the
model). Deep validation lives in the service so every rejection is a uniform
`400`; failures are `503` (not configured), `504` (provider timeout, 25 s) and
`502` (other provider failure). There are **no database writes and no
idempotency cache** — the call is a pure transformation; the frontend's submit
lock and state guards prevent duplicate conversation turns.

### Frontend architecture

- `lib/voice/intake.ts` — pure state machine
  (`idle → listening → transcribing → processing → awaiting_answer →
  ready_for_review`, plus `error` with `failedStep`), reducer guards for illegal
  or concurrent transitions, `planNextStep` question policy, `computeLocks` /
  `mergeExtraction` merge rules, `intakeStep` progress mapping.
- `components/grievance/VoiceIntake.tsx` — `useVoiceIntake` (owned by
  `SubmitForm` so the conversation survives mode switches; side effects:
  recording, STT, extraction, abort/epoch guards, deferred cancel on submit)
  and the presentational panel: progress pills, spoken-language selector,
  level meter (AnalyserNode tap), transcript log, question card, retry /
  cancel / skip controls, "Switch to manual form".
- `SubmitForm.tsx` — mode toggle at the top, voice branch with the review block
  (`AiSuggestionBadge`, classification note, image + location capture, submit
  lock, `intake.reset()` on success). Both branches are inside the outer form;
  every new button is `type="button"` and typed-answer Enter is handled
  manually (no nested forms).
- `LocationCapture.tsx` — `suggestedSearch` prop: a vocally described place
  seeds the search box and shows structured locality/city/state matches in the
  spoken language; choosing one stays explicit. Map taps and short clicks place
  a pin directly, while map pans and marker drags remain distinct. Voice never
  auto-pins a location and GPS is never used by the conversation. Search stays
  explicitly user-triggered rather than per-keystroke autocomplete, per the
  [public Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- `lib/api.ts` `extractVoiceIntake` (JSON, 45 s client timeout, Zod-validated);
  `lib/voice/errors.ts` shared error mapping; new i18n keys complete in
  en/hi/mr.
- Question policy: ask ≤ 1 question per missing kind — usable description
  (≥ 20 chars), explicit location, and at most ONE optional AI clarification;
  every question is skippable and one at a time.
- Merge policy: AI fills only empty fields; content typed by the citizen is
  locked (RHF `dirtyFields` + AI-fill tracking with
  `setValue(..., { shouldDirty: false })`); AI-owned fields may be refreshed by
  later turns. Editing an AI-filled field removes its badge and locks it.
- Concurrency/duplicate protections: a single `busy` ref serializes
  transcribe/extract, state guards reject invalid transitions, an epoch counter
  aborts stale results, in-flight work is cancelled when navigation/submission
  starts, and a submit lock rejects double submissions.

### Test coverage (mock-based)

- Backend: `tests/test_voice_intake.py` — 21 focused tests (validation caps,
  language whitelist, unconfigured 503, timeout 504, provider failure 502,
  strict-JSON compliance, alias normalization, prompt containment).
- Frontend: `scripts/voice-intake.test.mjs` (13: planner, reducer guards,
  merge/lock matrix, response mapping, API client contract incl. timeout) and
  `scripts/voice-intake-ui.test.mjs` (6: typed conversation → review → edit →
  submit payload; voice path with spoken-language propagation; optional
  question skip; extraction failure → retry → manual submission still works;
  mode-switch preservation; repeated submit clicks post once). Wired into
  `npm run test:voice`; whole voice suite 132 passed. `tsc` clean; ESLint at
  the documented baseline; `next build` green.

### Live evidence (2026-10-18, owner's local stack, headless Chromium)

Citizen login → `/submit` (default manual branch) → switch to voice → free
fake-device microphone start/listening/Cancel smoke (zero `/transcribe` calls,
so zero Sarvam spend) → typed conversation with REAL Groq extraction (three
`/grievance-intake/extract` calls) → location follow-up answered → review with
AI title ("Broken streetlight on Rajpur Road"), 240-char AI description, seeded
location search ("Rajpur Road, Delhi, near SBI ATM"), category/priority hints →
citizen edit dropped one AI badge → coordinate pin → real submission
(`POST /submit-grievance 200`, ticket `GRV-2026-0015`, auto-analysis panel
rendered). Zero console errors, zero form/hydration errors. The live spoken
Sarvam path was later re-run the same day with owner approval: one
`POST /transcribe` returned an accurate English transcript, the real extraction
and location follow-up worked, and the review showed two AI badges; the run
stopped at review, so no second grievance was created (zero console errors).

### Known limitations

- Incident date/duration have no schema field → folded into description text.
- Conversation category/priority are display-only hints; the authoritative
  classification runs at submit time and is marked AUTO-GENERATED.
- One optional AI clarification per conversation; deeper interrogation waits
  for a future stage.
- Voice-derived location seeds the search only — explicit citizen pin required.
- The conversation is intentionally ephemeral: no server-side session storage;
  a page reload clears it (draft fields survive only for the page's lifetime).
- Response language follows the selected spoken language (en/hi/mr only).

---

## Stage 13 — Spoken follow-up questions + optional photo step (DEC-039) — IMPLEMENTED, TESTED, live en/hi playback verified (2026-10-19)

### What this stage adds

The Stage 12 conversation was silent: the citizen had to read follow-up
questions. Stage 13 makes it fully audio-guided and closes the loop with a
photo opportunity before submission:

1. **Every follow-up question is spoken** in the citizen-selected language
   (`en-IN` / `hi-IN` / `mr-IN`), automatically as soon as it appears. The
   question card and its transcript line use the same spoken-language wording;
   changing the language while a question is open re-renders and re-speaks it.
2. **Mute and replay controls:** a persistent "Spoken questions on/off" toggle
   (stored in `localStorage`) and a "Play again" button on the question card.
   Muting stops the current clip; replay is an explicit gesture and still works
   while muted.
3. **Optional photo step before submit:** when the conversation reaches review,
   a photo section appears at the end and is scrolled into view. The citizen can
   add one photo or skip it; the submit button remains one atomic
   `POST /submit-grievance` including `imageUrl`.
4. **Human-in-the-loop unchanged:** fields stay editable with "AI suggestion"
   badges, the citizen explicitly submits, and the photo step never
   auto-submits or opens a picker without a tap.

### Contract change (supersedes Stage 12's free-text `question`)

The model no longer writes question wording. The extraction reply is
`{ title, description, location_text, category, priority, question_kind }`:

| `question_kind` | Meaning |
|---|---|
| `details` | The problem is too vague |
| `location` | No place was stated |
| `when` | Start time is missing |
| `frequency` | One-off vs recurring is unclear |
| `affected` | Who/what is impacted is unclear |
| `danger` | Safety risk is unclear |
| `landmark` | A place was named but is not findable |
| `clarify` | Genuine ambiguity remains |

`question_kind` is whitelisted and alias-normalized in
`backend/app/services/grievance_intake.py`; unknown values become `null`.
`asked_questions` now carries the **kinds** already asked (last 3), so the
backend dedupes on kinds without ever seeing wording. The deterministic policy
still owns `details` and `location`; the model's kind only fills the single
optional slot (`when`, `frequency`, `affected`, `danger`, `landmark`, or
`clarify`), and one optional question per conversation remains the cap.

Wording lives in `frontend/lib/i18n/voice.ts` (`intakeQuestionDetails`,
`intakeQuestionLocation`, `intakeQuestionWhen`, `intakeQuestionFrequency`,
`intakeQuestionAffected`, `intakeQuestionDanger`, `intakeQuestionLandmark`,
`intakeQuestionClarify`) in en/hi/mr.

### Provider latency bound (2026-10-19 fix)

The intake call is bounded end-to-end. `_call_llm` disables the Groq SDK's
automatic retries (`client.with_options(max_retries=0)`), caps each model
attempt at 10 s, and shares a 25 s total budget across the configured model and
its fallbacks; if the budget runs out it returns `504`. This keeps the whole
backend path well inside the frontend's 45 s timeout. Before the fix the SDK's
two default retries could multiply a stalled or rate-limited provider into
several minutes of spinner while the browser had already given up, and each
retry left another request running server-side. The cascade now logs the
winning model and elapsed time, plus a warning per failed attempt. Normal calls
remain ~1 s; the budget only changes failure behavior.

### Pre-recorded audio assets

- `frontend/scripts/generate-question-audio.mjs` synthesizes **8 kinds × 3
  languages = 24 WAV clips** once, using Sarvam `bulbul:v3` (speaker `shubh`,
  16 kHz mono, `output_audio_codec=wav`).
- Clips are committed under `frontend/public/voice/questions/<kind>.<language>.wav`
  (~2.7 MB total). The script skips existing files; `--force` regenerates.
  It is never run during build or test, and it needs `SARVAM_API_KEY` inline
  (never committed).
- There is **no backend TTS endpoint and no runtime TTS call/flag/limit/cache**.
  Questions keep working when Sarvam is down or credits are exhausted; the only
  provider cost is the one-time generation.
- `frontend/lib/voice/speech.ts` maps a kind + language to its static URL,
  reads/writes the mute preference, and implements `SpeechPlayer`:
  - a shared `AudioContext`, unlocked on a real tap (start / send / retry /
    replay) because clips play after an async STT/LLM round-trip;
  - decoded-buffer caching for instant replays, with correct
    supersede/cancel/failure outcomes;
  - an `<audio>` element fallback when Web Audio is unavailable or the context
    stays suspended.
- Auto-play is keyed to the new question message id, so ordinary re-renders do
  not replay audio. Leaving the question (answer sent, skipped, reset) stops
  playback immediately.

### Photo step

`SubmitForm.tsx` (voice branch only) renders, in order: editable review fields →
classification note → location capture → photo step → submit. The photo step:

- Appears automatically when `intakeReady` becomes true and scrolls into view
  (`block: "nearest"`); browsers cannot open the OS picker without a gesture,
  so the citizen taps "Choose photo" in the existing `ImageUpload` control.
- Can be skipped; the skipped state collapses to "No photo added" with an
  "Add a photo" action to reopen it.
- Uses the existing Cloudinary upload + `/validate-image` flow. While an upload
  is in flight, both "Skip photo" and submit are disabled (`onBusyChange`), so
  an image the citizen chose to skip can never be attached silently.
- Keeps the single-request contract: `imageUrl` is included only when an image
  was uploaded. The manual branch is unchanged (image + location grid as
  before).

### Test coverage

- Backend: `tests/test_voice_intake.py` — 26 tests, including kind aliases,
  unknown-kind rejection, kind-based dedupe, all eight kinds round-tripping,
  and a prompt assertion that no free-text `question` is requested.
- Frontend: new `scripts/voice-speech.test.mjs` — 11 tests: asset completeness
  for all 24 clips (RIFF/WAVE header, non-trivial size), URL mapping, mute
  persistence and storage-failure tolerance, Web Audio play/cache/supersede/
  cancel/missing-clip behavior, element fallback, blocked autoplay, and
  disposal.
- Updated `scripts/voice-intake.test.mjs` (planner kinds, asked-kind tracking,
  response mapping) and `scripts/voice-intake-ui.test.mjs` (spoken-language
  wording + URL, language-switch re-render/replay, mute + replay, photo skip,
  photo attach payload).
- Results (2026-10-19): `npm run test:voice` 148 passed; `tests/test_voice_intake.py`
  26 passed; `tsc --noEmit` clean; `next build` green; ESLint at the documented
  baseline (4 pre-existing `FaceCapture.tsx` errors + 4 warnings).

### Live evidence (2026-10-19, owner's local stack, headless Playwright Chromium)

Real backend (`:10000`, Mongo) + real Next dev server (`:3000`) + real Groq
extraction, seeded citizen login. Typed first description → real extraction →
location question appeared and auto-played from
`/voice/questions/location.en-IN.wav` through a **running** `AudioContext`
(clock advanced ~3 s). Switched the language selector to Hindi — the open
question re-rendered in Hindi and auto-played `location.hi-IN.wav`; pressing
"Play again" replayed it (no extra LLM call). Answered the location → review
appeared → photo step auto-appeared in view (top ~190 px) → "Skip photo" showed
"No photo added". Zero console errors or exceptions. No grievance was submitted
during this verification.

### Known limitations

- Question wording is template-only by design; the model picks the kind, so a
  question cannot be dynamically phrased for an unusual case. The eight kinds
  cover the prototype's follow-ups.
- Adding or changing a question requires regenerating its clips for all three
  languages and updating the asset-completeness test.
- The 24 committed WAVs add ~2.7 MB to the repository.
- Playback depends on the page having received a user gesture (the same
  constraint as any browser audio); the `<audio>` fallback covers browsers
  that allow element playback after page interaction.
- Photo capture is upload-only (no in-browser camera capture); the step is
  optional and never blocks submission.

---

## Stage 14 — Mode consolidation + bounded submit analysis — IMPLEMENTED, TESTED (2026-10-19)

DEC-041/DEC-042. This stage retires the single-shot recorder surface from
Stages 1–9 and makes each mode own one input method.

### What changed

- **Manual branch = text only.** `SubmitForm.tsx` renders title, description,
  image, location and submit. `VoiceRecorder.tsx`, `TranscriptionChoice.tsx`,
  `lib/voice/title.ts`, their i18n keys and the legacy recorder UI suite were
  removed. The two-mode toggle and the shared react-hook-form draft remain.
- **Voice review = read-only.** The conversation (spoken or "Type instead") is
  the only way to shape the title/description. The review displays the captured
  text, keeps the "AI suggestion" badges and hidden registered inputs for the
  submit payload, retains the photo step/location/submit, and points to
  "Switch to manual form" for corrections. Editing there mutates the same draft
  and the badges clear on the dirty field, as before.
- **Cross-stack E2E rebuilt around the intake.** The old loopback test drove the
  recorder that no longer exists. The replacement drives the intake through the
  real UI and real `/transcribe` (mocked Sarvam) with canned extraction, and is
  opt-in: `VOICE_E2E=1 pytest tests/test_voice_e2e.py`. The default suite skips
  it because it starts an in-process uvicorn server plus Node/jsdom; that
  harness proved too heavy for constrained dev machines.
- **Bounded submit analysis (DEC-042).** `classification.py` sends every Groq
  call through `_groq_complete` (`max_retries=0`, 8 s per call); the router wraps
  category → priority → refinement in a 20 s `classification_budget()`.
  `image.py` bounds multimodal validation at 8 s with no retries. Exhaustion
  falls through to the existing HF/keyword/heuristic paths, so a stalled
  provider cannot hold the submit open for minutes.
- **Capture tests kept.** The deleted recorder suite also covered
  `lib/voice/capture.ts`; the lifecycle cases (WAV output, permission denied,
  missing microphone, unsupported/insecure context, dispose, late permission,
  30 s auto-stop, processor failure) moved to
  `frontend/scripts/voice-capture.test.mjs`.

### Verification (2026-10-19)

- `npx tsc --noEmit` clean; ESLint clean on touched files; `next build` green.
- `npm run test:voice` **71 passed** — audio, capture, API, speech, intake
  logic and intake UI; the recorder-only tests were deleted with the surface.
- Full pytest **511 passed / 32 skipped / 23 failed**: the 23 failures are the
  documented DEC-006 baseline; the 32nd skip is the opt-in E2E. New backend
  tests assert `max_retries=0`, the per-call timeout and budget exhaustion.
- Not run: the opt-in cross-stack E2E and a live post-consolidation browser
  pass. Do not launch the E2E from the agent terminal — its uvicorn + Node
  harness coincided with extension-host restarts on the owner's machine.

### Known limitations

- Correcting voice-captured text requires switching to the manual form; the
  conversation cannot be resumed after the review appears.
- The read-only review means a citizen who misses a wrong extraction must notice
  the "Switch to manual form" affordance; the hint copy calls this out in
  en/hi/mr.
- The opt-in E2E is not part of default CI, so the real-HTTP intake path is
  verified only when someone runs it explicitly.

---

## Stage 15 — Spoken Opening Prompt for Conversational Intake — IMPLEMENTED, TESTED (2026-10-20)

DEC-043. This stage ensures the assistant speaks first when voice mode is started, leading the interaction rather than recording silently.

### What changed

- **Audible opening prompt on first Start speaking.** Tapping "Start speaking" in voice mode now plays an audible opening prompt (`intakeIntro`) in the selected spoken language (`en-IN`, `hi-IN`, `mr-IN`) before capture begins.
- **Pre-recorded clips.** Synthesized 3 dedicated 16 kHz mono WAV clips (`intro.en-IN.wav`, `intro.hi-IN.wav`, `intro.mr-IN.wav`, ~410 kB total) using Sarvam `bulbul:v3` via `frontend/scripts/generate-question-audio.mjs`. There is zero runtime TTS spend.
- **Contract separation.** `intro` is client-only and kept out of `INTAKE_QUESTION_KINDS`; the backend LLM extraction contract and prompt are unchanged.
- **Autoplay & echo prevention.** The browser `AudioContext` is unlocked synchronously inside the click gesture. The opening prompt plays completely before `VoiceCapture` starts listening, preventing audio echo from contaminating the citizen's STT transcript.
- **Mute & failure tolerance.** When muted, no audio plays and recording starts immediately; the prompt text is still added to the conversation transcript log. If playback fails or times out (10 s guard), recording starts without blocking the user.
- **Single-prompt lifecycle.** Follow-up questions ("Answer by voice") do not replay the opener; only the initial conversation turn triggers it.

### Verification (2026-10-20)

- `scripts/voice-speech.test.mjs` (12 tests) asserts all 27 clips (24 questions + 3 intro clips) exist and match WAV format specifications.
- `scripts/voice-intake.test.mjs` (15 tests) asserts reducer `PROMPT_STARTED` transitions and cancellation.
- `scripts/voice-intake-ui.test.mjs` (15 tests) asserts opener playback timing, log visibility, muted path, fallback on player failure, and follow-up suppression.
- `npm run test:voice` **77 passed** (0 failures).
- `npx tsc --noEmit` and ESLint on touched files clean. Backend `pytest tests/test_voice_intake.py` 28 passed.

---

## Stage 16 — Citizen-Facing Classification Privacy (DEC-044) — IMPLEMENTED, TESTED (2026-10-20)

DEC-044. Owner-reported: after registering, the citizen saw the classified
department and the confidence score on the success card. This stage removes AI
classification outputs and confidence from every citizen surface.

### What changed

- **Intake summary:** the running "Your complaint so far" box shows only the
  citizen's issue and location; the "Suggested category" and "Suggested
  priority" rows are removed.
- **Classification note:** `intakeClassificationNote` no longer says category,
  priority and department are confirmed automatically; it now reads "Your
  complaint will be routed to the right team after you submit." (en/hi/mr).
- **Submit success card:** the AI triage panel is removed; only the reference ID
  and confirmation remain.
- **Track/detail modal:** the "Automated Triage Diagnostic" renders for staff
  only; citizens no longer see confidence, explanation or keywords.
- **Confidence pill:** `aiSure` is deleted from `AnalysisPanel` and all locale
  packs — no surface shows a confidence percentage.
- **Image upload:** the validation score is no longer printed; plain
  "Image accepted." copy only.
- **Notification:** the submit notification no longer names the classified
  category/department.
- **Kept:** "AI suggestion" badges on voice-filled fields (HITL transparency,
  not classification results), the human-confirmation assignment notification,
  and `hfEngine`/`categoryConfidence` in API responses/types (UI-only change).

### Verification (2026-10-20)

- `npm run test:voice` **79 passed** (0 failures) — new assertions cover the
  intake summary, the citizen success card, and the citizen-vs-staff detail
  modal.
- `tests/test_endpoints.py::test_submit_notification_hides_the_classification`
  passes; `tests/conftest.py` now swaps the notification repository on the
  grievances router so endpoint reads see submit-created records.
- `npx tsc --noEmit`, touched-file ESLint and `next build` clean.
- Full `tests/test_endpoints.py`: 37 passed / 9 failed — the documented DEC-006
  status-vocabulary baseline.

### Known limitations

- Live browser verification of the citizen surfaces (success card, track
  detail, intake summary, image upload, inbox) is still pending.
- `hfEngine` including `categoryConfidence` remains in API JSON, so it can be
  seen in devtools; stripping it from citizen payloads is a separate contract
  decision (see DEC-044).

