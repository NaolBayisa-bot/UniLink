"""Authorization helpers for match-scoped resources.

Centralises the rule that a user may only act on a match they actually
participate in, and only while that match is active.
"""


class MatchNotFoundError(Exception):
    """Raised when a match does not exist, is unmatched, or the caller is not a participant.

    All three failure modes raise the same error so the route can return a
    single, indistinguishable 404 -- nothing leaks about *why* the match is
    unavailable.
    """

    pass


def get_active_match_for_user(match_id, user_id):
    """Return the match row if the caller is a participant and it is active.

    Args:
        match_id: The match id (any type; coerced to str/uuid in SQL).
        user_id: The authenticated caller's id (a string UUID).

    Returns:
        The match row as a dict.

    Raises:
        MatchNotFoundError: If the match does not exist, is unmatched
            (unmatched_at is not null), or user_id is neither user_a_id nor
            user_b_id. The same exception is raised for all three so no
            information leaks.
    """
    from app.db.query import fetch_one

    row = fetch_one(
        """
        SELECT id, user_a_id, user_b_id, matched_at, unmatched_at
        FROM matches
        WHERE id = %s::uuid
          AND unmatched_at IS NULL
          AND (user_a_id = %s::uuid OR user_b_id = %s::uuid)
        """,
        (match_id, user_id, user_id),
    )
    if row is None:
        raise MatchNotFoundError()
    return row