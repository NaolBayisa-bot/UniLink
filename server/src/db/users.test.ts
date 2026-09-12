import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../middleware/authorization';
import {
  adminCorrectGender,
  getPublicProfile,
  QueryFn,
  updateOwnProfile,
} from './users';

const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';

/** A mock query fn that records every call and returns sensible defaults. */
function trackQuery() {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const q: QueryFn = async (text, params) => {
    calls.push({ text, params });
    return { rows: [], rowCount: 1 };
  };
  return { q, calls };
}

describe('updateOwnProfile', () => {
  it('REQUIRED: silently drops gender — SQL contains no gender column', async () => {
    const { q, calls } = trackQuery();
    await updateOwnProfile(USER_A, { gender: 'female', nickname: 'NewNick' }, q);

    assert.equal(calls.length, 1);
    const sql = calls[0].text;
    // The generated UPDATE must never reference the gender column.
    assert.ok(!/gender/i.test(sql), `SQL must not mention gender: ${sql}`);
    // nickname is still updated alongside.
    assert.match(sql, /nickname\s*=\s*\$2/i);
    assert.deepEqual(calls[0].params, [USER_A, 'NewNick']);
  });

  it('gender-only call issues NO database query (silent no-op)', async () => {
    let queried = false;
    const q: QueryFn = async () => {
      queried = true;
      return { rows: [], rowCount: 1 };
    };
    const result = await updateOwnProfile(USER_A, { gender: 'female' }, q);
    assert.equal(queried, false, 'no UPDATE should be executed for a gender-only call');
    assert.equal(result.rowCount, 0);
  });

  it('updates a whitelisted field with correct SQL and params', async () => {
    const { q, calls } = trackQuery();
    await updateOwnProfile(USER_A, { nickname: 'Al', department: 'CS' }, q);

    assert.equal(calls.length, 1);
    const sql = calls[0].text;
    assert.match(sql, /UPDATE\s+users/i);
    assert.match(sql, /nickname\s*=\s*\$2/i);
    assert.match(sql, /department\s*=\s*\$3/i);
    assert.match(sql, /WHERE\s+id\s*=\s*\$1::uuid/i);
    assert.deepEqual(calls[0].params, [USER_A, 'Al', 'CS']);
  });

  it('ignores non-allowlisted columns (e.g. an attacker-supplied key)', async () => {
    const { q, calls } = trackQuery();
    await updateOwnProfile(
      USER_A,
      { nickname: 'Safe', email_verified: true, likes_sent_today: 999 },
      q,
    );
    const sql = calls[0].text;
    assert.match(sql, /nickname\s*=\s*\$2/i);
    assert.ok(!/email_verified/i.test(sql), 'email_verified must be excluded');
    assert.ok(!/likes_sent_today/i.test(sql), 'likes_sent_today must be excluded');
    assert.deepEqual(calls[0].params, [USER_A, 'Safe']);
  });

  it('issues no query when every provided field is non-editable', async () => {
    let queried = false;
    const q: QueryFn = async () => {
      queried = true;
      return { rows: [], rowCount: 1 };
    };
    await updateOwnProfile(USER_A, { gender: 'male', email_verified: true }, q);
    assert.equal(queried, false);
  });
});

describe('adminCorrectGender', () => {
  it('issues UPDATE users SET gender and returns rowCount (admin path)', async () => {
    const { q, calls } = trackQuery();
    const result = await adminCorrectGender(USER_A, 'female', q);
    assert.equal(calls.length, 1);
    const sql = calls[0].text;
    assert.match(sql, /UPDATE\s+users/i);
    assert.match(sql, /SET\s+gender\s*=\s*\$2::text/i);
    assert.deepEqual(calls[0].params, [USER_A, 'female']);
    assert.equal(result.rowCount, 1);
  });

  it('rejects an invalid gender with HttpError(400)', async () => {
    let queried = false;
    const q: QueryFn = async () => {
      queried = true;
      return { rows: [], rowCount: 1 };
    };
    await assert.rejects(
      () => adminCorrectGender(USER_A, 'other', q),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 400);
        return true;
      },
    );
    assert.equal(queried, false, 'no query should run for an invalid gender');
  });
});

// Read-only integration check: gender cannot be changed by a normal profile
// update against the real Task-20 seeded user.
describe('integration (live DB, read-only)', () => {
  it('a normal profile update leaves the stored gender unchanged', async () => {
    const before = await getPublicProfile(USER_A);
    assert.ok(before);

    await updateOwnProfile(USER_A, { gender: 'female', nickname: before.nickname ?? 'UserA' });

    const after = await getPublicProfile(USER_A);
    assert.ok(after);
    assert.equal(after.gender, before.gender, 'gender must be unchanged after self-update');
  });
});