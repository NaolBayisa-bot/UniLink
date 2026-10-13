import { Request } from 'express';
import { QueryResult } from 'pg';
import { query } from '../db/query';

/**
 * Type of the DB query functions used by these helpers. Defaults to the app's
 * real `query`, but may be injected in tests for hermetic / non-destructive
 * assertions.
 */
export type QueryFn = (
  text: string,
  params?: unknown[],
) => Promise<QueryResult>;

/**
 * Error carrying an HTTP status so route handlers can map it to a response.
 * These helpers throw it instead of writing to the response directly, keeping
 * them usable both inside Express handlers and from non-HTTP call sites.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Enforce that the authenticated caller (`req.userId`) is the same entity as
 * `targetId`. The caller's identity MUST come from req.userId — never from a
 * body/query user_id — mirroring a row-level security "owner" check.
 *
 * Throws HttpError(403) when the caller is not the target.
 */
export function assertIsSelf(req: Request, targetId: string): void {
  if (!req.userId || req.userId !== targetId) {
    throw new HttpError(403, 'You are not authorized to perform this action');
  }
}

/**
 * Return true if there is an ACTIVE match between the two users. Matches are
 * unordered: userA / userB order is irrelevant. An "active" match is one whose
 * unmatched_at is still NULL.
 */
export async function matchExistsBetween(
  userA: string,
  userB: string,
  q: QueryFn = query,
): Promise<boolean> {
  const row = await q(
    `SELECT id
       FROM matches
      WHERE (
            least(user_a_id, user_b_id),
            greatest(user_a_id, user_b_id)
            ) = (
            least($1::uuid, $2::uuid),
            greatest($1::uuid, $2::uuid)
            )
        AND unmatched_at IS NULL
      LIMIT 1`,
    [userA, userB],
  );
  return row.rows.length > 0;
}

/**
 * SQL predicate over the `blocks` table that is TRUE when a blocking
 * relationship exists between the caller parameter `callerParam` and the row
 * identified by `otherExpr`, in EITHER direction.
 *
 * Shared by isBlockedPair (a two-id pair check, $1/$2) and by the browse filter
 * (a correlated NOT EXISTS against each candidate row), so the "either direction
 * = mutual" rule can never drift apart between the two.
 *
 * SECURITY: only ever called with internal, hard-coded SQL fragments — never
 * with user input. `otherExpr` may be a parameter placeholder or a column
 * expression (e.g. `users.id` for the browse correlation).
 */
export function blockedPairPredicate(callerParam: string, otherExpr: string): string {
  return `(
            (blocker_id = ${callerParam} AND blocked_id = ${otherExpr})
         OR (blocker_id = ${otherExpr} AND blocked_id = ${callerParam})
          )`;
}

/**
 * Return true if either user has blocked the other (a "blocked pair").
 * Blocking is mutual for the purposes of visibility: if A blocked B, then B
 * cannot interact with A either.
 */
export async function isBlockedPair(
  userA: string,
  userB: string,
  q: QueryFn = query,
): Promise<boolean> {
  const row = await q(
    `SELECT 1 AS zero
       FROM blocks
      WHERE ${blockedPairPredicate('$1::uuid', '$2::uuid')}
      LIMIT 1`,
    [userA, userB],
  );
  return row.rows.length > 0;
}

/**
 * SQL condition over the `reports` table that is TRUE for a row which is an
 * OPEN report against the row identified by `targetExpr`.
 *
 * Shared by hasOpenReportAgainst (a single-target check, $1) and by the browse
 * filter (a correlated NOT EXISTS against each candidate row), so the "open
 * only" rule can never drift apart between the two.
 *
 * SECURITY: only ever called with internal, hard-coded SQL fragments — never
 * with user input. `targetExpr` may be a parameter placeholder or a column
 * expression (e.g. `users.id` for the browse correlation).
 */
export function openReportAgainstPredicate(targetExpr: string): string {
  return `reported_id = ${targetExpr} AND status = 'open'`;
}

/**
 * Return true if there is at least one OPEN report against the given user.
 */
export async function hasOpenReportAgainst(
  userId: string,
  q: QueryFn = query,
): Promise<boolean> {
  const row = await q(
    `SELECT 1 AS zero
       FROM reports
      WHERE ${openReportAgainstPredicate('$1::uuid')}
      LIMIT 1`,
    [userId],
  );
  return row.rows.length > 0;
}