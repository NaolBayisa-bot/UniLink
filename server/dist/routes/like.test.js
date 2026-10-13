"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const like_1 = require("./like");
const users_1 = require("../db/users");
// The authenticated caller (identity set on req.userId by jwtAuth).
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// The user being liked — the only client-supplied value (the :targetId param).
const TARGET_ID = 'b6084c09-cfed-4294-811a-7c3fbc1c1d9a';
/**
 * A fake query fn that routes by SQL text and records an ordered log of the
 * operations `recordLike` performs, so tests can assert exactly which writes
 * ran (and in what order) for each daily-like state.
 */
function makeFakeQ(state, log) {
    return async (text) => {
        if (/SELECT likes_sent_today, likes_reset_at/i.test(text)) {
            log.push('select');
            if (state.noCaller)
                return { rows: [], rowCount: 0 };
            return {
                rows: [
                    {
                        likes_sent_today: state.likes_sent_today,
                        likes_reset_at: state.likes_reset_at,
                    },
                ],
                rowCount: 1,
            };
        }
        if (/likes_sent_today = 0/i.test(text)) {
            log.push('reset');
            return { rows: [], rowCount: 1 };
        }
        if (/INSERT INTO likes/i.test(text)) {
            log.push('insert');
            return { rows: [], rowCount: state.insertRowCount ?? 1 };
        }
        if (/likes_sent_today \+ 1/i.test(text)) {
            log.push('increment');
            return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    };
}
/**
 * Run the REAL handler wired to the REAL recordLike (bound to a fake q), so the
 * HTTP mapping AND the reset/cap logic are both exercised end-to-end.
 */
async function run(opts) {
    const log = [];
    const fakeQ = makeFakeQ(opts.state, log);
    const deps = {
        recordLike: (callerId, targetId) => (0, users_1.recordLike)(callerId, targetId, fakeQ),
    };
    const handler = (0, like_1.createLikeHandler)(deps);
    let status = 0;
    let body;
    const req = {
        userId: 'userId' in opts ? opts.userId : CALLER_ID,
        params: { targetId: opts.targetId ?? TARGET_ID },
        body: {},
        query: {},
    };
    const res = {
        status(code) {
            status = code;
            return { json: (b) => { body = b; } };
        },
    };
    await handler(req, res, () => undefined);
    return { status, body, log };
}
(0, node_test_1.describe)('POST /like/:targetId — daily like cap', () => {
    (0, node_test_1.it)('UNDER CAP: 201, counts the new like, no reset', async () => {
        const { status, body, log } = await run({
            state: { likes_sent_today: 5, likes_reset_at: new Date() },
        });
        strict_1.default.equal(status, 201);
        strict_1.default.deepEqual(body, { liked: true, likes_sent_today: 6 });
        // No reset (window is current), then insert + increment.
        strict_1.default.deepEqual(log, ['select', 'insert', 'increment']);
    });
    (0, node_test_1.it)('AT CAP: 429 and the like is NOT inserted (no allowance burned)', async () => {
        const { status, body, log } = await run({
            state: { likes_sent_today: users_1.DAILY_LIKE_LIMIT, likes_reset_at: new Date() },
        });
        strict_1.default.equal(status, 429);
        strict_1.default.deepEqual(body, { error: `Daily like limit of ${users_1.DAILY_LIKE_LIMIT} reached` });
        // Reads state, hits the cap, and stops BEFORE any insert/increment.
        strict_1.default.deepEqual(log, ['select']);
    });
    (0, node_test_1.it)('RESET BOUNDARY: at cap but window rolled over at UTC midnight -> reset then allowed', async () => {
        // A likes_reset_at 1ms before today's UTC midnight is stale -> triggers reset.
        const now = new Date();
        const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const { status, body, log } = await run({
            state: { likes_sent_today: users_1.DAILY_LIKE_LIMIT, likes_reset_at: new Date(utcMidnight - 1) },
        });
        strict_1.default.equal(status, 201);
        strict_1.default.deepEqual(body, { liked: true, likes_sent_today: 1 });
        // Reset runs FIRST (counter -> 0), so the fresh like is allowed and counts.
        strict_1.default.deepEqual(log, ['select', 'reset', 'insert', 'increment']);
    });
    (0, node_test_1.it)('DUPLICATE like (conflict) is idempotent and does NOT burn the daily allowance', async () => {
        const { status, body, log } = await run({
            state: { likes_sent_today: 5, likes_reset_at: new Date(), insertRowCount: 0 },
        });
        strict_1.default.equal(status, 201);
        strict_1.default.deepEqual(body, { liked: false, likes_sent_today: 5 });
        // Insert attempted, but no increment because no new row was written.
        strict_1.default.deepEqual(log, ['select', 'insert']);
    });
    (0, node_test_1.it)('404 when the caller row is missing (fails CLOSED, no fresh allowance)', async () => {
        const { status, body, log } = await run({
            state: { likes_sent_today: 0, likes_reset_at: new Date(), noCaller: true },
        });
        strict_1.default.equal(status, 404);
        strict_1.default.deepEqual(body, { error: 'User not found' });
        strict_1.default.deepEqual(log, ['select']);
    });
    (0, node_test_1.it)('401 without req.userId and the data layer is never called', async () => {
        const { status, body, log } = await run({
            state: { likes_sent_today: 0, likes_reset_at: new Date() },
            userId: undefined,
        });
        strict_1.default.equal(status, 401);
        strict_1.default.deepEqual(body, { error: 'Authentication required' });
        strict_1.default.deepEqual(log, [], 'no db query may run without an authenticated identity');
    });
    (0, node_test_1.it)('400 for a malformed :targetId and the data layer is never called', async () => {
        for (const bad of ['not-a-uuid', `${TARGET_ID}x`, TARGET_ID.slice(0, 35), '']) {
            const { status, log } = await run({
                state: { likes_sent_today: 0, likes_reset_at: new Date() },
                targetId: bad,
            });
            strict_1.default.equal(status, 400, bad);
            strict_1.default.deepEqual(log, [], `malformed target "${bad}" must not reach the data layer`);
        }
    });
    (0, node_test_1.it)('500 when the data layer throws a non-HttpError', async () => {
        const deps = {
            recordLike: (async () => {
                throw new Error('db down');
            }),
        };
        const handler = (0, like_1.createLikeHandler)(deps);
        let status = 0;
        let body;
        const req = {
            userId: CALLER_ID,
            params: { targetId: TARGET_ID },
        };
        const res = {
            status(code) {
                status = code;
                return { json: (b) => { body = b; } };
            },
        };
        await handler(req, res, () => undefined);
        strict_1.default.equal(status, 500);
        strict_1.default.deepEqual(body, { error: 'Failed to record like' });
    });
});
(0, node_test_1.describe)('needsDailyReset — UTC-midnight boundary', () => {
    const now = new Date('2026-01-15T13:45:00Z');
    const utcMidnight = Date.UTC(2026, 0, 15); // 2026-01-15T00:00:00Z
    (0, node_test_1.it)('returns false exactly AT midnight (counter is current)', () => {
        strict_1.default.equal((0, users_1.needsDailyReset)(new Date(utcMidnight), now), false);
    });
    (0, node_test_1.it)('returns true 1ms before midnight (counter is stale)', () => {
        strict_1.default.equal((0, users_1.needsDailyReset)(new Date(utcMidnight - 1), now), true);
    });
    (0, node_test_1.it)('returns false for a reset earlier the SAME day', () => {
        strict_1.default.equal((0, users_1.needsDailyReset)(new Date(utcMidnight + 60000), now), false);
    });
});
//# sourceMappingURL=like.test.js.map