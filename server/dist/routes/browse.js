"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browseRouter = void 0;
exports.createBrowseHandler = createBrowseHandler;
exports.createBrowseRouter = createBrowseRouter;
const express_1 = require("express");
const authorization_1 = require("../middleware/authorization");
const users_1 = require("../db/users");
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
function createBrowseHandler(deps = {}) {
    const doBrowse = deps.browseProfiles ?? users_1.browseProfiles;
    return async (req, res) => {
        try {
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            // Note: deliberately ignores every other part of the request.
            const profiles = await doBrowse(callerId);
            res.status(200).json(profiles);
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
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
function createBrowseRouter(deps = {}) {
    const router = (0, express_1.Router)();
    router.get('/', createBrowseHandler(deps));
    return router;
}
exports.browseRouter = createBrowseRouter();
//# sourceMappingURL=browse.js.map