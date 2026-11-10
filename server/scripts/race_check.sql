-- scripts/race_check.sql
-- Usage: psql -h localhost -U unilink_app -d unilink -f scripts/race_check.sql
--        (or \i scripts/race_check.sql from inside psql)
--
-- Goal: prove matches_active_pair blocks duplicate active matches but allows
--       a re-match after an unmatch.
--
-- Expected: step b succeeds, step c fails with 23505 on matches_active_pair,
--           step d succeeds after unmatch, step e cleans up.

\set ON_ERROR_STOP off
\set ECHO all

-- a. Create two test users A and B; capture their ids via psql \gset variables.
--    The aliased RETURNING column becomes the psql variable name (:aid, :bid).
INSERT INTO users (telegram_id, telegram_username, nickname)
VALUES (90001, 'race_user_a', 'Alice') RETURNING id AS aid \gset

INSERT INTO users (telegram_id, telegram_username, nickname)
VALUES (90002, 'race_user_b', 'Bob') RETURNING id AS bid \gset

\echo 'Test users: A = :aid, B = :bid'

-- b. Insert match (A, B) -> must succeed  (:'var' quotes the uuid as a SQL literal)
INSERT INTO matches (user_a_id, user_b_id) VALUES (:'aid', :'bid');
\echo 'step b: match (A,B) inserted'

-- c. Insert match (B, A) -> must FAIL with 23505 on matches_active_pair
INSERT INTO matches (user_a_id, user_b_id) VALUES (:'bid', :'aid');
\echo 'step c: if this prints, the duplicate insert did NOT fail (unexpected)'

-- d. Unmatch (A,B), then re-insert (B,A) -> must succeed
UPDATE matches SET unmatched_at = now()
WHERE user_a_id = :'aid' AND user_b_id = :'bid' AND unmatched_at IS NULL;

INSERT INTO matches (user_a_id, user_b_id) VALUES (:'bid', :'aid');
\echo 'step d: re-match (B,A) inserted after unmatch'

-- e. Delete the two test users; ON DELETE CASCADE removes related rows
DELETE FROM users WHERE id IN (:'aid', :'bid');
\echo 'step e: test users deleted (cascade cleaned related rows)'