# GrievAI voice feature — final handoff

**Repository:** grievance-redressal-system · **Branch:** feature/aarohi
**Date:** 2026-10-14 · **Status:** implemented and mock-tested; operational validation incomplete.

Full architecture, API/configuration tables, file inventory, test history and
diagnostic startup proposal: [VOICE_ASSISTED_COMPLAINT.md](docs/VOICE_ASSISTED_COMPLAINT.md).

## Implemented behavior

- Real microphone PCM capture through AudioWorklet; mono 16-bit/16 kHz WAV,
  30-second cap, playback/re-record/discard and cleanup on navigation.
- Authenticated multipart `POST /transcribe`, strict WAV/body validation,
  process-local quotas/idempotency and bounded Sarvam HTTP integration.
- English (`en-IN`), Hindi (`hi-IN`), Marathi (`mr-IN`), without translation.
- Empty Description accepts the full transcript. Nonempty Description offers
  Append/Replace/Cancel before upload; in-flight edits require another choice.
- Deterministic title extraction preserves script; empty titles auto-fill when
  extraction succeeds. Existing/pending-edited titles require explicit confirmed
  replacement. Both fields remain editable; recording alone changes neither.
- No grievance submission, classification or permanent raw-audio storage occurs
  during transcription. Normal `POST /submit-grievance` retains citizen control.
- Default-off `DIAGNOSTIC_SKIP_INITIALIZATION_WRITES` skips all nine repositories'
  initialization indexes, SLA default seeding and startup backfill/account seeds.
  It changes neither endpoint writes nor authorization; it is not read-only mode.

## Integration checklist

1. Review the complete working tree, including untracked source/tests/docs.
   Preserve the owner's pre-existing `memory/SESSION_LOG.md` change unstaged.
2. Install root backend runtime requirements and development test requirements
   in an isolated environment; install frontend dependencies using `npm ci`.
   Review adjacent auth/SMS dependency additions in root requirements.
3. Configure existing MongoDB/JWT authentication and explicit frontend CORS
   origin. Set frontend `NEXT_PUBLIC_API_URL` to the correct backend; rebuild for
   deployment. `NEXT_PUBLIC_USE_MOCKS` does not mock transcription.
4. Keep `TRANSCRIPTION_ENABLED=false` and
   `DIAGNOSTIC_SKIP_INITIALIZATION_WRITES=false` in ordinary deployments. The
   diagnostic guard is only for an approved initialization-write-free session.
5. Run mock tests first. Do not initialize shared MongoDB normally without
   reviewing index/seeding writes. Follow the guide's guarded startup proposal
   only after separate authorization; that corrected proposal is not runtime-tested.
6. Enable live STT only after explicit authorization, verified backend-only
   `SARVAM_API_KEY`, `SARVAM_STT_MODEL=saaras:v4`, retention/billing review and an
   agreed attempt budget. Use one worker without reload. Restarting resets quotas.
   Disable immediately after the authorized window; verify disabled behavior.

No credentials belong in frontend variables, source, logs or this handoff. Modern
secure-context browser APIs and HTTPS page/API origins are required in production.

## Enabling Voice Transcription for Testing

Transcription is **disabled by default to protect Sarvam API credits**. The steps
below describe a separately authorized local live test; they do not enable it now.
The existing MongoDB login blocker must be resolved before an authenticated test.

1. Set `TRANSCRIPTION_ENABLED=true` in your local `backend/.env`.
2. Configure `SARVAM_API_KEY` with a valid key in the backend environment. Keep
   the key server-side; never use a `NEXT_PUBLIC_*` variable or browser code.
3. Keep the existing attempt, concurrency and duration limits enabled. Agree on
   a small attempt budget and use one worker without reload. Process restarts
   reset counters; do not restart to bypass the approved budget.
4. Restart the backend to apply configuration, using the existing approved
   startup procedure. Normal initialization can write indexes/default data;
   review shared-database startup permissions first.
5. Log in with an authorized user account.
6. Navigate to `/submit`, select English, Hindi or Marathi, record a short
   complaint (approximately 5-10 seconds), and click **Transcribe**.
7. Confirm the intended application to Description. For existing text, the UI
   offers **Append / Replace / Cancel before upload**; edits during transcription
   require another choice. An empty Description receives an accepted transcript
   automatically: there is no separate transcript-preview confirmation dialog.
   Review the full transcript and editable title before submitting anything.
8. After testing, set `TRANSCRIPTION_ENABLED=false` and restart the backend.
   Verify transcription is disabled again.

Real transcription consumes provider credits; failures/timeouts and cancellation
after upload can also incur cost. Hindi and Marathi are implemented and mock-tested
but **not yet live-verified**. Never commit `.env` files or credentials.
`DIAGNOSTIC_SKIP_INITIALIZATION_WRITES` must remain **false during normal operation**;
use it only for a separately approved diagnostic session.

## Validation evidence

| Check | Result and provenance |
| --- | --- |
| Stage 11 frontend rerun | **113 passed, 0 failed/skipped**; `npm.cmd run test:voice`; MockTimers warnings |
| Stage 11 TypeScript / targeted ESLint | **Passed**; no frontend functionality changed |
| Latest backend diagnostic/voice/configuration suite | **105 passed**, including 25 focused guard cases; historical run, one deprecation warning |
| Broader backend exploratory run | **182 passed, 10 failed**; legacy grievance-status failures reproduced without guards in memory |
| Stage 6 cross-stack | **10 mocked scenarios passed**; historical 80 backend / 55 frontend tests |
| Stage 7 CORS/permission/browser probes | Historical **88 backend / 58 frontend tests passed**; partial accessibility validation |
| Hydrated browser mocks | Historical Chrome **155.0.8059.39** and Edge **155.0.4283.45**, **26 scenarios each**; 52 total, zero application writes |
| Real Chrome microphone controls | Owner-confirmed recording/playback/re-record/discard/automatic stop passed |
| Live English STT | **One successful seven-second recording**; full Description, editable generated title; no grievance submitted; owner confirmed disabled afterward |
| Live Hindi / Marathi | **NOT VALIDATED**; no successful live multilingual test claimed |
| Manual screen-reader / Firefox / Safari | **NOT TESTED**; automated accessibility assertions are not screen-reader speech validation |
| Static checks | Backend Python/launcher syntax previously passed; final `git diff --check` checked for this handoff |

No servers or browser harnesses were started during Stage 11. Backend/browser
results above are historical; only frontend/static checks were repeated here.
Ruff/mypy were unavailable. No production build/deployment validation was done.

## MongoDB blocker and diagnostic status

Read-only ping and citizen-existence lookup passed with verified TLS; the original
CA bundle later worked too. Earlier certificate/server-selection failures remain
intermittent. Authentication can fall back to empty in-memory storage after failed
index initialization. `/health` does not prove MongoDB-backed authentication.

The users audit found a unique **non-sparse** email index, missing phone/citizen-ID
indexes, and matching role/department indexes. Normal initialization can rebuild
or create indexes. The diagnostic guard was added to avoid those shared writes.
Keep it disabled normally so standard index/default initialization is preserved.

The old disabled backend was stopped. Guarded launches failed first on the temp
script import path, then on incompatible `tlsInsecure`/`tlsAllowInvalidCertificates`
URI options. At last verification **no backend listener existed on port 10000**.
Login is **NOT restored**. No further retries were made.

The guide corrects the TLS-option combination in documentation only. The external
temporary launcher still requires review/correction; do not run it unchanged.
For a later approved start, verify the CA source/hash, actual
`MongoUsersRepository` type, auth-router singleton identity, read-only ping/account
lookup, health and disabled guard before asking the citizen to retry login.

## Limitations and next actions

- Restore and verify MongoDB-backed citizen login under separate authorization.
- Separately authorize live Hindi/Marathi tests; prior two-attempt budget was unused.
- Titles are conservative suggestions, not summaries: long/weak phrases may
  produce none; finite introduction rules do not guarantee ideal/main-issue titles.
- Validate native-language quality, manual screen readers/full keyboard flow,
  physical/mobile devices, Firefox/Safari and production HTTPS/CORS.
- Shared durable quotas, load/ingress controls and billing/retention verification
  are needed before public scaling. Cancellation after upload can still incur cost.
- Existing demo credentials/security-history tasks and 10 legacy backend failures
  remain separate review items; no unrelated fixes were made.

## Git readiness

Suitable for **review and continuation**, not an unreviewed merge or deployment.
Many required voice files remain untracked; selective review/staging is necessary.
Added tracked diff and untracked text scans found no credential patterns, but this
is not a complete secret-history audit. No tracked private env/key files identified.

`artifacts/grievai-feature-aarohi-source-2026-10-13.zip` is a stale untracked snapshot;
exclude it from the final source handoff/commit. Its path audit found no private
env/dependency/key paths, but archive contents were not exhaustively scanned.
No commit, push, merge or branch switch occurred. Existing work and
`memory/SESSION_LOG.md` were preserved.
