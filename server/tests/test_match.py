"""Tests for the /matches endpoint.

Covers: returns only my active matches, unmatched matches are absent,
a third user sees nothing, the other user's real_name/telegram fields never
appear, banned counterparts are excluded, and consent flags default to false.
"""

from app.db.query import fetch_all


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _matches(client, token):
    return client.get("/matches", headers=_headers(token))


def _ids(response):
    return [m["match_id"] for m in response.get_json()]


def test_returns_only_my_active_matches(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=50001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=50002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    # A match between two strangers should not appear for me.
    stranger_a, _ = make_user(gender="male", nickname="StrangerA",
                              telegram_id=50003, real_name="R", department="D")
    stranger_b, _ = make_user(gender="female", nickname="StrangerB",
                              telegram_id=50004, real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (stranger_a["id"], stranger_b["id"]),
    )

    response = _matches(client, token)
    assert response.status_code == 200
    data = response.get_json()
    assert str(target["id"]) in [m["other_user"]["id"] for m in data]
    assert str(stranger_a["id"]) not in _ids(response)
    assert str(stranger_b["id"]) not in _ids(response)


def test_unmatched_match_is_absent(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=51001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=51002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), now())",
        (me["id"], target["id"]),
    )

    response = _matches(client, token)
    assert response.status_code == 200
    assert response.get_json() == []


def test_third_user_sees_nothing(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=52001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=52002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    third, third_token = make_user(gender="female", nickname="Third",
                                   telegram_id=52003, real_name="R", department="D")

    response = _matches(client, third_token)
    assert response.status_code == 200
    assert response.get_json() == []


def test_other_user_real_name_and_telegram_never_appear(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=53001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=53002,
                          real_name="Real Name", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )

    response = _matches(client, token)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    other = data[0]["other_user"]
    assert set(other.keys()) == {"id", "nickname"}
    assert other["nickname"] == "Target"
    payload = response.get_data(as_text=True)
    assert "Real Name" not in payload
    assert str(target["telegram_username"]) not in payload


def test_banned_counterpart_is_excluded(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=54001,
                          real_name="R", department="D")
    banned, _ = make_user(gender="female", nickname="Banned", telegram_id=54002,
                          real_name="R", department="D", status="banned")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], banned["id"]),
    )

    response = _matches(client, token)
    assert response.status_code == 200
    assert response.get_json() == []


def test_consent_flags_false_by_default(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=55001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=55002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response = _matches(client, token)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    assert data[0]["i_shared_contact"] is False
    assert data[0]["they_shared_contact"] is False


def test_consent_flags_true_when_consented(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=56001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=56002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_row = fetch_all("SELECT id FROM matches LIMIT 1")[0]
    # Both parties consent.
    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s), (%s, %s)",
        (match_row["id"], me["id"], match_row["id"], target["id"]),
    )

    response = _matches(client, token)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    assert data[0]["i_shared_contact"] is True
    assert data[0]["they_shared_contact"] is True