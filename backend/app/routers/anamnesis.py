"""Anamnesis, BE-FAST and lab confirmation (TZ §6 F-02, F-03, F-06)."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Anamnesis, StudyType, User, UserRole
from app.schemas.anamnesis import AnamnesisIn, LabValuesIn
from app.services import audit, case_view, events
from app.services.auth import get_visible_case, require_roles
from app.services.triage import triage_case

router = APIRouter(prefix="/cases", tags=["anamnesis"])


def _anamnesis_for(db: Session, case) -> Anamnesis:
    if case.anamnesis is None:
        case.anamnesis = Anamnesis(case_id=case.id)
        db.add(case.anamnesis)
        db.flush()
    return case.anamnesis


@router.post("/{case_id}/anamnesis")
def save_anamnesis(
    case_id: int,
    body: AnamnesisIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE, UserRole.OPERATOR)),
) -> dict:
    """Save the questionnaire and re-run triage immediately (the nurse waits for it)."""
    case = get_visible_case(db, case_id, user)
    anamnesis = _anamnesis_for(db, case)

    befast = body.cleaned_befast()
    if befast is not None:
        anamnesis.befast_json = befast
    if body.chief_complaint is not None:
        anamnesis.chief_complaint = body.chief_complaint
    if body.voice_transcript is not None:
        anamnesis.voice_transcript = body.voice_transcript
    structured = dict(anamnesis.structured_json or {})
    structured["flags"] = body.cleaned_flags()
    anamnesis.structured_json = structured

    audit.record(db, action="anamnesis.save", user_id=user.id, case_id=case.id,
                 payload={"befast": befast, "flags": structured["flags"]})
    triage_case(db, case, actor_user_id=user.id)
    db.commit()
    db.refresh(case)
    events.publish(events.case_event(case))
    return case_view.case_detail(db, case)


@router.post("/{case_id}/labs")
def confirm_labs(
    case_id: int,
    body: LabValuesIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE, UserRole.OPERATOR)),
) -> dict:
    """The nurse checks the OCR table before the values count (TZ §7 M5)."""
    case = get_visible_case(db, case_id, user)
    anamnesis = _anamnesis_for(db, case)
    structured = dict(anamnesis.structured_json or {})
    structured["labs"] = {name: float(value) for name, value in body.values.items()}
    anamnesis.structured_json = structured

    audit.record(db, action="labs.confirm", user_id=user.id, case_id=case.id,
                 payload={"values": structured["labs"]})
    triage_case(db, case, actor_user_id=user.id)
    db.commit()
    db.refresh(case)
    events.publish(events.case_event(case))
    return case_view.case_detail(db, case)


@router.post("/{case_id}/voice", status_code=status.HTTP_201_CREATED)
def upload_voice(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE, UserRole.OPERATOR)),
) -> dict:
    """Voice note -> STT -> transcript. Falls back to the text field (TZ §15 R6)."""
    from app.routers.studies import store_and_enqueue

    case = get_visible_case(db, case_id, user)
    study = store_and_enqueue(db, case, user, StudyType.VOICE, file)
    return case_view.study_view(study)
