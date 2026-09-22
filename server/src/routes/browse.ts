import { RequestHandler, Router } from 'express';
import { HttpError } from '../middleware/authorization';
import { browseProfiles } from '../db/users';

/**
 * Dependencies the browse handler uses. Injectable so tests can run the flow
 * hermetically without touching the database.
 */
export interface BrowseDeps {
  browseProfiles?: typeof browseProfiles;
}

/**
 * GET /browse (mounted at /browse).
 *
 * Returns the ACTIVE users whose gender differs from the caller's own, as the
 * Task-22 public-profile field set only. Also excluded: users the caller has
 * already liked, users the caller passed within the last 15 days (older passes
 * expire), users in a blocking relationship with the caller in EITHER direction
 * (the same rule as isBlockedPair), and users with an OPEN report against them
 * (the same rule as hasOpenReportAgainst — resolving the report restores them).
 *
 * SECURITY INVARIANT (identity + gender + exclusion set): the caller's identity,
 * their gender, and the ids to exclude all come from req.userId (set by jwtAuth)
 * — `browseProfiles` derives each straight from the caller's own rows. req.body,
 * req.query, req.params and req.headers are NEVER read, so a forged `gender` or a
 * spoofed/forged `user_id` anywhere in the request cannot influence the query or
 * the result.
 */
export function createBrowseHandler(deps: BrowseDeps = {}): RequestHandler {
  const doBrowse = deps.browseProfiles ?? browseProfiles;

  return async (req, res) => {
    try {
      const callerId = req.userId;
      if (!callerId) {
        throw new HttpError(401, 'Authentication required');
      }

      // Note: deliberately ignores every other part of the request.
      const profiles = await doBrowse(callerId);

      res.status(200).json(profiles);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error('browse failed:', err);
      res.status(500).json({ error: 'Failed to browse profiles' });
    }
  };
}

/**
 * Express router for /browse endpoints. Mounted behind jwtAuth so the handler
 * can rely on req.userId being present.
 */
export function createBrowseRouter(deps: BrowseDeps = {}): Router {
  const router = Router();
  router.get('/', createBrowseHandler(deps));
  return router;
}

export const browseRouter: Router = createBrowseRouter();
