"""Authentication routes.

Handles Telegram WebApp login: verifies initData, creates the user on first
visit, and returns a short-lived JWT. Only this route may call sign_token.
"""

from flask import Blueprint, jsonify, request

from app.config import Config
from app.db.query import fetch_one
from app.services.jwt_service import sign_token
from app.services.telegram import verify_init_data

auth = Blueprint("auth", __name__)


@auth.post("/auth/telegram")
def telegram_login():
    """Verify Telegram initData and return a session JWT.

    Expects JSON body: {"init_data": "<raw initData query string>"}.
    Identity values (telegram_id, telegram_username) come only from the
    verified Telegram payload — never from the request body.
    """
    body = request.get_json(silent=True) or {}
    init_data_raw = body.get("init_data")
    if not isinstance(init_data_raw, str):
        return jsonify({"error": "invalid_init_data"}), 401

    verified = verify_init_data(init_data_raw, Config.TELEGRAM_BOT_TOKEN)
    if verified is None:
        return jsonify({"error": "invalid_init_data"}), 401

    telegram_id = verified["telegram_id"]
    telegram_username = verified["telegram_username"]

    row = fetch_one(
        """
        INSERT INTO users (telegram_id, telegram_username)
        VALUES (%s, %s)
        ON CONFLICT (telegram_id)
        DO UPDATE SET telegram_username = excluded.telegram_username
        RETURNING id, nickname, gender, real_name, department, status
        """,
        (telegram_id, telegram_username),
    )

    if row is None:
        return jsonify({"error": "invalid_init_data"}), 401

    if row["status"] == "banned":
        return jsonify({"error": "account_disabled"}), 403

    profile_complete = all(
        row[col] is not None
        for col in ("nickname", "gender", "real_name", "department")
    )

    return (
        jsonify(
            {
                "token": sign_token(row["id"]),
                "user": {
                    "id": str(row["id"]),
                    "nickname": row["nickname"],
                    "gender": row["gender"],
                    "profile_complete": profile_complete,
                },
            }
        ),
        200,
    )
