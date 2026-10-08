# AUTHENTICATION Architecture

> Reality: `backend/app/auth.py:1-123`, `backend/app/routers/auth.py:1-303`, `backend/app/users_db.py:1-125`, `backend/app/config.py:59-70`, `backend/app/main.py:85-122`, `frontend/lib/session.tsx:1-195`, `frontend/lib/api.ts:36-91,264-295`.
> Stale: `docs/SECURITY.md:7-10` and `docs/API.md:3-8` headers still say "no auth / PLANNED" — fix at build (DEC-017 landed).

## [EXISTING] What works

- Register `POST /auth/register` → bcrypt 12 rounds (`routers/auth.py:39-51`), `role=USER` forced, 409 on dup.
- Login `POST /auth/login` → access (60m) + refresh (7d), HS256 `JWT_SECRET_KEY`.
- Refresh `POST /auth/refresh` → new access from valid refresh; `/auth/me` (`GET /auth/me` in code as `/auth/me` via prefix) returns profile.
- Google OAuth `GET /auth/google` → redirect + `GET /auth/google/callback` → find-or-create `USER`, redirect to `FRONTEND_URL/auth/callback?access_token=&refresh_token=`.
- `get_current_user` (401 on missing/expired/wrong-type), `get_optional_user` (None fallback), `require_role([...])` (403).
- `MongoUsersRepository` (`users` coll, `uniq_user_email`) + `InMemoryUsersRepository` fallback; singleton in `users_db.py:110-125`.
- Startup seed: `SEED_ADMIN_EMAIL/PASSWORD` → `ADMIN`, plus `citizen@grievance.local / Citizen@2026!` → `USER`.
- Frontend: `login()/register()/setAuthSession()` + `/auth/me` on mount, Bearer injection, single-flight 401→refresh retry; demo `signInDemo` + `STORAGE_KEY` preserved for mocks.

## [MODIFY] Gaps to close

1. Email regex (`routers/auth.py:62`) replaces `EmailStr` to allow `.local` — keep, document as dev allowance.
2. Refresh rotation: current refresh reuse allowed for 7d. Add reuse-detection or short grace + `POST /auth/logout` server denylist (docs promise logout; code is client-discard only). Mark `[NEW]`.
3. Google `id_token` decode is unverified (`routers/auth.py:254-269` comment admits). Verify signature via Google certs before prod. `[MODIFY]`.
4. OAuth state cookie is unsigned (`routers/auth.py:199-215`). Sign it or store nonce server-side. `[MODIFY]`.
5. Tokens in query string on callback (`routers/auth.py:297-303`). Acceptable prototype; move to httpOnly cookie or code-exchange for prod. `[MODIFY]`.
6. `JWT_SECRET_KEY=""` → `_decode` 500s (`auth.py:52-58`). Fail closed at boot when `ENV!=dev` instead. `[MODIFY]`.
7. Role staleness: access token carries `role`; if admin demotes user, old token lives ≤60m. Document; re-check DB on `require_permission` for officer writes. `[MODIFY]`.
8. Rate-limit login/refresh/register (brute force). `[NEW]` — in-memory throttle v1 ok.
9. `SUPERADMIN` seed: add `SEED_SUPERADMIN_EMAIL/PASSWORD` mirroring admin seed. `[NEW]`.

## Token lifecycle (keep)

- Access 60m `{sub, role, email, type:access}`, refresh 7d `{sub, type:refresh}`.
- Passwords bcrypt, min 8 chars (Pydantic + Zod).
- Logout v1 = client discard; v2 = server denylist.

## AuthN vs AuthZ (enforce in docs + code)

- AuthN = who (`get_current_user`). AuthZ = what (`require_role` → `require_permission` + resource owner/dept checks in service layer, never router-only).
- Never trust `userId` body, `roleForEmail`, or localStorage role for decisions.
