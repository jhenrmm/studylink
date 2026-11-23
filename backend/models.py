"""Pydantic request/response schemas."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

_MAX_LIST_ITEMS = 50
_MAX_ITEM_LENGTH = 100


def clean_terms(values: Optional[List[str]]) -> Optional[List[str]]:
    """Trim, de-duplicate (case-insensitively) and drop empty list items."""
    if values is None:
        return None

    cleaned: List[str] = []
    seen = set()
    for item in values:
        item = item.strip()
        if not item:
            continue
        if len(item) > _MAX_ITEM_LENGTH:
            raise ValueError(
                f"Cada matéria/interesse deve ter no máximo {_MAX_ITEM_LENGTH} caracteres"
            )
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(item)
    return cleaned


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    email: str
    created_at: datetime


class AcademicProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    academic_level: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Nível acadêmico (ex.: Ensino Médio, Graduação, Pós-graduação)",
    )
    subjects: Optional[List[str]] = Field(default=None, max_length=_MAX_LIST_ITEMS)
    interests: Optional[List[str]] = Field(default=None, max_length=_MAX_LIST_ITEMS)

    @field_validator("name", "bio", "academic_level")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        """Trim text fields and treat blank values as cleared fields."""
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("subjects", "interests")
    @classmethod
    def clean_items(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        """Trim, de-duplicate and drop empty subjects/interests."""
        return clean_terms(value)


class AcademicProfileOut(BaseModel):
    email: str
    name: Optional[str] = None
    bio: Optional[str] = None
    academic_level: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    updated_at: datetime


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    subject: str = Field(
        min_length=1,
        max_length=100,
        description="Matéria ou assunto do grupo (ex.: Matemática, Programação)",
    )

    @field_validator("name", "description", "subject")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Trim text fields and reject values that are blank after trimming."""
        value = value.strip()
        if not value:
            raise ValueError("Informe nome, descrição e matéria do grupo")
        return value


class GroupOut(BaseModel):
    """Study group data that can be seen by other students."""

    id: int
    name: str
    description: str
    subject: str
    creator_id: int
    creator_name: Optional[str] = None
    creator_email: str
    member_count: int = 0
    is_member: bool = False
    is_admin: bool = False
    created_at: datetime


class StudentOut(BaseModel):
    """Academic data of a student that can be seen by other students."""

    id: int
    email: str
    name: Optional[str] = None
    bio: Optional[str] = None
    academic_level: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    updated_at: Optional[datetime] = None
    common_subjects: List[str] = Field(default_factory=list)
    common_interests: List[str] = Field(default_factory=list)
    match_count: int = 0
