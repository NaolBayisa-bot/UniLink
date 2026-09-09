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
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  pgm.sql(`
    CREATE TABLE users (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_id           bigint UNIQUE NOT NULL,
      telegram_username     text,
      email                 text,
      email_verified        boolean NOT NULL DEFAULT false,
      nickname              text,
      gender                text CHECK (gender IN ('male','female')),
      real_name             text,
      department            text,
      photo_public_id       text,
      custom_interest_text  text,
      status                text NOT NULL DEFAULT 'active',
      likes_sent_today      int NOT NULL DEFAULT 0,
      likes_reset_at        timestamptz NOT NULL DEFAULT now(),
      created_at            timestamptz NOT NULL DEFAULT now()
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE users;');
};
