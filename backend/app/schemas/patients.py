from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Sex


class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    birth_year: int = Field(ge=1900, le=2100)
    sex: Sex
    phone: str | None = Field(default=None, max_length=20)
    district: str | None = Field(default=None, max_length=64)


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    birth_year: int
    sex: str
    phone: str | None
    district: str | None
    created_at: datetime
