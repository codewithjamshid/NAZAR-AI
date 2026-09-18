from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models._types import JSONType
from app.models.enums import CaseStatus


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"), index=True)
    status: Mapped[str] = mapped_column(
        String(16), default=CaseStatus.CREATED, index=True
    )
    zone: Mapped[str | None] = mapped_column(String(8), index=True)  # Zone
    specialist_type: Mapped[str | None] = mapped_column(String(32))
    route: Mapped[str | None] = mapped_column(String(16))
    symptom_onset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patient: Mapped["Patient"] = relationship(back_populates="cases")  # noqa: F821
    facility: Mapped["Facility"] = relationship()  # noqa: F821
    creator: Mapped["User"] = relationship()  # noqa: F821
    anamnesis: Mapped["Anamnesis | None"] = relationship(
        back_populates="case", uselist=False
    )
    studies: Mapped[list["Study"]] = relationship(  # noqa: F821
        back_populates="case", order_by="Study.uploaded_at"
    )
    triage_results: Mapped[list["TriageResult"]] = relationship(  # noqa: F821
        back_populates="case", order_by="TriageResult.computed_at"
    )
    decisions: Mapped[list["Decision"]] = relationship(  # noqa: F821
        back_populates="case", order_by="Decision.decided_at"
    )


class Anamnesis(Base):
    __tablename__ = "anamnesis"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), unique=True)
    befast_json: Mapped[dict | None] = mapped_column(JSONType)
    voice_transcript: Mapped[str | None] = mapped_column(Text)
    structured_json: Mapped[dict | None] = mapped_column(JSONType)
    chief_complaint: Mapped[str | None] = mapped_column(Text)

    case: Mapped[Case] = relationship(back_populates="anamnesis")
