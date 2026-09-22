"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const authorization_1 = require("../middleware/authorization");
const users_1 = require("./users");
const pool_1 = require("./pool");
const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
/** A mock query fn that records every call and returns sensible defaults. */
function trackQuery() {
    const calls = [];
    const q = async (text, params) => {
        calls.push({ text, params });
        return { rows: [], rowCount: 1 };
    };
    return { q, calls };
}
(0, node_test_1.describe)('updateOwnProfile', () => {
    (0, node_test_1.it)('REQUIRED: silently drops gender — SQL contains no gender column', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.updateOwnProfile)(USER_A, { gender: 'female', nickname: 'NewNick' }, q);
        strict_1.default.equal(calls.length, 1);
        const sql = calls[0].text;
        // The generated UPDATE must never reference the gender column.
        strict_1.default.ok(!/gender/i.test(sql), `SQL must not mention gender: ${sql}`);
        // nickname is still updated alongside.
        strict_1.default.match(sql, /nickname\s*=\s*\$2/i);
        strict_1.default.deepEqual(calls[0].params, [USER_A, 'NewNick']);
    });
    (0, node_test_1.it)('gender-only call issues NO database query (silent no-op)', async () => {
        let queried = false;
        const q = async () => {
            queried = true;
            return { rows: [], rowCount: 1 };
        };
        const result = await (0, users_1.updateOwnProfile)(USER_A, { gender: 'female' }, q);
        strict_1.default.equal(queried, false, 'no UPDATE should be executed for a gender-only call');
        strict_1.default.equal(result.rowCount, 0);
    });
    (0, node_test_1.it)('updates a whitelisted field with correct SQL and params', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.updateOwnProfile)(USER_A, { nickname: 'Al', department: 'CS' }, q);
        strict_1.default.equal(calls.length, 1);
        const sql = calls[0].text;
        strict_1.default.match(sql, /UPDATE\s+users/i);
        strict_1.default.match(sql, /nickname\s*=\s*\$2/i);
        strict_1.default.match(sql, /department\s*=\s*\$3/i);
        strict_1.default.match(sql, /WHERE\s+id\s*=\s*\$1::uuid/i);
        strict_1.default.deepEqual(calls[0].params, [USER_A, 'Al', 'CS']);
    });
    (0, node_test_1.it)('ignores non-allowlisted columns (e.g. an attacker-supplied key)', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.updateOwnProfile)(USER_A, { nickname: 'Safe', email_verified: true, likes_sent_today: 999 }, q);
        const sql = calls[0].text;
        strict_1.default.match(sql, /nickname\s*=\s*\$2/i);
        strict_1.default.ok(!/email_verified/i.test(sql), 'email_verified must be excluded');
        strict_1.default.ok(!/likes_sent_today/i.test(sql), 'likes_sent_today must be excluded');
        strict_1.default.deepEqual(calls[0].params, [USER_A, 'Safe']);
    });
    (0, node_test_1.it)('issues no query when every provided field is non-editable', async () => {
        let queried = false;
        const q = async () => {
            queried = true;
            return { rows: [], rowCount: 1 };
        };
        await (0, users_1.updateOwnProfile)(USER_A, { gender: 'male', email_verified: true }, q);
        strict_1.default.equal(queried, false);
    });
});
(0, node_test_1.describe)('adminCorrectGender', () => {
    (0, node_test_1.it)('issues UPDATE users SET gender and returns rowCount (admin path)', async () => {
        const { q, calls } = trackQuery();
        const result = await (0, users_1.adminCorrectGender)(USER_A, 'female', q);
        strict_1.default.equal(calls.length, 1);
        const sql = calls[0].text;
        strict_1.default.match(sql, /UPDATE\s+users/i);
        strict_1.default.match(sql, /SET\s+gender\s*=\s*\$2::text/i);
        strict_1.default.deepEqual(calls[0].params, [USER_A, 'female']);
        strict_1.default.equal(result.rowCount, 1);
    });
    (0, node_test_1.it)('rejects an invalid gender with HttpError(400)', async () => {
        let queried = false;
        const q = async () => {
            queried = true;
            return { rows: [], rowCount: 1 };
        };
        await strict_1.default.rejects(() => (0, users_1.adminCorrectGender)(USER_A, 'other', q), (err) => {
            strict_1.default.ok(err instanceof authorization_1.HttpError);
            strict_1.default.equal(err.status, 400);
            return true;
        });
        strict_1.default.equal(queried, false, 'no query should run for an invalid gender');
    });
});
(0, node_test_1.describe)('browseProfiles', () => {
    (0, node_test_1.it)('filters on the caller gender from the CALLER OWN ROW, active status, and not-self', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        strict_1.default.equal(calls.length, 1);
        const sql = calls[0].text;
        // Excludes the caller themselves.
        strict_1.default.match(sql, /id\s*<>\s*\$1::uuid/i);
        // Only active accounts.
        strict_1.default.match(sql, /status\s*=\s*'active'/i);
        // The comparison gender is read server-side from the caller's own row.
        strict_1.default.match(sql, /gender\s*<>\s*\(\s*SELECT\s+gender\s+FROM\s+users\s+WHERE\s+id\s*=\s*\$1::uuid\s*\)/is);
        // Exactly ONE parameter — the caller id. There is no slot a forged gender
        // could occupy, so a client-supplied gender can never influence the query.
        strict_1.default.deepEqual(calls[0].params, [USER_A]);
    });
    (0, node_test_1.it)('selects ONLY the Task-22 public-profile field set', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        const sql = calls[0].text;
        for (const field of [
            'id',
            'nickname',
            'gender',
            'photo_public_id',
            'custom_interest_text',
            'created_at',
        ]) {
            strict_1.default.match(sql, new RegExp(`\\b${field}\\b`), `${field} must be selected`);
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
            strict_1.default.ok(!new RegExp(forbidden, 'i').test(sql), `${forbidden} must not be selected`);
        }
        // `status` is used as a FILTER only — never returned as a column.
        strict_1.default.ok(!/\bstatus\b/i.test(sql.split(/WHERE/i)[0]), 'status must not be part of the SELECT list');
    });
    (0, node_test_1.it)('returns the rows the database yields, unchanged', async () => {
        const row = {
            id: USER_A,
            nickname: 'Someone',
            gender: 'female',
            photo_public_id: null,
            custom_interest_text: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
        };
        const q = async () => ({ rows: [row], rowCount: 1 });
        const rows = await (0, users_1.browseProfiles)(USER_A, q);
        strict_1.default.deepEqual(rows, [row]);
    });
    (0, node_test_1.it)('EXCLUDES users the caller has already liked', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        const sql = calls[0].text;
        strict_1.default.match(sql, /id\s+NOT\s+IN\s*\(\s*SELECT\s+to_user_id\s+FROM\s+likes\s+WHERE\s+from_user_id\s*=\s*\$1::uuid\s*\)/i);
        // The exclusion set is derived from the caller's own likes — still exactly
        // ONE parameter (the caller id), so no request field can widen it.
        strict_1.default.deepEqual(calls[0].params, [USER_A]);
    });
    (0, node_test_1.it)('EXCLUDES a blocking relationship with the caller in EITHER direction', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        const sql = calls[0].text;
        strict_1.default.match(sql, /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+blocks/i);
        // Caller blocked the candidate.
        strict_1.default.match(sql, /blocker_id\s*=\s*\$1::uuid\s+AND\s+blocked_id\s*=\s*users\.id/i);
        // Candidate blocked the caller (reverse direction) — the isBlockedPair rule.
        strict_1.default.match(sql, /blocker_id\s*=\s*users\.id\s+AND\s+blocked_id\s*=\s*\$1::uuid/i);
        strict_1.default.deepEqual(calls[0].params, [USER_A]);
    });
    (0, node_test_1.it)('EXCLUDES users the caller passed within the last 15 days (older passes expire)', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        const sql = calls[0].text;
        strict_1.default.match(sql, /id\s+NOT\s+IN\s*\(\s*SELECT\s+to_user_id\s+FROM\s+passes\s+WHERE\s+from_user_id\s*=\s*\$1::uuid\s+AND\s+created_at\s*>\s*now\(\)\s*-\s*interval\s*'15 days'\s*\)/i);
        // The 15-day window is a server-side constant, not a parameter: the query
        // still takes exactly ONE parameter (the caller id), so a client cannot
        // widen or shrink the window.
        strict_1.default.deepEqual(calls[0].params, [USER_A]);
    });
    (0, node_test_1.it)('EXCLUDES users with an OPEN report against them', async () => {
        const { q, calls } = trackQuery();
        await (0, users_1.browseProfiles)(USER_A, q);
        const sql = calls[0].text;
        strict_1.default.match(sql, /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+reports\s+WHERE\s+reported_id\s*=\s*users\.id\s+AND\s+status\s*=\s*'open'\s*\)/i);
        // Moderation state is not a parameter either: still exactly ONE parameter.
        strict_1.default.deepEqual(calls[0].params, [USER_A]);
    });
});
// Read-only integration check: gender cannot be changed by a normal profile
// update against the real Task-20 seeded user.
(0, node_test_1.describe)('integration (live DB, read-only)', () => {
    (0, node_test_1.it)('a normal profile update leaves the stored gender unchanged', async () => {
        const before = await (0, users_1.getPublicProfile)(USER_A);
        strict_1.default.ok(before);
        await (0, users_1.updateOwnProfile)(USER_A, { gender: 'female', nickname: before.nickname ?? 'UserA' });
        const after = await (0, users_1.getPublicProfile)(USER_A);
        strict_1.default.ok(after);
        strict_1.default.equal(after.gender, before.gender, 'gender must be unchanged after self-update');
    });
    (0, node_test_1.describe)('browseProfiles on the seeded data', () => {
        (0, node_test_1.it)('never returns the caller or a same-gender user, and only public fields', async () => {
            const caller = await (0, users_1.getPublicProfile)(USER_A);
            strict_1.default.ok(caller, 'seeded UserA must exist');
            const rows = await (0, users_1.browseProfiles)(USER_A);
            strict_1.default.ok(Array.isArray(rows));
            for (const row of rows) {
                strict_1.default.notEqual(row.id, USER_A, 'the caller must never appear in their own feed');
                strict_1.default.notEqual(row.gender, caller.gender, 'same-gender users must be filtered out');
                strict_1.default.deepEqual(Object.keys(row).sort(), [
                    'created_at',
                    'custom_interest_text',
                    'gender',
                    'id',
                    'nickname',
                    'photo_public_id',
                ]);
            }
        });
        (0, node_test_1.it)('excludes the seeded users the caller has already liked', async () => {
            const liked = await pool_1.pool.query('SELECT to_user_id FROM likes WHERE from_user_id = $1::uuid', [USER_A]);
            if (liked.rowCount === 0)
                return; // nothing seeded to assert against
            const rows = await (0, users_1.browseProfiles)(USER_A);
            for (const { to_user_id } of liked.rows) {
                strict_1.default.ok(!rows.some((r) => r.id === to_user_id), `a user the caller already liked (${to_user_id}) must not appear in the feed`);
            }
        });
    });
    (0, node_test_1.describe)('upsertUserByTelegram', () => {
        const input = {
            telegram_id: 1001,
            telegram_username: 'testuser_a',
            email: 'user@example.com',
            email_verified: true,
        };
        (0, node_test_1.it)('returns the upserted row with the user id and telegram_id', async () => {
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
            const q = async () => ({ rows: [row], rowCount: 1 });
            const result = await (0, users_1.upsertUserByTelegram)(input, q);
            strict_1.default.equal(result?.id, USER_A);
            strict_1.default.equal(result?.telegram_id, '1001');
        });
        (0, node_test_1.it)('uses ON CONFLICT (telegram_id) and passes params in order', async () => {
            const { calls } = trackQuery();
            const q = async (text, params) => {
                calls.push({ text, params });
                return { rows: [], rowCount: 1 };
            };
            await (0, users_1.upsertUserByTelegram)(input, q);
            const sql = calls[0].text;
            strict_1.default.match(sql, /INSERT INTO users\s*\([^)]*telegram_id[^)]*\)/i);
            strict_1.default.match(sql, /ON CONFLICT \(telegram_id\) DO UPDATE/i);
            // $1::bigint first, then the other verified values in order.
            strict_1.default.deepEqual(calls[0].params, [1001, 'testuser_a', 'user@example.com', true]);
        });
        (0, node_test_1.it)('does not overwrite stored email on an existing owner (only refreshes username)', async () => {
            const { calls } = trackQuery();
            const q = async (text, params) => {
                calls.push({ text, params });
                return { rows: [], rowCount: 1 };
            };
            await (0, users_1.upsertUserByTelegram)(input, q);
            const sql = calls[0].text;
            strict_1.default.match(sql, /SET\s+telegram_username\s*=\s*EXCLUDED\.telegram_username/i);
            // email must NOT be in the DO UPDATE SET clause.
            strict_1.default.ok(!/SET[^)]*email\s*=/i.test(sql), 'email must not be overwritten on conflict');
        });
        (0, node_test_1.it)('returns null when no row is returned', async () => {
            const q = async () => ({ rows: [], rowCount: 0 });
            strict_1.default.equal(await (0, users_1.upsertUserByTelegram)(input, q), null);
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
const TEMP_TELEGRAM_ID = 999001;
/** Create (or re-create) the temporary browseable candidate; returns its id. */
async function createTempCandidate() {
    const inserted = await pool_1.pool.query(`INSERT INTO users (telegram_id, nickname, gender, status)
     VALUES ($1::bigint, 'BrowseTestTemp', 'female', 'active')
     ON CONFLICT (telegram_id) DO UPDATE
       SET gender = 'female', status = 'active'
     RETURNING id`, [TEMP_TELEGRAM_ID]);
    return inserted.rows[0].id;
}
/**
 * Best-effort teardown — never masks a test failure. `blocks` and `reports`
 * have NO ON DELETE CASCADE, so their rows must be removed BEFORE the user row.
 */
async function cleanupTempCandidate(tempId) {
    await pool_1.pool
        .query('DELETE FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid', [tempId])
        .catch(() => undefined);
    await pool_1.pool
        .query('DELETE FROM reports WHERE reported_id = $1::uuid OR reporter_id = $1::uuid', [tempId])
        .catch(() => undefined);
    await pool_1.pool
        .query('DELETE FROM passes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid', [tempId])
        .catch(() => undefined);
    await pool_1.pool
        .query('DELETE FROM likes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid', [tempId])
        .catch(() => undefined);
    await pool_1.pool.query('DELETE FROM users WHERE id = $1::uuid', [tempId]).catch(() => undefined);
}
/** Is `candidateId` currently in UserA's browse feed? */
async function inFeed(candidateId) {
    const rows = await (0, users_1.browseProfiles)(USER_A);
    return rows.some((r) => r.id === candidateId);
}
(0, node_test_1.describe)('browseProfiles block exclusion (live DB, self-cleaning)', () => {
    (0, node_test_1.it)('hides a user the caller blocked, and a user who blocked the caller', async () => {
        const tempId = await createTempCandidate();
        try {
            // Clear any leftovers from a previous failed run before the control check.
            await pool_1.pool.query('DELETE FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid', [tempId]);
            // Control: with no block, this candidate IS in the caller's feed.
            strict_1.default.equal(await inFeed(tempId), true, 'control: an unblocked candidate is browsable');
            // Direction 1: the CALLER blocked the candidate.
            await pool_1.pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING', [USER_A, tempId]);
            strict_1.default.equal(await inFeed(tempId), false, 'a user the caller blocked must not appear in the feed');
            // Direction 2: the candidate blocked the CALLER (reverse direction).
            await pool_1.pool.query('DELETE FROM blocks WHERE blocker_id = $1::uuid AND blocked_id = $2::uuid', [USER_A, tempId]);
            await pool_1.pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING', [tempId, USER_A]);
            strict_1.default.equal(await inFeed(tempId), false, 'a user who blocked the caller (reverse direction) must not appear in the feed');
        }
        finally {
            await cleanupTempCandidate(tempId);
        }
    });
});
(0, node_test_1.describe)('browseProfiles pass exclusion (live DB, self-cleaning, time-boxed)', () => {
    (0, node_test_1.it)('reappears after a 20-day-old pass, but a 5-day-old pass still hides the user', async () => {
        const tempId = await createTempCandidate();
        try {
            // Clear any leftovers from a previous failed run before the control check.
            await pool_1.pool.query('DELETE FROM passes WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid', [tempId]);
            // Control: with no pass, this candidate IS in the caller's feed.
            strict_1.default.equal(await inFeed(tempId), true, 'control: a candidate with no pass is browsable');
            // A pass 20 days old is OUTSIDE the 15-day window -> expired -> reappears.
            await pool_1.pool.query(`INSERT INTO passes (from_user_id, to_user_id, created_at)
         VALUES ($1::uuid, $2::uuid, now() - interval '20 days')`, [USER_A, tempId]);
            strict_1.default.equal(await inFeed(tempId), true, 'a pass older than 15 days must have expired, so the user reappears');
            // Just past the window boundary (15 days + 1s) is still expired, because
            // the rule is `created_at > now() - interval '15 days'`.
            await pool_1.pool.query(`UPDATE passes
            SET created_at = now() - interval '15 days' - interval '1 second'
          WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid`, [USER_A, tempId]);
            strict_1.default.equal(await inFeed(tempId), true, 'a pass slightly older than the window must still be expired');
            // A pass 5 days old is INSIDE the window -> the user stays hidden.
            await pool_1.pool.query(`UPDATE passes
            SET created_at = now() - interval '5 days'
          WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid`, [USER_A, tempId]);
            strict_1.default.equal(await inFeed(tempId), false, 'a pass within the last 15 days must hide the user');
        }
        finally {
            await cleanupTempCandidate(tempId);
        }
    });
});
(0, node_test_1.describe)('browseProfiles open-report exclusion (live DB, self-cleaning)', () => {
    (0, node_test_1.it)('hides a user with an open report, and restores them once it is resolved', async () => {
        const tempId = await createTempCandidate();
        try {
            // Clear any leftovers from a previous failed run before the control check.
            await pool_1.pool.query('DELETE FROM reports WHERE reported_id = $1::uuid OR reporter_id = $1::uuid', [tempId]);
            // Control: with no report, this candidate IS in the caller's feed.
            strict_1.default.equal(await inFeed(tempId), true, 'control: an unreported candidate is browsable');
            // The caller files an OPEN report against the candidate.
            await pool_1.pool.query(`INSERT INTO reports (reporter_id, reported_id, reason, status)
         VALUES ($1::uuid, $2::uuid, 'browse fixture: open report', 'open')`, [USER_A, tempId]);
            strict_1.default.equal(await inFeed(tempId), false, 'a user with an open report against them must not appear in the feed');
            // Moderation resolves it -> the exclusion no longer applies.
            await pool_1.pool.query(`UPDATE reports
            SET status = 'resolved'
          WHERE reported_id = $1::uuid AND status = 'open'`, [tempId]);
            strict_1.default.equal(await inFeed(tempId), true, 'the user must reappear once the report is marked resolved');
        }
        finally {
            await cleanupTempCandidate(tempId);
        }
    });
});
//# sourceMappingURL=users.test.js.map