# Project Memory — AI-Enabled Grievance Redressal and Decision Support System

## Purpose

This directory is the **persistent operational memory** of the project.

It exists because this project is developed across many sessions by multiple AI coding agents
and human developers. Without persistent, accurate memory, each new agent session would need
to re-derive the project state from code alone — which is slow, error-prone, and leads to
contradictions and duplicated work.

> **PROJECT MEMORY IS PART OF THE IMPLEMENTATION PROCESS, NOT OPTIONAL DOCUMENTATION.**

---

## Files and Their Purpose

| File | Purpose | Update Frequency |
|---|---|---|
| `CURRENT_STATE.md` | **Current truth** — what is implemented, what is partial, and everything remaining to implement/test (supersedes the former `PROJECT_STATE.md` + `TODO.md`) | After every meaningful task |
| `DECISIONS.md` | Architecture Decision Records — what was decided, why, what alternatives were considered | When a meaningful architectural decision is made |
| `CHANGELOG.md` | Chronological log of implementation changes (rolling — recent entries only) | After every meaningful task |
| `SESSION_LOG.md` | Per-session log — what was attempted, what changed, what is next (rolling — recent entries only) | After every AI working session |
| `archive/` | Rotated historical entries (changelog, session log) and superseded docs (`PROJECT_STATE-*`, `TODO-*`) — history, not current truth | When active files grow too large / a doc is superseded |
| `rbac/` | Docs-only RBAC spec suite (not runtime code) | With RBAC work |

---

## When Agents Must Read

**AT THE START OF EVERY SESSION**, read in this order:

1. `AGENTS.md` (repository root)
2. `memory/README.md` (this file)
3. `memory/CURRENT_STATE.md` — the single entry point (state + remaining work)
4. `memory/DECISIONS.md` — grep for the decisions relevant to the task
5. Latest entries in `memory/CHANGELOG.md` and `memory/SESSION_LOG.md`
6. Relevant technical documentation in `docs/` for the current task
7. Actual source files affected by the current task

**Do not begin implementation based solely on the user's latest prompt.**
Understand the current project state first.

---

## When Agents Must Update

After every meaningful task, evaluate whether updates are needed to:

- `CURRENT_STATE.md` — if implementation state or the remaining-work list changed
- `DECISIONS.md` — if an architectural decision was made
- `CHANGELOG.md` — always, for any meaningful change (keep the entry lean)
- `SESSION_LOG.md` — always, append a lean session entry

If architecture changed → update `docs/ARCHITECTURE.md`
If database changed → update `docs/DATABASE.md`
If API contracts changed → update `docs/API.md`
If AI behavior changed → update `docs/AI_SYSTEM.md`
If workflows changed → update `docs/WORKFLOWS.md`
If setup changed → update `docs/DEVELOPMENT.md` and/or `README.md`

**A task is not complete until relevant memory and documentation are updated.**

---

## Rolling-Log Rotation (DEC-037, 2026-10-18)

`CHANGELOG.md` and `SESSION_LOG.md` are rolling files: they keep roughly the
last two weeks (minimum ~10 entries). When appending a new entry and the active
file exceeds ~400 lines:

1. Move only the entries older than the two-week window **unchanged** to
   `memory/archive/<FILE>-<first>_to_<last>.md` (create or extend the archive
   file for that period)
2. Never rotate below the ~10 most recent entries
3. Leave a pointer line at the top of the active file
4. Never edit or delete rotated entries

Superseded versions of replaced memory docs also live in `archive/` (e.g.
`PROJECT_STATE-until-2026-10-18.md`, `TODO-until-2026-10-18.md`).

---

## How to Avoid Stale Documentation

1. **Never mark something as IMPLEMENTED unless code exists and basic integration works.**
   Use PLANNED, IN PROGRESS, IMPLEMENTED, TESTED, VALIDATED consistently.

2. **When you update code, update docs in the same session.**
   Do not defer documentation updates — they accumulate and become wrong.

3. **Never delete previous DECISIONS entries.**
   If a decision changed, mark the old one SUPERSEDED BY DEC-XXX and add the new one.

4. **Never rewrite or edit log entries.**
   `SESSION_LOG.md` / `CHANGELOG.md` are append-only; rotation only relocates
   entries to `archive/` (verbatim), it does not modify them.

5. **CURRENT_STATE.md describes current state + remaining work only, not history.**
   History belongs in `CHANGELOG.md` / `SESSION_LOG.md` (+ `archive/`).

6. **If a memory file contradicts the actual code, the code is the ground truth.**
   Correct the memory file immediately.

---

## Memory Answers These Questions

A new agent reading project memory should be able to answer:

- "What is this project?" → `CURRENT_STATE.md`, `README.md`
- "What currently works?" → `CURRENT_STATE.md` §2 (Implemented and working)
- "What has already been implemented?" → `CURRENT_STATE.md`, `CHANGELOG.md`
- "What remains?" → `CURRENT_STATE.md` §4 (implement) + §5 (test/validate)
- "What important decisions were made?" → `DECISIONS.md`
- "Why were those decisions made?" → `DECISIONS.md` (Reason field)
- "What happened recently?" → `CHANGELOG.md`, `SESSION_LOG.md` (latest entries)
- "What should I avoid breaking?" → `CURRENT_STATE.md` §6 (known issues / contract-sensitive surfaces), `DECISIONS.md`
- "What should I work on next?" → `CURRENT_STATE.md` §8 (suggested next steps)
