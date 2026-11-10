"""Tests for the /auth/telegram login endpoint."""

import time

import pytest

from app.config import Config
from app.db.query import fetch_one
from tests.helpers import make_init_data

BOT_TOKEN = Config.TELEGRAM_BOT_TOKEN
USER = {"id": 9001001, "username": "new_user", "first_name": "New"}


@pytest.fixture
def login_client(app):
    """Test client for token validation on /_token_check."""
    return app.test_client()


def _post_init_data(client, init_data_raw, extra_fields=None):
    body = {"init_data": init_data_raw}
    if extra_fields:
        body.update(extra_fields)
    return client.post(
        "/auth/telegram",
        json=body,
        content_type="application/json",
    )


def test_first_call_creates_user(client, login_client):
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    response = _post_init_data(client, init_data)
    assert response.status_code == 200, response.get_data(as_text=True)
    data = response.get_json()
    assert "token" in data
    assert data["user"]["id"] is not None
    assert data["user"]["nickname"] is None
    assert data["user"]["gender"] is None
    assert data["user"]["profile_complete"] is False

    row = fetch_one(
        "SELECT id, telegram_id FROM users WHERE telegram_id = %s", (USER["id"],)
    )
    assert row is not None
    assert str(row["id"]) == data["user"]["id"]


def test_second_call_returns_same_user_id(client):
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    first = _post_init_data(client, init_data).get_json()
    second = _post_init_data(client, init_data).get_json()
    assert first["user"]["id"] == second["user"]["id"]


def test_tampered_payload_returns_401(client):
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    tampered = init_data.replace(
        f"auth_date={auth_date}", f"auth_date={auth_date + 1}", 1
    )
    response = _post_init_data(client, tampered)
    assert response.status_code == 401
    assert response.get_json() == {"error": "invalid_init_data"}


def test_auth_date_two_hours_old_returns_401(client):
    auth_date = int(time.time()) - 7200
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    response = _post_init_data(client, init_data)
    assert response.status_code == 401
    assert response.get_json() == {"error": "invalid_init_data"}


def test_extra_telegram_id_in_body_is_ignored(client):
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    response = _post_init_data(
        client, init_data, extra_fields={"telegram_id": 999999}
    )
    assert response.status_code == 200
    row = fetch_one(
        "SELECT telegram_id FROM users WHERE id = %s",
        (response.get_json()["user"]["id"],),
    )
    assert row["telegram_id"] == USER["id"]


def test_banned_user_returns_403(client, db_exec):
    db_exec(
        "INSERT INTO users (telegram_id, telegram_username, status) "
        "VALUES (%s, %s, 'banned')",
        (9002002, "banned_user"),
    )
    auth_date = int(time.time())
    banned_user = {"id": 9002002, "username": "banned_user"}
    init_data = make_init_data(BOT_TOKEN, banned_user, auth_date)
    response = _post_init_data(client, init_data)
    assert response.status_code == 403
    assert response.get_json() == {"error": "account_disabled"}


def test_returned_token_works_on_protected_route(client, login_client):
    auth_date = int(time.time())
    init_data = make_init_data(BOT_TOKEN, USER, auth_date)
    token = _post_init_data(client, init_data).get_json()["token"]
    response = login_client.get(
        "/_token_check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
