import { Request } from 'express';
import { QueryResult } from 'pg';
/**
 * Type of the DB query functions used by these helpers. Defaults to the app's
 * real `query`, but may be injected in tests for hermetic / non-destructive
 * assertions.
 */
export type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult>;
/**
 * Error carrying an HTTP status so route handlers can map it to a response.
 * These helpers throw it instead of writing to the response directly, keeping
 * them usable both inside Express handlers and from non-HTTP call sites.
 */
export declare class HttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/**
 * Enforce that the authenticated caller (`req.userId`) is the same entity as
 * `targetId`. The caller's identity MUST come from req.userId — never from a
 * body/query user_id — mirroring a row-level security "owner" check.
 *
 * Throws HttpError(403) when the caller is not the target.
 */
export declare function assertIsSelf(req: Request, targetId: string): void;
/**
 * Return true if there is an ACTIVE match between the two users. Matches are
 * unordered: userA / userB order is irrelevant. An "active" match is one whose
 * unmatched_at is still NULL.
 */
export declare function matchExistsBetween(userA: string, userB: string, q?: QueryFn): Promise<boolean>;
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
export declare function blockedPairPredicate(callerParam: string, otherExpr: string): string;
/**
 * Return true if either user has blocked the other (a "blocked pair").
 * Blocking is mutual for the purposes of visibility: if A blocked B, then B
 * cannot interact with A either.
 */
export declare function isBlockedPair(userA: string, userB: string, q?: QueryFn): Promise<boolean>;
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
export declare function openReportAgainstPredicate(targetExpr: string): string;
/**
 * Return true if there is at least one OPEN report against the given user.
 */
export declare function hasOpenReportAgainst(userId: string, q?: QueryFn): Promise<boolean>;
