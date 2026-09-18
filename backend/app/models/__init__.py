"""SQLAlchemy models (TZ §9). Importing this package registers every table on Base."""

from app.models.audit import AuditLog
from app.models.cases import Anamnesis, Case
from app.models.enums import (
    AIModule,
    CaseStatus,
    DecisionAction,
    FacilityType,
    Route,
    Sex,
    SpecialistType,
    StudySource,
    StudyType,
    UserRole,
    Zone,
)
from app.models.patients import Patient
from app.models.studies import AIResult, Study
from app.models.triage import Decision, TriageResult
from app.models.users import Facility, User

__all__ = [
    "AIModule", "AIResult", "Anamnesis", "AuditLog", "Case", "CaseStatus",
    "Decision", "DecisionAction", "Facility", "FacilityType", "Patient",
    "Route", "Sex", "SpecialistType", "Study", "StudySource", "StudyType",
    "TriageResult", "User", "UserRole", "Zone",
]
