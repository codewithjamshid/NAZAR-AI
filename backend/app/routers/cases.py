"""Cases: create, list, open, decide-ready view and close (TZ §6, §9)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Case, CaseStatus, Patient, User, UserRole
from app.schemas.cases import CaseCreate, CaseOut
from app.services import audit, case_view, events
from app.services.auth import case_visible_to, get_current_user, get_visible_case, require_roles
from app.services.triage import commit_triage, triage_case

router = APIRouter(prefix="/cases", tags=["cases"])

OPEN_STATUSES = (
    CaseStatus.PROCESSING, CaseStatus.TRIAGED, CaseStatus.AI_FAILED, CaseStatus.IN_REVIEW,
)


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    body: CaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE)),
) -> Case:
    if user.facility_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Foydalanuvchi muassasaga biriktirilmagan")
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
        payload={"symptom_onset_at": body.symptom_onset_at.isoformat()
                 if body.symptom_onset_at else None},
    )
    db.commit()
    db.refresh(case)
    return case


@router.get("")
def list_cases(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    q: str | None = Query(default=None, description="case id yoki bemor telefoni"),
    limit: int = Query(default=50, le=200),
) -> list[dict]:
    """Today's cases for the nurse app; `q` is the operator's search (F-10)."""
    query = select(Case).order_by(Case.created_at.desc()).limit(limit)
    if q:
        conditions = [Patient.phone == q]
        if q.isdigit():
            conditions.append(Case.id == int(q))
        query = query.join(Patient, Case.patient_id == Patient.id).where(or_(*conditions))
    cases = [case for case in db.scalars(query) if case_visible_to(case, user)]
    return [case_view.queue_item(case) for case in cases]


@router.get("/{case_id}")
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    case = get_visible_case(db, case_id, user)
    return case_view.case_detail(db, case)


@router.post("/{case_id}/open")
def open_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SPECIALIST, UserRole.ADMIN)),
) -> dict:
    """The specialist opened the case: it leaves the unseen queue (TZ §9 in_review)."""
    case = get_visible_case(db, case_id, user)
    if case.status in OPEN_STATUSES and case.status != CaseStatus.IN_REVIEW:
        case.status = CaseStatus.IN_REVIEW
        audit.record(db, action="case.open", user_id=user.id, case_id=case.id)
        db.commit()
        db.refresh(case)
        events.publish(events.case_event(case))
    return case_view.case_detail(db, case)


@router.post("/{case_id}/triage")
def recompute_triage(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Re-run the rules, e.g. after the neurosurgeon edits rules/triage.yaml."""
    case = get_visible_case(db, case_id, user)
    triage_case(db, case, actor_user_id=user.id)
    commit_triage(db, case)
    return case_view.case_detail(db, case)


@router.post("/{case_id}/close")
def close_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """A case closes only after a specialist decision (TZ §11)."""
    case = get_visible_case(db, case_id, user)
    if not case.decisions:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Holat mutaxassis qarorisiz yopilmaydi",
        )
    case.status = CaseStatus.CLOSED
    case.closed_at = datetime.now(timezone.utc)
    audit.record(db, action="case.close", user_id=user.id, case_id=case.id)
    db.commit()
    db.refresh(case)
    events.publish(events.case_event(case))
    return case_view.case_detail(db, case)
