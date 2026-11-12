"""Tests for the /like endpoint.

Covers: one-sided like, reciprocal match creation, idempotent likes,
target validation (self / nonexistent / banned / same-gender / blocked),
forged from_user_id ignored, and re-matching after unmatch.
"""

from app.db.query import fetch_all, fetch_one


def _post_like(client, token, body):
    return client.post(
        "/like",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        content_type="application/json",
    )


def _active_matches(me, target):
    return fetch_all(
        """
        SELECT id FROM matches
        WHERE least(user_a_id, user_b_id) = least(%s, %s)
          AND greatest(user_a_id, user_b_id) = greatest(%s, %s)
          AND unmatched_at IS NULL
        """,
        (me, target, me, target),
    )


def _like_row(me, target):
    return fetch_one(
        "SELECT id FROM likes WHERE from_user_id = %s AND to_user_id = %s",
        (me, target),
    )


def test_one_sided_like_matched_false(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=30001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=30002,
                          real_name="R", department="D")

    response = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.get_json() == {"matched": False, "match_id": None}
    assert _active_matches(me["id"], target["id"]) == []
    assert _like_row(me["id"], target["id"]) is not None


def test_reciprocal_like_creates_exactly_one_match(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=31001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=31002, real_name="R", department="D")

    # Target already likes me.
    _post_like(client, target_token, {"to_user_id": str(me["id"])})

    response = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert response.status_code == 200
    data = response.get_json()
    assert data["matched"] is True
    assert data["match_id"] is not None

    matches = _active_matches(me["id"], target["id"])
    assert len(matches) == 1
    assert str(matches[0]["id"]) == data["match_id"]


def test_same_like_twice_is_idempotent(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=32001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=32002,
                          real_name="R", department="D")

    r1 = _post_like(client, token, {"to_user_id": str(target["id"])})
    r2 = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert r1.status_code == 200
    assert r2.status_code == 200

    # Exactly one likes row, no duplicate match.
    rows = fetch_all(
        "SELECT id FROM likes WHERE from_user_id = %s AND to_user_id = %s",
        (me["id"], target["id"]),
    )
    assert len(rows) == 1
    assert _active_matches(me["id"], target["id"]) == []


def test_self_like_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=33001,
                          real_name="R", department="D")

    response = _post_like(client, token, {"to_user_id": str(me["id"])})
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}


def test_invalid_uuid_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=34001,
                          real_name="R", department="D")

    response = _post_like(client, token, {"to_user_id": "not-a-uuid"})
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}


def test_nonexistent_target_returns_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=35001,
                          real_name="R", department="D")

    response = _post_like(
        client, token, {"to_user_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_banned_target_returns_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=36001,
                          real_name="R", department="D")
    banned, _ = make_user(gender="female", nickname="Banned", telegram_id=36002,
                          real_name="R", department="D", status="banned")

    response = _post_like(client, token, {"to_user_id": str(banned["id"])})
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_same_gender_target_returns_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=37001,
                          real_name="R", department="D")
    same, _ = make_user(gender="male", nickname="Same", telegram_id=37002,
                        real_name="R", department="D")

    response = _post_like(client, token, {"to_user_id": str(same["id"])})
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_blocked_target_returns_404_both_directions(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=38001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=38002,
                          real_name="R", department="D")

    # me blocks target
    db_exec(
        "INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s)",
        (me["id"], target["id"]),
    )
    response = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}

    # target blocks me (fresh pair)
    me2, token2 = make_user(gender="male", nickname="Me2", telegram_id=38003,
                            real_name="R", department="D")
    target2, _ = make_user(gender="female", nickname="Target2", telegram_id=38004,
                           real_name="R", department="D")
    db_exec(
        "INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s)",
        (target2["id"], me2["id"]),
    )
    response = _post_like(client, token2, {"to_user_id": str(target2["id"])})
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_forged_from_user_id_is_ignored(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=39001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=39002,
                          real_name="R", department="D")
    impostor = "00000000-0000-0000-0000-000000000001"

    response = _post_like(
        client, token,
        {"to_user_id": str(target["id"]), "from_user_id": impostor},
    )
    assert response.status_code == 200
    # The like is recorded from g.user_id, never from the forged from_user_id.
    assert _like_row(me["id"], target["id"]) is not None
    assert _like_row(impostor, target["id"]) is None


def test_rematch_after_unmatch(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=40001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=40002, real_name="R", department="D")

    # Create a match.
    _post_like(client, target_token, {"to_user_id": str(me["id"])})
    r1 = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert r1.status_code == 200
    assert r1.get_json()["matched"] is True
    first_match_id = r1.get_json()["match_id"]

    # Unmatch manually.
    db_exec(
        "UPDATE matches SET unmatched_at = now() WHERE id = %s",
        (first_match_id,),
    )

    # Like again -> a new match is created.
    r2 = _post_like(client, token, {"to_user_id": str(target["id"])})
    assert r2.status_code == 200
    assert r2.get_json()["matched"] is True
    second_match_id = r2.get_json()["match_id"]
    assert second_match_id != first_match_id

    matches = _active_matches(me["id"], target["id"])
    assert len(matches) == 1
    assert str(matches[0]["id"]) == second_match_id