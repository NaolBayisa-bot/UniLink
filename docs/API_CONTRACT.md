# Unilink Frontend API Contract

This contract is the source of truth for frontend request and response shapes. It matches the product brief and the repo design notes. All request bodies are JSON. Protected routes require the header `Authorization: Bearer <token>`.

## General behavior
- Base URL: `VITE_API_URL`
- Field names must be used exactly as written.
- Any route may return `429 { error: 'rate_limited' }` with header `Retry-After` in seconds.
- Network failure maps to a UI state of `No connection`.
- Global error handling:
  - `401 { error: 'unauthorized' }` → session expired; show `Session expired`.
  - `403 { error: 'account_disabled' }` → show `Account unavailable`.
  - `404 { error: 'not_found' }` → generic unavailable state; never explain why.
  - `400 { error: <code>, details? }` → validation problem.
  - `429 { error: 'rate_limited' }` with `Retry-After` → show rate-limited state if visible in UI.

## v1 endpoints

### `POST /auth/telegram`
Request:
```json
{ "init_data": "string" }
```

Success `200`:
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "nickname": "string",
    "gender": "male | female",
    "profile_complete": true
  }
}
```

Errors:
- `401 { error: 'invalid_init_data' }`
- `403` (account disabled or blocked as defined globally)

### `GET /me`
Success `200`:
```json
{
  "nickname": "string",
  "gender": "male | female",
  "real_name": "string | null",
  "department": "string | null",
  "profile_complete": true
}
```

### `POST /profile`
Request body: any of the following fields, with rules as stated below:
```json
{
  "nickname": "string (2-30 chars)",
  "real_name": "string (1-100)",
  "department": "string (1-100)",
  "gender": "male | female"
}
```

Rules:
- `gender` can be set once; later changes are silently ignored.
- `nickname`, `real_name`, and `department` are validated by server rules.

Success `200`: same shape as `GET /me`
Errors:
- `400` validation error

### `GET /browse`
Success `200`:
```json
[
  {
    "id": "number",
    "nickname": "string",
    "created_at": "ISO 8601 string"
  }
]
```
- Max 20 items, newest first.

Errors:
- `400 { error: 'complete_profile_first' }`

### `POST /like`
Request:
```json
{ "to_user_id": "number" }
```

Success `200`:
```json
{
  "matched": true,
  "match_id": "string | null"
}
```

Errors:
- `404`
- `400`

### `GET /matches`
Success `200`:
```json
[
  {
    "match_id": "string",
    "matched_at": "ISO 8601 string",
    "other_user": {
      "id": "number",
      "nickname": "string"
    },
    "i_shared_contact": false,
    "they_shared_contact": false
  }
]
```

### `GET /match/{match_id}/profile`
Success `200`:
```json
{
  "nickname": "string",
  "gender": "male | female",
  "real_name": "string | null",
  "department": "string | null",
  "i_shared_contact": true
}
```

Exactly one of the following is also present:
- `telegram_username`: string
- `has_shared_contact: false`
- `contact_unavailable: true`

Errors:
- `404`

### `POST /match/{match_id}/share-contact`
Success `200`:
```json
{
  "i_shared_contact": true,
  "they_shared_contact": true
}
```

Errors:
- `404`

### `POST /unmatch`
Request:
```json
{ "match_id": "string" }
```

Success `204` with no body.
Errors:
- `404`

### `POST /block`
Request:
```json
{ "blocked_id": "number" }
```

Success `204` with no body.
Errors:
- `400`
- `404`

### `POST /report`
Request:
```json
{
  "reported_id": "number",
  "reason": "string (1-1000 chars)"
}
```

Success `201`
Errors:
- `400`
- `404`

## v1.1 additions

### `GET /keywords`
Success `200`:
```json
{
  "categories": [
    {
      "category": "string",
      "keywords": [
        { "id": 1, "name": "string" }
      ]
    }
  ]
}
```
- 80 keywords total
- 8 categories

### `POST /profile/keywords`
Request:
```json
{ "keyword_ids": [1, 2, 3] }
```
Rules:
- 5-10 keyword IDs
- no duplicates

Success `200`:
```json
{ "keyword_ids": [1, 2, 3] }
```

Errors:
- `400 { error: 'keyword_count_out_of_range' }`
- `400 { error: 'duplicate_keyword_ids' }`
- `400 { error: 'unknown_keyword_id' }`

### `POST /photo/upload-signature`
Success `200`:
```json
{
  "signature": "string",
  "timestamp": "number",
  "api_key": "string",
  "cloud_name": "string",
  "folder": "string",
  "type": "string",
  "allowed_formats": ["jpg", "png"],
  "upload_url": "string"
}
```

Client uploads directly to `upload_url` using multipart form fields:
- `file`
- `api_key`
- `timestamp`
- `signature`
- `folder`
- `type`
- `allowed_formats`

Cloudinary responds with a JSON object containing `public_id`.

### `POST /photo/confirm`
Request:
```json
{ "public_id": "string" }
```

Success `200`:
```json
{ "photo_set": true }
```

Errors:
- `400 { error: 'invalid_public_id' }`
- `400 { error: 'photo_not_found' }`

### `GET /me` (updated)
Success `200` now includes:
```json
{
  "nickname": "string",
  "gender": "male | female",
  "real_name": "string | null",
  "department": "string | null",
  "profile_complete": true,
  "has_photo": true,
  "keyword_ids": [1, 2, 3],
  "keyword_count": 3
}
```

### `GET /browse` (updated)
Each item adds:
```json
{
  "id": "number",
  "nickname": "string",
  "created_at": "ISO 8601 string",
  "shared_count": 2,
  "shared_keywords": ["string"]
}
```

### `GET /match/{match_id}/profile` (updated)
Adds:
```json
{
  "nickname": "string",
  "gender": "male | female",
  "real_name": "string | null",
  "department": "string | null",
  "i_shared_contact": true,
  "photo_url": "string | null",
  "shared_interests": ["string"]
}
```

Notes:
- `shared_interests` is not returned by the backend in the official contract; the UI computes a local intersection when possible.
- `profile_complete` now also requires a photo and at least 5 keywords.

## v1.2 additions

### `POST /like` additional errors
- `429 { error: 'daily_like_limit_reached', limit: 10, resets_at: 'ISO 8601 UTC' }`
- `403 { error: 'email_not_verified' }`

### `POST /pass`
Request:
```json
{ "to_user_id": "number" }
```

Success `204`
Errors:
- `404`
- `400`

### `POST /auth/google-link`
Request:
```json
{ "id_token": "string" }
```

Success `200`:
```json
{ "email_verified": true }
```

Errors:
- `400 { error: 'invalid_google_token' }`
- `409 { error: 'google_account_already_used' }`
- `409 { error: 'already_linked' }`

### `GET /me` (updated)
Adds:
```json
{
  "email_verified": true,
  "likes_remaining_today": 8
}
```

## v1.3 additions

### `POST /events/ticket`
Success `200`:
```json
{ "ticket": "string", "expires_in": 300 }
```

### `GET /events?ticket=<ticket>`
Server-Sent Events stream via `EventSource`.

Initial event:
```json
{ "event": "ready" }
```

Subsequent events include JSON payloads:
- `match_created`: `{ "match_id": "string" }`
- `contact_shared`: `{ "match_id": "string" }`
- `unmatched`: `{ "match_id": "string" }`
- `photo_reviewed`: `{ "status": "approved | rejected" }`

Notes:
- No replayed events.
- On reconnect, refetch `/matches` and `/me`.

### `GET /me` (updated)
Adds:
```json
{
  "photo_status": "none | pending | approved | rejected",
  "photo_reject_reason": null | "not_a_face" | "explicit" | "other"
}
```

### `GET /match/{match_id}/profile` (updated)
`photo_url` becomes a relative path like `/photo/view?t=<ticket>`, prefixed with the API base URL. It includes:
```json
{
  "photo_url": "/photo/view?t=abc",
  "photo_expires_in": 300
}
```
If an image request returns `404`, the ticket expired and the profile should be refetched.

### Admin-only routes

#### `GET /admin/photos/pending`
Success `200`:
```json
[
  {
    "user_id": 123,
    "nickname": "string",
    "photo_submitted_at": "ISO 8601 string",
    "view_url": "string"
  }
]
```

#### `POST /admin/photos/review`
Request:
```json
{
  "user_id": 123,
  "decision": "approve | reject",
  "reason": "not_a_face | explicit | other"
}
```

Errors:
- `409 { error: 'not_pending' }`

#### `GET /admin/reports?status=open|resolved`
Success `200`:
```json
[
  {
    "id": "string",
    "reporter_id": 123,
    "reported_id": 456,
    "reason": "string",
    "status": "open | resolved",
    "created_at": "ISO 8601 string"
  }
]
```

#### `POST /admin/resolve-report`
Request:
```json
{ "report_id": "string" }
```

#### `POST /admin/ban-user`
Request:
```json
{ "user_id": 123 }
```

#### `GET /admin/users/{id}`
Success `200`:
```json
{
  "id": 123,
  "nickname": "string",
  "real_name": "string",
  "department": "string",
  "gender": "male | female",
  "telegram_username": "string",
  "status": "string",
  "verification_level": "basic | google | id",
  "email_verified": true,
  "flagged_at": "ISO 8601 string | null",
  "signup_ip": "string",
  "created_at": "ISO 8601 string",
  "open_reports_against": 0,
  "reports_filed": 0,
  "active_matches": 0
}
```

#### `POST /admin/set-verification-level`
Request:
```json
{
  "user_id": 123,
  "verification_level": "basic | google | id"
}
```

#### `GET /admin/users?signup_ip=<ip>`
Success `200`:
```json
[
  {
    "id": 123,
    "nickname": "string",
    "status": "string",
    "created_at": "ISO 8601 string"
  }
]
```

## Backend additions assumed by designs but not in the original backend prompt
These values should be treated as optional and safely tolerated by the frontend if missing:
- `verification_level` on `GET /me`, `/browse` items, `/matches` `other_user`, `/match/{match_id}/profile`
- `likes_resets_at` on `GET /me`
- `is_admin` on `GET /me`
- `reporter_nickname` and `reported_nickname` on admin report list entries
- `viewed` or equivalent field to denote a new match until the UI decides otherwise
- `my_photo_url` or equivalent on `GET /me`

The UI should tolerate missing versions of these fields without breaking.

## Error matrix summary
- `401 unauthorized` → `Session expired`
- `403 account_disabled` → `Account unavailable`
- `404 not_found` → generic unavailable state
- `400 validation` → inline validation messaging or a generic error surface
- `429 rate_limited` → rate-limit UI state and show `Retry-After` if surfaced
- network failure → `No connection`

## Notes for implementation
- Never expose or log tokens, Telegram `initData`, emails, or usernames in frontend logs.
- Keep auth tokens in memory only.
- Use the exact field names listed above for all frontend application logic and mocks.
- All server calls must be abstracted behind modules in `src/api`.
