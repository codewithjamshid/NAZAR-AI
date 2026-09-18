"""Allowed string values for status-like columns.

Stored as plain strings in the DB (no native Postgres enums) so the
neurosurgeon-driven vocabulary can grow without migrations. Validation
happens at the API boundary (Pydantic schemas) and in the triage engine.
"""

from enum import StrEnum


class UserRole(StrEnum):
    NURSE = "nurse"
    OPERATOR = "operator"
    SPECIALIST = "specialist"
    ADMIN = "admin"


class FacilityType(StrEnum):
    FAP = "fap"
    DISTRICT = "district"
    REGIONAL = "regional"


class Sex(StrEnum):
    MALE = "male"
    FEMALE = "female"


class CaseStatus(StrEnum):
    CREATED = "created"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    TRIAGED = "triaged"
    AI_FAILED = "ai_failed"
    IN_REVIEW = "in_review"
    DECIDED = "decided"
    CLOSED = "closed"


class Zone(StrEnum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"


class SpecialistType(StrEnum):
    NEUROLOGIST = "neurologist"
    NEUROSURGEON = "neurosurgeon"
    PULMONOLOGIST = "pulmonologist"
    SURGEON = "surgeon"
    THERAPIST = "therapist"
    CARDIOLOGIST = "cardiologist"
    ONCOLOGIST = "oncologist"
    RADIOLOGIST = "radiologist"
    FAMILY_DOCTOR = "family_doctor"


class Route(StrEnum):
    ONSITE = "onsite"       # joyida davolash
    DISTRICT = "district"   # tumanda qoldirish
    REGIONAL = "regional"   # viloyatga transport


class StudyType(StrEnum):
    CT_HEAD = "ct_head"
    CXR = "cxr"
    LAB_PHOTO = "lab_photo"
    VOICE = "voice"


class StudyStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class StudySource(StrEnum):
    DICOM = "dicom"
    PHOTO = "photo"
    AUDIO = "audio"


class AIModule(StrEnum):
    ICH = "ich"                    # ICH CNN, second reader for head CT
    CXR = "cxr"                    # torchxrayvision, first reader for chest X-ray
    OCR = "ocr"                    # lab sheet values
    STT = "stt"                    # voice -> text
    MEDGEMMA_CT = "medgemma_ct"    # MedGemma head CT JSON
    MEDGEMMA_CXR = "medgemma_cxr"  # MedGemma CXR description + boxes
    MEDGEMMA_LAB = "medgemma_lab"  # MedGemma lab sheet JSON


class DecisionAction(StrEnum):
    CONFIRM = "confirm"
    MODIFY = "modify"
    REJECT_AI = "reject_ai"
