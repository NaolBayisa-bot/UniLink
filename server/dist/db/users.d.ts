/**
 * The only fields safe to expose about ANOTHER user without an established
 * match. Any read of another user's row (or even your own, via the "public"
 * shape) MUST go through getPublicProfile / getRevealedProfile below — never
 * a raw `SELECT * FROM users` for another user's row.
 */
export interface PublicProfile {
    id: string;
    nickname: string | null;
    gender: string | null;
    photo_public_id: string | null;
    custom_interest_text: string | null;
    created_at: Date;
}
/**
 * The extended shape returned only when the requester and target are matched.
 * Adds sensitive fields that must never leak through the public profile.
 */
export interface RevealedProfile extends PublicProfile {
    real_name: string | null;
    department: string | null;
    telegram_username: string | null;
}
/**
 * A DB query function. Defaults to the app's real `query`, but may be injected
 * in tests for hermetic / non-destructive assertions.
 */
export type QueryFn = (text: string, params?: unknown[]) => Promise<{
    rows: unknown[];
    rowCount: number | null;
}>;
/** Identity + verification data used to upsert a user on signup. */
export interface UpsertUserInput {
    telegram_id: number;
    telegram_username: string | null;
    email: string;
    email_verified: boolean;
}
/**
 * The (own-user) row shape returned by an upsert. Includes a couple of fields
 * the user may read about themselves, plus the safe public fields.
 */
export interface OwnUserRow {
    id: string;
    telegram_id: string;
    telegram_username: string | null;
    email: string | null;
    email_verified: boolean;
    nickname: string | null;
    gender: string | null;
    photo_public_id: string | null;
    custom_interest_text: string | null;
    prompts: unknown[] | null;
    status: string;
    created_at: Date;
}
/**
 * Return the public profile row for `userId`, or null if the user does not
 * exist. Only the explicitly-listed, non-sensitive fields are selected.
 */
export declare function getPublicProfile(userId: string, q?: QueryFn): Promise<PublicProfile | null>;
/**
 * Return the "revealed" profile of `targetId` to `requesterId`, but ONLY when
 * the two are actively matched. The extra sensitive fields (real_name,
 * department, telegram_username) are the reward for an established match.
 *
 * Throws HttpError(403) when there is no active match between the two users.
 * Returns null if the target row does not exist even though a match passes.
 */
export declare function getRevealedProfile(requesterId: string, targetId: string, q?: QueryFn): Promise<RevealedProfile | null>;
/**
 * Browse candidates for `callerId`: users whose gender DIFFERS from the
 * caller's own, excluding the caller, restricted to active accounts. Only the
 * Task-22 public-profile field set (PUBLIC_PROFILE_COLUMNS) is selected.
 *
 * ALSO EXCLUDED:
 * - caller-scoped (derived from the caller's own rows): users the caller has
 *   already liked (their `to_user_id` rows in `likes`); users the caller passed
 *   within the last PASS_EXCLUSION_WINDOW_DAYS (15) days — an OLDER pass has
 *   expired, so that user is browsable again; anyone in a blocking relationship
 *   with the caller in EITHER direction, using the same predicate as
 *   isBlockedPair (blocking is mutual for visibility);
 * - GLOBAL moderation state (not caller-scoped): anyone with an OPEN report
 *   against them, using the same predicate as hasOpenReportAgainst. Once the
 *   report is marked resolved the user reappears.
 *
 * SECURITY INVARIANT (gender + caller-scoped exclusion set are server-side
 * only): both the comparison gender and the caller-scoped excluded ids are
 * derived from THE CALLER'S OWN ROWS, identified by $1 — which is always
 * req.userId. Neither the caller's gender nor the exclusion set is accepted as
 * an argument, so a forged `gender` or a forged liked/passed/blocked id
 * anywhere in the request has no effect. The open-report exclusion is read from
 * moderation state, also never from the request.
 *
 * The scalar subquery also fails CLOSED: if the caller's row is missing or their
 * gender is still NULL, the subquery yields NULL and `gender <> NULL` matches no
 * rows (an empty feed) rather than everyone.
 *
 * RANKING (Task 39 — shared-keyword scoring): candidates are ordered by the
 * number of keywords they share with the caller, highest first, then by recency
 * (created_at DESC). The shared-keyword count is a correlated scalar subquery:
 * a self-join of `user_keywords` pairing the caller's keyword rows with each
 * candidate's keyword rows on a common keyword_id, counting the matches.
 *
 * SECURITY / PRIVACY INVARIANTS preserved by the ranking:
 * - The score is computed ONLY from the caller-scoped `user_keywords` join
 *   (caller identified by $1) — it introduces NO new parameter, so the query
 *   still takes exactly ONE argument (the caller id) and a forged gender/id in
 *   the request cannot influence ranking.
 * - The user-supplied free text `custom_interest_text` is NEVER joined into (or
 *   read by) this scoring query — only the shared keyword set is.
 * - `score` is a DISPLAY-ONLY ordering key: it is used solely in ORDER BY and is
 *   NOT added to the SELECT list, so the response stays the Task-22 public-field
 *   set only (no score leaks to the client).
 * - A candidate sharing zero keywords scores 0 (COUNT over an empty join) and
 *   simply sorts last by score, falling back to recency — it still fails CLOSED.
 *
 * LIMIT 20 caps the feed at the 20 best-ranked candidates.
 */
export declare function browseProfiles(callerId: string, q?: QueryFn): Promise<PublicProfile[]>;
/**
 * Update the given user's own profile. The `gender` field, if present in
 * `fields`, is EXPLICITLY STRIPPED and has no effect on the stored gender —
 * gender is only ever changed through adminCorrectGender(). Fields are further
 * restricted to the SELF_EDITABLE_FIELDS allowlist.
 *
 * Returns the number of rows affected, or { rowCount: 0 } if there was nothing
 * safe to update (e.g. `fields` contained only `gender`).
 */
export declare function updateOwnProfile(userId: string, fields: Record<string, unknown>, q?: QueryFn): Promise<{
    rowCount: number | null;
}>;
/**
 * Admin-only path (Task 47-equivalent route) for correcting a user's gender.
 * This is the ONLY code path that may change gender. Rejects values other than
 * 'male'/'female' with HttpError(400). Must never be reachable via a normal
 * self-service profile update.
 */
export declare function adminCorrectGender(userId: string, gender: string, q?: QueryFn): Promise<{
    rowCount: number | null;
}>;
/**
 * Upsert a user keyed on telegram_id (the primary external identity).
 *
 * - New user: inserts with email / email_verified taken from the VERIFIED
 *   Google payload (email_verified is always true here — never client-supplied).
 * - Existing user: conflict on telegram_id -> fetches the existing row, and only
 *   refreshes telegram_username; the stored email is NOT overwritten on re-login.
 *
 * Only the values passed in `input` are trusted; callers must derive telegram_id,
 * telegram_username, email, and email_verified from server-side verification, never
 * from the request body.
 */
export declare function upsertUserByTelegram(input: UpsertUserInput, q?: QueryFn): Promise<OwnUserRow | null>;
export declare function validateKeywordIds(keywordIds: number[], q?: QueryFn): Promise<void>;
/**
 * Within a single transaction: delete all existing user_keywords for `userId`,
 * then re-insert the given keyword_ids.  Atomic — either both happen or neither.
 */
export declare function replaceUserKeywords(userId: string, keywordIds: number[], pgPool?: typeof import('./pool').pool): Promise<void>;
/**
 * The maximum number of likes a user may send within a single UTC day. When a
 * caller is at this count, further like attempts return 429 until the daily
 * counter resets at the next UTC midnight.
 */
export declare const DAILY_LIKE_LIMIT = 30;
/**
 * True when `lastResetAt` is strictly BEFORE the UTC midnight that begins
 * `now`'s day — i.e. the daily like counter is stale and must be reset.
 *
 * The comparison is against today's UTC midnight (00:00:00Z). A `lastResetAt`
 * exactly at midnight is NOT before it, so a user whose counter was reset at
 * the boundary keeps their count until the next day.
 */
export declare function needsDailyReset(lastResetAt: Date, now: Date): boolean;
/** The result of a like attempt: whether a NEW like row was written, and the caller's post-call daily count. */
export interface LikeResult {
    liked: boolean;
    likes_sent_today: number;
}
/**
 * Record that `callerId` likes `targetId`, enforcing the daily like cap.
 *
 * On every call:
 * 1. Read the caller's `likes_sent_today` and `likes_reset_at` from their OWN
 *    row (identified by $1 = the authenticated caller). A missing row throws
 *    404 — it fails CLOSED rather than granting a fresh allowance.
 * 2. If `likes_reset_at` is before today's UTC midnight, the daily window has
 *    rolled over: reset `likes_sent_today = 0` and bump `likes_reset_at = now()`.
 *    The in-memory count is treated as 0 for the rest of this call.
 * 3. If the (possibly just-reset) count is >= DAILY_LIKE_LIMIT (30), throw
 *    HttpError(429) — the caller is over cap for today.
 * 4. Otherwise insert the like (ON CONFLICT DO NOTHING, so re-liking the same
 *    target is idempotent) and, ONLY when a new row was actually written,
 *    increment `likes_sent_today` by 1. A duplicate like therefore never burns
 *    the daily allowance.
 *
 * SECURITY INVARIANT: the identity comes only from `callerId` (the caller's own
 * row). Nothing about the reset window, the cap, or the counter is accepted as
 * an argument, so no request field can widen the cap or dodge the reset.
 *
 * @returns `{ liked, likes_sent_today }` — `liked` is false when the caller had
 *   already liked `targetId` (no new row, no increment).
 */
export declare function recordLike(callerId: string, targetId: string, q?: QueryFn): Promise<LikeResult>;
