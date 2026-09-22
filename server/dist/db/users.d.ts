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
