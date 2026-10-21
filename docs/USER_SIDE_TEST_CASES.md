# USER_SIDE_TEST_CASES.md — SAMARTH Citizen-Side Test Plan, Cases, and Traceability

> **Status: DOCUMENTATION ONLY — NOT EXECUTED.**
> This document defines a user-side test suite for SAMARTH. No case below has
> been run against a live environment. `Actual Result` is deliberately `—` and
> `Status` is `Not Run`; do not read this file as evidence that any behaviour
> passes.
>
> It consolidates the six requested artifacts: **test plan**, **test cases**,
> **end-to-end journeys**, **requirements traceability matrix**, **gaps and
> recommendations**, and **automation recommendations**.
>
> Created: 2026-10-21 · Version: 1.1 · Owner: project team
> Scope: citizen / signed-out user journeys only. Staff-side workflows appear
> only as test setup or negative-authorisation checks.

---

## Table of Contents

1. [Test Plan](#1-test-plan)
2. [Verified User-Side Surface](#2-verified-user-side-surface)
3. [Test Conventions](#3-test-conventions)
4. [Coverage Summary](#4-coverage-summary)
5. [Authentication and Account Management](#5-authentication-and-account-management-usr-auth)
6. [Navigation, Internationalisation, and Accessibility](#6-navigation-internationalisation-and-accessibility)
7. [Grievance Registration and Submission](#7-grievance-registration-and-submission-usr-grv)
8. [AI-Assisted Grievance Processing](#8-ai-assisted-grievance-processing-usr-ai)
9. [Voice-Assisted Grievance Intake](#9-voice-assisted-grievance-intake-usr-voice)
10. [Grievance Tracking and Status](#10-grievance-tracking-and-status-usr-track)
11. [Communication and Notifications](#11-communication-and-notifications-usr-comm)
12. [Dashboard, Search, Filtering, and Pagination](#12-dashboard-search-filtering-and-pagination-usr-dash)
13. [Error Handling and Reliability](#13-error-handling-and-reliability-usr-err)
14. [Security and Privacy from the User Perspective](#14-security-and-privacy-from-the-user-perspective-usr-sec)
15. [API-Level Technical Checks](#15-api-level-technical-checks-usr-api)
16. [End-to-End User Journeys](#16-end-to-end-user-journeys)
17. [Requirements Traceability Matrix](#17-requirements-traceability-matrix)
18. [Testing Gaps, Risks, and Recommendations](#18-testing-gaps-risks-and-recommendations)
19. [Automation Recommendations](#19-automation-recommendations)
20. [Execution Record](#20-execution-record)

---

## 1. Test Plan

### 1.1 Objectives

1. Verify that a first-time citizen can create an account, sign in, submit a
   grievance, receive a reference number, and find that grievance again.
2. Verify the citizen can use the voice-assisted intake without being misled
   when speech recognition or AI extraction fails.
3. Verify the citizen can track status, read notifications, and understand
   what has happened to the grievance at every supported lifecycle state.
4. Verify the application remains usable with incomplete data, network loss,
   AI/voice outages, expired sessions, and invalid input.
5. Verify that one citizen cannot read, modify, or infer another citizen's
   data through the UI or the APIs the UI calls.
6. Verify accessibility, multilingual behaviour, and responsive usability for
   users with limited digital literacy or assistive technology.

### 1.2 In Scope

- Citizen registration, sign-in, sign-out, session restore, phone binding,
  profile viewing, and optional face authentication.
- Public pages and citizen-only pages: `/`, `/login`, `/register`,
  `/submit`, `/track`, `/notifications`, `/profile`, `/auth/callback`,
  `/signup/face`, `/re-enrol`.
- Manual grievance submission, photo evidence, location selection, duplicate
  click/retry behaviour, reference-number confirmation.
- AI classification/priority/quality-flag behaviour **only as it affects the
  citizen**; the citizen UI deliberately hides category, department,
  priority, and confidence (DEC-044).
- Conversational voice intake, transcription, AI extraction, review,
  correction, and failure/recovery paths.
- Personal grievance list, status badges, lifecycle timeline, notifications,
  dashboard counts, and status-change visibility.
- User-visible error handling, recovery, privacy, and authorization.
- API-level checks that directly underpin the above journeys.

### 1.3 Out of Scope

- Admin, resolver, and superadmin workflow UX. Their APIs are used only to
  create test state (assign, progress, resolve, reject) in E2E journeys.
- AI model accuracy benchmarking, STT word-error-rate evaluation, and
  face-recognition accuracy. Those need separate datasets and are not
  validated by this suite.
- Load, stress, soak, or penetration testing beyond the focused security
  cases below.
- Real SMS/WhatsApp delivery (prototype uses a dry-run provider), real email
  delivery, payment, or government-system integration.
- Native mobile apps, offline-first sync, and account deletion/data-export
  (not in the approved prototype scope).
- Production data. Every case uses synthetic identities and synthetic
  grievances.

### 1.4 Quality Risks Driving the Suite

| Risk | Consequence | Priority focus |
|---|---|---|
| A citizen cannot submit or loses a submitted grievance | Core service failure; no record of the complaint | P0 |
| A citizen can read another citizen's grievance | Privacy breach; loss of trust | P0 |
| Expired session silently discards a full form | Citizen must re-enter a long complaint; abandonment | P1 |
| Status/timeline is wrong or missing resolution information | Citizen cannot tell whether the problem was fixed | P1 |
| AI or voice failure blocks manual submission | A nonessential feature becomes a single point of failure | P1 |
| Retry after a lost response creates duplicates | Duplicate workload and confused tracking | P1 |
| Low digital literacy or disability makes the form unusable | Exclusion of intended beneficiaries | P1 |
| Hindi/Marathi text is garbled or clipped | Accessibility and comprehension failure | P1 |
| Voice transcription errors are submitted unreviewed | Wrong facts in an official record | P1 |
| Notifications are missed or expose another user's data | Citizen misses a response or privacy is breached | P2 |

### 1.5 Test Levels and Evidence

| Level | What it proves | How |
|---|---|---|
| UI end-to-end | A real user can complete a journey through the browser with the real backend | Manual browser session or Playwright; screenshots/trace per step |
| UI + mocked service | UI state handling when AI, STT, Cloudinary, or network is unavailable | Browser route interception / feature flags |
| API integration | Contract, authorization, persistence, and state rules behind the UI | `pytest` against FastAPI; synthetic Mongo test database |
| Contract check | Frontend zod schemas accept the real backend payload | `node frontend/scripts/e2e.mjs` and `check-contract.mjs` |
| Accessibility/manual | Keyboard, screen reader, zoom, contrast, touch targets | Manual checklist; browser accessibility tree |
| Performance spot check | Important citizen actions complete within a usable time | Browser devtools/network timings; record environment |

### 1.6 Test Environments

| Environment | Configuration | Use |
|---|---|---|
| Local integrated | Backend `uvicorn backend.app.main:app --port 10000`; frontend `npm run dev` on `:3000`; `NEXT_PUBLIC_USE_MOCKS=false`; isolated MongoDB test DB | Primary functional and API testing |
| Local voice | `TRANSCRIPTION_ENABLED=true`; valid Sarvam key; `NEXT_PUBLIC_API_URL` set; fake media stream available | Voice cases, failure injection |
| Local external services | Groq key optional; Cloudinary test cloud/preset; LLM image validation key optional | AI/photo cases; record which providers are live |
| Staging / deployed | Render backend + frontend, isolated test database, seeded synthetic accounts, SMS dry-run, real OTP debug disabled | Pre-release smoke and authorization checks |
| Mock UI | `NEXT_PUBLIC_USE_MOCKS=true` | UI-only previews; **not** valid evidence for integration, auth, AI, or persistence tests |

Never point destructive or negative tests at production, and never use a real
citizen's phone number, email, Aadhaar-like identifier, or grievance content.

### 1.7 Test Data Strategy

**Accounts (synthetic):**

| Alias | Purpose | Notes |
|---|---|---|
| Citizen A | Primary happy-path citizen | Fresh account per run; email pattern `citizen.a+<run>@example.test` |
| Citizen B | Isolation/IDOR checks | Separate account, separate grievances |
| Unverified citizen | Phone/face gating checks | Account with no verified phone |
| Staff fixture | Creates status transitions for tracking cases | ADMIN/RESOLVER test account; used only as setup |
| Locked/expired fixture | Session-expiry checks | Obtained by clock manipulation or short-lived test token config |

Use a unique run suffix for every account and phone number so a rerun does not
collide with prior data. Never reuse a production account.

**Grievance content:** realistic, short, and varied:

| Label | Example |
|---|---|
| Water | "No water supply in Sector 12 for three days. The pipeline near the community hall is dry and residents are buying tanker water." |
| Roads | "A deep pothole on Station Road near the school gate has caused two scooter accidents this week." |
| Streetlight | "The streetlights on Gandhi Park Road are off after 8 pm. The area is unsafe for women walking home." |
| Sanitation | "Garbage has not been collected from Lane 4 for six days; there is a bad smell and stray dogs are scattering it." |
| Urgent/danger | "A live electric wire is hanging over the school gate at 7 am; children are walking under it." |
| Ambiguous | "It is not working again. Please fix it soon." |
| Hindi | "हमारे मोहल्ले में तीन दिन से पानी नहीं आ रहा है। पास की पाइपलाइन से रिसाव हो रहा है।" |
| Marathi | "आमच्या परिसरात सहा दिवसांपासून कचरा उचलला जात नाही. खूप दुर्गंधी येते." |
| Code-switch | "Sector 5 mein streetlight काम नहीं कर रहा, रात्री खूप अंधार आहे." |
| Clear non-civic | "What is the capital of France?"; "2 + 2 = 4. Solve this riddle."; "asdf qwer 1234 lorem ipsum dolor sit amet" |
| Letterless | "!!! 123 ??? ---" |
| Boundary | 5-character title, 20-character description, 10,000-character description |

**Files:**

| File | Purpose |
|---|---|
| `water-evidence.jpg` (800×600, <1 MB) | Valid JPEG |
| `water-evidence.png`, `water-evidence.webp` | Other accepted formats |
| `water-evidence.gif` | Unsupported type |
| `water-evidence.pdf` | Unsupported type despite security docs mentioning PDF |
| `water-evidence.svg` | Unsupported/active-content type |
| `oversize.jpg` (11 MB) | Client size boundary |
| `corrupt.jpg` (text bytes renamed `.jpg`) | Upload/validation failure |
| `outside-india.jpg` | Irrelevant-image validation case (optional) |

**Audio:**

| Clip | Purpose |
|---|---|
| `water-en.wav` (5–15 s, 16 kHz mono PCM) | English happy path |
| `water-hi.wav` | Hindi happy path |
| `water-mr.wav` | Marathi happy path |
| `mixed-en-hi.wav` | Code-switching |
| `silence.wav` | Empty/silent transcription |
| `noise.wav` | Background noise |
| `long-31s.wav` | Duration boundary |
| `click-only.wav` | No speech |

Generate synthetic speech only; do not record a real citizen. Label
transcripts as test artifacts, not validated recognition results.

**Location:** Pune centre `18.5204, 73.8567`; landmark `Shivajinagar, Pune`;
outside-India point `51.5072, -0.1276` (London) for boundary checks.

**Reference IDs:** every case must use the ID generated during that run.
Never assert against a pre-existing production reference number.

### 1.8 Assumptions

1. Testers can create isolated accounts and can read OTP debug codes only in
   a local dry-run environment; production/live OTPs are entered manually.
2. A staff fixture can move a grievance through assignment, progress,
   resolution, rejection, and closure via API for tracking tests. The staff UI
   itself is not under test.
3. Voice cases run with the feature flag enabled and microphone permission
   controllable; where no microphone exists, cases are marked Blocked rather
   than Pass.
4. Cloudinary and Sarvam credentials are test-scoped and may be unavailable;
   availability is recorded per run.
5. Captcha is never disabled for a test run. Testers solve it or use the
   local visual challenge; bypassing security controls invalidates the result.
6. The backend and frontend clocks are approximately synchronized; timestamp
   assertions allow a sensible tolerance.
7. Mock mode is not accepted as evidence for API, persistence, auth, AI, or
   voice behaviour.

### 1.9 Dependencies

- Running FastAPI backend, Next.js frontend, and a clean MongoDB test database
  (or conscious use of the in-memory fallback, recorded as such).
- Seed/cleanup mechanism for synthetic accounts and grievances.
- Valid Cloudinary test configuration for photo cases.
- Valid Sarvam configuration and `TRANSCRIPTION_ENABLED=true` for voice.
- Optional Groq/HF keys for AI-provider cases; keyword fallback must still be
  testable without them.
- Browser with microphone, camera, localStorage, and a modern media stack.
- Network throttling/inspection tooling (browser devtools or proxy) for
  offline/lost-response cases.

### 1.10 Entry Criteria

- [ ] Application builds and starts; `GET /health` returns healthy.
- [ ] Test environment uses an isolated database and synthetic accounts.
- [ ] Feature flags and external-service availability are recorded.
- [ ] Test data files and audio clips are available and labelled synthetic.
- [ ] Staff fixture can create the lifecycle states needed by tracking cases.
- [ ] The tester knows which documentation version this suite was written
      against (commit + date).
- [ ] No blocker defect prevents the smoke journey (register → submit → track)
      from being attempted; if one exists, record it and mark affected cases
      Blocked.

### 1.11 Exit Criteria

- [ ] All P0 cases executed; zero unresolved P0 defects that expose data or
      block the core journey.
- [ ] All P1 cases executed or explicitly waived with a recorded reason.
- [ ] P2/P3 results recorded; cosmetic issues may remain open.
- [ ] Every Blocked case names the missing feature, environment, or service.
- [ ] Actual results contain observable evidence (status, reference ID,
      screenshot/trace, request/response, console log).
- [ ] The requirements traceability matrix is updated with the final status.
- [ ] Defects are filed separately; no test is marked Pass on code inspection
      alone.

### 1.12 Priority Definitions

| Priority | Definition | Examples |
|---|---|---|
| P0 — Critical | Core journey blocked, user data exposed, or serious integrity loss | Cannot register/submit, IDOR, duplicate/lost grievance, auth bypass |
| P1 — High | Important functionality broken or unrecoverable, but a workaround may exist | Refresh drops the form, status/timeline wrong, AI outage blocks submission, no retry |
| P2 — Medium | Noncritical feature, validation, usability, or consistency issue | Profile cannot be edited, notification link lands on the list, label mismatch |
| P3 — Low | Cosmetic or low-impact issue | Spacing, minor wording, nonessential animation |

Priority reflects the **consequence of failure**, not the likelihood of the
defect.

### 1.13 Status and Evidence Rules

| Status | Meaning |
|---|---|
| `Not Run` | Default for every case in this document |
| `Pass` | Executed on the stated environment; all expected results observed; evidence attached |
| `Fail` | Executed; at least one expected result not observed; defect reference recorded |
| `Blocked` | Cannot execute because a feature/environment/service is unavailable; reason recorded |
| `Not Applicable` | The feature is intentionally absent from the approved scope; rationale recorded |

- Do not mark `Pass` because the implementation "looks correct".
- Do not mark `Fail` solely because a documented but unimplemented feature is
  absent; use `Blocked` or `Not Applicable` and record the gap.
- `Actual Result` must be factual and specific: status code, visible text,
  reference ID, record count, console error, or "no response after N seconds".
- Attach evidence outside this Markdown file (screenshots, traces, logs) and
  reference its location in `Notes`.

### 1.14 Suggested Execution Order

1. **Smoke:** AUTH-010, AUTH-001, GRV-001, TRACK-001, E2E-01.
2. **P0 security and data integrity:** SEC-001…SEC-008, ERR-007/008, API-005/007.
3. **P1 journey and recovery:** remaining AUTH, GRV, TRACK, ERR, AI-006.
4. **Voice:** VOICE-001…VOICE-020 after the text journey is stable.
5. **Accessibility and responsive:** ACC-001…ACC-010, NAV-001…NAV-009.
6. **P2/P3 polish and documentation drift:** COMM, DASH, remaining cases.

---

## 2. Verified User-Side Surface

This section records what the implementation exposes as of 2026-10-21,
verified by **static inspection** of routes, components, and routers. No
runtime verification was performed for this document. It is the baseline for
the test expectations; where it conflicts with older documentation, the
conflict is listed in §18.

### 2.1 Citizen and Public Routes

| Route | Access | Purpose | Observed state |
|---|---|---|---|
| `/` | Public | Landing page, category entry points, CTAs | IMPLEMENTED |
| `/login` | Public | Password, phone OTP, Google, optional face 2FA | IMPLEMENTED (Google/face env-dependent) |
| `/register` | Public | Profile + captcha registration, then phone OTP step | IMPLEMENTED |
| `/auth/callback` | Public | Google OAuth callback; stores tokens, routes user | IMPLEMENTED (requires credentials) |
| `/submit` | Signed-in | Manual/voice grievance form + “Your grievances” list | IMPLEMENTED |
| `/track` | Signed-in | Personal grievance cards, counts, detail modal | IMPLEMENTED |
| `/notifications` | Signed-in | In-app inbox, mark read / mark all read | IMPLEMENTED |
| `/profile` | Signed-in | Account summary, phone binding, SMS consent, face settings | IMPLEMENTED (no name/address editing) |
| `/signup/face` | Public | Face-only signup path | IMPLEMENTED, flag-gated |
| `/re-enroll` | Signed-in | Face re-enrolment after admin reset | IMPLEMENTED, flag-gated |
| Any unknown path | Public | Next.js not-found page | IMPLEMENTED |

Staff routes exist (`/admin`, `/admin/analytics`, `/admin/employees`,
`/resolver`, `/superadmin`) but are **not** citizen test targets. They are used
only to confirm that a citizen cannot use them.

### 2.2 Feature Status Relevant to This Suite

| Capability | Status | Notes verified in code |
|---|---|---|
| Email/password registration and login | IMPLEMENTED | bcrypt hash, JWT access + refresh, captcha, 18+ profile validation |
| Google OAuth | IMPLEMENTED, environment-dependent | Returns 503-style failure if client credentials are absent |
| Phone OTP login | IMPLEMENTED | Only verified citizen numbers receive a usable login OTP; generic response otherwise |
| Phone binding / SMS consent | IMPLEMENTED | Consent unchecked by default; unbinding opts out; dry-run provider |
| Face authentication | IMPLEMENTED, optional | Flag-gated; real-webcam/liveness accuracy unvalidated |
| Password reset | NOT IMPLEMENTED | Login link is a `mailto:` support link (stale address; see G-15) |
| Profile editing (name/address/DOB) | NOT IMPLEMENTED | Profile displays account data; only phone and face settings are editable |
| Manual grievance submission | IMPLEMENTED | Title, description, mandatory location, optional one photo |
| Category/department selector | NOT PRESENT | Classification is automatic and hidden from the citizen (DEC-044) |
| Photo attachment | IMPLEMENTED | JPEG/PNG/WebP only, 10 MB client limit, Cloudinary upload, LLM validation |
| PDF/DOCX/multiple attachments | NOT IMPLEMENTED | Contradicts older security/PRD wording |
| Location picker | IMPLEMENTED | GPS, search, pop-out map, explicit pin confirmation |
| AI classification/priority | IMPLEMENTED backend | Synchronous; `categoryOutcome`/confidence semantics stored; hides results on citizen surfaces |
| AI summary/entity/severity/assignment recommendation | NOT IMPLEMENTED | Documented as PLANNED; no citizen UI |
| Letterless submission validation | IMPLEMENTED | Text with no Unicode letters returns 400 before provider work (DEC-059) |
| Civic-scope submission gate | IMPLEMENTED | Clear non-civic intent returns 422 before image/provider/reference/persistence (DEC-062); ambiguous text stays reviewable |
| Quality/suspicious-submission flag | IMPLEMENTED, conditional | Runs only when local classification abstains; returns `flagged`; provider failure fails open; clear non-civic text is rejected by the separate gate |
| Conversational voice intake | IMPLEMENTED, flag-gated | Sarvam STT + LLM extraction; STT accuracy EXPERIMENTAL |
| Single-shot manual dictation | REMOVED | DEC-041: manual branch is text-only |
| Personal grievance list | IMPLEMENTED | Newest-first, default limit 50, no pagination control |
| Status timeline | PARTIAL | Static 5-milestone visual derived from current status; no per-transition history |
| Resolution text/feedback | NOT IMPLEMENTED in citizen UI | Citizen modal shows status/description/location, not resolution or closure reason |
| Public reference-ID tracking | REMOVED from UI | DEC-028; API single-record lookup still exists without auth |
| In-app notifications | IMPLEMENTED | 30-second poll; mark read/all read; citizen “Open” goes to `/track` |
| Email notifications | NOT IMPLEMENTED | In-app only |
| SMS notifications | DRY-RUN | Intent logged without PII; no external message |
| Comments/additional information/supplementary documents | NOT IMPLEMENTED | No citizen-facing endpoint or UI |
| Withdraw/reopen | API ONLY | No citizen UI controls |
| Satisfaction feedback/appeal | NOT IMPLEMENTED | FR-RES-007 not implemented |
| Search/filter/sort/pagination | NOT IMPLEMENTED in citizen UI | List API supports `state`, `dept`, `limit`; no search text parameter |
| Internationalisation | IMPLEMENTED | `en`, `hi`, `mr` selectable; 8 additional packs bundled but hidden |
| Accessibility | PARTIAL | Labels, roles, focus-visible styles exist; no formal audit |

### 2.3 Backend Endpoints Exercised by Citizen Journeys

| Method and path | Auth | Citizen use |
|---|---|---|
| `POST /auth/register` | Public | Create account |
| `POST /auth/login` | Public | Password login; may return a pending face-2FA token |
| `POST /auth/login/phone/request-otp` | Public | Request login OTP |
| `POST /auth/login/phone/verify` | Public | Exchange OTP for tokens |
| `POST /auth/refresh` | Public | Rotate access token |
| `GET /auth/me` | Bearer | Restore session/profile |
| `GET /auth/google` and `/auth/google/callback` | Public | Optional Google login |
| `GET /auth/captcha` | Public | Captcha challenge |
| `POST /phone/request-otp`, `/phone/verify-otp`, `/phone/bind`, `/phone/unbind`, `/phone/sms-consent` | Bearer | Phone and SMS preferences |
| `POST /submit-grievance` | Bearer | Create grievance |
| `GET /grievances` | Bearer | Own list, newest first, default 50 |
| `GET /grievances/{id}` | Optional Bearer | Owner full record; non-owner/public projection |
| `GET /grievances/{id}/history` | Optional Bearer | Customer-visible updates; public for a known ID, not used by the citizen modal |
| `POST /grievances/{id}/withdraw` | Bearer | Withdraw (no UI) |
| `POST /grievances/{id}/reopen` | Bearer | Reopen resolved (no UI) |
| `POST /validate-image` | Public | LLM image validation called by the photo uploader |
| `GET /notifications` | Bearer | Own notifications |
| `PATCH /notifications/{id}/read`, `/notifications/read-all` | Bearer | Read state |
| `POST /transcribe` | Bearer | Sarvam STT (flag-gated) |
| `POST /grievance-intake/extract` | Bearer | Stateless conversational extraction |
| `GET /config` | Public | Feature flags such as face auth |
| `GET /health` | Public | Availability/storage mode |

### 2.4 Documentation Versus Implementation: Headline Deltas

These are investigated in detail in §18; they are repeated here so testers do
not encode the older documentation as expected behaviour.

| Topic | Documentation says | Implementation does |
|---|---|---|
| Public tracking | PRD/older workflow text implies reference-ID lookup | `/track` is sign-in-only; public search removed (DEC-028) |
| Citizen detail | PRD lists comments, resolution, feedback, AI analysis | Citizen modal shows status, timeline, title, description, location, photo; hides routing, AI, officer updates, resolution text |
| Attachments | PRD says attachments; security doc lists PDF/JPG/PNG/DOCX | One image only: JPEG/PNG/WebP, 10 MB |
| AI execution | Async and non-blocking | Classification is synchronous on submit; AI image validation failure returns 500 and blocks a photo submission |
| AI modules | AI-01…AI-11 listed | Only classification/priority/quality flag are implemented |
| Non-civic submissions | DEC-049: flag for review, never auto-reject | DEC-062: clear non-civic text returns 422 before any write; ambiguous/uncertain text remains reviewable |
| Profile API | `docs/API.md` lists `/users/me` update | No such citizen endpoint; UI cannot edit name/address/DOB |
| Password reset | Common auth expectation | Not implemented; support `mailto:` only |
| Status history | Every transition recorded and viewable | Stored in `stateHistory`; citizen UI shows only a static milestone timeline |
| Logout | Server-side invalidation implied | Client clears tokens; refresh tokens are not revoked server-side |
| Token lifetime | Security doc recommends 15 minutes | Default access lifetime is 60 minutes |
| Architecture | Older doc mentions NextAuth/PostgreSQL | JWT + MongoDB are the serving stack (DEC-010/DEC-011/DEC-017) |

---

## 3. Test Conventions

### 3.1 Case Format

Every case uses the requested fields:

`Test Case ID · Module · Scenario Title · Scenario Type · Priority ·
Preconditions · Test Data · Steps · Expected Result · Actual Result · Status ·
Automation Candidate · Requirements Reference · Notes`

- **Steps** are numbered inside the table cell using `<br>` for readability.
- **Actual Result** is `—` until executed.
- **Status** is `Not Run` for every case in this version.
- **Automation Candidate**: `Yes` (stable API/browser flow), `Partial`
  (needs seeded state or external service), `No` (human judgement,
  accessibility, real microphone/OTP).
- **Requirements Reference** cites PRD IDs, decisions (`DEC-*`), and docs.
  Where no requirement exists, the cell says `Derived from implementation` and
  the case is marked as an observation, not a requirement.

### 3.2 Module Prefixes

| Prefix | Area |
|---|---|
| `USR-AUTH` | Registration, login, session, profile, phone/face account settings |
| `USR-NAV` | Navigation, routing, refresh/back, loading/empty states |
| `USR-ACC` | Accessibility, i18n, responsive behaviour |
| `USR-GRV` | Grievance form, validation, photo, location, submission |
| `USR-AI` | Citizen-visible effects of classification, quality flag, extraction |
| `USR-VOICE` | Conversational voice intake and STT/extraction failures |
| `USR-TRACK` | Personal list, detail, lifecycle, status display |
| `USR-COMM` | Notifications, SMS consent, missing communication features |
| `USR-DASH` | Dashboard counts, sorting, list limits, data isolation |
| `USR-ERR` | Backend/network/timeout/recovery behaviour |
| `USR-SEC` | Authentication/authorization/privacy from the user side |
| `USR-API` | API contract and technical checks under the UI |
| `E2E` | Cross-layer user journeys |

### 3.3 Test Account Convention

Examples in this document use placeholders such as:

- `citizen.a+<run>@example.test` / `Citizen#123`
- `citizen.b+<run>@example.test` / `Citizen#123`
- `98765 00001`, `98765 00002` (synthetic placeholders; **not** an officially
  reserved phone range)

Replace `<run>` with a timestamp or short random suffix. Never use a real
person's email, phone number, or address. Phone cases must run with the
dry-run provider, or with a handset/SIM that the test team controls; do not
send real SMS to an arbitrary placeholder number.

### 3.4 Recording Results

For each executed case record:

1. Build/commit, frontend URL, backend URL, database mode, feature flags.
2. Account alias and generated grievance reference ID.
3. Exact observed text/status code, not a paraphrase.
4. Screenshot/trace path and request ID where available.
5. Pass/Fail/Blocked plus defect ID.
6. Any deviation from this document's preconditions or data.

---

## 4. Coverage Summary

> Counts below are the planned suite size, not execution results. All cases
> are `Not Run`. The per-priority split is generated from the case tables and
> will be refreshed whenever cases are added or removed.

| Module | Cases | P0 | P1 | P2 | P3 | Main layers |
|---|---:|---:|---:|---:|---:|---|
| Authentication and account | 25 | 6 | 11 | 8 | 0 | UI + API |
| Navigation | 10 | 1 | 3 | 5 | 1 | UI + manual |
| Accessibility and i18n | 12 | 0 | 7 | 4 | 1 | UI + manual |
| Grievance submission | 20 | 4 | 8 | 8 | 0 | UI + API |
| AI-assisted processing | 10 | 0 | 6 | 4 | 0 | UI + API |
| Voice-assisted intake | 20 | 0 | 12 | 8 | 0 | UI + service |
| Tracking and status | 15 | 3 | 5 | 7 | 0 | UI + API |
| Communication and notifications | 10 | 2 | 3 | 4 | 1 | UI + API |
| Dashboard and list | 6 | 2 | 1 | 3 | 0 | UI + API |
| Error handling and reliability | 12 | 2 | 6 | 4 | 0 | UI + API |
| Security and privacy | 14 | 7 | 5 | 2 | 0 | UI + API |
| API technical checks | 16 | 6 | 8 | 2 | 0 | API |
| **Module totals** | **170** | **33** | **75** | **59** | **3** | |
| End-to-end journeys | 12 | 4 | 7 | 1 | 0 | UI + API + DB |
| **Grand total** | **182** | **37** | **82** | **60** | **3** | |

**Automation profile:** 55 `Yes`, 91 `Partial`, 24 `No` across the 170 module
cases; 2 `Yes`, 8 `Partial`, 2 `No` across the 12 E2E journeys.

> **Note:** the summary table is a planning aid. If a case is reclassified, update
> both the case row and this table. The execution record in §20 is the only
> authoritative place for Pass/Fail/Blocked counts.

## 5. Authentication and Account Management (USR-AUTH)

**What is covered:** registration with the hardened profile fields and captcha,
post-registration phone proof, password login, phone OTP login, logout, session
restore, token refresh, protected-route gating, Google OAuth, profile viewing,
phone/SMS settings, password-recovery guidance, and optional face settings.

**What is not covered here:** RBAC attacks against staff APIs (see `USR-SEC`),
session expiry during a mid-air submission (see `USR-ERR`), and face-model
accuracy (out of scope).

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-AUTH-001 | Authentication | Register a new citizen with a complete valid profile | Positive | P0 | Backend and frontend running in live mode; captcha service available; synthetic email and phone unused; database clean for this run | Name `Asha Patil`; email `citizen.a+<run>@example.test`; password `Citizen#123`; address `12 MG Road, Pune 411001`; DOB `1995-04-12`; occupation `farmer`; gender `female`; phone `9876500001`; solved captcha | 1. Open `/register`.<br>2. Fill every required field in the two-column form.<br>3. Solve the captcha challenge.<br>4. Click Create account and wait for the response.<br>5. Do not complete the phone OTP step; click Skip for now. | Account is created with HTTP 201; access and refresh tokens are stored; the post-registration phone step appears; Skip for now is available; `/submit` treats the user as signed in; the new record has role `USER` and the supplied profile values; no console or server error. | — | Not Run | Partial | PRD FR-AUTH-001; DEC-031; DEC-050 | Account exists before phone proof; phone remains unverified if skipped. UI enforces name/email/password/address/DOB/occupation/gender/phone; backend also enforces address 10–500, age 18–120, occupation 2–100. |
| USR-AUTH-002 | Authentication | Verify the phone number immediately after registration | Positive | P1 | USR-AUTH-001 completed and the phone step is visible; SMS provider is dry-run with OTP debug return enabled (local only) | Phone `9876500001`; six-digit code from `debug_code` in the request-OTP response | 1. On the phone step, request a code.<br>2. Read the local debug code.<br>3. Enter the six digits and submit.<br>4. Open `/profile`. | Code request succeeds without exposing whether the number already exists; the correct code marks the number verified; the success card appears; `/profile` shows a masked number and a Verified badge; SMS consent remains off; no OTP value appears in logs or URL. | — | Not Run | Partial | PRD FR-AUTH-001; DEC-031; DEC-046 | In staging/production the tester must receive a real test-SMS; never use a real citizen number. |
| USR-AUTH-003 | Authentication | Duplicate email cannot create a second account | Negative | P1 | A citizen account already exists for `citizen.a+<run>@example.test` | Existing email; new phone `9876500002`; otherwise valid profile and captcha | 1. Open `/register`.<br>2. Enter the existing email and a different valid phone.<br>3. Complete the form and captcha.<br>4. Submit. | HTTP 409; visible message says the email is already registered; no second user or token set is created; the original account remains accessible; the form retains entered values. | — | Not Run | Yes | PRD FR-AUTH-001; NFR-SEC-002 | The backend checks email uniqueness before creating the user. |
| USR-AUTH-004 | Authentication | Mandatory and malformed signup fields are rejected | Negative | P2 | `/register` open in live mode; no account created yet | Blank name; `asha@`; 5-character address; blank occupation; blank gender; future DOB | 1. Submit with each invalid value in turn (one field at a time).<br>2. Observe inline and general errors.<br>3. Optionally force the same payload directly to the API. | The UI blocks submission with field-specific messages; no account is created; when forced, the API returns 400/422 with a human-readable reason (not a stack trace); valid fields remain populated for correction. | — | Not Run | Partial | PRD FR-AUTH-001; DEC-031; NFR-SEC-002 | UI requires all fields but does not enforce the backend address minimum or occupation maximum; the API must still reject them. |
| USR-AUTH-005 | Authentication | Password shorter than eight characters is rejected | Boundary | P2 | `/register` open; no account created | Password `Abc1234` (7 characters); otherwise valid profile | 1. Fill the form with the short password.<br>2. Submit.<br>3. Repeat against the API with a valid captcha. | Client shows a password-length message and sends no request; API returns 400/422 with a length reason; no account is created. | — | Not Run | Yes | PRD FR-AUTH-001; NFR-SEC-003 | Backend validator enforces at least 8 characters. A strength hint is informational, not a substitute for the check. |
| USR-AUTH-006 | Authentication | Under-18 date of birth is rejected | Boundary | P1 | `/register` open; no account created | DOB exactly 17 years 364 days before today; a second attempt with exactly 18 years | 1. Enter the under-18 DOB using the date input or a direct request.<br>2. Submit.<br>3. Retry with the exactly-18 date. | Under-18 attempt is rejected by the UI and by the API; no account is created; the exactly-18 attempt is accepted if all other fields are valid. | — | Not Run | Yes | DEC-031; PRD FR-AUTH-001 | UI caps the picker at 18 years ago, but the API must remain authoritative. |
| USR-AUTH-007 | Authentication | Invalid and already-registered phone numbers are rejected | Negative | P1 | One account exists with phone `9876500001`; `/register` open | `12345`; `5876500001` (does not start 6–9); `9876500001` | 1. Try each number in turn with an otherwise valid form.<br>2. Observe the UI and API response. | Invalid formats are blocked with a clear Indian-mobile message; the duplicate number returns 409; no second account is created; the error does not disclose another user's name or email. | — | Not Run | Yes | DEC-031; PRD FR-AUTH-001 | Phone is optional at the API level but required by the live UI; this delta is recorded in G-14. |
| USR-AUTH-008 | Authentication | Wrong or expired captcha is rejected and refreshable | Negative | P2 | `/register` open; captcha challenge loaded | Wrong 5-character solution; then an expired challenge (older than five minutes); then a fresh correct solution | 1. Submit with a wrong captcha.<br>2. Refresh the challenge.<br>3. Submit an expired challenge (wait or use a stale ID).<br>4. Solve a fresh challenge correctly. | Wrong/expired captcha returns 400 with a captcha-specific message; no account is created; the challenge can be refreshed; a fresh correct challenge allows registration; the old challenge cannot be reused. | — | Not Run | Partial | DEC-031 | Captcha is single-use and limited to three attempts; do not disable it to make the test pass. |
| USR-AUTH-009 | Authentication | Wrong, expired, and un-resendable phone OTP | Negative | P2 | Account created and phone step visible; local dry-run code available | Wrong code `000000`; expired code; correct current code | 1. Enter a wrong code and submit.<br>2. Observe the error and the available controls.<br>3. Wait for expiry and retry.<br>4. Check whether a resend control exists. | Wrong/expired code is rejected with a clear message; the number is not marked verified; the correct current code succeeds; the UI offers a documented resend/recovery path or clearly explains how to obtain a new code. | — | Not Run | Partial | DEC-031; DEC-046 | Implementation observation: the post-register step exposes verify but no resend button. If confirmed, record a usability gap rather than marking Pass. |
| USR-AUTH-010 | Authentication | Valid email and password signs the citizen in | Positive | P0 | Existing verified citizen; backend up; no active session in this browser | `citizen.a+<run>@example.test`; `Citizen#123` | 1. Open `/login`.<br>2. Select the password tab.<br>3. Enter email and password.<br>4. Submit. | Tokens are stored; the user is routed to `/submit` (or the safe `next` target); the header shows the signed-in state; no password or token is written to the URL or console. | — | Not Run | Yes | PRD FR-AUTH-001; NFR-SEC-004 | Staff accounts route to staff surfaces; this case is citizen-only. |
| USR-AUTH-011 | Authentication | Wrong password and unknown email produce the same generic failure | Negative | P0 | Existing citizen; `/login` open | Correct email + `WrongPass!1`; unknown email + any password | 1. Submit the wrong password.<br>2. Submit the unknown email.<br>3. Compare status, message, and timing. | Both return HTTP 401 with the same generic message; no tokens are issued; the response does not reveal whether the email exists; the form remains usable for another attempt. | — | Not Run | Yes | PRD FR-AUTH-001; NFR-SEC-002 | Avoid asserting exact timing; only assert that no account-enumeration message appears. |
| USR-AUTH-012 | Authentication | Email login is case-insensitive and trims whitespace | Boundary | P2 | Existing account for `citizen.a+<run>@example.test` | `  Citizen.A+<RUN>@Example.Test  ` and the correct password | 1. Open `/login`.<br>2. Enter the mixed-case, padded email.<br>3. Submit. | Login succeeds; the account is normalized to lower case; no duplicate account is created; the signed-in email is displayed in a normal form. | — | Not Run | Yes | PRD FR-AUTH-001 | Backend validator lowercases and trims before lookup. |
| USR-AUTH-013 | Authentication | Verified citizen signs in with a phone OTP | Positive | P1 | Citizen account has a verified phone; SMS dry-run with debug code; `/login` open | Phone `9876500001`; debug OTP | 1. Open the phone tab.<br>2. Enter the verified number.<br>3. Request a code.<br>4. Enter the code and verify. | Generic request response; correct code returns access and refresh tokens; citizen lands on `/submit` or safe `next`; an unverified or unknown number never receives a usable code. | — | Not Run | Partial | PRD FR-AUTH-001; DEC-046 | Only `USER` accounts with `phoneVerifiedAt` are eligible. |
| USR-AUTH-014 | Authentication | Phone OTP request does not reveal whether a number exists | Negative | P1 | `/login` phone tab; one verified and one unknown number | Verified `9876500001`; unknown `9876500099` | 1. Request a code for the verified number and record the response body.<br>2. Request a code for the unknown number.<br>3. Compare messages and status codes. | Both requests return the same generic message and status; the unknown number receives no SMS and no debug code; verification with a guessed code fails; no account details leak. | — | Not Run | Yes | DEC-046; NFR-SEC-002 | This is the anti-enumeration contract for phone login. |
| USR-AUTH-015 | Authentication | Signing out clears the session and protects cached pages | Security | P0 | Citizen signed in on `/track` with at least one grievance | Browser DevTools/localStorage inspection | 1. Click Sign out in the header.<br>2. Inspect localStorage for access, refresh, and demo-user keys.<br>3. Press Back to return to `/track`.<br>4. Reload. | Sign-out clears the stored user and both tokens; `/track` shows the sign-in gate and no grievance data; Back does not reveal a cached signed-in view; reload stays signed out. | — | Not Run | Yes | NFR-SEC-004; DEC-050 | Logout is client-side; server-side refresh-token revocation is a separate gap (G-16). |
| USR-AUTH-016 | Authentication | Refreshing or reopening the app restores a valid session without a sign-in flash | Positive | P0 | Citizen signed in and tokens valid; `/track` open | Existing account and session | 1. Reload `/track`.<br>2. Observe the first paint and the network calls.<br>3. Close the tab and reopen `/track`.<br>4. Navigate between `/submit`, `/track`, and `/profile`. | The user state is restored from local storage synchronously; no “Sign in” flash appears; `/auth/me` confirms the session; protected content remains available; a transient network error during restore does not erase tokens. | — | Not Run | Yes | DEC-050; NFR-SEC-004 | DEC-050 explicitly hardened this path. |
| USR-AUTH-017 | Authentication | An expired access token is refreshed transparently during a request | Recovery | P1 | Access token lifetime set short in the test environment; valid refresh token; signed-in citizen | Access token expired; refresh token valid; `/track` or `/submit` action | 1. Wait for the access token to expire.<br>2. Trigger a protected request (load list or submit).<br>3. Observe the network sequence and final page. | Request initially returns 401; the client calls `/auth/refresh` once; new access and refresh tokens are stored; the original request is retried and succeeds; the user stays signed in; no duplicate submission occurs. | — | Not Run | Partial | PRD FR-AUTH-004; NFR-SEC-004 | If multiple requests race, only one refresh should be active; downstream requests must reuse the result. |
| USR-AUTH-018 | Authentication | An invalid or expired refresh token forces a clean sign-in | Security | P1 | Access token expired; refresh token corrupted/expired; `/track` open | Tampered refresh token or expired fixture | 1. Replace the refresh token with an invalid value.<br>2. Trigger a protected request.<br>3. Observe storage, page, and retry behaviour. | Refresh fails; tokens and cached user are cleared; the UI shows a sign-in prompt or redirects with `next`; no infinite refresh loop; no protected data remains visible; a new login works. | — | Not Run | Yes | PRD FR-AUTH-004; NFR-SEC-004 | Network failure during refresh is different: it should preserve tokens for retry (see USR-ERR-005). |
| USR-AUTH-019 | Authentication | Protected citizen routes are gated when signed out | Security | P0 | No tokens; clean browser; backend up | `/submit`, `/track`, `/profile`, `/notifications`; optionally `/admin`, `/resolver` | 1. Visit each URL directly in a fresh tab.<br>2. Observe the rendered state and network calls.<br>3. Attempt to use browser Back/Forward. | Citizen routes show a sign-in gate or redirect to `/login?next=<path>`; no grievance, profile, or notification data flashes; staff routes show access-denied or sign-in, never staff data; URL tampering does not grant access. | — | Not Run | Yes | NFR-SEC-002; DEC-028 | `/track` is sign-in-only by design (DEC-028). |
| USR-AUTH-020 | Authentication | Login honours only a safe internal next path | Security | P1 | Signed-out citizen; valid account | `/login?next=/track`; `/login?next=https://evil.example`; `/login?next=//evil.example`; staff account with `next=/track` | 1. Log in with the internal `next`.<br>2. Repeat with each external/ambiguous target.<br>3. Repeat with a staff account. | Internal path is used after login; external and protocol-relative targets are ignored and fall back to a safe citizen/staff home; no open redirect; staff never land on a citizen-only target that would immediately gate them. | — | Not Run | Partial | NFR-SEC-002 | Implementation accepts only paths starting with `/` and not `/submit`; verify that `//evil` is not treated as internal. |
| USR-AUTH-021 | Authentication | Google OAuth succeeds when configured and degrades safely when not | Integration | P1 | Case A: Google client credentials configured with a synthetic test account. Case B: credentials absent | Google test account; callback URL registered | 1. Click Continue with Google.<br>2. Complete the consent screen with the test account.<br>3. Verify the callback and landing page.<br>4. Repeat with credentials removed. | With credentials, a user is created/reused, tokens are stored, and the user lands on the citizen home; without credentials, the button/route fails with a readable message, password login still works, and no blank screen or secret is exposed. | — | Not Run | No | PRD FR-AUTH-002 | External dependency; record whether the run used a real Google project. Callback tokens in the query string are a risk (G-18). |
| USR-AUTH-022 | Authentication | Citizen can view account details but cannot edit identity fields | Positive | P2 | Signed-in citizen with a complete profile; `/profile` open | Name, email, role, phone, address, DOB, occupation, gender | 1. Open `/profile`.<br>2. Compare displayed values with registration data.<br>3. Look for edit controls for name/address/DOB.<br>4. Try `PATCH /users/me` directly. | Name, email, role, and masked phone are shown; no UI control edits name/address/DOB; phone and face settings are the only editable account areas; a direct unsupported update returns 404/405 and no change occurs. | — | Not Run | Partial | PRD FR-AUTH-001; PRD UI page requirements | Documented `/users/me` update is absent; this is a coverage gap (G-14), not a pass. |
| USR-AUTH-023 | Authentication | Phone binding, unbinding, and SMS consent stay consistent | Functional | P1 | Signed-in citizen with no verified phone; SMS dry-run; `/profile` open | New phone `9876500002`; OTP; then unbind using an OTP for the current number | 1. Bind the new number via OTP.<br>2. Confirm it is masked and marked Verified.<br>3. Enable SMS updates; reload.<br>4. Disable SMS updates; reload.<br>5. Unbind with a wrong OTP, then the correct OTP. | Binding succeeds only with a valid OTP; masked number and Verified badge appear; consent defaults off and persists across reload; disabling persists; wrong unbind OTP changes nothing; correct unbind removes the number and automatically opts out of SMS. | — | Not Run | Partial | PRD FR-NOT-001; DEC-046 | With the dry-run provider, no external SMS is sent; verify log entries do not contain the number, body, or OTP. |
| USR-AUTH-024 | Authentication | Password recovery guidance is clear and does not pretend to be self-service | Usability | P2 | `/login` open; signed-out state | The Forgot password link | 1. Click Forgot password.<br>2. Observe the destination and any instructions.<br>3. Return to login. | The user is told there is no automated reset and is given a working support contact; the contact matches the current SAMARTH brand; no password is requested by email; login remains usable. | — | Not Run | No | PRD FR-AUTH-001; PRD UI page requirements | Observed destination is a `mailto:` link using the older `support@grievai.gov.in` address. If confirmed, record as a documentation/branding gap (G-15). |
| USR-AUTH-025 | Authentication | Optional face settings are hidden or usable according to the feature flag | Optional | P2 | Case A: `FACE_AUTH_ENABLED=false`. Case B: enabled, camera available; test account eligible | Test citizen with verified phone; camera permission allow/deny | 1. With the flag off, open `/login` and `/profile`; look for face controls.<br>2. With the flag on, open Profile, grant camera consent, enrol, then check status.<br>3. Deny camera and retry enrolment.<br>4. If 2FA is required, sign out and sign in again. | Flag off: no face card/tab and no broken request. Flag on: consent is explicit; successful enrolment shows enrolled status; denial shows a clear camera error and leaves no partial template; a required second factor completes login only after a successful face check, and cancelling returns to password login. | — | Not Run | No | DEC-024; DEC-025 | Optional, environment-dependent. Do not assess recognition accuracy here. |

## 6. Navigation, Internationalisation, and Accessibility

### 6.1 Application Navigation (USR-NAV)

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-NAV-001 | Navigation | Public home page exposes the primary citizen journeys | Positive | P1 | Frontend running; signed out; desktop viewport | `/` | 1. Open `/`.<br>2. Inspect the hero, category links, and primary CTAs.<br>3. Click Register Grievance while signed out.<br>4. Return and click Track Grievance. | The page loads without console errors or broken images; Register Grievance and Track Grievance are visible and reachable; each routes to the expected citizen page; the signed-out gate appears for protected targets; no dead link or placeholder text is shown. | — | Not Run | Yes | PRD UI page requirements; DEC-045 | Home-page category links may pre-select context; verify they do not submit anything. |
| USR-NAV-002 | Navigation | Citizen header links route correctly and show the active section | Positive | P2 | Signed-in citizen; `/submit` open; desktop viewport | Header links Home, Register Grievance, Track Grievance; notification icon | 1. Click each header link.<br>2. Observe URL, page heading, and active styling.<br>3. Use the browser Back button.<br>4. Inspect the notification link. | Each link reaches the correct route without a full-page reload; the active section is visually indicated in addition to colour; Back restores the prior page; the notification link reaches `/notifications` and has an accessible name. | — | Not Run | Partial | PRD UI page requirements | Staff users intentionally see a sidebar instead of this header; do not test staff chrome here. |
| USR-NAV-003 | Navigation | Mobile menu opens, navigates, and closes predictably | Positive | P1 | 360×800 viewport; signed-in citizen; `/` open | Hamburger/menu button; Home, Submit, Track links | 1. Open the mobile menu.<br>2. Inspect focus and scroll lock.<br>3. Click a link.<br>4. Reopen and close via the close control or Escape. | The menu opens without horizontal overflow; links are large enough to tap; choosing a link navigates and closes the menu; Escape or the close control closes it; focus does not disappear behind the overlay; the page remains usable. | — | Not Run | Partial | DEC-047; PRD UI page requirements | Verify whether Escape is actually supported; record if not. |
| USR-NAV-004 | Navigation | Browser Back and Forward do not corrupt a multi-step journey | Boundary | P2 | Signed-in citizen; visit home, login state, submit, and track | Browser history for four pages | 1. Navigate Home → Submit → Track.<br>2. Press Back twice, then Forward twice.<br>3. Inspect each page for stale forms, duplicate submits, or lost session. | No page crashes or resubmits automatically; the signed-in session remains; unsaved form text may be lost (record it), but no false success message or duplicate grievance is created; Forward returns to the expected route. | — | Not Run | Partial | General navigation expectation | There is no explicit unsaved-changes guard; the draft-loss observation is tracked in G-21. |
| USR-NAV-005 | Navigation | Unknown routes show a useful not-found page | Negative | P3 | Signed out and signed in | `/does-not-exist`; `/track/not-a-grievance` | 1. Visit each unknown URL.<br>2. Reload once. | A branded not-found page appears; the header/footer remain usable; no stack trace, framework debug panel, or internal file path is shown; the page offers a route back home or to tracking. | — | Not Run | Yes | General usability | Next.js default 404 is acceptable if branded and free of internals. |
| USR-NAV-006 | Navigation | Direct deep link to personal tracking while signed out is gated | Security | P0 | No tokens; `/track` known | `/track` and `/track?grievance=GRV-...` | 1. Open each URL directly.<br>2. Inspect the first paint and network calls.<br>3. Try to read any grievance data from the DOM or cache. | The sign-in gate or a redirect to `/login?next=/track` appears; no personal data or counts are rendered or fetched successfully; no reference-ID search box is present (DEC-028); signing in returns the user to tracking. | — | Not Run | Yes | DEC-028; NFR-SEC-002 | Public reference lookup was intentionally removed from the UI. |
| USR-NAV-007 | Navigation | Loading states are visible and do not masquerade as empty data | Positive | P2 | Throttled network (Slow 3G) or a delayed test endpoint; signed-in citizen | `/track` with a delayed list; `/submit` during session restore | 1. Reload `/track` under throttling.<br>2. Observe the first two seconds.<br>3. Reload `/submit` and observe the session-check state.<br>4. Let the requests finish. | A spinner/status message appears while loading; “no grievances” is not shown before the request resolves; controls that depend on data are disabled or clearly pending; the final state replaces the loader without a layout jump. | — | Not Run | Partial | General usability; DEC-050 | The track page explicitly distinguishes `isLoading` from an empty list. |
| USR-NAV-008 | Navigation | New accounts see meaningful empty states | Positive | P2 | Fresh citizen with zero grievances and zero notifications | `/track`, `/notifications`, `/submit` list area | 1. Open each page.<br>2. Inspect counts and empty-state copy.<br>3. Follow the suggested next action. | Every count is zero, including total/open/in-progress/resolved; an empty-state message explains what will appear; a CTA leads to submitting a grievance; the notifications inbox says the user is caught up; no fabricated sample grievances appear in live mode. | — | Not Run | Partial | PRD FR-GRV-006; PRD FR-NOT-004 | Mock mode does show sample data by design; this case is live-mode only. |
| USR-NAV-009 | Navigation | A failed personal-list request is shown as an error, not as “no grievances” | Recovery | P1 | Signed-in citizen with at least one grievance; intercept `GET /grievances` to return 500 or drop the connection | `/track` under a failing list request | 1. Intercept the list request and force a 500 or network failure.<br>2. Reload `/track`.<br>3. Observe the rendered state and retry controls.<br>4. Restore the request and retry. | A clear error state appears, distinct from the empty state; a Retry action re-fetches; existing grievance data is not replaced by zero counts or a false “no grievances” message; recovery restores the list. | — | Not Run | Partial | General reliability; PRD error/edge cases | Implementation observation: the catch branch sets the list to an empty array, which renders the empty state. If reproduced, this is a P1 usability defect (G-11). |
| USR-NAV-010 | Navigation | Notification badge and inbox navigation agree | Integration | P2 | Signed-in citizen with one unread notification; `/track` open | Notification badge in header; inbox item with a grievance entity ID | 1. Observe the badge count.<br>2. Click it and open the inbox.<br>3. Mark the item read.<br>4. Return to `/track` and wait for the next poll. | The badge shows the unread count; clicking reaches `/notifications`; marking read updates the inbox and the badge without a reload; the badge does not count another user's notifications; no duplicate toast appears on repeated polls. | — | Not Run | Partial | PRD FR-NOT-004/005; DEC-050 | The citizen “Open” link currently lands on `/track`, not the specific grievance; see G-27. |

### 6.2 Accessibility and Internationalisation (USR-ACC)

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-ACC-001 | Accessibility | Authentication can be completed with the keyboard only | Accessibility | P1 | Signed-out browser; no mouse/touch; `/login` and `/register` available | Valid synthetic credentials | 1. Use Tab/Shift+Tab through login.<br>2. Activate tabs, password visibility, and submit with Enter/Space.<br>3. Repeat for registration, including captcha refresh and OTP code entry. | Every interactive control is reachable in a logical order; focus is always visible; Enter/Space activates buttons; no keyboard trap; error messages are reachable; the journey can be completed without a pointer. | — | Not Run | No | PRD UI page requirements; accessibility baseline | Captcha entry is keyboard-friendly; do not disable it for this case. |
| USR-ACC-002 | Accessibility | Grievance form and location picker are keyboard operable | Accessibility | P1 | Signed-in citizen; `/submit` open; a saved home location search term available | Keyboard only; valid title/description; landmark `Shivajinagar, Pune` | 1. Reach the mode toggle, fields, location controls, photo input, and submit using Tab.<br>2. Open the location picker and navigate search results with the keyboard.<br>3. Confirm a pin and complete submission. | All required controls receive focus and have accessible names; the map dialog can be opened, searched, confirmed, and cancelled by keyboard; focus is not lost inside the map; the form can be submitted without a pointer. | — | Not Run | No | DEC-047; DEC-050; accessibility baseline | Leaflet map internals may require keyboard alternatives; record any pointer-only step as a gap. |
| USR-ACC-003 | Accessibility | Grievance detail dialog behaves like a modal for keyboard and screen-reader users | Accessibility | P1 | Signed-in citizen with one grievance; `/track` open | One grievance card | 1. Focus a card and press Enter.<br>2. Observe where focus moves.<br>3. Press Tab repeatedly and Shift+Tab.<br>4. Press Escape.<br>5. Activate the Close button. | The dialog has a name and `aria-modal`; focus moves into the dialog and does not escape to the page behind it; Escape closes it; focus returns to the invoking card; background content is not reachable while open. | — | Not Run | No | Accessibility baseline | Implementation has dialog semantics and Escape, but no obvious focus trap or focus restoration. Record observed behaviour. |
| USR-ACC-004 | Accessibility | Form controls have programmatic labels, required state, and associated errors | Accessibility | P1 | `/register`, `/login`, `/submit` available; browser accessibility tree open | Empty/invalid form submissions | 1. Inspect the accessible name of every input and select.<br>2. Submit an empty form.<br>3. Inspect `aria-invalid`, `aria-describedby`, and the error node.<br>4. Repeat for the phone/OTP fields. | Each field has a programmatic label, not just a placeholder; required fields expose required/aria-required; errors are associated with the field and announced; help text is associated; the captcha image has an accessible alternative or instruction. | — | Not Run | No | Accessibility baseline | The shared Field component provides visible labels; verify error association rather than assuming it. |
| USR-ACC-005 | Accessibility | Validation and submission errors are announced to assistive technology | Accessibility | P1 | `/submit` open; screen reader or an accessibility-tree inspection tool | Empty title, short description, no location | 1. Submit an empty form.<br>2. Listen for/observe the error announcement.<br>3. Repeat after a simulated server 500.<br>4. Check focus placement. | A live region or alert announces the error summary; focus moves to the first invalid field or the summary; the user can navigate to each error; the error text is not colour-only; a server failure is announced without a page reload. | — | Not Run | No | Accessibility baseline; PRD error/edge cases | Use VoiceOver/NVDA or the browser accessibility tree; no automated pass alone. |
| USR-ACC-006 | Accessibility | Keyboard focus is always visible, including on cards and custom controls | Accessibility | P2 | Keyboard only; `/`, `/track`, and `/submit` available | Grievance card, mode toggle, icon buttons, links | 1. Tab through the page.<br>2. Observe the focus indicator on each control.<br>3. Repeat in dark/branded areas.<br>4. Test with 200% zoom. | Every focusable element shows a visible focus indicator with sufficient contrast; custom radio cards and clickable grievance cards do not suppress focus without a replacement; focus is not indicated by colour alone. | — | Not Run | No | Accessibility baseline | The grievance card uses a `focus:outline-none` class; verify whether an alternative ring exists. |
| USR-ACC-007 | Accessibility | Loading, status, and unread information is exposed as text, not only colour | Accessibility | P2 | Signed-in citizen with one unread notification and one grievance in progress | `/track`, `/notifications`, `/submit` during a request | 1. Inspect loading indicators for `role=status` or equivalent.<br>2. Inspect status badges and timeline items.<br>3. Inspect the unread notification indicator.<br>4. Navigate with a screen reader. | Loading messages are announced; status names are available as text; the timeline uses an ordered list with meaningful labels; unread state is conveyed by more than a background colour; icons that convey meaning have accessible names. | — | Not Run | No | Accessibility baseline | The app already uses several `role=status` and `aria-live` regions; verify coverage, not just presence. |
| USR-ACC-008 | Accessibility | Text and essential UI meet WCAG AA contrast | Accessibility | P2 | Main pages rendered at normal zoom; contrast checker available | Home, login, register, submit, track, notifications, profile | 1. Measure contrast for body text, muted text, links, primary buttons, error text, badges, and disabled controls.<br>2. Test hover/focus/visited states.<br>3. Record any ratio below 4.5:1 for normal text or 3:1 for large text/UI boundaries. | Essential text and controls meet the applicable AA thresholds, or every exception is documented with a remediation plan; information is never conveyed by low-contrast colour alone. | — | Not Run | No | Accessibility baseline | Automated tools flag candidates; confirm manually before filing. |
| USR-ACC-009 | Accessibility | The interface remains usable at 200% zoom and with increased text spacing | Accessibility | P2 | Desktop browser; 1280×800 baseline; zoom/text-spacing controls | 200% zoom; WCAG 1.4.12 spacing overrides | 1. Set zoom to 200%.<br>2. Visit each citizen page and open the detail dialog.<br>3. Apply increased line/letter/word spacing.<br>4. Attempt a full submission flow. | No content is clipped or overlaps; no horizontal scrolling is required for a single-column layout at 320 CSS pixels equivalent; buttons and fields remain operable; text does not disappear behind fixed elements; the dialog remains scrollable. | — | Not Run | No | Accessibility baseline; DEC-047 | Mobile 360px checks are related but not identical to zoom. |
| USR-ACC-010 | Accessibility | Citizen pages remain usable on mobile, tablet, and desktop without overflow | Accessibility | P1 | Responsive mode; 360×800, 768×1024, 1440×900 viewports; signed-in citizen with long text | One long-title grievance; Hindi text; location buttons; notification row | 1. Visit home, login, register, submit, track, notifications, and profile at each viewport.<br>2. Open the location dialog and the grievance detail dialog.<br>3. Check horizontal scroll, tap-target size, clipped labels, and sticky elements. | No horizontal page scroll; primary buttons are at least 44×44 CSS pixels or have equivalent spacing; long titles and Hindi/Marathi text wrap rather than overflow; dialogs fit and scroll; the submit button and form fields remain reachable above the keyboard/viewport. | — | Not Run | No | DEC-047; DEC-050; PRD UI page requirements | The project explicitly fixed mobile overflow in DEC-047; re-verify after new UI changes. |
| USR-ACC-011 | Accessibility | English, Hindi, and Marathi switching is complete and persistent | Accessibility | P1 | Signed-in citizen; language picker available; browser storage enabled | `en`, `hi`, `mr`; a grievance with Devanagari text | 1. Switch to Hindi and inspect navigation, form labels, validation, buttons, statuses, and empty states.<br>2. Switch to Marathi and repeat.<br>3. Reload and reopen a new tab.<br>4. Inspect the document language attribute and text overflow. | All visible citizen copy is translated (no raw i18n keys); the choice persists across reload/new tab; `<html lang>` matches the choice; Hindi/Marathi text renders without clipping; validation and status messages remain understandable; date/number formatting is locale-appropriate or at least unambiguous. | — | Not Run | Partial | DEC-026; PRD UI page requirements | Only en/hi/mr are selectable; eight additional packs are bundled but hidden. Record any raw key as a translation gap. |
| USR-ACC-012 | Accessibility | Motion respects reduced-motion preferences and never blocks a task | Accessibility | P3 | OS/browser set to `prefers-reduced-motion: reduce`; citizen pages available | Home reveal animations, spinner, map, toast | 1. Enable reduced motion.<br>2. Visit home and submit pages.<br>3. Trigger a toast and a loading state.<br>4. Complete submission. | Nonessential entrance/scroll animations are reduced or removed; essential progress indicators remain understandable; no animation prevents interaction; the user can complete the task without motion. | — | Not Run | No | Accessibility baseline | Verify whether the CSS actually honours the media query; record if it does not. |

## 7. Grievance Registration and Submission (USR-GRV)

**What is covered:** the complete manual submission form, validation
boundaries, Unicode and injection-looking text, location capture and fallback,
photo evidence and its failure modes, double-submit prevention, and network
loss during submission.

**Known product choices:** location is mandatory in the citizen UI even though
the API does not require it; category/department are not citizen inputs; only
one image is supported; AI classification is synchronous and hidden from the
citizen.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-GRV-001 | Grievance submission | Submit a valid manual grievance with the minimum required information | Positive | P0 | Signed-in citizen; backend and geocoder available; no draft in the form | Title `No water supply in Sector 12`; description `The main pipeline near the community hall has been dry for three days and residents are buying tanker water.`; location `Shivajinagar, Pune`; no photo | 1. Open `/submit` in manual mode.<br>2. Fill title and description.<br>3. Search for the location, select the result, and confirm the pin.<br>4. Click Submit once.<br>5. Wait for the confirmation. | HTTP 2xx; a new `GRV-YYYY-NNNN` reference appears in the success card and toast; copy says the complaint is registered/awaiting review, with no category, department, priority, or confidence; the form resets; the item appears in the personal list; the record belongs to the signed-in user; a submission notification is created. | — | Not Run | Yes | PRD FR-GRV-001/002/003; DEC-044 | Location is mandatory only in the UI; the API accepts a submission without coordinates (see USR-API-005). |
| USR-GRV-002 | Grievance submission | Submit a valid grievance with one photo attachment | Positive | P1 | Signed-in citizen; Cloudinary test preset configured; image validation available | Valid `water-evidence.jpg` (<1 MB); otherwise valid form | 1. Complete title, description, and location.<br>2. Choose the JPEG in the photo field.<br>3. Wait until the upload reports accepted.<br>4. Submit.<br>5. Open the new grievance detail. | Upload succeeds; the UI reports the photo as added without showing a numeric AI score; submit succeeds; the stored record includes the image URL; the citizen detail shows the photo; the reference and notification are still issued if the photo is the only optional item. | — | Not Run | Partial | PRD FR-GRV-001/014; DEC-044 | The upload goes directly from the browser to Cloudinary, then through LLM validation; a failed submission can leave an orphaned asset. |
| USR-GRV-003 | Grievance submission | Title length boundary is enforced consistently | Boundary | P2 | Signed-in citizen; `/submit` open; valid description and location | Title `Test` (4 characters); title `Water` (5 characters) | 1. Enter the 4-character title and submit.<br>2. Correct it to the 5-character title and submit. | The 4-character title is blocked with a clear minimum-length message and no POST request; the 5-character title is accepted if the rest of the form is valid; no silent truncation or padding occurs. | — | Not Run | Yes | PRD FR-GRV-001; implementation schema | The client minimum is 5 characters; the server only rejects empty/whitespace titles, so the boundary is client-enforced (see G-23). |
| USR-GRV-004 | Grievance submission | Description minimum boundary is enforced consistently | Boundary | P2 | Signed-in citizen; `/submit` open; valid title and location | 19-character description `Water is not coming`; 20-character description `Water is not coming.` | 1. Submit with the 19-character description.<br>2. Submit with the 20-character description. | The 19-character value is blocked with a minimum-length message and no POST; the 20-character value is accepted and persisted exactly; the form does not silently add characters. | — | Not Run | Yes | PRD FR-GRV-001; implementation schema | Server-side only requires non-empty description, so direct API calls can bypass this boundary. |
| USR-GRV-005 | Grievance submission | Submission without a location is blocked with a recoverable error | Negative | P1 | Signed-in citizen; `/submit` open; valid title and description; no pin selected | Valid title/description; no coordinates | 1. Fill title and description only.<br>2. Click Submit.<br>3. Read the message.<br>4. Add a location and submit again. | No POST is sent; a specific “location required” message appears near the form; the title and description remain intact; adding a location allows submission; no reference is issued for the failed attempt. | — | Not Run | Yes | DEC-047; implementation form contract | The location field is custom, so browser-native `required` validation does not cover it. |
| USR-GRV-006 | Grievance submission | Whitespace-only or letterless title/description is rejected | Negative | P2 | Signed-in citizen; `/submit` open; valid location | Title of 5 spaces; description of 30 spaces; separate payload with title `!!!` and description `123 ??? ---` | 1. Enter whitespace-only values and submit.<br>2. Observe the client response.<br>3. Force the whitespace payload directly to the API.<br>4. Force the punctuation/number-only payload directly to the API. | The UI rejects whitespace and sends no POST; the API returns 400 “Missing required fields” for whitespace-only text and a 400 “use words” message for letterless text; no record, reference, notification, or provider call is created. | — | Not Run | Yes | PRD FR-GRV-001; DEC-059; API error contract | Two server guards: trim/empty check and a Unicode-letter check before provider work (DEC-059). Client zod `min` counts whitespace, so the API assertions matter. |
| USR-GRV-007 | Grievance submission | Extremely long text is bounded or handled without breaking the journey | Boundary | P1 | Signed-in citizen; `/submit` open; long synthetic text available | 5,000-character title; 50,000-character description; valid location | 1. Paste the long title and description.<br>2. Observe field behaviour and any counter/limit.<br>3. Submit.<br>4. If accepted, open the list and detail. | The system either enforces a documented maximum with a clear message or accepts and persists the text without truncation; no 500, browser freeze, or unreadable overflow; list cards clamp long text; the detail remains scrollable and the reference is issued once. | — | Not Run | No | PRD FR-GRV-001; NFR-PERF-001 | No documented citizen-facing maximum was found. Treat the correct bound as a clarification item and record the observed behaviour; do not invent a limit. |
| USR-GRV-008 | Grievance submission | Hindi, Marathi, and mixed-script text round-trips correctly | Positive | P1 | Signed-in citizen; `/submit`; Hindi/Marathi fonts available | Hindi water complaint; Marathi sanitation complaint; emoji `🚰`; Devanagari location `शिवाजीनगर, पुणे` | 1. Submit the Hindi complaint with a Devanagari location.<br>2. Submit the Marathi complaint with emoji.<br>3. Open both list cards and details.<br>4. Re-read after a reload. | Text is stored and displayed exactly (no mojibake, HTML entity leakage, or replacement characters); line breaks are preserved; the reference and notification are issued; the UI wraps long Devanagari text without clipping; search/map selection still works. | — | Not Run | Partial | PRD FR-GRV-001; DEC-026 | Verify the database record as well as the UI; a UI-only pass can hide encoding loss. |
| USR-GRV-009 | Grievance submission | Script/HTML-looking input is rendered as text and never executed | Security | P0 | Signed-in citizen; `/submit`; browser console open | Title `<img src=x onerror=alert(1)>`; description `<script>alert('x')</script> Water supply is disrupted for three days.`; location address with `<b>test</b>` | 1. Submit the payload with a valid location.<br>2. Observe the success card, list card, and detail.<br>3. Check the console for execution or CSP violations.<br>4. Reopen after reload. | No alert/dialog executes; the text is escaped and displayed literally where rendered; the record is stored as text; no script runs in the notification or list; the page does not break. | — | Not Run | Yes | PRD FR-GRV-001; NFR-SEC-002; docs/SECURITY.md | React escaping is expected; also check the notification title/message and any admin-rendered copy if the same data is reused. |
| USR-GRV-010 | Grievance submission | Granting geolocation permission pins the current location | Positive | P1 | Signed-in citizen; `/submit`; browser geolocation permission set to allow; test geolocation coordinates configured | Pune centre `18.5204, 73.8567` | 1. Click Use my current location.<br>2. Accept the browser prompt.<br>3. Observe the pin, coordinates, and address preview.<br>4. Confirm and submit. | The browser prompt appears once; the pin lands near the supplied test coordinates; reverse geocoding fills a readable address; the location is explicitly confirmed; no automatic submission occurs; the record stores the coordinates and address. | — | Not Run | Partial | DEC-050; PRD FR-GRV-001 | Use browser geolocation emulation, not a real device location. |
| USR-GRV-011 | Grievance submission | Denying geolocation leaves a usable manual fallback | Recovery | P1 | Signed-in citizen; `/submit`; geolocation permission set to deny | No coordinates; landmark `Shivajinagar, Pune` | 1. Click Use my current location and deny the prompt.<br>2. Read the message.<br>3. Search for the landmark manually and select it.<br>4. Submit. | A clear permission message appears; no pin is fabricated; manual search and map selection still work; submission succeeds with the manually chosen location; the form does not reset or navigate away. | — | Not Run | Partial | DEC-050; DEC-047 | The fallback is essential for users who block location access. |
| USR-GRV-012 | Grievance submission | Map search, pin adjustment, confirm, and cancel behave predictably | Positive | P1 | Signed-in citizen; `/submit`; location dialog available | `Shivajinagar, Pune`; a manually dragged pin | 1. Open the location picker.<br>2. Search for the landmark.<br>3. Select a result, then drag the pin.<br>4. Observe the address preview.<br>5. Press Cancel; reopen and press Confirm Pin Location. | Search results are relevant; selecting a result moves the pin without submitting; dragging updates the preview; Cancel leaves the previous location unchanged; Confirm stores the new pin and closes the dialog; the confirmed location is what the form submits. | — | Not Run | Partial | DEC-050; PRD FR-GRV-001 | Voice location suggestions must not auto-pin; a result requires explicit selection. |
| USR-GRV-013 | Grievance submission | A location outside India is rejected or clearly warned | Boundary | P2 | Signed-in citizen; `/submit`; location picker open | London `51.5072, -0.1276` entered via search or map | 1. Search for an overseas location or pan outside India.<br>2. Attempt to confirm and submit. | The picker either prevents the out-of-country pin or shows an explicit warning that this service covers India; it never silently pins an unrelated in-country point; if rejected, the user can choose a valid location. | — | Not Run | No | Product context (India); DEC-050 | The map declares India bounds; verify whether search bypasses them. |
| USR-GRV-014 | Grievance submission | Unsupported photo formats are rejected before upload | Negative | P2 | Signed-in citizen; `/submit`; photo field available | `water-evidence.gif`; `water-evidence.pdf`; `water-evidence.svg` | 1. Choose each file in turn.<br>2. Observe the message and network traffic.<br>3. Try to submit. | Each unsupported type is rejected immediately with the accepted formats stated; no Cloudinary upload request is made; no image is attached; the citizen can still submit without a photo. | — | Not Run | Yes | PRD FR-GRV-014; docs/SECURITY.md | The input accepts `image/*`, but the code checks JPEG/PNG/WebP. PDF/DOCX are documented but unsupported (G-25). |
| USR-GRV-015 | Grievance submission | Oversized photo is rejected at the 10 MB boundary | Boundary | P2 | Signed-in citizen; `/submit`; photo field available | `oversize.jpg` 11 MB; a valid file just under 10 MB | 1. Choose the 11 MB file.<br>2. Observe the response and network traffic.<br>3. Choose the under-limit file and upload. | The oversized file is rejected before any upload with a clear size message; the under-limit file uploads normally; the form remains usable; no partial submission or reference is created. | — | Not Run | Yes | PRD FR-GRV-014; docs/SECURITY.md | The limit is client-side here; the backend/server validation path must also be checked (USR-API-012). |
| USR-GRV-016 | Grievance submission | Corrupted or spoofed image content is not accepted as evidence | Negative | P2 | Signed-in citizen; Cloudinary and validation services available; `/submit` | Text bytes renamed `corrupt.jpg`; a non-image file with an image MIME type | 1. Select the spoofed file.<br>2. Observe upload and validation.<br>3. Attempt to submit with it.<br>4. Remove it and submit without a photo. | The file is rejected or the upload/validation fails with a readable message; no broken image is attached; any uploaded orphan is cleaned up where possible; the grievance can still be submitted without the photo. | — | Not Run | Partial | PRD FR-GRV-014; docs/SECURITY.md | MIME and extension alone are insufficient; verify content validation. |
| USR-GRV-017 | Grievance submission | Photo-validation AI outage must not block the grievance | Integration | P1 | Signed-in citizen; valid photo; validation service forced to fail/timeout after the photo is accepted | Valid JPEG; `/validate-image` or the server-side image LLM returns 500/timeout | 1. Upload the photo while validation is failing.<br>2. If the uploader accepts it, submit.<br>3. Observe the server response and the form.<br>4. Retry without a photo. | Per FR-AI-008, the photo AI is assistance: submission either succeeds with the photo marked unassessed or succeeds after the citizen removes it; a nonessential image check never returns a blocking 500; the form and text survive the failure. | — | Not Run | Partial | PRD FR-AI-008; PRD error/edge cases; DEC-049 | Code observation: submit reruns `llm_image_confidence` and returns 500 if it raises. If reproduced, file a P1 defect (G-10). |
| USR-GRV-018 | Grievance submission | Removing or replacing a photo leaves only the final choice attached | Boundary | P2 | Signed-in citizen; `/submit`; photo uploaded once | Accepted JPEG; then a second accepted PNG; then Remove | 1. Upload the JPEG.<br>2. Replace it with the PNG.<br>3. Remove the photo entirely.<br>4. Submit. | The UI reflects the latest choice; the submission contains no stale image URL; removal is possible without losing title/description/location; the old asset is deleted where the API supports it; the final record matches the visible state. | — | Not Run | Partial | PRD FR-GRV-014 | Verify whether replacement deletes the earlier Cloudinary asset; record orphans as a cleanup gap. |
| USR-GRV-019 | Grievance submission | Rapid repeated submit creates exactly one grievance | Boundary | P0 | Signed-in citizen; valid form completed; network latency normal | One valid form; double-click or press Enter repeatedly | 1. Double-click Submit as fast as possible.<br>2. If the button disables, attempt a second click/Enter anyway.<br>3. Wait for the result.<br>4. Check the personal list and notifications. | Exactly one `POST /submit-grievance` is effective; one reference is shown; one record and one submission notification exist; the button is disabled/busy during the request; no second success toast appears. | — | Not Run | Yes | DEC-038; PRD FR-GRV-002 | The client uses a submission lock; the server has no idempotency key (G-08). |
| USR-GRV-020 | Grievance submission | Losing connectivity during submission preserves the form and avoids accidental duplicates | Recovery | P0 | Signed-in citizen; valid form; browser can go offline or abort the submit request | Valid form; network toggled offline during submit; then restored | 1. Complete a valid form.<br>2. Click Submit and immediately go offline or abort the request.<br>3. Observe the error and the form contents.<br>4. Restore connectivity and retry once.<br>5. Check the personal list for duplicate references. | A clear network error appears; title, description, photo, and location remain; retry is possible; if the first request never reached the server, exactly one record exists after retry; if it did reach the server, the UI/API makes the existing reference discoverable and does not create a duplicate. | — | Not Run | Partial | PRD error/edge cases; PRD FR-GRV-002 | Without a client idempotency key, the “server received but response lost” branch is expected to duplicate; see G-08 and USR-ERR-007. |

## 8. AI-Assisted Grievance Processing (USR-AI)

**What is covered:** the citizen-visible effects of the implemented AI layer:
classification/priority, quality flagging, extraction suggestions, and the
absence of unsupported AI features. The citizen UI intentionally does not
display category, department, priority, confidence, keywords, or explanations
(DEC-044); most AI behaviour is verified through outcomes and API checks, not
through visible labels.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-AI-001 | AI processing | A clear water complaint is classified without exposing AI output to the citizen | Positive | P1 | Signed-in citizen; backend AI/keyword cascade available; staff fixture can read the record | Water complaint from §1.7; valid location | 1. Submit the complaint.<br>2. Inspect the success card, toast, list card, and citizen detail.<br>3. As the staff fixture or via the API, inspect `hfEngine.category` and `hfEngine.priority`.<br>4. Verify the citizen surfaces never render those values. | Submission succeeds; the backend records a category and priority (water-related category, nonempty confidence/model info); the citizen sees only reference, status, title, description, location, and photo; no category, department, priority, confidence, keyword, or explanation appears anywhere in the citizen UI. | — | Not Run | Partial | PRD FR-AI-001/003/005/006; DEC-044 | API fields remain for staff; the requirement is a UI privacy rule, not field removal. |
| USR-AI-002 | AI processing | An ambiguous complaint still completes without a misleading classification | Boundary | P1 | Signed-in citizen; AI available or fallback active; valid location | Title `It is not working`; description `It is not working again. Please fix it soon.`; location `Shivajinagar, Pune` | 1. Submit the ambiguous complaint.<br>2. Observe success and status.<br>3. Inspect the backend category/confidence as staff.<br>4. Check all citizen surfaces for a forced label. | The grievance is accepted with a reference; a low-confidence/`other` fallback is stored if the classifier cannot decide; the citizen is not shown a guessed department or a confident-sounding label; no workflow is blocked and no error claims the complaint is invalid. | — | Not Run | Partial | PRD FR-AI-003; PRD error/edge cases; DEC-044 | The description meets the 20-character client rule; the ambiguity is semantic, not a validation failure. |
| USR-AI-003 | AI processing | Hindi, Marathi, and code-switched complaints are accepted and processed | Positive | P1 | Signed-in citizen; AI cascade available; Devanagari fonts | Hindi, Marathi, and `Sector 5 mein streetlight...` samples from §1.7 | 1. Submit each complaint with a valid location.<br>2. Record the reference and displayed text.<br>3. Inspect the stored category/priority as staff.<br>4. Confirm the citizen UI remains free of AI labels. | Each submission receives a reference and is persisted without encoding loss; classification either produces a plausible category/priority or falls back safely; no 500, timeout, or blank category reaches the citizen; the UI hides all classification output. | — | Not Run | Partial | PRD FR-AI-003; DEC-026; DEC-044 | Speech accuracy is separate; this is text classification. Do not claim multilingual accuracy is validated. |
| USR-AI-004 | AI processing | A slow or unavailable LLM provider falls back without blocking submission | Integration | P1 | Test environment with Groq/HF unavailable or a forced timeout; keyword fallback enabled | Clear road complaint; valid location | 1. Disable or blackhole the LLM provider for the backend.<br>2. Submit the complaint.<br>3. Observe latency and response.<br>4. Inspect `hfEngine.modelInfo` as staff. | Submission succeeds within the configured budget; keyword/rule classification is stored; the response indicates the fallback rather than inventing a model result; the citizen receives a normal reference and no provider error; manual submission is never blocked by classification. | — | Not Run | Partial | PRD FR-AI-008; docs/AI_SYSTEM.md fallback rules | This is the expected non-blocking path; compare with the image-validation failure in USR-AI-006. |
| USR-AI-005 | AI processing | Invalid or contradictory AI output cannot break the citizen response | Negative | P2 | Provider mocked to return malformed JSON, an unknown category, or an impossible priority | Mocked bad responses; clear complaint | 1. Submit once per bad response shape.<br>2. Observe status/reference and citizen UI.<br>3. Inspect stored fallback values. | The backend normalizes or falls back to a safe category/priority; submission still returns a valid reference; no unvalidated string, null, or HTML reaches the citizen UI; no stack trace is exposed. | — | Not Run | Partial | PRD FR-AI-008; docs/AI_SYSTEM.md | Best exercised at the API/service layer with mocks; do not fabricate a model result. |
| USR-AI-006 | AI processing | An AI image-validation outage must not become a submission outage | Integration | P1 | Signed-in citizen; valid JPEG; server-side image LLM forced to raise/timeout | Valid photo; forced image-validation failure | 1. Upload the photo.<br>2. Submit the grievance.<br>3. Observe the HTTP status and form state.<br>4. Retry without the photo. | The image check is optional assistance; the submission either succeeds with the image marked unassessed or clearly asks the citizen to remove the photo and retry; the text/location are preserved; no unexplained 500 blocks the core grievance. | — | Not Run | Partial | PRD FR-AI-008; PRD error/edge cases | Code observation: `submit_grievance` returns 500 “LLM image validation failed” when the image LLM raises. This conflicts with FR-AI-008 and is tracked as G-10. |
| USR-AI-007 | AI processing | Clearly non-civic text is rejected before a record or reference exists | Negative | P1 | Signed-in citizen; backend live; a valid location; provider-call instrumentation available if possible | `What is the capital of France?`; `2 + 2 = 4. Solve this riddle.`; `asdf qwer 1234 lorem ipsum`; each with a valid location | 1. Submit each text.<br>2. Record the status and visible correction message.<br>3. Check `/track` for a new record.<br>4. Inspect ID allocation, notifications, and provider logs/counters. | HTTP 422 with a clear civic-issue correction prompt; no reference, grievance, notification, or ID allocation; no image/classifier/quality provider call; existing records are unchanged; the message does not accuse the citizen or expose internals. | — | Not Run | Yes | DEC-062; DEC-049; PRD FR-AI-008 | Deterministic local gate; only clear cases. Do not use a borderline civic complaint here — false-positive coverage belongs to USR-AI-008. |
| USR-AI-008 | AI processing | Ambiguous or plausible complaints are not falsely rejected | Negative | P2 | Signed-in citizen; civic-scope gate and classifier available; quality provider may be unavailable | `It is not working again. Please fix it soon.`; `Sector 5 mein streetlight काम नहीं कर रहा, रात्री खूप अंधार आहे.`; misspelled `Water suply not coming since 3 days`; clear water complaint; valid location for each | 1. Submit each text.<br>2. Observe status, reference, and any warning.<br>3. Open `/track` and the detail.<br>4. Inspect stored `flagged`/outcome metadata as staff. | All are accepted with a 2xx and a reference; none receives the 422 non-civic rejection; plausible and misspelled civic text remains reviewable; if the quality gate flags an item, the warning is clear and non-accusatory, but it is never auto-rejected; existing records are unchanged. | — | Not Run | Partial | DEC-062; DEC-049; PRD FR-AI-008 | This is the false-positive guard for USR-AI-007. The gate is heuristic; do not weaken it to flag-all if one item passes. |
| USR-AI-009 | AI processing | Low-confidence extraction asks for clarification instead of inventing details | Boundary | P2 | Voice mode available; extraction service available or mocked; signed-in citizen | Vague utterance `It is not working near the market`; no title/details | 1. Start voice intake and provide the vague statement.<br>2. Observe the next question or review summary.<br>3. Skip the question and review the fields.<br>4. Compare the fields with what was actually said. | At most one relevant clarification is asked; skipping moves to review without fabricating facts; the fields contain only supported content or remain empty; the citizen can edit or complete them manually; the assistant never claims a category/priority. | — | Not Run | Partial | DEC-038; DEC-040; DEC-044 | Extraction is stateless and advisory; submission still goes through the normal form. |
| USR-AI-010 | AI processing | Unsupported AI features are not presented as if they exist | Positive | P2 | Signed-in citizen; success card, list, detail, and voice review accessible | Any submitted grievance | 1. Inspect the citizen success card.<br>2. Inspect list/detail and voice summary.<br>3. Search the DOM/text for summary, entities, severity, assignment recommendation, confidence, keywords, and AI explanation.<br>4. Confirm staff surfaces still show the triage panel. | Citizen surfaces contain none of the unsupported AI panels or claims; only the “AI suggestion” origin badge on voice-filled fields is allowed; staff surfaces may show the diagnostic; no copy promises a feature that is absent. | — | Not Run | Partial | DEC-044; docs/AI_SYSTEM.md status table | AI-01/02/03/04/05/06/07/08/09/10/11 are largely PLANNED or partial; do not test them as delivered features. |

## 9. Voice-Assisted Grievance Intake (USR-VOICE)

**What is covered:** the conversational voice workflow that actually exists
(DEC-038/DEC-041): microphone consent, Sarvam transcription, stateless AI
extraction, one clarification question, review, manual correction, and every
documented failure path.

**What is not covered:** single-shot manual dictation was retired by DEC-041.
Speech-recognition accuracy is EXPERIMENTAL and is not scored here; these
cases verify the workflow and failure handling, not word-error rate.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-VOICE-001 | Voice intake | Start voice mode with microphone permission and hear the opening prompt | Positive | P1 | Signed-in citizen; `TRANSCRIPTION_ENABLED=true`; voice mode available; microphone permission set to allow; speakers available | Short opening utterance; 5–10 s of speech | 1. Open `/submit`.<br>2. Select the Voice mode card.<br>3. Click Start speaking for the first time.<br>4. Grant the microphone prompt.<br>5. Stop after a short statement. | The opening prompt is spoken before capture starts (unless muted); the status changes through prompting/listening; a recording timer and Stop control appear; no grievance is submitted yet; stopping begins transcription; the page does not scroll away or lose the form. | — | Not Run | Partial | DEC-038; DEC-043 | The first recording requires an explicit tap; the audio prompt is bounded to 10 s and failure falls through to recording. |
| USR-VOICE-002 | Voice intake | Denied microphone permission or no input device leaves manual entry usable | Negative | P1 | Signed-in citizen; voice mode selected; browser can deny permission; optionally no microphone device | Permission deny; device with no microphone | 1. Click Start speaking and deny the prompt.<br>2. Read the status and available actions.<br>3. Repeat with no input device.<br>4. Switch to manual typing and submit a valid grievance. | A specific permission/no-device message appears, not a generic failure; no recording or transcription request is made; the citizen can type the grievance manually or retry after fixing permission; text mode still submits successfully. | — | Not Run | No | DEC-038; DEC-041; browser media contract | Use browser permission emulation; do not change browser security settings to force a pass. |
| USR-VOICE-003 | Voice intake | A complete English complaint becomes a reviewable transcript and draft | Positive | P1 | Signed-in citizen; voice available; English selected; STT and extraction available | English water complaint spoken naturally (10–20 s) | 1. Start a new voice conversation.<br>2. Speak the complete complaint including the location.<br>3. Stop recording.<br>4. Wait for transcription and extraction.<br>5. Inspect the fields and summary. | The original-language transcript appears in the conversation log; title and description are proposed; the summary shows only the issue and location, not category/priority/confidence; AI-origin badges mark proposed fields; the citizen can continue to review; no grievance exists yet. | — | Not Run | Partial | DEC-038; DEC-044; docs/VOICE_ASSISTED_COMPLAINT.md | Real STT output may differ; the case verifies the path and reviewability, not exact words. Record the transcript. |
| USR-VOICE-004 | Voice intake | Silence, clicks, or a very short recording do not become invented text | Boundary | P2 | Signed-in citizen; voice mode; microphone available | `silence.wav` or 1–2 s of clicks; `click-only.wav` | 1. Start recording and produce no speech.<br>2. Stop and wait.<br>3. Observe the status and retry controls.<br>4. Try a second time with a valid sentence. | The empty/silent attempt reports that no speech was heard or that transcription is empty; no fabricated transcript or fields appear; Retry and Cancel are available; a subsequent valid recording works; no grievance is created. | — | Not Run | Partial | DEC-038; docs/VOICE_ASSISTED_COMPLAINT.md error contract | Maximum recording length is bounded; verify the stop/timer behaviour separately if the clip reaches the limit. |
| USR-VOICE-005 | Voice intake | A second utterance appends to the conversation instead of replacing it | Positive | P2 | Voice mode; a first utterance already transcribed; microphone permission retained | First: `There is no water supply in Sector 12.` Second: `The pipeline near the community hall is leaking.` | 1. Record and stop the first utterance.<br>2. Start again and add the second detail.<br>3. Stop and wait.<br>4. Inspect the conversation log and proposed fields. | Both user messages remain in order; the second recording is not lost or silently dropped; extraction considers both; proposed title/description include the added detail; the citizen can review and edit. | — | Not Run | Partial | DEC-038; DEC-053; docs/VOICE_ASSISTED_COMPLAINT.md | DEC-053 fixed sequential capture; specifically re-test the second session on the same browser tab. |
| USR-VOICE-006 | Voice intake | A Hindi complaint is transcribed and reviewable in Hindi | Positive | P1 | Voice mode; language `hi-IN`; STT available; Devanagari font | Hindi water complaint from §1.7 | 1. Switch the voice language to हिन्दी.<br>2. Speak the complaint.<br>3. Stop and wait.<br>4. Review the transcript and proposed fields.<br>5. Optionally correct a word by switching to manual. | The transcript is in Devanagari (not transliterated or replaced by English); the review fields accept and display Hindi; the citizen can correct errors; the interface language can remain English while the complaint language is Hindi; no classification is shown. | — | Not Run | No | DEC-038; DEC-026; docs/VOICE_ASSISTED_COMPLAINT.md | Live Hindi STT is not validated on the project; mark accuracy observations as experimental, not a pass/fail of recognition quality. |
| USR-VOICE-007 | Voice intake | A Marathi complaint is transcribed and reviewable in Marathi | Positive | P1 | Voice mode; language `mr-IN`; STT available; Devanagari font | Marathi sanitation complaint from §1.7 | 1. Switch the voice language to मराठी.<br>2. Speak the complaint.<br>3. Stop and wait.<br>4. Review and optionally correct.<br>5. Submit with a valid location. | Marathi transcript and fields render correctly; the citizen can correct and submit; the reference is issued; the UI does not force a language switch or reject Devanagari; no AI labels leak. | — | Not Run | No | DEC-038; DEC-026 | This is the least-tested live path; record as experimental if no native reviewer is present. |
| USR-VOICE-008 | Voice intake | Hindi/English code-switching is preserved and correctable | Positive | P2 | Voice mode; STT available; language tested with `hi-IN` and `en-IN` | `Sector 5 mein streetlight काम नहीं कर रहा, रात्री खूप अंधार आहे.` | 1. Select Hindi or English and speak the mixed sentence.<br>2. Stop and inspect the transcript.<br>3. Switch to the other language option and repeat in a new conversation.<br>4. Correct any dropped words manually. | The transcript preserves the meaningful mixed-language content as far as the service supports it; no crash or empty screen; the citizen can correct it; switching the STT language does not reset the manual draft; no claim of perfect code-switch accuracy. | — | Not Run | No | DEC-038; docs/VOICE_ASSISTED_COMPLAINT.md languages | Record the chosen language and observed transcript; do not fail solely for recognition errors. |
| USR-VOICE-009 | Voice intake | Noisy or unclear speech does not silently create a confident draft | Negative | P2 | Voice mode; background noise available; STT available | `noise.wav`; unclear speech mixed with traffic sounds | 1. Record the noisy clip.<br>2. Stop and observe the transcript.<br>3. If text appears, compare it with what was said.<br>4. Review the fields and choose retry/cancel/manual. | The UI does not present obviously invented content as confirmed facts; the transcript is visibly editable/reviewable; the citizen can retry, cancel, or switch to manual; no grievance is submitted without review; unclear audio is not treated as a successful confirmation. | — | Not Run | No | DEC-038; human-in-the-loop principle | A low-quality transcript is not automatically a defect; silently treating it as verified is. |
| USR-VOICE-010 | Voice intake | A wrong transcription can be corrected without the AI overwriting it | Recovery | P1 | Voice mode; a transcript with at least one known error; review fields visible | Incorrect transcript containing `Sector 15` while the actual place is `Sector 12` | 1. Complete a voice utterance.<br>2. Switch to manual editing.<br>3. Correct the title/description/location text.<br>4. Return to voice or trigger another extraction.<br>5. Submit. | The correction persists; later AI extraction does not overwrite a citizen-edited field; the review shows the corrected value; submission stores the corrected text; the citizen can verify the final text before submitting. | — | Not Run | Partial | DEC-038; DEC-040; human-in-the-loop principle | This is the core protection against harmful STT errors. |
| USR-VOICE-011 | Voice intake | Expired authentication or an STT timeout is explained and recoverable | Recovery | P1 | Voice mode; a recording has been captured; access token can be expired; STT timeout can be simulated | 1–5 s WAV; expired access token; forced 408/timeout | 1. Start while the access token is expired.<br>2. Observe refresh/auth failure.<br>3. Repeat with a forced STT timeout.<br>4. Use Retry and, separately, switch to manual. | Auth failure produces a sign-in/authorization message, not a silent empty transcript; timeout produces a retryable message; the recorded audio or transcript is not lost where reuse is supported; manual entry remains available; no grievance is created twice. | — | Not Run | Partial | docs/VOICE_ASSISTED_COMPLAINT.md error table; NFR-SEC-004 | The frontend maps 401/403 to `voiceAuth`, 408 to timeout, and 429 to rate limit. |
| USR-VOICE-012 | Voice intake | Disabled, rate-limited, or unavailable STT does not block manual submission | Integration | P1 | `TRANSCRIPTION_ENABLED=false` or STT provider forced to 503/429; signed-in citizen | Any valid text complaint | 1. Open voice mode and attempt a recording.<br>2. Observe the unavailable/rate-limit message.<br>3. Switch to manual mode and submit the same complaint. | Voice shows a clear feature-unavailable or rate-limit message (with retry timing where supplied); no endless spinner; the manual branch works and creates a grievance; the error explains that voice is unavailable rather than blaming the citizen. | — | Not Run | Partial | docs/VOICE_ASSISTED_COMPLAINT.md disabled/error contract; DEC-041 | This is the expected graceful degradation path. |
| USR-VOICE-013 | Voice intake | Extraction failure preserves the transcript and allows retry | Recovery | P1 | STT succeeds; extraction endpoint forced to 500/timeout; voice mode | Valid English utterance; forced extraction failure | 1. Record and transcribe a valid complaint.<br>2. Force extraction to fail.<br>3. Observe the error and controls.<br>4. Press Retry; then repeat and choose Skip to review/manual. | The transcript remains visible; the failure says the assistant could not process it, not that the citizen said nothing; Retry reuses the existing utterances without duplicating them; skipping to review preserves the transcript for manual completion; no grievance is created by extraction. | — | Not Run | Partial | DEC-038; DEC-040; docs/VOICE_ASSISTED_COMPLAINT.md | Extraction is stateless; failure must never discard the transcript. |
| USR-VOICE-014 | Voice intake | A spoken location becomes a suggestion, never an automatic pin | Boundary | P2 | Voice mode; extraction returns a location; location picker available | Utterance `The leak is near Shivajinagar bus stand, Pune` | 1. Complete the utterance.<br>2. Observe the location search box and result list.<br>3. Do not select a result; try to submit.<br>4. Select and confirm a result, then submit. | The spoken place populates a search suggestion/list but does not silently pin the first result or use the device location; submission without a confirmed pin is blocked; choosing a result and confirming sets the location; the final record uses that pin. | — | Not Run | Partial | DEC-038; DEC-050 | Explicit human confirmation is the safety property here. |
| USR-VOICE-015 | Voice intake | A vague complaint triggers a details question and can skip to review | Positive | P1 | Voice mode; extraction identifies missing detail; valid location can be added later | `It is not working.` then `The streetlight near Gandhi Park has been off for three nights.` | 1. Record the vague utterance.<br>2. Observe the clarification question.<br>3. Answer it with the specific detail.<br>4. Repeat a new conversation and choose Skip to review instead. | One clear details question appears; answering it updates the proposed fields; skipping does not loop or fabricate details; review is reachable; the citizen can complete the missing details manually; no more than the needed question is asked. | — | Not Run | Partial | DEC-038; DEC-040 | The deterministic policy asks for details when the description is below the minimum, then location, then at most one optional question. |
| USR-VOICE-016 | Voice intake | An optional clarification is asked at most once and can be skipped | Boundary | P2 | Voice mode; extraction returns a question kind such as `when` or `frequency`; description already long enough | `The garbage has not been collected.` plus a model-suggested `when` question | 1. Record a sufficiently detailed complaint.<br>2. Observe one optional question.<br>3. Choose Skip.<br>4. Continue the conversation and trigger another extraction. | The optional question appears once; Skip immediately moves toward review; the same kind is not asked again; the skip is not treated as an error; the citizen can still add the answer manually. | — | Not Run | Partial | DEC-038; DEC-040 | The reducer tracks asked kinds to prevent loops. |
| USR-VOICE-017 | Voice intake | Review is read-only, manual correction is explicit, and the photo step is optional | Positive | P1 | Voice conversation reached `ready_for_review`; photo field available; valid location | AI-filled title/description; a valid JPEG; Skip photo variant | 1. Inspect the review fields; try to edit them directly.<br>2. Use Switch to manual and edit the text.<br>3. Return to the review; choose Add photo or Skip.<br>4. Confirm the location and submit. | Review fields are read-only until the citizen explicitly switches to manual; edits in manual mode update the submitted values; the photo step never auto-opens a picker; Add photo and Skip are both available; submission uses the final reviewed values; the reference is issued once. | — | Not Run | Partial | DEC-039; DEC-041; DEC-044 | The review is read-only by design (DEC-041), so direct editing there is not expected; the manual switch is the correction path. |
| USR-VOICE-018 | Voice intake | Switching between voice and manual preserves the conversation and draft | Positive | P1 | Voice mode with at least one utterance and some typed text; manual mode available | Same complaint in both modes | 1. Start a voice conversation and stop after one utterance.<br>2. Switch to manual and type a correction/addition.<br>3. Switch back to voice.<br>4. Continue the conversation and submit. | The conversation log and extracted fields survive both switches; typed text is not erased; returning to voice does not create a second intake session or duplicate messages; the final submission reflects both sources; no data is silently lost. | — | Not Run | Partial | DEC-038; DEC-041 | The intake hook lives above the mode switch specifically to preserve state. |
| USR-VOICE-019 | Voice intake | Cancel, mute, and replay controls work and do not create duplicate content | Boundary | P2 | Voice conversation in progress; at least one question displayed; audio available | One recording; question replay; mute toggle | 1. Mute spoken questions; reload or reopen and check the preference.<br>2. Replay the current question.<br>3. Cancel the conversation.<br>4. Start a new one and inspect the log. | Mute persists and stops current audio; replay speaks the same question once; Cancel clears messages/extraction and returns to an idle state without submitting; a new conversation starts clean with no duplicated old text; manual form values are not destroyed unless explicitly reset. | — | Not Run | Partial | DEC-038; DEC-039 | Verify the reset boundary between intake state and the outer form fields. |
| USR-VOICE-020 | Voice intake | Unsupported browsers or failed question playback degrade to readable text | Negative | P2 | Browser without MediaRecorder support, or audio playback forced to fail; voice mode selected | A supported text complaint; playback failure | 1. Open voice mode in the unsupported/failing browser.<br>2. Observe the message and controls.<br>3. Ask for a question with playback failing.<br>4. Use manual/typed input to submit. | The unsupported-browser message is clear and the manual branch remains available; a failed spoken question still displays its text and a note; no silent dead end; the citizen can complete the grievance by typing; no microphone request loops. | — | Not Run | No | DEC-038; docs/VOICE_ASSISTED_COMPLAINT.md browser compatibility | Test at least one browser without the required media API if available; otherwise mark Blocked. |

## 10. Grievance Tracking and Status (USR-TRACK)

**What is covered:** the personal list, citizen detail privacy, status badge and
milestone mapping, refresh after staff transitions, multiple grievances,
terminal states, invalid IDs, cross-user access, closed-record retention, and
the 50-record list limit.

**Important design constraints:** citizens see status/timeline/title/
description/location/photo but not officer updates, resolver identity,
completion photos, AI triage, department, or priority (DEC-030/DEC-044/
DEC-050). Reference-ID search was removed from citizen surfaces (DEC-028).

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-TRACK-001 | Tracking | A newly submitted grievance appears with the expected citizen-facing fields | Positive | P0 | Citizen submitted USR-GRV-001 successfully; `/track` available | Generated reference; water complaint | 1. Open `/track`.<br>2. Locate the new card.<br>3. Inspect title, reference, status, and date.<br>4. Compare the total count with the number of records. | The card shows title, reference ID, current status label, and registration date; it does not show category, priority, department, or officer; the total count includes the new record; opening the card shows the same reference and title. | — | Not Run | Yes | PRD FR-GRV-006; DEC-030; DEC-044 | Newest-first ordering is expected from the repository contract. |
| USR-TRACK-002 | Tracking | Citizen detail hides internal routing, AI, and officer-only information | Security | P0 | Citizen has one grievance with staff-added assignment, progress note, resolution photo, and AI metadata | Assigned/in-progress grievance; staff fixture data | 1. Open the citizen detail from `/track`.<br>2. Inspect every section and the DOM text.<br>3. Compare with the staff view of the same record.<br>4. Search the DOM for priority, department, assignee, confidence, keywords, and officer-update text. | Citizen sees reference, status, lifecycle milestone, title, description, registered date, address/location, and the citizen-submitted photo only; internal priority, department, assigned officer, AI diagnostics, officer updates, completion photos, and resolution internals are absent; the API may contain them but the citizen surface must not render them. | — | Not Run | Partial | DEC-030; DEC-044; DEC-050 | Due date is also visible in the current citizen modal even though DEC-050’s preserved list does not mention it; record this as a privacy inconsistency if observed. |
| USR-TRACK-003 | Tracking | The lifecycle timeline reflects the current status with the documented milestones | Positive | P1 | Staff fixture can set status; citizen has a grievance | States `PENDING_ASSIGNMENT`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` (one per check) | 1. For each state, set it through the staff API.<br>2. Reload `/track` and open the detail.<br>3. Observe the badge and the active milestone.<br>4. Verify no future milestone is shown as completed. | The badge uses a human-readable status label; the timeline marks earlier milestones completed and the current one active; resolved/closed shows the resolved milestone; in-progress states show the in-progress milestone; the status is consistent between card and detail. | — | Not Run | Partial | PRD FR-GRV-004/007; docs/WORKFLOWS.md | This verifies mapping only; the timeline does not display actual transition timestamps or actors. |
| USR-TRACK-004 | Tracking | The citizen can see how the grievance was resolved and why it was closed | Positive | P1 | Staff fixture submitted a resolution with text/actions, then closed the grievance with a reason; citizen owns it | Resolution text; closure reason; completion photo | 1. Open the resolved/closed grievance as the citizen.<br>2. Look for resolution text, actions taken, closure reason, and completion evidence.<br>3. Compare with the PRD detail requirements. | The citizen can read the resolution/actions and the closure or rejection reason, not only a status badge; any citizen-visible evidence or note is labelled; the citizen understands what was done and can decide whether to respond. | — | Not Run | Partial | PRD FR-GRV-007/010; PRD UI detail page; FR-RES-007 | Implementation observation: the citizen modal never renders resolution or closure content. This expected result is likely to fail; track as G-01. |
| USR-TRACK-005 | Tracking | A staff status change is visible after the citizen refreshes | Integration | P1 | Citizen has an in-progress grievance; staff fixture can transition it | Transition to `RESOLVED` with a reason | 1. Note the current status/counts on `/track`.<br>2. As staff, resolve the grievance.<br>3. Refresh `/track` and open the detail.<br>4. Compare the badge, timeline, and counts. | The refreshed page shows the new status and timeline position; the resolved count increases and the in-progress count decreases; the card and detail agree; no stale cached status contradicts the server; the notification appears in the inbox. | — | Not Run | Partial | PRD FR-GRV-005/006; PRD FR-NOT-001 | The list is not live-pushed; refresh/reopen is the expected update path. |
| USR-TRACK-006 | Tracking | Multiple grievances are separated and counted correctly | Positive | P2 | Citizen has three grievances in different states (open, in progress, resolved) | Three generated references | 1. Open `/track`.<br>2. Count the cards and compare each reference.<br>3. Read the four summary numbers.<br>4. Open each detail. | All three records appear once, newest first; total is 3; open/in-progress/resolved buckets match the records; no other citizen's grievance appears; each detail opens the correct record; rejected/withdrawn records count only toward total. | — | Not Run | Partial | PRD FR-GRV-006; DEC-030 | Counts are derived from the fetched list, which is limited to 50; see USR-TRACK-015. |
| USR-TRACK-007 | Tracking | A rejected grievance shows a clear rejection state and reason | Negative | P2 | Staff rejected a citizen grievance with a reason | Rejection reason; rejected record | 1. Open `/track` and the rejected card.<br>2. Inspect the badge and detail panel.<br>3. Look for the reason and next-step guidance. | The record shows a distinct rejected state (not “resolved”); the rejection reason is visible; the citizen is told whether any action is available; the record remains in the list and counts toward total only; no closure photo or internal note leaks. | — | Not Run | Partial | PRD FR-GRV-013; DEC-050 | The current timeline has a special rejected message, but the stored rejection reason is not rendered in the citizen detail; see G-01. |
| USR-TRACK-008 | Tracking | Withdrawn and reopened records use readable labels and consistent timelines | Boundary | P2 | Staff/citizen API fixture created `WITHDRAWN` and `REOPENED` records | One withdrawn, one reopened, one `RESOLUTION_SUBMITTED` record | 1. Open each record in `/track`.<br>2. Read the badge label and timeline.<br>3. Refresh and re-check. | Each state has a human-readable label (no raw `withdrawn`/`reopened` lowercase), a distinct tone, and a timeline that reflects the current state; a reopened record does not look like a brand-new untouched submission; the status is consistent across card and detail. | — | Not Run | Partial | PRD FR-GRV-004; DEC-006 status vocabulary | `WITHDRAWN` and `REOPENED` are missing from the status-label map, and the timeline falls back to the first milestone for them; likely failure, tracked as G-24. |
| USR-TRACK-009 | Tracking | A status change while the detail is open is handled without a false stale success | Boundary | P2 | Citizen has a detail open; staff changes the status; page remains open | Assigned → in progress | 1. Open the detail and leave it open.<br>2. Change the status as staff.<br>3. Observe the open modal without refreshing.<br>4. Close/reopen and refresh. | The UI does not claim the new status before it has fetched it; closing/reopening or refreshing shows the new status; the citizen is not shown an error merely because the record changed; no duplicate data appears. | — | Not Run | No | PRD FR-GRV-005/006 | This is a consistency/UX check; live push is not currently implemented. |
| USR-TRACK-010 | Tracking | An invalid or non-existent reference is handled safely through the API | Negative | P2 | Signed-in citizen; API access; no record for the chosen ID | `GRV-2099-9999`; lowercase `grv-2099-9999`; blank/garbage ID | 1. Request each ID with the citizen token.<br>2. Observe status, body, and UI handling if surfaced.<br>3. Repeat without a token. | The owner/authenticated lookup returns a safe 404 (or a validation error for malformed input); no stack trace or internal collection name is exposed; the UI never shows a broken detail; case normalization does not accidentally match another record. | — | Not Run | Yes | PRD error/edge cases; API contract | There is no citizen URL for a detail; this case is primarily an API check (see USR-API-007). |
| USR-TRACK-011 | Tracking | Another citizen's reference does not expose personal grievance details | Security | P0 | Citizen A and Citizen B; A has a grievance; B signed in | A’s generated reference ID | 1. As B, call `GET /grievances/{A-id}`.<br>2. Inspect status, body, and fields.<br>3. Try the same request without a token.<br>4. Try a modified sequential ID. | B receives 403/404 and no title, description, category, department, priority, location, or timeline; an unauthenticated lookup also returns no personal data; sequential IDs cannot be enumerated into a public feed. | — | Not Run | Yes | NFR-SEC-002; PRD role rules; security test requirement | Code observation: non-owner and unauthenticated calls return a 200 “public tracking” projection with title, status, state, category, priority, departmentId, createdAt, and an empty description; because IDs are sequential, this is a privacy risk (G-04/G-05). |
| USR-TRACK-012 | Tracking | Closed records remain available and are not physically deleted | Positive | P1 | Staff closed a citizen grievance; citizen owns it | Closed reference; closure reason | 1. Open `/track` after closure.<br>2. Locate the record and open it.<br>3. Refresh and sign in again later.<br>4. Confirm no “not found” error. | The closed record remains in the citizen's list and is retrievable after reload/new session; its history and status are intact; it is not silently deleted; the citizen can still read the closure outcome (or a documented retention message). | — | Not Run | Partial | PRD FR-DAT-001/002; FR-GRV-004 | Retention is implemented; citizen-visible closure content is missing (G-01). |
| USR-TRACK-013 | Tracking | Detail selection has a stable navigation model | Usability | P2 | Signed-in citizen with at least one grievance; notification link to a grievance available | `/track`; notification “Open”; browser Back | 1. Open a detail, then refresh.<br>2. Press Back/Forward.<br>3. Use the notification “Open” link.<br>4. Try to share or bookmark the detail. | The selected grievance survives a refresh or has a shareable URL; Back does not unexpectedly leave the app or reopen an unrelated record; the notification opens the relevant grievance rather than only the list; the browser history is predictable. | — | Not Run | Partial | PRD UI page requirements; DEC-028 | The app uses modal state, not a `/grievances/{id}` route; the notification link goes to `/track`. This is a usability gap (G-27). |
| USR-TRACK-014 | Tracking | Unknown or unexpected status values degrade safely | Negative | P2 | Staff fixture can set a non-canonical status through the permitted API; citizen owns the record | `AWAITING_VERIFICATION`; blank is rejected separately | 1. Set the unexpected status as staff.<br>2. Open `/track` and the detail.<br>3. Inspect the label, tone, and timeline.<br>4. Refresh. | The UI shows a readable fallback label and does not crash; the timeline does not falsely mark an unrelated milestone as completed; the raw value is not presented as a trusted citizen-facing state; an audit/history warning exists for staff. | — | Not Run | Partial | PRD FR-GRV-004; NFR-SEC-002 | `StatusBadge` falls back to the raw string (replacing only the first underscore), and the timeline defaults to the first milestone; invalid statuses are accepted by PATCH /status (G-06). |
| USR-TRACK-015 | Tracking | More than fifty grievances are not silently lost from the dashboard | Boundary | P1 | Citizen has 51 synthetic grievances created through the API; `/track` available | 51 generated references; statuses distributed | 1. Open `/track`.<br>2. Count the cards and the total.<br>3. Look for pagination, “load more”, or a “showing X of Y” message.<br>4. Search for the 51st reference. | The dashboard either loads all records or clearly paginates/indicates the limit; the total count reflects all records where feasible; the citizen can reach the 51st grievance; no record is silently invisible. | — | Not Run | Partial | PRD FR-GRV-006; NFR-PERF-002 | The UI requests the default limit of 50 and has no pagination; this is a likely failure (G-12). |

## 11. Communication and Notifications (USR-COMM)

**What is covered:** in-app notifications created by submission and status
changes, unread state, cross-user isolation, inbox failure/polling, SMS
preferences, and the citizen-facing communication features that are absent
from the prototype.

**What is not covered:** real SMS/email delivery and staff-side assignment
notifications. The SMS provider is dry-run, and the inbox is in-app only.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-COMM-001 | Notifications | Submitting a grievance creates an in-app notification and unread badge | Integration | P0 | Signed-in citizen; backend and notification store available; inbox initially empty | Valid water grievance | 1. Note the current unread count.<br>2. Submit the grievance.<br>3. Observe the toast and the header badge.<br>4. Open `/notifications`. | Exactly one submission notification is created for the citizen; its title/message reference the new grievance without classification details; the badge increments; the inbox shows it as unread; no other user receives a copy. | — | Not Run | Yes | PRD FR-NOT-001/004; DEC-044 | The submit path writes the notification synchronously; if that write fails, verify whether submission still succeeds (see USR-ERR-003). |
| USR-COMM-002 | Notifications | Inbox lists newest first with clear unread and read states | Positive | P2 | Citizen has at least three notifications, mixed read/unread | Three generated events | 1. Open `/notifications`.<br>2. Inspect order, titles, messages, timestamps, and unread styling.<br>3. Compare with the event order.<br>4. Reload. | Newest first; each item has a readable title, message, time, and grievance reference; unread items are distinguishable without relying only on colour; read items remain visible; reload preserves the state; the header count matches unread items. | — | Not Run | Partial | PRD FR-NOT-004/005 | The inbox polls every 30 seconds while open. |
| USR-COMM-003 | Notifications | Marking one or all notifications read persists and updates the badge | Positive | P1 | Citizen has at least two unread notifications | Two unread items | 1. Mark one item read.<br>2. Observe the count and item styling.<br>3. Click Mark all read.<br>4. Reload and reopen the inbox. | One item becomes read and the unread count drops by one; Mark all read sets every item read; the badge reaches zero; the state persists after reload; a repeated click is harmless; no other user's notifications are changed. | — | Not Run | Yes | PRD FR-NOT-005 | Verify the API call and the visible state, not just the local optimistic update. |
| USR-COMM-004 | Notifications | One citizen cannot see or mark another citizen's notifications | Security | P0 | Citizens A and B; A has at least one notification; B signed in | A's notification ID | 1. As B, open `/notifications`.<br>2. Search for A's notification text/ID.<br>3. Call `PATCH /notifications/{A-id}/read` with B's token.<br>4. Call `PATCH /notifications/read-all` with B's token. | B's inbox contains only B's notifications; A's item is not visible; marking A's ID returns 404/403; mark-all affects only B; no count or content leaks through errors. | — | Not Run | Yes | PRD role rules; NFR-SEC-002; PRD FR-NOT-004 | The repository scopes mark-read by user ID; verify it at the API boundary. |
| USR-COMM-005 | Notifications | A staff status change creates a citizen notification with the new state | Integration | P1 | Citizen has an in-progress grievance; staff fixture can transition it | Transition to `RESOLVED` or `REJECTED` with a reason | 1. Note the inbox state.<br>2. Perform the transition as staff.<br>3. Wait for the poll or reload the inbox.<br>4. Open the grievance. | A notification is delivered to the owner with a human-readable status/reason, without exposing internal officer-only notes; the unread count increments; the grievance itself shows the new status; no notification is sent to an unrelated user. | — | Not Run | Partial | PRD FR-NOT-001; PRD FR-GRV-005 | Rejection messages may include the reason; verify wording is citizen-appropriate and escaped. |
| USR-COMM-006 | Notifications | Notification “Open” reaches the relevant grievance | Usability | P2 | Citizen has a notification with a grievance entity ID | Submission or status notification | 1. Click Open on the notification.<br>2. Observe the destination and selected record.<br>3. Repeat after opening the app in a new tab. | The citizen lands on the relevant grievance detail or a list with that grievance clearly selected/highlighted; the reference matches the notification; the destination is reachable while signed in; no dead link or generic home page. | — | Not Run | Partial | PRD UI page requirements; PRD FR-NOT-004 | Current citizen link goes to `/track`, with no per-record deep link; record as G-27 if confirmed. |
| USR-COMM-007 | Notifications | An empty inbox is clear and not mistaken for an error | Positive | P3 | New citizen with no notifications | `/notifications` | 1. Open the inbox.<br>2. Inspect the empty state, unread count, and controls.<br>3. Submit a grievance and return. | The empty state says the user is caught up and explains what will appear; the unread count is zero; Mark all read is disabled; after a new event the item appears; no sample/mock notification appears in live mode. | — | Not Run | Partial | PRD FR-NOT-004 | Mock mode may show sample content by design; this case is live-mode only. |
| USR-COMM-008 | Notifications | Inbox load failure is visible and polling recovers | Recovery | P2 | Signed-in citizen; intercept `GET /notifications` to fail | Forced 500/network failure, then restore | 1. Open the inbox with the failing request.<br>2. Observe the error and any retry control.<br>3. Restore the service and wait for the poll or reload.<br>4. Mark an item read. | A clear error is shown without discarding already loaded items; the page does not crash; a later poll/reload recovers; mark-read still reports its own failure clearly; no false “caught up” state while the request is failing. | — | Not Run | Partial | PRD error/edge cases; PRD FR-NOT-004 | The inbox displays an alert and keeps polling when `user` and live mode are present. |
| USR-COMM-009 | Notifications | SMS consent, opt-out, and unbinding follow the stored preference | Integration | P2 | Citizen with a verified phone; SMS provider dry-run; staff can trigger a stage update | Verified phone; consent off, then on; then unbind | 1. With consent off, trigger a status update and inspect the dry-run log.<br>2. Enable consent and trigger another update.<br>3. Disable consent and trigger again.<br>4. Unbind the phone and check consent. | Consent defaults off; no stage SMS intent is queued when off; an intent is queued when on, and the log contains no phone number, message body, or OTP; disabling stops new intents; unbinding removes the number and automatically opts out; no external SMS is sent in dry-run. | — | Not Run | Partial | PRD FR-NOT-001; DEC-046; docs/WORKFLOWS.md | Operator-level log inspection is required; never use a real phone number. |
| USR-COMM-010 | Notifications | Missing citizen communication features are reported honestly | Gap | P1 | Signed-in citizen with a grievance that needs a follow-up; no comments/additional-info UI | Existing grievance; attempt to find a reply/comment/upload/reopen/feedback action | 1. Open the grievance detail.<br>2. Look for Reply, Add information, Upload document, Comment, Reopen, Appeal, and satisfaction feedback.<br>3. Try to reach them by URL/API if documentation suggests a path.<br>4. Record what is available. | Either the citizen can respond/upload/reopen/rate through a supported, documented path, or the product clearly states that these actions are unavailable and gives an alternative contact route; the citizen is never left believing a message was sent when no channel exists. | — | Not Run | No | PRD FR-GRV-011; PRD FR-RES-007; PRD UI detail page | These features are absent from the citizen UI and no citizen comments/feedback endpoints were found. Track as G-03, not as a silent pass. |

## 12. Dashboard, Search, Filtering, and Pagination (USR-DASH)

**What is covered:** personal dashboard counts, ordering, API-level filtering
and limits, data isolation, and the search/sort/pagination controls that the
citizen UI does not currently provide.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-DASH-001 | Dashboard | Personal dashboard counts match the records shown | Positive | P0 | Citizen has known grievances in open, in-progress, resolved, rejected, and withdrawn states | Known record set; expected counts calculated manually | 1. Open `/track`.<br>2. Count each status bucket in the cards.<br>3. Compare with Total, Open, In progress, and Resolved tiles.<br>4. Include a rejected and a withdrawn record. | Counts match the visible records and the documented bucket rules; rejected/withdrawn count only toward total; no other citizen's records affect the numbers; the sum of status buckets is consistent with the total where the buckets are intended to partition it. | — | Not Run | Yes | PRD FR-GRV-006; DEC-030 | Counts are derived from the fetched list, so the 50-record limit can distort them (USR-TRACK-015). |
| USR-DASH-002 | Dashboard | A new submission updates the dashboard without a stale count | Integration | P1 | Citizen on `/track`; then submits a new grievance through `/submit` | One new valid grievance | 1. Note the total on `/track`.<br>2. Submit a new grievance.<br>3. Return to `/track` without a full reload, then reload.<br>4. Compare the count and list. | The new record appears and the count increases after the page fetches the list; a full reload is a valid recovery path; the old count is never presented as current indefinitely; no duplicate card is created. | — | Not Run | Partial | PRD FR-GRV-006 | The submit page's local list can update via its subscription; `/track` re-fetches on mount rather than live-pushing. |
| USR-DASH-003 | Dashboard | Status filtering works through the API and is honestly absent from the UI | Functional | P2 | Citizen with records in multiple states; API access | `state=IN_PROGRESS`, `state=RESOLVED`, an invalid state | 1. Call `GET /grievances?state=...` with the citizen token.<br>2. Compare each result set with the records.<br>3. Try an invalid state value.<br>4. Inspect `/track` for filter controls. | Valid filters return only the citizen's matching records; an invalid/unknown state returns an empty set or a clear validation error, not all records; the citizen UI either exposes a filter or the absence is documented; no other user's records appear. | — | Not Run | Partial | PRD FR-GRV-006/008; PRD UI page requirements | The API supports `state`; the citizen UI has no filter control. Do not invent a UI requirement that was not implemented; record the gap. |
| USR-DASH-004 | Dashboard | The list is ordered newest first and remains stable on refresh | Positive | P2 | Citizen has at least five grievances created in a known order | Five generated references with timestamps | 1. Create or seed five records in sequence.<br>2. Open `/track`.<br>3. Record the order.<br>4. Refresh twice and compare. | The newest record appears first; ties are deterministic (createdAt then ID descending); the order does not change randomly across refreshes; the detail selected by a card matches its reference. | — | Not Run | Yes | Repository list contract; PRD FR-GRV-006 | Both in-memory and Mongo repositories sort by createdAt then id descending. |
| USR-DASH-005 | Dashboard | A citizen cannot broaden the dashboard with another user's query parameter | Security | P0 | Citizens A and B with different grievance counts; API access | `GET /grievances?userId=<B-id>` with A's token; `?dept=...`; `?limit=1000` | 1. Call the list endpoint with each query.<br>2. Count returned records and inspect owner IDs.<br>3. Compare with A's own list.<br>4. Try the same with B's token. | A always receives only A's records, regardless of `userId`, department, or limit; B receives only B's; the response does not reveal the other account's count or titles; huge limits are bounded by the documented maximum. | — | Not Run | Yes | NFR-SEC-002; PRD role rules; DEC-030 | The backend overrides `userId` for USER roles. This is a critical regression test. |
| USR-DASH-006 | Dashboard | Search, sort, and pagination limitations are explicit rather than silently misleading | Gap | P2 | Citizen with at least 51 records; API and UI available | Reference fragment; title keyword; date; `limit=50` | 1. Look for a search field or filter/sort control on `/track`.<br>2. Try the notification/reference text as a search term.<br>3. Try `GET /grievances?q=...` and an explicit offset/page parameter.<br>4. Inspect the 51st record. | If the controls exist, they filter the citizen's own records correctly and show empty/invalid-term states; if they do not exist, the product does not pretend to support them and the list limit is clearly disclosed with a way to reach older records. | — | Not Run | Partial | PRD FR-GRV-006/008; NFR-PERF-002 | No citizen search/sort/pagination UI or `q`/offset API parameter was found; the default list limit is 50. Track as G-12/G-13. |

## 13. Error Handling and Reliability (USR-ERR)

**What is covered:** backend/service outages, 4xx/5xx responses, auth expiry
during work, hanging requests, lost responses and retries, malformed data,
refresh during a workflow, and multi-tab consistency.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-ERR-001 | Reliability | Backend unavailable does not produce an unusable blank page | Recovery | P1 | Frontend running; backend stopped or `/health` forced to fail; signed-out user | `/` and `/login` | 1. Stop the backend.<br>2. Open `/` and `/login`.<br>3. Trigger a login attempt.<br>4. Restart the backend and retry. | Static chrome and a clear service-unavailable message remain; no unhandled exception or infinite spinner; login reports that the service is unavailable and preserves the entered email; after restart the user can log in normally. | — | Not Run | Partial | PRD error/edge cases | Do not require the home page to be fully useful offline; require a comprehensible failure. |
| USR-ERR-002 | Reliability | Backend failure during submit or list preserves the citizen's work | Recovery | P1 | Signed-in citizen; valid form or existing list; network/API can be made to fail | Valid grievance; forced 500/offline | 1. Fill and submit with the backend failing.<br>2. Observe the error and the form.<br>3. Retry after restoring the service.<br>4. Open `/track` while the list request fails. | The form remains populated; a clear error is shown; no false success or reference appears; retry succeeds; a failed list shows an error/retry rather than a misleading empty dashboard; no partial record is reported as complete. | — | Not Run | Partial | PRD error/edge cases; NFR-PERF-001 | The list currently catches errors into an empty array (G-11). |
| USR-ERR-003 | Reliability | A 500 during submit is explained without losing text | Negative | P1 | Signed-in citizen; valid form; submit endpoint forced to 500 | Valid grievance; forced server error | 1. Submit and receive 500.<br>2. Inspect the visible message and console.<br>3. Check the form values and photo/location.<br>4. Retry successfully. | A general retryable error appears (no stack trace, database name, or token); title, description, photo, and location remain; no reference is shown; the retry creates one record; the user is not told the grievance exists when it does not. | — | Not Run | Partial | PRD error/edge cases; PRD API error contract | Also test a failure in notification creation after the grievance is stored; the citizen must not lose the reference. |
| USR-ERR-004 | Reliability | Server-side validation errors map to actionable field feedback | Negative | P2 | Signed-in citizen; API validation reachable; form can bypass client rules | Whitespace title; overlong address/profile; malformed location; invalid image URL | 1. Force each invalid payload through the API/UI.<br>2. Observe status, message, and field state.<br>3. Correct each and retry. | The client shows the server's reason in citizen-friendly language where possible; 400/422 is distinguished from 500; the relevant field is identified; values are retained; no raw Pydantic JSON or internal path is shown. | — | Not Run | Partial | PRD error/edge cases; PRD API requirements | The shared request helper reads `error` first; if the server returns only `detail`, verify a fallback message is shown. |
| USR-ERR-005 | Reliability | Session expiry during an operation either recovers or asks for a clean sign-in | Recovery | P1 | Signed-in citizen; access token near expiry; refresh token valid in one run and invalid/network-failing in another | Expired access; valid refresh; then corrupt refresh; then offline refresh | 1. Trigger a protected action with an expired access token and valid refresh.<br>2. Repeat with an invalid refresh.<br>3. Repeat with the refresh endpoint offline. | Valid refresh: action retries transparently once and succeeds. Invalid refresh: tokens clear and a sign-in prompt appears with the intended `next`. Network failure: tokens are retained for a later retry, and the user sees a temporary error rather than being silently logged out. | — | Not Run | Partial | DEC-050; PRD FR-AUTH-004; NFR-SEC-004 | This case distinguishes invalid credentials from transient network failure. |
| USR-ERR-006 | Reliability | A hung backend does not leave the citizen waiting forever | Recovery | P1 | Signed-in citizen; submit or list request can be made to hang (no response) | A request that never resolves; browser network inspection | 1. Initiate submission or list loading against a hanging endpoint.<br>2. Wait beyond a reasonable user expectation (record the time).<br>3. Observe the UI and any cancel/retry option.<br>4. Restore the service. | After a bounded time, the UI shows a timeout/retry message and re-enables the action; the form remains intact; no spinner runs forever; a late server success is not silently lost without a way to find the reference. | — | Not Run | Partial | NFR-PERF-001; PRD error/edge cases | Ordinary API calls have no explicit client timeout; voice calls do. This case is likely to expose G-09. |
| USR-ERR-007 | Reliability | A success response lost after server commit does not create a duplicate on retry | Recovery | P0 | Signed-in citizen; proxy can drop the response after the server stores the grievance | Valid grievance; drop response once; retry once | 1. Submit and let the server commit but drop the response.<br>2. Observe the client error.<br>3. Retry once.<br>4. Count records with the same title/description and inspect references. | The citizen can discover the already-created record or the system deduplicates the retry; exactly one grievance exists; the UI does not claim failure while a record exists without a recovery path; no duplicate notification is created. | — | Not Run | Partial | PRD error/edge cases; PRD FR-GRV-002 | No idempotency key or content dedupe was found; this is expected to fail and is tracked as G-08. |
| USR-ERR-008 | Reliability | Rapid repeated actions do not duplicate records or corrupt read state | Boundary | P0 | Signed-in citizen; valid form; one unread notification | Rapid submit clicks; rapid mark-read clicks | 1. Rapidly activate Submit and Mark as read several times.<br>2. Observe request counts.<br>3. Check the list and notification state.<br>4. Refresh. | Submit creates one grievance; mark-read is idempotent; the UI disables or serialises the action while in flight; no duplicate toast, record, or inconsistent unread count remains after refresh. | — | Not Run | Yes | DEC-038; PRD FR-NOT-005 | Submission has a client lock; server idempotency is still absent. |
| USR-ERR-009 | Reliability | Malformed or partial API data does not crash the citizen UI | Negative | P2 | Signed-in citizen; proxy can rewrite a response | List with missing `createdAt`; detail with missing status; notification with null title; invalid JSON | 1. Load `/track` with each malformed response.<br>2. Open the detail and notifications.<br>3. Inspect the render and error boundary.<br>4. Restore the response. | The app either rejects the payload with a clear error or renders safe fallbacks; no blank screen, unhandled zod exception in the console, or `NaN`/`Invalid Date`; the user can retry; one bad record does not hide the rest if recovery is possible. | — | Not Run | Partial | PRD error/edge cases | The frontend parses responses with zod; verify the error is caught at the page level rather than escaping to a blank screen. |
| USR-ERR-010 | Reliability | Refreshing during voice intake does not cause a phantom submission | Recovery | P2 | Voice conversation in progress with at least one utterance; no submission yet | Browser refresh / tab close/reopen | 1. Record one utterance and reach review.<br>2. Refresh the page.<br>3. Reopen `/submit`.<br>4. Check the list and network history. | No grievance is submitted by the refresh; the conversation may be lost but the UI explains that it resets; the manual form is available; no duplicate or partial record exists; the citizen can start again. | — | Not Run | Partial | DEC-038; PRD error/edge cases | Intake state is client-only and not persisted; loss is acceptable if it is not silent or harmful. |
| USR-ERR-011 | Reliability | Refreshing during submission does not hide a committed grievance | Recovery | P1 | Signed-in citizen; submit request in flight; network can be delayed | Valid grievance; refresh while in flight | 1. Start submission and refresh immediately.<br>2. Reopen `/submit` and `/track`.<br>3. Compare the list count and reference.<br>4. If a record exists, verify the citizen can find it. | The app does not show a second success for the same record; if the server committed, the record is discoverable in `/track`; if it did not, no reference is shown; the citizen is not left with a phantom success or an invisible record. | — | Not Run | Partial | PRD error/edge cases; PRD FR-GRV-002 | Without idempotency, the main risk is a duplicate if the user resubmits; see USR-ERR-007. |
| USR-ERR-012 | Reliability | Multi-tab and invalid-state interactions stay consistent | Boundary | P2 | Citizen signed in in two tabs; staff fixture can change status | Same grievance in two tabs; an invalid staff transition | 1. Open the same grievance in two tabs.<br>2. Change status in one tab/context.<br>3. Refresh the other tab.<br>4. Attempt an invalid transition as staff and observe the citizen view. | The refreshed tab shows the authoritative status; no stale tab overwrites the server; an invalid transition returns 422 and does not change the citizen-visible state; the error is not presented as a citizen action; no duplicate history entry appears. | — | Not Run | Partial | PRD FR-WKF-001; PRD error/edge cases | Status PATCH currently accepts arbitrary values; the state-transition endpoint is the strict path (G-06). |

## 14. Security and Privacy from the User Perspective (USR-SEC)

**What is covered:** the functional security checks a citizen-facing tester can
perform without destructive exploitation: auth gating, token misuse, role
tampering, cross-user writes, notification and profile isolation, injection,
error leakage, URL/history exposure, attachment privacy, server-side upload
validation, enumeration/rate limits, and CORS.

**Rules:** use only synthetic accounts and records. Do not run these against
production. For SSRF/upload cases, use an isolated test URL and stop at
evidence of the behaviour; do not target internal services.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-SEC-001 | Security | Citizen pages and APIs reject missing authentication | Security | P0 | No tokens; clean browser/API client; at least one grievance exists in the database | `/submit`, `/track`, `/profile`, `/notifications`; `GET /grievances`; `POST /submit-grievance`; `GET /notifications` | 1. Open each page in a fresh tab.<br>2. Call each protected endpoint without an Authorization header.<br>3. Inspect status, body, and rendered state. | Pages show a sign-in gate or redirect with `next`; APIs return 401 with a flat error; no grievance, profile, notification, or count is returned; no data flashes before the gate. | — | Not Run | Yes | NFR-SEC-002; PRD role rules | Public single-record lookup is a separate exception; see USR-SEC-011 and USR-API-007. |
| USR-SEC-002 | Security | Expired, malformed, or wrong-type tokens are rejected | Security | P0 | Signed-in citizen; a valid access token and refresh token; ability to edit request headers | Expired access JWT; malformed string; refresh token sent as Bearer; token signed with a wrong secret | 1. Call `GET /auth/me` with each token variant.<br>2. Call `GET /grievances` with each.<br>3. Try a token with a modified role claim but an invalid signature.<br>4. Restore a valid token. | Every invalid/expired/wrong-type token returns 401; no profile or grievance data is returned; the role claim is never trusted without signature verification; a valid token still works afterward; no token value is echoed in the error. | — | Not Run | Yes | NFR-SEC-002/004; PRD FR-AUTH-003/005 | JWT type is checked (`access` vs `refresh`); confirm both endpoints enforce it. |
| USR-SEC-003 | Security | Tampering with the client-side role does not grant staff access | Security | P0 | Signed-in citizen; browser devtools available; staff endpoints known | localStorage demo-user object with `role: ADMIN`; `grievance-access-token` left unchanged | 1. Modify the stored demo user role to ADMIN/SUPERADMIN.<br>2. Reload and observe the shell/navigation.<br>3. Call staff list/queue endpoints with the unchanged citizen token.<br>4. Attempt a staff write. | The UI may render a staff shell because it trusts the local profile, but no staff API returns data and every staff write is 403; no other citizen's records are exposed; the client-side role never becomes an authorization decision. | — | Not Run | Yes | PRD role rules; NFR-SEC-002 | This is a key “never trust client role claims” test. Record any UI-only escalation as a defense-in-depth issue. |
| USR-SEC-004 | Security | Citizen tokens cannot invoke staff-only endpoints | Security | P0 | Signed-in citizen; at least one grievance; staff endpoints identified from the API docs/routers | `PATCH /grievances/{id}/status`; assign/reassign/escalate/resolve/close/reject; `GET /resolver/tasks`; admin analytics/users | 1. Call each endpoint with the citizen token.<br>2. Inspect status and body.<br>3. Verify the grievance and assignments are unchanged.<br>4. Repeat on a grievance owned by the citizen and one owned by someone else. | Every staff-only call returns 401/403; no state change, assignment, resolution, or analytics data is returned; the error is generic and does not reveal the required role; the record remains unchanged. | — | Not Run | Yes | NFR-SEC-002; PRD role rules; docs/SECURITY.md | Status PATCH uses a role dependency; verify the newer state/transition endpoint too. |
| USR-SEC-005 | Security | A citizen cannot change another citizen's grievance state | Security | P0 | Citizens A and B; A has a grievance; B signed in | A's reference; `PATCH /grievances/{A-id}/status`; `/state`; `/withdraw`; `/reopen` | 1. As B, call each write endpoint against A's ID.<br>2. Inspect status and A's record afterward.<br>3. Repeat with an ID that does not exist. | All cross-owner writes return 403/404; A's state, assignment, and history are unchanged; no error reveals A's title or owner; B can still act on B's own record where the state rules allow. | — | Not Run | Yes | PRD role rules; NFR-SEC-002 | Withdraw/reopen enforce owner checks for USER; status PATCH is staff-only. |
| USR-SEC-006 | Security | A citizen cannot withdraw or reopen another citizen's grievance | Security | P0 | Citizens A and B; A has a resolved grievance; B signed in | A's resolved reference; withdraw/reopen payloads | 1. As B, call withdraw on A's resolved record.<br>2. Call reopen on A's resolved record.<br>3. Check A's status and history.<br>4. Perform the same actions on B's own eligible record. | Cross-owner calls are 403/404; A's record is unchanged; B's own eligible record behaves according to the state rules; no error exposes A's details; the actions are absent from the citizen UI but still protected at the API. | — | Not Run | Yes | PRD role rules; PRD FR-GRV-012 | Withdraw is API-only in the citizen UI. |
| USR-SEC-007 | Security | Phone and face settings cannot be changed for another account | Security | P1 | Citizens A and B; A has a verified phone; B signed in; face flag may be on | A's phone/user ID; face admin-reset endpoint; profile update attempts | 1. Try to bind/unbind a phone using A's identifier in the body/query.<br>2. Try to delete or reset A's face template.<br>3. Try to update A's SMS consent.<br>4. Verify A's account is unchanged. | All endpoints operate only on the authenticated user or require a staff role that B lacks; cross-account attempts return 403/404; A's phone, consent, and face state are unchanged; no masked number leak. | — | Not Run | Yes | NFR-SEC-002; DEC-024; DEC-046 | `POST /phone/*` and `/face/*` use the current user; confirm the admin-reset path is SUPERADMIN-only. |
| USR-SEC-008 | Security | Injection-looking text is escaped across all citizen surfaces | Security | P0 | Signed-in citizen; a valid grievance can be submitted; notifications can be created | `<script>alert(1)</script>`; `<img src=x onerror=alert(2)>`; `javascript:` URL; HTML in address and notification title | 1. Submit the payload in title, description, and address.<br>2. Open the success card, list card, detail, and notification.<br>3. Inspect the DOM and console.<br>4. Reload and repeat. | No script executes and no dialog appears; markup is rendered as literal text; the notification copy is escaped; the stored data round-trips without becoming active content; no `javascript:` link is created. | — | Not Run | Yes | NFR-SEC-002; docs/SECURITY.md input validation | React escaping is the expected control; also check any `dangerouslySetInnerHTML` or manually built HTML. |
| USR-SEC-009 | Security | Error responses do not expose internals or sensitive values | Security | P1 | Backend and frontend running; ability to force errors | Invalid payload; unknown ID; forced 500; expired token; malformed JSON | 1. Trigger each error through the UI/API.<br>2. Inspect the response body and browser console.<br>3. Look for stack traces, file paths, collection names, SQL/Mongo statements, JWT secrets, API keys, or tokens.<br>4. Verify the UI shows a safe message. | Errors are flat, citizen-readable messages; no stack trace, internal path, database query, secret, token, or another user's data is exposed; server logs may contain diagnostic detail but the client response does not. | — | Not Run | Yes | PRD API requirements; docs/SECURITY.md | Check both `{error: ...}` and FastAPI `{detail: ...}` paths. |
| USR-SEC-010 | Security | Credentials and tokens do not leak through URLs or browser history | Security | P1 | Signed-in citizen; browser history/devtools available; Google OAuth case if configured | Login, refresh, Google callback, submit, logout | 1. Perform each flow with the network/history panel open.<br>2. Inspect URLs, Referer headers, and stored history entries.<br>3. Check localStorage/sessionStorage keys.<br>4. Log out and inspect remnants. | Passwords and JWTs are not placed in page URLs or Referer headers; the Google callback does not leave long-lived tokens in history (or the trade-off is explicitly documented); logout clears stored tokens; no secret appears in console logs. | — | Not Run | Partial | NFR-SEC-001/004; docs/SECURITY.md | Google OAuth implementations often pass tokens in the query string; if observed, record as G-18. |
| USR-SEC-011 | Security | Private evidence is not exposed through a guessable/public URL | Security | P1 | Citizen uploaded a photo; the image URL is known; signed-out browser available | Cloudinary `secure_url`; direct image request without a token | 1. Copy the image URL from the citizen detail or API.<br>2. Open it in a private window with no session.<br>3. Try a neighboring public ID if one is visible.<br>4. Check cache headers. | Evidence is accessible only to authorized viewers, or the product explicitly accepts public-by-URL storage and documents that risk; URLs are not trivially guessable; a signed-out user cannot browse another citizen's evidence; no EXIF/location leak beyond the intended evidence. | — | Not Run | Partial | docs/SECURITY.md file attachment security; PRD privacy requirements | Cloudinary unsigned uploads produce public URLs unless configured otherwise; this is a likely privacy gap (G-19). |
| USR-SEC-012 | Security | Attachment validation is enforced server-side, not only in the browser | Security | P1 | Signed-in citizen; ability to call `/submit-grievance` and `/validate-image` directly | A direct `imageUrl` to a non-image, an oversized file, a private/internal URL, and a valid image | 1. Bypass the UI and submit each `imageUrl` directly.<br>2. Call `/validate-image` with each URL.<br>3. Observe status, fetch behaviour, and stored record.<br>4. Do not target production/internal services. | The server validates content/type/size or rejects the reference; it does not fetch arbitrary internal/metadata URLs; a failed image validation does not silently store an unvetted attachment; errors are safe; the citizen can submit without a photo. | — | Not Run | Partial | docs/SECURITY.md file attachment rules; PRD FR-GRV-014 | `/validate-image` is unauthenticated and fetches a caller-supplied URL; the SSRF surface is documented in the existing test suite. Treat it as a known risk (G-20), not a new exploit target. |
| USR-SEC-013 | Security | Enumeration and brute-force paths are rate-limited and generic | Security | P2 | Backend available; test IP/phone/email; rate-limit configuration known | Repeated wrong logins; repeated OTP requests; repeated captcha requests; repeated transcribe requests | 1. Exceed the configured threshold for each endpoint.<br>2. Inspect status, message, and `Retry-After`.<br>3. Verify a valid request after the window works.<br>4. Confirm no account-existence difference. | Thresholds return 429 with a safe message and retry timing where applicable; login/OTP responses do not reveal whether an account exists; rate limits are per user/IP as designed; a legitimate user can recover after the window; no lockout message leaks personal data. | — | Not Run | Partial | docs/SECURITY.md; DEC-046; docs/VOICE_ASSISTED_COMPLAINT.md quotas | Verify login, OTP, captcha, and transcription separately; they have different limits. |
| USR-SEC-014 | Security | CORS and security headers match the deployment contract | Security | P2 | Deployed/staging frontend and backend; tester can send custom Origin headers | Allowed frontend origin; an unrelated origin; `Origin: null`; preflight requests | 1. Send a simple and a preflight request from the allowed origin.<br>2. Repeat from an unrelated origin.<br>3. Inspect `Access-Control-Allow-Origin`, credentials, and security headers.<br>4. Verify the browser blocks disallowed reads. | Only the configured frontend origin is allowed when credentials are enabled; a wildcard is not combined with credentials; disallowed origins cannot read authenticated responses; sensible security headers are present; the documented CORS setting matches the deployment. | — | Not Run | Partial | docs/SECURITY.md API security; NFR-SEC-001 | Configuration default is `CORS_ORIGINS=*`; if credentials are also allowed, treat the mismatch as a P1/P2 finding and record it environment-specifically. |

## 15. API-Level Technical Checks (USR-API)

These checks are deliberately separated from the UI journeys. They validate
the contracts the citizen UI depends on, not an exhaustive backend unit-test
plan. Existing pytest coverage is noted in §19 and should be reused.

| Test Case ID | Module | Scenario Title | Scenario Type | Priority | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Automation Candidate | Requirements Reference | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USR-API-001 | API | Registration returns a valid token pair and safe user object | Positive | P0 | Backend running; captcha obtainable; unique synthetic email/phone | Valid register payload; solved captcha | 1. `GET /auth/captcha` and solve the challenge.<br>2. `POST /auth/register` with the valid payload.<br>3. Inspect status and body.<br>4. Decode the access token and call `/auth/me`. | 201; returns `access_token`, `refresh_token`, and a `user` object with id/email/name/role; role is `USER`; no `hashed_password` or secret is returned; the token subject matches the user; `/auth/me` returns the same identity. | — | Not Run | Yes | PRD FR-AUTH-001/003; docs/API.md | Do not hardcode a captcha answer; solve or mint one through the test harness. |
| USR-API-002 | API | Registration rejects invalid, duplicate, and captcha-failed payloads safely | Negative | P1 | Backend running; one existing account; captcha available | Missing email/password/name; invalid email; 7-character password; under-18 DOB; 9-character address; duplicate email/phone; wrong captcha | 1. Send each payload to `/auth/register`.<br>2. Record status and error shape.<br>3. Verify no partial user is created.<br>4. Confirm the error does not leak internals. | 400/409/422 as appropriate; flat error or validation detail that is safe to expose; duplicate checks do not create a second user; the existing account is unchanged; invalid captcha cannot be reused. | — | Not Run | Yes | PRD FR-AUTH-001; DEC-031; PRD API error contract | Confirm whether validation errors use `error` or `detail`; the frontend supports both imperfectly. |
| USR-API-003 | API | Login, me, and refresh enforce token type and expiry | Security | P0 | A valid account; access and refresh tokens | Wrong password; valid login; access token; refresh token; expired token; malformed token | 1. `POST /auth/login` with valid and invalid credentials.<br>2. Call `/auth/me` with access, refresh, expired, and malformed tokens.<br>3. Call `/auth/refresh` with a valid and an invalid refresh token.<br>4. Inspect rotation. | Valid login returns both tokens; wrong credentials return the same 401; `/auth/me` rejects refresh/expired/malformed tokens; refresh returns a new access token and (where rotated) a new refresh token; invalid refresh returns 401; no token is accepted after its lifetime. | — | Not Run | Yes | PRD FR-AUTH-003/004; NFR-SEC-004 | There is no server-side logout/revocation endpoint; a previously issued refresh token may remain valid after client logout (G-16). |
| USR-API-004 | API | Submission uses the JWT identity, persists the record, and returns the reference contract | Positive | P0 | Signed-in citizen; valid payload; Mongo or known in-memory mode | Valid title/description/location; a forged `userId` for Citizen B | 1. `POST /submit-grievance` with a valid payload and a body `userId` pointing to B.<br>2. Inspect status, reference, `hfEngine`, and `flagged`.<br>3. `GET /grievances/{id}` as the owner.<br>4. Inspect the stored `userId` and timestamps. | 2xx; reference matches `GRV-YYYY-NNNN`; response includes the expected fields; the record owner is the JWT user, not the forged body value; title/description are trimmed; the record is persisted and retrievable; a submission notification exists. | — | Not Run | Yes | PRD FR-GRV-001/002/003; NFR-SEC-002 | Ownership is taken from the token; the body `userId` is parsed but not trusted. |
| USR-API-005 | API | Submission validation boundaries are explicit and safe | Boundary | P2 | Signed-in citizen; API access | Missing title/description; whitespace-only; punctuation-only `!!! 123 ???`; 50,000-character text; no latitude/longitude; invalid coordinate types; harmful HTML text | 1. Send each payload.<br>2. Record status/error.<br>3. Check persistence and response time.<br>4. Clean up created synthetic records. | Missing fields return 422 or 400 with a safe message; whitespace-only and letterless text return 400; no-location is accepted at the API (documented delta from the UI); overlong text is either bounded or persisted without truncation; non-numeric coordinates are rejected; HTML is stored as text, not executable. | — | Not Run | Partial | PRD FR-GRV-001; DEC-059; docs/API.md | The server does not enforce the client’s 5/20-character minimums or a documented maximum; it does reject empty/letterless text (DEC-059). Record the observed contract as a clarification (G-23). |
| USR-API-006 | API | List scoping, filtering, ordering, and limit bounds are enforced | Security | P0 | Citizens A/B with different records; known states; API access | `?userId=B`; `?state=...`; `?limit=0`, `1`, `50`, `1000`, `1001`; no token | 1. Call the list as A with each query.<br>2. Call it as B and without a token.<br>3. Inspect owner IDs, order, and count.<br>4. Compare in-memory and Mongo modes if available. | A sees only A's records even with B's `userId`; B sees only B's; no token returns 401; valid states filter correctly; limits outside 1–1000 return 422; ordering is createdAt then ID descending; no offset/pagination parameter silently changes semantics. | — | Not Run | Yes | NFR-SEC-002; PRD FR-GRV-006; repository contract | `limit` is bounded by FastAPI `Query(ge=1, le=1000)`; there is no search text parameter. |
| USR-API-007 | API | Detail access distinguishes owner, other citizen, public, and missing records | Security | P0 | Citizens A/B; A has a grievance; API access | A's ID with A token, B token, no token; unknown ID; lowercase ID | 1. Request the record in each identity state.<br>2. Compare returned fields.<br>3. Try a sequential neighboring ID.<br>4. Inspect error bodies. | Owner gets the full record; another citizen gets 403/404 with no title, description, category, location, or history; public/no-token gets no personal data; unknown returns 404; lookup is case-insensitive without exposing extra records. | — | Not Run | Yes | NFR-SEC-002; PRD role rules; PRD privacy | Implementation observation: non-owner/public calls return 200 with a “public tracking” projection (title, status, state, category, priority, departmentId, createdAt, empty description). This is expected to fail the privacy expectation and is tracked as G-04/G-05. |
| USR-API-008 | API | Status updates require staff role and valid state transitions | Security | P1 | Citizen and staff tokens; a grievance in a known state | Blank status; `AWAITING_VERIFICATION`; valid `IN_PROGRESS`; invalid `CLOSED` from `PENDING_ASSIGNMENT` | 1. Call `PATCH /grievances/{id}/status` as citizen, resolver, admin.<br>2. Try blank and unknown values.<br>3. Try the strict `/state` transition endpoint with a valid and invalid state.<br>4. Inspect history and audit entries. | Citizen gets 403; staff can update only allowed values; blank is 400; the strict transition endpoint returns 422 for an invalid transition and appends exactly one history entry for a valid one; an unknown status never reaches the citizen UI as a trusted state. | — | Not Run | Yes | PRD FR-GRV-004/005; PRD FR-WKF-001; NFR-SEC-005 | Code observation: PATCH /status validates only nonblank, not the vocabulary; the `/state` endpoint calls the state machine. This inconsistency is G-06. |
| USR-API-009 | API | Withdraw and reopen enforce ownership and permitted states | Security | P1 | Citizens A/B; records in open, in-progress, resolved, and terminal states; API access | Own/other IDs; open and terminal states; missing reason | 1. Withdraw own open grievance with a reason.<br>2. Withdraw another's.<br>3. Withdraw a terminal one.<br>4. Reopen own resolved and another's resolved. | Own open withdraw succeeds and records history; another's returns 403; terminal withdraw returns 422; reopen succeeds only from RESOLVED for the owner; reopen from other states returns 422; no cross-user state change occurs. | — | Not Run | Yes | PRD FR-GRV-012; PRD role rules; PRD FR-GRV-004 | Withdraw currently allows any nonterminal state for the owner, which is broader than the state-machine table; record as G-07. |
| USR-API-010 | API | Progress history and notifications are scoped to the intended audience | Security | P1 | Citizen A with customer-visible progress; Citizen B; staff; API access | A's grievance history with A/B/no token; internal-only note; notification IDs | 1. Fetch history as owner, other citizen, public, and staff.<br>2. Compare `bodyInternal` and customer fields.<br>3. Fetch/mark notifications as owner and other.<br>4. Inspect limits. | Owner sees customer/system updates without internal notes; other citizens/public see no internal notes and no private data; staff see the appropriate internal view; notifications are owner-scoped; limits are bounded. | — | Not Run | Yes | PRD FR-GRV-011; PRD FR-NOT-004; DEC-050 | History allows PUBLIC to read customer-visible updates for a known ID; decide whether that is intended and record it. |
| USR-API-011 | API | Image validation is bounded and does not become an open fetch proxy | Security | P1 | Backend running; test URLs only; no internal targets | Missing URL; valid public image; non-image URL; large image; private/loopback URL (test only) | 1. `POST /validate-image` with each input.<br>2. Record status, timing, and response fields.<br>3. Check whether the endpoint requires auth.<br>4. Verify submit re-validates or trusts the URL. | Missing URL returns 400; valid images return a bounded score/decision; non-images fail safely; requests have time/size bounds; the endpoint does not fetch arbitrary internal metadata services; auth expectations are explicit; submit does not store an unvalidated attachment silently. | — | Not Run | Partial | docs/SECURITY.md; PRD FR-GRV-014 | The endpoint is public and fetches a caller-supplied URL; existing tests document the SSRF surface. Do not exploit; record as G-20. |
| USR-API-012 | API | Speech transcription enforces its documented contract and error codes | Integration | P1 | `TRANSCRIPTION_ENABLED=true`; valid citizen token; sample WAV | Missing file/language; extra fields; invalid language; malformed/truncated WAV; oversized body; wrong container; repeated idempotency key | 1. Call `/transcribe` with each case.<br>2. Record status and flat error.<br>3. Send a valid WAV and verify the transcript shape.<br>4. Repeat with the same Idempotency-Key. | Valid audio returns transcript/language/request ID without inventing confidence; missing/extra/invalid parts return 400; auth failures 401; deadline 408; idempotency conflict 409; size 413; unsupported PCM 415; rate limit 429 with Retry-After; disabled/provider failure 503; no key/audio/transcript is logged. | — | Not Run | Yes | docs/VOICE_ASSISTED_COMPLAINT.md endpoint contract; docs/SECURITY.md | Use only synthetic audio; provider calls may need to be mocked for deterministic failures. |
| USR-API-013 | API | Conversational extraction is stateless, bounded, and schema-safe | Integration | P1 | Signed-in citizen; extraction service available or mocked | One answer; maximum allowed answers; empty answers; mixed language; hostile HTML; provider timeout | 1. Call `/grievance-intake/extract` with each payload.<br>2. Inspect the schema and follow-up question.<br>3. Verify no grievance or database record is created.<br>4. Force a provider failure and inspect fallback. | Returns only the documented fields (title/description/location/category/priority/question kind); rejects empty/over-limit/unauthorized payloads; unknown question kinds become null; provider failure returns a safe fallback or error; no grievance is created; no database write occurs. | — | Not Run | Yes | DEC-038; DEC-040; docs/API.md | Extraction is advisory; submission still uses `/submit-grievance`. |
| USR-API-014 | API | Duplicate submissions and concurrent IDs behave predictably | Boundary | P0 | Signed-in citizen; ability to send concurrent requests | Two identical submits; ten concurrent submits; two different citizens | 1. Send the duplicate submits.<br>2. Send the concurrent creates.<br>3. Inspect all references and owners.<br>4. Restart the backend and repeat a create. | Every successful create has a unique `GRV-YYYY-NNNN`; concurrent creates do not collide or 500; the sequence resumes after restart; identical content is **not** silently deduplicated (current behaviour) and the duplicate is visible; the test records this as a known gap for idempotency. | — | Not Run | Partial | PRD FR-GRV-002; PRD error/edge cases; DEC-014 | Idempotency/dedupe is not implemented; this case verifies the current contract and feeds G-08. |
| USR-API-015 | API | Important citizen requests meet a usable performance envelope | Performance | P2 | Staging-like environment; 1,000 synthetic records; AI providers configured or disabled and recorded | Submit with keyword fallback; submit with live AI; list 50/1,000 records | 1. Measure 20 submissions and 20 list calls with browser/network timings.<br>2. Record p50/p95 and failures.<br>3. Compare AI-on versus AI-off.<br>4. Repeat under a slow network profile. | Submission returns within the documented/usable budget with AI off or shows an explicit bounded fallback; list of 1,000 is bounded by the limit and loads within the NFR target on the stated environment; no request hangs indefinitely; results are recorded with environment caveats, not generalized. | — | Not Run | Partial | NFR-PERF-001/002; DEC-042 | NFR says submit under 500 ms excluding async AI, but classification is synchronous; measure and report the mismatch rather than asserting a pass. |
| USR-API-016 | API | Data persistence matches the configured storage mode | Positive | P1 | Case A: MongoDB test database. Case B: no `MONGODB_URI` (in-memory fallback) | One submitted grievance; backend restart | 1. Check `/health` storage mode.<br>2. Submit a grievance.<br>3. Restart the backend.<br>4. Fetch the reference as the owner. | Mongo mode: the record and its owner/history survive restart; in-memory mode: `/health` says in-memory and the record is expected to disappear, clearly documented; no mode silently claims durable storage while losing data. | — | Not Run | Partial | docs/DATABASE.md; PRD FR-DAT-001 | Never use the in-memory fallback for a persistence pass claim. |

---

## 16. End-to-End User Journeys

These journeys exercise multiple modules in one realistic session. They are the\nprimary release-gate scenarios; the module cases above provide the detailed\nassertions. Staff actions are **test setup**, not staff-UI testing.

### E2E-01 — First-time citizen: register, submit, track, return

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-01 — First-time citizen registers, submits a grievance, tracks it, signs out, and returns |
| **Persona** | Asha, 34, first-time smartphone user, English UI, reliable network |
| **Priority / type** | P0 · Positive end-to-end |
| **Covers** | USR-AUTH-001, AUTH-002, AUTH-010, AUTH-015, AUTH-016; USR-GRV-001; USR-TRACK-001, TRACK-002; USR-NAV-006 |
| **Preconditions** | Clean synthetic database; backend/frontend live; captcha and SMS dry-run available; no session in the browser |
| **Test data** | New `citizen.asha+<run>@example.test`; `Citizen#123`; phone `9876500001`; water complaint; `Shivajinagar, Pune` |
| **Steps** | 1. Open `/` and verify the Register/Track calls to action.<br>2. Open `/register`, fill the full profile, solve captcha, and create the account.<br>3. Complete the phone OTP step with the local debug code.<br>4. Confirm the app lands on `/submit` as a signed-in citizen.<br>5. Submit the water grievance with a confirmed location.<br>6. Record the generated `GRV-YYYY-NNNN` reference.<br>7. Open `/track`, find the card, and open its detail.<br>8. Reload the page and verify the session is restored.<br>9. Sign out; open `/track` and confirm the gate.<br>10. Sign in again and verify the same reference is present exactly once. |
| **Expected result** | One account and one grievance; the reference is stable across screens and sessions; the citizen sees title/status/reference/description/location and no classification or officer data; sign-out hides data; sign-in restores it; no duplicate record is created. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Yes — Playwright with a seeded captcha/OTP test seam or manual captcha |
| **Requirements** | PRD FR-AUTH-001/003; FR-GRV-001/002/003/006; FR-NOT-001; DEC-031; DEC-044 |
| **Notes** | This is the release smoke journey. If it cannot pass, no other positive result is meaningful. |

### E2E-02 — Returning citizen: session expiry in the middle of a submission

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-02 — Access token expires while the citizen is filling and submitting the form |
| **Persona** | Returning citizen, signed in on a laptop, short test access-token lifetime |
| **Priority / type** | P0 · Recovery end-to-end |
| **Covers** | USR-AUTH-017, AUTH-018; USR-ERR-005, ERR-007; USR-GRV-020; USR-API-003 |
| **Preconditions** | Valid account and refresh token; access-token lifetime shortened for the test; no other tab refreshing simultaneously |
| **Test data** | Road complaint; valid location; expired access fixture; invalid-refresh variant |
| **Steps** | 1. Sign in and open `/submit`.<br>2. Fill title, description, and location.<br>3. Wait until the access token expires.<br>4. Click Submit and observe the 401/refresh/retry sequence.<br>5. Confirm the form is not duplicated or cleared.<br>6. In a second run, corrupt the refresh token and repeat.<br>7. Sign in again and check the record state. |
| **Expected result** | With a valid refresh: one transparent refresh, one successful submit, one record. With an invalid refresh: a clean sign-in prompt and no false success; after re-login the citizen can determine whether the record was created. Under no branch is a second grievance created without the user explicitly submitting again. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — needs a controllable token clock/fixture |
| **Requirements** | PRD FR-AUTH-004; NFR-SEC-004; PRD error/edge cases |
| **Notes** | The invalid-refresh branch may lose the in-memory draft because there is no autosave. Record that as a usability consequence, not a duplicate submission. |

### E2E-03 — Hindi voice grievance: speak, review, locate, attach, submit, track

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-03 — A Hindi-speaking citizen completes a voice-first grievance |
| **Persona** | Meera, 46, comfortable in Hindi, limited English, uses a phone with a microphone |
| **Priority / type** | P1 · Positive end-to-end (external service) |
| **Covers** | USR-VOICE-001, VOICE-006, VOICE-014, VOICE-017; USR-GRV-002; USR-TRACK-001; USR-ACC-011 |
| **Preconditions** | Voice flag on; Sarvam STT available; microphone permission allowed; Hindi text rendering; Cloudinary available for the photo |
| **Test data** | Hindi water complaint from §1.7; `water-evidence.jpg`; location `शिवाजीनगर, पुणे` or `Shivajinagar, Pune` |
| **Steps** | 1. Switch the interface to Hindi and confirm labels render.<br>2. Open `/submit`, choose Voice, set complaint language to Hindi.<br>3. Start, grant microphone permission, speak the complaint, and stop.<br>4. Inspect the Devanagari transcript and proposed fields.<br>5. Answer/skip any clarification; switch to manual to correct one word; return to review.<br>6. When the spoken location is suggested, search/select the correct place and confirm the pin; confirm no automatic pin was made.<br>7. Add the photo or skip it.<br>8. Submit and record the reference.<br>9. Open `/track` and verify the grievance and status. |
| **Expected result** | The voice path produces a reviewable Hindi draft; the citizen explicitly corrects and confirms the location; the photo is optional; submission succeeds once; the tracking view shows the record without AI labels; the interface language does not corrupt the complaint language. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | No — real microphone/STT plus human language review; partial UI automation possible |
| **Requirements** | DEC-038; DEC-041; DEC-044; DEC-026; PRD FR-GRV-001/002 |
| **Notes** | Speech accuracy is observational/EXPERIMENTAL. A recognition error is not a workflow failure if the transcript is reviewable and correctable. |

### E2E-04 — AI provider outage: text survives, photo path does not block

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-04 — Submit while the classification provider and image validator are unavailable |
| **Persona** | Citizen submitting a road complaint during an external AI outage |
| **Priority / type** | P1 · Resilience end-to-end |
| **Covers** | USR-AI-004, AI-006; USR-GRV-017; USR-ERR-003; USR-API-004 |
| **Preconditions** | Backend reachable; Groq/HF disabled or forced to timeout; image LLM forced to raise; keyword fallback enabled |
| **Test data** | Clear road complaint; valid location; valid JPEG in the second variant |
| **Steps** | 1. Disable the text AI provider and submit the text-only complaint.<br>2. Verify the reference, latency, and stored fallback classification as staff.<br>3. Re-enable the backend but force the image-validation LLM to fail.<br>4. Upload the valid photo and submit a second complaint.<br>5. Observe the HTTP status and whether the citizen is asked to remove the photo.<br>6. Verify both records and notifications. |
| **Expected result** | Text-only submission succeeds with a safe fallback and no citizen-facing provider error. The photo path must follow FR-AI-008: it succeeds with an unassessed image or clearly asks the citizen to remove it; it never blocks the only submission path with an opaque 500. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — backend failure injection needed |
| **Requirements** | PRD FR-AI-008; DEC-042; docs/AI_SYSTEM.md fallback rules |
| **Notes** | Code observation: the server-side image LLM failure returns 500 and blocks the photo submission. This journey is designed to expose that discrepancy (G-10). |

### E2E-05 — Ambiguous stays reviewable; clearly non-civic is rejected without side effects

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-05 — A vague civic complaint is accepted, while a clear non-civic request is rejected before persistence |
| **Persona** | Citizen with limited literacy; second attempt is a general-knowledge/riddle request |
| **Priority / type** | P2 · Negative/quality end-to-end |
| **Covers** | USR-AI-002, AI-007, AI-008, AI-009; USR-COMM-001; USR-TRACK-001 |
| **Preconditions** | Signed-in citizen; civic-scope gate live; valid location; voice/text mode available |
| **Test data** | `It is not working again. Please fix it soon.`; `What is the capital of France?`; `2 + 2 = 4. Solve this riddle.`; Pune location |
| **Steps** | 1. Submit the vague complaint and record the reference.<br>2. Open `/track` and verify it is present.<br>3. Submit the general-knowledge/riddle text with a valid location.<br>4. Read the 422 correction prompt; confirm no reference is shown.<br>5. Return to `/track` and count records/notifications.<br>6. As staff, inspect the vague record's outcome/quality metadata; confirm it was not auto-rejected. |
| **Expected result** | The vague civic complaint is accepted (2xx) and remains visible/reviewable; the clear non-civic request receives 422 with a civic-issue correction prompt; no reference, record, notification, or ID is created for it; the UI distinguishes a validation rejection from a system error; existing records are unchanged. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — API gate is automatable; UI wording needs review |
| **Requirements** | DEC-062; DEC-049; DEC-044; PRD FR-AI-003/008 |
| **Notes** | The gate is deliberately asymmetric. If a genuine complaint is rejected, record a false-positive defect; do not weaken the gate to flag-all without a product decision. |

### E2E-06 — Lost submit response: discoverability instead of duplicate

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-06 — The server stores the grievance but the response is lost; the citizen retries |
| **Persona** | Citizen on an unstable mobile connection |
| **Priority / type** | P0 · Recovery/data-integrity end-to-end |
| **Covers** | USR-ERR-007, ERR-011; USR-GRV-019, GRV-020; USR-API-014 |
| **Preconditions** | A proxy or browser route can drop the response after the backend has committed; valid account/form |
| **Test data** | One unique title/description; valid location; response-drop rule matching the submit call |
| **Steps** | 1. Fill and submit a valid grievance.<br>2. Allow the request to reach the backend, then drop the response.<br>3. Observe the client error and whether a reference is shown.<br>4. Open `/track` in a new tab and look for the record.<br>5. Return and press Submit again once.<br>6. Count records with the same title and inspect both references/notifications. |
| **Expected result** | The citizen can discover the committed record (for example via the list) or the retry is deduplicated; exactly one grievance exists for that content; no duplicate notification; the UI does not falsely claim failure while hiding the record. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — requires proxy/route interception and backend inspection |
| **Requirements** | PRD FR-GRV-002; PRD error/edge cases |
| **Notes** | No idempotency key or content dedupe was found. Expect this journey to expose duplicate creation (G-08); record both references and clean them up afterward. |

### E2E-07 — Privacy boundary: Citizen B tries to read Citizen A's grievance

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-07 — Cross-account read attempt through the UI and the underlying API |
| **Persona** | Two unrelated citizens; B has a valid account and technical curiosity |
| **Priority / type** | P0 · Security end-to-end |
| **Covers** | USR-SEC-005, SEC-008; USR-TRACK-011; USR-API-007; USR-TRACK-010 |
| **Preconditions** | A has at least one grievance with a title, description, category, location, and photo; B is signed in on a separate browser profile |
| **Test data** | A's generated reference ID; a neighboring sequential ID; B's token; no token |
| **Steps** | 1. As A, submit and record the reference.<br>2. As B, open `/track` and confirm A's record is absent.<br>3. Call `GET /grievances/{A-id}` with B's token.<br>4. Repeat without a token and with a neighboring sequential ID.<br>5. Inspect status and every returned field.<br>6. Verify A's record and photo are unchanged. |
| **Expected result** | B is denied (403/404) and receives no title, description, category, location, photo, or timeline; unauthenticated and sequential-ID probes return no personal data; the UI has no path to another user's record; A's data is unchanged. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Yes — API portion; UI portion manual/browser |
| **Requirements** | NFR-SEC-002; PRD role rules; DEC-030/DEC-044 privacy direction |
| **Notes** | Code observation: non-owner/public requests currently return a 200 public projection including title, status, state, category, priority, departmentId, createdAt, and an empty description. Treat this as the primary privacy finding (G-04/G-05), pending product confirmation. |

### E2E-08 — Lifecycle: assign, progress, resolve, close, and what the citizen can see

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-08 — Staff move a grievance through the lifecycle while the citizen tracks it |
| **Persona** | Citizen A and a staff fixture |
| **Priority / type** | P1 · Integration end-to-end |
| **Covers** | USR-TRACK-003, TRACK-004, TRACK-005, TRACK-012; USR-COMM-005; USR-API-008 |
| **Preconditions** | A has a submitted grievance; staff fixture can assign, add a progress update, resolve with text, and close |
| **Test data** | Assignment to a department/resolver; customer-visible progress update; resolution text; closure reason |
| **Steps** | 1. As staff, assign the grievance; refresh A's tracking page.<br>2. Add an in-progress/customer-visible update; refresh A.<br>3. Resolve with a clear resolution and actions taken; refresh A and open the detail.<br>4. Check the notification inbox.<br>5. Close the record; refresh and reopen after a new sign-in.<br>6. Verify the timeline, status, resolution, and closure outcome. |
| **Expected result** | Status and timeline track each transition; a notification is delivered for the important changes; the citizen can read the resolution/actions and the closure outcome, not just a badge; the record remains retrievable; internal officer notes and priority/department stay hidden. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — staff setup API + citizen UI |
| **Requirements** | PRD FR-GRV-004/005/006/007/010; FR-NOT-001; FR-DAT-001; DEC-050 |
| **Notes** | The citizen modal currently renders a static milestone timeline and no resolution/closure text. Expect a mismatch against FR-GRV-007/010 (G-01/G-02). |

### E2E-09 — Rejection with reason and record retention

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-09 — A grievance is rejected with a reason; the citizen sees the outcome and the record remains |
| **Persona** | Citizen whose complaint is out of scope; staff reviewer |
| **Priority / type** | P1 · Negative end-to-end |
| **Covers** | USR-TRACK-007, TRACK-012; USR-COMM-005; USR-COMM-010 |
| **Preconditions** | A submitted grievance; admin can reject with a reason; notification store available |
| **Test data** | Rejection reason `This issue falls outside the municipal scope; please contact the electricity provider.` |
| **Steps** | 1. As admin, reject the grievance with the reason.<br>2. Refresh A's `/track` and open the record.<br>3. Inspect the badge, timeline, and reason.<br>4. Open the notification.<br>5. Sign out, sign in again, and re-open the record.<br>6. Look for any appeal/reopen/feedback path. |
| **Expected result** | The rejected state is visually distinct from resolved; the citizen can read the rejection reason and any next-step guidance; the record remains and counts toward total only; the notification is delivered; if appeal/reopen is unavailable, that limitation is stated rather than implied. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — staff API setup + UI |
| **Requirements** | PRD FR-GRV-013; FR-GRV-012; FR-DAT-001; DEC-050 |
| **Notes** | Rejection reason rendering and the absent reopen/feedback UI are documented gaps (G-01/G-03). |

### E2E-10 — Notification lifecycle: unread, read, new status, reload

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-10 — A citizen keeps the inbox and badge consistent across events and reloads |
| **Persona** | Citizen with one submission and one later status change |
| **Priority / type** | P1 · Integration end-to-end |
| **Covers** | USR-COMM-001, COMM-002, COMM-003, COMM-005, COMM-006, COMM-008; USR-NAV-010 |
| **Preconditions** | Signed-in citizen; empty inbox; staff can change status; polling allowed |
| **Test data** | One submission; one in-progress update; one resolution |
| **Steps** | 1. Submit a grievance and observe the badge/inbox.<br>2. Open the inbox and mark the submission notification read.<br>3. Trigger a status change as staff; wait for the 30-second poll.<br>4. Verify the new notification and count.<br>5. Click Open and check the destination.<br>6. Mark all read; reload in a new tab; verify zero unread.<br>7. Force a notification fetch failure and restore it. |
| **Expected result** | Badge and inbox agree at every step; read state persists; new events appear without duplicate toasts; Open reaches the relevant grievance or a clearly selected list entry; a fetch failure is visible and recoverable; no other user's notification appears. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — staff setup and polling timing |
| **Requirements** | PRD FR-NOT-001/004/005; PRD UI page requirements |
| **Notes** | Citizen Open currently lands on `/track`, not a specific record (G-27). |

### E2E-11 — Keyboard-only citizen journey

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-11 — A keyboard-only user registers, submits, tracks, and closes a detail |
| **Persona** | Citizen with a motor disability; no pointer device; screen reader optional |
| **Priority / type** | P1 · Accessibility end-to-end |
| **Covers** | USR-ACC-001, ACC-002, ACC-003, ACC-004, ACC-005, ACC-006; USR-NAV-002; USR-GRV-001 |
| **Preconditions** | Keyboard only; signed-out or a pre-created account; captcha available; location search available |
| **Test data** | Valid synthetic account; water complaint; `Shivajinagar, Pune` |
| **Steps** | 1. Tab through login and sign in without a mouse.<br>2. Reach `/submit`, switch mode if needed, and fill all fields.<br>3. Open the location picker, search, select, confirm, and close using the keyboard.<br>4. Submit and reach the confirmation.<br>5. Navigate to `/track`, open the detail with Enter, close with Escape/Close, and verify focus return.<br>6. Sign out using the keyboard. |
| **Expected result** | The complete journey is possible without a pointer; focus is visible and ordered; labels/errors are announced; the map/dialog does not trap or lose focus; Escape and Close both work; no step requires a drag or hover-only control. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | No — manual keyboard/screen-reader pass |
| **Requirements** | PRD UI page requirements; accessibility baseline; DEC-047 |
| **Notes** | The map component is the highest-risk step; if it is pointer-only, record it as an accessibility blocker with a specific workaround. |

### E2E-12 — Mobile, Hindi, location-denied journey

| Field | Value |
|---|---|
| **Journey ID / title** | E2E-12 — A low-bandwidth mobile citizen submits in Hindi without granting location |
| **Persona** | Citizen on a 360 px Android phone, Hindi UI, location permission denied |
| **Priority / type** | P1 · Accessibility/responsive end-to-end |
| **Covers** | USR-NAV-003; USR-ACC-010, ACC-011; USR-GRV-011; USR-TRACK-001; USR-COMM-002 |
| **Preconditions** | 360×800 viewport; Hindi selected; geolocation denied; Cloudinary optional; slow 3G profile |
| **Test data** | Hindi sanitation complaint; landmark `Shivajinagar, Pune`; no photo |
| **Steps** | 1. Open `/` in Hindi at 360 px and open the mobile menu.<br>2. Sign in and open `/submit`.<br>3. Try Use my current location and deny the prompt.<br>4. Search/select the landmark manually and confirm the pin.<br>5. Fill and submit the Hindi complaint.<br>6. Open `/track`, open the detail, and return via the mobile menu.<br>7. Check for horizontal scroll, clipped text, and inaccessible buttons. |
| **Expected result** | The menu and forms fit without horizontal scrolling; Hindi labels and input render; denying location does not block manual search; submission succeeds once; tracking shows the record; touch targets are usable; no clipped primary action. |
| **Actual result** | — |
| **Status** | Not Run |
| **Automation** | Partial — Playwright viewport/geolocation; visual inspection still needed |
| **Requirements** | DEC-047; DEC-050; DEC-026; PRD UI page requirements |
| **Notes** | This combines the project's explicit mobile-overflow fix (DEC-047) with the required manual location fallback. |

---

## 17. Requirements Traceability Matrix

> **Coverage status is about the test suite, not the application.** `Covered`
> means at least one case tests the requirement and its expected result is
> consistent with the current approved design. `Partial` means some behaviour
> is tested but a material part is missing or uncertain. `Gap` means the
> documented requirement has no citizen-facing implementation or no adequate
> observable surface. `Not in user scope` means staff-only or infrastructure
> behaviour that this document deliberately does not test.

### 17.1 Authentication and Account

| Requirement | Summary | Covering cases | Coverage | Notes |
|---|---|---|---|---|
| PRD FR-AUTH-001 | Email/password registration and login | AUTH-001…014, 018; API-001/002; E2E-01 | Covered | Includes validation, duplicate, captcha, OTP, and generic failure. |
| PRD FR-AUTH-002 | Google OAuth 2.0 login | AUTH-021; API-003 (indirect) | Partial | Environment-dependent; no credentials are committed. |
| PRD FR-AUTH-003 | JWT access + refresh tokens | AUTH-010, 017, 018; API-001/003 | Covered | Tokens in localStorage are a documented risk, not a hidden assumption. |
| PRD FR-AUTH-004 | Refresh without re-login | AUTH-017, 018; ERR-005; API-003; E2E-02 | Covered | Invalid-refresh and network-failure branches are distinct. |
| PRD FR-AUTH-005 | RBAC roles USER/RESOLVER/ADMIN/SUPERADMIN | SEC-003, 004; API-006/008 | Covered | Focused on the citizen boundary. |
| PRD FR-AUTH-006 | SUPERADMIN role assignment/revocation | — | Not in user scope | Staff administration; only negative access is checked. |
| DEC-031 | Hardened signup profile, captcha, 18+ | AUTH-001…009; API-001/002 | Covered | |
| DEC-046 | Phone OTP, SMS dry-run, citizen-only OTP | AUTH-002, 013, 014, 023; COMM-009; API-012 (voice auth) | Covered | Real SMS delivery is out of scope. |
| DEC-024 / DEC-025 | Optional face auth and re-enrolment | AUTH-025 | Partial | Functional surfaces only; recognition accuracy is out of scope. |
| Derived | Password reset and account recovery | AUTH-024 | Gap | Only a support `mailto:` link exists; no self-service reset. |
| Derived | Citizen name/address/DOB editing | AUTH-022 | Gap | Profile is display-only for identity fields; documented `/users/me` update is absent. |

### 17.2 Grievance Submission, Lifecycle, and Citizen Detail

| Requirement | Summary | Covering cases | Coverage | Notes |
|---|---|---|---|---|
| PRD FR-GRV-001 | Submit title, description, optional category/attachments | GRV-001…018; API-004/005; E2E-01 | Partial | No citizen category input (automatic classification); one image only; no PDF/DOCX/multiple files. |
| PRD FR-GRV-002 | Unique reference number | GRV-001, 019; TRACK-001; API-004/014 | Covered | Sequential ID; concurrency case included. |
| PRD FR-GRV-003 | Acknowledgement with reference and timestamp | GRV-001; TRACK-001; API-004 | Covered | The success card shows the reference; verify timestamp presence/visibility. |
| PRD FR-GRV-004 | Formal status vocabulary and valid transitions | TRACK-003, 008, 014; ERR-012; API-008 | Partial | PATCH /status accepts arbitrary strings; the strict `/state` path is separate. |
| PRD FR-GRV-005 | Every transition records actor/time/reason | TRACK-004; COMM-005; API-008/010 | Partial | Stored in history/audit; the citizen timeline does not expose transition metadata. |
| PRD FR-GRV-006 | User can view all own grievances and statuses | TRACK-001/006; DASH-001…005; E2E-01 | Partial | Default list limit 50 with no pagination; counts can undercount beyond 50. |
| PRD FR-GRV-007 | User can view the grievance timeline | TRACK-003/004; E2E-08 | Partial | Static milestone visual only; no per-transition timestamps, actors, or reasons. |
| PRD FR-GRV-008 | Admin filterable all-grievance list | DASH-003 (API filters only) | Not in user scope | Staff list is out of scope; citizen list is owner-scoped. |
| PRD FR-GRV-009 | Resolver sees assigned grievances only | — | Not in user scope | Staff workflow. |
| PRD FR-GRV-010 | Detail shows title, description, status, category, severity, priority, AI, assignment, comments, history, attachments | TRACK-002/004; E2E-08 | Partial | Citizen privacy shield intentionally hides category/priority/AI/assignment; but resolution, comments, and actual history are also absent. |
| PRD FR-GRV-011 | Resolver/Admin comments, internal or public | COMM-010 | Gap | No citizen-facing comment/additional-information UI or endpoint found. |
| PRD FR-GRV-012 | User withdraws own grievance with reason | TRACK-008; SEC-006; API-009 | Partial | API works for the owner, but there is no citizen UI and the state rule is broader than documented. |
| PRD FR-GRV-013 | Admin rejects with reason | TRACK-007; E2E-09 | Partial | Reason is stored but not rendered in the citizen detail. |
| PRD FR-GRV-014 | Attachments with type/size validation | GRV-002, 014…018; SEC-012; API-011 | Partial | Only one JPEG/PNG/WebP up to 10 MB; PDF/DOCX claimed in docs are unsupported. |
| DEC-030 / DEC-044 | Hide department/priority/AI on citizen surfaces | TRACK-002; AI-001/010; E2E-08 | Covered | Verify in DOM/API projection, not only screenshots. |
| DEC-050 | Privacy shield; only limited citizen fields; officer updates hidden | TRACK-002/004; E2E-08 | Partial | Resolution/closure text absence conflicts with the citizen's need to see the outcome; due date still renders. |
| DEC-028 | No citizen reference-ID search | NAV-006; TRACK-013 | Covered | Public backend lookup still exists; see privacy gaps. |

### 17.3 AI, Voice, and Quality

| Requirement | Summary | Covering cases | Coverage | Notes |
|---|---|---|---|---|
| PRD FR-AI-001 | Automatic AI analysis on submit | AI-001; API-004 | Covered | Synchronous, not async. |
| PRD FR-AI-002 | Concise AI summary (AI-01) | AI-010 | Gap | No citizen or staff summary feature was found/validated. |
| PRD FR-AI-003 | Category prediction with confidence (AI-02) | AI-001…003, 005; API-004 | Partial | Category/confidence stored; hidden from citizens by design. |
| PRD FR-AI-004 | Named-entity extraction (AI-03) | AI-010 | Gap | Not implemented/validated. |
| PRD FR-AI-005 | Severity LOW/MEDIUM/HIGH/CRITICAL (AI-04) | AI-001/002; API-004 | Gap | Implementation exposes priority/urgency, not this severity model. |
| PRD FR-AI-006 | Priority 1–5 (AI-05) | AI-001; API-004 | Partial | Implementation uses a different priority vocabulary. |
| PRD FR-AI-007 | Persist analysis with module/model version | API-004 | Partial | Model metadata exists in the response; module-ID/version persistence needs verification. |
| PRD FR-AI-008 | AI failure must not block processing | AI-004, 005, 006; GRV-017; E2E-04 | Partial | Text fallback works; image-validation failure can return 500 and block a photo submission. |
| PRD FR-AI-009 / 010 | Admin view/override AI results | — | Not in user scope | Staff UI. |
| DEC-042 | Bound submit-path AI latency | AI-004; API-015 | Partial | Measure provider-on/off latency; do not assert a universal bound. |
| DEC-049 | Quality flag for uncertain text; provider failure fails open | AI-008; E2E-05 | Covered | Clear non-civic rejection is governed separately by DEC-062. |
| DEC-059 | Reject letterless submissions with 400 before provider work | GRV-006; API-005 | Covered | Punctuation/number-only; short textual complaints remain accepted. |
| DEC-062 | Reject clearly non-civic text with 422 before side effects | AI-007/008; E2E-05 | Covered | AI-008 is the false-positive guard; uncertain text remains reviewable. |
| DEC-038 / DEC-040 | Conversational intake, question budget, provider timeouts | VOICE-001…020; AI-009; API-012/013 | Covered | Live STT quality remains experimental. |
| DEC-041 | Manual mode is text-only; voice/manual single-purpose | VOICE-017/018; GRV-001 | Covered | No single-shot dictation. |
| DEC-053 | Subsequent voice recording capture | VOICE-005 | Covered | Re-test on the same tab. |
| DEC-026 | Hindi/Marathi support | ACC-011; VOICE-006/007; E2E-03/12 | Covered | Eight additional packs are bundled but not selectable. |

### 17.4 Tracking, Notifications, and Communication

| Requirement | Summary | Covering cases | Coverage | Notes |
|---|---|---|---|---|
| PRD FR-NOT-001 | Notify user of acknowledgement, status, resolution, closure | COMM-001/005; E2E-08/09 | Partial | In-app only; email absent; SMS dry-run. |
| PRD FR-NOT-002 | Notify resolver/admin of assignment/escalation | — | Not in user scope | Staff workflow. |
| PRD FR-NOT-003 | Notify admin of pending/at-risk/flagged items | — | Not in user scope | Staff workflow. |
| PRD FR-NOT-004 | Notifications stored and retrievable via API | COMM-002/007/008; API-010 | Covered | In-app inbox with 30 s polling. |
| PRD FR-NOT-005 | Mark notifications read/unread | COMM-003/004; API-010 | Covered | Owner-scoped mark-read is tested. |
| PRD FR-RES-007 | Satisfaction feedback after resolution | COMM-010 | Gap | No citizen feedback control or endpoint found. |
| PRD FR-DAT-001 | Grievance retained after closure | TRACK-012; E2E-08/09; API-016 | Covered | No physical delete path is exposed. |
| PRD FR-DAT-002 | Status history immutable | API-008/010 | Partial | Append-only repository intent; no citizen-visible proof. |
| Derived | Notification deep link to a specific grievance | COMM-006; TRACK-013 | Gap | Citizen Open goes to `/track`; detail is modal state only. |
| Derived | Additional information/supplementary documents | COMM-010 | Gap | No UI/endpoint. |
| Derived | Reopen/appeal after rejection/closure | COMM-010; TRACK-008; API-009 | Partial | API-only reopen from resolved; no UI, no rejected-appeal path. |

### 17.5 Security, Data, and Non-Functional Requirements

| Requirement | Summary | Covering cases | Coverage | Notes |
|---|---|---|---|---|
| NFR-SEC-001 | Secrets in environment, none in source | SEC-010; API-002/003 (error leakage) | Partial | Config drift tests exist; CORS default wildcard is a separate concern. |
| NFR-SEC-002 | Server-side RBAC on protected endpoints | SEC-001…007; API-006/007/008 | Covered | Includes cross-user read/write attempts. |
| NFR-SEC-003 | bcrypt password hashing | API-001 | Covered | Verify the stored hash is not returned; cost factor is a config review item. |
| NFR-SEC-004 | JWT expiry and refresh | AUTH-017/018; SEC-002; API-003 | Covered | Client logout does not revoke refresh tokens. |
| NFR-SEC-005 | Significant actions audited | API-008/010 | Partial | Audit exists backend-side; citizen-visible history is limited. |
| NFR-PERF-001 | Submit < 500 ms excluding AI | API-015; ERR-006 | Partial | Classification is synchronous, so the stated exclusion does not match the implementation; measure and report. |
| NFR-PERF-002 | List within 2 s for up to 1,000 | API-015; TRACK-015 | Partial | The citizen UI fetches at most 50 and has no pagination. |
| NFR-TEST-001/002 | State-machine and auth integration tests | Existing `tests/` suite (see §19) | Covered elsewhere | Not duplicated here; this suite adds user-facing scenarios. |
| PRD UI page requirements | Landing, register, login, submit, track, notifications, profile | NAV-001/002; AUTH; GRV; TRACK; COMM; ACC | Covered | Page-by-page journeys are present. |
| PRD error/edge cases | Invalid input, auth, network, AI failure, duplicate submission | GRV; AI; ERR; SEC | Covered | Several expected results intentionally expose known gaps. |
| Accessibility baseline | Labels, keyboard, focus, announcements, contrast, zoom, touch | ACC-001…012; E2E-11 | Partial | No approved accessibility requirement/standard was found; cases use WCAG AA as a reasonable baseline. |
| DEC-047 | Mobile usability for complaint submission | NAV-003; ACC-010; E2E-12 | Covered | Re-verify after UI changes. |
| DEC-050 | Auth hardening, privacy shield, map UX, session restore | AUTH-016/017; TRACK-002/004; GRV-010/012; ACC-009 | Covered | Except the citizen outcome content gap above. |
| DEC-014 | Reference-ID allocation | API-004/014 | Covered | Sequential IDs are also the privacy concern in G-04. |

### 17.6 Traceability Summary

| Coverage status | Requirement rows |
|---|---:|
| Covered | 29 |
| Partial | 25 |
| Gap | 9 |
| Not in user scope | 6 |
| Covered elsewhere | 1 |
| **Total mapped rows** | **70** |

> Counts are of requirement rows in this matrix, not test cases. Update this
> table if rows are added; the detailed status remains authoritative.

---

## 18. Testing Gaps, Risks, and Recommendations

> **Evidence basis:** the findings below come from static inspection of the
> repository (routers, repositories, frontend pages/components, and existing
> tests) on 2026-10-21. They are **not** executed test results. Confirm each
> finding in the stated environment before filing it as a defect.

### 18.1 Gap and Risk Register

| ID | Severity | Area | Expected / documented | Observed in the repository | User impact | Recommendation | Cases |
|---|---|---|---|---|---|---|---|
| G-01 | High | Resolution transparency | Citizen can view the grievance timeline and understand the outcome (FR-GRV-007/010; PRD detail page) | The citizen modal renders status, a static milestone timeline, title, description, location, submitted photo, and due date. It does not render resolution text, actions taken, closure reason, rejection reason, officer updates, or completion photos. | A citizen cannot tell what was actually done or why the case was closed/rejected. This undermines the core accountability promise. | Add a citizen-safe outcome section: resolution summary/actions, closure or rejection reason, and relevant dates. Keep internal notes and officer identities out. Add it to E2E-08/E2E-09. | TRACK-004, TRACK-007, E2E-08, E2E-09 |
| G-02 | High | Lifecycle timeline | Every transition is recorded and the citizen can view the timeline (FR-GRV-005/007; FR-AUD-001) | History is stored, but citizen mode does not fetch it. The timeline is a five-milestone visual derived only from the current status; timestamps, actors, and reasons are absent. Reopened/withdrawn records fall back to the first milestone. | The “timeline” can imply progress that did not happen and cannot answer “when did this change?”. | Fetch the history endpoint in citizen mode, filter to customer-visible entries, show real timestamps and reasons, and define milestone mapping for every canonical state. | TRACK-003, TRACK-004, TRACK-008 |
| G-03 | High | Citizen response channels | Comments/public updates (FR-GRV-011), supplementary information, reopen/appeal, satisfaction feedback (FR-RES-007) | No citizen UI or endpoint was found for comments, replies, additional documents, reopening a rejected/closed case, appeals, or satisfaction feedback. Reopen exists only as an API from RESOLVED, with no UI. | The citizen cannot answer a request for more information or contest an outcome, which makes the process one-way. | Implement a minimal “add information + reopen/appeal + feedback” path, or explicitly state that these are unavailable and provide a working human contact route. | COMM-010, TRACK-013, API-009 |
| G-04 | Critical | Unauthenticated privacy | No personal grievance data without authentication; DEC-028 removed public reference lookup from citizen surfaces | `GET /grievances/{id}` accepts no token and returns a “public tracking” projection with title, status, state, category, priority, departmentId, createdAt, and an empty description. Reference IDs are sequential (`GRV-YYYY-NNNN`). | Anyone who guesses or increments an ID can enumerate complaint titles and classifications. This is a serious privacy exposure even though the UI no longer offers search. | Require authentication and ownership for detail, or deliberately expose only an opaque, unguessable status token with no title/classification. Rate-limit and monitor enumeration. | TRACK-011, API-007, SEC-001 |
| G-05 | Critical | Cross-user read | A signed-in citizen must be denied another citizen's record (NFR-SEC-002) | A non-owner authenticated request receives HTTP 200 with the same public projection rather than 403/404. | One citizen can read limited but sensitive metadata about another's complaint by changing the ID. | Return 403/404 for non-owners; do not treat “public projection” as an authorization substitute. Add an automated cross-user test. | TRACK-011, API-007, SEC-005 |
| G-06 | High | Status integrity | Formal status vocabulary and server-enforced transitions (FR-GRV-004; FR-WKF-001) | `PATCH /grievances/{id}/status` validates only that the value is nonblank, not that it is a canonical status or a permitted transition. A separate `/state` endpoint calls the state machine. | Unknown states can reach the citizen badge/timeline and bypass workflow rules; reports and counts become unreliable. | Validate against the canonical vocabulary and the transition table in one path; deprecate the loose PATCH or make it delegate to the state machine. | API-008, TRACK-014, ERR-012 |
| G-07 | Medium | Withdraw rules | Withdraw only in states allowed by the approved lifecycle (FR-GRV-012) | Owner withdraw is allowed for any nonterminal state, which is broader than the documented transition table. | A case can be withdrawn after work has started, potentially losing accountability for effort already spent. | Restrict withdraw to the approved states and record the reason; decide whether staff must approve a late withdrawal. | API-009, TRACK-008 |
| G-08 | High | Idempotency / duplicates | A retry after a lost response must not create a duplicate grievance (FR-GRV-002; error/edge cases) | No idempotency key, content dedupe, or “find my recent submission” flow was found. The client lock only prevents double clicks in one tab. | A flaky connection can create two references for one complaint, confusing the citizen and doubling staff workload. | Accept an `Idempotency-Key`, persist the key/result, and return the original reference on retry; consider a short content-hash window. | ERR-007, GRV-019, GRV-020, API-014 |
| G-09 | High | Request timeouts | A hung backend must fail with a bounded, recoverable message | Ordinary API calls (`requestJson` for submit/list/detail) have no explicit timeout; only voice calls have a budget. | The UI can spin indefinitely, and the citizen cannot tell whether the grievance was created. | Add AbortController timeouts, a visible retry action, and idempotent submit recovery. | ERR-006, NAV-007 |
| G-10 | High | AI non-blocking rule | AI failure must not block grievance processing (FR-AI-008) | During submit, a valid uploaded image is re-checked by the image LLM. If that call raises, the endpoint returns HTTP 500 “LLM image validation failed” before creating the grievance. | An optional photo can turn a text complaint into a total failure during an external AI outage. | Fail open on the optional image check: store the record, mark the image unassessed for staff, or allow the citizen to remove the photo and continue. Never return 500 solely because optional evidence validation failed. | AI-006, GRV-017, E2E-04 |
| G-11 | High | Error vs empty state | A failed list request must not look like “no grievances” | The track page catches list errors and sets the list to an empty array, which renders the empty state and zero counts. | A citizen may believe their complaints disappeared or were never filed. | Add an explicit error state with Retry, keep the last known data where possible, and never derive zero counts from a failed request. | NAV-009, ERR-002, DASH-001 |
| G-12 | High | List limit | The citizen can reach all own grievances, or is clearly told the list is limited (FR-GRV-006; NFR-PERF-002) | The UI requests the default limit of 50 and has no pagination/load-more/offset control. Counts are derived from that same limited fetch. | The 51st and later grievances are invisible; dashboard totals undercount. | Add pagination or load-more, expose “showing X of Y”, and compute counts from a server aggregate. | TRACK-015, DASH-001, DASH-006 |
| G-13 | Medium | Search/filter/sort | The task and PRD dashboard expectations include finding grievances; the UI should support a reasonable lookup | No citizen search, status filter, sort control, or text-query API parameter was found. The API supports only `state`, `dept`, and `limit`; the UI exposes none of them. | With more than a screenful of records, finding a specific reference is manual scrolling. | Add search by reference/title, status filter, and a stable sort; or document the limitation and provide a practical navigation aid. | DASH-003, DASH-006 |
| G-14 | Medium | Profile editing and API drift | Docs/API list a citizen profile update; the registration UI requires a phone | No `/users/me` update endpoint or edit UI for name/address/DOB was found. The API makes phone optional while the live UI requires it. | Citizens cannot correct their own identity/contact data; testers and integrators see conflicting contracts. | Implement a constrained profile-update endpoint (name/address/DOB) with audit, or remove the documented endpoint. Align the phone requirement across UI/API. | AUTH-004, AUTH-022, API-002 |
| G-15 | Medium | Password recovery | A user who forgets a password needs a clear recovery path | No password-reset flow was found. The login page offers a `mailto:` support link using the older `support@grievai.gov.in` address. | Locked-out citizens depend on an unverified human mailbox; the stale brand undermines trust. | Implement a token-based reset flow, or update the support address and document the manual recovery procedure and expected response time. | AUTH-024 |
| G-16 | High | Logout/revocation | Logout should invalidate the session, and a stolen refresh token should be revocable (NFR-SEC-004) | Logout clears client storage only. Refresh tokens remain valid until expiry; no server-side revocation/denylist endpoint was found. | A copied refresh token still works after the citizen signs out, especially on a shared device. | Add refresh-token rotation with reuse detection and a logout/revoke endpoint; shorten refresh lifetime for sensitive roles. | AUTH-015, AUTH-018, API-003 |
| G-17 | Medium | Token storage | Session credentials should be resistant to script exfiltration | Access and refresh tokens are stored in `localStorage`. | Any XSS that gets past React escaping can steal a long-lived session. | Consider HttpOnly/Secure/SameSite cookies with CSRF protection. If localStorage is retained for the prototype, document the risk and enforce a strict CSP. | AUTH-015, SEC-010 |
| G-18 | Medium | OAuth callback | Tokens should not be exposed in URLs/history | The Google callback passes tokens to the frontend in the query string, according to the inspected auth flow. | Tokens can leak via history, Referer, logs, or shoulder-surfing. | Exchange a short-lived one-time code server-side and set the session without putting tokens in the URL; scrub the callback URL. | AUTH-021, SEC-010 |
| G-19 | High | Evidence privacy | Attachments should be accessible only to authorized users (docs/SECURITY.md) | Photos are uploaded unsigned to Cloudinary; the resulting `secure_url` is public-by-URL unless the cloud is configured otherwise. | Anyone with the URL can view a citizen's evidence; EXIF may reveal location beyond the selected pin. | Use signed uploads/downloads or an authenticated proxy; strip EXIF; define a retention/deletion policy. | SEC-011, GRV-002 |
| G-20 | High | Image-fetch/SSRF surface | Upload/validation should be authenticated and bounded | `POST /validate-image` is public and fetches a caller-supplied URL. The existing test suite documents the SSRF concern. | An attacker could probe internal services or cause resource exhaustion through the server's fetch. | Require auth, allowlist image hosts/schemes, block private/link-local addresses, bound size/time, and prefer signed Cloudinary references. | SEC-012, API-011 |
| G-21 | High | Draft loss | A long complaint should not be silently lost on refresh/navigation | No autosave, beforeunload warning, or draft restoration was found for the grievance form or voice conversation. | A mis-tap, refresh, or expired session can erase several minutes of input and cause abandonment. | Autosave to sessionStorage with explicit clear-after-submit and a restore prompt; add a beforeunload guard; preserve through re-login where safe. | GRV-020, ERR-010, ERR-011, NAV-004 |
| G-22 | Medium | STT validation | Hindi/Marathi voice support should be validated before claiming accuracy | Live STT quality for Hindi, Marathi, code-switching, and noisy conditions has not been evaluated; recognition is marked EXPERIMENTAL. | Poor transcripts may be accepted by citizens who trust the assistant, putting wrong facts into the record. | Build a small consented/native-speaker evaluation set, measure WER/CER by language and noise level, and keep the experimental label until thresholds are met. | VOICE-006, VOICE-007, VOICE-009, E2E-03 |
| G-23 | Medium | Documentation drift | PRD, API, AI, security, and architecture docs should describe the shipped system | Older documents still claim async AI, AI modules that are not implemented, PDF/DOCX/multiple attachments, a profile-update API, 15-minute tokens, and NextAuth/PostgreSQL. | Testers and reviewers can encode the wrong expectations; demos can overclaim. | Update `docs/AI_SYSTEM.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, and mark PRD rows with implemented/planned status. Add a docs-drift check to CI where practical. | AI-010, GRV-014, AUTH-022, API-003, SEC-014 |
| G-24 | Medium | Status presentation | Every canonical status has a readable label and a correct timeline position | `withdrawn` and `reopened` are missing from the status-label map; the badge falls back to the raw lowercase string. The timeline maps both to the first milestone. | A withdrawn/reopened case looks like a new submission or an unstyled raw value, confusing the citizen. | Add labels/tones for every state and define the timeline index explicitly; cover with a table-driven component test. | TRACK-008, TRACK-014 |
| G-25 | Medium | Attachment scope | PRD says attachments; security docs list PDF/JPG/PNG/DOCX | Only one JPEG/PNG/WebP image up to 10 MB is accepted. PDF/DOCX/multiple files are not supported. | Citizens cannot attach a document/receipt or multiple photos, despite documented expectations. | Either implement the documented formats/multiple files with server-side validation, or correct the PRD/security docs and the UI copy. | GRV-014, GRV-015, SEC-012 |
| G-26 | Medium | Delivery channels | Notifications reach the citizen for acknowledgement/status/resolution/closure (FR-NOT-001) | Only in-app notifications exist. SMS is a dry-run provider; email notifications are absent. | A citizen who does not return to the app misses the outcome; the product cannot truthfully claim SMS/email delivery. | Add email (and real SMS when approved), with consent, templates, retries, and delivery status; keep dry-run clearly labelled in demos. | COMM-009, API-010 |
| G-27 | Low | Notification navigation | A notification should open the relevant grievance | The citizen “Open” link goes to `/track`; there is no `/grievances/{id}` route, and the detail is modal state that is lost on refresh. | The citizen must find the record manually; shared/bookmarked detail links are impossible. | Add an authenticated detail route and link notifications to it; preserve the modal as a quick view. | COMM-006, TRACK-013 |
| G-28 | Medium | SLA privacy | DEC-050’s preserved citizen fields are status, lifecycle, title, description, date, address, and pin | The citizen detail still renders `dueDate` when present, which is an internal SLA deadline not listed in that decision. | The citizen may see an internal commitment that was not meant for display, causing confusion if it passes. | Hide the due date from citizen mode or explicitly approve and explain it; update DEC-050 to match. | TRACK-002 |
| G-29 | High | CORS configuration | Only the deployed frontend origin should be allowed when credentials are enabled (docs/SECURITY.md) | `CORS_ORIGINS` defaults to `*`, and the app enables credentials. If a deployment does not override it, credentialed cross-origin reads may be allowed. | An unrelated site could call authenticated APIs from a victim's browser. | Fail closed: require an explicit origin list in non-local environments, never combine `*` with credentials, and add a startup/CI assertion. | SEC-014, API-003 |
| G-30 | Medium | Public history | Grievance history should be owner/staff-only, or intentionally public with no internal data | `GET /grievances/{id}/history` accepts no token and returns customer-visible updates for a known ID. Internal notes are filtered, but the customer timeline is public. | Anyone with an ID can read status updates and public messages for another complaint. | Require authentication/ownership for history, or explicitly document a public-status design and rate-limit it. | API-010, SEC-001 |

### 18.2 Documentation Versus Implementation

| Topic | Documentation claim | Implementation reality | Action |
|---|---|---|---|
| Public tracking | PRD/older workflow text implies reference-ID lookup | DEC-028 removed citizen search; `/track` is sign-in-only. Backend public lookup still exists. | Treat DEC-028 as current; fix older docs. Resolve G-04/G-05. |
| Citizen detail contents | FR-GRV-010 lists category, severity, priority, AI analysis, assignment, comments, history, attachments | Privacy shield hides routing/AI; comments and resolution are absent; timeline is static. | Update FR-GRV-010 to distinguish staff vs citizen fields; implement outcome/history or mark planned. |
| Category input | FR-GRV-001 says category is optional on submission | No citizen category field; classification is automatic. | Document the product decision; update the PRD row. |
| Attachments | PRD says attachments; security doc lists PDF/JPG/PNG/DOCX | One image, JPEG/PNG/WebP, 10 MB; no PDF/DOCX. | Implement or correct docs (G-25). |
| AI execution | Async and non-blocking | Classification is synchronous; image-validation failure can block a photo submission. | Fix G-10; correct the async claim or make AI truly async. |
| AI modules | AI-01…AI-11 listed | Only classification/priority/quality flag are implemented; no summary/entities/severity/assignment/resolution quality. | Mark planned/partial in `docs/AI_SYSTEM.md`; do not demo absent modules. |
| Profile API | `docs/API.md` lists `/users/me` update | No citizen profile-update endpoint/UI. | Implement or remove from API docs (G-14). |
| Password reset | Common auth expectation | `mailto:` support link only, old brand address. | Implement or document manual recovery (G-15). |
| Token lifetime | Security doc recommends 15 minutes | Default access lifetime is 60 minutes. | Align config and docs; record the deployed value. |
| Architecture | Older docs mention NextAuth/PostgreSQL | JWT + MongoDB are the serving stack (DEC-010/011/017). | Update `docs/ARCHITECTURE.md`; keep historical decisions in memory. |
| Status vocabulary | Docs use mixed case/friendly names | Canonical states are uppercase; frontend map omits withdrawn/reopened. | Align labels and docs (G-24). |
| Phone requirement | API phone is optional | Live registration UI requires phone. | Document the UI requirement or relax it (G-14). |
| Test coverage claim | “Tests exist” can be read as end-to-end coverage | Extensive backend/unit/contract tests exist, but no **automated** browser E2E or accessibility suite covers these journeys. | Use §19 to distinguish automated layers; do not claim these cases passed. |

### 18.3 Testing Limitations of This Document

1. **Nothing here has been executed.** There are no Pass/Fail results, timings,
   screenshots, or defect IDs yet.
2. No real Google OAuth, Sarvam, Groq, Cloudinary, SMS, or email credentials
   were used. Environment-dependent cases are `Partial`/`Blocked` candidates.
3. No native-speaker review or WER/CER measurement was performed for Hindi or
   Marathi STT.
4. No face-recognition accuracy, liveness, bias, or spoof-resistance evaluation
   was performed.
5. No load, stress, soak, penetration, or destructive security testing was
   performed. The SSRF/upload cases are bounded observational checks.
6. No multi-browser matrix was executed. Chromium is the assumed baseline;
   Firefox/WebKit and real mobile browsers remain gaps.
7. No screen-reader matrix was executed (NVDA/VoiceOver/TalkBack). E2E-11 is a
   manual script, not evidence.
8. No production data migration, backup/restore, disaster recovery, or data
   retention job was tested.
9. No AI fairness/bias evaluation across gender, caste, religion, disability,
   language, or region was performed. This is a significant research-ethics gap
   for a grievance system.
10. No timezone/DST or locale date-format matrix was tested beyond basic
    language switching.
11. No concurrent multi-user workflow was tested; API-014 covers ID allocation,
    not realistic staff/citizen contention.
12. The audit log's tamper-resistance and retention were not tested.
13. The deterministic civic-scope gate's false-positive/false-negative rates
    have not been measured on real multilingual complaints. USR-AI-008 is a
    guard, not validation of the gate.

### 18.4 Prioritized Recommendations

| Priority | Recommendation | Addresses | Acceptance evidence |
|---|---|---|---|
| 1 | Close the cross-user/public read exposure before any pilot | G-04, G-05, G-30 | Automated tests prove 403/404 for non-owner/public detail and history; no title/category leaks. |
| 2 | Show the citizen the resolution/closure/rejection outcome and a real timeline | G-01, G-02, G-24 | E2E-08/E2E-09 pass with visible outcome text and timestamps. |
| 3 | Make submission retry-safe | G-08, G-09 | A dropped response + retry yields exactly one record; a hung request times out with a recoverable message. |
| 4 | Make optional AI/photo failures non-blocking | G-10 | Text and photo submissions succeed during forced image-LLM failure, with staff-visible unassessed flags. |
| 5 | Distinguish errors from empty data and lift the 50-record ceiling | G-11, G-12 | Forced list failure shows Retry; 51+ records are reachable and counts are correct. |
| 6 | Add a citizen response channel and either implement or clearly document reopen/feedback | G-03, G-25 | Citizen can add information; unavailable actions have explicit guidance. |
| 7 | Harden session and configuration | G-16, G-17, G-18, G-29 | Logout/revocation works; no tokens in URLs; CORS fails closed. |
| 8 | Protect evidence and bound image fetching | G-19, G-20 | Unauthenticated image access is denied or risk-accepted; validation rejects private/internal URLs. |
| 9 | Add draft protection | G-21 | Refresh/re-login restores or warns; no silent loss. |
| 10 | Add search/filter/pagination and notification deep links | G-12, G-13, G-27 | A 51st record and a specific reference are reachable in two interactions. |
| 11 | Run an accessibility audit and fix focus/label/map issues | ACC-003/004/006; E2E-11 | Keyboard-only + one screen reader can complete the journey. |
| 12 | Correct documentation and add doc-drift checks | G-23, G-25 | Docs match deployed behaviour; CI flags contradictions. |
| 13 | Validate multilingual STT before claiming support | G-22 | Per-language WER/CER report with a native-speaker review. |
| 14 | Add real delivery channels or label them as prototype-only | G-26 | Delivery status and consent are observable; demos do not claim real SMS/email. |
| 15 | Measure civic-scope gate false positives/negatives on a labeled multilingual sample | DEC-062; AI-007/008 | Gate report with accepted/rejected rates and reviewed borderline cases. |

**Release gate suggestion:** do not call the citizen experience
`VALIDATED` until recommendations 1–5 have passing evidence. The current
suite can be executed without those fixes, but several P0/P1 cases are
expected to fail and should be recorded as such rather than waived.

---

## 19. Automation Recommendations

### 19.1 Strategy

Use a three-layer split:

1. **Backend/API integration (`pytest`)** — fastest, most stable, and already
   the project's strongest layer. Own authorization, validation, persistence,
   idempotency, state rules, and response contracts.
2. **Browser end-to-end (Playwright)** — own the citizen journey, session
   handling, form/location interaction, error rendering, notifications, and
   privacy of rendered fields. Prefer a small, high-value suite over
   duplicating every API assertion.
3. **Manual/assistive** — own real microphone/STT quality, screen readers,
   visual contrast, mobile devices, real OTP/Google, and face liveness.
   Automation can prepare state and catch regressions, but cannot certify
   these.

**Measured automation candidates in this suite:** 55 `Yes`, 91 `Partial`, 24
`No` across 170 module cases. The 12 E2E journeys split 2 `Yes`, 8 `Partial`,
and 2 `No` (real multilingual voice and keyboard/screen-reader).

### 19.2 Existing Infrastructure to Reuse

This table describes what the existing files target; it is **not** evidence
that they currently pass. This documentation task did not run them.

| Existing asset | What it already covers | Reuse for |
|---|---|---|
| `tests/test_auth.py` | Register/login/me/refresh and auth failures | AUTH-001…020, API-001/003 |
| `tests/test_signup_fields_captcha.py` | Signup profile/captcha rules | AUTH-004…009, API-002 |
| `tests/test_phone_sms.py` | Phone OTP, consent, dry-run | AUTH-002/023, COMM-009 |
| `tests/test_rbac_workflow.py` | Role gates and workflow transitions | SEC-004/005, API-008 |
| `tests/test_endpoints.py` | HTTP shapes, limits, Unicode/injection round-trips | GRV-008/009, API-004/006 |
| `tests/test_classification.py`, `test_classification_cascade.py` | Classifier rules and provider fallback | AI-001…005 |
| `tests/test_quality_check.py` | Quality/suspicious flag and fail-open behaviour | AI-008 |
| `tests/test_civic_relevance.py` | Letterless input and clear non-civic prefilter, no-side-effect assertions | GRV-006, AI-007, E2E-05 |
| `tests/test_image_validation.py` | Image validation and URL-fetch risks | GRV-016/017, SEC-012, API-011 |
| `tests/test_id_allocation.py` | Reference allocation | GRV-001, API-014 |
| `tests/test_repository.py` | Storage/repository behaviour | API-004/016 |
| `tests/test_status_vocabularies.py` | Status vocabulary consistency | TRACK-003/008/014 |
| `tests/test_transcription*.py`, `test_audio_validation.py`, `test_voice_intake.py`, `test_voice_e2e.py` | Voice API, limits, audio, intake | VOICE-011…016, API-012/013 |
| `tests/test_security_baseline.py`, `test_config_drift.py` | Security/config drift | SEC-009/014, API-003 |
| `frontend/scripts/voice-*.test.mjs` | Voice reducer, capture, UI, speech, API | VOICE-004/005/013/017…020 |
| `frontend/scripts/e2e.mjs`, `check-contract.mjs` | Backend/frontend contract smoke | API contracts, CI smoke |
| `tests/conftest.py`, `_signup_helpers.py` | App/client/captcha fixtures | New API cases |

There is **no Playwright/browser E2E suite and no automated accessibility
suite** in the repository. That is the main new investment.

### 19.3 Recommended New Suites

| Suite | Tool | Cases | Why |
|---|---|---|---|
| `tests/test_user_side_api.py` | pytest | AUTH-019…020, GRV-019/020, TRACK-011/015, ERR-007/009, SEC-001…007, API-004…016 | Contract and authorization regressions; fastest CI signal |
| `e2e/tests/smoke.spec.ts` | Playwright | E2E-01, AUTH-010, GRV-001, TRACK-001 | Release gate; runs on every PR |
| `e2e/tests/auth.spec.ts` | Playwright | AUTH-001…020, E2E-02 | Session, refresh, gating, safe redirect |
| `e2e/tests/submit.spec.ts` | Playwright | GRV-001…020 | Validation, location, photo, retry, double-click |
| `e2e/tests/track-privacy.spec.ts` | Playwright | TRACK-001…015, E2E-07/08/09 | List/detail, status, cross-user privacy, limit |
| `e2e/tests/notifications.spec.ts` | Playwright | COMM-001…010, E2E-10 | Badge/read/poll/isolation |
| `e2e/tests/resilience.spec.ts` | Playwright + route interception | NAV-009, ERR-001…012, AI-004/006 | Offline/500/timeout/lost-response paths |
| `e2e/tests/accessibility.spec.ts` | Playwright + axe | ACC-001…010 (partial) | Catch labels/roles/contrast regressions; not a substitute for manual |
| `e2e/tests/mobile.spec.ts` | Playwright devices | NAV-003, ACC-010, E2E-12 | 360 px overflow/tap targets |
| `e2e/tests/voice-ui.spec.ts` | Playwright with fake media | VOICE-001…019 (UI states, mocked STT) | State machine, review, errors; not real accuracy |

### 19.4 Suggested Automation Order

1. **P0 API security and integrity** — cross-user read/write, ID allocation,
   submit ownership, refresh/token misuse, duplicate/lost response.
2. **Smoke E2E** — register → submit → track → sign out → sign in (E2E-01).
3. **Submission E2E** — validation, location fallback, photo failure, retry,
   double-click.
4. **Tracking/notification E2E** — status refresh, notifications, 50+ limit.
5. **Resilience E2E** — 500/offline/timeout/malformed responses.
6. **Accessibility scan** — axe plus manual keyboard checklist.
7. **Voice UI** — state machine and error mapping with mocked STT.
8. **Manual-only matrix** — real STT, OTP, Google, face, screen reader.

### 19.5 Testability Requirements

To make the P0/P1 cases automatable without weakening security:

- **Captcha test seam:** a server-side, non-production flag that accepts a
  signed test challenge; never disable captcha globally.
- **OTP test seam:** read the dry-run debug code only when
  `OTP_DEBUG_RETURN_CODE=true` and the environment is local/test; production
  must fail closed.
- **Deterministic fixtures:** seed accounts and staff transitions through an
  admin-only test endpoint or direct repository fixture, not UI clicking.
- **Stable selectors:** add `data-testid` to the submit button, mode toggle,
  location search/confirm, photo status, notification badge, and detail dialog.
- **Controllable external services:** inject fake Sarvam/Cloudinary/LLM
  adapters or route interception; never depend on live quotas in CI.
- **Time control:** short access-token TTL or a clock seam for expiry tests.
- **Cleanup:** delete synthetic grievances/accounts after each run; do not
  let test data pollute counts. Prefer a dedicated test database.
- **No fixed sleeps:** poll for visible state or use response waits; the
  notification poll is 30 seconds, so tests should trigger a reload or use a
  shorter test interval rather than sleeping 30 seconds.

### 19.6 CI and Manual Cadence

| Stage | What runs | Gate |
|---|---|---|
| Pull request | Existing pytest + new API tests + contract smoke + Playwright smoke (E2E-01) | Block on P0 failures |
| Nightly | Full Playwright with mocked externals + axe scan + IDOR/security cases | Report; block release on new P0/P1 |
| Release candidate | E2E-08/09/10 lifecycle, performance spot check (API-015), manual accessibility pass | Sign-off required |
| Manual-only | Real microphone/STT per language, real OTP/Google, face liveness, physical mobile, screen reader | Record evidence; do not claim automated coverage |

### 19.7 What Not to Automate (or Not Claim)

- Real captcha solving or disabling captcha in production.
- Real OTP/SMS/Google/Cloudinary delivery in CI.
- Judging Hindi/Marathi transcription accuracy or AI classification quality.
- Face liveness/recognition accuracy.
- Final visual/contrast judgement; axe only finds candidates.
- Legal/privacy risk acceptance; the cross-user exposure needs a product
  decision, not a green test.

### 19.8 Indicative Effort

| Work item | Estimate |
|---|---|
| New API/security pytest suite | 3–5 person-days |
| Playwright harness + fixtures + P0 smoke/auth/submit | 5–8 person-days |
| Tracking/notifications/resilience suites | 3–5 person-days |
| Accessibility/mobile automation | 2–3 person-days |
| Voice UI automation with mocks | 2–3 person-days |
| Manual accessibility + multilingual/STT review | 3–5 person-days |
| **First-pass total** | **~18–29 person-days** |

These are planning estimates, not commitments. Existing pytest assets reduce
the backend effort; the browser harness is the largest new cost.

---

## 20. Execution Record

### 20.1 Current Status

**No case in this document has been executed.** The table below is the initial
record and must be updated after a real run.

| Module | Cases | Executed | Pass | Fail | Blocked | Not Run | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| USR-AUTH | 25 | 0 | 0 | 0 | 0 | 25 | Awaiting environment and synthetic accounts |
| USR-NAV | 10 | 0 | 0 | 0 | 0 | 10 | |
| USR-ACC | 12 | 0 | 0 | 0 | 0 | 12 | Manual keyboard/screen-reader needed |
| USR-GRV | 20 | 0 | 0 | 0 | 0 | 20 | Cloudinary/geocoder availability to record |
| USR-AI | 10 | 0 | 0 | 0 | 0 | 10 | Provider-on/off runs needed |
| USR-VOICE | 20 | 0 | 0 | 0 | 0 | 20 | Microphone/Sarvam or mocks |
| USR-TRACK | 15 | 0 | 0 | 0 | 0 | 15 | Staff fixture needed for transitions |
| USR-COMM | 10 | 0 | 0 | 0 | 0 | 10 | SMS dry-run only |
| USR-DASH | 6 | 0 | 0 | 0 | 0 | 6 | |
| USR-ERR | 12 | 0 | 0 | 0 | 0 | 12 | Failure injection needed |
| USR-SEC | 14 | 0 | 0 | 0 | 0 | 14 | Isolated environment only |
| USR-API | 16 | 0 | 0 | 0 | 0 | 16 | pytest harness preferred |
| **Module total** | **170** | **0** | **0** | **0** | **0** | **170** | |
| E2E journeys | 12 | 0 | 0 | 0 | 0 | 12 | Release-gate journeys |
| **Grand total** | **182** | **0** | **0** | **0** | **0** | **182** | |

### 20.2 Planned Priority Split

| Scope | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Module cases | 33 | 75 | 59 | 3 | 170 |
| E2E journeys | 4 | 7 | 1 | 0 | 12 |
| **Total** | **37** | **82** | **60** | **3** | **182** |

### 20.3 Run Log Template

Copy this block for each execution round:

```text
Run ID:
Date/time:
Tester:
Commit / build:
Frontend URL:
Backend URL:
Database mode (Mongo / in-memory):
Feature flags:
  NEXT_PUBLIC_USE_MOCKS=
  TRANSCRIPTION_ENABLED=
  FACE_AUTH_ENABLED=
  OTP_DEBUG_RETURN_CODE=
External services available (yes/no + notes):
  Google OAuth:
  Cloudinary:
  Sarvam:
  Groq/HF:
  SMS provider:
Cases executed:
  Pass:
  Fail:
  Blocked:
Defects filed (IDs):
Evidence location:
Deviations from this plan:
Next run focus:
```

### 20.4 Sign-off

| Role | Name | Date | Signature/decision |
|---|---|---|---|
| Test author | AI documentation agent | 2026-10-21 | Initial suite created; unexecuted |
| Technical reviewer |  |  |  |
| Product owner |  |  |  |
| Accessibility reviewer |  |  |  |
| Security reviewer |  |  |  |

> A task is not `TESTED` or `VALIDATED` until this record contains real
> Pass/Fail/Blocked results with evidence. The status of the underlying
> features remains whatever `memory/CURRENT_STATE.md` records, not what this
> plan hopes to prove.

---

## Document Control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-21 | Initial test plan, 170 module cases, 12 E2E journeys, RTM, gap register, and automation plan |
| 1.1 | 2026-10-21 | Aligned validation and quality cases with DEC-059/062; RTM now 70 rows |
