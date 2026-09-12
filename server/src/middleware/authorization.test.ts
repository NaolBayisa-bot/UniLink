import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Request } from 'express';
import { QueryResult } from 'pg';
import {
  assertIsSelf,
  hasOpenReportAgainst,
  HttpError,
  isBlockedPair,
  matchExistsBetween,
  QueryFn,
} from './authorization';

// The two seeded test users from Task 20.
const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
const USER_B = 'b6084c09-cfed-4294-811a-7c3fbc1c1d9a';

/** Build a fake QueryResult with the given rows. */
function result<T>(rows: T[] = []): QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
  } as QueryResult<T>;
}

const req = (userId?: string) => ({ userId }) as unknown as Request;

describe('assertIsSelf', () => {
  it('passes when req.userId matches targetId', () => {
    assert.doesNotThrow(() => assertIsSelf(req(USER_A), USER_A));
  });

  it('throws 403 when req.userId is missing', () => {
    assert.throws(() => assertIsSelf(req(undefined), USER_A), (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 403);
      return true;
    });
  });

  it('throws 403 when req.userId differs from targetId', () => {
    assert.throws(() => assertIsSelf(req(USER_A), USER_B), (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 403);
      assert.match((err as HttpError).message, /not authorized/i);
      return true;
    });
  });
});

describe('matchExistsBetween', () => {
  it('returns true when an active row exists (A,B)', async () => {
    const q: QueryFn = async (text) => {
      assert.match(text, /unmatched_at IS NULL/i);
      return result([{ id: 'm1' }]);
    };
    assert.equal(await matchExistsBetween(USER_A, USER_B, q), true);
  });

  it('returns true regardless of user order (B,A)', async () => {
    const q: QueryFn = async (text, params) => {
      assert.deepEqual(params, [USER_B, USER_A]);
      return result([{ id: 'm1' }]);
    };
    assert.equal(await matchExistsBetween(USER_B, USER_A, q), true);
  });

  it('returns false when no row exists', async () => {
    const q: QueryFn = async () => result([]);
    assert.equal(await matchExistsBetween(USER_A, USER_B, q), false);
  });
});

describe('isBlockedPair', () => {
  it('returns true when A blocked B', async () => {
    const q: QueryFn = async () => result([{ zero: '0' }]);
    assert.equal(await isBlockedPair(USER_A, USER_B, q), true);
  });

  it('returns true when B blocked A (either direction', async () => {
    const q: QueryFn = async (text, params) => {
      assert.match(text, /blocker_id|blocked_id/i);
      assert.deepEqual(params, [USER_A, USER_B]);
      return result([{ zero: '0' }]);
    };
    assert.equal(await isBlockedPair(USER_A, USER_B, q), true);
  });

  it('returns false when there is no block', async () => {
    const q: QueryFn = async () => result([]);
    assert.equal(await isBlockedPair(USER_A, USER_B, q), false);
  });
});

describe('hasOpenReportAgainst', () => {
  it('returns true when an open report exists', async () => {
    const q: QueryFn = async (text, params) => {
      assert.match(text, /status = 'open'/i);
      assert.equal(params?.[0], USER_A);
      return result([{ zero: '0' }]);
    };
    assert.equal(await hasOpenReportAgainst(USER_A, q), true);
  });

  it('returns false when only resolved reports exist', async () => {
    const q: QueryFn = async () => result([]);
    assert.equal(await hasOpenReportAgainst(USER_A, q), false);
  });

  it('returns false when there are no reports', async () => {
    const q: QueryFn = async () => result([]);
    assert.equal(await hasOpenReportAgainst(USER_A, q), false);
  });
});

// Read-only integration checks against the real (Task-20 seeded) database.
// These never write; they only confirm the live helpers agree with the seeded
// test fixtures (UserA <-> UserB share one active match; no blocks/reports).
describe('integration (live DB, read-only)', () => {
  describe('matchExistsBetween on seeded pair', () => {
    it('detects the active A<->B match', async () => {
      assert.equal(await matchExistsBetween(USER_A, USER_B), true);
    });
    it('is order-agnostic (B,A)', async () => {
      assert.equal(await matchExistsBetween(USER_B, USER_A), true);
    });
  });

  describe('no blocks / reports currently seeded', () => {
    it('reports the seeded pair as not blocked', async () => {
      assert.equal(await isBlockedPair(USER_A, USER_B), false);
    });
    it('reports no open report against UserA', async () => {
      assert.equal(await hasOpenReportAgainst(USER_A), false);
    });
  });
});

export { USER_A, USER_B };