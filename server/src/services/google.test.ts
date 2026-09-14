import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { verifyGoogleIdToken } from './google';

const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

function setClientId(id: string | undefined): void {
  if (id === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = id;
}

/** Build a "LoginTicket"-shaped object whose getPayload() resolves to `payload`. */
function ticketReturning(payload: TokenPayload | undefined) {
  return { getPayload: () => payload };
}

/** Mock the real OAuth2Client.prototype.verifyIdToken to run the given impl. */
function mockVerifyIdToken(impl: (opts: unknown) => unknown): void {
  mock.method(OAuth2Client.prototype, 'verifyIdToken', impl as never);
}

function makePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
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

afterEach(() => {
  mock.restoreAll();
  delete process.env.GOOGLE_CLIENT_ID;
});

describe('verifyGoogleIdToken (mocked library)', () => {
  it('known-good token returns the identity and passes our audience', async () => {
    setClientId(TEST_CLIENT_ID);
    const captured: Array<{ audience?: string }> = [];
    mockVerifyIdToken(async (opts: { audience?: string }) => {
      captured.push({ audience: opts.audience });
      return ticketReturning(makePayload({ email: 'alice@example.com', sub: '999' }));
    });

    const result = await verifyGoogleIdToken('valid-token');

    assert.deepEqual(result, {
      email: 'alice@example.com',
      email_verified: true,
      sub: '999',
    });
    // The audience passed to the library must be our configured client id.
    assert.deepEqual(captured, [{ audience: TEST_CLIENT_ID }]);
  });

  it('tampered / invalid-signature token returns null rather than throwing', async () => {
    setClientId(TEST_CLIENT_ID);
    mockVerifyIdToken(async () => {
      throw new Error('Invalid token signature');
    });

    let result: unknown = 'not-called';
    let threw = false;
    try {
      result = await verifyGoogleIdToken('tampered-token');
    } catch {
      threw = true;
    }

    assert.equal(threw, false, 'must not throw on verification failure');
    assert.equal(result, null);
  });

  it('audience-mismatch token returns null, and only our audience is ever used', async () => {
    setClientId(TEST_CLIENT_ID);
    const captured: Array<{ audience?: string }> = [];
    mockVerifyIdToken(async (opts: { audience?: string }) => {
      captured.push({ audience: opts.audience });
      // The real library rejects an id_token whose aud doesn't match.
      throw new Error('Token used wrong audience');
    });

    const result = await verifyGoogleIdToken('other-audience-token');

    assert.equal(result, null);
    assert.deepEqual(captured, [{ audience: TEST_CLIENT_ID }]);
  });

  it('email_verified:false is rejected even though the signature is valid', async () => {
    setClientId(TEST_CLIENT_ID);
    mockVerifyIdToken(async () =>
      ticketReturning(makePayload({ email_verified: false })),
    );

    assert.equal(await verifyGoogleIdToken('valid-but-unverified-token'), null);
  });

  it('missing payload (expired/invalid token) returns null', async () => {
    setClientId(TEST_CLIENT_ID);
    mockVerifyIdToken(async () => ticketReturning(undefined));

    assert.equal(await verifyGoogleIdToken('expired-token'), null);
  });

  it('email_verified absent returns null', async () => {
    setClientId(TEST_CLIENT_ID);
    const { email_verified: _ev, ...noVerified } = makePayload();
    mockVerifyIdToken(async () => ticketReturning(noVerified));

    assert.equal(await verifyGoogleIdToken('token'), null);
  });

  it('missing sub returns null', async () => {
    setClientId(TEST_CLIENT_ID);
    mockVerifyIdToken(async () => ticketReturning(makePayload({ sub: '' })));

    assert.equal(await verifyGoogleIdToken('token'), null);
  });

  it('throws only when GOOGLE_CLIENT_ID is not configured', async () => {
    setClientId(undefined);
    mockVerifyIdToken(async () =>
      ticketReturning(makePayload()),
    );

    await assert.rejects(
      () => verifyGoogleIdToken('token'),
      /GOOGLE_CLIENT_ID/,
    );
  });
});