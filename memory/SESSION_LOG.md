# SESSION_LOG.md — AI Agent Session Log

> Append new entries. Never rewrite previous entries.
> Entries are chronological. Most recent entry is at the bottom.

---

## 2026-08-06 — Project Initialization

### Goal
Initialize the complete project documentation and persistent AI agent memory
for the "AI-Enabled Grievance Redressal and Decision Support System" B.Tech project.
Repository was empty. No application code existed.

### Context Read
- Repository tree (empty — only `.git` directory)
- Project initialization prompt (full specification)

### Work Completed
- Created full documentation structure from scratch
- Established repository with all required files:
  - `README.md`
  - `PRD.md`
  - `AGENTS.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DATABASE.md`
  - `docs/AI_SYSTEM.md`
  - `docs/WORKFLOWS.md`
  - `docs/API.md`
  - `docs/SECURITY.md`
  - `docs/DEVELOPMENT.md`
  - `memory/README.md`
  - `memory/PROJECT_STATE.md`
  - `memory/DECISIONS.md`
  - `memory/CHANGELOG.md`
  - `memory/TODO.md`
  - `memory/SESSION_LOG.md` (this file)

### Files Changed
All files listed above — all newly created.

### Decisions Made
- DEC-001: Monorepo repository organization
- DEC-002: PostgreSQL as primary database
- DEC-003: Human approval required for AI assignment recommendations
- DEC-004: Sentence Transformers + pgvector for similarity detection
- DEC-005: LLM API as primary approach for initial AI prototyping (no training data yet)
- DEC-006: Formal grievance state machine with defined states and transitions
- DEC-007: RBAC with USER, RESOLVER, ADMIN, SUPERADMIN roles

### Problems / Risks
- LLM API provider not yet chosen — must be decided before AI module implementation
- No dataset exists for AI training/evaluation — all AI modules begin as EXPERIMENTAL/PROTOTYPE
- pgvector availability must be confirmed for the development PostgreSQL instance

### Next Recommended Step
Proceed to **PHASE 1: Repository Scaffolding**

1. Initialize Next.js frontend scaffold
2. Initialize FastAPI backend scaffold
3. Create `.env.example` files for both
4. Set up Alembic for database migrations
5. Verify both applications start cleanly

See `memory/TODO.md` (Current Sprint) for the complete PHASE 1 checklist.

---

## 2026-09-11 — Repo Unification (`feature/unified-system` off `app/intialise`)

### Goal
Merge `Idea Lab` context/frontend/memory into `Idea Lab2` on a new branch:
keep `Idea Lab2`'s Flask backend + Python/ML logic, keep `Idea Lab`'s project
context + Next.js frontend + memory, defer Firebase removal (Firestore stays).

### Context Read
- `Idea Lab2` tree + git state (branch `app/intialise`, identical to `main`,
  clean; remote `aryacodecraft/grievance-redressal-system`)
- `Idea Lab2/backend/server.py` (1138 lines), `tools/recategorize.py`,
  `functions/{admin_api,tfidf}.js`, `firebase.json`, `render.yaml`,
  `firestore.rules`, `.firebaserc`
- `Idea Lab` tree + git state (`main`, clean), `frontend/package.json`,
  `frontend/.env.example`
- Copied `memory/` files (PROJECT_STATE, DECISIONS, TODO, CHANGELOG)

### Work Completed
- Created branch `feature/unified-system` off `app/intialise`
- rsync-copied (excl. `.git`/`node_modules`/`.next`/`venv`/`__pycache__`/`.env*`):
  `frontend/`, `docs/`, `memory/`, `PRD.md`, `AGENTS.md` — additive only,
  zero deletions/modifications to existing `Idea Lab2` files
- Deliberately NOT copied: `Idea Lab` `backend/` (FastAPI scaffold), root `README.md`
- Wrote `INTEGRATION.md` (source map + collision record + follow-ups)
- DEC-008 recorded (Flask authoritative, FastAPI discarded, Firestore temporary)
- `PROJECT_STATE.md` updated (Flask/Firestore ground truth, FastAPI refs superseded)
- `TODO.md` annotated (FastAPI-conflicting tasks superseded)
- `CHANGELOG.md` entry appended (this merge)

### Decisions Made
- DEC-008: Unified-repo backend/persistence/frontend-wiring direction
- Owner-confirmed inputs: discard FastAPI scaffold; keep Firestore temporarily

### Problems / Risks
- `AGENTS.md` stack table now contradicts DEC-008 — needs owner confirmation
- Port mismatch `:8000` (frontend example) vs `:10000` (Flask) — unwired
- Hygiene backlog: binary `.gitignore`, UTF-16 `backend/requirements.txt`,
  committed `__pycache__/`, unidentified `adfbh`, hardcoded Firebase key in
  `functions/admin_api.js` (rotate)
- `docs/DATABASE.md` / `docs/API.md` describe discarded design — reference only

### Next Recommended Step
Review + merge `feature/unified-system` → `app/intialise` → `main` (`--no-ff`).
Then: canonical-stack confirmation → Firebase-removal branch → frontend wiring.
See `INTEGRATION.md` and updated `PROJECT_STATE.md`.

---

## 2026-09-11 — Unification Commit (frontend scaffold reuse + root README)

### Goal
Per owner direction: touch nothing on `main`, delete stale `app/intialise`,
reuse the existing Next.js frontend scaffold (no new UI yet — real frontend
goes on another branch), commit the unification baseline, and write the root
README. Unification ends here.

### Context Read
- Git state: `feature/unified-system`, `app/intialise`, `main` all at `2d8dfa5`;
  `origin` has only `main`; `app/intialise` has no upstream (local-only)
- `frontend/` scaffold: Next.js 16.3.0 + Tailwind v4, `package.json`,
  `.env.example` (`:8000` mismatch), `app/page.tsx` placeholder,
  `app/globals.css`; `.gitignore` already covers `node_modules/`, `.next/`, `.env*`
- `backend/server.py` routes: `/health`, `/test`, `/submit-grievance`,
  `/validate-image`, `/sign-cloudinary`, `/delete-cloudinary` (Flask, `:10000`)
- `render.yaml` (gunicorn `backend.server:app`), `memory/*`, `INTEGRATION.md`

### Work Completed
- Deleted local branch `app/intialise` (`git branch -D`; was `2d8dfa5`, not on
  origin) — `main` never checked out or modified
- Verified: `git diff main -- backend tools functions ...` empty (backend
  untouched); no secrets in tree (only `frontend/.env.example`)
- Staged + committed 42 additive-only files as `e0d363f`, pushed
  (`git push -u origin feature/unified-system`); force-added
  `frontend/.env.example` (otherwise ignored by `frontend/.gitignore` `.env*` rule)
- Verified: `npm run build` passes (prerendered `/` + `/_not-found`);
  `python3 -m py_compile backend/server.py tools/recategorize.py` OK
- Wrote new root `README.md` (unified-repo layout, quickstart, branch
  strategy, stale-docs warnings, follow-ups) — deliberately not reusing the
  `Idea Lab` README (describes discarded FastAPI/Postgres stack)
- Updated `memory/TODO.md` (root README done), `PROJECT_STATE.md`,
  `CHANGELOG.md`

### Decisions Made
- Reuse existing scaffold (owner-confirmed via question) instead of fresh
  `create-next-app` — scaffold already builds; real UI deferred to `feature/frontend`
- Unification declared complete at this commit; remaining work is follow-ups

### Problems / Risks
- `frontend/.env.example` still points at `:8000` vs Flask `:10000` — rewiring
  is the `feature/frontend` branch's job
- Pre-existing hygiene backlog unchanged (binary `.gitignore`, UTF-16
  `backend/requirements.txt`, committed `__pycache__/`, `adfbh`, hardcoded
  Firebase key)

### Next Recommended Step
Create `feature/frontend` off `feature/unified-system` and build the real UI
there (typed API client in `frontend/lib/`, submission form, track/admin views).
See `memory/TODO.md` unification follow-ups.

---

## 2026-09-11 — Frontend White Theme & Sleek UI Modernization

### Goal
Change the background color to white across the entire frontend only, and refine all UI components into a sleek, crisp, and professional design system.

### Context Read
- `frontend/app/globals.css`, `frontend/app/layout.tsx`
- All component files in `frontend/components/ui/` and `frontend/components/grievance/`
- All pages: `app/page.tsx`, `submit/page.tsx`, `track/page.tsx`, `admin/page.tsx`, `login/page.tsx`, `register/page.tsx`

### Work Completed
- Converted background color to clean pure `#ffffff` globally and eliminated all `dark:` class overrides and media query color shifts.
- Redesigned and modernized all UI components:
  - `Card`: subtle border (`border-ink-200/80`), soft shadows, `rounded-xl`, sleek headers.
  - `Button`: `rounded-lg`, micro-interactions, subtle shadows, crisp focus rings, refined primary/secondary/outline variants.
  - `Field` & inputs: modern `rounded-lg`, border transitions, focus rings (`ring-primary-500/15`).
  - `Badge`: clean semantic pastel tone borders and backgrounds (emerald for resolved, amber for in-progress/medium, rose for high priority, blue for open).
  - `SiteHeader` & `SiteFooter`: sticky backdrop-blur header, refined typography and links, sleek white aesthetic.
  - `Feedback`: modern icon-enhanced empty states and alert banners.
- Polished all views: Home landing page, Grievance Registration form (`submit`), Ticket Tracking timeline (`track`), Administrative Dashboard (`admin`), Login, and Registration.
- Verified: `npm run build` succeeds with zero errors (all 9 routes prerendered).

### Files Changed
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/ui/Card.tsx`
- `frontend/components/ui/Button.tsx`
- `frontend/components/ui/Field.tsx`
- `frontend/components/ui/Badge.tsx`
- `frontend/components/ui/SiteHeader.tsx`
- `frontend/components/ui/SiteFooter.tsx`
- `frontend/components/ui/Feedback.tsx`
- `frontend/components/grievance/GrievanceCard.tsx`
- `frontend/components/grievance/LocationCapture.tsx`
- `frontend/components/grievance/ImageUpload.tsx`
- `frontend/components/grievance/SubmitForm.tsx`
- `frontend/components/charts/AdminCharts.tsx`
- `frontend/components/admin/AdminBoard.tsx`
- `frontend/app/page.tsx`
- `frontend/app/submit/page.tsx`
- `frontend/app/track/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/register/page.tsx`
- `memory/CHANGELOG.md`
- `memory/SESSION_LOG.md`

---

## 2026-09-11 — Env Split + Backend Live Verification (`app/frontend`)

### Goal
User pasted all keys into `frontend/.env.local`. Split env correctly,
bring the Flask backend up with real services, and verify which functions
the new Next.js frontend can exercise.

### Work Completed
- `backend/.env` created (git-ignored): PORT=10000, HF_API_TOKEN,
  GROQ_API_KEY, CLOUDINARY_* — OPEN_ROUTER key omitted (server has no
  OpenRouter client), GOOGLE_APPLICATION_CREDENTIALS ignored by server
  (it uses FIREBASE_SERVICE_ACCOUNT or backend/serviceAccountKey.json,
  which exists).
- `frontend/.env.local` rewritten (git-ignored): NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  (="grievance app" per legacy UI — UNCONFIRMED, verify in Cloudinary
  dashboard), NEXT_PUBLIC_USE_MOCKS=true.
- Rebuilt `/tmp/grs-venv` (flask, flask-cors, firebase-admin, groq,
  cloudinary, etc.); Flask on :10000 → Firebase/Groq/Cloudinary all
  initialized.
- Found server default GROQ_MODEL `llama-3.3-70b-versatile` 404s
  (decommissioned); probed key — only `openai/gpt-oss-20b` works for text.
  Pinned `GROQ_MODEL=openai/gpt-oss-20b` in `backend/.env` (no code change).
- Verified live: text submit → 200 with real HF sentiment + Groq-refined
  category (water→health correction observed, confidence 0.95);
  gas-leak text → priority high/isUrgent true; generic text → medium.
- Found LLM *image* validation unusable with this key: vision model id is
  hardcoded (`server.py:734`, LLAVA_MODEL env unused there) and every
  vision-capable Groq model 404s on this account. Heuristic fallback is the
  steady state (quality score vs threshold 60). Left `server.py` untouched.
- `lib/api.ts` null-guards `hfEngine.priority` → "low"; CATEGORIES aligned
  to server CATEGORY_KEYS (uncommitted hardening).
- Next.js dev on :3001 — all 6 routes 200.

### Next
- User browser-checks: photo upload accept/reject, full submit with photo,
  track/admin mock pages. Confirm Cloudinary preset name if upload fails.

---

## 2026-09-11 — Live Admin via Firebase Client (`app/frontend`, uncommitted)

### Goal
User's submit never arrived (no backend POST, no Firestore doc — confirmed:
only 4 smoke-test docs + old June/July docs exist). Cause is browser-side.
Also: new `/admin` was mock-only, so real submissions were invisible there.
Implement option (c): live Firestore reads in the new frontend.

### Work Completed
- Installed `firebase` SDK (client: app/auth/firestore).
- `frontend/.env.local`: added NEXT_PUBLIC_FIREBASE_* web config (same
  values as legacy UI; key rotation still owed — key is public in repo).
- `lib/firebase.ts` (new): client init, `isFirebaseConfigured`,
  `isAdminEmail` (mirrors firestore.rules allowlist `aryaadmin@gmail.com`).
- `lib/grievances.ts` (new): doc→Grievance mapper, `subscribeGrievances`
  (admin: latest 50; citizen: userId==uid + createdAt desc per deployed
  composite index), `fetchGrievanceById` for Track.
- `lib/session.tsx`: Firebase email/password auth added alongside demo
  mode; Firebase session wins when present (`user.live`, role from
  allowlist); sign-out clears both.
- Login/register: Firebase-first, demo fallback button retained.
- `AdminBoard`: live onSnapshot when signed in live (spinner, error→mock
  fallback, scrollable queue, evidence image in detail); demo banner + mocks
  otherwise. Track: live doc lookup when signed in.
- `SubmitForm`: auto-scrolls to confirmation; reference ID shown in a
  persistent high-contrast panel (users missed it below the fold).
- `tsc` clean, `next build` passes (6 routes), dev restarted on :3001.

### Note
User commits on this branch include their own "ui overhaul" (08c40dc) —
edits above were adapted to their restyled files. Nothing committed by agent.

---

## 2026-09-11 — Second Admin Credential (`app/frontend`, uncommitted)

### Goal
Create a second admin login (keep `aryaadmin@gmail.com`), visible in the
sign-in UI during development.

### Work Completed
- Created Firebase Auth user `admin@grievai.test` via Admin SDK
  (email pre-verified; password shared in chat only, stored nowhere).
- Allowlist updated in both places: `firestore.rules` isAdmin() and
  `frontend/lib/firebase.ts` isAdminEmail() now accept both addresses.
- `/login` shows a dashed dev-credentials box (email/password + autofill
  button) gated behind `NEXT_PUBLIC_SHOW_DEV_CREDS=true` in the git-ignored
  `.env.local`. Remove before any shared deployment.
- Verified: REST sign-in with the new creds returns a valid ID token;
  `tsc` + `next build` clean; dev restarted on :3001.
- Nothing committed by agent.

### Open (owner)
- Publish the updated `firestore.rules` in Firebase console
  (Firestore → Rules → paste → Publish) — local edit alone changes nothing
  deployed. Until published, live admin reads fail closed (UI falls back to
  mocks with an error banner).
- Rotate the Firebase web API key (public in legacy files) and the dev
  admin password before any shared/staging use; delete the dev banner.

---

## 2026-09-11 — Dead Form Handlers Fix (`app/frontend`, uncommitted)

### Cause
`onSubmit={void submit}` evaluates to `undefined` — React got no handler,
so Sign in / Sign up / Submit Grievance all did a silent native reload.
This was the reason for both "click sign in, nothing happens" and the
earlier "submitted but no confirmation".

### Work Completed
- `app/login/page.tsx`, `app/register/page.tsx`,
  `components/grievance/SubmitForm.tsx`: handlers wrapped as
  `(e) => { e.preventDefault(); void …(e); }`.
- `tsc` clean, `next build` passes, dev restarted on :3001 (all routes 200).
- Nothing committed by agent.

---

## 2026-09-11 — Phase 1 + 1.5 Committed (`feature/unified-system`)

### Goal
Commit the pending working tree: `UNIFIED_MIGRATION_PLAN` Phase 1 (frontend
de-Firebase) and Phase 1.5 (legacy behavioural parity), as multiple logical
one-line commits.

### Work Completed
Verified the gates first, then committed in dependency order so every
intermediate commit is buildable:
1. `1857ee3` Add grievance list, detail, and status endpoints to API client
2. `1d31ff5` Add TF-IDF cluster panel and Leaflet map for admin parity
   (package files staged as an intermediate blob: leaflet added only —
   firebase/next-auth removal held back for the next commit; see
   `/tmp/opencode/mk_intermediate_pkg.py` approach, index-only staging via
   `git hash-object -w` + `git update-index --cacheinfo`)
3. `337ec2a` Drop Firebase client and move session and admin queue to REST
   (`lib/firebase.ts` deleted, `roles.ts` added, session/grievances/auth
   pages/AdminBoard rewritten, deps removed, `.env.example` stripped)
4. `ac07e29` Add citizen my-grievances list below the submit form
5. `1ad8393` Remove unused Button import from ImageUpload
6. `0b438b8` Mark migration phases 1 and 1.5 complete in migration docs
7. (this entry) memory update commit

### Verified
- `tsc --noEmit` clean and `npm run build` passes (9 routes) on the final
  working tree — i.e. the content of commits 1–6.
- Staged diffs inspected per commit (dependency changes split so no commit
  removes a package still imported by that commit's code).

### Open
- **Backend gap:** the new REST calls (`GET /grievances`, `GET /grievances/{id}`,
  `PATCH /grievances/{id}/status`) are **not implemented in `backend/server.py`**
  — live mode 404s until Phase 2 (FastAPI rewrite) or an interim Flask shim.
- Cloudinary cloud name / upload preset still need real values in
  `frontend/.env.local` (Phase 1.5 checklist item left open).
- Previous session's Firebase-console follow-ups (publish `firestore.rules`,
  rotate web API key) are now moot for the frontend (Firebase client removed);
  backend/legacy files still hold the key.

---

## 2026-09-11 — Phase 2 Committed (`feature/unified-system`)

### Goal
Commit the pending Phase 2 (FastAPI rewrite) working tree as multiple
one-line commits, verifying first.

### Work Completed
Verified: in-process `TestClient` smoke test against `backend/app.main`
(health, submit → list → `?userId=` scoped list → get → patch status/assignee
→ 404s all correct; AI refinement degrades gracefully without API keys),
`tsc --noEmit` clean, `npm run build` 9 routes, AST-parse of all 13
`backend/app` modules (fastapi not installed in system python — smoke test
ran in a throwaway venv at `/tmp/opencode/phase2venv`).

Commits:
1. `e55a9a3` Add FastAPI grievance service under backend/app
   (13 `.py` files; `__pycache__`/`.pyc` excluded on purpose)
2. `78cd9ed` Add FastAPI dependencies and switch Render to uvicorn
3. `79906d5` Accept null grievance fields in the typed API client
4. `d1c9c6d` Mark Phase 2 complete in migration docs
5. (this entry) memory + DEC-010

### Decisions
- DEC-010 recorded; DEC-008 marked partially superseded (FastAPI is now the
  serving path per `UNIFIED_MIGRATION_PLAN`; Flask `backend/server.py` stays
  as legacy reference).

### Open
- Phase 3: MongoDB persistence — swap `InMemoryRepository` for Mongo behind
  the existing `GrievanceRepository` protocol; add `MONGODB_URI`/`MONGODB_DB`.
- Server-side Firebase removal is still incomplete: `backend/server.py`,
  `tools/recategorize.py`, `functions/`, root `firebase.*` remain (legacy path).
- `backend/app/**/__pycache__` left untracked (repo-wide `.gitignore` hygiene
  fix still pending).
- `pydantic-settings` avoided in favour of `python-dotenv` (documented in the
  migration plan) — no new dependency introduced beyond fastapi/uvicorn.

---

## 2026-09-11 — Phase 3 Committed (`feature/unified-system`)

### Goal
Commit the pending Phase 3 (MongoDB persistence + Firebase/Flask retirement)
working tree as multiple one-line commits, verifying first.

### Work Completed
Verified before committing:
- AST-parse of all `backend/app` + `tools` modules.
- Smoke test **in-memory fallback** (`MONGODB_URI=""` forced, since
  `backend/.env` carries a real URI that `load_dotenv()` would pick up):
  health `storage: in-memory`, submit → scoped list → PATCH → 404 all correct.
- Smoke test against a **throwaway local `mongod`** (port 27123, temp dbpath
  under `/tmp/opencode`): health `storage: mongodb`, create/list/get/PATCH,
  `createdAt` is a BSON `datetime`, indexes `uniq_grievance_id` +
  `user_created` exist, and a **fresh process** still sees the document
  (persistence across restart). mongod shut down and temp data removed after.
- `pip install --dry-run -r backend/requirements.txt` resolves cleanly.
- `tools/recategorize.py --help` works with `backend/server.py` deleted.
- `tsc --noEmit` clean after the `types.ts` comment fix.
- Hygiene re-checked: `.gitignore` UTF-8, 0 tracked `__pycache__`,
  `backend/requirements.txt` ASCII (old UTF-16 issue gone).

Commits:
1. `c44d410` Add MongoDB persistence behind the repository protocol
   (db.py, health.py, both requirements, `backend/.env.example`, recategorize)
2. `a4d9593` Retire the Flask server and Firebase config files
   (`backend/server.py`, `firebase.json`, `.firebaserc`, `firestore.rules`,
   `firestore.indexes.json`, `types.ts` comment)
3. `2427983` Rewrite DATABASE documentation for MongoDB
4. `aae4b74` Mark Phase 3 complete in migration docs
5. (this entry) memory + DEC-011

### Decisions
- DEC-011 recorded (Mongo behind the repository protocol; Firebase config +
  Flask server deleted; DEC-008 item 4 superseded; DEC-002 PostgreSQL now in
  tension — owner decision queued for Phase 5).

### Open
- **Owner blocker:** create Atlas cluster + set `MONGODB_URI`/`MONGODB_DB` in
  `backend/.env`; until then the API runs on the non-persistent in-memory
  fallback (`/health` shows which).
- Phase 4: retire `functions/` + root `adfbh`.
- Phase 5: align `AGENTS.md` stack table / README / INTEGRATION / API /
  ARCHITECTURE / SECURITY docs; rotate the leaked Firebase key (git history).
- Phase 6: pytest vs test Mongo, classifier unit tests, repo-wide
  `rg -i "firestore|firebase"` check.
- Note: a `pkill` pattern in this session matched its own shell (SIGTERM);
  cleanup was re-done with a bracketed pattern — no stray mongod left running.

---

## 2026-10-01 — Migration Phases 4, 5, 6 Committed (`feature/unified-system`)

### Goal
Execute the approved `UNIFIED_MIGRATION_PLAN.md` Phases 4 (retire the legacy
Firebase UI), 5 (align docs/config with the real stack) and 6 (verification:
pytest suite + end-to-end check), committing verified work as one-line commits
and updating memory afterwards. MongoDB Atlas setup stays with the owner
("I'll do mongo setup at last").

### Context Read
- `AGENTS.md` (mandatory), `memory/{README,PROJECT_STATE,DECISIONS,TODO,CHANGELOG,SESSION_LOG}.md`
- `UNIFIED_MIGRATION_PLAN.md` / `UNIFIED_MIGRATION_CHECKLIST.md`
- Source touched: `backend/app/{db.py,config.py,main.py,routers/grievances.py,services/classification.py}`,
  `frontend/lib/{types.ts,tfidf.ts,roles.ts,grievances.ts}`, `tools/recategorize.py`
- Docs touched: `README.md`, `INTEGRATION.md`, `AGENTS.md`, `docs/{ARCHITECTURE,API,SECURITY,DEVELOPMENT}.md`

### Work Completed

**Phase 4 — retire the legacy Firebase UI (`09e83af`)**
- Deleted `functions/` (6 files: `tfidf.js`, `admin_api.js`, `admin_ui.js`,
  `admin.html`, `grievance-app.html`, `download.jpg`) and root `adfbh`.
- Updated `README.md` repo table + follow-ups, `INTEGRATION.md` (status banner
  + loose-ends annotated resolved), and the `frontend/lib/tfidf.ts` header
  comment. The only surviving reference to `functions/` is that intentional
  historical note.

**Phase 5 — docs/config alignment (`cfdb7d1`, `4e52990`, + `4686f81`)**
- `AGENTS.md` stack table: Backend annotated `backend/app/` (DEC-010),
  Database PostgreSQL → MongoDB (DEC-011, supersedes DEC-002), Auth marked
  *planned* vs. the demo localStorage session (DEC-009), dated stack note added.
- `README.md` rewritten where it described a Flask/`server.py` world
  (layout, quickstart, `:8000` → `:10000`, key decisions, follow-ups).
- `docs/ARCHITECTURE.md` — overview, port, ASCII diagram (Postgres+pgvector →
  MongoDB), backend tree → the real `backend/app/` layout, Auth marked PLANNED,
  Database + boundaries sections rewritten.
- `docs/API.md` — status header, base URL, new "Implemented endpoints" table
  (documenting that create is `POST /submit-grievance`, not `POST /grievances`),
  real `/health` shape, real `{"error": …}` / 400 error format.
- `docs/DEVELOPMENT.md` — prerequisites/setup/migrations/commands/conventions/
  troubleshooting rewritten for MongoDB + uvicorn, plus a "Running Tests" section.
- `docs/SECURITY.md` — Authentication marked PLANNED; Known Prototype
  Limitations now leads with the server-side auth gap (API trusts request-body
  `userId`; list/PATCH are unauthorised; the frontend allowlist is client-side
  only and provides no security).
- `render.yaml` gained `MONGODB_URI` (sync: false) + `MONGODB_DB` — without them
  a deployment silently uses the in-memory fallback.

**Phase 6 — verification (`f6e2890`, `98ec1f3`)**
- New `tests/` (4 files, 85 tests), `pytest.ini`, `requirements-dev.txt`.
  Split so Render keeps installing only the runtime `requirements.txt`.

### Verification (all done before committing)
- `pytest` → **85 passed** with a local `mongod` on `:27017`; after
  `mongod --shutdown` → **68 passed, 17 skipped** (Mongo tests skip, they never
  fail). Test databases dropped after runs — only `admin`/`config`/`local` left.
- End-to-end against live `uvicorn` on `:10000` with `MONGODB_URI` set:
  `storage: mongodb` → submit ×2 → list all + `?userId=` scoped → get →
  PATCH `status`/`assignee` → 404s → `400 {"error": "description: Field required; userId: Field required"}`.
  **Restarted the process and the data (including the PATCH) was still there.**
  Then ran the same server with no `MONGODB_URI`: `storage: in-memory`, empty list.
- `tsc --noEmit` clean; `npm run build` passes (9 routes).
- `rg -i "firestore|firebase"` over source + docs → only past-tense history
  (`tools/recategorize.py`, `frontend/lib/{roles,grievances}.ts`,
  `INTEGRATION.md`, key-rotation notices). No firebase/firestore dependency in
  `frontend/package.json`; no such files outside `venv/`.
- Hygiene: 0 tracked `__pycache__` (including the new `tests/__pycache__`),
  `venv/` gitignored and untracked.

### Commits (all local, not pushed)
1. `09e83af` Retire legacy Firebase UI and stray adfbh file
2. `cfdb7d1` Update AGENTS stack table and README for FastAPI and MongoDB
3. `4e52990` Align architecture, API, development, and security docs with the real stack
4. `f6e2890` Add pytest suite covering classifier, endpoints, and repositories
5. `4686f81` Declare MONGODB_URI in the Render service environment
6. `98ec1f3` Document the test suite and dev-requirements setup
7. `63e9e5b` Add a frontend end-to-end script driving the real API client
8. `d8fac99` Mark migration Phases 4–6 complete in the plan and checklist
9. `328a5cd` Record Phases 4–6 completion in project memory (this entry)

### Decisions
- **DEC-012** — test strategy: root `tests/` + `pytest.ini` `pythonpath = .`;
  conftest pins `MONGODB_URI=""` / `GROQ_API_KEY=""` / `HF_API_TOKEN=""` *before*
  `backend.app` imports (so `load_dotenv()` cannot override) forcing the
  deterministic keyword + in-memory path; an **autouse fixture swaps a fresh
  `InMemoryRepository` onto `backend.app.routers.grievances.repository`** (the
  router binds `repository` at import, so patching `db.repository` alone would
  not isolate tests); Mongo tests **skip** unless `TEST_MONGODB_URI`
  (default `mongodb://127.0.0.1:27017`) answers a 750 ms ping; repository
  *selection* is tested by monkeypatching `backend.app.config` because
  `_build_repository()` does a function-local import.
- **DEC-013** — stale docs annotated in place rather than rewritten (status
  banners, "Implemented endpoints" table); `README.md` was the sole wholesale
  rewrite. Rationale: `AGENTS.md` forbids replacing useful docs with shorter
  generic versions, and the planned auth design is still the target.
- **DEC-002** marked **SUPERSEDED BY DEC-011** — the Phase 5 item DEC-011 had
  queued as "needs an owner decision".
- DEC-011's Consequences section: Phase 4 and Phase 5 items annotated as closed;
  key rotation + Atlas setup annotated as still open.

### Notes / Gotchas
- Two test assertions were initially wrong because I guessed at the keyword
  lists; both were corrected against the real source rather than loosened —
  `normalize_sentiment("LABEL_0")` returns `"neutral"` (the decoder only looks
  for `"neg"`/`"pos"` substrings), and `contains_high_risk_issue()` matches the
  two-word phrase `bridge collapse`, so "the bridge may collapse" does not hit.
  These are documented as current behaviour in the tests.
- A `pkill -f "uvicorn backend.app.main"` matched its own shell (SIGTERM) and
  killed the command mid-run; re-done using PID files in a script under
  `/tmp/opencode`. No stray `mongod` or `uvicorn` left running.

### Addendum — end-to-end through the real frontend client
The plan's Phase 6 item *"end-to-end: submit → track → admin view"* was first
attempted through the desktop browser, but **no browser was connected to this
session**, so the DOM could not be driven. Re-done at the client-contract level
instead, and the result was committed as `frontend/scripts/e2e.mjs` so the check
is reproducible: it `import`s the real `frontend/lib/api.ts`, so every response
is parsed by the same zod schemas the UI uses (`grievanceSchema`,
`submitResultSchema`, …), and drives it against live `uvicorn` + `mongod`:

- `checkBackendHealth` → true
- `submitGrievance` → `GRV-2026-0001`
- `getGrievance` (track) → `status=open`, title/userId round-tripped
- `getGrievance("GRV-1999-9999")` → `null` (the track page's not-found path)
- `listGrievances()` / scoped `?userId=` / unknown user → all, 1, `[]`
- `updateGrievanceStatus` assigned → resolved; a re-read shows both persisted
  and the other fields untouched
- submit without `userId` rejects with the backend's `{error}` message
- a second citizen proves the admin queue is genuinely multi-user

Also confirmed all 6 frontend routes (`/`, `/submit`, `/track`, `/admin`,
`/login`, `/register`) return 200 from `next dev` on `:3000`, and that
`frontend/lib/api.ts` resolves its base URL to `NEXT_PUBLIC_API_URL`
(`.env.local` already points at `:10000`).

Stack torn down afterwards: backend, `next dev` and `mongod` all stopped,
`grievance_ui` / `grievance_e2e` databases dropped, no listeners left on
`:3000`/`:10000`/`:27017`.

### Open
- **Owner blocker:** create the MongoDB Atlas cluster + set `MONGODB_URI` /
  `MONGODB_DB` in `backend/.env` — until then the API runs on the in-memory
  fallback (`/health` reports `storage`).
- Rotate the hardcoded Firebase Web API key — still in git history; deleting
  the file (Phase 4) does not remove it.
- Real auth (JWT/RBAC) — the documented highest-risk gap; `docs/SECURITY.md`
  now spells out the mitigation path.
- Commits are local only; review + `--no-ff` merge `feature/unified-system` →
  `app/intialise` → `main`.
- Not covered by the new suite: HF/Groq classification branches, image +
  Cloudinary services, frontend tests (Jest/RTL still OPEN in `TODO.md`).

---

## 2026-10-02 — MongoDB Atlas Cutover + Restart-Safe ID Bug Found and Fixed

### Goal
Complete the owner-blocked item from the previous session (Atlas setup) and
drive the end-to-end test that had been left pending, then record whatever the
run turned up.

### Context Read
- `memory/{PROJECT_STATE,DECISIONS,TODO,CHANGELOG}.md`, prior session log entry
- `backend/app/{config,db}.py`, `backend/app/services/image.py`,
  `backend/.env.example`, `tests/conftest.py`, `frontend/scripts/e2e.mjs`

### Work Completed

**1. Atlas cutover (owner supplied the connection string; agent verified it)**
- Connectivity probed read-only first: `ping` OK, server `8.0.34`, so SRV
  resolution, TLS, credentials and the IP allowlist were all correct before
  anything was written.
- `MONGODB_URI` + `MONGODB_DB=grievance` appended to `backend/.env`
  (gitignored — verified with `git check-ignore`; no tracked file contains the
  cluster host; tree clean).
- Boot → `{"status":"ok","storage":"mongodb"}`; `grievance.grievances` and both
  indexes created (`uniq_grievance_id` unique, `user_created`).

**2. End-to-end against real storage**
- `next dev` on `:3000` in live mode; all 6 routes serve 200.
- `frontend/scripts/e2e.mjs` PASSED through the real zod-parsing client:
  submit → track → admin assign/resolve → re-read, error path, second citizen.
- `pytest`: 85 passed with a local `mongod` (17 Mongo tests skip without one),
  and Atlas was **not** touched by the suite — count 3 → 3 across the run,
  confirming `conftest.py`'s `MONGODB_URI=""` pin does its job.
- Cloudinary settled an open checklist item: the `grievance app` preset **is
  unsigned** — a real JPEG uploaded (HTTP 200), then `/validate-image`
  (heuristic path, `score=18.4` → correctly below `IMAGE_LLM_THRESHOLD=60`),
  `/delete-cloudinary` and `/sign-cloudinary` all returned 200. Test asset
  deleted afterwards.

**3. Env-var port audit → two repairs + one recorded drop (DEC-015)**
- `GROQ_MODEL` defaulted to `llama-3.3-70b-versatile`, which Groq has
  decommissioned — the call 404s and the failure is swallowed, so
  classification silently ran on keyword rules while *looking* configured. The
  dead default also shipped in `.env.example`, so a fresh clone inherited it.
  Both now say `openai/gpt-oss-20b`, with comments explaining the change.
- `LLAVA_MODEL` was declared in `config.py` and read by nobody —
  `services/image.py` hardcoded the same string. Now imported and used.
- `OPEN_ROUTER_API_KEY` (present on `main`, used there for image validation)
  was never ported; Phase 2 replaced that path with Groq vision + heuristic.
  **Intentionally not restored**, recorded as DEC-015 rather than left as an
  unnoticed gap.

**4. The bug the audit did not catch — restart-safe IDs (DEC-014)**
Submitting after a restart produced:

```
DuplicateKeyError: E11000 … index: uniq_grievance_id dup key: { id: "GRV-2026-0001" }
POST /submit-grievance 500
```

`_new_id()` was `f"GRV-{year}-{next(_counter):04d}"` over a module-level
`itertools.count(1)` — restarting the process resets it to 1, so the first
write after every restart asked for an id that already existed. **The API could
not create a grievance after a restart.**

Fix (`backend/app/db.py`, DEC-014): the id tail is now read from stored data —
`MongoRepository` takes the highest `id >= "GRV-<year>-"` (an indexed range
lookup, not a scan) and retries on `DuplicateKeyError` up to 100 times to cover
concurrent writers; `InMemoryRepository` takes `max(existing tails) + 1` under
its lock. The `GRV-<year>-<seq>` scheme and every documented contract are
unchanged.

**5. Correction to the previous session's verification claim**
The earlier "persistence across a process restart" result was **not valid**.
The restart helper's `kill` used a stale PID file and did not actually stop the
listening process, so the test ran against a process that never exited — which
is exactly why the ID bug stayed hidden. Re-verified honestly this round with a
PID sourced from `ss -ltnp` on `:10000`:

- genuine recycle → next submit `GRV-2026-0005` (not `0001`)
- second recycle → `GRV-2026-0006` and `GRV-2026-0007`, back to back
- final listing: 7 then 9 documents, **no duplicate ids**
- `pytest` still 85 passed after the change; `tsc --noEmit` clean;
  `npm run build` renders 6 routes; e2e re-run PASSED (`GRV-2026-0008`);
  zero errors in the backend log since the fix

### Verification Summary
| Check | Result |
|---|---|
| Atlas SRV/TLS/auth/allowlist | OK (server 8.0.34) |
| `/health` storage | `mongodb` |
| Indexes on `grievances` | `uniq_grievance_id` (unique), `user_created` |
| Persistence across a *real* restart | OK — document + status + assignee intact |
| `pytest` (with local mongod) | 85 passed |
| `pytest` (no mongod) | 68 passed / 17 skipped |
| Atlas untouched by tests | count 3 → 3 |
| `frontend/scripts/e2e.mjs` | PASSED (real client, zod-validated) |
| Cloudinary upload / validate / delete / sign | all HTTP 200 |
| `tsc --noEmit` / `npm run build` | clean / 6 routes |
| Restart-id regression | 0005, 0006, 0007 — no duplicates |

### What Was Left Running
Deliberately, so the owner can click through: backend `uvicorn` on `:10000`
(PID in `/tmp/opencode/be.pid`), `next dev` on `:3000`, and a local `mongod` on
`:27017` (`/tmp/opencode/mongodata`) used only for the full pytest run. The
Atlas cluster holds 9 automated test records (persistence probes + e2e) —
harmless, and droppable on request.

### Open
- **DOM still not driven** — no desktop browser is connected to this session,
  so the click-through (submit → track → admin → refresh → resolve) remains
  unverified; `e2e.mjs` covers the client contract only. Left for the owner.
- Atlas password is short and now known to this conversation — rotation
  recommended, and `0.0.0.0/0` allowlisting should be narrowed.
- Firebase Web API key rotation (still in git history).
- `imageValidation` is not persisted: `SubmitForm` sends `imageUrl` only, so
  `publicId` and the validation score are dropped (affects later deletion and
  auditability) — tracked in `TODO.md`.
- A regression test that asserts ids are allocated *from stored data* would
  have caught DEC-014 — tracked in `TODO.md`.
- Post-migration roadmap unchanged: **Phase 0 checkpoint merge → Phase 1 JWT
  auth/RBAC → Phase 2 DEC-006 state machine + history → Phase 3 UI → Phase 4
  AI evaluation (deferred) → ship.**

---

## 2026-10-02 — Automated Test Suite (85 → 207), Six Divergences Fixed

### Goal
Write the comprehensive automated test suite the owner asked for before the
post-migration roadmap starts (Phase 0 merge → Phase 1 JWT → Phase 2 state
machine → Phase 3 UI → Phase 4 AI eval). DOM/walk-through testing remains the
owner's job — no desktop browser is connected to this session.

### Context Read
- `AGENTS.md` + `memory/{README,PROJECT_STATE,DECISIONS,TODO}.md` and the tail
  of `SESSION_LOG.md` (memory protocol)
- `backend/app/{db.py,main.py,config.py,models.py}`,
  `routers/{grievances,images,health}.py`, `services/{image,classification}.py`
- `tests/{conftest,test_endpoints,test_repository,test_classification}.py`
- `frontend/lib/{api,roles,types,mock}.ts`, `frontend/scripts/e2e.mjs`,
  `components/{ui/Badge,grievance/GrievanceCard,admin/AdminBoard}.tsx`
- `docs/{API,DATABASE,DEVELOPMENT,SECURITY}.md`, `render.yaml`,
  both `.env.example` files

### Approach
Prove each candidate defect empirically *before* writing its test — a probe
script against both repository implementations and `TestClient`, then against a
local `mongod`, so nothing was encoded on assumption. Two categories emerged
and were handled differently (recorded as **DEC-016**): real bugs were fixed,
and gaps deferred to a later phase became `test_BASELINE_*` tests that assert
today's behaviour and are *meant to fail* when that phase lands.

### Bugs Probed and Confirmed
| # | Finding | Evidence |
|---|---|---|
| 1 | `limit=0` → memory `0` rows, Mongo **5** (whole collection) | `docs[:0]` vs `.limit(0)` |
| 2 | `limit=-2` → memory `3`, Mongo `2` | slice vs pymongo abs |
| 3 | Tied `createdAt` → Mongo `[0003,0002,0001]`, memory `[0002,0003,0001]` | priority weight only in memory |
| 4 | `status=""` stored verbatim → `Badge` no match, timeline step 0 | `update()` filters only `None` |
| 5 | Unknown route/405 → `{"detail"}`, client reads `json.error` | FastAPI default |
| 6 | `roleForEmail("notadmin@…")` → `"admin"` | `includes("admin")` |
| 7 | `image.py:145` `requests.get(image_url)` — no scheme/host/IP/size check | source |
| 8 | `_storage_mode` assigned only on ping success → `/health` lies at boot | `_build_repository()` |
| 9 | `hfEngine.categoryConfidence` read by `GrievanceCard` but absent from `hfEngineSchema` → zod strips it | node probe: `undefined !== 0.5` |

### Work Completed
**Six fixes, each with a regression test:**
- `db.py` — `limit<=0` returns `[]` in *both* implementations; in-memory sort
  aligned to Mongo's `(createdAt, id)` desc; `_storage_mode` set as soon as
  `MONGODB_URI` is present
- `routers/grievances.py` — `limit: int = Query(50, ge=1, le=1000)`; blank
  `status`/`assignee` → `400`, otherwise trimmed
- `main.py` — `StarletteHTTPException` handler so 404/405 use the flat
  `{"error"}` shape the docs already promised
- `frontend/lib/api.ts` — `hfEngineSchema` declares `rawCategoryLabel`,
  `categoryConfidence`, `urgentMatches`, `modelInfo` (normalising the backend's
  `"None"` groqModel to real `null`); `grievanceSchema` declares `imageValidation`
- `render.yaml` — `CORS_ORIGINS` no longer a localhost placeholder
- `backend/.env.example` — documents the `HUGGINGFACE_API_TOKEN` alias

**Nine test files (207 tests) + 18 offline frontend checks:**
new `test_id_allocation.py`, `test_image_validation.py`,
`test_classification_cascade.py`, `test_config_drift.py`,
`test_security_baseline.py`, `test_status_vocabularies.py`;
extended `test_endpoints.py`, `test_repository.py`; `repo` fixture hoisted to
`conftest.py`; new `frontend/scripts/check-contract.mjs` (stubbed `fetch`).

**Docs:** `docs/API.md` (limit bounds, `/health` semantics, flat 404/405,
blank-status rejection), `docs/DATABASE.md` (new "Shared list contract"),
`docs/DEVELOPMENT.md` (nine files, `test_BASELINE_*` convention,
`check-contract.mjs`).

**Memory:** DEC-016 added; CHANGELOG, PROJECT_STATE, TODO updated.

### Verification
| Check | Result |
|---|---|
| `venv/bin/pytest` (local `mongod`) | **207 passed** |
| `node frontend/scripts/check-contract.mjs` | **18 checks passed** (offline) |
| `node frontend/scripts/e2e.mjs` | PASSED (`GRV-2026-0010`, Atlas) |
| `npx tsc --noEmit` | clean |
| `npm run build` | 7 routes |
| Live probes of every fix on Atlas | `limit=0/-5/1001`→400, unknown route→flat 404, `DELETE /health`→405 flat, blank status→400, `"  assigned  "`→`assigned` |
| Per-commit isolation | each commit verified with unstaged work stashed |

Each of the four commits was verified against exactly its own tree before
committing: `925b89c` (repository contract), `c1e47eb` (router + error shape),
`d2f7151` (image/cascade/config suites + their fixes), `dd867ea` (zod fix +
frontend contract checks, incl. `tsc` + `build`).

### Decisions Made
- **DEC-016** — fix real bugs, baseline known gaps (`test_BASELINE_*`), source
  parsing where import is impossible (JSX), and `/health` reports configuration
  rather than reachability.

### What Was Left Running
Backend restarted to pick up the fixes: `uvicorn` on `:10000` (PID in
`/tmp/opencode/be.pid`, Atlas, `/health` → `storage: mongodb`), `next dev` on
`:3000`, local `mongod` on `:27017` (`/tmp/opencode/mongodata`) for the full
pytest run. Atlas now holds the e2e records plus `GRV-2026-0010` (whose status
the live probe set to `assigned`) — all droppable on request.

### Open
- **DOM still not driven** — no desktop browser; the click-through remains the
  owner's. `check-contract.mjs` + `e2e.mjs` cover the client contract, not the
  DOM.
- Phase 1 must **invert** `tests/test_security_baseline.py` and the `BASELINE`
  block in `check-contract.mjs` rather than delete them; Phase 2 must update
  `test_status_vocabularies.py`'s four-site divergence assertions.
- SSRF, unauthenticated `/delete-cloudinary`-`/sign-cloudinary`, the
  `roleForEmail` escalation and the missing `/readyz` are logged in
  `TODO.md` — all Phase 1 or deployment hardening, deliberately not fixed here.
- Jest + React Testing Library still not set up (component/interaction tests);
  `check-contract.mjs` covers pure functions and schemas only.
- Unchanged: Atlas password rotation, Firebase key rotation, Phase 0 merge
  (branch now **40 commits ahead of `main`, unpushed**).

---

## 2026-10-03 — Phase 1: JWT Authentication, Google OAuth 2.0 & Server-Side RBAC

### Goal
Implement production-grade authentication and authorization: email/password + JWT, Google OAuth 2.0, server-side RBAC enforcement across all grievance endpoints, and full frontend session integration (leaving facial recognition deferred for the future).

### Context Read
- `AGENTS.md` (Mandatory Memory Protocol, Human-in-the-Loop, Tech Stack)
- `memory/PROJECT_STATE.md`, `memory/DECISIONS.md` (DEC-007, DEC-009, DEC-016), `memory/NEW_TODO_TASKS.md`
- Plan artifact `phase1_jwt_auth_plan.md`

### Work Completed
1. **Backend Auth Infrastructure:**
   - Implemented `backend/app/auth.py` with PyJWT (HS256), `create_access_token`, `create_refresh_token`, token decode/verification, `get_current_user`, `get_optional_user`, and `require_role(...)` dependency factory.
   - Built `backend/app/users_db.py` supporting `MongoUsersRepository` (MongoDB `users` collection with unique index on `email`) and `InMemoryUsersRepository` fallback.
   - Implemented `backend/app/routers/auth.py` with `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/google`, and `/auth/google/callback`.
   - Used direct `bcrypt` (12 rounds) for password hashing and verification.
   - Added idempotent admin seeding on startup in `backend/app/main.py`.
2. **Server-Side RBAC Enforcement:**
   - Modified `backend/app/routers/grievances.py`:
     - `POST /submit-grievance`: derives `userId` from verified JWT, ignoring client-provided body value in authenticated mode; accepts body `userId` in demo/mock mode for backward compatibility.
     - `GET /grievances`: citizens (`USER`) are strictly scoped to their own grievances (`userId` extracted from verified token); officers (`ADMIN`, `SUPERADMIN`, `RESOLVER`) can list all or filter.
     - `GET /grievances/{id}`: citizens restricted to their own grievances; officers can read any.
     - `PATCH /grievances/{id}/status`: protected with `require_role(["ADMIN", "SUPERADMIN", "RESOLVER"])`.
   - Updated `SubmitGrievanceRequest` model in `backend/app/models.py`.
3. **Frontend Integration:**
   - Updated `frontend/lib/types.ts`: added `AuthUser`, `AuthResponse`, and made `userId` optional in `SubmitPayload`.
   - Updated `frontend/lib/api.ts`: token storage helpers (`getStoredAccessToken`, `getStoredRefreshToken`, `setStoredTokens`, `clearStoredTokens`), `Authorization: Bearer <token>` injection in `requestJson` with transparent 401 refresh retry, and auth client methods (`loginUser`, `registerUser`, `getCurrentUser`, `getGoogleAuthUrl`).
   - Updated `frontend/lib/session.tsx`: full session provider with `login()`, `register()`, `signOut()`, auto `/auth/me` on mount, while preserving mock/demo mode.
   - Updated `frontend/app/login/page.tsx` & `frontend/app/register/page.tsx`: connected to real auth with Google OAuth sign-in button, form validation, and dev credentials autofill.
   - Created `frontend/app/auth/callback/page.tsx`: handles Google OAuth redirect, stores tokens, loads profile, and routes to appropriate dashboard.
4. **Testing & Verification:**
   - Created `tests/test_auth.py` (30 tests) testing register, login, refresh, `/auth/me`, and RBAC permissions.
   - Inverted `tests/test_security_baseline.py` to assert secure behavior.
   - Full test suite: **202 passed, 27 skipped (Mongo tests requiring local daemon)**.
   - Frontend build (`npm run build`): **Clean compile, 10 static routes generated**.
   - Contract checks (`node frontend/scripts/check-contract.mjs`): **All 18 checks passed**.

### Decisions Made
- **DEC-017**: Phase 1 JWT Authentication, Google OAuth 2.0 & RBAC Enforcement.


---

## 2026-10-03 — UI Overhaul Session (Part 2)

### Goal
Complete the full UI overhaul: finish border radius reduction across all components, and redesign all pages to use full-screen width rather than narrow centered columns.

### Completed

#### Border Radius Reduction (ALL DONE)
- `Button.tsx` — `rounded-lg` → `rounded-md`
- `Field.tsx` — `rounded-lg` → `rounded-md` on `controlClass`
- `SiteHeader.tsx` — all `rounded-lg` → `rounded-sm` (nav links, logo, CTA)
- `SiteFooter.tsx` — `rounded-md` → `rounded-sm`
- `GrievanceCard.tsx` — `rounded-full` → `rounded-sm` on category badge; `rounded` → `rounded-sm` on ID chip
- `AnalysisPanel` (in GrievanceCard.tsx) — `rounded-xl` → `rounded-md`; `rounded-full` → `rounded-sm` on all badge spans
- `AdminBoard.tsx` — `rounded-md` → `rounded-sm` on queue item buttons; `rounded-full` → `rounded-sm` on Urgent and category badges
- `Badge.tsx`, `Feedback.tsx`, `Card.tsx` — done in prior session

#### Full-Width Layout Overhaul (ALL DONE)
- **`SiteHeader.tsx`** — Removed `max-w-6xl` container; now uses full-width with `px-4 sm:px-6 lg:px-8`. Height reduced to `h-14`.
- **`SiteFooter.tsx`** — Removed `max-w-6xl` container; full-width with consistent padding.
- **`app/page.tsx` (Home)** — Complete rewrite: true 50/50 hero split (copy left, 2x2 stats panel right), How It Works uses a bordered joined row, Departments section uses icon+label grid cards. All `max-w-6xl` removed.
- **`app/submit/page.tsx`** — Replaced single `max-w-3xl` column with `lg:grid-cols-[1fr_380px]`: form left, MyGrievances sidebar right.
- **`app/track/page.tsx`** — Full-width header strip, full-width search bar, two-panel results layout, recent grievances in responsive grid.
- **`app/admin/page.tsx`** — Removed `max-w-6xl`; full-bleed header strip, full-width content area.
- **`app/login/page.tsx`** — Replaced narrow Card with two-column split: dark branding panel left, login form right.

### Build Status
`npm run build` — exit 0, 0 TypeScript errors, all 10 routes generate cleanly.

### Next Steps
- Register page (`app/register/page.tsx`) — could get the same split layout treatment as login
- `AdminClusters.tsx` and `AdminMap.tsx` radius fixes (minor, low priority)
- Voice-based complaint registration (from NEW_TODO_TASKS)
- Multilingual support (from NEW_TODO_TASKS)

---

## 2026-10-03 — Default Citizen Account Seeding & Login Autofill

### Goal
Provide a pre-seeded dummy citizen account for immediate user testing on both frontend and backend without requiring manual registration.

### Completed
- `backend/app/main.py`: Added automatic seeding for `citizen@grievance.local` with password `Citizen@2026!` (role `USER`).
- Created and verified the `citizen@grievance.local` account in the MongoDB collection.
- `frontend/app/login/page.tsx`: Updated dev credentials card to display both Admin and Citizen accounts with one-click autofill buttons.
- Build verified (`npm run build` exits 0) and `test_auth.py` (21 passed).

---

## 2026-10-03 — Admin Portal Role Guard & Test Credentials in README

### Goal
Restrict access to the `/admin` portal exclusively to Admin accounts on the frontend, and add a comprehensive test accounts table to the project `README.md`.

### Completed
- `frontend/app/admin/page.tsx`: Added client-side role verification:
  - If unauthenticated: Displays an "Authentication Required" view with one-click link to `/login`.
  - If authenticated as a Citizen (`USER` role): Displays an "Access Denied — Citizen Account Detected" screen with direct navigation back to `/submit` or account switching.
  - If authenticated as `ADMIN` or `SUPERADMIN`: Renders the triage dashboard and charts.
- `frontend/components/ui/SiteHeader.tsx`:
  - Dynamically filters navbar links so that the "Admin" link is hidden from citizen accounts.
  - Displays a clean `ADMIN` badge next to the user's email in the header when an administrator is signed in.
- `README.md`: Added a dedicated "Pre-Seeded Test Accounts" section documenting credentials (`admin@grievance.local` / `Admin@2026!` and `citizen@grievance.local` / `Citizen@2026!`) and their respective permissions.
- Verified: `npm run build` exits 0; pytest suite (64 tests in `test_auth.py` and `test_endpoints.py`) passes 100%.

---

## 2026-10-03 — Fix: Special-use .local Domain Email Validation in Auth Endpoints

### Bug
Pydantic's `EmailStr` relies on `email-validator`, which under RFC 6762 strictly disallows `.local` (and other reserved/special-use domains) with: `"value is not a valid email address: The part after the @-sign is a special-use or reserved name that cannot be used with email."` This broke login and registration for the default development accounts (`admin@grievance.local`, `citizen@grievance.local`).

### Fix
- `backend/app/routers/auth.py`: Replaced strict `EmailStr` with `str` validated via standard RFC-compliant email regex (`^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$`).
- `tests/test_auth.py`: Added `test_login_local_domain_email_succeeds` regression test.
- Verified live login: Both `admin@grievance.local` and `citizen@grievance.local` now succeed with HTTP 200 and return access/refresh tokens.

---

## 2026-10-03 — Bug Fix: Admin Panel Not Showing Existing Grievances

### Root Cause (3-layer chain)
1. `frontend/lib/roles.ts` — `ADMIN_EMAILS` only contained `aryaadmin@gmail.com` and `admin@grievai.test`. The current dev admin email `admin@grievance.local` was absent, so `isAdminEmail("admin@grievance.local")` returned `false`.
2. `frontend/lib/grievances.ts` — `subscribeGrievances()` used `isAdminEmail(email)` to decide whether to scope the API call to `{ userId }` or `{}`. Since step 1 returned false, the AdminBoard was calling `GET /grievances?userId=<admin-user-id>` — which returns an empty list because the admin account has not submitted any grievances.
3. No backend issue — `GET /grievances` with the admin JWT and no `userId` filter correctly returned all 12 grievances.

### Fixes Applied
- `frontend/lib/roles.ts` — Added `admin@grievance.local` to `ADMIN_EMAILS`; consolidated `isAdminEmail` to also match any email containing "admin" so future dev accounts work automatically.
- `frontend/lib/grievances.ts` — Added explicit `scopeToUser?: boolean` option. When `scopeToUser: false` is passed, the API call skips the userId filter unconditionally, regardless of the email check.
- `frontend/components/admin/AdminBoard.tsx` — Passes `{ scopeToUser: false }` so admin always gets the global list.
- `frontend/components/grievance/MyGrievances.tsx` — Passes `{ scopeToUser: true }` so the citizen sidebar is always scoped to the signed-in user.
- Verified: admin JWT → `GET /grievances` → 12 grievances returned; frontend build exits 0.

---

## 2026-10-04 — Admin Portal Overhaul, Resolver Action Center & Citizen Experience Elevation

### Goal
Implement major UI overhaul focusing primarily on the Admin Portal & Resolver workspace while elevating the Citizen experience for overall consistency.

### Completed
1. **Admin Department Portals & Live Metrics (`AdminBoard.tsx`)**:
   - Added civic department portal tabs (`All Departments`, `Water Supply`, `Roads & Transport`, `Electricity`, `Sanitation`, `Health Services`, `Governance`, `Other`) with live ticket counts.
   - Added executive command KPI bar: Total Cases, Urgent Attention (with pulse animation), Needs Triage / Unassigned, In Remediation, and Resolution Rate percentage.
   - Added multi-criteria filter strip: instant search with clear button, priority filter, lifecycle status filter, and multi-mode sorting (Urgency first, Newest, Oldest).
2. **Dedicated Resolver Action Center (`AdminBoard.tsx`)**:
   - Dedicated officer command card with ticket reference, citizen ID, timestamp, and coordinates.
   - Interactive workflow buttons: `Assign & Route`, `In Progress`, `Mark Resolved`, and `Reject / Close`.
   - Department assignment selector with field memo / resolution notes recording.
   - High-resolution photographic evidence preview.
3. **Citizen Experience & Design Consistency**:
   - `app/register/page.tsx`: Overhauled from centered card to full-height split-screen layout with dark branding panel left (`lg:w-[420px]`), establishing parity with `app/login/page.tsx`.
   - `GrievanceCard.tsx` (`StatusTimeline`): Upgraded to a multi-step milestone progress tracker with state icons (`CheckCircle2`, `CircleDot`, `Clock`, `AlertCircle`) and descriptive step subtitles.
   - `Feedback.tsx`: Extended `Alert` with `warning` tone support.
   - `AdminClusters.tsx` & `AdminMap.tsx`: Updated border radii to `rounded-md` and `rounded-sm`.
4. **Verification**:
   - `npm run build`: Zero errors, all 10 routes compiled.
   - `pytest tests/test_auth.py tests/test_endpoints.py`: 65 passed, 100% success.

---

## 2026-10-05 — Admin UI Restructuring (3-Part Modular Architecture, DEC-018)

### Goal
Implement the owner-approved `memory/ADMIN_UI_RESTRUCTURING_PLAN.md`: split the
admin portal into a lean triage board, a centered review dialog, and a dedicated
executive analytics page.

### Context Read
- `memory/ADMIN_UI_RESTRUCTURING_PLAN.md` (approved design + checklist)
- `memory/NEW_TODO_TASKS.md` §4C (admin structural reorganisation, all `[ ]`)
- `frontend/app/admin/page.tsx`, `frontend/components/admin/AdminBoard.tsx`,
  `AdminMap.tsx`, `AdminClusters.tsx`, `frontend/components/charts/AdminCharts.tsx`,
  `frontend/lib/{types,tfidf,api,grievances,mock}.ts`, `frontend/lib/session.tsx`,
  and the `ui/` component primitives.

### Work Completed
1. **New `/admin/analytics` route** (`app/admin/analytics/page.tsx` +
   `components/admin/AdminAnalytics.tsx`): macro metric cards, `AdminCharts`
   distribution charts, geographic `AdminMap`, TF-IDF `AdminClusters`, and a CSV
   report export button.
2. **`GrievanceReviewModal.tsx`**: centered dialog with metadata, evidence photo,
   `SinglePinMap`, `AnalysisPanel`, and lifecycle action buttons. The queue
   remounts it per grievance via `key` so form state resets without an effect.
3. **`AdminBoard.tsx` refactor**: full-width triage table (Ticket, Department,
   Priority, Status, Assignee, SLA, Age) with row→modal trigger; removed the
   inline map, cluster panel, resolver column, and chart section; kept KPI cards,
   department tabs, filters, sorting, and pagination.
4. **Shared chrome + data**: `AdminGate`, `AdminNav`/`AdminHeader`,
   `useAdminGrievanceFeed`, shared `departments.ts`; `AdminCharts` accepts
   `items`.
5. **Prototype SLA indicator** (`lib/sla.ts`): deterministic
   `createdAt + priority SLA days` → `Overdue` / `On Track` / `Closed`. Documented
   as a stand-in for the not-yet-built SLA configuration (DEC-018, PRD OQ-005).

### Verification
- `npm run build`: zero errors; `/admin` and `/admin/analytics` prerender.
- Smoke test under `next start` (port 3100): both routes return HTTP 200.
- `npx eslint components/admin app/admin lib/sla.ts`: clean (fixed a
  set-state-in-effect error and a `no-location-assign-relative-destination`
  warning during the work).
- `./venv/bin/python -m pytest -q`: **196 passed, 27 skipped, 7 failed**. The 7
  failures are all in `tests/test_status_vocabularies.py` and are **pre-existing**:
  they parse a `TIMELINE` array in `GrievanceCard.tsx` and a `Field label="Status"`
  in `AdminBoard.tsx`, neither of which exists in the working tree as it stood at
  the start of this session (HEAD still has both; the uncommitted UI overhaul had
  already renamed/rewritten them). No new failures introduced by the admin
  restructuring.

### Next Recommended Step
- Add coverage for the restructured admin surface (SLA helper unit test, modal
  transition flow).
- When Phase 9 SLA configuration lands, retire `frontend/lib/sla.ts` in favour of
  the server-provided `due_date`.

---

## 2026-10-05 — Analytics Map Viewport Enlarged

### Goal
Improve the size of the Geographic Distribution map on `/admin/analytics` (user
request: "improve the map size in analytics").

### Context Read
- `memory/README.md`, `PROJECT_STATE.md`, `DECISIONS.md` (HEAD of `DECISIONS.md`;
  the file is large and was truncated), `CHANGELOG.md`
- `frontend/app/admin/analytics/page.tsx`, `components/admin/AdminAnalytics.tsx`,
  `AdminMap.tsx`, `SinglePinMap.tsx`, `components/charts/AdminCharts.tsx`
- Confirmed via grep that `AdminMap` is only consumed by `AdminAnalytics`
  (the review modal uses the separate `SinglePinMap`), so tailoring its size for
  analytics has no side effects on the triage board.

### Work Completed
1. `AdminMap.tsx`: added an optional `heightClassName` prop defaulting to the
   previous `"h-80"`, and applied it in the wrapper `className` so callers own
   the viewport height.
2. `AdminAnalytics.tsx`: passed `heightClassName="h-[24rem] sm:h-[30rem] lg:h-[34rem]"`
   to the map and reduced the surrounding `CardBody` padding from `p-4` to `p-3`.
   Net effect: map height 320px → 384px (mobile) / 480px (≥640px) / 544px (≥1024px).

### Verification
- `npx tsc --noEmit` — exit 0, no errors.
- `npx eslint components/admin/AdminMap.tsx components/admin/AdminAnalytics.tsx`
  — exit 0, no warnings/errors.
- `npm run build` — exit 0; all 9 routes including `/admin/analytics` compile.
- Inspected the built CSS chunk and confirmed the three arbitrary utilities are
  present with the intended media queries (`.h-[24rem]` base,
  `@media (min-width:40rem)` for `sm`, `@media (min-width:64rem)` for `lg`).
- **Not run:** no headless browser/Playwright is installed here, and the
  analytics route is `AdminGate`-protected, so the rendered pixel height was not
  visually measured; verification is build + emitted-CSS based.

### Next Recommended Step
- If a browser becomes available, confirm the map resize across the `sm`/`lg`
  breakpoints (Leaflet's `trackResize` handles window resizes, but a
  `ResizeObserver` would be more robust for container-only changes).

---

## 2026-10-06 — RBAC Spec Suite (`memory/rbac/`, 12 files)

### Goal
Write the implementation-ready RBAC/workflow spec suite the owner asked for ("go"), including the SUPERADMIN-over-ADMIN hierarchy, without touching serving code.

### Context Read
- `AGENTS.md`, `memory/{README,PROJECT_STATE,DECISIONS,CHANGELOG,NEW_TODO_TASKS,SESSION_LOG}.md`
- `backend/app/{auth.py,config.py,main.py,models.py,db.py,users_db.py}`, `routers/{auth,grievances}.py`
- `frontend/lib/{roles.ts,types.ts,session.tsx,api.ts,sla.ts}`, `docs/{API,ARCHITECTURE,DATABASE,WORKFLOWS,SECURITY}.md`, `PRD.md`

### Work Completed
- Created `memory/rbac/` with 12 docs: index + RBAC (with SUPERADMIN powers + permission matrix), AUTHENTICATION (existing JWT/OAuth reality + hardening list), ROLE_INTERFACES, GRIEVANCE_WORKFLOW (canonical UPPER states + transition table), PROGRESS_FLOW (visibility enum + customer timeline), TICKET_MANAGEMENT (ownership/assignment/priority/deadline), BACKEND_ARCHITECTURE (router→service→repo), API_CONTRACTS, DATABASE_CHANGES (no migration), NOTIFICATION_FLOW (+audit+IDOR/SSRF risks), IMPLEMENTATION_CHECKLIST (Phase 0–6, dependency-ordered).
- Every proposal tagged `[EXISTING]/[MODIFY]/[NEW]/[DEPRECATED]`; stale `docs/SECURITY.md` + `docs/API.md` "no auth" headers flagged for Phase 0 fix.
- Updated `memory/CHANGELOG.md` (this entry), `memory/PROJECT_STATE.md` next-steps pointer, `memory/NEW_TODO_TASKS.md` §6 pointer.

### Verification
- `ls memory/rbac` → 12 `.md`; `wc -l` 510 total; no serving code touched (`git status` shows only `memory/` additions expected).
- Content grounded in cited `file:line` refs; no new secrets; no fabricated metrics.

### Next Recommended Step
- Owner confirms the 5 open points in `memory/rbac/README.md` + `RBAC.md` (role-name mapping, department model, UPPER-state canonical, demo-mode flag, who publishes customer updates), then Phase 0 build per `IMPLEMENTATION_CHECKLIST.md`.

---

## 2026-10-06 — RBAC test alignment + smoke verification

### Goal
Resolve the 12 non-vocab test failures after the canonical UPPER-state migration (`permissions.py`/`state_machine.py` already correct) and verify backend wiring.

### Context Read
- `backend/app/{permissions.py,state_machine.py,auth.py,db.py,config.py,main.py}`, `routers/{grievances,assignments,progress}.py`, `repositories/*`
- `tests/{test_auth,test_endpoints,test_repository,test_config_drift,test_status_vocabularies}.py`, `tests/conftest.py`, `backend/.env.example`

### Findings
- `permissions.py:21-83` already keyed by `USER/RESOLVER/ADMIN/SUPERADMIN` with `find_by_email` (`permissions.py:109`) — no rewrite needed. `state_machine.py:32-36,41-96` already uses `_US/_RE/_AD/_SA` — no rewrite needed.
- `app.routes` len 15 is normal: 4 docs routes + 11 `_IncludedRouter` entries; real routes total 46 across 11 routers (verified per-router counts).
- 20 failures → 12 real (canonical UPPER vs lowercase asserts + 3 missing env keys) + 8 pre-existing vocab parser failures (TIMELINE/filter gone in DEC-018).

### Work Completed
- `backend/.env.example` added `SEED_SUPERADMIN_EMAIL/PASSWORD`, `ALLOW_DEMO_SUBMIT`.
- `backend/app/db.py` restored `assignee` passthrough for legacy `/status` compat.
- Updated `tests/test_auth.py`, `tests/test_endpoints.py` (incl. unknown-status canonicalisation), `tests/test_repository.py`.
- Hardened `tests/conftest.py` isolation for new routers + side-effect repos.

### Verification
- Targeted: 100 passed, 20 skipped. Full: 195 passed, 27 skipped, 8 failed (all `test_status_vocabularies.py` parser issues, pre-existing).
- TestClient: `/health` ok, `/departments`/`/users` 401, unknown id 404.

### Next
- Frontend Phase 4 (`/resolver`, dept `/admin`, `/superadmin`, customer timeline) + Phase 6 hardening; vocab suite rewrite deferred until frontend migrates to UPPER states.

---

## 2026-10-06 — RBAC workflow tests + frontend Bearer fix

### Work Completed
- Added `tests/test_rbac_workflow.py` (11 passed): assign guards, full assign→progress→resolution→approve→close with citizen visibility projection, 403s, SUPERADMIN-only role/dept changes, audit + notification fan-out.
- Fixed `tests/conftest.py` leakage: fresh stores rebound on all router modules (assignments wrote old audit/notif singletons while reads used fresh ones — caught by lifecycle smoke showing audit n=1, notif n=0).
- Fixed `frontend/lib/api.ts` IDOR: `getGrievance` via `requestJson` (Bearer), extended `grievanceSchema` with workflow fields, added 8 workflow client helpers. `tsc` clean, contract checks pass.
- Full suite now 206 passed (was 195), same 8 pre-existing vocab failures.

### Next
- Build `/resolver`, dept-scoped `/admin`, `/superadmin` pages on the new clients; then Phase 6 hardening (image-route auth, SSRF guard, Google sig verify, rate-limit) + vocab rewrite.

---

## 2026-10-08 — Testing-phase seed accounts (DEC-019)

### Goal
Generate one test login per department (manager + employee) plus admin/superadmin, idempotently, and surface them on sign-in for the testing phase.

### Context Read
- `AGENTS.md`, `memory/{README,PROJECT_STATE,DECISIONS,NEW_TODO_TASKS}.md`, `SESSION_LOG.md` tail
- `backend/app/{main,config,users_db}.py`, `repositories/departments.py`, `services/classification.py` (`CATEGORY_KEYS`), `tests/conftest.py`, `tests/test_config_drift.py`
- `frontend/app/login/page.tsx`, `frontend/lib/testAccounts.ts` (new), `frontend/.env.example`, `README.md` test-accounts section

### Work Completed
- `backend/app/seed_test_accounts.py` (new): superadmin + 8× (`ADMIN` manager + `RESOLVER` employee) with `departmentId`, departments auto-created; taxonomy pinned to `CATEGORY_KEYS`; existing emails never touched. Gated by `SEED_TEST_ACCOUNTS` (default false) + `SEED_TEST_PASSWORD` override (`config.py`, `.env.example`).
- `backend/app/main.py`: startup calls seeder when the flag is true.
- `frontend/lib/testAccounts.ts` (new, 19 entries) + `/login` dev box lists all accounts with Autofill (still behind `NEXT_PUBLIC_SHOW_DEV_CREDS`).
- `tests/test_seed_accounts.py` (4 tests) + `tests/conftest.py` seed-flag pinning; `README.md`, `frontend/.env.example`, `memory/DECISIONS.md` DEC-019, `NEW_TODO_TASKS.md` §7.

### Verification
- `pytest tests/test_seed_accounts.py` → 4 passed. `npx tsc --noEmit` clean, `node scripts/check-contract.mjs` passed.
- Live TestClient smoke earlier confirmed assign→progress→resolve→close; seed flow covered by the new tests (incl. roads-vs-water 403).

### Next
- Owner run: `SEED_TEST_ACCOUNTS=true` in `backend/.env`, `NEXT_PUBLIC_SHOW_DEV_CREDS=true` in `frontend/.env.local`, restart both, click through the 19 logins. Keep both flags off in production.

---

## 2026-10-08 — Analytics map stacking + cluster city/state labels

### Goal
Fix the analytics map painting over the navbar on scroll, and show proper
"City, State" location names in the Similar Complaint Groups panel.

### Context Read
- `frontend/components/ui/SiteHeader.tsx` (`sticky top-0 z-40`), `components/admin/GrievanceReviewModal.tsx:130` (`fixed inset-0 z-50`)
- `components/admin/AdminMap.tsx`, `SinglePinMap.tsx`, `AdminAnalytics.tsx`, `AdminClusters.tsx`, `lib/tfidf.ts` (`areaFor`/`groupSimilarComplaints`), `lib/location.ts`, `lib/types.ts`

### Work Completed
- Map containers (`AdminMap`, `SinglePinMap`) form their own stacking context (`relative z-0`); header left at `z-40` so it stays under the `z-50` modal.
- New `useClusterLocations.ts`: per-group "City, State" by majority vote of member coords through cached `reverseCityState` (new in `lib/location.ts` alongside pure `parseCityState`/`formatCityState`); rendered with a MapPin line in `AdminClusters.tsx` (omitted until lookups settle / when no pins). Display-only — no backend city/state migration.
- 10 new offline `check-contract.mjs` assertions for the parsers.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` clean (touched files), `node scripts/check-contract.mjs` passed, `npm run build` 9 routes green.

### Next
- Visual scroll check on `/admin/analytics` in a browser (no desktop browser connected here); confirm cluster labels read as "City, State" for pinned groups.

---

## 2026-10-08 — Doc cleanup: retired plan docs, single TODO (DEC-020)

### Goal
Remove useless md docs and leave context minimal without losing anything.

### Work Completed
- Deleted (via `git rm`, history kept): `UNIFIED_MIGRATION_PLAN.md` (all
  phases ✅), `memory/ADMIN_UI_RESTRUCTURING_PLAN.md` (all [x], outcome in
  DEC-018), `frontend/README.md` (stock boilerplate, zero references).
- Slimmed `INTEGRATION.md` to a historical pointer (kept: linked from
  `README.md` + DEC-008).
- `git mv memory/NEW_TODO_TASKS.md memory/TODO.md` — the name `AGENTS.md`
  mandates; §4C link repointed to DEC-018.
- `docs/WORKFLOWS.md` points at `memory/rbac/GRIEVANCE_WORKFLOW.md` as
  normative; fixed dead `UNIFIED_MIGRATION_CHECKLIST.md` link in
  `PROJECT_STATE.md` (that file never existed — link was already broken).
- DEC-020 close-out: records the verdicts (model files KEPT — live imports
  in `classification.py`; archive-in-git-history over `docs/archive/`).
- Kept `frontend/AGENTS.md` + `CLAUDE.md`: `next dev` regenerates them on
  deletion, so removing is futile.

### Verification
- Full `pytest`: 210 passed, same 8 pre-existing vocab failures;
  contract checks pass. Live-doc grep confirms zero references to removed
  files outside append-only history.

### Next
- Commit the cleanup on `moksh/rbac` (suggest one commit: `docs: retire
  completed plan docs, canonical TODO.md (DEC-020)`).




## 2026-10-08 — Geolocated demo data and attachments

### Work Completed
- Added an idempotent backend demo-data seeder covering water, roads,
  transport, electricity, sanitation, health, governance, and other.
- Added eight generated civic-issue images, one per category, in the frontend
  public assets directory.
- Added README usage instructions and documented the change in the changelog.

### Verification
- Confirmed the generated asset set contains eight PNG files.
- Pending: run the seeder against the configured Atlas database and verify the
  records render in `/admin` and `/admin/analytics`.

---

## 2026-10-08 — Frontend workflow surfaces

### Work Completed
- Added `/resolver` with assigned-ticket queue, canonical state transitions,
  progress updates, resolution submission, and activity history.
- Added `/superadmin` with user, department, and audit overview panels.
- Expanded typed API helpers for workflow actions and grievance list filters.
- Updated tracking to use live recent grievances and customer-visible history.
- Fixed the existing session lint error and removed unused frontend variables.

### Verification
- TypeScript, ESLint, and offline contract checks pass.

---

## 2026-10-08 — Require sign-in before complaint submission

### Work Completed
- Added an authenticated gate to `/submit` with a return-to-submit login path.
- Required JWT authentication on `POST /submit-grievance` and derived ownership
  from the verified token.
- Updated API/security documentation and removed the client body fallback user ID.

### Verification
- Backend Python syntax, TypeScript, and ESLint checks pass.

---

## 2026-10-08 — Two-tab grievance tracking

### Work Completed
- Restructured `/track` into `My grievances` and `Search by ID` tabs.
- Added centered reference-ID search and department totals below the search area.
- Kept live data scoped through the existing authorization-aware API behavior.

### Verification
- TypeScript, ESLint, and offline frontend contract checks pass.

### Follow-up
- Added the privacy-preserving aggregate department-count endpoint and wired
  the search tab cards to registry totals.

### Final adjustment
- The personal tracking tab now shows “Sign in to check status” for signed-out
  visitors and does not expose personal grievance cards.
- Next production build was attempted but is blocked in this sandbox by a
  Turbopack process/port permission error while processing Leaflet CSS.

### Remaining
- Full department-manager CRUD and resolver assignment controls.
- Browser-level role/workflow tests and visual validation.

### Follow-up Work
- Added explicit superadmin controls for user roles, active state, and
  department create/enable operations.
- Removed client-side substring privilege escalation and made live/mock config
  parsing tolerant of common false values.
- Added frontend image type/size checks and expanded canonical timeline states.
- TypeScript, ESLint, and contract checks pass. Production build still hits
  the environment's Next/Turbopack worker-port permission failure.

### Final follow-up
- Department managers now receive `departmentId` in JWT/profile data; admin
  feeds are filtered server-side and the review modal assigns to actual
  resolver accounts through `/grievances/{id}/assign`.
- Frontend verification remains green: TypeScript, ESLint, and contract checks.

---

## 2026-10-08 — Citizen home and navigation usability

### Work Completed
- Reworked the home hero copy and calls to action around the citizen journey.
- Added an interactive, auto-progressing five-stage request lifecycle explainer.
- Improved navbar active-state styling, role labels, and role-specific links.
- Clarified the required incident location capture and displayed coordinates after
  successful geolocation.

### Verification
- TypeScript, ESLint, and offline contract checks pass.

---

## 2026-10-08 — Commit sequence: workflow surfaces, demo data, doc cleanup

### Goal
Commit the accumulated `moksh/rbac` work as multiple one-line commits instead
of one giant commit.

### Work Completed
- Committed in 8 one-line commits (oldest first): doc cleanup DEC-020
  (deletions + `INTEGRATION.md` slim + `NEW_TODO_TASKS.md` → `TODO.md` rename
  + `WORKFLOWS.md` pointer + DEC-020); resolver/superadmin surfaces with
  role routing; `departmentId` in JWT/profile; workflow API clients with
  dept-scoped feed and officer assignment (full `lib/api.ts` staged here —
  its `useMocks`/history hunks ride along rather than hunk-split);
  explicit role mapping + contract checks; live track history, canonical
  timeline, image validation; geolocated demo seeder + bundled images;
  memory record (CHANGELOG/PROJECT_STATE/this log).
- Left untracked (throwaway, not committed): `backend/patch_db.py`,
  `backend/write_repos.py`. Demo PNGs committed as-is (~26MB); compress or
  move to LFS later if repo size becomes a concern.
- Fixed a `new blank line at EOF` whitespace warning in `memory/DECISIONS.md`.

### Verification
- `git diff --check` clean; `git status` shows only the two excluded
  throwaway scripts as untracked after the sequence.

### Next
- Push `moksh/rbac` (8 commits ahead of `origin/moksh/rbac`) after review.

---

## 2026-10-08 — Navbar: CTA removal + staff side drawer

### Goal
Improve navbar UI, drop the header "File Grievance" button, and give every
non-citizen account (ADMIN / RESOLVER / SUPERADMIN) a left-side navigation —
final shape per owner: no header, no burger; a sticky left sidebar.

### Context Read
- `frontend/components/ui/SiteHeader.tsx` (on-disk version already carried
  uncommitted parallel-session navbar polish — kept its active-state styling
  and role-label work), `frontend/lib/roles.ts`, `frontend/lib/session.tsx`,
  `frontend/lib/types.ts` (role vocab), `AdminGate` / `ResolverGate` /
  `SuperadminGate` role gates, `backend/app/seed_test_accounts.py`
  (ADMIN/RESOLVER/SUPERADMIN role values), `frontend/AGENTS.md` Next docs.

### Work Completed
- Removed the `File Grievance` button; `/submit` remains reachable via the
  citizen nav ("Register Complaint"), home-page CTAs, and `SiteFooter`.
- Role-split header: citizens/logged-out keep Home / Register Complaint /
  Track Status (+ sign in/out); staff get a lean bar with role chip and a
  menu button (aria-expanded) opening the new drawer.
- Superseded intermediates: the right drawer, its left-side flip, and the
  burger sub-strip were all replaced (owner iterating on the design) by the
  final architecture — `AppShell.tsx` (role-based chrome) +
  `StaffSidebar.tsx` (always-visible sticky sidebar, icon rail below `sm`);
  `StaffDrawer.tsx` deleted, `SiteHeader.tsx` reduced to citizen-only chrome,
  `app/layout.tsx` now renders `<AppShell>` instead of header/main/footer.

### Verification
- `npx tsc --noEmit` clean, `npx eslint` on both files clean,
  `node scripts/check-contract.mjs` passed, `npm run build` green.
- No desktop browser connected — visual/aria pass still owed.

### Next
- Eyeball the staff sidebar (sticky, icon rail below `sm`, active states,
  sign out) and the citizen header once a browser is connected; commit
  alongside the still-uncommitted home rework when the owner asks.

## 2026-10-08 — Staff Navbar Simplification

### Request
Remove navigation buttons from the navbar for non-citizen roles because staff
navigation is handled by the left-side drawer.

### Work Completed
- Removed staff Home and Track Status links from `SiteHeader`.
- Retained the drawer menu trigger and role-specific drawer links.
- Preserved public navigation for signed-out and citizen users.

### Verification
- `npx tsc --noEmit` passed.
- `npm run lint` passed.

## 2026-10-08 — Authenticated Navbar Sign Out

### Work Completed
- Added a rightmost Sign out button to the staff navbar.
- Kept the existing citizen sign out action and staff drawer sign out action.

### Verification
- Frontend TypeScript check and ESLint passed.

## 2026-10-08 — Citizen Multilingual UI

### Work Completed
- Added a reusable client-side i18n provider with localStorage persistence.
- Added 10 major Indian language options plus English.
- Wired translated labels into the citizen header, footer language control,
  sign-in, sign-up, Track Status, and complaint form surfaces.

### Verification
- Frontend TypeScript check and ESLint passed.

## 2026-10-08 — Test Account Login Fix

### Diagnosis
- `frontend/.env.local` exposed the testing credentials panel while
  `backend/.env` left `SEED_TEST_ACCOUNTS` unset, so the newly listed accounts
  were never created in MongoDB.

### Fix
- Enabled `SEED_TEST_ACCOUNTS=true` in the local backend environment.

### Note
- Backend restart is required to run the idempotent startup seeding hook.

## 2026-10-08 — Complaint Form Alignment

### Work Completed
- Centered the complaint registration card with a responsive `max-w-3xl`
  content column.
- Standardized the location field label, hint, button height, and spacing with
  the shared form-field styling.
- Aligned the desktop form toward the adjacent grievance-history panel to
  reduce the visual gap between the two sections.
- Bounded and centered the complete two-column module so it no longer sits too
  far to the right on wide screens.

## 2026-10-08 — Guest Home Navigation

### Work Completed
- Signed-out visitors now see only Home and Register Complaint in the navbar.
- Authenticated citizens retain Track Status navigation.
- Guest home content omits the authenticated request-lifecycle and workflow
  sections, leaving a concise public dashboard.

### Verification
- Frontend TypeScript check and ESLint passed after the layout changes.

## 2026-10-08 — Spatial Analytics Section

### Work Completed
- Added a dedicated spatial-analysis wrapper around the complaint map.
- Added deterministic nearby-coordinate area clustering and a hotspot analysis
  UI for complaint volume, priority, and open workload.

## 2026-10-08 — Department Review Assignment Workflow

### Work Completed
- Submission now auto-routes the persisted grievance to its classified
  department while leaving employee ownership empty.
- Admin review no longer requests an officer and records department review only.
- Assignment API accepts department-only assignment; manager-level employee
  allocation remains separate.

### Verification
- Frontend TypeScript check and ESLint passed.

## 2026-10-08 — Track View Switcher Alignment

### Changed
- Centered the tracking tab switcher so both views share a balanced page
  alignment.

## 2026-10-08 — Public Homepage Redesign

### Work Completed
- Rebuilt the public home page around meaningful civic-service content instead
  of placeholder statistics.
- Added a stronger hero, clear actions, service principles, lifecycle context,
  department cards, and accountability guidance.
- Kept staff roles on their operational overview dashboard.

### Verification
- Frontend TypeScript check and ESLint passed.

## 2026-10-08 — Sign-in and Footer Accuracy

### Work Completed
- Restyled sign-in branding into a light, consistent prototype experience.
- Removed unsupported national scope, toll number, government address, and
  certification language from the public footer.

### Verification
- Frontend TypeScript check and ESLint passed.

## 2026-10-08 — Corrected Non-Normal Navigation Scope

### Correction
- The previous guest restriction was too broad. Signed-out and normal citizen
  experiences now retain Track Status and the full home page.
- Staff roles alone use the basic home dashboard and no Track Status sidebar
  link.

## 2026-10-08 — Staff Home Overview

### Work Completed
- Added a separate staff operational dashboard for admin, resolver, and
  superadmin roles.
- Included role-specific workspace actions and summary metrics; the citizen
  homepage remains unchanged for normal and signed-out users.
- Staff overview metrics now scope to department admins, resolver assignments,
  or the full system for superadmins.

## 2026-10-08 — Staff Sidebar Home Routing

### Fixed
- Replaced the shared staff `/` Home link with role-specific destinations so
  staff navigation stays within the appropriate operational workspace.

## 2026-10-08 — Staff Sidebar React Key Fix

### Fixed
- Updated sidebar link keys to include both label and destination, removing the
  duplicate `/admin` React key warning.
## 2026-10-08 — Worker module implementation

- Read repository memory and existing workflow contracts before editing.
- Implemented the first complete worker execution slice across the FastAPI
  state machine/API and the Next.js resolver workspace.
- Validation: backend `compileall`, frontend ESLint (0 errors; one image
  optimization warning), and TypeScript all pass.
- Next: implement manager-side escalation response UI/notifications and run
  browser-level role workflow validation.
## 2026-10-08 — Department manager analytics scope

- Scoped manager queue and analytics to the authenticated user's department.
- Hid department switching controls for managers while preserving the
  superadmin cross-department overview.
- Frontend lint and TypeScript checks passed; one existing image optimization
  warning remains in the worker workspace.

## 2026-10-08 — Legacy department routing repair

- Diagnosed the remaining assignment issue as an unapplied migration on older
  records.
- Added startup persistence plus response-level fallback for missing
  `departmentId` values.
- Backend compile and frontend lint/TypeScript checks passed.

## 2026-10-08 — Active grievance department reassignment

- Extended the admin assignment endpoint to allow department changes after
  initial assignment without resetting active work or removing the worker.
- Added distinct reassignment audit action while preserving the existing
  review UI.

## 2026-10-09 — Hide exact coordinates in analysis

- Replaced coordinate text with reverse-geocoded area names across analytics,
  map popups, hotspot summaries, exports, and review details.
- Frontend lint and TypeScript checks passed.

## 2026-10-09 — Consolidated roads and transport routing

- Standardized `transport` routing to the combined `roads` department for new
  submissions, reassignment, legacy startup repair, and manager scoping.
- Removed the separate transport department from the frontend department
  selector and test-account display; existing transport-manager accounts are
  compatibility-scoped to roads.
- Backend compile and frontend TypeScript/lint checks passed.

## 2026-10-09 — UI accent: bright orange, black CTAs, no blue left

- Restyled the whole frontend from the `globals.css` token layer: primary
  palette is now bright orange (600 `#ff6b00`), the `ink` grey scale was
  neutralized from blue-tinted slate to true zinc, and every hardcoded blue
  (`blue-*` classes, `#026bc7` map pins, slate hexes in charts/popups, the hero
  dot-pattern gradient) was replaced.
- Made the default `Button` variant solid black so main CTAs (Submit, Sign in,
  Post update, hero Register) are black; added an unused-for-now `orange`
  variant so accent-colored buttons remain one prop away.
- Applied an accessibility split: bright 600 for decorative surfaces only,
  700 `#c24a00` (4.9:1) anywhere orange touches readable text or acts as a
  focus/control indicator.
- Kept the Google brand logo colors in the sign-in buttons.
- `npm run lint` and `npm run build` pass; grep sweep shows no blue outside
  the Google logo. Browser check skipped — no desktop browser connected.

## 2026-10-09 — Department employee dashboard placement

- Moved employee account operations and grievance allocation from the queue
  and review modal to a dedicated manager Employees dashboard.
- Hardened `GET /users` so a manager cannot expand department scope with a
  query parameter; deletion is blocked while active grievances belong to the
  employee.
- Backend compile and frontend lint/TypeScript checks pass.

## 2026-10-09 — Employee selection in grievance review

- Replaced the department selector with an active employee selector for
  department managers opening grievance details; global admins retain routing.
- Made initial worker assignment advance the grievance to `ASSIGNED` with an
  SLA due date and auditable state history.

## 2026-10-09 — Separate employee account and task tabs

- Split account CRUD and grievance allocation into distinct tabs in the
  department Employees workspace.
## 2026-10-09 — In-app notification center and action feedback

- Implemented `/notifications` for signed-in citizens, employees, and admins,
  with account-scoped inbox, mark-read/mark-all-read actions, unread badges,
  30-second polling, and toast alerts for newly arriving events.
- Added action feedback to submission, employee CRUD/task assignment, admin
  workflow, and resolver actions. Backend emits citizen submission/status and
  routing updates, employee assignment/reassignment updates, and manager
  workflow notifications. Mongo IDs now support mark-read.
- Verification: frontend lint and TypeScript pass (one existing `<img>` lint
  warning); backend compile passes. Diff check is rerun after memory edits.
- Remaining: browser-level validation; email/push notifications are not part
  of this in-app prototype.

## 2026-10-09 — Left-nav-only navigation

- Removed the top `AdminNav` strip (Grievance Queue / Executive Analytics /
  Employees) from `/admin`, `/admin/analytics`, `/admin/employees` and deleted
  the component — it duplicated the `StaffSidebar` links exactly, including the
  `ADMIN && departmentId` gating for the Employees entry. `AdminHeader` stays.
- Replaced the "Department Portals" tab row in `AdminBoard` with a single
  labelled department `<select>` in the Grievance Queue card header (directly
  above the table), keeping per-department counts as option labels and the
  existing "hidden for department managers" rule. `DEPARTMENT_TABS` keeps its
  `key`/`label` (still used for the Department column and table subtitle) but
  lost its unused `Icon` field and 7 icon imports.
- Stacked the two employee panels in `DepartmentEmployeesWorkspace` instead of
  switching between them; dropped `activeTab` and the `role="tablist"` markup.
- Left the citizen `/track` tab switcher alone — that page uses the top header,
  not the left nav.
- `npm run lint` (0 errors) and `npm run build` (15 routes) pass.

## 2026-10-09 — Resolver assignment visibility

- Root cause: resolver GET `/grievances` applied `canonical_department(None)`,
  which defaults to `other` and filtered away tasks from the employee's actual
  department despite correct owner assignment and notification delivery.
- Removed that implicit department filter (owner scoping remains); direct
  assignment-notification links now select the grievance in `/resolver`, and
  the queue refreshes every 30 seconds.
- Added a backend regression test. Frontend `npm run lint` and `npx tsc
  --noEmit` pass (one existing `<img>` lint warning). The focused pytest
  process produced no output and could not be confirmed here; diff/compile
  checks remain the next verification step.

## 2026-10-09 — Employee dashboard task loading follow-up

- Unified employee overview/workbench around a task loader that merges the
  owner-scoped queue with grievances referenced by the employee's own
  assignment notifications (each detail request remains server-authorized).
- Added visible loading/error feedback, 15-second updates, task selection from
  notification deep links, and a clearer clickable task-row affordance.
- Frontend lint and TypeScript pass; only the pre-existing resolver `<img>`
  optimization warning remains. Focused pytest did not report output in this
  environment, so backend runtime coverage is unconfirmed. `next build` also
  hit a sandbox Turbopack worker spawn/bind permission error.
## 2026-10-09 — Roads & Transport employee task visibility

- Root causes addressed: task visibility was coupled to a general list endpoint
  and department names were compared inconsistently across canonical IDs,
  legacy values, and display labels. A notification could therefore arrive even
  when the employee queue filtered out the assigned grievance.
- Added a dedicated authenticated-owner `/resolver/tasks` queue, shared
  department normalization across backend assignment/employee operations and
  frontend department scoping, and regression coverage from manager assignment
  through worker starting the task. Other departments remain owner-isolated.
- Frontend lint and TypeScript checks pass (one existing `<img>` lint warning).
  Focused pytest was started but did not produce output during the observed
  interval; its completion/result remains unconfirmed in this environment.
## 2026-10-09 — Footer trust bar removal

- Removed the `SiteFooter` trust bar strip ("Audited & tamper-evident
  records" / "Built for local civic workflows" / "Academic research
  prototype") and the unused `ShieldCheck` import. `MapPin`/`Mail` remain for
  the contact list; main footer columns untouched.
- Deleted `footerTrustRecords`, `footerTrustLocal`, `footerTrustPrototype`
  from `en.ts` and all ten locale files, since `Messages` is derived from
  `en.ts` and the keys were referenced nowhere else.
- Project documentation still describes the prototype as academic
  (`AGENTS.md`, `PRD.md`, `README.md`); those were deliberately left alone.
- Verification: `tsc --noEmit` clean, `npm run lint` 0 errors (one pre-existing
  `<img>` warning in `ResolverWorkspace.tsx`), `npm run build` succeeds across
  all 15 routes.

## 2026-10-09 — Public tracking falsely reported worker-updated grievances missing

- Root cause: the Track page fetched detail and authenticated history in one
  try block. Anonymous detail lookup could succeed, but the history `401`
  triggered the catch handler and cleared the found grievance.
- Separated detail/history error handling; made public/non-owner history return
  customer-visible/system updates only and detail return a limited tracking
  projection. Reference IDs are normalized to uppercase for lookup. Full list
  access now requires authentication; department manager detail/history remains
  department-scoped.
- Added tests for anonymous lookup after a worker starts work, another citizen
  lookup, case-insensitive IDs, internal-note privacy, and list authentication.
- Backend compile and `git diff --check` pass; frontend lint/typecheck pass
  (one existing `<img>` warning). The focused pytest process entered test
  execution but timed out without output, so runtime test completion remains
  unconfirmed in this environment.

## 2026-10-09 — Complaint lifecycle department label

- Replaced “AI Triage & Categorization” with “Department Assigned” in the
  complaint progress timeline and updated the corresponding label across all
  supported Indian language translations.

## 2026-10-09 — Input field wording pass (English only)

- Goal: make every form field title and description clearer and less technical
  for all users. Scope was explicitly English-only, so only the values in
  `frontend/lib/i18n/en.ts` changed (keys preserved) and the ten other locale
  files were left untouched. Form structure and validation were not changed.
- Citizen form: “Issue title”, “Describe the issue”, “Suggested department
  (optional)”, “Photo of the issue”, “Issue location”, “Use my current
  location”, “Not sure? Choose for me”, with friendlier hints, placeholders
  and error text; the submit button no longer says “Classifying”.
- Staff forms: plain-language labels in `GrievanceReviewModal`,
  `AdminBoard` (search + filters), `DepartmentEmployeesWorkspace`,
  `SuperadminWorkspace`, and `ResolverWorkspace`.
- Verification: `npx tsc --noEmit` clean, `npm run build` succeeds (15 routes),
  `npm run lint` 0 errors (one pre-existing `<img>` warning in
  `ResolverWorkspace.tsx`). Confirmed the new strings are present in the built
  client chunks. Not committed, per request.

## 2026-10-09 — Admin + employee wording pass

- Applied the same plain-language treatment to the admin (queue, analytics,
  employees, superadmin) and employee/resolver surfaces: page titles, access
  screens, section headings, action buttons, table headers, and input hints/
  placeholders. Examples: “Administrative Control Centre” → “Admin dashboard”,
  “Assignee” → “Assigned to”, “Fix-by Date” → “Due by”, “Age” → “Waiting”,
  “Raise ticket” → “Send to manager”, “Submit completion” → “Send for
  review”, “Verifying administrative privileges…” → “Checking your access…”.
- Left domain terminology, status/role/department/issue-type names, CSV column
  headers, code identifiers, and all non-English locales untouched.
- Verification: `npx tsc --noEmit` clean, `npm run build` exit 0 (15 routes),
  `npm run lint` 0 errors (one pre-existing `<img>` warning). New strings
  confirmed in the built client chunks. Not committed, per request.

## 2026-10-09 — Department-wise summary CSV export

- Added “Export summary (CSV)” to the admin analytics dashboard for admins and
  superadmins. The file carries a department summary block (totals, open, in
  progress, resolved/closed, urgent, past deadline, % resolved) plus a detail
  block of every registered complaint — description, AI summary, keywords,
  priority, status, assignee, registered/due/resolved dates, coordinates and a
  map link — grouped under its department.
- Moved CSV building into a new pure module `frontend/lib/report.ts`
  (`buildComplaintsCsv`, `buildSummaryCsv`) so the two export buttons share one
  implementation and the builders run without a browser. The existing flat
  export keeps its output and is relabelled “Export complaints (CSV)”.
- Verification: executed `buildSummaryCsv` against three fixture complaints via
  a Node type-stripping harness (custom resolve hook for the extensionless
  relative imports) and asserted the department counts, detail columns, quote
  escaping, and blank-location handling; `npx tsc --noEmit` clean, `npm run
  build` exit 0 (15 routes), `npm run lint` 0 errors (one pre-existing `<img>`
  warning). New strings present in the built chunks. Nothing committed.
## 2026-10-09 — Face-recognition login (DEC-024, `feature/face-auth`)

### Request
Add optional, feature-flagged face-recognition login: 1:1 email+face
verification, server-side liveness, Fernet-encrypted embeddings only,
identical JWT shape so `require_role`/RBAC is unchanged; never mandatory for
any role; delivered as four scoped commits on `feature/face-auth`, then
threshold tunability + docs/memory.

### Context Read
- Full AGENTS.md memory protocol: `memory/README.md`, `PROJECT_STATE.md`,
  `DECISIONS.md` (last = DEC-023), `TODO.md`, `SESSION_LOG.md`; `docs/API.md`,
  `SECURITY.md`, `WORKFLOWS.md`, `DEVELOPMENT.md`, `README.md`,
  `memory/rbac/AUTHENTICATION.md`; `backend/app/{config,auth,main}.py`,
  `routers/auth.py`, `repositories/audit.py`, `tests/conftest.py`,
  `test_config_drift.py`; frontend `lib/{api,session,types}.ts`, i18n packs
  (11), `SiteHeader`/`StaffSidebar`/`SuperadminWorkspace`, login/callback
  pages, `frontend/AGENTS.md` + Next docs before writing code.

### Work Completed (commits on `feature/face-auth`)
- `7fc2c0e` — `services/face_service.py` (lazy insightface, Fernet at rest,
  fail-closed quality, liveness, 1:1 match, MODEL_MISMATCH),
  `repositories/face_templates.py` (templates/challenges/TTL counters),
  config + `backend/.env.example`, `requirements-face.txt`, startup
  FACE_EMBED_KEY validation.
- `a3d65a7` — `routers/face_auth.py` (8 routes, generic 401s, lockouts,
  SYSTEM audits), `FaceRouteGuard` (flag-off 404, HTTPS, 4 MB cap),
  auth-router pending-token step-up + `complete-pending`, `GET /config`;
  97 tests.
- `f6fd67f` — 3-check fixes (complete-pending gated on real lockout else 403;
  MODEL_MISMATCH audits without moving counters via `count=` on
  `_fail_login`/`_fail_verify`; strengthened unauthenticated-counter test) +
  full frontend: `FaceCapture`, flag-gated login tabs + 2FA step with skip,
  `/profile` (consent/enroll/re-enroll/delete/require-2FA), Google-callback
  pending_token handoff, superadmin revoke, 45 keys × 11 i18n packs; 106 face
  tests, tsc/build/lint/check-contract all green.
- `be7266f` — five liveness/quality thresholds made env-configurable
  (`FACE_TURN_MIN_DEGREES`, `FACE_BLINK_EAR_DROP`, `FACE_SMILE_MOUTH_WIDEN`,
  `FACE_MIN_BLUR_VARIANCE`, `FACE_MIN_FACE_PX`), read at call time like
  `FACE_MODEL_NAME`, defaults = previous hardcoded values, mirrored in
  `.env.example`, conftest-pinned, 7 new tests.
- Docs/memory commit — API.md (`/config`, `/auth/face`, login pause,
  complete-pending), SECURITY.md (step-up = convenience not control because
  lockout falls back to password-only; embeddings = biometric data:
  consent/encryption/deletion/DPDP), WORKFLOWS.md face-login narrative,
  DEVELOPMENT.md + README install notes, DEC-024, rbac/AUTHENTICATION.md,
  TODO (face follow-ups; 22 pre-existing failures listed by name;
  password/refresh rate-limit gap), CHANGELOG, PROJECT_STATE, this log.

### Verification
- Named checks: complete-pending rejected-when-not-locked-out,
  complete-pending-allowed-when-locked-out, MODEL_MISMATCH login/verify
  no-count, unauthenticated-cannot-burn-counter — 5/5 PASSED.
- Face suite 106 passed; config-drift 15/15; full suite 333 passed /
  22 failed — the same 22 pre-existing failures (stale DEC-006/i18n
  expectations, listed by name in `memory/TODO.md` §11), unrelated to face.
- Frontend: `npm install` (421 packages), `tsc --noEmit` clean,
  `npm run build` green (16 routes incl. `/profile`), `npm run lint` 0 errors
  (one pre-existing `<img>` warning), `check-contract.mjs` passed.

### Next
- Push `feature/face-auth` so the owner gets PRs/code review; real-webcam
  threshold tuning; optional SilentFace ONNX provisioning; Mongo persistence
  for face stores (all in TODO §10).

---

## 2026-10-10 — Face Authentication Accuracy and Performance Optimization

### Goal
Resolve webcam capture issues and optimize pipeline latency on `feature/face-auth`:
1. High accuracy on laptop webcams without switching from InsightFace.
2. Under ~3s response time for face login on laptop CPU.
3. Decouple consistency and matching thresholds.
4. Eliminate unnecessary DB round-trips for rate limits against remote MongoDB Atlas.
5. Create separate accuracy and performance commits after running all 5 gates.

### Context Read
- PRD, AGENTS.md, DEC-024, `backend/app/services/face_service.py`, `backend/app/routers/face_auth.py`, `backend/app/repositories/face_templates.py`, `frontend/components/FaceCapture.tsx`.

### Work Completed
- **Commit A (`c9f041e`)**: Accuracy fixes:
  - Capture upgraded to 640x480 @ JPEG 0.92.
  - Video mirrored visually via CSS `-scale-x-100` without mirroring raw frames.
  - 3-frame frontal template extraction and comparison.
  - Added `FACE_CONSISTENCY_THRESHOLD` (default 0.30) to `config.py` and `.env.example`.
  - Added `[FACE_DEBUG]` line logging raw metrics without logging embeddings, images, or tokens.
  - Teardown safety for camera streams via `lib/camera.ts` across tab hide, unmount, and cancel.
- **Commit B (`5b0bd68`)**: Speed optimizations:
  - InsightFace module pruning: `allowed_modules=["detection", "landmark_2d_106", "recognition"]`.
  - Detection resolution: `det_size = max(320, config.FACE_DET_SIZE)` (default 320 for CPU speed).
  - 3-frame embedding: deferred recognition seam `_real_embed` runs ArcFace only on 3 frontal frames.
  - Multi-threaded inference: `opts.intra_op_num_threads = min(4, os.cpu_count() or 1)` with thread-safe lock.
  - Frame count: 6 frames at 250ms interval; tolerates 1 failed quality frame out of 6 as long as >=5 valid candidates exist and 3 frontal pass.
  - Added "Still working…" status indicator in frontend when verification exceeds 5s.
  - DB latency reduction:
    - Reduced rate limiting to 1 round trip using atomic MongoDB aggregation pipeline `find_one_and_update` with TTL.
    - Added `rate_counts` batch method to query IP and email lockout counters in 1 round trip.
    - Handled MongoDB index conflict (code 85) for TTL indexes.
    - Pre-warmed model asynchronously on FastAPI startup (`_warmup_face_auth`).

### Verification
- 5 gates run and passed before both commits:
  - `pytest tests/test_face_auth.py -q`: 112 passed!
  - `pytest tests/test_config_drift.py`: 15 passed!
  - `npx tsc --noEmit`: 0 errors!
  - `npm run build`: Production build succeeded!
  - `node scripts/check-contract.mjs`: Contract checks passed!
- Atlas ping measured: avg 32.8 - 36.5 ms, min 23.8 ms.
- FACE_DEBUG verified to default to false and never logs sensitive biometric data.

---

## 2026-10-10 — Citizen Passwordless Face Authentication (Step 2: Login & Step 3: Recovery)

### Goal
Implement Step 2 (LOGIN) and Step 3 (RECOVERY) for passwordless citizen face authentication on branch `feature/face-auth`:
1. `POST /auth/face/login`: 1:1 login with phone or citizen_id (email preserved for legacy accounts). Restricted strictly to role USER; privileged roles and unknown identifiers return identical generic 401. Lockout limits: 5 fails/15 min per identifier, 20 fails/15 min per IP. MODEL_MISMATCH never counts toward lockout counters.
2. Frontend Face Login: Single field "Mobile number or Citizen ID" plus camera on Face tab (no email wording). 3-failure municipal office reset prompt. Clear re-enroll message on MODEL_MISMATCH.
3. Recovery Flow:
   - `POST /auth/face/admin-reset/{user_id}`: ADMIN/SUPERADMIN only, audited. Deletes template and mints 24-hr single-use re-enrollment token for in-person handoff.
   - `POST /auth/face/re-enroll`: Public endpoint accepting token, identifier, challenge_id, and frames. Runs full enrollment pipeline and replaces template. Burns token only upon success.
   - UI: Superadmin "Reset face login" button showing one-time token; Profile page warning for face_only deletion; dedicated `/re-enroll` citizen recovery page.
   - i18n: Added English strings across all 11 language packs.

### Files Changed
- `backend/app/routers/face_auth.py`: Added identifier normalization, 1:1 USER-only login, admin-reset, and re-enroll endpoints.
- `backend/app/auth.py`: Added `create_reenroll_token`.
- `frontend/lib/api.ts`: Added `adminResetFace`, `reEnrollFace`, updated `faceLogin` to use identifier and capture `x-face-reason`.
- `frontend/app/login/page.tsx`: Single identifier input on Face tab; 3-failure reset message; MODEL_MISMATCH prompt; link to `/re-enroll`.
- `frontend/components/superadmin/SuperadminWorkspace.tsx`: Flag-gated "Reset face login" button with single-use token reveal for `face_only` users.
- `frontend/app/profile/page.tsx`: Warning on deleting face data for `face_only` users; link to re-enroll.
- `frontend/app/re-enroll/page.tsx`: Dedicated public re-enrollment page.
- `frontend/lib/i18n/*.ts`: All 11 language packs updated with 14 new keys.
- `tests/test_face_login_recovery.py`: 6 core integration tests covering login, role gating, lockouts, admin reset, and token burning.
- `docs/SECURITY.md` & `memory/DECISIONS.md`: Documented DEC-024 citizen face auth amendment and 5-line security notes.

### Verification
- `pytest tests/test_face_auth.py -q`: 115 passed.
- `pytest tests/test_face_signup.py -q`: 4 passed.
- `pytest tests/test_face_login_recovery.py -q`: 6 passed.
- `pytest tests/test_config_drift.py -q`: 15 passed.
- `npx tsc --noEmit`: Clean (0 errors).
- `npm run build`: Production build succeeded (18 static routes).
- `node frontend/scripts/check-contract.mjs`: Contract checks passed.
- Full test suite: 370 passed, exactly the 22 known baseline failures, 4 skipped.



## 2026-10-10 — Conflict resolution: `main` merged into `feature/face-auth`

### Goal
Make the `feature/face-auth` PR mergeable with `main`. Branch had 12 commits
(+9,225 lines, 62 files) forked from `4688a4d`; `main` had since gained the
plain-language wording pass and the department-wise CSV summary export.

### Resolution
Four conflicts, each resolved by combining both sides rather than picking one:
- `AdminGate.tsx` — face-auth's `{user.email || user.citizen_id || user.name}`
  fallback retained inside main's plainer sentence. Face-only accounts carry no
  email, so the fallback is load-bearing.
- `SuperadminWorkspace.tsx` — face-auth's face-management user row kept, and
  main's department-card copy re-applied to the same mega-line.
- `CHANGELOG.md` / `SESSION_LOG.md` — both sides' appended sections retained;
  session log re-ordered to stay append-chronological.

Auto-merged files were checked, not assumed: `en.ts` kept main's wording values
and picked up face-auth's keys (249 → 326), all ten other locales carry 55 face
keys, and `StaffSidebar.tsx` retained both "Analytics" and the new
Profile/Notifications links.

### Verification
- `tsc --noEmit` clean; `npm run build` OK at 18 routes (new: `/profile`,
  `/re-enroll`, `/signup/face`); `check-contract.mjs` passed; `py_compile` OK
  across 11 backend files; no conflict markers; no blue in the UI.
- `npm run lint` reports 4 errors in `FaceCapture.tsx` (conditional `useEffect`,
  setState-in-effect). Verified pre-existing: that file is byte-identical to
  the branch tip, so the merge did not introduce them. Left as-is — fixing
  another agent's React hook ordering is outside a merge's scope.
- Backend face suites **not** run: no `pytest` in this environment and
  `requirements-face.txt` pulls heavy face-recognition dependencies. The
  branch's own log claims 115 + 4 + 6 + 15 passing; unconfirmed here.

## 2026-10-10 — Plan recorded: India phone numbers, phone↔face binding, Twilio SMS

### Request
Add India phone number support, facial-recognition login/account binding keyed
on the phone number, and Twilio SMS notifications telling citizens which stage
their grievance is in. Owner asked for this to be written up as a plan first.

### Investigation (nothing implemented — read-only survey)
- Found that a substantial part of "India phone support" already ships with
  face-auth: `normalize_phone()` (`users_db.py:20`) already strips `+91`/`91`/
  `0` and separators and accepts only 10 digits starting `6-9`;
  `find_by_phone`/`find_by_identifier`, the `uniq_user_phone` index and
  duplicate rejection are all present; `POST /auth/face/login` already accepts a
  phone as `identifier`; `/signup/face` already collects phone with consent.
  Recording this explicitly so a future agent does not rebuild it.
- Confirmed the real gaps: no E.164 export (Twilio needs `+91…` while storage is
  bare 10 digits), no frontend validation, no OTP, and no SMS transport at all
  (`repositories/notifications.py:1` still says "in-app v1, no email/SMS").
- Mapped the SMS hook point: `_notify()` at `assignments.py:40` with 16 call
  sites, plus separate notification paths in `grievances.py` and `progress.py`.
  Enumerated all 15 `GrievanceState` values for the stage-message set.

### Key findings that shaped the plan
- **The security-critical gap is that phone is claimed, not proven.**
  Face-login-by-phone currently authenticates against an identifier anyone can
  type into a signup form. OTP-proven binding (gate login on `phoneVerifiedAt`)
  is ranked above the SMS work.
- **TRAI DLT decides whether SMS works in India** — entity registration, a
  6-character sender ID, and pre-registered content templates; carriers drop
  unregistered or free-form bodies. Consequences carried into the design:
  fixed template bodies with slots only, human stage labels rather than enum
  values, and a 160-char cap with reason/comment text kept in-app only.
- **`SMS_PROVIDER` defaults to `dry-run`** so the repository still runs with
  zero credentials, following the existing `GROQ_API_KEY` degrade-gracefully
  pattern and the no-secrets rule.
- **SMS must be fire-and-forget async and must never raise** — an isolation test
  specifically covers "provider down must not fail an officer's state change."
- HITL (non-negotiable per AGENTS.md): SMS is informational only; no message may
  trigger or authorise an administrative action.

### Written
- `memory/TODO.md` §13 — the full plan (12 sub-sections: what already exists,
  Phase 0 prerequisites, workstreams A/B/C, the canonical DLT message set,
  sequencing, security/compliance, open questions, risks, testing, docs).
- `memory/PROJECT_STATE.md` — new "PLANNED only" section under the face-auth
  entry plus an updated last-updated line, so the plan is visible as planned
  rather than implemented work.
- `memory/DECISIONS.md` was **deliberately not** updated: the load-bearing
  choices (DLT vs dry-run deliverable, stage set, unbind policy, WhatsApp,
  SMS language) are still open, so there is no accepted DEC to record yet.

### Blockers flagged
- `pytest` is still not installed and there is no venv, so the backend suites
  cannot be run — the same reason the face suites were never re-verified. The
  plan's Phase 0 includes establishing an installable backend test env.
- Twilio trial accounts can only message verified destinations, so end-to-end
  carrier delivery cannot be validated without real DLT-registered credentials.

### Verification
Not applicable — documentation only, no code touched. `git status` clean apart
from the three `memory/` files.

## 2026-10-10 — Phone OTP binding and SMS dry-run implementation (DEC-025)

### What changed
- Added `to_e164`, verified-phone lookup gating, OTP challenge repository
  (HMAC digest, five-minute expiry, three attempts, burn-on-success), phone API
  routes, masked audit values, and a local-only OTP debug response.
- Added independent SMS consent at face signup and Profile controls for OTP
  bind/unbind and consent withdrawal. Translated face-login guidance across
  all 11 Indian language packs.
- Added English-only stage labels for all 15 grievance states, seven permitted
  citizen stages, best-effort background dispatch, consent checks, a
  160-character cap, and process-local duplicate/rate caps.
- SMS provider remains dry-run/off; no Twilio credentials, WhatsApp, staff SMS,
  or external delivery code was added.

### Verification
- `pytest tests/test_phone_sms.py -q`: 7 passed.
- Python `py_compile`, `npx tsc --noEmit`, and frontend API contract checks pass.
- Production build was blocked by sandbox: Turbopack worker creation failed
  while binding a port. Full TestClient/browser flows remain to be checked;
  live delivery is not implemented.

### Follow-up
- Persist SMS idempotency/rate counters across processes and validate the phone
  routes through TestClient/browser when that environment is stable.
- Live Twilio remains deferred pending DLT registration, credentials, approved
  templates, and carrier validation.
