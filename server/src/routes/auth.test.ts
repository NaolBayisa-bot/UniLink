import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Request, Response } from 'express';
import { createCompleteSignupHandler, CompleteSignupDeps } from './auth';
import { OwnUserRow } from '../db/users';
import { GoogleIdentity } from '../services/google';
import { TelegramIdentity } from '../services/telegram';

const USER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';

function makeUser(overrides: Partial<OwnUserRow> = {}): OwnUserRow {
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

interface CallOpts {
  body: Record<string, unknown>;
  telegramIdentity?: TelegramIdentity | null;
  googleIdentity?: GoogleIdentity | null;
  telegramThrows?: boolean;
  googleThrows?: boolean;
  upsertUser?: OwnUserRow | null;
  upsertThrows?: boolean;
  token?: string;
}

/** Build a deps object with controllable fakes and run the handler. */
async function call(callOpts: CallOpts) {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const deps: CompleteSignupDeps = {
    verifyInitData: ((raw: string) => {
      calls.push({ name: 'verifyInitData', args: [raw] });
      if (callOpts.telegramThrows) throw new Error('not configured');
      return callOpts.telegramIdentity ?? null;
    }) as typeof import('../services/telegram').verifyInitData,

    verifyGoogleIdToken: (async (idToken: string) => {
      calls.push({ name: 'verifyGoogleIdToken', args: [idToken] });
      if (callOpts.googleThrows) throw new Error('not configured');
      return callOpts.googleIdentity ?? null;
    }) as typeof import('../services/google').verifyGoogleIdToken,

    upsertUserByTelegram: (async (input: unknown) => {
      calls.push({ name: 'upsertUserByTelegram', args: [input] });
      if (callOpts.upsertThrows) throw new Error('db down');
      return callOpts.upsertUser === undefined ? null : callOpts.upsertUser;
    }) as typeof import('../db/users').upsertUserByTelegram,

    signToken: ((userId: string) => {
      calls.push({ name: 'signToken', args: [userId] });
      return callOpts.token ?? 'signed-token';
    }) as typeof import('../services/jwt').signToken,
  };

  const handler = createCompleteSignupHandler(deps);

  let status = 0;
  let body: unknown;
  const req = { body: callOpts.body } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  } as unknown as Response;

  await handler(req, res, () => undefined);

  return { status, body, calls };
}

const telegramIdentity: TelegramIdentity = {
  telegram_id: 1001,
  telegram_username: 'testuser_a',
};
const googleIdentity: GoogleIdentity = {
  email: 'user@example.com',
  email_verified: true,
  sub: '12345',
};

describe('POST /auth/complete-signup', () => {
  it('400 when initDataRaw is missing', async () => {
    const { status, calls } = await call({ body: { googleIdToken: 'g' } });
    assert.equal(status, 400);
    assert.equal(calls.length, 0);
  });

  it('400 when googleIdToken is missing', async () => {
    const { status } = await call({ body: { initDataRaw: 'raw', googleIdToken: '' } });
    assert.equal(status, 400);
  });

  it('401 when Telegram initData is invalid', async () => {
    const { status, body } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramIdentity: null,
      googleIdentity,
    });
    assert.equal(status, 401);
    assert.deepEqual((body as { error: string }).error, 'Invalid Telegram initData');
  });

  it('401 when the Google ID token is invalid', async () => {
    const { status, calls } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramIdentity,
      googleIdentity: null,
    });
    assert.equal(status, 401);
    // Upsert must NOT have been called on a failed verification.
    assert.equal(calls.some((c) => c.name === 'upsertUserByTelegram'), false);
  });

  it('401 when email_verified is false (google returns null)', async () => {
    const { status } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramIdentity,
      googleIdentity: null,
    });
    assert.equal(status, 401);
  });

  it('500 when Telegram config throws', async () => {
    const { status } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramThrows: true,
    });
    assert.equal(status, 500);
  });

  it('200 success: passes verified identities to upsert and returns token + user', async () => {
    const user = makeUser();
    const { status, body, calls } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramIdentity,
      googleIdentity,
      upsertUser: user,
      token: 'jwt-123',
    });

    assert.equal(status, 200);

    const upsertCall = calls.find((c) => c.name === 'upsertUserByTelegram');
    const upsertArg = upsertCall?.args[0] as Record<string, unknown>;
    assert.equal(upsertArg.telegram_id, 1001); // from verifyInitData
    assert.equal(upsertArg.telegram_username, 'testuser_a');
    assert.equal(upsertArg.email, 'user@example.com'); // from verifyGoogle
    assert.equal(upsertArg.email_verified, true);

    const signCall = calls.find((c) => c.name === 'signToken');
    assert.equal(signCall?.args[0], USER_ID);

    const json = body as { token: string; user: OwnUserRow };
    assert.equal(json.token, 'jwt-123');
    assert.equal(json.user.id, USER_ID);
    assert.equal(json.user.telegram_id, 1001); // normalized to number
    assert.equal(json.user.email, 'user@example.com');
  });

  it('ignores malicious client-supplied telegram_id / user_id / email / email_verified', async () => {
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

    assert.equal(status, 200);

    const upsertCall = calls.find((c) => c.name === 'upsertUserByTelegram');
    const upsertArg = upsertCall?.args[0] as Record<string, unknown>;
    assert.equal(upsertArg.telegram_id, 1001, 'must use verified telegram_id, not body');
    assert.equal(upsertArg.email, 'user@example.com', 'must use verified email, not body');

    const signCall = calls.find((c) => c.name === 'signToken');
    assert.equal(signCall?.args[0], USER_ID, 'must sign for the DB user id, not body user_id');
  });

  it('500 when upsert throws', async () => {
    const { status } = await call({
      body: { initDataRaw: 'raw', googleIdToken: 'g' },
      telegramIdentity,
      googleIdentity,
      upsertThrows: true,
    });
    assert.equal(status, 500);
  });
});