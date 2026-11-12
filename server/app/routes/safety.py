"""Safety routes.

POST /block - block another user, hiding each other from /browse and ending
any active match between them.
"""

from uuid import UUID

from flask import Blueprint, jsonify, g, request

from app.auth.decorators import require_auth
from app.db.matches import unmatch_pair
from app.db.query import execute, fetch_one, transaction

safety = Blueprint("safety", __name__)


@safety.post("/block")
@require_auth
def block_user():
    """Block another user.

    Body: {"blocked_id": "<uuid>"}.

    Blocks are mutual: a single rows in blocks() plus the browse query's
    both-directions check means neither user sees the other in /browse.
    Any active match is ended and contact consents are removed.
    Responds 204 on success.
    """
    body = request.get_json(silent=True) or {}
    blocked_id_raw = body.get("blocked_id")

    # Validate blocked_id is a UUID.
    try:
        blocked_id = str(UUID(str(blocked_id_raw)))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    me = str(g.user_id)

    # Reject self-blocking.
    if blocked_id == me:
        return jsonify({"error": "invalid_input"}), 400

    # Target must exist.
    target = fetch_one(
        "SELECT id FROM users WHERE id = %s::uuid",
        (blocked_id,),
    )
    if target is None:
        return jsonify({"error": "not_found"}), 404

    with transaction() as conn:
        # Insert the block (idempotent).
        execute(
            """
            INSERT INTO blocks (blocker_id, blocked_id)
            VALUES (%s::uuid, %s::uuid)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
            """,
            (me, blocked_id),
            conn=conn,
        )
        # End any active match and clean up likes/consents.
        unmatch_pair(conn, me, blocked_id)

    return "", 204