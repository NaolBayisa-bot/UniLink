# Performance Notes — UniLink v1 (Task 25)

## 1. Seed ~10,000 users

Run against the test database:

```bash
psql postgres://unilink_app:@localhost:5432/unilink_test <<'SQL'
-- Idempotent seed: 10,000 users (5k male, 5k female), all with complete profiles.
INSERT INTO users (telegram_id, telegram_username, nickname, gender, real_name, department)
SELECT
  2000000 + g,
  'u_' || g,
  'User ' || g,
  CASE WHEN g % 2 = 0 THEN 'male' ELSE 'female' END,
  'Real Name',
  'Dept'
FROM generate_series(1, 10000) AS g
ON CONFLICT (telegram_id) DO NOTHING;
SQL
```

This creates ~10,000 active users with complete profiles so they appear in
`/browse` for opposite-gender callers.

## 2. Run EXPLAIN ANALYZE on the browse query

The browse query is `_BROWSE_SQL` in `app/routes/browse.py`. Run it as a typical
caller (male looking for females), e.g. with `<caller_id>` a real user id from
the seed:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.nickname, u.created_at
FROM users u
WHERE u.status = 'active'
  AND u.id <> '<caller_id>'::uuid
  AND u.gender = 'female'
  AND u.nickname IS NOT NULL
  AND u.real_name IS NOT NULL
  AND u.department IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM likes l
      WHERE l.from_user_id = '<caller_id>'::uuid AND l.to_user_id = u.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = '<caller_id>'::uuid AND b.blocked_id = u.id)
         OR (b.blocked_id = '<caller_id>'::uuid AND b.blocker_id = u.id)
  )
  AND NOT EXISTS (
      SELECT 1 FROM reports r
      WHERE r.reporter_id = '<caller_id>'::uuid AND r.reported_id = u.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE least(m.user_a_id, m.user_b_id) = least('<caller_id>'::uuid, u.id)
        AND greatest(m.user_a_id, m.user_b_id) = greatest('<caller_id>'::uuid, u.id)
        AND m.unmatched_at IS NULL
  )
ORDER BY u.created_at DESC
LIMIT 20;
```

## 3. How to read the plan

- Look for **Index Scan** / **Index Only Scan** on `users` driven by the
  `status = 'active' AND gender = 'female'` predicate, and **Index Scan** on
  the `likes`, `blocks`, `reports`, and `matches` lookups (correlated
  `NOT EXISTS` subqueries).
- The `created_at DESC ... LIMIT 20` should use an index (or a top-N heapsort
  over a small candidate set) rather than sorting all 10,000 rows.
- Any **Seq Scan** on a large table is a red flag.

## 4. If the blocks lookups show a sequential scan

Migration `0004_create_safety_tables.sql` already creates:

```sql
CREATE INDEX blocks_blocker_idx ON blocks (blocker_id);
CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);
```

A sequential scan on `blocks` despite these indexes usually means one of:

1. **Stale planner statistics.** Fix with:
   ```sql
   ANALYZE blocks;
   ANALYZE likes;
   ANALYZE reports;
   ANALYZE matches;
   ANALYZE users;
   ```

2. **The planner chooses a seq scan because the table is tiny.** With only a few
   hundred rows a seq scan is cheaper; at 10k+ users it should switch to index
   scans once `ANALYZE` has been run.

3. **`reports` has no index on `reporter_id`.** Migration `0004` creates no
   index on `reports`. As the reports table grows, the reporter-scoped browse
   filter (`WHERE r.reporter_id = ... AND r.reported_id = u.id`) can seq-scan
   `reports`. Watch item: consider adding
   `CREATE INDEX reports_reporter_idx ON reports (reporter_id);`
   before reports volume becomes significant.

## Expected outcome

With indexes and fresh statistics, the browse query against 10,000 users should
execute in low single-digit milliseconds, dominated by the `users` index scan
plus a handful of indexed existence checks. No sequential scans on tables that
grow with the user base.
