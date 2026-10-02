# NEW_TODO_TASKS.md — Strategic Feature Roadmap & Tasks

> **Created:** 2026-10-03  
> **Source:** Direct owner instruction  
> **Status:** QUEUED (Do not implement code until explicitly requested)

---

## 1. Role-Based Access Control (RBAC) & Server-Side Authorization

- [ ] **Define Server-Side Role Model**
  - Canonical roles: `CITIZEN` (`USER`), `RESOLVER` (department staff), `ADMIN` (municipal officer), `SUPERADMIN`.
  - Roles strictly embedded in cryptographic JWT payload and checked on every protected endpoint.
- [ ] **Enforce Server-Side Endpoint Protection**
  - Drop client-provided `userId` from request payloads; derive authenticated `user_id` and `role` from verified JWT.
  - Apply `Depends(require_role([...]))` on sensitive endpoints:
    - Status updates (`PATCH /grievances/{id}/status`) → `ADMIN` / assigned `RESOLVER` only.
    - Department assignment (`POST /grievances/{id}/assign`) → `ADMIN` only.
    - Full grievance listing → `ADMIN` sees all; `CITIZEN` scoped strictly to own records (`userId == current_user.id`).
- [ ] **Resource-Level Authorization Guards**
  - Citizens cannot inspect other citizens' grievance details or uploaded evidence.
  - Resolvers can only view and update grievances assigned to their department.
- [ ] **Audit Trail Integration**
  - Log actor (`userId`), previous state, new state, timestamp, and source (Human Officer vs. AI) on every state modification.

---

## 2. Comprehensive Authentication & Identity System

### A. Email / Password + JWT
- [ ] **User Registration & Password Security**
  - Secure password hashing using `bcrypt`.
  - Input validation (length, format) via Pydantic / Zod.
- [ ] **Token Issuance & Lifecycle**
  - Short-lived Access Token (15m, HS256) + Long-lived Refresh Token (7d).
  - Silent token renewal (`POST /auth/refresh`) and automatic retry on 401 in frontend API client.

### B. Google OAuth 2.0
- [ ] **OAuth 2.0 Authorization Flow**
  - Sign in with Google on Next.js frontend.
  - Secure backend exchange (`/auth/google/callback`) validating Google ID token.
  - Account linking / auto-creation of citizen profile matching verified Google email.

### C. Facial Recognition Authentication (Advanced Biometric Layer)
- [ ] **Camera Capture & Liveness Detection**
  - WebRTC / HTML5 camera capture in frontend modal for biometric enrollment and verification.
  - Anti-spoofing / liveness check (e.g., blink or head turn verification).
- [ ] **Face Embedding & Match Service**
  - Face feature extraction (e.g., FaceNet / InsightFace / MediaPipe FaceMesh).
  - Encrypted storage of 128/512-dimensional face embeddings in MongoDB.
  - Cosine distance matching for 1:1 citizen verification (kiosk / high-trust complaint raising).

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

- [ ] **Modern UI / UX Overhaul**
  - Redesign design system with refined typography, state indicators, micro-interactions, and accessible contrast.
  - Real-time status tracker with visual progress milestones (Submitted → Triage → Assigned → In-Progress → Resolved).
- [ ] **Department-Specific Portals & Filtering**
  - Dedicated views for individual civic departments:
    - 🚰 Water Supply & Sewerage Board
    - ⚡ Electricity & Power Distribution
    - 🛣️ Roads, Traffic & Infrastructure
    - 🧹 Sanitation & Solid Waste Management
    - 🏥 Public Health & Medical Services
    - 🚌 Public Transport
    - 🏛️ Municipal Governance & Citizen Services
- [ ] **Dedicated Resolver / Officer Workspace**
  - Focused resolver queue showing only tickets assigned to their department/team.
  - Resolution submission interface: before/after photographic proof upload, field notes, and closure summary.
  - Department performance metrics: average turnaround time, SLA compliance, escalation rates.
- [ ] **Executive / Superadmin Oversight Dashboard**
  - Cross-department heatmaps, grievance volume trends, AI automated triage accuracy, and SLA breach monitors.

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
