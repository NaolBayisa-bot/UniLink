"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.createCompleteSignupHandler = createCompleteSignupHandler;
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const users_1 = require("../db/users");
const google_1 = require("../services/google");
const jwt_1 = require("../services/jwt");
const telegram_1 = require("../services/telegram");
function badRequest(res, message) {
    res.status(400).json({ error: message });
}
function unauthorized(res, message) {
    res.status(401).json({ error: message });
}
function serverError(res, message) {
    res.status(500).json({ error: message });
}
/**
 * POST /complete-signup (mounted at /auth).
 *
 * Accepts { initDataRaw, googleIdToken }. It verifies the Telegram initData and
 * the Google ID token server-side, then upserts a `users` row keyed on the
 * verified telegram_id, and returns a signed JWT plus safe user fields.
 *
 * SECURITY INVARIANT: only initDataRaw and googleIdToken are read from the body.
 * A client-supplied telegram_id, user_id, email, or email_verified in the body
 * is NEVER read — every one of those values must come from the verification
 * steps above.
 */
function createCompleteSignupHandler(deps = {}) {
    const doVerifyInitData = deps.verifyInitData ?? telegram_1.verifyInitData;
    const doVerifyGoogle = deps.verifyGoogleIdToken ?? google_1.verifyGoogleIdToken;
    const doUpsert = deps.upsertUserByTelegram ?? users_1.upsertUserByTelegram;
    const doSignToken = deps.signToken ?? jwt_1.signToken;
    return async (req, res) => {
        const { initDataRaw, googleIdToken } = (req.body ?? {});
        if (typeof initDataRaw !== 'string' || initDataRaw.length === 0) {
            badRequest(res, 'initDataRaw is required');
            return;
        }
        if (typeof googleIdToken !== 'string' || googleIdToken.length === 0) {
            badRequest(res, 'googleIdToken is required');
            return;
        }
        // 1. Verify Telegram initData. Reject if invalid.
        let telegram;
        try {
            telegram = doVerifyInitData(initDataRaw);
        }
        catch {
            serverError(res, 'Telegram authentication is not configured');
            return;
        }
        if (!telegram) {
            unauthorized(res, 'Invalid Telegram initData');
            return;
        }
        // 2. Verify the Google ID token. Reject if invalid or email_verified is false.
        let google;
        try {
            google = await doVerifyGoogle(googleIdToken);
        }
        catch {
            serverError(res, 'Google authentication is not configured');
            return;
        }
        if (!google) {
            unauthorized(res, 'Invalid Google ID token');
            return;
        }
        // 3. Upsert keyed on the VERIFIED telegram_id. All identity values come from
        //    the two verification steps above — never from the request body.
        let user;
        try {
            user = await doUpsert({
                telegram_id: telegram.telegram_id,
                telegram_username: telegram.telegram_username,
                email: google.email,
                email_verified: google.email_verified,
            });
        }
        catch (error) {
            console.error('complete-signup upsert failed:', error);
            serverError(res, 'Failed to create user');
            return;
        }
        if (!user) {
            serverError(res, 'Failed to create user');
            return;
        }
        // 4. Issue a signed JWT for this user and return safe fields.
        let token;
        try {
            token = doSignToken(user.id);
        }
        catch (error) {
            console.error('complete-signup token signing failed:', error);
            serverError(res, 'Failed to sign token');
            return;
        }
        res.status(200).json({
            token,
            user: {
                id: user.id,
                telegram_id: Number(user.telegram_id),
                telegram_username: user.telegram_username,
                email: user.email,
                email_verified: user.email_verified,
                nickname: user.nickname,
                gender: user.gender,
                photo_public_id: user.photo_public_id,
                custom_interest_text: user.custom_interest_text,
                status: user.status,
                created_at: user.created_at,
            },
        });
    };
}
/**
 * Express router for /auth endpoints, using the real service dependencies.
 * Mounted at /auth so the complete-signup handler lives at POST /auth/complete-signup.
 */
function createAuthRouter(deps = {}) {
    const router = (0, express_1.Router)();
    router.post('/complete-signup', createCompleteSignupHandler(deps));
    return router;
}
exports.authRouter = createAuthRouter();
//# sourceMappingURL=auth.js.map