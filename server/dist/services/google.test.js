"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const google_auth_library_1 = require("google-auth-library");
const google_1 = require("./google");
const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
function setClientId(id) {
    if (id === undefined)
        delete process.env.GOOGLE_CLIENT_ID;
    else
        process.env.GOOGLE_CLIENT_ID = id;
}
/** Build a "LoginTicket"-shaped object whose getPayload() resolves to `payload`. */
function ticketReturning(payload) {
    return { getPayload: () => payload };
}
/** Mock the real OAuth2Client.prototype.verifyIdToken to run the given impl. */
function mockVerifyIdToken(impl) {
    node_test_1.mock.method(google_auth_library_1.OAuth2Client.prototype, 'verifyIdToken', impl);
}
function makePayload(overrides = {}) {
    return {
        iss: 'accounts.google.com',
        aud: TEST_CLIENT_ID,
        sub: '1122334455',
        email: 'user@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 60,
        ...overrides,
    };
}
(0, node_test_1.afterEach)(() => {
    node_test_1.mock.restoreAll();
    delete process.env.GOOGLE_CLIENT_ID;
});
(0, node_test_1.describe)('verifyGoogleIdToken (mocked library)', () => {
    (0, node_test_1.it)('known-good token returns the identity and passes our audience', async () => {
        setClientId(TEST_CLIENT_ID);
        const captured = [];
        mockVerifyIdToken(async (opts) => {
            captured.push({ audience: opts.audience });
            return ticketReturning(makePayload({ email: 'alice@example.com', sub: '999' }));
        });
        const result = await (0, google_1.verifyGoogleIdToken)('valid-token');
        strict_1.default.deepEqual(result, {
            email: 'alice@example.com',
            email_verified: true,
            sub: '999',
        });
        // The audience passed to the library must be our configured client id.
        strict_1.default.deepEqual(captured, [{ audience: TEST_CLIENT_ID }]);
    });
    (0, node_test_1.it)('tampered / invalid-signature token returns null rather than throwing', async () => {
        setClientId(TEST_CLIENT_ID);
        mockVerifyIdToken(async () => {
            throw new Error('Invalid token signature');
        });
        let result = 'not-called';
        let threw = false;
        try {
            result = await (0, google_1.verifyGoogleIdToken)('tampered-token');
        }
        catch {
            threw = true;
        }
        strict_1.default.equal(threw, false, 'must not throw on verification failure');
        strict_1.default.equal(result, null);
    });
    (0, node_test_1.it)('audience-mismatch token returns null, and only our audience is ever used', async () => {
        setClientId(TEST_CLIENT_ID);
        const captured = [];
        mockVerifyIdToken(async (opts) => {
            captured.push({ audience: opts.audience });
            // The real library rejects an id_token whose aud doesn't match.
            throw new Error('Token used wrong audience');
        });
        const result = await (0, google_1.verifyGoogleIdToken)('other-audience-token');
        strict_1.default.equal(result, null);
        strict_1.default.deepEqual(captured, [{ audience: TEST_CLIENT_ID }]);
    });
    (0, node_test_1.it)('email_verified:false is rejected even though the signature is valid', async () => {
        setClientId(TEST_CLIENT_ID);
        mockVerifyIdToken(async () => ticketReturning(makePayload({ email_verified: false })));
        strict_1.default.equal(await (0, google_1.verifyGoogleIdToken)('valid-but-unverified-token'), null);
    });
    (0, node_test_1.it)('missing payload (expired/invalid token) returns null', async () => {
        setClientId(TEST_CLIENT_ID);
        mockVerifyIdToken(async () => ticketReturning(undefined));
        strict_1.default.equal(await (0, google_1.verifyGoogleIdToken)('expired-token'), null);
    });
    (0, node_test_1.it)('email_verified absent returns null', async () => {
        setClientId(TEST_CLIENT_ID);
        const { email_verified: _ev, ...noVerified } = makePayload();
        mockVerifyIdToken(async () => ticketReturning(noVerified));
        strict_1.default.equal(await (0, google_1.verifyGoogleIdToken)('token'), null);
    });
    (0, node_test_1.it)('missing sub returns null', async () => {
        setClientId(TEST_CLIENT_ID);
        mockVerifyIdToken(async () => ticketReturning(makePayload({ sub: '' })));
        strict_1.default.equal(await (0, google_1.verifyGoogleIdToken)('token'), null);
    });
    (0, node_test_1.it)('throws only when GOOGLE_CLIENT_ID is not configured', async () => {
        setClientId(undefined);
        mockVerifyIdToken(async () => ticketReturning(makePayload()));
        await strict_1.default.rejects(() => (0, google_1.verifyGoogleIdToken)('token'), /GOOGLE_CLIENT_ID/);
    });
});
//# sourceMappingURL=google.test.js.map