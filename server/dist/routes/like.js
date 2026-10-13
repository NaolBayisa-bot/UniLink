"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeRouter = void 0;
exports.createLikeHandler = createLikeHandler;
exports.createLikeRouter = createLikeRouter;
const express_1 = require("express");
const authorization_1 = require("../middleware/authorization");
const users_1 = require("../db/users");
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
function createLikeHandler(deps = {}) {
    const doLike = deps.recordLike ?? users_1.recordLike;
    return async (req, res) => {
        try {
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            // The only client-supplied value used: the target user id from the path.
            const targetId = String(req.params.targetId ?? '');
            if (!UUID_PATTERN.test(targetId)) {
                throw new authorization_1.HttpError(400, 'targetId must be a valid user id');
            }
            // Identity is the caller id only; the target id is the validated param.
            const result = await doLike(callerId, targetId);
            res.status(201).json(result);
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
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
function createLikeRouter(deps = {}) {
    const router = (0, express_1.Router)();
    router.post('/:targetId', createLikeHandler(deps));
    return router;
}
exports.likeRouter = createLikeRouter();
//# sourceMappingURL=like.js.map