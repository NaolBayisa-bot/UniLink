"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_1 = require("./jwt");
const TEST_SECRET = 'test-jwt-secret-for-unit-tests';
const USER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
function setEnv(secret, expiresIn) {
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = expiresIn;
}
(0, node_test_1.afterEach)(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
});
(0, node_test_1.describe)('signToken', () => {
    (0, node_test_1.it)('produces a JWT whose decoded payload has sub === userId', () => {
        setEnv(TEST_SECRET, '7d');
        const token = (0, jwt_1.signToken)(USER_ID);
        const decoded = jsonwebtoken_1.default.verify(token, TEST_SECRET);
        strict_1.default.equal(decoded.sub, USER_ID);
    });
    (0, node_test_1.it)('round-trips through jsonwebtoken.verify with the same secret', () => {
        setEnv(TEST_SECRET, '1h');
        const token = (0, jwt_1.signToken)(USER_ID);
        strict_1.default.doesNotThrow(() => jsonwebtoken_1.default.verify(token, TEST_SECRET));
        const payload = jsonwebtoken_1.default.verify(token, TEST_SECRET);
        strict_1.default.equal(payload.sub, USER_ID);
    });
    // Proves the token is an HS256 HMAC exactly like the jwt-auth middleware verifies.
    (0, node_test_1.it)('is an HS256 JWT that recomputes via HMAC-SHA256 with JWT_SECRET', () => {
        setEnv(TEST_SECRET, '7d');
        const token = (0, jwt_1.signToken)(USER_ID);
        const [headerB64, payloadB64, sigB64] = token.split('.');
        // Decode header and confirm HS256.
        const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
        strict_1.default.equal(header.alg, 'HS256');
        // Recompute expected signature using HMAC-SHA256(key=JWT_SECRET) over the signing input.
        const signingInput = `${headerB64}.${payloadB64}`;
        const expected = (0, node_crypto_1.createHmac)('sha256', TEST_SECRET)
            .update(signingInput)
            .digest('base64url');
        strict_1.default.equal(sigB64, expected);
    });
    (0, node_test_1.it)('reflects JWT_EXPIRES_IN in the token expiry', () => {
        setEnv(TEST_SECRET, '1h');
        const token = (0, jwt_1.signToken)(USER_ID);
        const decoded = jsonwebtoken_1.default.decode(token);
        strict_1.default.equal(typeof decoded.exp, 'number');
        const ttlSeconds = decoded.exp - decoded.iat;
        strict_1.default.equal(ttlSeconds, 3600);
    });
    (0, node_test_1.it)('throws when JWT_SECRET is not configured', () => {
        delete process.env.JWT_SECRET;
        process.env.JWT_EXPIRES_IN = '7d';
        strict_1.default.throws(() => (0, jwt_1.signToken)(USER_ID), /JWT_SECRET/);
    });
    (0, node_test_1.it)('throws when JWT_EXPIRES_IN is not configured', () => {
        process.env.JWT_SECRET = TEST_SECRET;
        delete process.env.JWT_EXPIRES_IN;
        strict_1.default.throws(() => (0, jwt_1.signToken)(USER_ID), /JWT_EXPIRES_IN/);
    });
});
//# sourceMappingURL=jwt.test.js.map