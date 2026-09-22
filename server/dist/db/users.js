"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProfile = getPublicProfile;
exports.getRevealedProfile = getRevealedProfile;
exports.browseProfiles = browseProfiles;
exports.updateOwnProfile = updateOwnProfile;
exports.adminCorrectGender = adminCorrectGender;
exports.upsertUserByTelegram = upsertUserByTelegram;
exports.validateKeywordIds = validateKeywordIds;
exports.replaceUserKeywords = replaceUserKeywords;
const authorization_1 = require("../middleware/authorization");
const query_1 = require("./query");
const pool_1 = require("./pool");
const PUBLIC_PROFILE_COLUMNS = `
  id,
  nickname,
  gender,
  photo_public_id,
  custom_interest_text,
  created_at
`;
/**
 * Return the public profile row for `userId`, or null if the user does not
 * exist. Only the explicitly-listed, non-sensitive fields are selected.
 */
async function getPublicProfile(userId, q = query_1.query) {
    const { rows } = await q(`SELECT ${PUBLIC_PROFILE_COLUMNS}
       FROM users
      WHERE id = $1::uuid`, [userId]);
    if (rows.length === 0)
        return null;
    return rows[0];
}
/**
 * Return the "revealed" profile of `targetId` to `requesterId`, but ONLY when
 * the two are actively matched. The extra sensitive fields (real_name,
 * department, telegram_username) are the reward for an established match.
 *
 * Throws HttpError(403) when there is no active match between the two users.
 * Returns null if the target row does not exist even though a match passes.
 */
async function getRevealedProfile(requesterId, targetId, q = query_1.query) {
    const matched = await (0, authorization_1.matchExistsBetween)(requesterId, targetId, q);
    if (!matched) {
        throw new authorization_1.HttpError(403, 'Users are not matched');
    }
    const { rows } = await q(`SELECT ${PUBLIC_PROFILE_COLUMNS},
            real_name,
            department,
            telegram_username
       FROM users
      WHERE id = $1::uuid`, [targetId]);
    if (rows.length === 0)
        return null;
    return rows[0];
}
/**
 * How long a pass hides its target from the passer's browse feed. After this
 * window the pass expires and the user becomes browsable again.
 */
const PASS_EXCLUSION_WINDOW_DAYS = 15;
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
async function browseProfiles(callerId, q = query_1.query) {
    const { rows } = await q(`SELECT ${PUBLIC_PROFILE_COLUMNS}
       FROM users
      WHERE id <> $1::uuid
        AND status = 'active'
        AND gender <> (SELECT gender FROM users WHERE id = $1::uuid)
        AND id NOT IN (
              SELECT to_user_id FROM likes WHERE from_user_id = $1::uuid
            )
        AND id NOT IN (
              SELECT to_user_id FROM passes
               WHERE from_user_id = $1::uuid
                 AND created_at > now() - interval '${PASS_EXCLUSION_WINDOW_DAYS} days'
            )
        AND NOT EXISTS (
              SELECT 1 FROM blocks
               WHERE ${(0, authorization_1.blockedPairPredicate)('$1::uuid', 'users.id')}
            )
        AND NOT EXISTS (
              SELECT 1 FROM reports
               WHERE ${(0, authorization_1.openReportAgainstPredicate)('users.id')}
            )
      ORDER BY created_at DESC`, [callerId]);
    return rows;
}
/**
 * The fields a user may set on their own profile. `gender` is deliberately
 * absent: it is NOT self-settable and must be changed only via
 * adminCorrectGender(). This allowlist also prevents any unexpected column
 * from being injected into an UPDATE statement.
 */
const SELF_EDITABLE_FIELDS = [
    'nickname',
    'real_name',
    'department',
    'photo_public_id',
    // Display-only free text. PRIVACY / SCORING INVARIANT: never join this into
    // the browse-scoring query (enforced in Task 39); see profile.ts.
    'custom_interest_text',
    'telegram_username',
    'prompts',
];
/**
 * Update the given user's own profile. The `gender` field, if present in
 * `fields`, is EXPLICITLY STRIPPED and has no effect on the stored gender —
 * gender is only ever changed through adminCorrectGender(). Fields are further
 * restricted to the SELF_EDITABLE_FIELDS allowlist.
 *
 * Returns the number of rows affected, or { rowCount: 0 } if there was nothing
 * safe to update (e.g. `fields` contained only `gender`).
 */
async function updateOwnProfile(userId, fields, q = query_1.query) {
    // Build a clean map, explicitly ignoring gender (and any non-allowlisted key).
    const safe = {};
    for (const key of SELF_EDITABLE_FIELDS) {
        if (fields[key] !== undefined)
            safe[key] = fields[key];
    }
    if (Object.keys(safe).length === 0) {
        // Nothing updatable was provided — a silent no-op (gender is dropped).
        return { rowCount: 0 };
    }
    const columns = Object.keys(safe);
    // SET col1 = $2, col2 = $3, ...
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const params = [userId, ...columns.map((col) => safe[col])];
    const result = await q(`UPDATE users
        SET ${setClause}
      WHERE id = $1::uuid`, params);
    return { rowCount: result ? result.rowCount : null };
}
/**
 * Admin-only path (Task 47-equivalent route) for correcting a user's gender.
 * This is the ONLY code path that may change gender. Rejects values other than
 * 'male'/'female' with HttpError(400). Must never be reachable via a normal
 * self-service profile update.
 */
async function adminCorrectGender(userId, gender, q = query_1.query) {
    if (gender !== 'male' && gender !== 'female') {
        throw new authorization_1.HttpError(400, `Invalid gender: ${gender}`);
    }
    const result = await q(`UPDATE users
        SET gender = $2::text
      WHERE id = $1::uuid`, [userId, gender]);
    return { rowCount: result ? result.rowCount : null };
}
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
async function upsertUserByTelegram(input, q = query_1.query) {
    const { rows } = await q(`INSERT INTO users (telegram_id, telegram_username, email, email_verified)
     VALUES ($1::bigint, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE
       SET telegram_username = EXCLUDED.telegram_username
     RETURNING id,
               telegram_id,
               telegram_username,
               email,
               email_verified,
               nickname,
               gender,
               photo_public_id,
               custom_interest_text,
               prompts,
               status,
               created_at`, [
        input.telegram_id,
        input.telegram_username,
        input.email,
        input.email_verified,
    ]);
    if (rows.length === 0)
        return null;
    return rows[0];
}
async function validateKeywordIds(keywordIds, q = query_1.query) {
    if (!Array.isArray(keywordIds)) {
        throw new authorization_1.HttpError(400, 'keyword_ids must be an array');
    }
    if (keywordIds.length < 5 || keywordIds.length > 10) {
        throw new authorization_1.HttpError(400, `keyword_ids must contain between 5 and 10 items (got ${keywordIds.length})`);
    }
    if (keywordIds.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id < 1)) {
        throw new authorization_1.HttpError(400, 'each keyword_id must be a positive integer');
    }
    // Verify every id exists in the keywords table.
    const { rows } = await q(`SELECT COUNT(*) AS cnt
       FROM keywords
      WHERE id = ANY($1::int[])`, [keywordIds]);
    const existingCount = parseInt(rows[0].cnt, 10);
    if (existingCount !== keywordIds.length) {
        throw new authorization_1.HttpError(400, 'one or more keyword_ids do not exist');
    }
}
/**
 * Within a single transaction: delete all existing user_keywords for `userId`,
 * then re-insert the given keyword_ids.  Atomic — either both happen or neither.
 */
async function replaceUserKeywords(userId, keywordIds, pgPool = pool_1.pool) {
    const client = await pgPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM user_keywords
       WHERE user_id = $1::uuid`, [userId]);
        if (keywordIds.length > 0) {
            // Use UNNEST so we don't have to build a giant VALUES list; single param
            // array handles any array length cleanly.
            await client.query(`INSERT INTO user_keywords (user_id, keyword_id)
         SELECT $1::uuid, unnest($2::int[])`, [userId, keywordIds]);
        }
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=users.js.map