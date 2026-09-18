from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.patients import PatientOut
from app.schemas.studies import StudyOut


class CaseCreate(BaseModel):
    patient_id: int
    symptom_onset_at: datetime | None = None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    facility_id: int
    created_by: int
    status: str
    zone: str | None
    specialist_type: str | None
    route: str | None
    symptom_onset_at: datetime | None
    created_at: datetime
    closed_at: datetime | None


class AnamnesisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    befast_json: dict | None
    voice_transcript: str | None
    structured_json: dict | None
    chief_complaint: str | None


class TriageResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone: str
    specialist_type: str
    route: str
    reasons_json: list
    time_window_min: int | None
    readers_agree: bool | None
    rules_version: str
    computed_at: datetime


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialist_id: int
    action: str
    note: str | None
    route_final: str | None
    decided_at: datetime


class CaseDetail(CaseOut):
    patient: PatientOut
    anamnesis: AnamnesisOut | None
    studies: list[StudyOut]
    triage_results: list[TriageResultOut]
    decisions: list[DecisionOut]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def triage(self) -> TriageResultOut | None:
        """Latest triage result (the list is kept for history)."""
        return self.triage_results[-1] if self.triage_results else None
