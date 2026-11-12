"""Match routes.

GET /matches - list the authenticated caller's active matches.

The client polls this endpoint (about every 30 seconds) to learn about new
matches. Everything is computed in a single SQL query so there is no N+1
problem, even when the caller has many matches.
"""

from uuid import UUID

from flask import Blueprint, jsonify, g, request

from app.auth.authorization import MatchNotFoundError, get_active_match_for_user
from app.auth.decorators import require_auth
from app.db.query import execute, fetch_all, fetch_one, transaction
from app.db.users import get_revealed_profile
from app.db.matches import unmatch_pair

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


@match.get("/match/<match_id>/profile")
@require_auth
def match_profile(match_id):
    """Return the revealed profile of the other participant in a match.

    The caller must be a participant in an active match. Returns 404
    {'error': 'not_found'} for a nonexistent match, an unmatched match, or a
    match the caller is not part of -- all indistinguishable.

    Response always includes nickname, gender, real_name, department and
    i_shared_contact. The other user's telegram_username is included only
    when BOTH participants have consented AND the other user has one set.
    telegram_id is never exposed.
    """
    # Validate match_id is a UUID.
    try:
        UUID(str(match_id))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    me = str(g.user_id)

    # Verify the caller participates in an active match.
    try:
        match = get_active_match_for_user(match_id, me)
    except MatchNotFoundError:
        return jsonify({"error": "not_found"}), 404

    # Reveal the other participant's profile fields (never their telegram_id).
    profile = get_revealed_profile(match, me)
    if profile is None:
        return jsonify({"error": "not_found"}), 404

    # Determine the other participant's id and telegram_username.
    other_id = (
        match["user_b_id"]
        if str(match["user_a_id"]) == str(me)
        else match["user_a_id"]
    )
    other_row = fetch_one(
        "SELECT telegram_username FROM users WHERE id = %s::uuid",
        (other_id,),
    )
    other_telegram_username = (
        other_row["telegram_username"] if other_row else None
    )

    # Has the caller consented?
    i_shared = fetch_one(
        """
        SELECT 1 FROM reveal_consents
        WHERE match_id = %s::uuid AND user_id = %s::uuid
        """,
        (match_id, me),
    ) is not None
    profile["i_shared_contact"] = bool(i_shared)

    # Contact rule: telegram_username is included only when BOTH have
    # consented and the other user actually has a Telegram username.
    they_shared = fetch_one(
        """
        SELECT 1 FROM reveal_consents
        WHERE match_id = %s::uuid AND user_id = %s::uuid
        """,
        (match_id, other_id),
    ) is not None
    both_consented = i_shared and they_shared

    if both_consented and other_telegram_username:
        profile["telegram_username"] = other_telegram_username
    elif both_consented and not other_telegram_username:
        profile["contact_unavailable"] = True
    else:
        profile["has_shared_contact"] = False

    return jsonify(profile), 200


@match.post("/match/<match_id>/share-contact")
@require_auth
def share_contact(match_id):
    """Record that the caller consents to share contact info in a match.

    The user_id is always g.user_id -- any user_id in the request body is
    ignored. Responds with the caller's consent flag and the other
    participant's consent flag. Does not return the username; the client
    fetches it from GET /match/<id>/profile once both parties consent.
    """
    # Validate match_id is a UUID.
    try:
        UUID(str(match_id))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    me = str(g.user_id)

    # Verify the caller participates in an active match.
    try:
        match = get_active_match_for_user(match_id, me)
    except MatchNotFoundError:
        return jsonify({"error": "not_found"}), 404

    # Insert the consent (idempotent: ON CONFLICT DO NOTHING).
    # user_id is ALWAYS g.user_id -- never from the request body.
    execute(
        """
        INSERT INTO reveal_consents (match_id, user_id)
        VALUES (%s::uuid, %s::uuid)
        ON CONFLICT (match_id, user_id) DO NOTHING
        """,
        (match_id, me),
    )

    # Determine whether the other participant has consented.
    other_id = (
        match["user_b_id"]
        if str(match["user_a_id"]) == str(me)
        else match["user_a_id"]
    )
    they_shared = (
        fetch_one(
            """
            SELECT 1 FROM reveal_consents
            WHERE match_id = %s::uuid AND user_id = %s::uuid
            """,
            (match_id, other_id),
        )
        is not None
    )

    return jsonify(
        {"i_shared_contact": True, "they_shared_contact": bool(they_shared)}
    ), 200


@match.post("/unmatch")
@require_auth
def unmatch():
    """End an active match between the caller and the other participant.

    Body: {"match_id": "<uuid>"}.

    Loads the match with get_active_match_for_user (404 if not a participant
    or not active), then calls unmatch_pair inside a transaction to end the
    match, delete likes in both directions, and delete reveal_consents.
    Responds 204 on success.
    """
    body = request.get_json(silent=True) or {}
    match_id_raw = body.get("match_id")

    # Validate match_id is a UUID.
    try:
        match_id = str(UUID(str(match_id_raw)))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    me = str(g.user_id)

    # Verify the caller participates in an active match.
    try:
        match = get_active_match_for_user(match_id, me)
    except MatchNotFoundError:
        return jsonify({"error": "not_found"}), 404

    user_a = str(match["user_a_id"])
    user_b = str(match["user_b_id"])

    with transaction() as conn:
        unmatch_pair(conn, user_a, user_b)

    # 204 No Content - nothing to return.
    return "", 204