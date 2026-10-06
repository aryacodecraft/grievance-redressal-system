# NOTIFICATION_FLOW + Audit + Security Review

## Notifications [NEW — in-app v1]

| Event | Customer | Employee | Manager | Superadmin |
|---|---|---|---|---|
| Submitted | YES receipt+ID | — | YES dept pending | NO (digest) |
| Assigned/reassigned | YES dept assigned | YES new (+prev on reassign) | YES confirm | on override |
| Progress `customer` | YES | — | YES | NO |
| Progress `internal/manager` | NO | YES watchers | YES | NO |
| Blocked | YES class-level | YES | YES | NO |
| Priority/deadline change | YES if affects ETA | YES | YES | NO |
| Escalation req/decided | YES decided only | YES | YES inbox | YES active |
| Resolution proposed/approved/returned | YES approved + feedback | YES decision | YES queue | on override |
| Closed/reopened/withdrawn | YES receipt | YES if assigned | YES | NO |
| Admin/role/permission/dept change | NO | on self | on self/dept | YES all |

Store in `notifications`, `GET /notifications` own-only, read/unread. No email/SMS v1 (PRD future).

## Audit [NEW]

Log: create, assign/reassign, state/priority/deadline change, progress add (+visibility), evidence add, resolution propose/approve/return, escalate, withdraw/reject/close/reopen, user disable, role/permission grant, dept change, admin override.
Each: `{actor, actorRole, action, entity, entityId, old, new, at, reason, source:HUMAN|AI|SYSTEM}`. AI recs stored separately from human decisions (DEC-003). Grievance histories immutable; `audit_logs` no-update API.

## Security risks (check before ship)

- IDOR: `GET /grievances/{id}` + `frontend/lib/api.ts:194-210` raw fetch (no Bearer) — fix both. USER forced self, RESOLVER forced assigned, ADMIN dept-write.
- Cross-dept: enforce `departmentId` match on assign/progress/resolve; test cross-dept 403.
- Privilege escalation: role/permission/dept writes SUPERADMIN-only + reason + ≥1 SUPERADMIN guard; no client role trust (`roles.ts` deprecated).
- Status/priority/deadline spoof: service validates transition + role; 422/403.
- Evidence: auth image routes; SSRF allowlist + size/timeout; Cloudinary `publicId` persisted (today dropped — `imageValidation` not saved per PROJECT_STATE).
- Internal leak: timeline projection by role; `bodyInternal` never serialized to `USER`.
- Unauth demo: gate body-`userId` path behind flag; officer writes always 401 without token.
- Secrets: no JWT/keys in logs; `JWT_SECRET_KEY`, `MONGODB_URI`, OAuth via env only.
