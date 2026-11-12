"""Academic profile routes."""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from database import get_db
from dependencies import get_current_user
from models import AcademicProfileOut, AcademicProfileUpdate

router = APIRouter(tags=["profile"])

_PROFILE_COLUMNS = "name, bio, academic_level, subjects, interests, updated_at"


def _empty_profile() -> Dict[str, Any]:
    """Return the default values for a profile that has not been saved yet."""
    return {
        "name": None,
        "bio": None,
        "academic_level": None,
        "subjects": [],
        "interests": [],
    }


def _upsert_profile(
    profile_in: AcademicProfileUpdate,
    current_user: dict,
    db,
) -> Dict[str, Any]:
    """Persist the supplied fields, keeping values that were not sent."""
    changes = profile_in.model_dump(exclude_unset=True)

    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM academic_profiles "
            "WHERE user_id = %s FOR UPDATE",
            (current_user["id"],),
        )
        existing = cur.fetchone()

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
    return {**saved, "email": current_user["email"]}


@router.get("/me/profile", response_model=AcademicProfileOut)
def read_academic_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the academic profile of the authenticated student."""
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM academic_profiles WHERE user_id = %s",
            (current_user["id"],),
        )
        profile = cur.fetchone()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic profile not found",
        )

    return {**profile, "email": current_user["email"]}


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
