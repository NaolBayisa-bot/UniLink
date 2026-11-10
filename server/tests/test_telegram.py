"""Tests for Telegram WebApp initData verification."""

import hashlib
import hmac
import json
import time
import urllib.parse

import pytest

from app.services.telegram import verify_init_data
from tests.helpers import make_init_data

BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
USER = {"id": 987654321, "username": "alpha_tester", "first_name": "Alpha"}


def test_valid_payload_returns_user():
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    result = verify_init_data(init_data, BOT_TOKEN)
    assert result == {
        "telegram_id": 987654321,
        "telegram_username": "alpha_tester",
    }


def test_tampered_field_returns_none():
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    # Change one field (auth_date) after signing.
    tampered = init_data.replace(
        f"auth_date={auth_date}", f"auth_date={auth_date + 1}", 1
    )
    assert verify_init_data(tampered, BOT_TOKEN) is None


def test_different_bot_token_returns_none():
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    assert verify_init_data(init_data, "different_token_123") is None


def test_missing_hash_returns_none():
    auth_date = int(time.time())
    params = {"auth_date": str(auth_date), "user": json.dumps(USER)}
    init_data = urllib.parse.urlencode(params)
    assert verify_init_data(init_data, BOT_TOKEN) is None


def test_auth_date_two_hours_old_returns_none():
    auth_date = int(time.time()) - 7200
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    assert verify_init_data(init_data, BOT_TOKEN) is None


def test_auth_date_ten_minutes_future_returns_none():
    auth_date = int(time.time()) + 600
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    assert verify_init_data(init_data, BOT_TOKEN) is None


def test_invalid_json_in_user_returns_none():
    auth_date = int(time.time())
    params = {"auth_date": str(auth_date), "user": "{not valid json"}
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(params.items())
    )
    secret = hmac.new(
        b"WebAppData", BOT_TOKEN.encode("utf-8"), hashlib.sha256
    ).digest()
    signature = hmac.new(
        secret, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    params["hash"] = signature
    init_data = urllib.parse.urlencode(params)
    assert verify_init_data(init_data, BOT_TOKEN) is None


def test_empty_string_returns_none():
    assert verify_init_data("", BOT_TOKEN) is None
