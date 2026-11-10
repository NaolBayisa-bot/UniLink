"""Tests for the JWT service."""

import time

import jwt
import pytest

from app.services.jwt_service import sign_token, verify_token


def test_round_trip_sign_and_verify():
    token = sign_token(42)
    assert verify_token(token) == "42"


def test_expired_token_returns_none():
    token = jwt.encode(
        {"sub": "7", "iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600},
        "secret",
        algorithm="HS256",
    )
    assert verify_token(token) is None


def test_tampered_signature_returns_none():
    token = sign_token(9)
    # Flip a byte in the signature segment (last part after the second '.').
    parts = token.split(".")
    parts[-1] = "x" * len(parts[-1])
    tampered = ".".join(parts)
    assert verify_token(tampered) is None


def test_different_secret_returns_none():
    token = jwt.encode(
        {"sub": "11", "iat": int(time.time()), "exp": int(time.time()) + 3600},
        "a-different-secret",
        algorithm="HS256",
    )
    assert verify_token(token) is None


def test_none_algorithm_token_returns_none():
    token = jwt.encode(
        {"sub": "3", "iat": int(time.time()), "exp": int(time.time()) + 3600},
        None,
        algorithm="none",
    )
    assert verify_token(token) is None


def test_missing_sub_returns_none():
    token = jwt.encode(
        {"iat": int(time.time()), "exp": int(time.time()) + 3600},
        "secret",
        algorithm="HS256",
    )
    assert verify_token(token) is None
