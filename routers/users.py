"""User profile routes."""
from fastapi import APIRouter, Depends

from dependencies import get_current_user
from models import UserOut

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserOut)
def read_users_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {"email": current_user["email"], "created_at": current_user["created_at"]}
