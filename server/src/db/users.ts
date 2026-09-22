import {
  blockedPairPredicate,
  HttpError,
  matchExistsBetween,
  openReportAgainstPredicate,
} from '../middleware/authorization';
import { query } from './query';
import { pool } from './pool';

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

export type QueryFn = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: unknown[]; rowCount: number | null }>;

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
export async function getPublicProfile(
  userId: string,
  q: QueryFn = query,
): Promise<PublicProfile | null> {
  const { rows } = await q(
    `SELECT ${PUBLIC_PROFILE_COLUMNS}
       FROM users
      WHERE id = $1::uuid`,
    [userId],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as PublicProfile;
}

/**
 * Return the "revealed" profile of `targetId` to `requesterId`, but ONLY when
 * the two are actively matched. The extra sensitive fields (real_name,
 * department, telegram_username) are the reward for an established match.
 *
 * Throws HttpError(403) when there is no active match between the two users.
 * Returns null if the target row does not exist even though a match passes.
 */
export async function getRevealedProfile(
  requesterId: string,
  targetId: string,
  q: QueryFn = query,
): Promise<RevealedProfile | null> {
  const matched = await matchExistsBetween(requesterId, targetId, q as never);
  if (!matched) {
    throw new HttpError(403, 'Users are not matched');
  }

  const { rows } = await q(
    `SELECT ${PUBLIC_PROFILE_COLUMNS},
            real_name,
            department,
            telegram_username
       FROM users
      WHERE id = $1::uuid`,
    [targetId],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as RevealedProfile;
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
export async function browseProfiles(
  callerId: string,
  q: QueryFn = query,
): Promise<PublicProfile[]> {
  const { rows } = await q(
    `SELECT ${PUBLIC_PROFILE_COLUMNS}
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
               WHERE ${blockedPairPredicate('$1::uuid', 'users.id')}
            )
        AND NOT EXISTS (
              SELECT 1 FROM reports
               WHERE ${openReportAgainstPredicate('users.id')}
            )
      ORDER BY created_at DESC`,
    [callerId],
  );
  return rows as unknown as PublicProfile[];
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
] as const;

/**
 * Update the given user's own profile. The `gender` field, if present in
 * `fields`, is EXPLICITLY STRIPPED and has no effect on the stored gender —
 * gender is only ever changed through adminCorrectGender(). Fields are further
 * restricted to the SELF_EDITABLE_FIELDS allowlist.
 *
 * Returns the number of rows affected, or { rowCount: 0 } if there was nothing
 * safe to update (e.g. `fields` contained only `gender`).
 */
export async function updateOwnProfile(
  userId: string,
  fields: Record<string, unknown>,
  q: QueryFn = query,
): Promise<{ rowCount: number | null }> {
  // Build a clean map, explicitly ignoring gender (and any non-allowlisted key).
  const safe: Record<string, unknown> = {};
  for (const key of SELF_EDITABLE_FIELDS) {
    if (fields[key] !== undefined) safe[key] = fields[key];
  }

  if (Object.keys(safe).length === 0) {
    // Nothing updatable was provided — a silent no-op (gender is dropped).
    return { rowCount: 0 };
  }

  const columns = Object.keys(safe);
  // SET col1 = $2, col2 = $3, ...
  const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const params = [userId, ...columns.map((col) => safe[col])];

  const result = await q(
    `UPDATE users
        SET ${setClause}
      WHERE id = $1::uuid`,
    params,
  );

  return { rowCount: result ? result.rowCount : null };
}

/**
 * Admin-only path (Task 47-equivalent route) for correcting a user's gender.
 * This is the ONLY code path that may change gender. Rejects values other than
 * 'male'/'female' with HttpError(400). Must never be reachable via a normal
 * self-service profile update.
 */
export async function adminCorrectGender(
  userId: string,
  gender: string,
  q: QueryFn = query,
): Promise<{ rowCount: number | null }> {
  if (gender !== 'male' && gender !== 'female') {
    throw new HttpError(400, `Invalid gender: ${gender}`);
  }
  const result = await q(
    `UPDATE users
        SET gender = $2::text
      WHERE id = $1::uuid`,
    [userId, gender],
  );
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
export async function upsertUserByTelegram(
  input: UpsertUserInput,
  q: QueryFn = query,
): Promise<OwnUserRow | null> {
  const { rows } = await q(
    `INSERT INTO users (telegram_id, telegram_username, email, email_verified)
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
               created_at`,
    [
      input.telegram_id,
      input.telegram_username,
      input.email,
      input.email_verified,
    ],
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as OwnUserRow;
}
export async function validateKeywordIds(
  keywordIds: number[],
  q: QueryFn = query,
): Promise<void> {
  if (!Array.isArray(keywordIds)) {
    throw new HttpError(400, 'keyword_ids must be an array');
  }
  if (keywordIds.length < 5 || keywordIds.length > 10) {
    throw new HttpError(
      400,
      `keyword_ids must contain between 5 and 10 items (got ${keywordIds.length})`,
    );
  }
  if (keywordIds.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id < 1)) {
    throw new HttpError(400, 'each keyword_id must be a positive integer');
  }

  // Verify every id exists in the keywords table.
  const { rows } = await q<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt
       FROM keywords
      WHERE id = ANY($1::int[])`,
    [keywordIds],
  );
  const existingCount = parseInt(rows[0].cnt, 10);
  if (existingCount !== keywordIds.length) {
    throw new HttpError(400, 'one or more keyword_ids do not exist');
  }
}

/**
 * Within a single transaction: delete all existing user_keywords for `userId`,
 * then re-insert the given keyword_ids.  Atomic — either both happen or neither.
 */
export async function replaceUserKeywords(
  userId: string,
  keywordIds: number[],
  pgPool: typeof import('./pool').pool = pool,
): Promise<void> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM user_keywords
       WHERE user_id = $1::uuid`,
      [userId],
    );
    if (keywordIds.length > 0) {
      // Use UNNEST so we don't have to build a giant VALUES list; single param
      // array handles any array length cleanly.
      await client.query(
        `INSERT INTO user_keywords (user_id, keyword_id)
         SELECT $1::uuid, unnest($2::int[])`,
        [userId, keywordIds],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}