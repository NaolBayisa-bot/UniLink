"""Tests for POST /report.

Covers: a report stores the row with status 'open'; an active match is ended;
the reported user can no longer read the reporter's profile; empty or oversized
reason returns 400; a duplicate open report creates no second row; the reported
user disappears from the reporter's browse but still appears for others.
"""

from app.db.query import fetch_all, fetch_one


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _report(client, token, reported_id, reason="harassment"):
    return client.post(
        "/report",
        json={"reported_id": reported_id, "reason": reason},
        headers=_headers(token),
        content_type="application/json",
    )


def _browse(client, token):
    return client.get("/browse", headers=_headers(token))


def _match_profile(client, token, match_id):
    return client.get(
        f"/match/{match_id}/profile", headers=_headers(token)
    )


def test_report_stores_open_row(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=97001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=97002,
                          real_name="R", department="D")

    response = _report(client, token, str(target["id"]))
    assert response.status_code == 201, response.get_data(as_text=True)

    row = fetch_one(
        "SELECT status, reason FROM reports WHERE reporter_id = %s AND reported_id = %s",
        (me["id"], target["id"]),
    )
    assert row is not None
    assert row["status"] == "open"
    assert row["reason"] == "harassment"


def test_report_ends_active_match(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=98001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=98002,
                          real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    _report(client, token, str(target["id"]))

    matches = fetch_all(
        "SELECT id FROM matches WHERE id = %s AND unmatched_at IS NULL",
        (match_id,),
    )
    assert matches == []


def test_reported_user_cant_read_reporters_profile(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=99001,
                          real_name="R", department="D")
    target, target_token = make_user(gender="female", nickname="Target",
                                     telegram_id=99002, real_name="R",
                                     department="D",
                                     telegram_username="target_tg")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], target["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    # Target had consented, so profile is accessible before report.
    db_exec(
        "INSERT INTO reveal_consents (match_id, user_id) VALUES (%s, %s), (%s, %s)",
        (match_id, me["id"], match_id, target["id"]),
    )
    before = _match_profile(client, target_token, match_id)
    assert before.status_code == 200
    assert "telegram_username" in before.get_json()

    # Reporter reports the target.
    _report(client, token, str(target["id"]))

    # Target can no longer read reporter's profile.
    after = _match_profile(client, target_token, match_id)
    assert after.status_code == 404
    assert after.get_json() == {"error": "not_found"}


def test_empty_reason_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=100001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=100002,
                          real_name="R", department="D")

    response = _report(client, token, str(target["id"]), reason="   ")
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_input"


def test_oversized_reason_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=101001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=101002,
                          real_name="R", department="D")

    response = _report(client, token, str(target["id"]), reason="x" * 1001)
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_input"


def test_duplicate_open_report_no_second_row(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=102001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=102002,
                          real_name="R", department="D")

    _report(client, token, str(target["id"]))
    _report(client, token, str(target["id"]))

    rows = fetch_all(
        "SELECT id FROM reports WHERE reporter_id = %s AND reported_id = %s",
        (me["id"], target["id"]),
    )
    assert len(rows) == 1


def test_reported_disappears_from_reporter_browse_but_not_others(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=103001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=103002,
                          real_name="R", department="D")
    third, third_token = make_user(gender="male", nickname="Third",
                                   telegram_id=103003, real_name="R",
                                   department="D")

    _report(client, token, str(target["id"]))

    # Target disappears from reporter's browse.
    ids_me = [p["id"] for p in _browse(client, token).get_json()]
    assert str(target["id"]) not in ids_me

    # But target still appears for a third user (male sees female target).
    ids_third = [p["id"] for p in _browse(client, third_token).get_json()]
    assert str(target["id"]) in ids_third


def test_self_report_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=104001,
                          real_name="R", department="D")

    response = _report(client, token, str(me["id"]))
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input"}


def test_nonexistent_target_returns_404(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=105001,
                          real_name="R", department="D")

    response = _report(client, token, "00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_invalid_uuid_returns_400(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=106001,
                          real_name="R", department="D")

    response = _report(client, token, "not-a-uuid")
    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid_input",
                                   "problems": ["reported_id: Input should be a valid UUID, invalid character: found `n` at 0"]}
