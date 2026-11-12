"""Pydantic request/response schemas."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    subjects: Optional[List[str]] = Field(default=None, max_length=50)
    interests: Optional[List[str]] = Field(default=None, max_length=50)

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
        if value is None:
            return None

        cleaned: List[str] = []
        seen = set()
        for item in value:
            item = item.strip()
            if not item:
                continue
            if len(item) > 100:
                raise ValueError("Cada matéria/interesse deve ter no máximo 100 caracteres")
            key = item.casefold()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(item)
        return cleaned


class AcademicProfileOut(BaseModel):
    email: str
    name: Optional[str] = None
    bio: Optional[str] = None
    academic_level: Optional[str] = None
    subjects: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    updated_at: datetime
