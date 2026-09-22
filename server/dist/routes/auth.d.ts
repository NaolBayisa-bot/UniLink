import { Router, RequestHandler } from 'express';
import { upsertUserByTelegram } from '../db/users';
import { verifyGoogleIdToken } from '../services/google';
import { signToken } from '../services/jwt';
import { verifyInitData } from '../services/telegram';
/**
 * Dependencies the complete-signup handler uses. Injectable so tests can run
 * the flow hermetically without live Telegram / Google / DB calls.
 */
export interface CompleteSignupDeps {
    verifyInitData?: typeof verifyInitData;
    verifyGoogleIdToken?: typeof verifyGoogleIdToken;
    upsertUserByTelegram?: typeof upsertUserByTelegram;
    signToken?: typeof signToken;
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
export declare function createCompleteSignupHandler(deps?: CompleteSignupDeps): RequestHandler;
/**
 * Express router for /auth endpoints, using the real service dependencies.
 * Mounted at /auth so the complete-signup handler lives at POST /auth/complete-signup.
 */
export declare function createAuthRouter(deps?: CompleteSignupDeps): Router;
export declare const authRouter: Router;
