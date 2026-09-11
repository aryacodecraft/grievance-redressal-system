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
| `PROJECT_STATE.md` | **Current truth** — what is implemented, what is planned, known issues | After every meaningful task |
| `DECISIONS.md` | Architecture Decision Records — what was decided, why, what alternatives were considered | When a meaningful architectural decision is made |
| `CHANGELOG.md` | Chronological log of implementation changes | After every meaningful task |
| `TODO.md` | Actionable task backlog organized by priority | Continuously maintained |
| `SESSION_LOG.md` | Per-session log — what was attempted, what changed, what is next | After every AI working session |

---

## When Agents Must Read

**AT THE START OF EVERY SESSION**, read in this order:

1. `AGENTS.md` (repository root)
2. `memory/README.md` (this file)
3. `memory/PROJECT_STATE.md`
4. `memory/DECISIONS.md`
5. `memory/TODO.md`
6. Latest entries in `memory/SESSION_LOG.md`
7. Relevant technical documentation in `docs/` for the current task
8. Actual source files affected by the current task

**Do not begin implementation based solely on the user's latest prompt.**
Understand the current project state first.

---

## When Agents Must Update

After every meaningful task, evaluate whether updates are needed to:

- `PROJECT_STATE.md` — if implementation state changed
- `DECISIONS.md` — if an architectural decision was made
- `CHANGELOG.md` — always, for any meaningful change
- `TODO.md` — mark completed items, add new items discovered
- `SESSION_LOG.md` — always, append a new session entry

If architecture changed → update `docs/ARCHITECTURE.md`
If database changed → update `docs/DATABASE.md`
If API contracts changed → update `docs/API.md`
If AI behavior changed → update `docs/AI_SYSTEM.md`
If workflows changed → update `docs/WORKFLOWS.md`
If setup changed → update `docs/DEVELOPMENT.md` and/or `README.md`

**A task is not complete until relevant memory and documentation are updated.**

---

## How to Avoid Stale Documentation

1. **Never mark something as IMPLEMENTED unless code exists and basic integration works.**
   Use PLANNED, IN PROGRESS, IMPLEMENTED, TESTED, VALIDATED consistently.

2. **When you update code, update docs in the same session.**
   Do not defer documentation updates — they accumulate and become wrong.

3. **Never delete previous DECISIONS entries.**
   If a decision changed, mark the old one SUPERSEDED BY DEC-XXX and add the new one.

4. **Never rewrite SESSION_LOG.md.**
   Only append new entries. It is a chronological record.

5. **PROJECT_STATE.md describes current state only, not history.**
   History belongs in CHANGELOG.md and SESSION_LOG.md.

6. **If a memory file contradicts the actual code, the code is the ground truth.**
   Correct the memory file immediately.

---

## Memory Answers These Questions

A new agent reading project memory should be able to answer:

- "What is this project?" → `PROJECT_STATE.md`, `README.md`
- "What currently works?" → `PROJECT_STATE.md` (Implemented section)
- "What has already been implemented?" → `PROJECT_STATE.md`, `CHANGELOG.md`
- "What remains?" → `PROJECT_STATE.md` (Planned section), `TODO.md`
- "What important decisions were made?" → `DECISIONS.md`
- "Why were those decisions made?" → `DECISIONS.md` (Reason field)
- "What happened recently?" → `SESSION_LOG.md` (latest entries)
- "What should I avoid breaking?" → `PROJECT_STATE.md` (Integration Points), `DECISIONS.md`
- "What should I work on next?" → `TODO.md` (Current Sprint), `PROJECT_STATE.md` (Next Steps)
