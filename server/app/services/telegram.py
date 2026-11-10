"""Telegram WebApp initData verification.

Verifies that a launch-data payload really came from Telegram and is still
fresh. This is the login check: on success it returns the user's Telegram id
and username; on any failure it returns None and never raises.
"""

import hashlib
import hmac
import json
import time
import urllib.parse


def verify_init_data(init_data_raw, bot_token, max_age_seconds=3600):
    """Verify Telegram WebApp launch data.

    Implements the official Telegram WebApp initData verification algorithm.

    Args:
        init_data_raw: The raw query string from Telegram.WebApp.initData.
        bot_token: The bot's API token.
        max_age_seconds: Maximum age in seconds for the payload (default 3600).

    Returns:
        dict with keys ``telegram_id`` (int) and ``telegram_username`` (str or
        None) on success, or None on any failure. Never raises.
    """
    try:
        if not init_data_raw or not bot_token:
            return None

        # a. Parse the raw string into a dict (blank values kept).
        parsed = dict(
            urllib.parse.parse_qsl(init_data_raw, keep_blank_values=True)
        )

        # b. Pop 'hash' (None if missing). Do NOT remove any other field.
        provided_hash = parsed.pop("hash", None)
        if not provided_hash:
            return None

        # c. Data-check string: remaining key=value pairs, sorted by key,
        #    joined with newline.
        data_check_string = "\n".join(
            f"{key}={value}" for key, value in sorted(parsed.items())
        )

        # d. secret = HMAC-SHA256(key=b'WebAppData', message=bot_token).digest()
        secret = hmac.new(
            b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
        ).digest()

        # e. expected = HMAC-SHA256(key=secret, message=data_check_string).hexdigest()
        expected = hmac.new(
            secret, data_check_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        # f. Constant-time comparison, never ==.
        if not hmac.compare_digest(expected, provided_hash):
            return None

        # g. Freshness: auth_date is unix seconds.
        auth_date_str = parsed.get("auth_date")
        if auth_date_str is None:
            return None
        try:
            auth_date = int(auth_date_str)
        except (TypeError, ValueError):
            return None

        now = int(time.time())
        if now - auth_date > max_age_seconds:
            return None
        if auth_date - now > 60:
            return None

        # h. json.loads the 'user' field and return id and username.
        user_json = parsed.get("user")
        if user_json is None:
            return None
        try:
            user = json.loads(user_json)
        except (TypeError, ValueError):
            return None

        if not isinstance(user, dict):
            return None
        telegram_id = user.get("id")
        if telegram_id is None:
            return None

        return {
            "telegram_id": int(telegram_id),
            "telegram_username": user.get("username"),
        }
    except Exception:
        return None
