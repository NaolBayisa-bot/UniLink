# Security Notes — UniLink v1

This document records the results of the final-hardening code audit (Task 25)
and the known v1 security limits. It is the regression baseline for everything
added later.

## Code audit

### 1. `SELECT *` on `users` outside `app/db/users.py`

Command:
```bash
grep -rn "select \*" app/ --include="*.py" | grep -i users
```

Clean output: none outside `app/db/users.py`. `app/db/users.py` selects only the
explicit columns it needs (`nickname, gender, real_name, department`, or
`id, nickname, created_at`) and is the single module allowed to read other
users' rows. Every route reads identity from the DB via `require_auth` (which
loads `id, status, gender, is_admin` per request) or through the `users.py`
helpers.

### 2. SQL built with f-strings or % formatting

Command:
```bash
grep -rnE 'f["\'].*(SELECT|INSERT|UPDATE|DELETE)|%(s|d).*\bexecute\b|\.execute\(%' app/ --include="*.py"
```

Clean output: the only f-string SQL is in `app/db/users.py:67`, where the f-string
builds the dynamic `SET` clause of `UPDATE users`. The interpolated values are
column names drawn from a hard-coded allowlist
`("nickname", "real_name", "department", "gender")`, never user input. The
values themselves are passed as `%s` parameters to `fetch_one`, so there is no
SQL injection surface. All other SQL in the codebase uses `%s` placeholders with
separate parameters (see `app/db/query.py`).

### 3. Routes reading identity from `request.json` / `request.args`

Command:
```bash
grep -rn "request\." app/routes/ --include="*.py"
```

Clean output: identities are read only from the documented targets:
- `/like` → `to_user_id` (body)
- `/block` → `blocked_id` (body)
- `/report` → `reported_id` (body)
- `/match/<id>/profile`, `/match/<id>/share-contact`, `/unmatch` → `match_id` (path)
- `/admin/resolve-report` → `report_id` (body)
- `/admin/ban-user` → `user_id` (body)
- `/admin/reports` → `status` (query, a filter — not an identity)

Every route derives the acting user from `g.user_id` / `g.user`, which `require_auth`
loads from the database on every request — never from `request.json` or
`request.args`. One exception: `app/routes/profile.py:21` contains a dead,
unused line `request.environ.get("USER_ID")`. It is not used for any access
decision (`g.user_id` is used instead) and is flagged as cleanup, not a
vulnerability.

## Known v1 limits (accepted risk)

- **No rate limiting on login or like.** A brute-force or like-spam attacker is
  not constrained by the application in v1. Mitigate at the ingress/L7 layer.
- **JWTs last until expiry.** Bans are still instant because `require_auth`
  checks `status` in the database on every request (`app/auth/decorators.py`).
  A revoked/banned user cannot use an old token.
- **Once shared, contact cannot be un-shared.** `reveal_consents` rows are only
  inserted, never revoked, in v1. A user who has consented can still see the
  other party's shared username until the match is unmatched.
- **Users can screenshot anything they see.** The app cannot control what a
  recipient does with data after it is rendered.
- **Photos are not in v1.** No image upload, storage, or moderation exists yet.
