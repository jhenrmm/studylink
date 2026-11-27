"""Authentication routes: register, login, logout."""
from fastapi import APIRouter, Depends, HTTPException, status

from backend.database import get_db
from backend.dependencies import oauth2_scheme, unauthorized_exception
from backend.models import Token, UserLogin, UserOut, UserRegister
from backend.security import create_access_token, decode_token, hash_password, verify_password

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db=Depends(get_db)):
    """Register a new user account."""
    with db.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE email = %s", (user_in.email,))
        if cur.fetchone() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) "
            "RETURNING email, created_at",
            (user_in.email, hash_password(user_in.password)),
        )
        row = cur.fetchone()
    db.commit()
    return {"email": row["email"], "created_at": row["created_at"]}


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db=Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    with db.cursor() as cur:
        cur.execute(
            "SELECT email, password_hash FROM users WHERE email = %s",
            (user_in.email,),
        )
        user = cur.fetchone()

    if user is None or not verify_password(user_in.password, user["password_hash"]):
        raise unauthorized_exception("Incorrect email or password")

    access_token = create_access_token(subject=user_in.email)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Revoke the current access token so it can no longer be used."""
    payload = decode_token(token, verify_exp=False)
    if payload is None:
        raise unauthorized_exception("Invalid token")

    jti = payload.get("jti")
    if jti:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO revoked_tokens (jti) VALUES (%s) "
                "ON CONFLICT (jti) DO NOTHING",
                (jti,),
            )
        db.commit()
    return {"detail": "Successfully logged out"}
