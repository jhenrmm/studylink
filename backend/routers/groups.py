"""Study group routes: create groups, join them and list their members."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg2.errors import UniqueViolation

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import GroupCreate, GroupMemberOut, GroupOut, JoinRequestOut

router = APIRouter(tags=["groups"])

_GROUP_SELECT = """
SELECT
    g.id,
    g.name,
    g.description,
    g.subject,
    g.creator_id,
    ap.name AS creator_name,
    g.created_at,
    g.join_policy,
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
    ) AS is_admin,
    EXISTS (
        SELECT 1 FROM group_join_requests AS jr
        WHERE jr.group_id = g.id
          AND jr.user_id = %(current_user_id)s
          AND jr.status = 'pending'
    ) AS has_pending_request
FROM study_groups AS g
JOIN users AS u ON u.id = g.creator_id
LEFT JOIN academic_profiles AS ap ON ap.user_id = g.creator_id
"""

_GROUP_REQUEST_SELECT = """
SELECT
    jr.id,
    jr.group_id,
    jr.user_id,
    ap.name,
    jr.status,
    jr.created_at,
    jr.decided_at,
    jr.decided_by
FROM group_join_requests AS jr
JOIN users AS u ON u.id = jr.user_id
LEFT JOIN academic_profiles AS ap ON ap.user_id = jr.user_id
"""


def _fetch_group(cur, group_id: int, current_user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a group with creator info and the current user's membership flags."""
    cur.execute(
        f"{_GROUP_SELECT} WHERE g.id = %(group_id)s",
        {"group_id": group_id, "current_user_id": current_user_id},
    )
    return cur.fetchone()


def _require_group(cur, group_id: int) -> Dict[str, Any]:
    """Return the group row or raise a 404 for an unknown group."""
    cur.execute(
        "SELECT id, join_policy FROM study_groups WHERE id = %s",
        (group_id,),
    )
    group = cur.fetchone()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )
    return group


def _membership(cur, group_id: int, user_id: int) -> Optional[str]:
    """Return the student's role in a group, or None when not a member."""
    cur.execute(
        "SELECT role FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id),
    )
    row = cur.fetchone()
    return row["role"] if row is not None else None


def _require_not_member(cur, group_id: int, user_id: int) -> None:
    """Reject join/request attempts from students who already participate."""
    if _membership(cur, group_id, user_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já participa deste grupo.",
        )


def _require_admin(cur, group_id: int, user_id: int) -> None:
    """Restrict request management to the group's administrators."""
    if _membership(cur, group_id, user_id) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem gerenciar solicitações.",
        )


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
            INSERT INTO study_groups (name, description, subject, creator_id, join_policy)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                group_in.name,
                group_in.description,
                group_in.subject,
                current_user["id"],
                group_in.join_policy,
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


@router.get("/me/groups", response_model=List[GroupOut])
def list_my_groups(
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
    """List only the study groups the authenticated student participates in."""
    subject_key = (subject or "").strip().lower() or None

    conditions = [
        """EXISTS (
            SELECT 1 FROM group_members AS mine
            WHERE mine.group_id = g.id AND mine.user_id = %(current_user_id)s
        )"""
    ]
    params: Dict[str, Any] = {
        "current_user_id": current_user["id"],
        "limit": limit,
        "offset": offset,
    }
    if subject_key is not None:
        conditions.append("lower(g.subject) = %(subject)s")
        params["subject"] = subject_key

    statement = (
        f"{_GROUP_SELECT} WHERE {' AND '.join(conditions)} "
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


@router.get("/groups/{group_id}/members", response_model=List[GroupMemberOut])
def list_group_members(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List the students registered as members of a study group."""
    with db.cursor() as cur:
        _require_group(cur, group_id)
        cur.execute(
            """
            SELECT
                u.id,
                ap.name,
                gm.role,
                gm.joined_at
            FROM group_members AS gm
            JOIN users AS u ON u.id = gm.user_id
            LEFT JOIN academic_profiles AS ap ON ap.user_id = gm.user_id
            WHERE gm.group_id = %s
            ORDER BY (gm.role = 'admin') DESC, gm.joined_at ASC, u.id ASC
            """,
            (group_id,),
        )
        members = cur.fetchall()

    return [GroupMemberOut(**member) for member in members]


@router.post("/groups/{group_id}/join", response_model=GroupOut)
def join_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Join an open study group directly and register the student as a member."""
    with db.cursor() as cur:
        group = _require_group(cur, group_id)
        _require_not_member(cur, group_id, current_user["id"])
        if group["join_policy"] != "open":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este grupo exige aprovação. Solicite participação.",
            )
        try:
            cur.execute(
                """
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, 'member')
                """,
                (group_id, current_user["id"]),
            )
        except UniqueViolation as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Você já participa deste grupo.",
            ) from exc
        joined = _fetch_group(cur, group_id, current_user["id"])

    db.commit()
    return GroupOut(**joined)


@router.post(
    "/groups/{group_id}/requests",
    response_model=JoinRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def request_to_join_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Ask to join a study group whose administrator approves new members."""
    with db.cursor() as cur:
        group = _require_group(cur, group_id)
        _require_not_member(cur, group_id, current_user["id"])
        if group["join_policy"] != "approval":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este grupo permite entrada direta.",
            )
        cur.execute(
            """
            SELECT 1 FROM group_join_requests
            WHERE group_id = %s AND user_id = %s AND status = 'pending'
            """,
            (group_id, current_user["id"]),
        )
        if cur.fetchone() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Você já enviou uma solicitação para este grupo.",
            )
        try:
            cur.execute(
                """
                INSERT INTO group_join_requests (group_id, user_id)
                VALUES (%s, %s)
                RETURNING id
                """,
                (group_id, current_user["id"]),
            )
        except UniqueViolation as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Você já enviou uma solicitação para este grupo.",
            ) from exc
        request_id = cur.fetchone()["id"]
        cur.execute(
            f"{_GROUP_REQUEST_SELECT} WHERE jr.id = %s",
            (request_id,),
        )
        join_request = cur.fetchone()

    db.commit()
    return JoinRequestOut(**join_request)


@router.get("/groups/{group_id}/requests", response_model=List[JoinRequestOut])
def list_join_requests(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Show join requests to the group's administrators."""
    with db.cursor() as cur:
        _require_group(cur, group_id)
        _require_admin(cur, group_id, current_user["id"])
        cur.execute(
            f"{_GROUP_REQUEST_SELECT} "
            "WHERE jr.group_id = %s "
            "ORDER BY (jr.status = 'pending') DESC, jr.created_at ASC, jr.id ASC",
            (group_id,),
        )
        join_requests = cur.fetchall()

    return [JoinRequestOut(**row) for row in join_requests]


def _decide_join_request(
    cur,
    group_id: int,
    request_id: int,
    admin_id: int,
    decision: str,
) -> Dict[str, Any]:
    """Approve or reject a pending request, registering the student on approval."""
    cur.execute(
        """
        SELECT id, user_id, status FROM group_join_requests
        WHERE id = %s AND group_id = %s
        FOR UPDATE
        """,
        (request_id, group_id),
    )
    join_request = cur.fetchone()
    if join_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found",
        )
    if join_request["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta solicitação já foi decidida.",
        )

    if decision == "approved":
        cur.execute(
            """
            INSERT INTO group_members (group_id, user_id, role)
            VALUES (%s, %s, 'member')
            ON CONFLICT (group_id, user_id) DO NOTHING
            """,
            (group_id, join_request["user_id"]),
        )
    cur.execute(
        """
        UPDATE group_join_requests
        SET status = %s, decided_at = NOW(), decided_by = %s
        WHERE id = %s
        """,
        (decision, admin_id, request_id),
    )


@router.post("/groups/{group_id}/requests/{request_id}/approve", response_model=GroupOut)
def approve_join_request(
    group_id: int,
    request_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Approve a join request and register the student as a group member."""
    with db.cursor() as cur:
        _require_group(cur, group_id)
        _require_admin(cur, group_id, current_user["id"])
        _decide_join_request(cur, group_id, request_id, current_user["id"], "approved")
        group = _fetch_group(cur, group_id, current_user["id"])

    db.commit()
    return GroupOut(**group)


@router.post("/groups/{group_id}/requests/{request_id}/reject", response_model=GroupOut)
def reject_join_request(
    group_id: int,
    request_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Reject a join request without adding the student to the group."""
    with db.cursor() as cur:
        _require_group(cur, group_id)
        _require_admin(cur, group_id, current_user["id"])
        _decide_join_request(cur, group_id, request_id, current_user["id"], "rejected")
        group = _fetch_group(cur, group_id, current_user["id"])

    db.commit()
    return GroupOut(**group)
