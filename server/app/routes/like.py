"""Like routes.

POST /like - record a like and create a match if the like is reciprocal.

A transaction-level Postgres advisory lock per user pair serializes concurrent
likes between the same two people so exactly one match is created even when
both likes arrive at the same instant (the classic lost-match race).
"""

from uuid import UUID

from flask import Blueprint, jsonify, g, request
from psycopg.errors import UniqueViolation

from app.auth.decorators import require_auth
from app.db.query import execute, fetch_one, transaction

like = Blueprint("like", __name__)

OPPOSITE_GENDER = {"male": "female", "female": "male"}


@like.post("/like")
@require_auth
def like_user():
    """Record a like from the authenticated user to another user.

    Body: {"to_user_id": "<uuid>"}.

    Returns 200 {"matched": bool, "match_id": id or null}.
    """
    body = request.get_json(silent=True) or {}
    to_user_id_raw = body.get("to_user_id")

    # Validate to_user_id is a UUID.
    try:
        to_user_id = str(UUID(str(to_user_id_raw)))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    me = str(g.user_id)
    if to_user_id == me:
        # Liking yourself is a validation error, not a not-found.
        return jsonify({"error": "invalid_input"}), 400

    caller_gender = g.user.get("gender")
    opposite = OPPOSITE_GENDER.get(caller_gender)
    if opposite is None:
        return jsonify({"error": "not_found"}), 404

    # Lock key is identical regardless of which direction the like comes from,
    # so A->B and B->A serialize on the same lock.
    lock_key = ":".join(sorted([me, to_user_id]))

    matched = False
    match_id = None

    with transaction() as conn:
        # a. Take the advisory lock first so concurrent likes for the same pair
        #    are serialized. This prevents the lost-match race where neither
        #    request sees the other's uncommitted like.
        execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
            (lock_key,),
            conn=conn,
        )

        # b. Validate the target: exists, active, opposite gender, and no block
        #    in either direction. Any failure returns the identical 404 so no
        #    information leaks about which check failed.
        target = fetch_one(
            """
            SELECT u.id
            FROM users u
            WHERE u.id = %s::uuid
              AND u.status = 'active'
              AND u.gender = %s
              AND NOT EXISTS (
                  SELECT 1 FROM blocks b
                  WHERE (b.blocker_id = %s::uuid AND b.blocked_id = u.id)
                     OR (b.blocked_id = %s::uuid AND b.blocker_id = u.id)
              )
            """,
            (to_user_id, opposite, me, me),
            conn=conn,
        )
        if target is None:
            return jsonify({"error": "not_found"}), 404

        # c. Insert the like (idempotent: liking twice is a no-op).
        execute(
            """
            INSERT INTO likes (from_user_id, to_user_id)
            VALUES (%s::uuid, %s::uuid)
            ON CONFLICT (from_user_id, to_user_id) DO NOTHING
            """,
            (me, to_user_id),
            conn=conn,
        )

        # d. Look for the reverse like (target already liked me).
        reverse = fetch_one(
            """
            SELECT id FROM likes
            WHERE from_user_id = %s::uuid AND to_user_id = %s::uuid
            """,
            (to_user_id, me),
            conn=conn,
        )

        if reverse is not None:
            # e. Insert a match inside a savepoint. If a concurrent request
            #    already created the match, UniqueViolation is raised; we then
            #    fetch the existing active match id and treat it as success.
            lesser, greater = sorted([me, to_user_id])
            try:
                with conn.transaction():
                    row = fetch_one(
                        """
                        INSERT INTO matches (user_a_id, user_b_id)
                        VALUES (%s::uuid, %s::uuid)
                        RETURNING id
                        """,
                        (lesser, greater),
                        conn=conn,
                    )
                    match_id = row["id"]
                    matched = True
            except UniqueViolation:
                row = fetch_one(
                    """
                    SELECT id FROM matches
                    WHERE least(user_a_id, user_b_id) = least(%s::uuid, %s::uuid)
                      AND greatest(user_a_id, user_b_id) = greatest(%s::uuid, %s::uuid)
                      AND unmatched_at IS NULL
                    """,
                    (me, to_user_id, me, to_user_id),
                    conn=conn,
                )
                match_id = row["id"] if row else None
                matched = True

    return jsonify(
        {"matched": matched, "match_id": str(match_id) if match_id else None}
    ), 200