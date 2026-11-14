"""Administrative report review and account moderation routes."""

from uuid import UUID

from flask import Blueprint, g, jsonify, request

from app.auth.decorators import require_admin, require_auth
from app.db.matches import unmatch_pair
from app.db.query import fetch_all, fetch_one, transaction

admin = Blueprint("admin", __name__)


@admin.get("/admin/reports")
@require_auth
@require_admin
def list_reports():
    """List reports for an admin, newest first (open by default)."""
    status = request.args.get("status", "open")
    rows = fetch_all(
        """
        SELECT id, reporter_id, reported_id, reason, status, created_at
        FROM reports
        WHERE status = %s
        ORDER BY created_at DESC, id DESC
        """,
        (status,),
    )
    return jsonify([
        {
            "id": str(row["id"]),
            "reporter_id": str(row["reporter_id"]),
            "reported_id": str(row["reported_id"]),
            "reason": row["reason"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]), 200


@admin.post("/admin/resolve-report")
@require_auth
@require_admin
def resolve_report():
    body = request.get_json(silent=True) or {}
    try:
        report_id = str(UUID(str(body.get("report_id"))))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    row = fetch_one(
        "UPDATE reports SET status = 'resolved' WHERE id = %s::uuid RETURNING id",
        (report_id,),
    )
    if row is None:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"status": "resolved"}), 200


@admin.post("/admin/ban-user")
@require_auth
@require_admin
def ban_user():
    body = request.get_json(silent=True) or {}
    try:
        user_id = str(UUID(str(body.get("user_id"))))
    except (AttributeError, TypeError, ValueError):
        return jsonify({"error": "invalid_input"}), 400

    if user_id == str(g.user_id):
        return jsonify({"error": "invalid_input"}), 400

    with transaction() as conn:
        user = fetch_one(
            "UPDATE users SET status = 'banned' WHERE id = %s::uuid RETURNING id",
            (user_id,), conn=conn,
        )
        if user is None:
            return jsonify({"error": "not_found"}), 404

        matches = fetch_all(
            """
            SELECT user_a_id, user_b_id
            FROM matches
            WHERE unmatched_at IS NULL
              AND (user_a_id = %s::uuid OR user_b_id = %s::uuid)
            """,
            (user_id, user_id), conn=conn,
        )
        for match in matches:
            unmatch_pair(conn, str(match["user_a_id"]), str(match["user_b_id"]))

    return jsonify({"status": "banned"}), 200

