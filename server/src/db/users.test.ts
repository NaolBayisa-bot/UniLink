import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../middleware/authorization';
import {
  adminCorrectGender,
  browseProfiles,
  getPublicProfile,
  PublicProfile,
  QueryFn,
  updateOwnProfile,
  upsertUserByTelegram,
} from './users';
import { pool } from './pool';

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

describe('browseProfiles', () => {
  it('filters on the caller gender from the CALLER OWN ROW, active status, and not-self', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    assert.equal(calls.length, 1);
    const sql = calls[0].text;
    // Excludes the caller themselves.
    assert.match(sql, /id\s*<>\s*\$1::uuid/i);
    // Only active accounts.
    assert.match(sql, /status\s*=\s*'active'/i);
    // The comparison gender is read server-side from the caller's own row.
    assert.match(
      sql,
      /gender\s*<>\s*\(\s*SELECT\s+gender\s+FROM\s+users\s+WHERE\s+id\s*=\s*\$1::uuid\s*\)/is,
    );
    // Exactly ONE parameter — the caller id. There is no slot a forged gender
    // could occupy, so a client-supplied gender can never influence the query.
    assert.deepEqual(calls[0].params, [USER_A]);
  });

  it('selects ONLY the Task-22 public-profile field set', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    const sql = calls[0].text;
    for (const field of [
      'id',
      'nickname',
      'gender',
      'photo_public_id',
      'custom_interest_text',
      'created_at',
    ]) {
      assert.match(sql, new RegExp(`\\b${field}\\b`), `${field} must be selected`);
    }
    for (const forbidden of [
      'real_name',
      'department',
      'telegram_username',
      'prompts',
      'email',
      'email_verified',
      'telegram_id',
      'likes_sent_today',
    ]) {
      assert.ok(!new RegExp(forbidden, 'i').test(sql), `${forbidden} must not be selected`);
    }
    // `status` is used as a FILTER only — never returned as a column.
    assert.ok(
      !/\bstatus\b/i.test(sql.split(/WHERE/i)[0]),
      'status must not be part of the SELECT list',
    );
  });

  it('returns the rows the database yields, unchanged', async () => {
    const row: PublicProfile = {
      id: USER_A,
      nickname: 'Someone',
      gender: 'female',
      photo_public_id: null,
      custom_interest_text: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
    };
    const q: QueryFn = async () => ({ rows: [row], rowCount: 1 });
    const rows = await browseProfiles(USER_A, q);
    assert.deepEqual(rows, [row]);
  });

  it('EXCLUDES users the caller has already liked', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    const sql = calls[0].text;
    assert.match(
      sql,
      /id\s+NOT\s+IN\s*\(\s*SELECT\s+to_user_id\s+FROM\s+likes\s+WHERE\s+from_user_id\s*=\s*\$1::uuid\s*\)/i,
    );
    // The exclusion set is derived from the caller's own likes — still exactly
    // ONE parameter (the caller id), so no request field can widen it.
    assert.deepEqual(calls[0].params, [USER_A]);
  });

  it('EXCLUDES a blocking relationship with the caller in EITHER direction', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    const sql = calls[0].text;
    assert.match(sql, /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+blocks/i);
    // Caller blocked the candidate.
    assert.match(sql, /blocker_id\s*=\s*\$1::uuid\s+AND\s+blocked_id\s*=\s*users\.id/i);
    // Candidate blocked the caller (reverse direction) — the isBlockedPair rule.
    assert.match(sql, /blocker_id\s*=\s*users\.id\s+AND\s+blocked_id\s*=\s*\$1::uuid/i);
    assert.deepEqual(calls[0].params, [USER_A]);
  });

  it('EXCLUDES users the caller passed within the last 15 days (older passes expire)', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    const sql = calls[0].text;
    assert.match(
      sql,
      /id\s+NOT\s+IN\s*\(\s*SELECT\s+to_user_id\s+FROM\s+passes\s+WHERE\s+from_user_id\s*=\s*\$1::uuid\s+AND\s+created_at\s*>\s*now\(\)\s*-\s*interval\s*'15 days'\s*\)/i,
    );
    // The 15-day window is a server-side constant, not a parameter: the query
    // still takes exactly ONE parameter (the caller id), so a client cannot
    // widen or shrink the window.
    assert.deepEqual(calls[0].params, [USER_A]);
  });

  it('EXCLUDES users with an OPEN report against them', async () => {
    const { q, calls } = trackQuery();
    await browseProfiles(USER_A, q);

    const sql = calls[0].text;
    assert.match(
      sql,
      /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+reports\s+WHERE\s+reported_id\s*=\s*users\.id\s+AND\s+status\s*=\s*'open'\s*\)/i,
    );
    // Moderation state is not a parameter either: still exactly ONE parameter.
    assert.deepEqual(calls[0].params, [USER_A]);
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

  describe('browseProfiles on the seeded data', () => {
    it('never returns the caller or a same-gender user, and only public fields', async () => {
      const caller = await getPublicProfile(USER_A);
      assert.ok(caller, 'seeded UserA must exist');

      const rows = await browseProfiles(USER_A);
      assert.ok(Array.isArray(rows));
      for (const row of rows) {
        assert.notEqual(row.id, USER_A, 'the caller must never appear in their own feed');
        assert.notEqual(row.gender, caller.gender, 'same-gender users must be filtered out');
        assert.deepEqual(Object.keys(row).sort(), [
          'created_at',
          'custom_interest_text',
          'gender',
          'id',
          'nickname',
          'photo_public_id',
        ]);
      }
    });

    it('excludes the seeded users the caller has already liked', async () => {
      const liked = await pool.query<{ to_user_id: string }>(
        'SELECT to_user_id FROM likes WHERE from_user_id = $1::uuid',
        [USER_A],
      );
      if (liked.rowCount === 0) return; // nothing seeded to assert against

      const rows = await browseProfiles(USER_A);
      for (const { to_user_id } of liked.rows) {
        assert.ok(
          !rows.some((r) => r.id === to_user_id),
          `a user the caller already liked (${to_user_id}) must not appear in the feed`,
        );
      }
    });
  });

describe('upsertUserByTelegram', () => {
  const input = {
    telegram_id: 1001,
    telegram_username: 'testuser_a',
    email: 'user@example.com',
    email_verified: true,
  };

  it('returns the upserted row with the user id and telegram_id', async () => {
    const row = {
      id: USER_A,
      telegram_id: '1001',
      telegram_username: 'testuser_a',
      email: 'user@example.com',
      email_verified: true,
      nickname: null,
      gender: null,
      photo_public_id: null,
      custom_interest_text: null,
      status: 'active',
      created_at: new Date('2026-01-01T00:00:00Z'),
    };
    const q: QueryFn = async () => ({ rows: [row], rowCount: 1 });

    const result = await upsertUserByTelegram(input, q);
    assert.equal(result?.id, USER_A);
    assert.equal(result?.telegram_id, '1001');
  });

  it('uses ON CONFLICT (telegram_id) and passes params in order', async () => {
    const { calls } = trackQuery();
    const q: QueryFn = async (text, params) => {
      calls.push({ text, params });
      return { rows: [], rowCount: 1 };
    };

    await upsertUserByTelegram(input, q);

    const sql = calls[0].text;
    assert.match(sql, /INSERT INTO users\s*\([^)]*telegram_id[^)]*\)/i);
    assert.match(sql, /ON CONFLICT \(telegram_id\) DO UPDATE/i);
    // $1::bigint first, then the other verified values in order.
    assert.deepEqual(calls[0].params, [1001, 'testuser_a', 'user@example.com', true]);
  });

  it('does not overwrite stored email on an existing owner (only refreshes username)', async () => {
    const { calls } = trackQuery();
    const q: QueryFn = async (text, params) => {
      calls.push({ text, params });
      return { rows: [], rowCount: 1 };
    };

    await upsertUserByTelegram(input, q);
    const sql = calls[0].text;
    assert.match(sql, /SET\s+telegram_username\s*=\s*EXCLUDED\.telegram_username/i);
    // email must NOT be in the DO UPDATE SET clause.
    assert.ok(!/SET[^)]*email\s*=/i.test(sql), 'email must not be overwritten on conflict');
  });

  it('returns null when no row is returned', async () => {
    const q: QueryFn = async () => ({ rows: [], rowCount: 0 });
    assert.equal(await upsertUserByTelegram(input, q), null);
  });
});
});

// ---------------------------------------------------------------------------
// Self-cleaning live-DB fixtures for the browse exclusions.
//
// The exclusion rules cannot be covered by the read-only seed data (the seeded
// `blocks` and `passes` tables are empty), so each test creates ONE temporary,
// browseable candidate and removes every row it creates in `finally`.
//
// `UserA` is seeded as 'male'; the candidate is 'female', so it is otherwise
// eligible for the feed (different gender, not self, active, not liked).
// ---------------------------------------------------------------------------
const TEMP_TELEGRAM_ID = 999_001;

/** Create (or re-create) the temporary browseable candidate; returns its id. */
async function createTempCandidate(): Promise<string> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO users (telegram_id, nickname, gender, status)
     VALUES ($1::bigint, 'BrowseTestTemp', 'female', 'active')
     ON CONFLICT (telegram_id) DO UPDATE
       SET gender = 'female', status = 'active'
     RETURNING id`,
    [TEMP_TELEGRAM_ID],
  );
  return inserted.rows[0].id;
}

/**
 * Best-effort teardown — never masks a test failure. `blocks` and `reports`
 * have NO ON DELETE CASCADE, so their rows must be removed BEFORE the user row.
 */
async function cleanupTempCandidate(tempId: string): Promise<void> {
  await pool
    .query('DELETE FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid', [tempId])
    .catch(() => undefined);
  await pool
    .query('DELETE FROM reports WHERE reported_id = $1::uuid OR reporter_id = $1::uuid', [tempId])
    .catch(() => undefined);
  await pool
    .query('DELETE FROM passes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid', [tempId])
    .catch(() => undefined);
  await pool
    .query('DELETE FROM likes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid', [tempId])
    .catch(() => undefined);
  await pool.query('DELETE FROM users WHERE id = $1::uuid', [tempId]).catch(() => undefined);
}

/** Is `candidateId` currently in UserA's browse feed? */
async function inFeed(candidateId: string): Promise<boolean> {
  const rows = await browseProfiles(USER_A);
  return rows.some((r) => r.id === candidateId);
}

describe('browseProfiles block exclusion (live DB, self-cleaning)', () => {
  it('hides a user the caller blocked, and a user who blocked the caller', async () => {
    const tempId = await createTempCandidate();

    try {
      // Clear any leftovers from a previous failed run before the control check.
      await pool.query(
        'DELETE FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid',
        [tempId],
      );

      // Control: with no block, this candidate IS in the caller's feed.
      assert.equal(await inFeed(tempId), true, 'control: an unblocked candidate is browsable');

      // Direction 1: the CALLER blocked the candidate.
      await pool.query(
        'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
        [USER_A, tempId],
      );
      assert.equal(
        await inFeed(tempId),
        false,
        'a user the caller blocked must not appear in the feed',
      );

      // Direction 2: the candidate blocked the CALLER (reverse direction).
      await pool.query(
        'DELETE FROM blocks WHERE blocker_id = $1::uuid AND blocked_id = $2::uuid',
        [USER_A, tempId],
      );
      await pool.query(
        'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
        [tempId, USER_A],
      );
      assert.equal(
        await inFeed(tempId),
        false,
        'a user who blocked the caller (reverse direction) must not appear in the feed',
      );
    } finally {
      await cleanupTempCandidate(tempId);
    }
  });
});

describe('browseProfiles pass exclusion (live DB, self-cleaning, time-boxed)', () => {
  it('reappears after a 20-day-old pass, but a 5-day-old pass still hides the user', async () => {
    const tempId = await createTempCandidate();

    try {
      // Clear any leftovers from a previous failed run before the control check.
      await pool.query(
        'DELETE FROM passes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid',
        [tempId],
      );

      // Control: with no pass, this candidate IS in the caller's feed.
      assert.equal(await inFeed(tempId), true, 'control: a candidate with no pass is browsable');

      // A pass 20 days old is OUTSIDE the 15-day window -> expired -> reappears.
      await pool.query(
        `INSERT INTO passes (from_user_id, to_user_id, created_at)
         VALUES ($1::uuid, $2::uuid, now() - interval '20 days')`,
        [USER_A, tempId],
      );
      assert.equal(
        await inFeed(tempId),
        true,
        'a pass older than 15 days must have expired, so the user reappears',
      );

      // Just past the window boundary (15 days + 1s) is still expired, because
      // the rule is `created_at > now() - interval '15 days'`.
      await pool.query(
        `UPDATE passes
            SET created_at = now() - interval '15 days' - interval '1 second'
          WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid`,
        [USER_A, tempId],
      );
      assert.equal(
        await inFeed(tempId),
        true,
        'a pass slightly older than the window must still be expired',
      );

      // A pass 5 days old is INSIDE the window -> the user stays hidden.
      await pool.query(
        `UPDATE passes
            SET created_at = now() - interval '5 days'
          WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid`,
        [USER_A, tempId],
      );
      assert.equal(
        await inFeed(tempId),
        false,
        'a pass within the last 15 days must hide the user',
      );
    } finally {
      await cleanupTempCandidate(tempId);
    }
  });
});

describe('browseProfiles open-report exclusion (live DB, self-cleaning)', () => {
  it('hides a user with an open report, and restores them once it is resolved', async () => {
    const tempId = await createTempCandidate();

    try {
      // Clear any leftovers from a previous failed run before the control check.
      await pool.query(
        'DELETE FROM reports WHERE reported_id = $1::uuid OR reporter_id = $1::uuid',
        [tempId],
      );

      // Control: with no report, this candidate IS in the caller's feed.
      assert.equal(await inFeed(tempId), true, 'control: an unreported candidate is browsable');

      // The caller files an OPEN report against the candidate.
      await pool.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, status)
         VALUES ($1::uuid, $2::uuid, 'browse fixture: open report', 'open')`,
        [USER_A, tempId],
      );
      assert.equal(
        await inFeed(tempId),
        false,
        'a user with an open report against them must not appear in the feed',
      );

      // Moderation resolves it -> the exclusion no longer applies.
      await pool.query(
        `UPDATE reports
            SET status = 'resolved'
          WHERE reported_id = $1::uuid AND status = 'open'`,
        [tempId],
      );
      assert.equal(
        await inFeed(tempId),
        true,
        'the user must reappear once the report is marked resolved',
      );
    } finally {
      await cleanupTempCandidate(tempId);
    }
  });
});
