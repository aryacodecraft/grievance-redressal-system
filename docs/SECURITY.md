# SECURITY.md — Security Design

---

## Authentication

> **Status: PARTIALLY IMPLEMENTED.** The running prototype uses JWT
> authentication for protected grievance submission and workflow routes. The
> frontend demo/localStorage mode remains available for offline previews. The
> design below covers remaining hardening work.

### JWT-Based Authentication

- Access tokens: short-lived (15 minutes recommended)
- Refresh tokens: longer-lived (7 days), stored securely
- Tokens signed with `HS256` or `RS256` using `JWT_SECRET_KEY` from environment
- Token payload: `{ user_id, role, exp, iat }`
- Token verification on every protected request via FastAPI dependency

### Google OAuth 2.0

- OAuth 2.0 Authorization Code flow
- Callback handled server-side
- `google_id` stored in `users` table
- On first OAuth login: create user account
- On subsequent logins: match by `google_id` or email
- OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) via environment variables only

### Password Storage

- Passwords hashed using `bcrypt` (never stored in plaintext)
- Minimum password length enforced at API level
- Password reset flow (to be designed — not yet implemented)

### Face Authentication (optional, DEC-024)

> Off by default (`FACE_AUTH_ENABLED=false`); every `/auth/face/*` route
> returns 404 and the UI hides all face options when off.

**Privileged step-up is convenience, not a security control.** For
ADMIN/SUPERADMIN accounts that opt in (`requireLogin2fa`), a face check may
follow password/Google login — but the face lockout always falls back to
password-only login, no privileged login is ever face-only, and
`POST /auth/complete-pending` exists precisely so a locked-out account can
still sign in with credentials. Treat the step as a UX hardening measure, not
an authentication factor that increases assurance.

- **1:1 verification only** — email + face match against that user's own
  template; never 1:N search across users
- **Server-side liveness** against a single-use, 30-second challenge action
  (head turn / blink / smile) with fail-closed frame quality gates (exactly
  one face, minimum bbox, blur floor, detection confidence); optional
  Silent-Face-Anti-Spoofing ONNX model (`FACE_ANTISPOOF_MODEL_PATH`)
- **Fail closed** everywhere — missing landmarks, unavailable model, or a
  broken anti-spoof path rejects the attempt rather than passing it
- **Generic errors** — all client-facing failures are the same 401; reason
  codes and similarity scores go to audit logs only
- **Lockouts** — per-IP (20) and per-email (5) on public face login, per-user
  (5) on the second-factor endpoint, 15-minute TTL; password/Google login is
  never blocked by them. Template model drift (`MODEL_MISMATCH`) forces
  re-enrollment and never counts toward lockout.
- **Biometric data handling (DPDP):** face embeddings are personal biometric
  data. Enrollment requires explicit consent (`consent: true` + UI checkbox).
  Only the encrypted (Fernet, `FACE_EMBED_KEY`) 512-d embedding is stored —
  never images or frames. Templates are deletable on request by the owner
  (`DELETE /auth/face/template`) and revocable by admins/superadmins
  (`DELETE /auth/face/template/{user_id}`); every lifecycle event is audited
  (`face.enrolled/deleted/revoked/...`) without ever logging embeddings.
- Liveness/quality thresholds are env-tunable (`FACE_TURN_MIN_DEGREES`,
  `FACE_BLINK_EAR_DROP`, `FACE_SMILE_MOUTH_WIDEN`, `FACE_MIN_BLUR_VARIANCE`,
  `FACE_MIN_FACE_PX`) — see `backend/.env.example`.

### Citizen Face-Only Authentication & Biometrics (DEC-024)
- Face-only authentication is lower assurance than a password; phone numbers are unverified identifiers.
- Face is the only credential for these users, so explicit consent, delete-my-data, and staff reset exist.
- Management step-up is a convenience, not a control (lockouts fall back to deterministic auth).
- The `X-Face-Reason` response header reveals that an account needs re-enrollment (accepted for demo).

### Phone verification and SMS (DEC-025)

- A phone number supplied during face signup is unverified. `find_by_identifier`
  permits phone-based face login only when `phoneVerifiedAt` is set; Citizen ID
  login remains available as the recovery path.
- OTPs are six-digit random values, HMAC-hashed at rest, expire in five minutes,
  have three attempts, and are invalidated by regeneration or consumption.
  Rate limiting covers account, HMAC(phone), and hashed client IP. OTP values
  are never logged. `OTP_DEBUG_RETURN_CODE` is a local-only dry-run escape hatch
  and must remain false in deployments.
- Binding/unbinding events are audited with masked phone values. Unbinding
  requires proof of control of the existing number and withdraws SMS consent.
- SMS updates require a verified phone and explicit consent. Dry-run/off are
  the only supported providers; notification failures never alter a grievance
  transition. Live carrier delivery is deferred for DLT/provider credentials.
- Superadmin user-list output masks phone values; a user's own `/auth/me`
  profile retains the full number so the owner can manage it.

---

## Authorization — Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|---|---|
| `USER` | Grievance raiser — own grievances only |
| `RESOLVER` | Department staff — assigned grievances only |
| `ADMIN` | Full operational oversight |
| `SUPERADMIN` | User/role management, system configuration |

### Enforcement

- Role claims in JWT are **verified against the database** on sensitive operations
- Every protected endpoint declares required role(s) via FastAPI `Depends(require_role([...]))`
- Role checks happen server-side — frontend role-based UI is for UX only, not security
- Resource-level authorization: users can only access their own grievances; resolvers can only see assigned grievances

### Permission Matrix (Key Examples)

| Resource / Action | USER | RESOLVER | ADMIN | SUPERADMIN |
|---|---|---|---|---|
| Submit grievance | ✓ | — | ✓ | ✓ |
| View own grievance | ✓ | — | ✓ | ✓ |
| View any grievance | — | assigned only | ✓ | ✓ |
| Assign grievance | — | — | ✓ | ✓ |
| Update grievance status | — | assigned only | ✓ | ✓ |
| Submit resolution | — | ✓ (assigned) | ✓ | ✓ |
| Approve escalation | — | — | ✓ | ✓ |
| Manage categories | — | — | ✓ | ✓ |
| Manage users | — | — | — | ✓ |
| View analytics | — | limited | ✓ | ✓ |
| Access audit logs | — | — | ✓ | ✓ |

---

## Input Validation

- All request bodies validated via Pydantic v2 schemas (type enforcement, length limits)
- String fields: max length enforced, HTML/script injection prevented via sanitization
- File uploads: validated by MIME type, file extension, and file size limit
- Query parameters: type-coerced and bounds-checked
- Never trust client-provided role, user_id, or resource ownership claims

---

## File Attachment Security

- Allowed file types: PDF, JPG, PNG, DOCX (configurable) — enforce via MIME type check, not extension alone
- Maximum file size: configurable via environment (default 10 MB)
- Files stored outside the web root (not directly accessible via URL)
- File names sanitized before storage (use UUID-based names internally)
- Virus scanning: recommended for production; out of scope for prototype

---

## API Security

- CORS configured to allow only the frontend origin
- Rate limiting on authentication endpoints to prevent brute force
- HTTPS required in non-development environments
- No sensitive data (passwords, tokens, API keys) in API responses or logs
- Error responses do not leak internal stack traces to clients

---

## Secret Management

**Non-negotiable rules:**
- No secrets in committed source files (`.py`, `.ts`, `.env`, config files)
- `.env` files are `.gitignore`d — always
- `.env.example` files provided with key names and placeholder values only
- Secrets loaded at runtime via environment variables using `pydantic-settings` (backend) and `process.env` (frontend)

**Required environment variables (backend):**
```
DATABASE_URL
JWT_SECRET_KEY
JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
LLM_API_KEY
LLM_API_BASE_URL
ALLOWED_ORIGINS
```

**Required environment variables (frontend):**
```
NEXT_PUBLIC_API_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

---

## Audit Logging

All significant actions are recorded in the `audit_logs` table:

- Grievance state transitions
- Assignment and reassignment events
- Escalation decisions
- Role changes
- Admin overrides of AI recommendations
- Resolution submissions
- Closure events

Each audit log entry includes: actor, action, resource, previous value, new value, timestamp, IP address.

AI-originated actions are clearly tagged as `action_source = AI_RECOMMENDATION` in `grievance_status_history`.

---

## Sensitive Data Handling

- User email addresses are not exposed to other users through the API
- Grievance details are only accessible to the submitter, assigned resolver, and admin
- Internal comments (`is_internal = true`) are not visible to grievance submitters
- PII in grievance text is the submitter's own data — handle with care in AI processing logs

---

## Development vs. Production

| Setting | Development | Production |
|---|---|---|
| HTTPS | Optional | Required |
| Debug mode | Enabled | Disabled |
| Detailed error responses | Enabled | Disabled |
| CORS | Permissive | Restricted to known origins |
| JWT expiry | Longer for convenience | Short (15 min access) |
| Rate limiting | Relaxed | Enforced |

---

## Known Prototype Limitations

- **Legacy route hardening remains.** Grievance submission now requires a
  verified JWT and derives ownership from the token; the frontend also gates
  `/submit` behind sign-in. Image signing/deletion and legacy compatibility
  routes still require the remaining authorization and SSRF work below.
- The MongoDB Atlas cluster requires a strong `MONGODB_URI` secret; the
  in-memory fallback is non-persistent and must not be used in production.
- No email verification flow implemented yet
- No password reset flow implemented yet
- File storage is local filesystem (not secure object storage)
- No virus scanning on attachments
- **Rate limiting not yet implemented on the password paths** — `POST
  /auth/login`, `/auth/refresh` and `/auth/register` have no brute-force
  throttling. The face endpoints (`/auth/face/*`) carry per-IP/per-email/
  per-user TTL lockout counters (DEC-024), but that does not protect the
  password routes; per-IP + per-account throttling there is an open gap
  (tracked in `memory/TODO.md`).
- A Firebase Web API key was hardcoded in a now-deleted file and remains in
  git history — rotation is still required (tracked in `memory/TODO.md`)
- These are acceptable limitations for an academic prototype
