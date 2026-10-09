# CHANGELOG.md — Implementation Change Log

> Track meaningful implementation changes only.
> Do not record formatting changes unless they affect project understanding.
> Format: most recent date first within a date block.

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
