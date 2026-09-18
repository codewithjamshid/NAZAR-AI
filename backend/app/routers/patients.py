from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Patient, User, UserRole
from app.schemas.patients import PatientCreate, PatientOut
from app.services import audit
from app.services.auth import require_roles

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE)),
) -> Patient:
    patient = Patient(**body.model_dump())
    db.add(patient)
    db.flush()
    audit.record(db, action="patient.create", user_id=user.id, payload={"patient_id": patient.id})
    db.commit()
    db.refresh(patient)
    return patient
