"""Match routes.

GET /matches - list the authenticated caller's active matches.

The client polls this endpoint (about every 30 seconds) to learn about new
matches. Everything is computed in a single SQL query so there is no N+1
problem, even when the caller has many matches.
"""

from flask import Blueprint, jsonify, g

from app.auth.decorators import require_auth
from app.db.query import fetch_all

match = Blueprint("match", __name__)

_MATCHES_SQL = """
    SELECT m.id AS match_id,
           m.matched_at,
           u.id AS other_id,
           u.nickname AS other_nickname,
           EXISTS (
               SELECT 1 FROM reveal_consents rc
               WHERE rc.match_id = m.id AND rc.user_id = %(me)s::uuid
           ) AS i_shared_contact,
           EXISTS (
               SELECT 1 FROM reveal_consents rc
               WHERE rc.match_id = m.id AND rc.user_id = u.id
           ) AS they_shared_contact
    FROM matches m
    JOIN users u
      ON u.id = CASE WHEN m.user_a_id = %(me)s::uuid THEN m.user_b_id ELSE m.user_a_id END
    WHERE m.unmatched_at IS NULL
      AND (m.user_a_id = %(me)s::uuid OR m.user_b_id = %(me)s::uuid)
      AND u.status = 'active'
    ORDER BY m.matched_at DESC
"""


@match.get("/matches")
@require_auth
def list_matches():
    """Return the caller's active matches, newest first.

    Each item: match_id, matched_at, other_user {id, nickname},
    i_shared_contact, they_shared_contact. The other user's real_name and
    telegram fields are never exposed. Matches whose other user is banned are
    excluded. All related data is computed in one query (no N+1).
    """
    rows = fetch_all(_MATCHES_SQL, {"me": g.user_id})

    return jsonify(
        [
            {
                "match_id": str(row["match_id"]),
                "matched_at": (
                    row["matched_at"].isoformat() if row["matched_at"] else None
                ),
                "other_user": {
                    "id": str(row["other_id"]),
                    "nickname": row["other_nickname"],
                },
                "i_shared_contact": bool(row["i_shared_contact"]),
                "they_shared_contact": bool(row["they_shared_contact"]),
            }
            for row in rows
        ]
    ), 200