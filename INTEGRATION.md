# INTEGRATION.md — Unified Repo Source Map (historical)

> 2026-09-11 merge of `Idea Lab` (frontend/docs/memory) into `Idea Lab2`
> (Flask backend + ML logic) on `feature/unified-system`. All migration
> phases completed; the full per-phase record lives in git history and
> `memory/CHANGELOG.md`. See DEC-008 for the backend/persistence decisions
> and `memory/PROJECT_STATE.md` for live state.

What came from where: `frontend/`, `docs/`, `memory/`, `PRD.md`, `AGENTS.md`
from `Idea Lab`; `backend/` + ML logic from `Idea Lab2`. The `Idea Lab`
FastAPI scaffold was deliberately not copied. Firebase/Firestore remnants
were fully retired in Phases 3–4 (DEC-010/DEC-011).

One item remains open from this merge: the hardcoded Firebase Web API key
in the deleted `functions/admin_api.js` is still in git history — rotation
is mandatory (tracked in `memory/PROJECT_STATE.md` Known Issues).
