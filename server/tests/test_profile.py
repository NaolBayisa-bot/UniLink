"""Tests for profile routes."""

import time

import pytest

from app.config import Config
from app.db.users import get_own_profile, update_own_profile, get_public_profile
from app.services.jwt_service import sign_token


def _login(client, telegram_id, token_override=None):
    """Log in via the auth route and return the JWT token."""
    import urllib.parse
    import json

    auth_date = int(time.time())
    user_dict = {"id": telegram_id, "username": f"user_{telegram_id}"}
    init_data = __import__("tests.helpers", fromlist=["make_init_data"]).make_init_data(
        Config.TELEGRAM_BOT_TOKEN, user_dict, auth_date
    )
    response = client.post(
        "/auth/telegram",
        json={"init_data": init_data},
        content_type="application/json",
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()["token"]


def test_valid_update(client):
    token = _login(client, 7001001)
    response = client.post(
        "/profile",
        json={"nickname": "Ace", "real_name": "Ace User", "department": "CS", "gender": "male"},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    data = response.get_json()
    assert data["nickname"] == "Ace"
    assert data["real_name"] == "Ace User"
    assert data["department"] == "CS"
    assert data["gender"] == "male"
    assert data["profile_complete"] is True


def test_user_id_in_body_is_ignored(client):
    token = _login(client, 7001002)
    response = client.post(
        "/profile",
        json={"nickname": "Ace", "user_id": "00000000-0000-0000-0000-000000000000"},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["nickname"] == "Ace"


def test_gender_set_once_then_ignored(client):
    token = _login(client, 7001003)
    # First set gender
    r1 = client.post(
        "/profile",
        json={"gender": "female"},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert r1.status_code == 200
    assert r1.get_json()["gender"] == "female"

    # Try to change it - should be silently ignored
    r2 = client.post(
        "/profile",
        json={"gender": "male"},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert r2.status_code == 200
    assert r2.get_json()["gender"] == "female"  # unchanged

    # Confirm via DB
    from app.db.query import fetch_one
    row = fetch_one("SELECT gender FROM users WHERE telegram_id = %s", (7001003,))
    assert row["gender"] == "female"


def test_invalid_nickname_returns_400(client):
    token = _login(client, 7001004)
    response = client.post(
        "/profile",
        json={"nickname": "X"},  # too short (min 2)
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "invalid_input"
    assert "problems" in data


def test_user_a_update_never_changes_user_b(client):
    token_a = _login(client, 7001005)
    token_b = _login(client, 7001006)

    # User A updates their profile
    response = client.post(
        "/profile",
        json={"nickname": "UserA"},
        headers={"Authorization": f"Bearer {token_a}"},
        content_type="application/json",
    )
    assert response.status_code == 200

    # User B's row should still have NULL nickname
    from app.db.query import fetch_one
    row_b = fetch_one("SELECT nickname FROM users WHERE telegram_id = %s", (7001006,))
    assert row_b["nickname"] is None


def test_empty_body_returns_400(client):
    token = _login(client, 7001007)
    response = client.post(
        "/profile",
        json={},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "invalid_input"
    assert "problems" in data


def test_get_me(client):
    token = _login(client, 7001008)
    # First update some fields
    client.post(
        "/profile",
        json={"nickname": "MeUser", "department": "Math"},
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )
    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["nickname"] == "MeUser"
    assert data["department"] == "Math"
    assert data["gender"] is None
    assert data["profile_complete"] is False
