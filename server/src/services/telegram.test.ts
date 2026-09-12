import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { verifyInitData } from './telegram';

// A fixed, arbitrary test token. Tests set it on process.env so verification
// is deterministic and independent of the real deployment secret.
const TEST_TOKEN = '123456789:TEST-signed-payload-secret';

/**
 * Build the raw initData query string from fields + a hash, using
 * encodeURIComponent so key/value encoding is fully controlled and consistent
 * with the production parser (which decodeURIComponent's each part).
 */
function buildRaw(fields: Record<string, string>, hash?: string): string {
  const parts = Object.entries(fields).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
  );
  if (hash !== undefined) parts.push(`hash=${hash}`);
  return parts.join('&');
}

/**
 * Generate a known-good signed payload exactly as Telegram defines it, and
 * return the raw string plus the computed hex hash.
 */
function signInitData(
  fields: Record<string, string>,
  token: string,
): { raw: string; hash: string } {
  // The data-check string is the sorted "key=value" lines (hash excluded).
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = createHmac('sha256', token).update('WebAppData').digest();
  const hash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return { raw: buildRaw(fields, hash), hash };
}

function setToken(token: string): void {
  process.env.TELEGRAM_BOT_TOKEN = token;
}

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe('verifyInitData', () => {
  it('accepts a known-good signed payload and returns the identity', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({
      id: 1001,
      first_name: 'UserA',
      username: 'testuser_a',
      language_code: 'en',
    });
    const { raw } = signInitData(
      { user: userJson, auth_date: '1700000000', query_id: 'QID1' },
      TEST_TOKEN,
    );

    assert.deepEqual(verifyInitData(raw), {
      telegram_id: 1001,
      telegram_username: 'testuser_a',
    });
  });

  it('handles a user without a username', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 2002, first_name: 'NoHandle' });
    const { raw } = signInitData({ user: userJson, auth_date: '1700000000' }, TEST_TOKEN);

    assert.deepEqual(verifyInitData(raw), { telegram_id: 2002, telegram_username: null });
  });

  it('returns null when a signed data field is tampered with', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
    const { hash } = signInitData({ user: userJson, auth_date: '1700000000' }, TEST_TOKEN);

    // Change query_id in the payload but keep the ORIGINAL hash (no re-sign).
    const tamperedRaw = buildRaw(
      { user: userJson, auth_date: '1700000000', query_id: 'EVIL' },
      hash,
    );
    assert.equal(verifyInitData(tamperedRaw), null);
  });

  it('returns null when the hash itself is corrupted', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
    const { hash } = signInitData({ user: userJson }, TEST_TOKEN);

    const flippedHash = hash.endsWith('0') ? hash.slice(0, -1) + '1' : hash.slice(0, -1) + '0';
    const corrupted = buildRaw({ user: userJson }, flippedHash);
    assert.equal(verifyInitData(corrupted), null);
  });

  it('returns null for a tampered telegram_id inside the user object', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
    const { hash } = signInitData({ user: userJson }, TEST_TOKEN);

    // Change the id to a different value but keep the original hash.
    const evilUser = JSON.stringify({ id: 9999, username: 'testuser_a' });
    const tampered = buildRaw({ user: evilUser }, hash);
    assert.equal(verifyInitData(tampered), null);
  });

  it('accepts a payload with mixed key ordering (auth_date before and after user)', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 1001, username: 'testuser_a' });
    const fields = { user: userJson, auth_date: '1700000000', query_id: 'Q1' };
    const { raw } = signInitData(fields, TEST_TOKEN);
    assert.deepEqual(verifyInitData(raw), {
      telegram_id: 1001,
      telegram_username: 'testuser_a',
    });
  });

  it('returns null when the hash field is missing', () => {
    setToken(TEST_TOKEN);
    const userJson = JSON.stringify({ id: 1001 });
    const raw = buildRaw({ user: userJson, auth_date: '1700000000' }); // no hash
    assert.equal(verifyInitData(raw), null);
  });

  it('returns null when the user field is invalid JSON', () => {
    setToken(TEST_TOKEN);
    const { raw } = signInitData({ user: 'not-json', auth_date: '1700000000' }, TEST_TOKEN);
    assert.equal(verifyInitData(raw), null);
  });

  it('returns null on empty input', () => {
    setToken(TEST_TOKEN);
    assert.equal(verifyInitData(''), null);
  });

  it('throws when TELEGRAM_BOT_TOKEN is not configured', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    assert.throws(() => verifyInitData('a=1&hash=abc'), /TELEGRAM_BOT_TOKEN/);
  });
});