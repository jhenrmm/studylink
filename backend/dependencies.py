"""Shared FastAPI dependencies (authentication)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from psycopg2.extras import RealDictCursor

from backend.database import db_connection
from backend.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def unauthorized_exception(
    detail: str = "Could not validate credentials",
) -> HTTPException:
    """Build a standard 401 response for invalid or revoked credentials."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def credentials_exception() -> HTTPException:
    """Build the standard 401 response used by protected routes."""
    return unauthorized_exception()


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Return the authenticated user record from a bearer token."""
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception()

    email = payload.get("sub")
    jti = payload.get("jti")

    with db_connection(cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            if jti:
                cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti,))
                if cur.fetchone() is not None:
                    raise credentials_exception()
            cur.execute(
                "SELECT id, email, created_at FROM users WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()

    if user is None:
        raise credentials_exception()
    return dict(user)
