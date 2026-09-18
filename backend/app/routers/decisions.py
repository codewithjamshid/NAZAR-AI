"""Specialist decisions (TZ §6 F-16, F-17, F-18)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CaseStatus, Decision, User, UserRole
from app.schemas.anamnesis import DecisionIn
from app.services import audit, case_view, events
from app.services.auth import get_visible_case, require_roles

router = APIRouter(prefix="/cases", tags=["decisions"])


@router.post("/{case_id}/decision", status_code=status.HTTP_201_CREATED)
def make_decision(
    case_id: int,
    body: DecisionIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SPECIALIST)),
) -> dict:
    """Confirm, change or reject the AI reading. Every decision is audited."""
    case = get_visible_case(db, case_id, user)
    if case.status == CaseStatus.CLOSED:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Holat yopilgan")
    if body.action == "modify" and not body.note:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="O'zgartirish uchun izoh yozing")

    decision = Decision(
        case_id=case.id,
        specialist_id=user.id,
        action=body.action,
        note=body.note,
        route_final=body.route_final or case.route,
    )
    db.add(decision)
    if body.route_final:
        case.route = body.route_final
    case.status = CaseStatus.DECIDED
    db.flush()

    triage = case.triage_results[-1] if case.triage_results else None
    audit.record(
        db, action=f"decision.{body.action}", user_id=user.id, case_id=case.id,
        payload={
            "route_final": decision.route_final,
            "note": body.note,
            "ai_zone": triage.zone if triage else None,
            "rules_version": triage.rules_version if triage else None,
            "model_versions": [
                result.model_version
                for study in case.studies for result in study.ai_results
            ],
        },
    )
    db.commit()
    db.refresh(case)
    events.publish(events.case_event(case, kind="case.decided"))
    return case_view.case_detail(db, case)
