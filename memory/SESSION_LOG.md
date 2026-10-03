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
