"""Profile routes.

GET /me    - return the authenticated user's own profile.
POST /profile - update the authenticated user's own profile fields.

Both routes require authentication and act on g.user_id only.
"""

from flask import Blueprint, jsonify, request

from app.auth.decorators import require_auth
from app.db.users import get_own_profile, update_own_profile

profile = Blueprint("profile", __name__)


@profile.get("/me")
@require_auth
def me():
    """Return the current user's profile."""
    p = get_own_profile(request.environ.get("USER_ID") or None)
    # pydantic validation happens in POST /profile; GET /me just returns data.
    from flask import g

    profile_data = get_own_profile(g.user_id)
    if profile_data is None:
        return jsonify({"error": "user_not_found"}), 404
    return jsonify(profile_data), 200


@profile.post("/profile")
@require_auth
def update_profile():
    """Update the current user's profile fields.

    Expects a JSON body with optional fields: nickname, real_name, department,
    gender. At least one field must be present. Returns the updated profile.
    """
    from flask import g

    body = request.get_json(silent=True) or {}

    # Pydantic validation
    from pydantic import BaseModel, Field, field_validator, ValidationError
    from typing import Optional, Literal

    class ProfileUpdate(BaseModel):
        nickname: Optional[str] = Field(None, min_length=2, max_length=30)
        real_name: Optional[str] = Field(None, min_length=1, max_length=100)
        department: Optional[str] = Field(None, min_length=1, max_length=100)
        gender: Optional[Literal["male", "female"]] = None

        @field_validator("nickname", "real_name", "department", mode="before")
        @classmethod
        def _strip(cls, v):
            if v is None:
                return v
            return v.strip()

    try:
        data = ProfileUpdate(**body)
    except ValidationError as exc:
        problems = []
        for err in exc.errors():
            field = ".".join(str(x) for x in err["loc"])
            problems.append(f"{field}: {err['msg']}")
        return jsonify({"error": "invalid_input", "problems": problems}), 400

    # At least one field must be present
    values = data.model_dump(exclude_unset=True)
    if not values:
        return jsonify({"error": "invalid_input", "problems": ["at least one field must be provided"]}), 400

    updated = update_own_profile(
        g.user_id,
        nickname=values.get("nickname"),
        real_name=values.get("real_name"),
        department=values.get("department"),
        gender=values.get("gender"),
    )
    if updated is None:
        return jsonify({"error": "user_not_found"}), 404

    return jsonify(
        {
            "nickname": updated["nickname"],
            "gender": updated["gender"],
            "real_name": updated["real_name"],
            "department": updated["department"],
            "profile_complete": all(
                updated[col] is not None
                for col in ("nickname", "gender", "real_name", "department")
            ),
        }
    ), 200
