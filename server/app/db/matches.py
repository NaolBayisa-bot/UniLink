"""Match lifecycle data access.

This module centralises the unmatch logic so it can be reused by unmatch,
block, report and admin ban without duplicating the transactional steps.
"""


def unmatch_pair(conn, user_a, user_b):
    """End an active match between two users inside the caller's transaction.

    Args:
        conn: An open psycopg connection (inside a transaction).
        user_a: One participant's id (a string UUID).
        user_b: The other participant's id (a string UUID).

    Returns:
        The number of matches ended (0 if there was no active match, 1
        otherwise).

    Steps (all within the caller's transaction):
        1. Find any ACTIVE match between the two users using least()/greatest().
        2. Set unmatched_at = now() on that match.
        3. Delete the likes rows in BOTH directions.
        4. Delete the reveal_consents rows for that match.
    """
    match = conn.execute(
        """
        SELECT id FROM matches
        WHERE unmatched_at IS NULL
          AND least(user_a_id, user_b_id) = least(%s::uuid, %s::uuid)
          AND greatest(user_a_id, user_b_id) = greatest(%s::uuid, %s::uuid)
        """,
        (user_a, user_b, user_a, user_b),
    ).fetchone()

    if match is None:
        return 0

    match_id = match["id"]

    conn.execute(
        """
        UPDATE matches
        SET unmatched_at = now()
        WHERE id = %s::uuid AND unmatched_at IS NULL
        """,
        (match_id,),
    )

    conn.execute(
        """
        DELETE FROM likes
        WHERE (from_user_id = %s::uuid AND to_user_id = %s::uuid)
           OR (from_user_id = %s::uuid AND to_user_id = %s::uuid)
        """,
        (user_a, user_b, user_b, user_a),
    )

    conn.execute(
        """
        DELETE FROM reveal_consents WHERE match_id = %s::uuid
        """,
        (match_id,),
    )

    return 1