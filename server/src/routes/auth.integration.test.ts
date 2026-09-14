import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createAuthRouter, CompleteSignupDeps } from './auth';
import jwtAuth from '../middleware/jwt-auth';
import { getPublicProfile, getRevealedProfile } from '../db/users';
import { pool } from '../db/pool';
import { HttpError } from '../middleware/authorization';

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
function signInitData(fields: Record<string, string>): { raw: string; hash: string } {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = createHmac('sha256', TEST_BOT_TOKEN).update('WebAppData').digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const parts = Object.entries(fields).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
  );
  parts.push(`hash=${hash}`);
  return { raw: parts.join('&'), hash };
describe('integration: POST /auth/complete-signup end-to-end', () => {
  let server: ReturnType<express.Express['listen']> | undefined;
  let baseUrl = '';
  let createdUserId: string | undefined;

  before(async () => {
    // The real jwt-auth middleware verifies with the real JWT_SECRET (dotenv).
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;

    // Stub ONLY the Google verifier; keep real verifyInitData, upsert, signToken.
    const deps: CompleteSignupDeps = {
      verifyGoogleIdToken: async () => ({
        email: TEST_EMAIL,
        email_verified: true,
        sub: 'integration-google-sub',
      }),
    };

    const app = express();
    app.use(express.json());
    app.use('/auth', createAuthRouter(deps));

    // Task 20 middleware: authenticated routes read req.userId.
    app.get('/me', jwtAuth, (req, res) => {
      res.json({ userId: req.userId });
    });

    // Task 24: only the public shape is readable.
    app.get('/profiles/:id', jwtAuth, async (req, res) => {
      const profile = await getPublicProfile(req.params.id);
      res.json(profile);
    });

    // Task 24: identity fields only revealed on an active match (else 403).
    app.get('/reveal/:targetId', jwtAuth, async (req, res) => {
      try {
        const revealed = await getRevealedProfile(req.userId!, req.params.targetId);
        res.json(revealed);
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'server error' });
      }
    });

    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    const port = addr.port;
    baseUrl = `http://localhost:${port}`;

    // Give the listener a moment to be ready.
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    if (server) server.close();
    // Remove only the row this test created, leaving seed data intact.
    try {
      if (createdUserId) {
        await pool.query('DELETE FROM users WHERE id = $1::uuid', [createdUserId]);
      }
    } catch {
      // best-effort cleanup
    }
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.GOOGLE_CLIENT_ID;
    await pool.end();
  });

  it('complete-signup creates the user, returns a usable JWT, and protects other users', async () => {
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
    assert.equal(signupRes.status, 200, 'signup should succeed');
    const signup = (await signupRes.json()) as { token: string; user: Record<string, unknown> };

    // 3. Assert the returned user fields.
    assert.equal(signup.user.telegram_id, NEW_TELEGRAM_ID);
    assert.equal(signup.user.email, TEST_EMAIL);
    assert.equal(signup.user.email_verified, true);
    assert.ok(typeof signup.token === 'string' && signup.token.length > 0, 'a JWT is returned');
    const jwt = signup.token;
    createdUserId = signup.user.id as string;

    // 4. Confirm the users row exists with the correct values.
    const row = await pool.query<{ telegram_id: string; email: string | null; email_verified: boolean }>(
      `SELECT telegram_id, email, email_verified FROM users WHERE id = $1::uuid`,
      [createdUserId],
    );
    assert.equal(row.rowCount, 1, 'a users row must exist');
    assert.equal(row.rows[0].telegram_id, String(NEW_TELEGRAM_ID));
    assert.equal(row.rows[0].email, TEST_EMAIL);
    assert.equal(row.rows[0].email_verified, true);

    // 5. The JWT authenticates via Task 20 middleware.
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(meRes.status, 200);
    const me = (await meRes.json()) as { userId: string };
    assert.equal(me.userId, createdUserId);

    // 6. Without a token, the protected route rejects with 401.
    const noTokenRes = await fetch(`${baseUrl}/me`);
    assert.equal(noTokenRes.status, 401, 'missing token must be rejected');

    // 7. Reading ANOTHER seeded user's public profile leaks no identity fields.
    const profileRes = await fetch(`${baseUrl}/profiles/${USER_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(profileRes.status, 200);
    const profile = (await profileRes.json()) as Record<string, unknown>;
    assert.ok(!('real_name' in profile), 'real_name must not be in the public profile');
    assert.ok(!('department' in profile), 'department must not be in the public profile');
    assert.ok(!('telegram_username' in profile), 'telegram_username must not be in the public profile');

    // 8. Revealing identity for an unmatched seeded user is forbidden (403).
    const revealRes = await fetch(`${baseUrl}/reveal/${USER_A}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(revealRes.status, 403, 'identity reveal requires an active match');
  });
});
}