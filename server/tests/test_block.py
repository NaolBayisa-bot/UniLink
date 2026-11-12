"""Tests for POST /block.

Covers: blocked user disappears from blocker's /browse AND blocker disappears
from the blocked user's /browse; an active match is ended; blocking twice is
fine; the blocked user liking the blocker gets the generic 404; self-block
returns 400; nonexistent target returns 404.
"""

from app.db.query import fetch_all


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _block(client, token, blocked_id):
    return client.post(
        "/block",
        json={"blocked_id": blocked_id},
        headers=_headers(token),
        content_type="application/json",
    )


def _browse(client, token):
    return client.get("/browse", headers=_headers(token))


def test_block_hides_both_directions(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=90001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=90002,
                          real_name="R", department="D")

    response = _block(client, token, str(target["id"]))
    assert response.status_code == 204

    # Target disappears from me.
    ids_me = [p["id"] for p in _browse(client, token).get_json()]
    assert str(target["id"]) not in ids_me

    # I disappear from target.
    ids_target = [p["id"] for p in _browse(client, token).get_json()]
    # Need target's token to browse as target. Make a fresh token via login path.
    from app.services.jwt_service import sign_token
    target_token = sign_token(target["id"])
    ids_target = [p["id"] for p in _browse(client, target_token).get_json()]
    assert str(me["id"]) not in ids_target


def test_block_ends_active_match(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=91001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=91002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    _block(client, token, str(target["id"]))

    matches = fetch_all(
        "SELECT id FROM matches WHERE id = %s AND unmatched_at IS NULL",
        (match_id,),
    )
    assert matches == []


def test_block_twice_is_fine(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=92001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=92002,
                          real_name="R", department="D")

    r1 = _block(client, token, str(target["id"]))
    r2 = _block(client, token, str(target["id"]))
    assert r1.status_code == 204
    assert r2.status_code == 204


def test_blocked_user_liking_blocker_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=93001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=93002, real_name="R",
                                     department="D")

    # Me blocks target.
    _block(client, token, str(target["id"]))

    # Target tries to like me -> generic 404.
    from app.db.query import fetch_one
    response = client.post(
        "/like",
        json={"to_user_id": str(me["id"])},
        headers=_headers(target_token),
        content_type="application/json",
    )
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_self_block_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=94001,
                          real_name="R", department="D")

    response = _block(client, token, str(me["id"]))
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}


def test_nonexistent_target_returns_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=95001,
                          real_name="R", department="D")

    response = _block(client, token, "00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_invalid_uuid_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=96001,
                          real_name="R", department="D")

    response = _block(client, token, "not-a-uuid")
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}