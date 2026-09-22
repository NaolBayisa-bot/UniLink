"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const browse_1 = require("./browse");
// The authenticated caller (identity set on req.userId by jwtAuth). Task-20
// seeded UserA, who is stored as 'male'.
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A malicious id a client might sneak into the request to try to browse AS
// someone else.
const SPOOFED_ID = '1a2b3c4d-5e6f-4a5b-9c8d-0e1f2a3b4c5d';
// The Task-22 public-profile field set — the ONLY keys a browse row may expose.
const PUBLIC_FIELDS = [
    'created_at',
    'custom_interest_text',
    'gender',
    'id',
    'nickname',
    'photo_public_id',
].sort();
const CANDIDATES = [
    {
        id: SPOOFED_ID,
        nickname: 'UserB',
        gender: 'female',
        photo_public_id: 'unilink/users/b/avatar.png',
        custom_interest_text: null,
        created_at: new Date('2026-01-02T00:00:00Z'),
    },
];
/** Build a handler with controllable fakes and run it against mock req/res. */
async function call(opts) {
    const calls = [];
    const deps = {
        browseProfiles: (async (callerId) => {
            calls.push({ name: 'browseProfiles', args: [callerId] });
            if (opts.throws)
                throw new Error('db down');
            return opts.profiles ?? CANDIDATES;
        }),
    };
    const handler = (0, browse_1.createBrowseHandler)(deps);
    let status = 0;
    let body;
    const req = {
        body: opts.body ?? {},
        query: opts.query ?? {},
        params: opts.params ?? {},
        userId: opts.userId,
    };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, calls };
}
(0, node_test_1.describe)('GET /browse', () => {
    (0, node_test_1.it)('200 and returns ONLY the public-profile field set for each candidate', async () => {
        const { status, body, calls } = await call({ userId: CALLER_ID });
        strict_1.default.equal(status, 200);
        strict_1.default.equal(calls.length, 1);
        strict_1.default.deepEqual(calls[0].args, [CALLER_ID]);
        const profiles = body;
        strict_1.default.ok(Array.isArray(profiles), 'response must be an array of profiles');
        strict_1.default.equal(profiles.length, 1);
        strict_1.default.deepEqual(Object.keys(profiles[0]).sort(), PUBLIC_FIELDS);
        // No private / identity fields may leak through browse.
        for (const forbidden of [
            'real_name',
            'department',
            'telegram_username',
            'email',
            'email_verified',
            'prompts',
            'status',
            'telegram_id',
        ]) {
            strict_1.default.ok(!(forbidden in profiles[0]), `${forbidden} must not be exposed by browse`);
        }
    });
    (0, node_test_1.it)('IGNORES a forged gender in the request body', async () => {
        const forged = await call({ userId: CALLER_ID, body: { gender: 'female' } });
        const clean = await call({ userId: CALLER_ID });
        strict_1.default.equal(forged.status, 200);
        // The caller's gender is never taken from the request: the DB is called with
        // the caller id and NOTHING else, in both cases.
        strict_1.default.deepEqual(forged.calls[0].args, [CALLER_ID]);
        strict_1.default.deepEqual(forged.calls, clean.calls);
        // Identical result set — the forged field changed nothing.
        strict_1.default.deepEqual(forged.body, clean.body);
    });
    (0, node_test_1.it)('IGNORES a forged gender in the query string', async () => {
        const forged = await call({ userId: CALLER_ID, query: { gender: 'female' } });
        const clean = await call({ userId: CALLER_ID });
        strict_1.default.equal(forged.status, 200);
        strict_1.default.deepEqual(forged.calls[0].args, [CALLER_ID]);
        strict_1.default.deepEqual(forged.calls, clean.calls);
        strict_1.default.deepEqual(forged.body, clean.body);
    });
    (0, node_test_1.it)('IGNORES a forged gender smuggled into every part of the request', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: { gender: 'female', user_id: SPOOFED_ID },
            query: { gender: 'female', user_id: SPOOFED_ID },
            params: { gender: 'female', user_id: SPOOFED_ID },
        });
        strict_1.default.equal(status, 200);
        // The one and only argument passed to the data layer is the authenticated
        // caller id.
        strict_1.default.deepEqual(calls[0].args, [CALLER_ID]);
        for (const dbCall of calls) {
            strict_1.default.ok(!JSON.stringify(dbCall.args).includes(SPOOFED_ID), 'a spoofed user_id must never be used as an argument');
            strict_1.default.ok(!JSON.stringify(dbCall.args).includes('female'), 'a forged gender must never be used as an argument');
        }
    });
    (0, node_test_1.it)('two CONTRADICTORY forged genders still produce the same DB call', async () => {
        const asFemale = await call({ userId: CALLER_ID, body: { gender: 'female' } });
        const asMale = await call({ userId: CALLER_ID, body: { gender: 'male' } });
        // The request cannot select WHICH gender is used to filter: the caller's
        // stored gender is the only input.
        strict_1.default.deepEqual(asFemale.calls, asMale.calls);
        strict_1.default.deepEqual(asFemale.body, asMale.body);
    });
    (0, node_test_1.it)('IGNORES forged liked/passed/blocked/reported ids — exclusion is server-derived', async () => {
        const { status, calls } = await call({
            userId: CALLER_ID,
            body: {
                liked_id: SPOOFED_ID,
                passed_id: SPOOFED_ID,
                blocked_id: SPOOFED_ID,
                reported_id: SPOOFED_ID,
                user_id: SPOOFED_ID,
            },
            query: {
                liked_id: SPOOFED_ID,
                passed_id: SPOOFED_ID,
                blocked_id: SPOOFED_ID,
                reported_id: SPOOFED_ID,
            },
            params: { passed_id: SPOOFED_ID, blocked_id: SPOOFED_ID, reported_id: SPOOFED_ID },
        });
        strict_1.default.equal(status, 200);
        // The caller's own likes/blocks are derived from req.userId inside the
        // query; nothing client-supplied is ever handed to the data layer.
        strict_1.default.deepEqual(calls[0].args, [CALLER_ID]);
        strict_1.default.ok(!JSON.stringify(calls).includes(SPOOFED_ID), 'client-supplied ids must never reach the data layer');
        for (const call of calls) {
            strict_1.default.equal(call.args.length, 1, 'browseProfiles takes only the caller id');
        }
    });
    (0, node_test_1.it)('200 with an empty array when there are no candidates', async () => {
        const { status, body } = await call({ userId: CALLER_ID, profiles: [] });
        strict_1.default.equal(status, 200);
        strict_1.default.deepEqual(body, []);
    });
    (0, node_test_1.it)('401 when req.userId is missing, without touching the database', async () => {
        const { status, calls } = await call({ body: { gender: 'female' } });
        strict_1.default.equal(status, 401);
        strict_1.default.equal(calls.length, 0, 'no db call should run without an authenticated identity');
    });
    (0, node_test_1.it)('500 when the browse query throws', async () => {
        const { status } = await call({ userId: CALLER_ID, throws: true });
        strict_1.default.equal(status, 500);
    });
});
//# sourceMappingURL=browse.test.js.map