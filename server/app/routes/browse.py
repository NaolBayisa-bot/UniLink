"""Browse routes.

GET /browse - return up to 20 people the authenticated caller can like.

The caller's gender is taken from g.user (loaded from the database by
require_auth), NEVER from the request. A report hides a user from the
reporter only; blocks apply in both directions.
"""

from flask import Blueprint, jsonify, g

from app.auth.decorators import require_auth
from app.db.query import fetch_all

browse = Blueprint("browse", __name__)

# Opposite-gender lookup. Keys/values are the only valid gender strings.
OPPOSITE_GENDER = {"male": "female", "female": "male"}

_BROWSE_SQL = """
    SELECT u.id, u.nickname, u.created_at
    FROM users u
    WHERE u.status = 'active'
      AND u.id <> %(me)s::uuid
      AND u.gender = %(opposite)s
      AND u.nickname IS NOT NULL
      AND u.real_name IS NOT NULL
      AND u.department IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM likes l
          WHERE l.from_user_id = %(me)s::uuid AND l.to_user_id = u.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = %(me)s::uuid AND b.blocked_id = u.id)
             OR (b.blocked_id = %(me)s::uuid AND b.blocker_id = u.id)
      )
      AND NOT EXISTS (
          SELECT 1 FROM reports r
          WHERE r.reporter_id = %(me)s::uuid AND r.reported_id = u.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE least(m.user_a_id, m.user_b_id) = least(%(me)s::uuid, u.id)
            AND greatest(m.user_a_id, m.user_b_id) = greatest(%(me)s::uuid, u.id)
            AND m.unmatched_at IS NULL
      )
    ORDER BY u.created_at DESC
    LIMIT 20
"""


@browse.get("/browse")
@require_auth
def browse_profiles():
    """Return up to 20 profiles the caller can like.

    Only id, nickname and created_at are ever returned. Real name,
    department, telegram_username, telegram_id and gender are never
    exposed here.
    """
    caller_gender = g.user.get("gender")
    if caller_gender is None:
        return jsonify({"error": "complete_profile_first"}), 400

    opposite = OPPOSITE_GENDER.get(caller_gender)
    if opposite is None:
        # Defensive: g.user['gender'] should always be male/female when set.
        return jsonify({"error": "complete_profile_first"}), 400

    rows = fetch_all(
        _BROWSE_SQL,
        {"me": g.user_id, "opposite": opposite},
    )

    return jsonify(
        [
            {
                "id": str(row["id"]),
                "nickname": row["nickname"],
                "created_at": (
                    row["created_at"].isoformat() if row["created_at"] else None
                ),
            }
            for row in rows
        ]
    ), 200