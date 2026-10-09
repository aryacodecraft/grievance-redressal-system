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
*(DEFERRED — owner explicitly requested to leave for future)*
- [ ] **Camera Capture & Liveness Detection**
  - WebRTC / HTML5 camera capture in frontend modal for biometric enrollment and verification.
  - Anti-spoofing / liveness check (e.g., blink or head turn verification).
- [ ] **Face Embedding & Match Service**
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
