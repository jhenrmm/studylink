"""Study group routes: create groups and make them available to other students."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..dependencies import get_current_user
from ..models import GroupCreate, GroupOut

router = APIRouter(tags=["groups"])

_GROUP_SELECT = """
SELECT
    g.id,
    g.name,
    g.description,
    g.subject,
    g.creator_id,
    ap.name AS creator_name,
    u.email AS creator_email,
    g.created_at,
    (SELECT COUNT(*) FROM group_members AS gm WHERE gm.group_id = g.id) AS member_count,
    EXISTS (
        SELECT 1 FROM group_members AS gm
        WHERE gm.group_id = g.id AND gm.user_id = %(current_user_id)s
    ) AS is_member,
    EXISTS (
        SELECT 1 FROM group_members AS gm
        WHERE gm.group_id = g.id
          AND gm.user_id = %(current_user_id)s
          AND gm.role = 'admin'
    ) AS is_admin
FROM study_groups AS g
JOIN users AS u ON u.id = g.creator_id
LEFT JOIN academic_profiles AS ap ON ap.user_id = g.creator_id
"""


def _fetch_group(cur, group_id: int, current_user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a group with creator info and the current user's membership flags."""
    cur.execute(
        f"{_GROUP_SELECT} WHERE g.id = %(group_id)s",
        {"group_id": group_id, "current_user_id": current_user_id},
    )
    return cur.fetchone()


@router.post("/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: GroupCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a study group and set its creator as the group administrator."""
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO study_groups (name, description, subject, creator_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (
                group_in.name,
                group_in.description,
                group_in.subject,
                current_user["id"],
            ),
        )
        group_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO group_members (group_id, user_id, role) VALUES (%s, %s, 'admin')",
            (group_id, current_user["id"]),
        )
        group = _fetch_group(cur, group_id, current_user["id"])

    db.commit()
    return GroupOut(**group)


@router.get("/groups", response_model=List[GroupOut])
def list_groups(
    subject: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Filtrar por matéria ou assunto",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List study groups created by any student, newest first.

    Groups are public to all authenticated students so they can find
    people interested in the same subject.
    """
    subject_key = (subject or "").strip().lower() or None

    conditions = []
    params: Dict[str, Any] = {
        "current_user_id": current_user["id"],
        "limit": limit,
        "offset": offset,
    }
    if subject_key is not None:
        conditions.append("lower(g.subject) = %(subject)s")
        params["subject"] = subject_key

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    statement = (
        f"{_GROUP_SELECT}{where} "
        "ORDER BY g.created_at DESC, g.id DESC "
        "LIMIT %(limit)s OFFSET %(offset)s"
    )

    with db.cursor() as cur:
        cur.execute(statement, params)
        rows = cur.fetchall()

    return [GroupOut(**row) for row in rows]


@router.get("/groups/{group_id}", response_model=GroupOut)
def read_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return a study group's details to any authenticated student."""
    with db.cursor() as cur:
        group = _fetch_group(cur, group_id, current_user["id"])

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    return GroupOut(**group)
