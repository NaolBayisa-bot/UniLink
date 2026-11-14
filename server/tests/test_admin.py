"""Admin report review and moderation routes."""

from app.db.query import fetch_one


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _post(client, path, token, body):
    return client.post(path, json=body, headers=_headers(token))


def test_non_admin_gets_403_on_every_admin_route(client, make_user):
    _, token = make_user()
    assert client.get("/admin/reports", headers=_headers(token)).status_code == 403
    assert _post(client, "/admin/resolve-report", token,
                 {"report_id": "00000000-0000-0000-0000-000000000001"}).status_code == 403
    assert _post(client, "/admin/ban-user", token,
                 {"user_id": "00000000-0000-0000-0000-000000000001"}).status_code == 403


def test_unauthenticated_gets_401_on_every_admin_route(client):
    assert client.get("/admin/reports").status_code == 401
    assert client.post("/admin/resolve-report", json={}).status_code == 401
    assert client.post("/admin/ban-user", json={}).status_code == 401


def test_admin_lists_reports_open_by_default_and_can_resolve(client, make_user, db_exec):
    _, admin_token = make_user(is_admin=True)
    reporter, _ = make_user()
    reported, _ = make_user(gender="female")
    db_exec(
        "INSERT INTO reports (reporter_id, reported_id, reason) VALUES (%s, %s, %s)",
        (reporter["id"], reported["id"], "spam"),
    )
    report = fetch_one("SELECT id FROM reports")

    response = client.get("/admin/reports", headers=_headers(admin_token))
    assert response.status_code == 200
    item = response.get_json()[0]
    assert set(item) == {"id", "reporter_id", "reported_id", "reason", "status", "created_at"}
    assert item["id"] == str(report["id"])
    assert item["reporter_id"] == str(reporter["id"])
    assert item["reported_id"] == str(reported["id"])
    assert item["status"] == "open"

    response = _post(client, "/admin/resolve-report", admin_token,
                     {"report_id": str(report["id"])})
    assert response.status_code == 200
    assert fetch_one("SELECT status FROM reports WHERE id = %s", (report["id"],))["status"] == "resolved"


def test_resolve_missing_report_returns_404(client, make_user):
    _, token = make_user(is_admin=True)
    response = _post(client, "/admin/resolve-report", token,
                     {"report_id": "00000000-0000-0000-0000-000000000001"})
    assert response.status_code == 404


def test_ban_disables_existing_token_and_hides_user(client, make_user, db_exec):
    _, admin_token = make_user(is_admin=True)
    viewer, viewer_token = make_user(gender="male", real_name="Viewer", department="D")
    banned, banned_token = make_user(gender="female", real_name="Banned", department="D")
    db_exec(
        "INSERT INTO matches (user_a_id, user_b_id, matched_at, unmatched_at) "
        "VALUES (%s, %s, now(), NULL)",
        (viewer["id"], banned["id"]),
    )

    response = _post(client, "/admin/ban-user", admin_token, {"user_id": str(banned["id"])})
    assert response.status_code == 200
    assert client.get("/me", headers=_headers(banned_token)).status_code == 403

    browse = client.get("/browse", headers=_headers(viewer_token))
    assert browse.status_code == 200
    assert str(banned["id"]) not in [row["id"] for row in browse.get_json()]
    matches = client.get("/matches", headers=_headers(viewer_token))
    assert matches.status_code == 200
    assert str(banned["id"]) not in [row["other_user"]["id"] for row in matches.get_json()]

    match = fetch_one(
        "SELECT unmatched_at FROM matches WHERE user_a_id = %s OR user_b_id = %s",
        (banned["id"], banned["id"]),
    )
    assert match["unmatched_at"] is not None
    assert fetch_one("SELECT status FROM users WHERE id = %s", (banned["id"],))["status"] == "banned"


def test_admin_cannot_ban_self(client, make_user):
    admin, token = make_user(is_admin=True)
    response = _post(client, "/admin/ban-user", token, {"user_id": str(admin["id"])})
    assert response.status_code == 400
