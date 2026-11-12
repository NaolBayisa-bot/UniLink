"""Tests for POST /unmatch.

Covers: after unmatch the match is gone from GET /matches; both likes rows
are deleted; the other user's GET /match/<id>/profile returns 404; the pair
appears in /browse again; they can like each other and match again; a third
user calling it gets 404; consent rows are gone.
"""

from app.db.query import fetch_all, fetch_one


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _post(client, path, token, body):
    return client.post(
        path, json=body, headers=_headers(token), content_type="application/json"
    )


def test_unmatch_removes_match_from_list(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=80001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=80002,
                          real_name="R", department="D")

    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    db_exec("INSERT INTO likes (from_user_id, to_user_id) VALUES (%s, %s)",
            (me["id"], target["id"]))
    db_exec("INSERT INTO likes (from_user_id, to_user_id) VALUES (%s, %s)",
            (target["id"], me["id"]))

    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s), (%s, %s)",
        (match_id, me["id"], match_id, target["id"]),
    )

    response = _post(client, "/unmatch", token, {"match_id": str(match_id)})
    assert response.status_code == 204, response.get_data(as_text=True)

    response = client.get("/matches", headers=_headers(token))
    assert response.status_code == 200
    assert response.get_json() == []


def test_unmatch_deletes_likes_both_directions(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=81001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=81002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]
    db_exec("INSERT INTO likes (from_user_id, to_user_id) VALUES (%s, %s)",
            (me["id"], target["id"]))
    db_exec("INSERT INTO likes (from_user_id, to_user_id) VALUES (%s, %s)",
            (target["id"], me["id"]))

    _post(client, "/unmatch", token, {"match_id": str(match_id)})

    rows = fetch_all(
        "SELECT id FROM likes WHERE (from_user_id = %s AND to_user_id = %s) OR (from_user_id = %s AND to_user_id = %s)",
        (me["id"], target["id"], target["id"], me["id"]),
    )
    assert rows == []


def test_unmatch_deletes_consent_rows(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=82001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=82002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]
    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s), (%s, %s)",
        (match_id, me["id"], match_id, target["id"]),
    )

    _post(client, "/unmatch", token, {"match_id": str(match_id)})

    rows = fetch_all("SELECT id FROM reveal_consents WHERE match_id = %s",
                     (match_id,))
    assert rows == []


def test_other_user_profile_returns_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=83001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=83002, real_name="R",
                                     department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    _post(client, "/unmatch", token, {"match_id": str(match_id)})

    response = client.get(f"/match/{match_id}/profile",
                          headers=_headers(target_token))
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_pair_appears_in_browse_again(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=84001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=84002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    _post(client, "/unmatch", token, {"match_id": str(match_id)})

    response = client.get("/browse", headers=_headers(token))
    assert response.status_code == 200
    ids = [p["id"] for p in response.get_json()]
    assert str(target["id"]) in ids


def test_can_rematch_after_unmatch(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=85001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=85002, real_name="R",
                                     department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    _post(client, "/unmatch", token, {"match_id": str(match_id)})

    _post(client, "/like", target_token, {"to_user_id": str(me["id"])})
    response = _post(client, "/like", token, {"to_user_id": str(target["id"])})
    assert response.status_code == 200
    assert response.get_json()["matched"] is True

    matches = fetch_all(
        "SELECT id FROM matches WHERE least(user_a_id, user_b_id) = least(%s, %s) AND greatest(user_a_id, user_b_id) = greatest(%s, %s) AND unmatched_at IS NULL",
        (me["id"], target["id"], me["id"], target["id"]),
    )
    assert len(matches) == 1


def test_third_user_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=86001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=86002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    stranger, stranger_token = make_user(gender="female", nickname="Stranger",
                                         telegram_id=86003, real_name="R",
                                         department="D")

    response = _post(client, "/unmatch", stranger_token,
                     {"match_id": str(match_id)})
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_invalid_match_id_gets_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=87001,
                          real_name="R", department="D")

    response = _post(client, "/unmatch", token, {"match_id": "not-a-uuid"})
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}
