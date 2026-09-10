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
    CREATE TABLE likes (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   timestamptz NOT NULL DEFAULT now(),
      UNIQUE (from_user_id, to_user_id)
    );

    CREATE INDEX idx_likes_to_from ON likes (to_user_id, from_user_id);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE likes;');
};