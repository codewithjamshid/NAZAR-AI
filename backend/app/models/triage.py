from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models._types import JSONType


class TriageResult(Base):
    """Output of services/triage.py. Recomputed when new AI results arrive."""

    __tablename__ = "triage_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    zone: Mapped[str] = mapped_column(String(8))  # Zone
    specialist_type: Mapped[str] = mapped_column(String(32))  # SpecialistType
    route: Mapped[str] = mapped_column(String(16))  # Route
    reasons_json: Mapped[list] = mapped_column(JSONType)
    time_window_min: Mapped[int | None] = mapped_column(Integer)
    readers_agree: Mapped[bool | None] = mapped_column(Boolean)
    rules_version: Mapped[str] = mapped_column(String(32))
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    case: Mapped["Case"] = relationship(back_populates="triage_results")  # noqa: F821


class Decision(Base):
    """Specialist decision. A case never closes without one."""

    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    specialist_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(16))  # DecisionAction
    note: Mapped[str | None] = mapped_column(Text)
    route_final: Mapped[str | None] = mapped_column(String(16))  # Route
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    case: Mapped["Case"] = relationship(back_populates="decisions")  # noqa: F821
    specialist: Mapped["User"] = relationship()  # noqa: F821
