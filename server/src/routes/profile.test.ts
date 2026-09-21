import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Request, Response } from 'express';
import { createProfileHandler, createKeywordsHandler, ProfileDeps } from './profile';
import { PublicProfile } from '../db/users';

// The authenticated caller (identity set on req.userId by jwtAuth).
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A malicious id a client might sneak into the request body to try to update /
// return SOMEONE ELSE's profile.
const SPOOFED_ID = '1a2b3c4d-5e6f-4a5b-9c8d-0e1f2a3b4c5d';

const DEFAULT_PROFILE: PublicProfile = {
  id: CALLER_ID,
  nickname: 'UserA',
  gender: 'male',
  photo_public_id: null,
  custom_interest_text: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
};

interface CallOpts {
  userId?: string;
  body: Record<string, unknown>;
  rowCount?: number | null;
  profile?: PublicProfile | null;
  updateThrows?: boolean;
  getProfileThrows?: boolean;
}

/** Build a handler with controllable fakes and run it against mock req/res. */
async function call(opts: CallOpts) {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const deps: ProfileDeps = {
    updateOwnProfile: (async (userId: unknown, fields: unknown) => {
      calls.push({ name: 'updateOwnProfile', args: [userId, fields] });
      if (opts.updateThrows) throw new Error('db down');
      return { rowCount: opts.rowCount ?? 1 };
    }) as typeof import('../db/users').updateOwnProfile,

    getPublicProfile: (async (userId: unknown) => {
      calls.push({ name: 'getPublicProfile', args: [userId] });
      if (opts.getProfileThrows) throw new Error('db down');
      return opts.profile === undefined ? DEFAULT_PROFILE : opts.profile;
    }) as typeof import('../db/users').getPublicProfile,
  };

  const handler = createProfileHandler(deps);

  let status = 0;
  let body: unknown;
  const req = { body: opts.body, userId: opts.userId } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  } as unknown as Response;

  await handler(req, res, () => undefined);

  return { status, body, calls };
}

describe('POST /profile', () => {
  it('updates the caller and returns their own safe profile fields', async () => {
    const { status, body, calls } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice' },
    });

    assert.equal(status, 200);

    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.equal(update?.args[0], CALLER_ID);
    assert.deepEqual(update?.args[1], { nickname: 'Alice' });

    const getProfile = calls.find((c) => c.name === 'getPublicProfile');
    assert.equal(getProfile?.args[0], CALLER_ID);

    const json = body as PublicProfile;
    assert.equal(json.id, CALLER_ID);
    assert.equal(json.nickname, 'UserA');
    // only safe public fields are returned
    assert.deepEqual(Object.keys(json).sort(), [
      'created_at',
      'custom_interest_text',
      'gender',
      'id',
      'nickname',
      'photo_public_id',
    ]);
  });

  it('updates prompts (independently of nickname)', async () => {
    const prompts = [{ prompt: 'Hello?', answer: 'Hi!' }];
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { prompts },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { prompts });
  });

  it('updates nickname and prompts together', async () => {
    const prompts = [{ prompt: 'q', answer: 'a' }, { prompt: 'q2', answer: 'a2' }];
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { nickname: '  Alice  ', prompts },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    // nickname is trimmed before persisting
    assert.deepEqual(update?.args[1], { nickname: 'Alice', prompts });
  });
it('ignores a spoofed user_id in the body — identity always comes from req.userId', async () => {
    const { status, body, calls } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice', user_id: SPOOFED_ID },
    });

    assert.equal(status, 200);

    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.equal(
      update?.args[0],
      CALLER_ID,
      'update must target the authenticated caller, never the spoofed user_id',
    );

    // The spoofed id must never reach ANY db call and must not appear in the response.
    assert.ok(
      calls.every((c) => !JSON.stringify(c.args).includes(SPOOFED_ID)),
      'spoofed user_id must never be used as an argument',
    );
    assert.ok(
      !JSON.stringify(body).includes(SPOOFED_ID),
      'spoofed user_id must never leak into the response',
    );
    assert.equal((body as PublicProfile).id, CALLER_ID);
  });

  it('updates custom_interest_text (independently of nickname/prompts)', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: 'I love hiking and reggae' },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { custom_interest_text: 'I love hiking and reggae' });
  });

  it('trims custom_interest_text before persisting', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: '   hi   ' },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { custom_interest_text: 'hi' });
  });

  it('200 when custom_interest_text is exactly the max (280 chars)', async () => {
    const text = 'x'.repeat(280);
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: text },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { custom_interest_text: text });
  });

  it('400 when custom_interest_text is 281 chars (above maximum)', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: 'x'.repeat(281) },
    });
    assert.equal(status, 400);
    assert.equal(calls.length, 0, 'no db call should run for oversized text');
  });

  it('400 when custom_interest_text is empty or whitespace', async () => {
    for (const text of ['', '   ', '\t\n']) {
      const { status, calls } = await call({
        userId: CALLER_ID,
        body: { custom_interest_text: text },
      });
      assert.equal(status, 400, `custom_interest_text ${JSON.stringify(text)} must be rejected`);
      assert.equal(calls.length, 0, 'no db call should run for empty text');
    }
  });

  it('400 when custom_interest_text is neither a string nor null', async () => {
    for (const bad of [42, ['a'], { text: 'a' }, true]) {
      const { status, calls } = await call({
        userId: CALLER_ID,
        body: { custom_interest_text: bad },
      });
      assert.equal(status, 400, `custom_interest_text ${JSON.stringify(bad)} must be rejected`);
      assert.equal(calls.length, 0, 'no db call should run for a non-string value');
    }
  });

  it('200 and clears custom_interest_text when null is sent', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: null },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    // null is passed through so updateOwnProfile writes SQL NULL (clearing it).
    assert.deepEqual(update?.args[1], { custom_interest_text: null });
  });

  it('updates nickname and custom_interest_text together', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { nickname: '  Alice  ', custom_interest_text: 'chess club' },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { nickname: 'Alice', custom_interest_text: 'chess club' });
  });

  it('ignores a spoofed user_id when custom_interest_text is also present', async () => {
    const { status, body, calls } = await call({
      userId: CALLER_ID,
      body: { custom_interest_text: 'hi', user_id: SPOOFED_ID },
    });

    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.equal(update?.args[0], CALLER_ID);
    assert.ok(
      calls.every((c) => !JSON.stringify(c.args).includes(SPOOFED_ID)),
      'spoofed user_id must never be used as an argument',
    );
    assert.ok(
      !JSON.stringify(body).includes(SPOOFED_ID),
      'spoofed user_id must never leak into the response',
    );
  });

  it('400 when the body has nothing updatable (empty body)', async () => {
    const { status, calls } = await call({ userId: CALLER_ID, body: {} });
    assert.equal(status, 400);
    assert.equal(calls.length, 0, 'no db calls should run when there is nothing to update');
  });

  it('400 when the body only contains non-editable user_id / gender', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { user_id: SPOOFED_ID, gender: 'female' },
    });
    assert.equal(status, 400);
    assert.equal(calls.length, 0, 'non-editable fields must not trigger a db write');
  });

  it('400 when nickname is empty or whitespace', async () => {
    for (const nickname of ['', '   ', '\t\n']) {
      const { status } = await call({ userId: CALLER_ID, body: { nickname } });
      assert.equal(status, 400, `nickname ${JSON.stringify(nickname)} must be rejected`);
    }
  });

  it('400 when nickname is longer than 50 characters', async () => {
    const { status } = await call({ userId: CALLER_ID, body: { nickname: 'x'.repeat(51) } });
    assert.equal(status, 400);
  });

  it('200 when nickname is exactly the max (50 trimmed)', async () => {
    const { status, calls } = await call({ userId: CALLER_ID, body: { nickname: 'x'.repeat(50) } });
    assert.equal(status, 200);
    const update = calls.find((c) => c.name === 'updateOwnProfile');
    assert.deepEqual(update?.args[1], { nickname: 'x'.repeat(50) });
  });

  it('400 when prompts is not an array', async () => {
    const { status } = await call({ userId: CALLER_ID, body: { prompts: 'nope' } });
    assert.equal(status, 400);
  });

  it('400 when prompts has more than 6 items', async () => {
    const many = Array.from({ length: 7 }, () => ({ prompt: 'p', answer: 'a' }));
    const { status } = await call({ userId: CALLER_ID, body: { prompts: many } });
    assert.equal(status, 400);
  });

  it('400 when a prompt element is not an object', async () => {
    const { status } = await call({
      userId: CALLER_ID,
      body: { prompts: [{ prompt: 'p', answer: 'a' }, 'not-an-object'] },
    });
    assert.equal(status, 400);
  });

  it('404 when updateOwnProfile affects no rows (user gone)', async () => {
    const { status, body } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice' },
      rowCount: 0,
    });
    assert.equal(status, 404);
    assert.equal((body as { error: string }).error, 'User not found');
  });

  it('404 when the profile cannot be read back', async () => {
    const { status } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice' },
      profile: null,
    });
    assert.equal(status, 404);
  });

  it('500 when the update throws an unexpected error', async () => {
    const { status } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice' },
      updateThrows: true,
    });
    assert.equal(status, 500);
  });

  it('500 when reading the profile throws an unexpected error', async () => {
    const { status } = await call({
      userId: CALLER_ID,
      body: { nickname: 'Alice' },
      getProfileThrows: true,
    });
    assert.equal(status, 500);
  });

  it('401 when req.userId is missing (jwtAuth did not run)', async () => {
    const { status, calls } = await call({ body: { nickname: 'Alice' } });
    assert.equal(status, 401);
    assert.equal(calls.length, 0, 'no db call should run without an authenticated identity');
  });
});

// ── keywords test helpers ────────────────────────────────────────────────────

interface KeywordsCallOpts {
  userId?: string;
  body: Record<string, unknown>;
  validateThrows?: boolean;
  replaceThrows?: boolean;
}

/**
 * Build a keywords handler with controllable fakes and run it against mock
 * req/res.
 */
async function callKeywords(opts: KeywordsCallOpts) {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const deps: ProfileDeps = {
    validateKeywordIds: ((async (keywordIds: number[]) => {
      calls.push({ name: 'validateKeywordIds', args: [keywordIds] });
      if (opts.validateThrows) throw new Error('db down');
    }) as unknown) as typeof import('../db/users').validateKeywordIds,

    replaceUserKeywords: ((async (userId: string, keywordIds: number[]) => {
      calls.push({ name: 'replaceUserKeywords', args: [userId, keywordIds] });
      if (opts.replaceThrows) throw new Error('db down');
    }) as unknown) as typeof import('../db/users').replaceUserKeywords,

    pgPool: {} as unknown as typeof import('../db/pool').pool,
  };

  const handler = createKeywordsHandler(deps);

  let status = 0;
  let body: unknown;
  const req = { body: opts.body, userId: opts.userId } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  } as unknown as Response;

  await handler(req, res, () => undefined);

  return { status, body, calls };
}

// ── POST /profile/keywords ───────────────────────────────────────────────────

describe('POST /profile/keywords', () => {
  it('200 with exactly 5 keyword ids (minimum)', async () => {
    const ids = [1, 2, 3, 4, 5];
    const { status, calls } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });

    assert.equal(status, 200);
    const validate = calls.find((c) => c.name === 'validateKeywordIds');
    assert.deepEqual(validate?.args[0], ids);
    const replace = calls.find((c) => c.name === 'replaceUserKeywords');
    assert.equal(replace?.args[0], CALLER_ID);
    assert.deepEqual(replace?.args[1], ids);
  });

  it('200 with exactly 10 keyword ids (maximum)', async () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { status, calls } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });

    assert.equal(status, 200);
    const validate = calls.find((c) => c.name === 'validateKeywordIds');
    assert.deepEqual(validate?.args[0], ids);
    const replace = calls.find((c) => c.name === 'replaceUserKeywords');
    assert.deepEqual(replace?.args[1], ids);
  });

  it('400 when keyword_ids has only 4 items (below minimum)', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4] } });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids has 11 items (above maximum)', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1);
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids is missing from the body', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: {} });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids is not an array', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: 'not-array' } });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids contains non-integers', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4, 5.5] } });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids contains a non-positive integer', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [0, 1, 2, 3, 4] } });
    assert.equal(status, 400);
  });

  it('400 when keyword_ids contains a string element', async () => {
    const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4, '5'] } });
    assert.equal(status, 400);
  });

  it('500 when validateKeywordIds throws', async () => {
    const { status } = await callKeywords({
      userId: CALLER_ID,
      body: { keyword_ids: [1, 2, 3, 4, 5] },
      validateThrows: true,
    });
    assert.equal(status, 500);
  });

  it('500 when replaceUserKeywords throws', async () => {
    const { status } = await callKeywords({
      userId: CALLER_ID,
      body: { keyword_ids: [1, 2, 3, 4, 5] },
      replaceThrows: true,
    });
    assert.equal(status, 500);
  });

  it('401 when req.userId is missing', async () => {
    const { status, calls } = await callKeywords({ body: { keyword_ids: [1, 2, 3, 4, 5] } });
    assert.equal(status, 401);
    assert.equal(calls.length, 0, 'no db call should run without an authenticated identity');
  });
});