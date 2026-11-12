"""User profile data access.

This is the ONLY module allowed to read user rows for other people. No route
may run 'SELECT *' on users or read another user's row except through the
functions defined here.
"""

from app.db.query import fetch_one, execute


def get_own_profile(user_id):
    """Return the authenticated user's own profile fields.

    Returns a dict with keys: nickname, gender, real_name, department,
    profile_complete. profile_complete is True only when all four fields are
    non-null.
    """
    row = fetch_one(
        """
        SELECT nickname, gender, real_name, department
        FROM users
        WHERE id = %s
        """,
        (user_id,),
    )
    if row is None:
        return None
    profile_complete = all(
        row[col] is not None for col in ("nickname", "gender", "real_name", "department")
    )
    return {
        "nickname": row["nickname"],
        "gender": row["gender"],
        "real_name": row["real_name"],
        "department": row["department"],
        "profile_complete": profile_complete,
    }


def update_own_profile(user_id, nickname=None, real_name=None, department=None, gender=None):
    """Update only the columns explicitly passed on the authenticated user's row.

    Gender is special: it uses COALESCE so it can be set once (when NULL) and
    never changed afterward. Returns the updated row dict, or None if the user
    does not exist.
    """
    updates = []
    params = []

    if nickname is not None:
        updates.append("nickname = %s")
        params.append(nickname)
    if real_name is not None:
        updates.append("real_name = %s")
        params.append(real_name)
    if department is not None:
        updates.append("department = %s")
        params.append(department)
    if gender is not None:
        updates.append("gender = COALESCE(gender, %s)")
        params.append(gender)

    if not updates:
        return None

    params.append(user_id)
    sql = f"""
        UPDATE users
        SET {', '.join(updates)}
        WHERE id = %s
        RETURNING id, nickname, gender, real_name, department, status
    """
    return fetch_one(sql, tuple(params))


def get_public_profile(user_id):
    """Return only the public fields of a user: id, nickname, created_at."""
    row = fetch_one(
        """
        SELECT id, nickname, created_at
        FROM users
        WHERE id = %s
        """,
        (user_id,),
    )
    if row is None:
        return None
    return {
        "id": str(row["id"]),
        "nickname": row["nickname"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def get_revealed_profile(match, me):
    """Return the OTHER participant's revealable profile fields.

    Selects nickname, gender, real_name and department of the participant who
    is not ``me``. Refuses (returns None) if that other user is banned or does
    not exist, so the route can return a uniform 404.

    This is part of app/db/users.py -- the ONLY module allowed to read user
    rows for other people -- and is only reachable from a match-scoped route
    that has already verified the caller participates in ``match``.

    Args:
        match: A match row dict (from get_active_match_for_user).
        me: The authenticated caller's id (a string UUID).

    Returns:
        A dict with keys nickname, gender, real_name, department, or None if
        the other participant is banned or missing.
    """
    from app.db.query import fetch_one

    other_id = (
        match["user_b_id"]
        if str(match["user_a_id"]) == str(me)
        else match["user_a_id"]
    )

    row = fetch_one(
        """
        SELECT nickname, gender, real_name, department
        FROM users
        WHERE id = %s::uuid
          AND status = 'active'
        """,
        (other_id,),
    )
    if row is None:
        return None
    return {
        "nickname": row["nickname"],
        "gender": row["gender"],
        "real_name": row["real_name"],
        "department": row["department"],
    }
