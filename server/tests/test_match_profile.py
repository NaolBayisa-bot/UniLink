"""Tests for GET /match/<match_id>/profile.

Covers: non-participant gets 404; unmatched match gets 404; a participant sees
real_name and department with zero consent rows; after consent from ONE side
the username is absent for BOTH users; after both consent it is present for
both; the response never contains telegram_id.
"""

from app.db.query import fetch_all


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _match_profile(client, token, match_id):
    return client.get(
        f"/match/{match_id}/profile", headers=_headers(token)
    )


def test_non_participant_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=60001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=60002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    stranger, stranger_token = make_user(gender="female", nickname="Stranger",
                                         telegram_id=60003, real_name="R", department="D")

    response = _match_profile(client, stranger_token, match_id)
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_unmatched_match_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=61001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=61002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), now())",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response = _match_profile(client, token, match_id)
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}

def test_participant_sees_revealed_profile_no_consent(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=64001,
                          real_name="Real Me", department="CS")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=64002,
                          real_name="Real Target", department="Math",
                          telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    data = response.get_json()
    assert data["nickname"] == "Target"
    assert data["gender"] == "female"
    assert data["real_name"] == "Real Target"
    assert data["department"] == "Math"
    assert "telegram_username" not in data
    assert data["has_shared_contact"] is False
    assert "telegram_id" not in data


def test_one_side_consent_username_absent_for_both(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=65001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=65002, real_name="R", department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Only the target consents.
    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s)",
        (match_id, target["id"]),
    )

    # Me (who has NOT consented) sees no username.
    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    assert "telegram_username" not in response.get_json()
    assert response.get_json()["has_shared_contact"] is False

    # Target (who HAS consented but me hasn't) also sees no username.
    response = _match_profile(client, target_token, match_id)
    assert response.status_code == 200
    assert "telegram_username" not in response.get_json()
    assert response.get_json()["has_shared_contact"] is False


def test_both_consent_username_present_for_both(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=66001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=66002, real_name="R", department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Both parties consent.
    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s), (%s, %s)",
        (match_id, me["id"], match_id, target["id"]),
    )

    # Me sees the username.
    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    assert response.get_json()["telegram_username"] == "target_tg"
    assert "has_shared_contact" not in response.get_json()
    assert "contact_unavailable" not in response.get_json()

    # Target also sees the username (me has one set too).
    response = _match_profile(client, target_token, match_id)
    assert response.status_code == 200
    assert "telegram_username" in response.get_json()


def test_both_consent_but_no_username_gives_contact_unavailable(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=67001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=67002, real_name="R", department="D",
                                     telegram_username=None)
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

    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    assert response.get_json()["contact_unavailable"] is True
    assert "telegram_username" not in response.get_json()


def test_nonexistent_match_gets_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=62001,
                          real_name="R", department="D")

    response = _match_profile(
        client, token, "00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_invalid_match_id_gets_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=63001,
                          real_name="R", department="D")

    response = _match_profile(client, token, "not-a-uuid")
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}