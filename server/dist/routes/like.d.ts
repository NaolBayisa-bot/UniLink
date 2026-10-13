import { RequestHandler, Router } from 'express';
import { recordLike } from '../db/users';
/**
 * Dependencies the like handler uses. Injectable so tests can run the flow
 * hermetically without touching the database.
 */
export interface LikeDeps {
    recordLike?: typeof recordLike;
}
/**
 * POST /like/:targetId (mounted at /like).
 *
 * Records that the authenticated caller likes `targetId`, enforcing the daily
 * like cap (DAILY_LIKE_LIMIT). The full reset/cap logic lives in `recordLike`:
 * on each call it rolls the daily window over at UTC midnight, returns 429 when
 * the caller is over cap, and only counts NEW likes against the allowance.
 *
 * SECURITY INVARIANT (identity): the caller comes ONLY from req.userId (set by
 * jwtAuth) and is the sole argument passed to the data layer. req.body,
 * req.query, req.params (other than :targetId) and req.headers are NEVER read,
 * so a forged user_id anywhere in the request cannot change who the like is
 * attributed to or widen the daily cap.
 */
export declare function createLikeHandler(deps?: LikeDeps): RequestHandler;
/**
 * Express router for /like endpoints. Mounted behind jwtAuth so the handler
 * can rely on req.userId being present.
 */
export declare function createLikeRouter(deps?: LikeDeps): Router;
export declare const likeRouter: Router;
