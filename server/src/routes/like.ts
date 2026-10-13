import { RequestHandler, Router } from 'express';
import { HttpError } from '../middleware/authorization';
import { recordLike } from '../db/users';

/**
 * Dependencies the like handler uses. Injectable so tests can run the flow
 * hermetically without touching the database.
 */
export interface LikeDeps {
  recordLike?: typeof recordLike;
}

/**
 * Postgres accepts UUIDs only in the 8-4-4-4-12 hex form; checking the shape
 * here (400) stops a malformed :targetId from reaching the `::uuid` cast inside
 * the like query, which would otherwise surface as a 500.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export function createLikeHandler(deps: LikeDeps = {}): RequestHandler {
  const doLike = deps.recordLike ?? recordLike;

  return async (req, res) => {
    try {
      const callerId = req.userId;
      if (!callerId) {
        throw new HttpError(401, 'Authentication required');
      }

      // The only client-supplied value used: the target user id from the path.
      const targetId = String(req.params.targetId ?? '');
      if (!UUID_PATTERN.test(targetId)) {
        throw new HttpError(400, 'targetId must be a valid user id');
      }

      // Identity is the caller id only; the target id is the validated param.
      const result = await doLike(callerId, targetId);

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error('like failed:', err);
      res.status(500).json({ error: 'Failed to record like' });
    }
  };
}

/**
 * Express router for /like endpoints. Mounted behind jwtAuth so the handler
 * can rely on req.userId being present.
 */
export function createLikeRouter(deps: LikeDeps = {}): Router {
  const router = Router();
  router.post('/:targetId', createLikeHandler(deps));
  return router;
}

export const likeRouter: Router = createLikeRouter();
