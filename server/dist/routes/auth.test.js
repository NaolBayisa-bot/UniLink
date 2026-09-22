"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const auth_1 = require("./auth");
const USER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
function makeUser(overrides = {}) {
    return {
        id: USER_ID,
        telegram_id: '1001',
        telegram_username: 'testuser_a',
        email: 'user@example.com',
        email_verified: true,
        nickname: 'UserA',
        gender: 'male',
        photo_public_id: null,
        custom_interest_text: null,
        status: 'active',
        created_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}
/** Build a deps object with controllable fakes and run the handler. */
async function call(callOpts) {
    const calls = [];
    const deps = {
        verifyInitData: ((raw) => {
            calls.push({ name: 'verifyInitData', args: [raw] });
            if (callOpts.telegramThrows)
                throw new Error('not configured');
            return callOpts.telegramIdentity ?? null;
        }),
        verifyGoogleIdToken: (async (idToken) => {
            calls.push({ name: 'verifyGoogleIdToken', args: [idToken] });
            if (callOpts.googleThrows)
                throw new Error('not configured');
            return callOpts.googleIdentity ?? null;
        }),
        upsertUserByTelegram: (async (input) => {
            calls.push({ name: 'upsertUserByTelegram', args: [input] });
            if (callOpts.upsertThrows)
                throw new Error('db down');
            return callOpts.upsertUser === undefined ? null : callOpts.upsertUser;
        }),
        signToken: ((userId) => {
            calls.push({ name: 'signToken', args: [userId] });
            return callOpts.token ?? 'signed-token';
        }),
    };
    const handler = (0, auth_1.createCompleteSignupHandler)(deps);
    let status = 0;
    let body;
    const req = { body: callOpts.body };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, calls };
}
const telegramIdentity = {
    telegram_id: 1001,
    telegram_username: 'testuser_a',
};
const googleIdentity = {
    email: 'user@example.com',
    email_verified: true,
    sub: '12345',
};
(0, node_test_1.describe)('POST /auth/complete-signup', () => {
    (0, node_test_1.it)('400 when initDataRaw is missing', async () => {
        const { status, calls } = await call({ body: { googleIdToken: 'g' } });
        strict_1.default.equal(status, 400);
        strict_1.default.equal(calls.length, 0);
    });
    (0, node_test_1.it)('400 when googleIdToken is missing', async () => {
        const { status } = await call({ body: { initDataRaw: 'raw', googleIdToken: '' } });
        strict_1.default.equal(status, 400);
    });
    (0, node_test_1.it)('401 when Telegram initData is invalid', async () => {
        const { status, body } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramIdentity: null,
            googleIdentity,
        });
        strict_1.default.equal(status, 401);
        strict_1.default.deepEqual(body.error, 'Invalid Telegram initData');
    });
    (0, node_test_1.it)('401 when the Google ID token is invalid', async () => {
        const { status, calls } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramIdentity,
            googleIdentity: null,
        });
        strict_1.default.equal(status, 401);
        // Upsert must NOT have been called on a failed verification.
        strict_1.default.equal(calls.some((c) => c.name === 'upsertUserByTelegram'), false);
    });
    (0, node_test_1.it)('401 when email_verified is false (google returns null)', async () => {
        const { status } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramIdentity,
            googleIdentity: null,
        });
        strict_1.default.equal(status, 401);
    });
    (0, node_test_1.it)('500 when Telegram config throws', async () => {
        const { status } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
    (0, node_test_1.it)('200 success: passes verified identities to upsert and returns token + user', async () => {
        const user = makeUser();
        const { status, body, calls } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramIdentity,
            googleIdentity,
            upsertUser: user,
            token: 'jwt-123',
        });
        strict_1.default.equal(status, 200);
        const upsertCall = calls.find((c) => c.name === 'upsertUserByTelegram');
        const upsertArg = upsertCall?.args[0];
        strict_1.default.equal(upsertArg.telegram_id, 1001); // from verifyInitData
        strict_1.default.equal(upsertArg.telegram_username, 'testuser_a');
        strict_1.default.equal(upsertArg.email, 'user@example.com'); // from verifyGoogle
        strict_1.default.equal(upsertArg.email_verified, true);
        const signCall = calls.find((c) => c.name === 'signToken');
        strict_1.default.equal(signCall?.args[0], USER_ID);
        const json = body;
        strict_1.default.equal(json.token, 'jwt-123');
        strict_1.default.equal(json.user.id, USER_ID);
        strict_1.default.equal(json.user.telegram_id, 1001); // normalized to number
        strict_1.default.equal(json.user.email, 'user@example.com');
    });
    (0, node_test_1.it)('ignores malicious client-supplied telegram_id / user_id / email / email_verified', async () => {
        const user = makeUser();
        const { status, calls } = await call({
            body: {
                initDataRaw: 'raw',
                googleIdToken: 'g',
                telegram_id: 999999,
                user_id: 'imposter',
                email: 'hacker@evil.com',
                email_verified: true,
            },
            telegramIdentity,
            googleIdentity,
            upsertUser: user,
            token: 'jwt-123',
        });
        strict_1.default.equal(status, 200);
        const upsertCall = calls.find((c) => c.name === 'upsertUserByTelegram');
        const upsertArg = upsertCall?.args[0];
        strict_1.default.equal(upsertArg.telegram_id, 1001, 'must use verified telegram_id, not body');
        strict_1.default.equal(upsertArg.email, 'user@example.com', 'must use verified email, not body');
        const signCall = calls.find((c) => c.name === 'signToken');
        strict_1.default.equal(signCall?.args[0], USER_ID, 'must sign for the DB user id, not body user_id');
    });
    (0, node_test_1.it)('500 when upsert throws', async () => {
        const { status } = await call({
            body: { initDataRaw: 'raw', googleIdToken: 'g' },
            telegramIdentity,
            googleIdentity,
            upsertThrows: true,
        });
        strict_1.default.equal(status, 500);
    });
});
//# sourceMappingURL=auth.test.js.map