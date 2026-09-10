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
    CREATE TABLE reports (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id uuid REFERENCES users(id),
      reported_id uuid REFERENCES users(id),
      reason      text NOT NULL,
      status      text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','resolved')),
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE reports;');
};