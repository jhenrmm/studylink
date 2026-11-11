"""Shared FastAPI dependencies (authentication)."""
import psycopg2
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from psycopg2.extras import RealDictCursor

from config import DATABASE_URL
from security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def credentials_exception() -> HTTPException:
    """Build a standard 401 response for invalid credentials."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Return the authenticated user record from a bearer token."""
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception()

    email = payload.get("sub")
    jti = payload.get("jti")

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            if jti:
                cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti,))
                if cur.fetchone() is not None:
                    raise credentials_exception()
            cur.execute(
                "SELECT email, created_at FROM users WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if user is None:
        raise credentials_exception()
    return dict(user)
