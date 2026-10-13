import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Request, Response } from 'express';
import { createLikeHandler, LikeDeps } from './like';
import {
  DAILY_LIKE_LIMIT,
  needsDailyReset,
  QueryFn,
  recordLike,
} from '../db/users';

// The authenticated caller (identity set on req.userId by jwtAuth).
const CALLER_ID = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
// The user being liked — the only client-supplied value (the :targetId param).
const TARGET_ID = 'b6084c09-cfed-4294-811a-7c3fbc1c1d9a';

/** The caller's daily-like row state the fake DB returns for the SELECT. */
interface State {
  likes_sent_today: number;
  likes_reset_at: Date;
  /** rowCount the INSERT returns — 1 = new like, 0 = duplicate (conflict). */
  insertRowCount?: number;
  /** When true the caller's row is missing (SELECT returns no rows). */
  noCaller?: boolean;
}

/**
 * A fake query fn that routes by SQL text and records an ordered log of the
 * operations `recordLike` performs, so tests can assert exactly which writes
 * ran (and in what order) for each daily-like state.
 */
function makeFakeQ(state: State, log: string[]): QueryFn {
  return async (text: string) => {
    if (/SELECT likes_sent_today, likes_reset_at/i.test(text)) {
      log.push('select');
      if (state.noCaller) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            likes_sent_today: state.likes_sent_today,
            likes_reset_at: state.likes_reset_at,
          },
        ],
        rowCount: 1,
      };
    }
    if (/likes_sent_today = 0/i.test(text)) {
      log.push('reset');
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO likes/i.test(text)) {
      log.push('insert');
      return { rows: [], rowCount: state.insertRowCount ?? 1 };
    }
    if (/likes_sent_today \+ 1/i.test(text)) {
      log.push('increment');
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
}

interface RunOpts {
  state: State;
  userId?: string;
  targetId?: string;
}

interface RunResult {
  status: number;
  body: unknown;
  log: string[];
}

/**
 * Run the REAL handler wired to the REAL recordLike (bound to a fake q), so the
 * HTTP mapping AND the reset/cap logic are both exercised end-to-end.
 */
async function run(opts: RunOpts): Promise<RunResult> {
  const log: string[] = [];
  const fakeQ = makeFakeQ(opts.state, log);
  const deps: LikeDeps = {
    recordLike: (callerId: string, targetId: string) => recordLike(callerId, targetId, fakeQ),
  };
  const handler = createLikeHandler(deps);

  let status = 0;
  let body: unknown;
  const req = {
    userId: 'userId' in opts ? opts.userId : CALLER_ID,
    params: { targetId: opts.targetId ?? TARGET_ID },
    body: {},
    query: {},
  } as unknown as Request;
  const res = {
    status(code: number) {
      status = code;
      return { json: (b: unknown) => { body = b; } };
    },
  } as unknown as Response;

  await handler(req, res, () => undefined);
  return { status, body, log };
}

describe('POST /like/:targetId — daily like cap', () => {
  it('UNDER CAP: 201, counts the new like, no reset', async () => {
    const { status, body, log } = await run({
      state: { likes_sent_today: 5, likes_reset_at: new Date() },
    });

    assert.equal(status, 201);
    assert.deepEqual(body, { liked: true, likes_sent_today: 6 });
    // No reset (window is current), then insert + increment.
    assert.deepEqual(log, ['select', 'insert', 'increment']);
  });

  it('AT CAP: 429 and the like is NOT inserted (no allowance burned)', async () => {
    const { status, body, log } = await run({
      state: { likes_sent_today: DAILY_LIKE_LIMIT, likes_reset_at: new Date() },
    });

    assert.equal(status, 429);
    assert.deepEqual(body, { error: `Daily like limit of ${DAILY_LIKE_LIMIT} reached` });
    // Reads state, hits the cap, and stops BEFORE any insert/increment.
    assert.deepEqual(log, ['select']);
  });

  it('RESET BOUNDARY: at cap but window rolled over at UTC midnight -> reset then allowed', async () => {
    // A likes_reset_at 1ms before today's UTC midnight is stale -> triggers reset.
    const now = new Date();
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const { status, body, log } = await run({
      state: { likes_sent_today: DAILY_LIKE_LIMIT, likes_reset_at: new Date(utcMidnight - 1) },
    });

    assert.equal(status, 201);
    assert.deepEqual(body, { liked: true, likes_sent_today: 1 });
    // Reset runs FIRST (counter -> 0), so the fresh like is allowed and counts.
    assert.deepEqual(log, ['select', 'reset', 'insert', 'increment']);
  });

  it('DUPLICATE like (conflict) is idempotent and does NOT burn the daily allowance', async () => {
    const { status, body, log } = await run({
      state: { likes_sent_today: 5, likes_reset_at: new Date(), insertRowCount: 0 },
    });

    assert.equal(status, 201);
    assert.deepEqual(body, { liked: false, likes_sent_today: 5 });
    // Insert attempted, but no increment because no new row was written.
    assert.deepEqual(log, ['select', 'insert']);
  });

  it('404 when the caller row is missing (fails CLOSED, no fresh allowance)', async () => {
    const { status, body, log } = await run({
      state: { likes_sent_today: 0, likes_reset_at: new Date(), noCaller: true },
    });

    assert.equal(status, 404);
    assert.deepEqual(body, { error: 'User not found' });
    assert.deepEqual(log, ['select']);
  });

  it('401 without req.userId and the data layer is never called', async () => {
    const { status, body, log } = await run({
      state: { likes_sent_today: 0, likes_reset_at: new Date() },
      userId: undefined,
    });

    assert.equal(status, 401);
    assert.deepEqual(body, { error: 'Authentication required' });
    assert.deepEqual(log, [], 'no db query may run without an authenticated identity');
  });

  it('400 for a malformed :targetId and the data layer is never called', async () => {
    for (const bad of ['not-a-uuid', `${TARGET_ID}x`, TARGET_ID.slice(0, 35), '']) {
      const { status, log } = await run({
        state: { likes_sent_today: 0, likes_reset_at: new Date() },
        targetId: bad,
      });
      assert.equal(status, 400, bad);
      assert.deepEqual(log, [], `malformed target "${bad}" must not reach the data layer`);
    }
  });

  it('500 when the data layer throws a non-HttpError', async () => {
    const deps: LikeDeps = {
      recordLike: (async () => {
        throw new Error('db down');
      }) as typeof recordLike,
    };
    const handler = createLikeHandler(deps);

    let status = 0;
    let body: unknown;
    const req = {
      userId: CALLER_ID,
      params: { targetId: TARGET_ID },
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return { json: (b: unknown) => { body = b; } };
      },
    } as unknown as Response;

    await handler(req, res, () => undefined);
    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'Failed to record like' });
  });
});

describe('needsDailyReset — UTC-midnight boundary', () => {
  const now = new Date('2026-01-15T13:45:00Z');
  const utcMidnight = Date.UTC(2026, 0, 15); // 2026-01-15T00:00:00Z

  it('returns false exactly AT midnight (counter is current)', () => {
    assert.equal(needsDailyReset(new Date(utcMidnight), now), false);
  });

  it('returns true 1ms before midnight (counter is stale)', () => {
    assert.equal(needsDailyReset(new Date(utcMidnight - 1), now), true);
  });

  it('returns false for a reset earlier the SAME day', () => {
    assert.equal(needsDailyReset(new Date(utcMidnight + 60_000), now), false);
  });
});

