from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Case, Patient, User, UserRole
from app.schemas.cases import CaseCreate, CaseDetail, CaseOut
from app.services import audit
from app.services.auth import get_current_user, get_visible_case, require_roles

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    body: CaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE)),
) -> Case:
    if user.facility_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Foydalanuvchi muassasaga biriktirilmagan")
    if db.get(Patient, body.patient_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bemor topilmadi")
    case = Case(
        patient_id=body.patient_id,
        created_by=user.id,
        facility_id=user.facility_id,
        symptom_onset_at=body.symptom_onset_at,
    )
    db.add(case)
    db.flush()
    audit.record(
        db, action="case.create", user_id=user.id, case_id=case.id,
        payload={"symptom_onset_at": body.symptom_onset_at.isoformat() if body.symptom_onset_at else None},
    )
    db.commit()
    db.refresh(case)
    return case


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Case:
    return get_visible_case(db, case_id, user)
