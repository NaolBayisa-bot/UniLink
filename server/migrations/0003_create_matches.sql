-- depends: 0002_create_likes

CREATE TABLE matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_at timestamptz NOT NULL DEFAULT now(),
    unmatched_at timestamptz,                       -- NULL means the match is active
    CHECK (user_a_id <> user_b_id)
);

CREATE UNIQUE INDEX matches_active_pair
    ON matches (least(user_a_id, user_b_id), greatest(user_a_id, user_b_id))
    WHERE unmatched_at IS NULL;                     -- PARTIAL index

CREATE INDEX matches_user_a_idx ON matches (user_a_id);
CREATE INDEX matches_user_b_idx ON matches (user_b_id);