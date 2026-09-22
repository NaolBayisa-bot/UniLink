"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const profile_1 = require("./profile");
// The authenticated caller (identity set on req.userId by jwtAuth).
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A malicious id a client might sneak into the request body to try to update /
// return SOMEONE ELSE's profile.
const SPOOFED_ID = '1a2b3c4d-5e6f-4a5b-9c8d-0e1f2a3b4c5d';
const DEFAULT_PROFILE = {
    id: CALLER_ID,
    nickname: 'UserA',
    gender: 'male',
    photo_public_id: null,
    custom_interest_text: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
};
/** Build a handler with controllable fakes and run it against mock req/res. */
async function call(opts) {
    const calls = [];
    const deps = {
        updateOwnProfile: (async (userId, fields) => {
            calls.push({ name: 'updateOwnProfile', args: [userId, fields] });
            if (opts.updateThrows)
                throw new Error('db down');
            return { rowCount: opts.rowCount ?? 1 };
        }),
        getPublicProfile: (async (userId) => {
            calls.push({ name: 'getPublicProfile', args: [userId] });
            if (opts.getProfileThrows)
                throw new Error('db down');
            return opts.profile === undefined ? DEFAULT_PROFILE : opts.profile;
        }),
    };
    const handler = (0, profile_1.createProfileHandler)(deps);
    let status = 0;
    let body;
    const req = { body: opts.body, userId: opts.userId };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, calls };
}
(0, node_test_1.describe)('POST /profile', () => {
    (0, node_test_1.it)('updates the caller and returns their own safe profile fields', async () => {
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice' },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.equal(update?.args[0], CALLER_ID);
        strict_1.default.deepEqual(update?.args[1], { nickname: 'Alice' });
        const getProfile = calls.find((c) => c.name === 'getPublicProfile');
        strict_1.default.equal(getProfile?.args[0], CALLER_ID);
        const json = body;
        strict_1.default.equal(json.id, CALLER_ID);
        strict_1.default.equal(json.nickname, 'UserA');
        // only safe public fields are returned
        strict_1.default.deepEqual(Object.keys(json).sort(), [
            'created_at',
            'custom_interest_text',
            'gender',
            'id',
            'nickname',
            'photo_public_id',
        ]);
    });
    (0, node_test_1.it)('updates prompts (independently of nickname)', async () => {
        const prompts = [{ prompt: 'Hello?', answer: 'Hi!' }];
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { prompts },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { prompts });
    });
    (0, node_test_1.it)('updates nickname and prompts together', async () => {
        const prompts = [{ prompt: 'q', answer: 'a' }, { prompt: 'q2', answer: 'a2' }];
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { nickname: '  Alice  ', prompts },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        // nickname is trimmed before persisting
        strict_1.default.deepEqual(update?.args[1], { nickname: 'Alice', prompts });
    });
    (0, node_test_1.it)('ignores a spoofed user_id in the body — identity always comes from req.userId', async () => {
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice', user_id: SPOOFED_ID },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.equal(update?.args[0], CALLER_ID, 'update must target the authenticated caller, never the spoofed user_id');
        // The spoofed id must never reach ANY db call and must not appear in the response.
        strict_1.default.ok(calls.every((c) => !JSON.stringify(c.args).includes(SPOOFED_ID)), 'spoofed user_id must never be used as an argument');
        strict_1.default.ok(!JSON.stringify(body).includes(SPOOFED_ID), 'spoofed user_id must never leak into the response');
        strict_1.default.equal(body.id, CALLER_ID);
    });
    (0, node_test_1.it)('updates custom_interest_text (independently of nickname/prompts)', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: 'I love hiking and reggae' },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { custom_interest_text: 'I love hiking and reggae' });
    });
    (0, node_test_1.it)('trims custom_interest_text before persisting', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: '   hi   ' },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { custom_interest_text: 'hi' });
    });
    (0, node_test_1.it)('200 when custom_interest_text is exactly the max (280 chars)', async () => {
        const text = 'x'.repeat(280);
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: text },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { custom_interest_text: text });
    });
    (0, node_test_1.it)('400 when custom_interest_text is 281 chars (above maximum)', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: 'x'.repeat(281) },
        });
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0, 'no db call should run for oversized text');
    });
    (0, node_test_1.it)('400 when custom_interest_text is empty or whitespace', async () => {
        for (const text of ['', '   ', '\t\n']) {
            const { status, calls } = await call({
                userId: CALLER_ID,
                body: { custom_interest_text: text },
            });
            strict_1.default.equal(status, 400, `custom_interest_text ${JSON.stringify(text)} must be rejected`);
            strict_1.default.equal(calls.length, 0, 'no db call should run for empty text');
        }
    });
    (0, node_test_1.it)('400 when custom_interest_text is neither a string nor null', async () => {
        for (const bad of [42, ['a'], { text: 'a' }, true]) {
            const { status, calls } = await call({
                userId: CALLER_ID,
                body: { custom_interest_text: bad },
            });
            strict_1.default.equal(status, 400, `custom_interest_text ${JSON.stringify(bad)} must be rejected`);
            strict_1.default.equal(calls.length, 0, 'no db call should run for a non-string value');
        }
    });
    (0, node_test_1.it)('200 and clears custom_interest_text when null is sent', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: null },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        // null is passed through so updateOwnProfile writes SQL NULL (clearing it).
        strict_1.default.deepEqual(update?.args[1], { custom_interest_text: null });
    });
    (0, node_test_1.it)('updates nickname and custom_interest_text together', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { nickname: '  Alice  ', custom_interest_text: 'chess club' },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { nickname: 'Alice', custom_interest_text: 'chess club' });
    });
    (0, node_test_1.it)('ignores a spoofed user_id when custom_interest_text is also present', async () => {
        const { status, body, calls } = await call({
            userId: CALLER_ID,
            body: { custom_interest_text: 'hi', user_id: SPOOFED_ID },
        });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.equal(update?.args[0], CALLER_ID);
        strict_1.default.ok(calls.every((c) => !JSON.stringify(c.args).includes(SPOOFED_ID)), 'spoofed user_id must never be used as an argument');
        strict_1.default.ok(!JSON.stringify(body).includes(SPOOFED_ID), 'spoofed user_id must never leak into the response');
    });
    (0, node_test_1.it)('400 when the body has nothing updatable (empty body)', async () => {
        const { status, calls } = await call({ userId: CALLER_ID, body: {} });
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0, 'no db calls should run when there is nothing to update');
    });
    (0, node_test_1.it)('400 when the body only contains non-editable user_id / gender', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { user_id: SPOOFED_ID, gender: 'female' },
        });
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0, 'non-editable fields must not trigger a db write');
    });
    (0, node_test_1.it)('400 when nickname is empty or whitespace', async () => {
        for (const nickname of ['', '   ', '\t\n']) {
            const { status } = await call({ userId: CALLER_ID, body: { nickname } });
            strict_1.default.equal(status, 400, `nickname ${JSON.stringify(nickname)} must be rejected`);
        }
    });
    (0, node_test_1.it)('400 when nickname is longer than 50 characters', async () => {
        const { status } = await call({ userId: CALLER_ID, body: { nickname: 'x'.repeat(51) } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('200 when nickname is exactly the max (50 trimmed)', async () => {
        const { status, calls } = await call({ userId: CALLER_ID, body: { nickname: 'x'.repeat(50) } });
        strict_1.default.equal(status, 200);
        const update = calls.find((c) => c.name === 'updateOwnProfile');
        strict_1.default.deepEqual(update?.args[1], { nickname: 'x'.repeat(50) });
    });
    (0, node_test_1.it)('400 when prompts is not an array', async () => {
        const { status } = await call({ userId: CALLER_ID, body: { prompts: 'nope' } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when prompts has more than 6 items', async () => {
        const many = Array.from({ length: 7 }, () => ({ prompt: 'p', answer: 'a' }));
        const { status } = await call({ userId: CALLER_ID, body: { prompts: many } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when a prompt element is not an object', async () => {
        const { status } = await call({
            userId: CALLER_ID,
            body: { prompts: [{ prompt: 'p', answer: 'a' }, 'not-an-object'] },
        });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('404 when updateOwnProfile affects no rows (user gone)', async () => {
        const { status, body } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice' },
            rowCount: 0,
        });
        strict_1.default.equal(status, 404);
        strict_1.default.equal(body.error, 'User not found');
    });
    (0, node_test_1.it)('404 when the profile cannot be read back', async () => {
        const { status } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice' },
            profile: null,
        });
        strict_1.default.equal(status, 404);
    });
    (0, node_test_1.it)('500 when the update throws an unexpected error', async () => {
        const { status } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice' },
            updateThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
    (0, node_test_1.it)('500 when reading the profile throws an unexpected error', async () => {
        const { status } = await call({
            userId: CALLER_ID,
            body: { nickname: 'Alice' },
            getProfileThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
    (0, node_test_1.it)('401 when req.userId is missing (jwtAuth did not run)', async () => {
        const { status, calls } = await call({ body: { nickname: 'Alice' } });
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0, 'no db call should run without an authenticated identity');
    });
});
/**
 * Build a keywords handler with controllable fakes and run it against mock
 * req/res.
 */
async function callKeywords(opts) {
    const calls = [];
    const deps = {
        validateKeywordIds: (async (keywordIds) => {
            calls.push({ name: 'validateKeywordIds', args: [keywordIds] });
            if (opts.validateThrows)
                throw new Error('db down');
        }),
        replaceUserKeywords: (async (userId, keywordIds) => {
            calls.push({ name: 'replaceUserKeywords', args: [userId, keywordIds] });
            if (opts.replaceThrows)
                throw new Error('db down');
        }),
        pgPool: {},
    };
    const handler = (0, profile_1.createKeywordsHandler)(deps);
    let status = 0;
    let body;
    const req = { body: opts.body, userId: opts.userId };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, calls };
}
// ── POST /profile/keywords ───────────────────────────────────────────────────
(0, node_test_1.describe)('POST /profile/keywords', () => {
    (0, node_test_1.it)('200 with exactly 5 keyword ids (minimum)', async () => {
        const ids = [1, 2, 3, 4, 5];
        const { status, calls } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });
        strict_1.default.equal(status, 200);
        const validate = calls.find((c) => c.name === 'validateKeywordIds');
        strict_1.default.deepEqual(validate?.args[0], ids);
        const replace = calls.find((c) => c.name === 'replaceUserKeywords');
        strict_1.default.equal(replace?.args[0], CALLER_ID);
        strict_1.default.deepEqual(replace?.args[1], ids);
    });
    (0, node_test_1.it)('200 with exactly 10 keyword ids (maximum)', async () => {
        const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const { status, calls } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });
        strict_1.default.equal(status, 200);
        const validate = calls.find((c) => c.name === 'validateKeywordIds');
        strict_1.default.deepEqual(validate?.args[0], ids);
        const replace = calls.find((c) => c.name === 'replaceUserKeywords');
        strict_1.default.deepEqual(replace?.args[1], ids);
    });
    (0, node_test_1.it)('400 when keyword_ids has only 4 items (below minimum)', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4] } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids has 11 items (above maximum)', async () => {
        const ids = Array.from({ length: 11 }, (_, i) => i + 1);
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: ids } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids is missing from the body', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: {} });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids is not an array', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: 'not-array' } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids contains non-integers', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4, 5.5] } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids contains a non-positive integer', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [0, 1, 2, 3, 4] } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('400 when keyword_ids contains a string element', async () => {
        const { status } = await callKeywords({ userId: CALLER_ID, body: { keyword_ids: [1, 2, 3, 4, '5'] } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('500 when validateKeywordIds throws', async () => {
        const { status } = await callKeywords({
            userId: CALLER_ID,
            body: { keyword_ids: [1, 2, 3, 4, 5] },
            validateThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
    (0, node_test_1.it)('500 when replaceUserKeywords throws', async () => {
        const { status } = await callKeywords({
            userId: CALLER_ID,
            body: { keyword_ids: [1, 2, 3, 4, 5] },
            replaceThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
    (0, node_test_1.it)('401 when req.userId is missing', async () => {
        const { status, calls } = await callKeywords({ body: { keyword_ids: [1, 2, 3, 4, 5] } });
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0, 'no db call should run without an authenticated identity');
    });
});
//# sourceMappingURL=profile.test.js.map