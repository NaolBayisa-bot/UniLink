"""Health check routes.

Defines the ``health`` Blueprint with a single GET /health endpoint that also
reports the current database time.
"""

from flask import Blueprint, jsonify

from app.db.query import fetch_one

health = Blueprint("health", __name__)


@health.get("/health")
def health_check():
    """Return status and the database current timestamp.

    If the database is unreachable, returns HTTP 503 with {"status": "db_down"}
    instead of a stack trace.
    """
    try:
        row = fetch_one("SELECT now() AS db_time")
        return jsonify({"status": "ok", "db_time": row["db_time"].isoformat()})
    except Exception:
        return jsonify({"status": "db_down"}), 503