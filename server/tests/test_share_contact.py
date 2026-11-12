"""Tests for POST /match/<match_id>/share-contact.

Covers: one side consents -> username hidden from BOTH users in the profile
route; both consent -> username appears for both; non-participant gets 404;
calling twice as the same user gives no error and one row; consenting to an
unmatched match gets 404.
"""

from app.db.query import fetch_all


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _share_contact(client, token, match_id):
    return client.post(
        f"/match/{match_id}/share-contact", headers=_headers(token)
    )


def _match_profile(client, token, match_id):
    return client.get(
        f"/match/{match_id}/profile", headers=_headers(token)
    )


def test_one_side_consent_username_hidden_from_both(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=70001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=70002, real_name="R",
                                     department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Only me consents.
    response = _share_contact(client, token, match_id)
    assert response.status_code == 200
    assert response.get_json() == {"i_shared_contact": True,
                                   "they_shared_contact": False}

    # Username hidden from me.
    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    assert "telegram_username" not in response.get_json()

    # Username hidden from target too (target hasn't consented either).
    response = _match_profile(client, target_token, match_id)
    assert response.status_code == 200
    assert "telegram_username" not in response.get_json()


def test_both_consent_username_appears_for_both(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=71001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=71002, real_name="R",
                                     department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Me consents first.
    response = _share_contact(client, token, match_id)
    assert response.status_code == 200
    assert response.get_json()["they_shared_contact"] is False

    # Target consents second.
    response = _share_contact(client, target_token, match_id)
    assert response.status_code == 200
    assert response.get_json()["they_shared_contact"] is True
    assert response.get_json()["i_shared_contact"] is True

    # Username now visible to me.
    response = _match_profile(client, token, match_id)
    assert response.status_code == 200
    assert response.get_json()["telegram_username"] == "target_tg"

    # Username now visible to target (me has telegram_username too).
    response = _match_profile(client, target_token, match_id)
    assert response.status_code == 200
    assert "telegram_username" in response.get_json()


def test_non_participant_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=72001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=72002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    stranger, stranger_token = make_user(gender="female", nickname="Stranger",
                                         telegram_id=72003, real_name="R",
                                         department="D")

    response = _share_contact(client, stranger_token, match_id)
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_calling_twice_no_error_one_row(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=73001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=73002,
                          real_name="R", department="D",
                          telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response1 = _share_contact(client, token, match_id)
    response2 = _share_contact(client, token, match_id)
    assert response1.status_code == 200
    assert response2.status_code == 200

    # Exactly one consent row.
    rows = fetch_all(
        "SELECT id FROM reveal_consents WHERE match_id = %s AND user_id = %s",
        (match_id, me["id"]),
    )
    assert len(rows) == 1


def test_consent_to_unmatched_match_gets_404(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=74001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=74002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), now())",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response = _share_contact(client, token, match_id)
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_invalid_match_id_gets_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=75001,
                          real_name="R", department="D")

    response = _share_contact(client, token, "not-a-uuid")
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}


def test_forged_user_id_in_body_is_ignored(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=76001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=76002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Send a forged user_id in the body - it must be ignored.
    response = client.post(
        f"/match/{match_id}/share-contact",
        json={"user_id": "00000000-0000-0000-0000-000000000000"},
        headers=_headers(token),
        content_type="application/json",
    )
    assert response.status_code == 200
    # Consent recorded for g.user_id (me), not the forged id.
    rows = fetch_all(
        "SELECT user_id FROM reveal_consents WHERE match_id = %s",
        (match_id,),
    )
    assert len(rows) == 1
    assert str(rows[0]["user_id"]) == str(me["id"])
