"""Academic profile routes."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import AcademicProfileOut, AcademicProfileUpdate

router = APIRouter(tags=["profile"])

_PROFILE_COLUMNS = "name, bio, academic_level, subjects, interests, updated_at"
_PROFILE_SELECT = f"SELECT {_PROFILE_COLUMNS} FROM academic_profiles WHERE user_id = %s"
_PROFILE_SELECT_FOR_UPDATE = f"{_PROFILE_SELECT} FOR UPDATE"


def _empty_profile() -> Dict[str, Any]:
    """Return the default values for a profile that has not been saved yet."""
    return {
        "name": None,
        "bio": None,
        "academic_level": None,
        "subjects": [],
        "interests": [],
    }


def _fetch_profile(cur, user_id: int, for_update: bool = False) -> Optional[Dict[str, Any]]:
    """Fetch a user's academic profile, optionally locking the row."""
    statement = _PROFILE_SELECT_FOR_UPDATE if for_update else _PROFILE_SELECT
    cur.execute(statement, (user_id,))
    return cur.fetchone()


def _with_email(profile: Dict[str, Any], email: str) -> Dict[str, Any]:
    """Attach the owner's email to a profile row for the response model."""
    return {**profile, "email": email}


def _upsert_profile(
    profile_in: AcademicProfileUpdate,
    current_user: dict,
    db,
) -> Dict[str, Any]:
    """Persist the supplied fields, keeping values that were not sent."""
    changes = profile_in.model_dump(exclude_unset=True)

    with db.cursor() as cur:
        existing = _fetch_profile(cur, current_user["id"], for_update=True)

        profile = _empty_profile()
        if existing is not None:
            profile.update(existing)
        profile.update(changes)

        cur.execute(
            """
            INSERT INTO academic_profiles
                (user_id, name, bio, academic_level, subjects, interests)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                bio = EXCLUDED.bio,
                academic_level = EXCLUDED.academic_level,
                subjects = EXCLUDED.subjects,
                interests = EXCLUDED.interests,
                updated_at = NOW()
            RETURNING name, bio, academic_level, subjects, interests, updated_at
            """,
            (
                current_user["id"],
                profile["name"],
                profile["bio"],
                profile["academic_level"],
                profile["subjects"],
                profile["interests"],
            ),
        )
        saved = cur.fetchone()

    db.commit()
    return _with_email(saved, current_user["email"])


@router.get("/me/profile", response_model=AcademicProfileOut)
def read_academic_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the academic profile of the authenticated student."""
    with db.cursor() as cur:
        profile = _fetch_profile(cur, current_user["id"])

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic profile not found",
        )

    return _with_email(profile, current_user["email"])


@router.put("/me/profile", response_model=AcademicProfileOut)
def put_academic_profile(
    profile_in: AcademicProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create or edit the authenticated student's academic profile.

    Fields omitted from the request keep their current values; sending an
    empty list clears subjects or interests.
    """
    return _upsert_profile(profile_in, current_user, db)
