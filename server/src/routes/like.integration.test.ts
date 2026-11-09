import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createLikeRouter } from './like';
import jwtAuth from '../middleware/jwt-auth';
import { signToken } from '../services/jwt';
import { pool } from '../db/pool';

const JWT_SECRET = 'integration-test-secret';
const JWT_EXPIRES_IN = '1h';

// Fixed UUIDs for the two users racing to like each other.
const USER_A = 'c074b9cb-48f0-4900-9040-2718ad82ce55';
const USER_B = 'b6084c09-cfed-4294-811a-7c3fbc1c1d9a';

function pairKeySql() {
  return `(LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))`;
}

async function countMatches(): Promise<number> {
  const res = await pool.query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt FROM matches
       WHERE (user_a_id, user_b_id) = ${pairKeySql()}`,
    [USER_A, USER_B],
  );
  return Number(res.rows[0].cnt);
}

async function postLike(baseUrl: string, token: string, targetId: string) {
  return fetch(`${baseUrl}/like/${targetId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('integration: POST /like concurrency (mutual-like race)', () => {
  let server: ReturnType<express.Express['listen']> | undefined;
  let baseUrl = '';

  before(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;

    // Seed the two users fresh (idempotent across repeated runs / crashes).
    await pool.query(
      `DELETE FROM matches WHERE (user_a_id, user_b_id) = ${pairKeySql()};`,
      [USER_A, USER_B],
    );
    await pool.query(
      `DELETE FROM likes WHERE (from_user_id, to_user_id) IN (($1::uuid, $2::uuid), ($2::uuid, $1::uuid));`,
      [USER_A, USER_B],
    );
    await pool.query(
      `DELETE FROM users WHERE id IN ($1::uuid, $2::uuid);`,
      [USER_A, USER_B],
    );
    await pool.query(
      `INSERT INTO users (id, telegram_id) VALUES ($1::uuid, 1001), ($2::uuid, 1002) ON CONFLICT (id) DO NOTHING`,
      [USER_A, USER_B],
    );
    await pool.query(
      `UPDATE users SET likes_sent_today = 0, likes_reset_at = now() WHERE id IN ($1::uuid, $2::uuid);`,
      [USER_A, USER_B],
    );

    const app = express();
    app.use(express.json());
    app.use('/like', jwtAuth, createLikeRouter());
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await pool.query(
      `DELETE FROM matches WHERE (user_a_id, user_b_id) = ${pairKeySql()};`,
      [USER_A, USER_B],
    );
    await pool.query(
      `DELETE FROM likes WHERE (from_user_id, to_user_id) IN (($1::uuid, $2::uuid), ($2::uuid, $1::uuid));`,
      [USER_A, USER_B],
    );
    await pool.query(`DELETE FROM users WHERE id IN ($1::uuid, $2::uuid);`, [USER_A, USER_B]);
    server?.close();
    await pool.end();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  it('simultaneous A->B and B->A likes yield exactly one match row and no 500s', async () => {
    const tokenA = signToken(USER_A);
    const tokenB = signToken(USER_B);

    // Fire both likes simultaneously.
    const [resA, resB] = await Promise.all([
      postLike(baseUrl, tokenA, USER_B),
      postLike(baseUrl, tokenB, USER_A),
    ]);

    // Neither side may surface an unhandled 500.
    assert.notEqual(resA.status, 500, `A->B returned ${resA.status}`);
    assert.notEqual(resB.status, 500, `B->A returned ${resB.status}`);

    // Both likes were recorded (201). The match-insert unique-violation on the
    // losing side is swallowed, so it is still a success, not an error.
    assert.equal(resA.status, 201, `A->B expected 201, got ${resA.status}`);
    assert.equal(resB.status, 201, `B->A expected 201, got ${resB.status}`);

    // Exactly one matches row exists for the unordered pair despite two
    // concurrent inserts hitting the same matches_unique_pair key.
    assert.equal(await countMatches(), 1, 'expected exactly one match row');
  });
});
