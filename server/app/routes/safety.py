"""Safety routes.

POST /block - block another user, hiding each other from /browse and ending
any active match between them.

POST /report - report another user, ending any active match and storing
evidence for an admin.
"""

from typing import Annotated
from uuid import UUID

from flask import Blueprint, jsonify, g, request
from pydantic import BaseModel, StringConstraints, ValidationError

from app.auth.decorators import require_auth
from app.db.matches import unmatch_pair
from app.db.query import execute, fetch_one, transaction

safety = Blueprint("safety", __name__)


class ReportBody(BaseModel):
    reported_id: UUID
    reason: Annotated[str, StringConstraints(min_length=1, max_length=1000, strip_whitespace=True)]


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


@safety.post("/report")
@require_auth
def report_user():
    """Report another user.

    Body: {"reported_id": "<uuid>", "reason": "<string 1-1000 chars>"}.

    Stores an open report row (idempotent: no duplicate open reports) and ends
    any active match between the reporter and the reported user.
    Responds 201 on success.
    """
    body = request.get_json(silent=True) or {}

    try:
        data = ReportBody(**body)
    except ValidationError as exc:
        problems = []
        for err in exc.errors():
            field = ".".join(str(x) for x in err["loc"])
            problems.append(f"{field}: {err['msg']}")
        return jsonify({"error": "invalid_input", "problems": problems}), 400

    reported_id = str(data.reported_id)
    reason = data.reason

    me = str(g.user_id)

    # Reject self-reports.
    if reported_id == me:
        return jsonify({"error": "invalid_input"}), 400

    # Target must exist.
    target = fetch_one(
        "SELECT id FROM users WHERE id = %s::uuid",
        (reported_id,),
    )
    if target is None:
        return jsonify({"error": "not_found"}), 404

    with transaction() as conn:
        # Idempotent: only insert if there is no existing open report.
        existing = fetch_one(
            """
            SELECT id FROM reports
            WHERE reporter_id = %s::uuid AND reported_id = %s::uuid
              AND status = 'open'
            """,
            (me, reported_id),
            conn=conn,
        )
        if existing is None:
            execute(
                """
                INSERT INTO reports (reporter_id, reported_id, reason, status)
                VALUES (%s::uuid, %s::uuid, %s, 'open')
                """,
                (me, reported_id, reason),
                conn=conn,
            )
        # End any active match and clean up likes/consents.
        unmatch_pair(conn, me, reported_id)

    return "", 201