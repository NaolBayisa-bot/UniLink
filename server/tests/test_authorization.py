"""Authorization sweep and focused attack tests.

Route sweep: loops over every rule in app.url_map.iter_rules() and calls each
route *without* an Authorization header, asserting 401 for every route except
/health and /auth/telegram (the two public endpoints) and Flask's own static
route. Any route added later without protection makes this test fail.

Focused attack tests (in addition to those already covered by earlier task
tests):
- user A cannot read B's real_name before any match (browse never returns it)
- user A cannot read B's profile through someone else's match_id
- forged user_id / from_user_id in a body is ignored
- a normal user calling /admin/* gets 403
- same-gender users never appear in browse
- a banned user's old token is rejected
"""

import re
import uuid

import pytest

from app.db.query import fetch_all


def _headers(token=None):
    if token is None:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _dummy_uuid():
    return str(uuid.UUID(int=0))


def _path_for_rule(rule):
    """Turn a Werkzeug rule string like /match/<match_id>/profile into a real
    path by replacing every placeholder with a dummy UUID."""
    path = rule.rule
    path = re.sub(r"<[^:>]+:([^>]+)>", r"{\1}", path)
    path = re.sub(r"<([^>]+)>", r"{\1}", path)
    try:
        names = re.findall(r"\{(\w+)\}", path)
        return path.format(**{name: _dummy_uuid() for name in names})
    except (KeyError, IndexError):
        return re.sub(r"<[^>]*>", _dummy_uuid(), path)


# ---------------------------------------------------------------------------
# Route sweep: every protected route must return 401 without a token.


def test_every_route_requires_auth(client):
    public = {("/health", "GET"), ("/auth/telegram", "POST")}
    checked = 0
    for rule in client.application.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        for method in sorted(rule.methods or set()):
            if method in ("HEAD", "OPTIONS"):
                continue
            if (rule.rule, method) in public:
                continue
            path = _path_for_rule(rule)
            response = client.open(path, method=method)
            assert response.status_code == 401, (
                f"{method} {path} returned {response.status_code}, expected 401"
            )
            checked += 1
    assert checked > 0, "no routes were checked"


# ---------------------------------------------------------------------------
# Focused attack tests.


def test_real_name_hidden_before_any_match(client, make_user):
    """user A reads /browse: B's entry must not contain real_name."""
    me, token = make_user(gender="male", nickname="Me", telegram_id=70001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=70002,
                          real_name="Real Name", department="CS")
    response = client.get("/browse", headers=_headers(token))
    assert response.status_code == 200
    for p in response.get_json():
        assert set(p.keys()) == {"id", "nickname", "created_at"}
        assert "real_name" not in p
        assert "department" not in p


def test_profile_through_someone_elses_match_id(client, make_user, db_exec):
    """A participant cannot read another match's profile using a foreign match_id."""
    me, token = make_user(gender="male", nickname="Me", telegram_id=71001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=71002,
                          real_name="R", department="D")
    # A match exists between two *other* users.
    a, _ = make_user(gender="male", nickname="Alpha", telegram_id=71003,
                     real_name="R", department="D")
    b, _ = make_user(gender="female", nickname="Beta", telegram_id=71004,
                     real_name="R", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (a["id"], b["id"]),
    )
    match_id = fetch_all("SELECT id FROM matches LIMIT 1")[0]["id"]

    response = client.get(
        f"/match/{match_id}/profile", headers=_headers(token)
    )
    assert response.status_code == 404
    assert response.get_json() == {"error": "not_found"}


def test_forged_identity_fields_ignored(client, make_user):
    """A forged user_id / from_user_id in a body is never honored."""
    me, token = make_user(gender="male", nickname="Me", telegram_id=72001,
                          real_name="R", department="D")
    target, _ = make_user(gender="female", nickname="Target", telegram_id=72002,
                          real_name="R", department="D")
    impostor = "00000000-0000-0000-0000-000000000001"

    response = client.post(
        "/like",
        json={"to_user_id": str(target["id"]), "from_user_id": impostor,
              "user_id": impostor},
        headers=_headers(token),
        content_type="application/json",
    )
    assert response.status_code == 200
    row = fetch_all(
        "SELECT from_user_id FROM likes WHERE from_user_id = %s AND to_user_id = %s",
        (me["id"], target["id"]),
    )
    assert len(row) == 1
    assert row[0]["from_user_id"] == me["id"]
    assert fetch_all(
        "SELECT 1 FROM likes WHERE from_user_id = %s AND to_user_id = %s",
        (impostor, target["id"]),
    ) == []


def test_normal_user_cannot_access_admin_routes(client, make_user):
    """A normal (non-admin) user gets 403 on every /admin/* route."""
    _, token = make_user(gender="male", nickname="Norm", telegram_id=73001,
                         real_name="R", department="D")
    assert client.get("/admin/reports", headers=_headers(token)).status_code == 403
    assert client.post(
        "/admin/resolve-report",
        json={"report_id": "00000000-0000-0000-0000-000000000001"},
        headers=_headers(token),
    ).status_code == 403
    assert client.post(
        "/admin/ban-user",
        json={"user_id": "00000000-0000-0000-0000-000000000001"},
        headers=_headers(token),
    ).status_code == 403


def test_same_gender_users_never_appear_in_browse(client, make_user):
    """Same-gender users are filtered by DB gender, never by request params."""
    me, token = make_user(gender="male", nickname="Me", telegram_id=74001,
                          real_name="R", department="D")
    same, _ = make_user(gender="male", nickname="SameGuy", telegram_id=74002,
                        real_name="R", department="D")
    opposite, _ = make_user(gender="female", nickname="OppositeGal",
                            telegram_id=74003, real_name="R", department="D")

    response = client.get("/browse", headers=_headers(token))
    assert response.status_code == 200
    ids = [p["id"] for p in response.get_json()]
    assert str(same["id"]) not in ids
    assert str(opposite["id"]) in ids

    # A forged ?gender= query parameter changes nothing.
    response = client.get("/browse?gender=female", headers=_headers(token))
    assert response.status_code == 200
    ids = [p["id"] for p in response.get_json()]
    assert str(same["id"]) not in ids
    assert str(opposite["id"]) in ids


def test_banned_users_old_token_rejected(client, make_user, db_exec):
    """After a ban, the user's existing token returns 403 on protected routes."""
    admin, admin_token = make_user(gender="male", nickname="Admin", telegram_id=75001,
                                   real_name="R", department="D", is_admin=True)
    banned, banned_token = make_user(gender="female", nickname="Banned",
                                     telegram_id=75002, real_name="R",
                                     department="D")

    response = client.post(
        "/admin/ban-user",
        json={"user_id": str(banned["id"])},
        headers=_headers(admin_token),
    )
    assert response.status_code == 200

    assert client.get("/me", headers=_headers(banned_token)).status_code == 403
    assert client.get("/browse", headers=_headers(banned_token)).status_code == 403

