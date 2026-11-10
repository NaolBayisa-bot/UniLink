"""JWT service for issuing and verifying short-lived session tokens.

After a successful Telegram login check, the client carries a signed JWT.
Only the ``/auth/telegram`` route may call :func:`sign_token`.
"""

import time

import jwt

from app.config import Config


def sign_token(user_id):
    """Sign a short-lived JWT for the given user.

    Args:
        user_id: The database user id (any type; coerced to str for ``sub``).

    Returns:
        A signed HS256 JWT string with claims ``sub``, ``iat`` and ``exp``.
        ``exp`` is set to ``now + JWT_EXPIRES_MINUTES`` minutes.
    """
    now = int(time.time())
    expires_minutes = int(Config.JWT_EXPIRES_MINUTES)
    claims = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + expires_minutes * 60,
    }
    return jwt.encode(claims, Config.JWT_SECRET, algorithm="HS256")


def verify_token(token):
    """Verify a JWT and return its ``sub`` claim.

    Args:
        token: A JWT string.

    Returns:
        The ``sub`` string if the token is valid, signed with ``JWT_SECRET``
        using HS256, not expired, and contains both ``exp`` and ``sub``.
        ``None`` on any failure. Never raises.
    """
    try:
        payload = jwt.decode(
            token,
            Config.JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
        return str(payload["sub"])
    except jwt.PyJWTError:
        return None
    except Exception:
        return None
