from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models._types import JSONType


class Study(Base):
    __tablename__ = "studies"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    type: Mapped[str] = mapped_column(String(16))  # StudyType
    file_path: Mapped[str] = mapped_column(String(512))
    source: Mapped[str] = mapped_column(String(16))  # StudySource
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # StudyStatus
    cache_key: Mapped[str | None] = mapped_column(String(128))  # MedGemma stub lookup
    error: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    case: Mapped["Case"] = relationship(back_populates="studies")  # noqa: F821
    ai_results: Mapped[list["AIResult"]] = relationship(
        back_populates="study", order_by="AIResult.processed_at"
    )


class AIResult(Base):
    """Raw model output. Never edited after insert; triage reads it."""

    __tablename__ = "ai_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    study_id: Mapped[int] = mapped_column(ForeignKey("studies.id"), index=True)
    module: Mapped[str] = mapped_column(String(32))  # AIModule
    output_json: Mapped[dict | None] = mapped_column(JSONType)
    confidence: Mapped[float | None] = mapped_column(Float)
    heatmap_path: Mapped[str | None] = mapped_column(String(512))
    model_version: Mapped[str] = mapped_column(String(64))
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)  # set when the module failed

    study: Mapped[Study] = relationship(back_populates="ai_results")
