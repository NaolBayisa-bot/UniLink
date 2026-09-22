import { RequestHandler, Router } from 'express';
import { getPublicProfile, updateOwnProfile, validateKeywordIds, replaceUserKeywords } from '../db/users';
import { pool } from '../db/pool';
export interface ProfileDeps {
    updateOwnProfile?: typeof updateOwnProfile;
    getPublicProfile?: typeof getPublicProfile;
    validateKeywordIds?: typeof validateKeywordIds;
    replaceUserKeywords?: typeof replaceUserKeywords;
    pgPool?: typeof pool;
}
/**
 * POST /profile — update the CALLER's own profile (nickname + prompts +
 * custom_interest_text).
 *
 * SECURITY INVARIANT: identity ALWAYS comes from req.userId (set by jwtAuth).
 * A spoofed user_id in the body is ignored entirely — it is never read.
 */
export declare function createProfileHandler(deps?: ProfileDeps): RequestHandler;
/**
 * POST /profile/keywords — replace the CALLER's selected keywords.
 * Body: { keyword_ids: number[] } — must be 5–10 ids, all existing in keywords.
 * Runs in a transaction: DELETE old user_keywords, INSERT new ones.
 */
export declare function createKeywordsHandler(deps?: ProfileDeps): RequestHandler;
export declare function createProfileRouter(deps?: ProfileDeps): Router;
export declare const profileRouter: Router;
