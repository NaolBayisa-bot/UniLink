"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const telegram_1 = require("./telegram");
// A fixed, arbitrary test token. Tests set it on process.env so verification
// is deterministic and independent of the real deployment secret.
const TEST_TOKEN = '123456789:TEST-signed-payload-secret';
/**
 * Build the raw initData query string from fields + a hash, using
 * encodeURIComponent so key/value encoding is fully controlled and consistent
 * with the production parser (which decodeURIComponent's each part).
 */
function buildRaw(fields, hash) {
    const parts = Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    if (hash !== undefined)
        parts.push(`hash=${hash}`);
    return parts.join('&');
}
/**
 * Generate a known-good signed payload exactly as Telegram defines it, and
 * return the raw string plus the computed hex hash.
 */
function signInitData(fields, token) {
    // The data-check string is the sorted "key=value" lines (hash excluded).
    const dataCheckString = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join('\n');
    const secretKey = (0, node_crypto_1.createHmac)('sha256', token).update('WebAppData').digest();
    const hash = (0, node_crypto_1.createHmac)('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    return { raw: buildRaw(fields, hash), hash };
}
function setToken(token) {
    process.env.TELEGRAM_BOT_TOKEN = token;
}
(0, node_test_1.afterEach)(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
});
(0, node_test_1.describe)('verifyInitData', () => {
    (0, node_test_1.it)('accepts a known-good signed payload and returns the identity', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({
            id: 1001,
            first_name: 'UserA',
            username: 'testuser_a',
            language_code: 'en',
        });
        const { raw } = signInitData({ user: userJson, auth_date: '1700000000', query_id: 'QID1' }, TEST_TOKEN);
        strict_1.default.deepEqual((0, telegram_1.verifyInitData)(raw), {
            telegram_id: 1001,
            telegram_username: 'testuser_a',
        });
    });
    (0, node_test_1.it)('handles a user without a username', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 2002, first_name: 'NoHandle' });
        const { raw } = signInitData({ user: userJson, auth_date: '1700000000' }, TEST_TOKEN);
        strict_1.default.deepEqual((0, telegram_1.verifyInitData)(raw), { telegram_id: 2002, telegram_username: null });
    });
    (0, node_test_1.it)('returns null when a signed data field is tampered with', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
        const { hash } = signInitData({ user: userJson, auth_date: '1700000000' }, TEST_TOKEN);
        // Change query_id in the payload but keep the ORIGINAL hash (no re-sign).
        const tamperedRaw = buildRaw({ user: userJson, auth_date: '1700000000', query_id: 'EVIL' }, hash);
        strict_1.default.equal((0, telegram_1.verifyInitData)(tamperedRaw), null);
    });
    (0, node_test_1.it)('returns null when the hash itself is corrupted', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
        const { hash } = signInitData({ user: userJson }, TEST_TOKEN);
        const flippedHash = hash.endsWith('0') ? hash.slice(0, -1) + '1' : hash.slice(0, -1) + '0';
        const corrupted = buildRaw({ user: userJson }, flippedHash);
        strict_1.default.equal((0, telegram_1.verifyInitData)(corrupted), null);
    });
    (0, node_test_1.it)('returns null for a tampered telegram_id inside the user object', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
        const { hash } = signInitData({ user: userJson }, TEST_TOKEN);
        // Change the id to a different value but keep the original hash.
        const evilUser = JSON.stringify({ id: 9999, username: 'testuser_a' });
        const tampered = buildRaw({ user: evilUser }, hash);
        strict_1.default.equal((0, telegram_1.verifyInitData)(tampered), null);
    });
    (0, node_test_1.it)('accepts a payload with mixed key ordering (auth_date before and after user)', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
        const fields = { user: userJson, auth_date: '1700000000', query_id: 'Q1' };
        const { raw } = signInitData(fields, TEST_TOKEN);
        strict_1.default.deepEqual((0, telegram_1.verifyInitData)(raw), {
            telegram_id: 1001,
            telegram_username: 'testuser_a',
        });
    });
    (0, node_test_1.it)('returns null when the hash field is missing', () => {
        setToken(TEST_TOKEN);
        const userJson = JSON.stringify({ id: 1001 });
        const raw = buildRaw({ user: userJson, auth_date: '1700000000' }); // no hash
        strict_1.default.equal((0, telegram_1.verifyInitData)(raw), null);
    });
    (0, node_test_1.it)('returns null when the user field is invalid JSON', () => {
        setToken(TEST_TOKEN);
        const { raw } = signInitData({ user: 'not-json', auth_date: '1700000000' }, TEST_TOKEN);
        strict_1.default.equal((0, telegram_1.verifyInitData)(raw), null);
    });
    (0, node_test_1.it)('returns null on empty input', () => {
        setToken(TEST_TOKEN);
        strict_1.default.equal((0, telegram_1.verifyInitData)(''), null);
    });
    (0, node_test_1.it)('throws when TELEGRAM_BOT_TOKEN is not configured', () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        strict_1.default.throws(() => (0, telegram_1.verifyInitData)('a=1&hash=abc'), /TELEGRAM_BOT_TOKEN/);
    });
});
//# sourceMappingURL=telegram.test.js.map