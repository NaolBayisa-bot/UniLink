"""Test helpers for building signed Telegram initData payloads."""

import hashlib
import hmac
import json
import urllib.parse


def make_init_data(bot_token, user_dict, auth_date, user_raw=None):
    """Build a correctly signed Telegram WebApp initData query string.

    Uses the same signing algorithm as verify_init_data so tests can produce
    valid payloads (and controlled variants of them).
    """
    if user_raw is None:
        user_raw = json.dumps(user_dict, separators=(",", ":"))

    params = {
        "auth_date": str(auth_date),
        "user": user_raw,
    }
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(params.items())
    )
    secret = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    signature = hmac.new(
        secret, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    params["hash"] = signature
    return urllib.parse.urlencode(params)
