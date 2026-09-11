# SECURITY.md — Security Design

---

## Authentication

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

- No email verification flow implemented yet
- No password reset flow implemented yet
- File storage is local filesystem (not secure object storage)
- No virus scanning on attachments
- Rate limiting not yet implemented
- These are acceptable limitations for an academic prototype
