/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE matches (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id    uuid REFERENCES users(id),
      user_b_id    uuid REFERENCES users(id),
      matched_at   timestamptz NOT NULL DEFAULT now(),
      unmatched_at timestamptz
    );

    CREATE UNIQUE INDEX matches_unique_pair
      ON matches (least(user_a_id, user_b_id), greatest(user_a_id, user_b_id));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE matches;');
};