# IMPLEMENTATION_CHECKLIST — Phased, Dependency-Ordered

> Check off only when code + tests + memory updated. Baseline tests to invert (not delete): `tests/test_security_baseline.py`, `check-contract.mjs BASELINE`, `tests/test_status_vocabularies.py` divergences.

## PHASE 0 — Foundation + SUPERADMIN

- [ ] `SEED_SUPERADMIN_*` + ≥1-SUPERADMIN guard + no-self-demote-to-zero
- [ ] `departments` + `users.departmentId/isActive` + dept indexes
- [ ] `roles/permissions` v1 (static map ok) + `require_permission()` + DB role re-check
- [ ] `GET /users`, `POST /users/{id}/roles` (SUPERADMIN), `CRUD /departments` (SUPERADMIN write)
- [ ] Fix stale headers (`docs/SECURITY.md`, `docs/API.md`, `docs/ARCHITECTURE.md` auth section)
- [ ] Tests: cross-role, cross-dept, role-escalation denied, audit written

## PHASE 1 — State machine + histories

- [ ] Canonical UPPER states + adapter for `open/assigned/...` + 422 table
- [ ] `stateHistory/assignmentHistory/priorityHistory/deadlineHistory` append-only
- [ ] `PATCH /grievances/{id}/state` (+ compat `/status`), reason-required
- [ ] Tests: every row in transition table + invalid 422 + history immutability

## PHASE 2 — Progress system

- [ ] `progress_updates` + `POST /:id/progress` + role-filtered `GET /:id/history`
- [ ] Employee composer (internal/customer toggle + preview), manager promote/demote
- [ ] Customer timeline (friendly labels, no PII/internals)
- [ ] Tests: visibility projection, immutable edit-supersede, notify only on `customer`

## PHASE 3 — Assignment / priority / deadline / escalation / resolution / closure

- [ ] Assign/reassign with reason + `dueDate` from `sla_config`; retire `sla.ts` as truth
- [ ] Overdue/due-soon/inactive queues + manager workload
- [ ] Escalate → approve → reassign; resolution propose → approve/return; close/reopen/withdraw/reject
- [ ] Tests: ownership always set, reassign preserves history, overdue visible

## PHASE 4 — Role interfaces

- [ ] `/resolver` queue/detail; dept-scoped `/admin`; `/superadmin` system page
- [ ] Role nav + `AdminGate`-style guards (UX only) + hidden-action tests
- [ ] Customer detail: status words, dept, latest visible update, ETA, resolution+feedback

## PHASE 5 — Notifications + audit

- [ ] `notifications` + inbox + read-all; event fan-out per table
- [ ] `audit_logs` on every privileged write; admin/audit viewers (dept vs all)
- [ ] Tests: recipient correctness, no internal leak, audit completeness

## PHASE 6 — Hardening + E2E

- [ ] Auth image routes + SSRF guard; Bearer on `getGrievance()`; rate-limit auth; verify Google sig; sign OAuth state; logout denylist; `JWT_SECRET` fail-closed
- [ ] Full lifecycle E2E: submit → assign → progress → block/resume → resolve → approve → close → feedback → reopen, plus escalate + cross-dept deny
- [ ] Update `docs/*` + `memory/*`; invert baselines green

## NEXT IMPLEMENTATION PHASE (order)

0 → 1 → 2 → 3 → 4 → 5 → 6. Do not start AI-eval (Phase 4 old roadmap) until workflow + audit stable.
