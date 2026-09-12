import { HttpError, matchExistsBetween } from '../middleware/authorization';
import { query } from './query';

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
  'custom_interest_text',
  'telegram_username',
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