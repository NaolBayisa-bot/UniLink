"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
exports.createProfileHandler = createProfileHandler;
exports.createKeywordsHandler = createKeywordsHandler;
exports.createProfileRouter = createProfileRouter;
const express_1 = require("express");
const authorization_1 = require("../middleware/authorization");
const users_1 = require("../db/users");
const pool_1 = require("../db/pool");
const NICKNAME_MAX = 50;
const PROMPTS_MAX = 6;
const CUSTOM_INTEREST_TEXT_MAX = 280;
const MIN_KEYWORDS = 5;
const MAX_KEYWORDS = 10;
function isPromptObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function validateNickname(nickname) {
    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
        throw new authorization_1.HttpError(400, 'nickname is required and must be non-empty');
    }
    const trimmed = nickname.trim();
    if (trimmed.length > NICKNAME_MAX) {
        throw new authorization_1.HttpError(400, `nickname must be at most ${NICKNAME_MAX} characters`);
    }
    return trimmed;
}
function validatePrompts(prompts) {
    if (prompts === undefined || prompts === null)
        return null;
    if (!Array.isArray(prompts)) {
        throw new authorization_1.HttpError(400, 'prompts must be an array');
    }
    if (prompts.length > PROMPTS_MAX) {
        throw new authorization_1.HttpError(400, `prompts must be at most ${PROMPTS_MAX} items`);
    }
    if (prompts.some((p) => !isPromptObject(p))) {
        throw new authorization_1.HttpError(400, 'each prompt must be an object of { prompt, answer }');
    }
    return prompts;
}
/**
 * Validate the CALLER's free-text "custom_interest_text".
 *
 * Semantics:
 * - `null` clears the field (stores SQL NULL).
 * - A string is trimmed; it must be non-empty and at most
 *   CUSTOM_INTEREST_TEXT_MAX (280) characters.
 *
 * PRIVACY / SCORING INVARIANT: this field is DISPLAY-ONLY. It must NEVER be
 * joined into (or read by) the browse-scoring query — user-supplied free text
 * must not be able to influence match ranking. Enforced in Task 39.
 */
function validateCustomInterestText(v) {
    if (v === null)
        return null;
    if (typeof v !== 'string') {
        throw new authorization_1.HttpError(400, 'custom_interest_text must be a string or null');
    }
    const trimmed = v.trim();
    if (trimmed.length === 0) {
        throw new authorization_1.HttpError(400, 'custom_interest_text must be non-empty');
    }
    if (trimmed.length > CUSTOM_INTEREST_TEXT_MAX) {
        throw new authorization_1.HttpError(400, `custom_interest_text must be at most ${CUSTOM_INTEREST_TEXT_MAX} characters`);
    }
    return trimmed;
}
function validateKeywordIdsFromBody(keywordIds) {
    if (!Array.isArray(keywordIds)) {
        throw new authorization_1.HttpError(400, 'keyword_ids must be an array');
    }
    if (keywordIds.length < MIN_KEYWORDS || keywordIds.length > MAX_KEYWORDS) {
        throw new authorization_1.HttpError(400, `keyword_ids must contain between ${MIN_KEYWORDS} and ${MAX_KEYWORDS} items (got ${keywordIds.length})`);
    }
    if (keywordIds.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id < 1)) {
        throw new authorization_1.HttpError(400, 'each keyword_id must be a positive integer');
    }
    return keywordIds;
}
/**
 * POST /profile — update the CALLER's own profile (nickname + prompts +
 * custom_interest_text).
 *
 * SECURITY INVARIANT: identity ALWAYS comes from req.userId (set by jwtAuth).
 * A spoofed user_id in the body is ignored entirely — it is never read.
 */
function createProfileHandler(deps = {}) {
    const doUpdate = deps.updateOwnProfile ?? users_1.updateOwnProfile;
    const doGetPublic = deps.getPublicProfile ?? users_1.getPublicProfile;
    return async (req, res) => {
        try {
            const body = (req.body ?? {});
            if (typeof body.nickname === 'undefined' &&
                typeof body.prompts === 'undefined' &&
                typeof body.custom_interest_text === 'undefined') {
                throw new authorization_1.HttpError(400, 'nothing to update');
            }
            const fields = {};
            if (body.nickname !== undefined) {
                fields.nickname = validateNickname(body.nickname);
            }
            if (body.prompts !== undefined) {
                fields.prompts = validatePrompts(body.prompts);
            }
            if (body.custom_interest_text !== undefined) {
                fields.custom_interest_text = validateCustomInterestText(body.custom_interest_text);
            }
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            const result = await doUpdate(callerId, fields);
            if (result.rowCount === 0) {
                throw new authorization_1.HttpError(404, 'User not found');
            }
            const profile = await doGetPublic(callerId);
            if (!profile) {
                throw new authorization_1.HttpError(404, 'User not found');
            }
            res.status(200).json(profile);
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            console.error('profile update failed:', err);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    };
}
/**
 * POST /profile/keywords — replace the CALLER's selected keywords.
 * Body: { keyword_ids: number[] } — must be 5–10 ids, all existing in keywords.
 * Runs in a transaction: DELETE old user_keywords, INSERT new ones.
 */
function createKeywordsHandler(deps = {}) {
    const doValidate = deps.validateKeywordIds ?? users_1.validateKeywordIds;
    const doReplace = deps.replaceUserKeywords ?? users_1.replaceUserKeywords;
    const poolOverride = deps.pgPool ?? pool_1.pool;
    return async (req, res) => {
        try {
            const body = (req.body ?? {});
            if (!body.keyword_ids) {
                throw new authorization_1.HttpError(400, 'keyword_ids is required');
            }
            const keywordIds = validateKeywordIdsFromBody(body.keyword_ids);
            const callerId = req.userId;
            if (!callerId) {
                throw new authorization_1.HttpError(401, 'Authentication required');
            }
            // Validate that all keyword ids exist.
            await doValidate(keywordIds, (text, params) => pool_1.pool.query(text, params));
            // Atomically replace the caller's keywords.
            await doReplace(callerId, keywordIds, poolOverride);
            res.status(200).json({ ok: true, keyword_ids: keywordIds });
        }
        catch (err) {
            if (err instanceof authorization_1.HttpError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            console.error('profile keywords update failed:', err);
            res.status(500).json({ error: 'Failed to update keywords' });
        }
    };
}
function createProfileRouter(deps = {}) {
    const router = (0, express_1.Router)();
    router.post('/', createProfileHandler(deps));
    router.post('/keywords', createKeywordsHandler(deps));
    return router;
}
exports.profileRouter = createProfileRouter();
//# sourceMappingURL=profile.js.map