"""Tests for the auth decorators."""

import jwt
import pytest


@pytest.fixture(scope="session")
def auth_client(app):
    """Test client using auth endpoints registered before the first request."""
    return app.test_client()


def test_no_header_returns_401(auth_client):
    response = auth_client.get("/_protected")
    assert response.status_code == 401
    assert response.get_json() == {"error": "unauthorized"}


def test_garbage_token_returns_401(auth_client):
    response = auth_client.get(
        "/_protected", headers={"Authorization": "Bearer not-a-token"}
    )
    assert response.status_code == 401


def test_expired_token_returns_401(auth_client, make_user):
    row, _ = make_user(telegram_id=111111)
    from app.config import Config
    token = jwt.encode(
        {"sub": str(row["id"]), "iat": 1, "exp": 1},
        Config.JWT_SECRET,
        algorithm="HS256",
    )
    response = auth_client.get(
        "/_protected", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_valid_token_returns_200(auth_client, make_user):
    _, token = make_user(telegram_id=222222)
    response = auth_client.get(
        "/_protected", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200


def test_banned_user_returns_403(auth_client, make_user):
    _, token = make_user(telegram_id=333333, status="banned")
    response = auth_client.get(
        "/_protected", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert response.get_json() == {"error": "account_disabled"}


def test_deleted_user_returns_401(auth_client, make_user, db_exec):
    row, token = make_user(telegram_id=444444)
    db_exec("DELETE FROM users WHERE id = %s", (row["id"],))
    response = auth_client.get(
        "/_protected", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_non_admin_on_admin_route_returns_403(auth_client, make_user):
    _, token = make_user(telegram_id=555555, is_admin=False)
    response = auth_client.get(
        "/_admin_only", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_admin_on_admin_route_returns_200(auth_client, make_user):
    _, token = make_user(telegram_id=666666, is_admin=True)
    response = auth_client.get(
        "/_admin_only", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
