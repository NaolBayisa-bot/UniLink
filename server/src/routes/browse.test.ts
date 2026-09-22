import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Request, Response } from 'express';
import { createBrowseHandler, BrowseDeps } from './browse';
import { PublicProfile } from '../db/users';

// The authenticated caller (identity set on req.userId by jwtAuth). Task-20
// seeded UserA, who is stored as 'male'.
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// A malicious id a client might sneak into the request to try to browse AS
// someone else.
const SPOOFED_ID = '1a2b3c4d-5e6f-4a5b-9c8d-0e1f2a3b4c5d';

// The Task-22 public-profile field set — the ONLY keys a browse row may expose.
const PUBLIC_FIELDS = [
  'created_at',
  'custom_interest_text',
  'gender',
  'id',
  'nickname',
  'photo_public_id',
].sort();

const CANDIDATES: PublicProfile[] = [
  {
    id: SPOOFED_ID,
    nickname: 'UserB',
    gender: 'female',
    photo_public_id: 'unilink/users/b/avatar.png',
    custom_interest_text: null,
    created_at: new Date('2026-01-02T00:00:00Z'),
  },
];

interface CallOpts {
  userId?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  profiles?: PublicProfile[];
  throws?: boolean;
}

/** Build a handler with controllable fakes and run it against mock req/res. */
async function call(opts: CallOpts) {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const deps: BrowseDeps = {
    browseProfiles: (async (callerId: string) => {
      calls.push({ name: 'browseProfiles', args: [callerId] });
      if (opts.throws) throw new Error('db down');
      return opts.profiles ?? CANDIDATES;
    }) as typeof import('../db/users').browseProfiles,
  };

  const handler = createBrowseHandler(deps);

  let status = 0;
  let body: unknown;
  const req = {
    body: opts.body ?? {},
    query: opts.query ?? {},
    params: opts.params ?? {},
    userId: opts.userId,
  } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  } as unknown as Response;

  await handler(req, res, () => undefined);

  return { status, body, calls };
}

describe('GET /browse', () => {
  it('200 and returns ONLY the public-profile field set for each candidate', async () => {
    const { status, body, calls } = await call({ userId: CALLER_ID });

    assert.equal(status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, [CALLER_ID]);

    const profiles = body as PublicProfile[];
    assert.ok(Array.isArray(profiles), 'response must be an array of profiles');
    assert.equal(profiles.length, 1);
    assert.deepEqual(Object.keys(profiles[0]).sort(), PUBLIC_FIELDS);
    // No private / identity fields may leak through browse.
    for (const forbidden of [
      'real_name',
      'department',
      'telegram_username',
      'email',
      'email_verified',
      'prompts',
      'status',
      'telegram_id',
    ]) {
      assert.ok(!(forbidden in profiles[0]), `${forbidden} must not be exposed by browse`);
    }
  });

  it('IGNORES a forged gender in the request body', async () => {
    const forged = await call({ userId: CALLER_ID, body: { gender: 'female' } });
    const clean = await call({ userId: CALLER_ID });

    assert.equal(forged.status, 200);
    // The caller's gender is never taken from the request: the DB is called with
    // the caller id and NOTHING else, in both cases.
    assert.deepEqual(forged.calls[0].args, [CALLER_ID]);
    assert.deepEqual(forged.calls, clean.calls);
    // Identical result set — the forged field changed nothing.
    assert.deepEqual(forged.body, clean.body);
  });

  it('IGNORES a forged gender in the query string', async () => {
    const forged = await call({ userId: CALLER_ID, query: { gender: 'female' } });
    const clean = await call({ userId: CALLER_ID });

    assert.equal(forged.status, 200);
    assert.deepEqual(forged.calls[0].args, [CALLER_ID]);
    assert.deepEqual(forged.calls, clean.calls);
    assert.deepEqual(forged.body, clean.body);
  });

  it('IGNORES a forged gender smuggled into every part of the request', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: { gender: 'female', user_id: SPOOFED_ID },
      query: { gender: 'female', user_id: SPOOFED_ID },
      params: { gender: 'female', user_id: SPOOFED_ID },
    });

    assert.equal(status, 200);
    // The one and only argument passed to the data layer is the authenticated
    // caller id.
    assert.deepEqual(calls[0].args, [CALLER_ID]);
    for (const dbCall of calls) {
      assert.ok(
        !JSON.stringify(dbCall.args).includes(SPOOFED_ID),
        'a spoofed user_id must never be used as an argument',
      );
      assert.ok(
        !JSON.stringify(dbCall.args).includes('female'),
        'a forged gender must never be used as an argument',
      );
    }
  });

  it('two CONTRADICTORY forged genders still produce the same DB call', async () => {
    const asFemale = await call({ userId: CALLER_ID, body: { gender: 'female' } });
    const asMale = await call({ userId: CALLER_ID, body: { gender: 'male' } });

    // The request cannot select WHICH gender is used to filter: the caller's
    // stored gender is the only input.
    assert.deepEqual(asFemale.calls, asMale.calls);
    assert.deepEqual(asFemale.body, asMale.body);
  });

  it('IGNORES forged liked/passed/blocked/reported ids — exclusion is server-derived', async () => {
    const { status, calls } = await call({
      userId: CALLER_ID,
      body: {
        liked_id: SPOOFED_ID,
        passed_id: SPOOFED_ID,
        blocked_id: SPOOFED_ID,
        reported_id: SPOOFED_ID,
        user_id: SPOOFED_ID,
      },
      query: {
        liked_id: SPOOFED_ID,
        passed_id: SPOOFED_ID,
        blocked_id: SPOOFED_ID,
        reported_id: SPOOFED_ID,
      },
      params: { passed_id: SPOOFED_ID, blocked_id: SPOOFED_ID, reported_id: SPOOFED_ID },
    });

    assert.equal(status, 200);
    // The caller's own likes/blocks are derived from req.userId inside the
    // query; nothing client-supplied is ever handed to the data layer.
    assert.deepEqual(calls[0].args, [CALLER_ID]);
    assert.ok(
      !JSON.stringify(calls).includes(SPOOFED_ID),
      'client-supplied ids must never reach the data layer',
    );
    for (const call of calls) {
      assert.equal(call.args.length, 1, 'browseProfiles takes only the caller id');
    }
  });

  it('200 with an empty array when there are no candidates', async () => {
    const { status, body } = await call({ userId: CALLER_ID, profiles: [] });
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });

  it('401 when req.userId is missing, without touching the database', async () => {
    const { status, calls } = await call({ body: { gender: 'female' } });
    assert.equal(status, 401);
    assert.equal(calls.length, 0, 'no db call should run without an authenticated identity');
  });

  it('500 when the browse query throws', async () => {
    const { status } = await call({ userId: CALLER_ID, throws: true });
    assert.equal(status, 500);
  });
});
