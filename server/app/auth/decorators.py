"""Authentication decorators for protected routes."""

from functools import wraps
from uuid import UUID

from flask import g, jsonify, request

from app.db.query import fetch_one
from app.services.jwt_service import verify_token


def require_auth(view_func):
    """Require a valid JWT and an active (non-banned) user.

    Reads 'Authorization: Bearer <token>', verifies it, then loads
    id, status, gender and is_admin from the database on EVERY request.
    Sets g.user_id (a string) and g.user (the row) on success.

    Missing, invalid or expired token, or a user that no longer exists:
        HTTP 401 with {'error': 'unauthorized'}.
    User with status 'banned':
        HTTP 403 with {'error': 'account_disabled'}.
    """

    @wraps(view_func)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401
        token = auth_header[len("Bearer "):]

        sub = verify_token(token)
        if sub is None:
            return jsonify({"error": "unauthorized"}), 401

        try:
            user_uuid = UUID(sub)
        except (ValueError, TypeError):
            return jsonify({"error": "unauthorized"}), 401

        user = fetch_one(
            "SELECT id, status, gender, is_admin FROM users WHERE id = %s",
            (user_uuid,),
        )
        if user is None:
            return jsonify({"error": "unauthorized"}), 401
        if user["status"] == "banned":
            return jsonify({"error": "account_disabled"}), 403

        g.user_id = sub
        g.user = user
        return view_func(*args, **kwargs)

    return decorated


def require_admin(view_func):
    """Require an admin user. Must be stacked UNDER require_auth.

    Reads is_admin from the database value (g.user), never from the token.
    HTTP 403 unless g.user['is_admin'] is true.
    """

    @wraps(view_func)
    def decorated(*args, **kwargs):
        if not g.get("user") or not g.user.get("is_admin"):
            return jsonify({"error": "forbidden"}), 403
        return view_func(*args, **kwargs)

    return decorated
