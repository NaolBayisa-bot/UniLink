import { RequestHandler, Router } from 'express';
import { HttpError } from '../middleware/authorization';
import { getPublicProfile, updateOwnProfile, validateKeywordIds, replaceUserKeywords } from '../db/users';
import { pool } from '../db/pool';

export interface ProfileDeps {
  updateOwnProfile?: typeof updateOwnProfile;
  getPublicProfile?: typeof getPublicProfile;
  validateKeywordIds?: typeof validateKeywordIds;
  replaceUserKeywords?: typeof replaceUserKeywords;
  pgPool?: typeof pool;
}

interface ProfileBody {
  nickname?: unknown;
  prompts?: unknown;
  custom_interest_text?: unknown;
  user_id?: unknown;
}

interface KeywordsBody {
  keyword_ids?: unknown;
}

const NICKNAME_MAX = 50;
const PROMPTS_MAX = 6;
const CUSTOM_INTEREST_TEXT_MAX = 280;
const MIN_KEYWORDS = 5;
const MAX_KEYWORDS = 10;

function isPromptObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateNickname(nickname: unknown): string {
  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    throw new HttpError(400, 'nickname is required and must be non-empty');
  }
  const trimmed = nickname.trim();
  if (trimmed.length > NICKNAME_MAX) {
    throw new HttpError(400, `nickname must be at most ${NICKNAME_MAX} characters`);
  }
  return trimmed;
}

function validatePrompts(prompts: unknown): unknown[] | null {
  if (prompts === undefined || prompts === null) return null;
  if (!Array.isArray(prompts)) {
    throw new HttpError(400, 'prompts must be an array');
  }
  if (prompts.length > PROMPTS_MAX) {
    throw new HttpError(400, `prompts must be at most ${PROMPTS_MAX} items`);
  }
  if (prompts.some((p) => !isPromptObject(p))) {
    throw new HttpError(400, 'each prompt must be an object of { prompt, answer }');
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
function validateCustomInterestText(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') {
    throw new HttpError(400, 'custom_interest_text must be a string or null');
  }
  const trimmed = v.trim();
  if (trimmed.length === 0) {
    throw new HttpError(400, 'custom_interest_text must be non-empty');
  }
  if (trimmed.length > CUSTOM_INTEREST_TEXT_MAX) {
    throw new HttpError(
      400,
      `custom_interest_text must be at most ${CUSTOM_INTEREST_TEXT_MAX} characters`,
    );
  }
  return trimmed;
}

function validateKeywordIdsFromBody(keywordIds: unknown): number[] {
  if (!Array.isArray(keywordIds)) {
    throw new HttpError(400, 'keyword_ids must be an array');
  }
  if (keywordIds.length < MIN_KEYWORDS || keywordIds.length > MAX_KEYWORDS) {
    throw new HttpError(
      400,
      `keyword_ids must contain between ${MIN_KEYWORDS} and ${MAX_KEYWORDS} items (got ${keywordIds.length})`,
    );
  }
  if (keywordIds.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id < 1)) {
    throw new HttpError(400, 'each keyword_id must be a positive integer');
  }
  return keywordIds as number[];
}

/**
 * POST /profile — update the CALLER's own profile (nickname + prompts +
 * custom_interest_text).
 *
 * SECURITY INVARIANT: identity ALWAYS comes from req.userId (set by jwtAuth).
 * A spoofed user_id in the body is ignored entirely — it is never read.
 */
export function createProfileHandler(deps: ProfileDeps = {}): RequestHandler {
  const doUpdate = deps.updateOwnProfile ?? updateOwnProfile;
  const doGetPublic = deps.getPublicProfile ?? getPublicProfile;

  return async (req, res) => {
    try {
      const body = (req.body ?? {}) as ProfileBody;

      if (
        typeof body.nickname === 'undefined' &&
        typeof body.prompts === 'undefined' &&
        typeof body.custom_interest_text === 'undefined'
      ) {
        throw new HttpError(400, 'nothing to update');
      }

      const fields: Record<string, unknown> = {};
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
        throw new HttpError(401, 'Authentication required');
      }

      const result = await doUpdate(callerId, fields);
      if (result.rowCount === 0) {
        throw new HttpError(404, 'User not found');
      }

      const profile = await doGetPublic(callerId);
      if (!profile) {
        throw new HttpError(404, 'User not found');
      }

      res.status(200).json(profile);
    } catch (err) {
      if (err instanceof HttpError) {
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
export function createKeywordsHandler(deps: ProfileDeps = {}): RequestHandler {
  const doValidate = deps.validateKeywordIds ?? validateKeywordIds;
  const doReplace = deps.replaceUserKeywords ?? replaceUserKeywords;
  const poolOverride = deps.pgPool ?? pool;

  return async (req, res) => {
    try {
      const body = (req.body ?? {}) as KeywordsBody;

      if (!body.keyword_ids) {
        throw new HttpError(400, 'keyword_ids is required');
      }

      const keywordIds = validateKeywordIdsFromBody(body.keyword_ids);

      const callerId = req.userId;
      if (!callerId) {
        throw new HttpError(401, 'Authentication required');
      }

      // Validate that all keyword ids exist.
      await doValidate(keywordIds, (text, params) => pool.query(text, params));

      // Atomically replace the caller's keywords.
      await doReplace(callerId, keywordIds, poolOverride);

      res.status(200).json({ ok: true, keyword_ids: keywordIds });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error('profile keywords update failed:', err);
      res.status(500).json({ error: 'Failed to update keywords' });
    }
  };
}

export function createProfileRouter(deps: ProfileDeps = {}): Router {
  const router = Router();
  router.post('/', createProfileHandler(deps));
  router.post('/keywords', createKeywordsHandler(deps));
  return router;
}

export const profileRouter: Router = createProfileRouter();
