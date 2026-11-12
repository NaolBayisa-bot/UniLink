"""Tests for the /browse endpoint.

Covers: self-exclusion, gender filtering, banned users, incomplete profiles,
likes, blocks (both directions), reports (reporter-scoped), active matches,
forged gender query parameter (ignored), the 20-row limit, and the field
allow-list (no real_name, department, telegram_*, or gender).
"""

import pytest

from app.db.query import fetch_all


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _browse(client, token, extra_qs=""):
    return client.get(f"/browse{extra_qs}", headers=_headers(token))


def _ids(response):
    return [p["id"] for p in response.get_json()]


def test_excludes_self(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=1001,
                          real_name="R", department="D")
    other, _ = make_user(gender="female", nickname="Other", telegram_id=1002,
                         real_name="R", department="D")

    response = _browse(client, token)
    assert response.status_code == 200
    assert str(me["id"]) not in _ids(response)
    assert str(other["id"]) in _ids(response)


def test_excludes_same_gender(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=2001,
                          real_name="R", department="D")
    same, _ = make_user(gender="male", nickname="SameGuy", telegram_id=2002,
                        real_name="R", department="D")
    opposite, _ = make_user(gender="female", nickname="OppositeGal", telegram_id=2003,
                            real_name="R", department="D")

    response = _browse(client, token)
    ids = _ids(response)
    assert str(same["id"]) not in ids
    assert str(opposite["id"]) in ids


def test_caller_female_sees_males(client, make_user):
    me, token = make_user(gender="female", nickname="Me", telegram_id=3001,
                          real_name="R", department="D")
    male, _ = make_user(gender="male", nickname="Male", telegram_id=3002,
                        real_name="R", department="D")
    female, _ = make_user(gender="female", nickname="Female", telegram_id=3003,
                          real_name="R", department="D")

    ids = _ids(_browse(client, token))
    assert str(male["id"]) in ids
    assert str(female["id"]) not in ids


def test_excludes_banned_users(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=4001,
                          real_name="R", department="D")
    banned, _ = make_user(gender="female", nickname="Banned", telegram_id=4002,
                          real_name="R", department="D", status="banned")

    assert str(banned["id"]) not in _ids(_browse(client, token))


def test_excludes_incomplete_profiles(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=5001,
                          real_name="R", department="D")
    incomplete, _ = make_user(gender="female", nickname="Incomplete", telegram_id=5002,
                              real_name=None, department=None)

    assert str(incomplete["id"]) not in _ids(_browse(client, token))


def test_excludes_people_i_liked(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=6001,
                          real_name="R", department="D")
    liked, _ = make_user(gender="female", nickname="Liked", telegram_id=6002,
                         real_name="R", department="D")
    db_exec(
        "INSERT INTO likes (from_user_id, to_user_id) VALUES (%s, %s)",
        (me["id"], liked["id"]),
    )

    assert str(liked["id"]) not in _ids(_browse(client, token))


def test_excludes_blocked_users_both_directions(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=7001,
                          real_name="R", department="D")
    blocked_by_me, _ = make_user(gender="female", nickname="BlockedByMe",
                                 telegram_id=7002, real_name="R", department="D")
    db_exec(
        "INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s)",
        (me["id"], blocked_by_me["id"]),
    )
    blocks_me, _ = make_user(gender="female", nickname="BlocksMe", telegram_id=7003,
                             real_name="R", department="D")
    db_exec(
        "INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s)",
        (blocks_me["id"], me["id"]),
    )

    ids = _ids(_browse(client, token))
    assert str(blocked_by_me["id"]) not in ids
    assert str(blocks_me["id"]) not in ids


def test_excludes_people_i_reported(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=8001,
                          real_name="R", department="D")
    reported, _ = make_user(gender="female", nickname="Reported", telegram_id=8002,
                            real_name="R", department="D")
    db_exec(
        "INSERT INTO reports (reporter_id, reported_id, reason) VALUES (%s, %s, %s)",
        (me["id"], reported["id"], "spam"),
    )

    assert str(reported["id"]) not in _ids(_browse(client, token))


def test_reported_user_still_visible_to_others(client, make_user, db_exec):
    """A report hides the reported user from the reporter only."""
    reporter, reporter_token = make_user(gender="male", nickname="Reporter",
                                         telegram_id=9001, real_name="R", department="D")
    viewer, viewer_token = make_user(gender="male", nickname="Viewer",
                                     telegram_id=9002, real_name="R", department="D")
    reported, _ = make_user(gender="female", nickname="Reported", telegram_id=9003,
                            real_name="R", department="D")
    db_exec(
        "INSERT INTO reports (reporter_id, reported_id, reason) VALUES (%s, %s, %s)",
        (reporter["id"], reported["id"], "spam"),
    )

    # Reporter does not see the reported user.
    assert str(reported["id"]) not in _ids(_browse(client, reporter_token))
    # A different viewer still sees the reported user.
    assert str(reported["id"]) in _ids(_browse(client, viewer_token))


def test_excludes_active_matches(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=10001,
                          real_name="R", department="D")
    matched, _ = make_user(gender="female", nickname="Matched", telegram_id=10002,
                           real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (me["id"], matched["id"]),
    )

    assert str(matched["id"]) not in _ids(_browse(client, token))


def test_unmatched_match_still_visible(client, make_user, db_exec):
    me, token = make_user(gender="male", nickname="Me", telegram_id=11001,
                          real_name="R", department="D")
    unmatched, _ = make_user(gender="female", nickname="Unmatched", telegram_id=11002,
                             real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), now())",
        (me["id"], unmatched["id"]),
    )

    assert str(unmatched["id"]) in _ids(_browse(client, token))


def test_forged_gender_parameter_changes_nothing(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=12001,
                          real_name="R", department="D")
    female, _ = make_user(gender="female", nickname="Female", telegram_id=12002,
                          real_name="R", department="D")
    male, _ = make_user(gender="male", nickname="Male", telegram_id=12003,
                        real_name="R", department="D")

    # A forged ?gender= query parameter must be ignored; gender comes from the DB.
    response = _browse(client, token, extra_qs="?gender=female")
    assert response.status_code == 200
    ids = _ids(response)
    assert str(female["id"]) in ids
    assert str(male["id"]) not in ids  # caller is male => sees females only


def test_returns_at_most_20_when_25_qualify(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=13001,
                          real_name="R", department="D")
    for i in range(25):
        make_user(gender="female", nickname=f"User{i:02d}", telegram_id=13002 + i,
                  real_name="R", department="D")

    response = _browse(client, token)
    assert response.status_code == 200
    assert len(response.get_json()) <= 20


def test_response_never_contains_sensitive_fields(client, make_user):
    me, token = make_user(gender="male", nickname="Me", telegram_id=14001,
                          real_name="R", department="D")
    other, _ = make_user(gender="female", nickname="Other", telegram_id=14002,
                         real_name="Real Name", department="CS")

    response = _browse(client, token)
    for p in response.get_json():
        assert set(p.keys()) == {"id", "nickname", "created_at"}
        assert "real_name" not in p
        assert "department" not in p
        assert "telegram_username" not in p
        assert "telegram_id" not in p
        assert "gender" not in p


def test_returns_400_when_caller_gender_is_null(client, make_user):
    me, token = make_user(gender=None, nickname="Me", telegram_id=15001,
                          real_name=None, department=None)

    response = _browse(client, token)
    assert response.status_code == 400
    assert response.get_json() == {"error": "complete_profile_first"}