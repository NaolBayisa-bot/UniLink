#!/usr/bin/env python3
"""Concurrency load test for POST /like under gunicorn.

Run the server like production against the test database (NOT flask run):

    DATABASE_URL=postgres://unilink_app:@localhost:5432/unilink_test \
    JWT_SECRET=<same-secret-as-server> \
    gunicorn -w 4 --threads 2 -b 127.0.0.1:8000 'wsgi:app'

Then, in another terminal:

    python scripts/load_like.py

What the script does:
  * Inserts 50 male/female user pairs directly into the test database.
  * Signs a JWT for every user (same HS256 secret the server verifies).
  * For each pair, fires A->B and B->A POST /like at the same instant
    (ThreadPoolExecutor), repeated over several rounds.
  * Asserts exactly one active match per pair, no duplicate likes rows,
    and zero 5xx responses.

Run this script five times in a row; it must pass every time.
"""

import json
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import jwt
import psycopg
from psycopg.rows import dict_row

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "37d5e9e64b034846d53c366bca3d06b746d9f4efe922801129e268a2c1cb81d3",
)
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgres://unilink_app:@localhost:5432/unilink_test",
)

NUM_PAIRS = 50
ROUNDS = 3


def sign_token(user_id):
    """Sign a JWT identical in shape to the one the auth route issues
    (sub, iat, exp; verify_token requires exp and sub)."""
    now = int(time.time())
    claims = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + 60 * 60,  # 1 hour, same order of magnitude as the app
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def setup_db():
    """Insert NUM_PAIRS active male/female pairs; return list of (male_id, female_id)."""
    pairs = []
    with psycopg.connect(TEST_DB_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            for i in range(NUM_PAIRS):
                cur.execute(
                    """
                    INSERT INTO users
                        (telegram_id, telegram_username, nickname, gender, real_name, department)
                    VALUES
                        (%s, %s, %s, %s, %s, %s),
                        (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        900000 + i * 2, f"male_{i}", f"Male{i:03d}", "male", "R", "D",
                        900001 + i * 2, f"female_{i}", f"Female{i:03d}", "female", "R", "D",
                    ),
                )
                rows = cur.fetchall()
                pairs.append((str(rows[0]["id"]), str(rows[1]["id"])))
        conn.commit()
    return pairs


def fire_like(url, token, to_user_id):
    """Fire a single POST /like; return the HTTP status code (int)."""
    body = json.dumps({"to_user_id": to_user_id}).encode("utf-8")
    req = Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req) as resp:
            return resp.status
    except HTTPError as exc:
        return exc.code


def run_round(pairs, tokens):
    """Fire A->B and B->A concurrently for every pair; return list of statuses."""
    statuses = []
    with ThreadPoolExecutor(max_workers=2 * NUM_PAIRS) as ex:
        futures = []
        for male_id, female_id in pairs:
            futures.append(
                ex.submit(fire_like, f"{BASE_URL}/like", tokens[male_id], female_id)
            )
            futures.append(
                ex.submit(fire_like, f"{BASE_URL}/like", tokens[female_id], male_id)
            )
        for fut in as_completed(futures):
            statuses.append(fut.result())
    return statuses


def assert_invariants(pairs):
    """Check the database state after all rounds."""
    with psycopg.connect(TEST_DB_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            for male_id, female_id in pairs:
                cur.execute(
                    """
                    SELECT count(*) AS n FROM matches
                    WHERE least(user_a_id, user_b_id) = least(%s::uuid, %s::uuid)
                      AND greatest(user_a_id, user_b_id) = greatest(%s::uuid, %s::uuid)
                      AND unmatched_at IS NULL
                    """,
                    (male_id, female_id, male_id, female_id),
                )
                n = cur.fetchone()["n"]
                assert n == 1, (
                    f"pair {male_id}/{female_id}: expected 1 active match, got {n}"
                )
                cur.execute(
                    "SELECT count(*) AS n FROM likes WHERE from_user_id = %s::uuid AND to_user_id = %s::uuid",
                    (male_id, female_id),
                )
                assert cur.fetchone()["n"] == 1, f"duplicate likes {male_id}->{female_id}"
                cur.execute(
                    "SELECT count(*) AS n FROM likes WHERE from_user_id = %s::uuid AND to_user_id = %s::uuid",
                    (female_id, male_id),
                )
                assert cur.fetchone()["n"] == 1, f"duplicate likes {female_id}->{male_id}"


def main():
    print(f"Setting up {NUM_PAIRS} user pairs in {TEST_DB_URL} ...")
    pairs = setup_db()
    tokens = {}
    for male_id, female_id in pairs:
        tokens[male_id] = sign_token(male_id)
        tokens[female_id] = sign_token(female_id)

    all_statuses = []
    for r in range(ROUNDS):
        statuses = run_round(pairs, tokens)
        all_statuses.extend(statuses)
        print(f"  round {r + 1}/{ROUNDS}: {len(statuses)} likes fired")

    assert_invariants(pairs)

    bad = [s for s in all_statuses if s >= 500]
    assert not bad, f"got {len(bad)} 5xx responses: {bad[:10]}"

    total = NUM_PAIRS * ROUNDS * 2
    print(
        f"PASS: {NUM_PAIRS} pairs x {ROUNDS} rounds = {total} concurrent likes, "
        "exactly one active match per pair, no duplicate likes rows, zero 5xx."
    )


if __name__ == "__main__":
    main()

