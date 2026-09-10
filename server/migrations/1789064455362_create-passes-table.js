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
    CREATE TABLE passes (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_passes_from_created ON passes (from_user_id, created_at);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE passes;');
};