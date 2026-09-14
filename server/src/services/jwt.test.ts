import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { signToken } from './jwt';

const TEST_SECRET = 'test-jwt-secret-for-unit-tests';
const USER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';

function setEnv(secret: string, expiresIn: string): void {
  process.env.JWT_SECRET = secret;
  process.env.JWT_EXPIRES_IN = expiresIn;
}

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_EXPIRES_IN;
});

describe('signToken', () => {
  it('produces a JWT whose decoded payload has sub === userId', () => {
    setEnv(TEST_SECRET, '7d');
    const token = signToken(USER_ID);

    const decoded = jwt.verify(token, TEST_SECRET) as { sub?: string };
    assert.equal(decoded.sub, USER_ID);
  });

  it('round-trips through jsonwebtoken.verify with the same secret', () => {
    setEnv(TEST_SECRET, '1h');
    const token = signToken(USER_ID);

    assert.doesNotThrow(() => jwt.verify(token, TEST_SECRET));
    const payload = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    assert.equal(payload.sub, USER_ID);
  });

  // Proves the token is an HS256 HMAC exactly like the jwt-auth middleware verifies.
  it('is an HS256 JWT that recomputes via HMAC-SHA256 with JWT_SECRET', () => {
    setEnv(TEST_SECRET, '7d');
    const token = signToken(USER_ID);

    const [headerB64, payloadB64, sigB64] = token.split('.');

    // Decode header and confirm HS256.
    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8'),
    ) as { alg?: string };
    assert.equal(header.alg, 'HS256');

    // Recompute expected signature using HMAC-SHA256(key=JWT_SECRET) over the signing input.
    const signingInput = `${headerB64}.${payloadB64}`;
    const expected = createHmac('sha256', TEST_SECRET)
      .update(signingInput)
      .digest('base64url');
    assert.equal(sigB64, expected);
  });

  it('reflects JWT_EXPIRES_IN in the token expiry', () => {
    setEnv(TEST_SECRET, '1h');
    const token = signToken(USER_ID);
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    assert.equal(typeof decoded.exp, 'number');
    const ttlSeconds = (decoded.exp as number) - (decoded.iat as number);
    assert.equal(ttlSeconds, 3600);
  });

  it('throws when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    assert.throws(() => signToken(USER_ID), /JWT_SECRET/);
  });

  it('throws when JWT_EXPIRES_IN is not configured', () => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    assert.throws(() => signToken(USER_ID), /JWT_EXPIRES_IN/);
  });
});