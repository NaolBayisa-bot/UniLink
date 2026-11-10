"""Pytest fixtures for the test database and Flask test client."""

import pathlib
import subprocess
import sys
import time

import pytest
from psycopg.rows import dict_row

from app import create_app
from app.config import Config
from app.db.pool import get_pool
from app.services.jwt_service import sign_token

MIGRATIONS_DIR = str(
    pathlib.Path(__file__).resolve().parent.parent / "migrations"
)


def _db_url_for_yoyo(url):
    """Convert postgres:// scheme to postgresql+psycopg:// for yoyo."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


def _apply_migrations(database_url):
    """Apply all yoyo migrations to the given database."""
    result = subprocess.run(
        [
            sys.executable, "-m", "yoyo", "apply", "--batch",
            "-d", _db_url_for_yoyo(database_url),
            MIGRATIONS_DIR,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Migration failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )


def _exec(sql, params=(), fetch=False):
    """Execute a statement with autocommit; optionally return first row as dict."""
    with get_pool().connection() as conn:
        conn.autocommit = True
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if fetch:
                return cur.fetchone()
            return None


@pytest.fixture(scope="session")
def app():
    """Create the Flask app and apply all migrations to the test database once."""
    test_config = {"DATABASE_URL": Config.TEST_DATABASE_URL}
    application = create_app(test_config=test_config)
    _apply_migrations(Config.TEST_DATABASE_URL)

    # Temporary protected route for token validation tests.
    from app.auth.decorators import require_auth

    @application.get("/_token_check")
    @require_auth
    def _token_check():
        from flask import g, jsonify
        return jsonify({"ok": True, "user_id": g.user_id}), 200

    yield application


@pytest.fixture(autouse=True)
def clean_db(app):
    """Truncate users cascade before every test so tests are isolated."""
    _exec("TRUNCATE users CASCADE")


@pytest.fixture
def client(app):
    """Return a Flask test client."""
    return app.test_client()


@pytest.fixture
def db_exec(app):
    """Execute SQL with autocommit (no return value)."""

    def exec_sql(sql, params=()):
        with get_pool().connection() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql, params)

    return exec_sql


@pytest.fixture
def make_user(app):
    """Factory that inserts a user and returns (user_row, jwt_token).

    Args:
        telegram_id: Distinct Telegram id (auto-assigned if None).
        gender: User gender (default 'male').
        nickname: User nickname (default 'x').
        status: Account status (default 'active').
        is_admin: Admin flag (default False).
        **fields: Additional column/value pairs to insert.

    Returns:
        (user_row, jwt_token) where user_row is a dict and jwt_token is a str.
    """

    counter = [0]

    def factory(telegram_id=None, gender="male", nickname="xx", status="active",
                is_admin=False, **fields):
        counter[0] += 1
        if telegram_id is None:
            telegram_id = 1000000 + counter[0]
        username = fields.pop("telegram_username", f"user_{telegram_id}")

        columns = ["telegram_id", "telegram_username", "nickname",
                   "gender", "status", "is_admin"]
        values = [telegram_id, username, nickname, gender, status, is_admin]
        for col, val in fields.items():
            columns.append(col)
            values.append(val)
        cols_sql = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(values))

        row = _exec(
            f"INSERT INTO users ({cols_sql}) VALUES ({placeholders}) "
            "RETURNING id, telegram_id, telegram_username, nickname, "
            "gender, status, is_admin, created_at",
            tuple(values),
            fetch=True,
        )
        token = sign_token(row["id"])
        return row, token

    return factory
