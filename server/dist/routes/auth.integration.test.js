"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const jwt_auth_1 = __importDefault(require("../middleware/jwt-auth"));
const users_1 = require("../db/users");
const pool_1 = require("../db/pool");
const authorization_1 = require("../middleware/authorization");
// Seeded Task-20 users. UserA <-> UserB are actively matched; our new user is not.
const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A fixed, arbitrary test bot token used to sign the fake initData. verifyInitData
// reads process.env.TELEGRAM_BOT_TOKEN at call time, so we set it before requests.
const TEST_BOT_TOKEN = '123456789:TEST-integration-bot-token';
const TEST_GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const TEST_EMAIL = 'integration.test@example.com';
// A telegram_id that will not collide with the seeded users (1001, 1002).
const NEW_TELEGRAM_ID = 9100;
/** Build a validly-signed initData payload (Telegram's documented algorithm). */
function signInitData(fields) {
    const dataCheckString = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join('\n');
    const secretKey = (0, node_crypto_1.createHmac)('sha256', TEST_BOT_TOKEN).update('WebAppData').digest();
    const hash = (0, node_crypto_1.createHmac)('sha256', secretKey).update(dataCheckString).digest('hex');
    const parts = Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    parts.push(`hash=${hash}`);
    return { raw: parts.join('&'), hash };
    (0, node_test_1.describe)('integration: POST /auth/complete-signup end-to-end', () => {
        let server;
        let baseUrl = '';
        let createdUserId;
        (0, node_test_1.before)(async () => {
            // The real jwt-auth middleware verifies with the real JWT_SECRET (dotenv).
            process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            // Stub ONLY the Google verifier; keep real verifyInitData, upsert, signToken.
            const deps = {
                verifyGoogleIdToken: async () => ({
                    email: TEST_EMAIL,
                    email_verified: true,
                    sub: 'integration-google-sub',
                }),
            };
            const app = (0, express_1.default)();
            app.use(express_1.default.json());
            app.use('/auth', (0, auth_1.createAuthRouter)(deps));
            // Task 20 middleware: authenticated routes read req.userId.
            app.get('/me', jwt_auth_1.default, (req, res) => {
                res.json({ userId: req.userId });
            });
            // Task 24: only the public shape is readable.
            app.get('/profiles/:id', jwt_auth_1.default, async (req, res) => {
                const profile = await (0, users_1.getPublicProfile)(req.params.id);
                res.json(profile);
            });
            // Task 24: identity fields only revealed on an active match (else 403).
            app.get('/reveal/:targetId', jwt_auth_1.default, async (req, res) => {
                try {
                    const revealed = await (0, users_1.getRevealedProfile)(req.userId, req.params.targetId);
                    res.json(revealed);
                }
                catch (err) {
                    if (err instanceof authorization_1.HttpError) {
                        res.status(err.status).json({ error: err.message });
                        return;
                    }
                    res.status(500).json({ error: 'server error' });
                }
            });
            server = app.listen(0);
            const addr = server.address();
            const port = addr.port;
            baseUrl = `http://localhost:${port}`;
            // Give the listener a moment to be ready.
            await new Promise((r) => setTimeout(r, 50));
        });
        (0, node_test_1.after)(async () => {
            if (server)
                server.close();
            // Remove only the row this test created, leaving seed data intact.
            try {
                if (createdUserId) {
                    await pool_1.pool.query('DELETE FROM users WHERE id = $1::uuid', [createdUserId]);
                }
            }
            catch {
                // best-effort cleanup
            }
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.GOOGLE_CLIENT_ID;
            await pool_1.pool.end();
        });
        (0, node_test_1.it)('complete-signup creates the user, returns a usable JWT, and protects other users', async () => {
            // 1. Build a validly-signed Telegram initData for the new identity.
            const userJson = JSON.stringify({ id: NEW_TELEGRAM_ID, username: 'integration_user' });
            const { raw: initDataRaw } = signInitData({
                user: userJson,
                auth_date: String(Math.floor(Date.now() / 1000)),
                query_id: 'qid-int',
            });
            // 2. Call the endpoint.
            const signupRes = await fetch(`${baseUrl}/auth/complete-signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initDataRaw, googleIdToken: 'stub-id-token' }),
            });
            strict_1.default.equal(signupRes.status, 200, 'signup should succeed');
            const signup = (await signupRes.json());
            // 3. Assert the returned user fields.
            strict_1.default.equal(signup.user.telegram_id, NEW_TELEGRAM_ID);
            strict_1.default.equal(signup.user.email, TEST_EMAIL);
            strict_1.default.equal(signup.user.email_verified, true);
            strict_1.default.ok(typeof signup.token === 'string' && signup.token.length > 0, 'a JWT is returned');
            const jwt = signup.token;
            createdUserId = signup.user.id;
            // 4. Confirm the users row exists with the correct values.
            const row = await pool_1.pool.query(`SELECT telegram_id, email, email_verified FROM users WHERE id = $1::uuid`, [createdUserId]);
            strict_1.default.equal(row.rowCount, 1, 'a users row must exist');
            strict_1.default.equal(row.rows[0].telegram_id, String(NEW_TELEGRAM_ID));
            strict_1.default.equal(row.rows[0].email, TEST_EMAIL);
            strict_1.default.equal(row.rows[0].email_verified, true);
            // 5. The JWT authenticates via Task 20 middleware.
            const meRes = await fetch(`${baseUrl}/me`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            strict_1.default.equal(meRes.status, 200);
            const me = (await meRes.json());
            strict_1.default.equal(me.userId, createdUserId);
            // 6. Without a token, the protected route rejects with 401.
            const noTokenRes = await fetch(`${baseUrl}/me`);
            strict_1.default.equal(noTokenRes.status, 401, 'missing token must be rejected');
            // 7. Reading ANOTHER seeded user's public profile leaks no identity fields.
            const profileRes = await fetch(`${baseUrl}/profiles/${USER_A}`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            strict_1.default.equal(profileRes.status, 200);
            const profile = (await profileRes.json());
            strict_1.default.ok(!('real_name' in profile), 'real_name must not be in the public profile');
            strict_1.default.ok(!('department' in profile), 'department must not be in the public profile');
            strict_1.default.ok(!('telegram_username' in profile), 'telegram_username must not be in the public profile');
            // 8. Revealing identity for an unmatched seeded user is forbidden (403).
            const revealRes = await fetch(`${baseUrl}/reveal/${USER_A}`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            strict_1.default.equal(revealRes.status, 403, 'identity reveal requires an active match');
        });
    });
}
//# sourceMappingURL=auth.integration.test.js.map