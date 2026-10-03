# NEW_TODO_TASKS.md — Strategic Feature Roadmap & Tasks

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
- [ ] **Micro-interactions & Polish**
  - Real-time status tracker with visual progress milestones.
  - Loading skeletons instead of spinners for async data.
  - Toast notifications for submit/update actions.
- [ ] **Register Page — Split Layout**
  - Same dark-panel-left + form-right treatment as login page.

### B. Department-Specific Portals *(PLANNED)*
- [ ] **Dedicated Department Views**
  - Water Supply & Sewerage Board
  - Electricity & Power Distribution
  - Roads, Traffic & Infrastructure
  - Sanitation & Solid Waste Management
  - Public Health & Medical Services
  - Public Transport
  - Municipal Governance & Citizen Services
- [ ] **Dedicated Resolver / Officer Workspace**
  - Focused resolver queue showing only tickets assigned to their department/team.
  - Resolution submission interface: before/after photo proof, field notes, closure summary.
  - Department performance metrics: average turnaround time, SLA compliance, escalation rates.
- [ ] **Executive / Superadmin Oversight Dashboard**
  - Cross-department heatmaps, grievance volume trends, AI triage accuracy, and SLA breach monitors.

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
