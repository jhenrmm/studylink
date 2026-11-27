"""Student discovery routes: list profiles and search by academic interests."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import StudentOut, clean_terms

router = APIRouter(tags=["students"])

_MAX_SEARCH_TERMS = 50

_COMMON_SUBJECTS = """
    ARRAY(
        SELECT subject FROM unnest(COALESCE(ap.subjects, '{}'::text[])) AS subject
        WHERE lower(subject) = ANY(%(subject_keys)s::text[])
    )
"""
_COMMON_INTERESTS = """
    ARRAY(
        SELECT interest FROM unnest(COALESCE(ap.interests, '{}'::text[])) AS interest
        WHERE lower(interest) = ANY(%(interest_keys)s::text[])
    )
"""
_STUDENT_SELECT = f"""
SELECT
    u.id,
    u.email,
    ap.name,
    ap.bio,
    ap.academic_level,
    COALESCE(ap.subjects, '{{}}'::text[]) AS subjects,
    COALESCE(ap.interests, '{{}}'::text[]) AS interests,
    ap.updated_at,
    {_COMMON_SUBJECTS} AS common_subjects,
    {_COMMON_INTERESTS} AS common_interests
FROM users AS u
LEFT JOIN academic_profiles AS ap ON ap.user_id = u.id
"""
_MATCH_SUBJECTS = """
EXISTS (
    SELECT 1 FROM unnest(COALESCE(ap.subjects, '{}'::text[])) AS subject
    WHERE lower(subject) = ANY(%(subject_keys)s::text[])
)
"""
_MATCH_INTERESTS = """
EXISTS (
    SELECT 1 FROM unnest(COALESCE(ap.interests, '{}'::text[])) AS interest
    WHERE lower(interest) = ANY(%(interest_keys)s::text[])
)
"""


def _parse_terms(values: List[str]) -> List[str]:
    """Normalize query terms and return lowercased keys for matching."""
    split_values = [part for value in values for part in value.split(",")]
    try:
        terms = clean_terms(split_values) or []
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if len(terms) > _MAX_SEARCH_TERMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A busca aceita no máximo {_MAX_SEARCH_TERMS} matérias/interesses",
        )
    return [term.lower() for term in terms]


def _to_student_out(row: Dict[str, Any]) -> StudentOut:
    """Attach the match count to a student row for the response model."""
    student = dict(row)
    student["common_subjects"] = student.get("common_subjects") or []
    student["common_interests"] = student.get("common_interests") or []
    student["match_count"] = (
        len(student["common_subjects"]) + len(student["common_interests"])
    )
    return StudentOut(**student)


@router.get("/students", response_model=List[StudentOut])
def list_students(
    subjects: List[str] = Query(
        default=[],
        description="Matérias em comum (repita o parâmetro ou separe por vírgulas)",
    ),
    interests: List[str] = Query(
        default=[],
        description="Interesses acadêmicos em comum (repita o parâmetro ou separe por vírgulas)",
    ),
    academic_level: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Filtrar por nível acadêmico",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List registered students, ranking by the interests and subjects in common.

    When subjects or interests are supplied, only students with at least one
    match are returned. Without filters, all registered students are listed
    (except the authenticated one).
    """
    subject_keys = _parse_terms(subjects)
    interest_keys = _parse_terms(interests)
    level = (academic_level or "").strip().lower() or None

    conditions = ["u.id <> %(current_user_id)s"]
    params: Dict[str, Any] = {
        "current_user_id": current_user["id"],
        "subject_keys": subject_keys,
        "interest_keys": interest_keys,
        "limit": limit,
        "offset": offset,
    }
    if subject_keys:
        conditions.append(_MATCH_SUBJECTS)
    if interest_keys:
        conditions.append(_MATCH_INTERESTS)
    if level is not None:
        conditions.append("lower(ap.academic_level) = %(academic_level)s")
        params["academic_level"] = level

    statement = (
        f"SELECT * FROM ({_STUDENT_SELECT} WHERE {' AND '.join(conditions)}) AS matches "
        "ORDER BY cardinality(common_subjects) + cardinality(common_interests) DESC, "
        "updated_at DESC NULLS LAST, id ASC "
        "LIMIT %(limit)s OFFSET %(offset)s"
    )

    with db.cursor() as cur:
        cur.execute(statement, params)
        rows = cur.fetchall()

    return [_to_student_out(row) for row in rows]


@router.get("/students/{student_id}", response_model=StudentOut)
def read_student(
    student_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the academic profile of a registered student."""
    with db.cursor() as cur:
        cur.execute(
            f"{_STUDENT_SELECT} WHERE u.id = %(student_id)s",
            {"student_id": student_id, "subject_keys": [], "interest_keys": []},
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    return _to_student_out(row)
