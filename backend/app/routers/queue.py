"""Sorted specialist queue (TZ §6 F-12, §9 GET /queue)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Case, CaseStatus, User, UserRole
from app.services import case_view
from app.services.auth import case_visible_to, require_roles

router = APIRouter(tags=["queue"])

ZONE_ORDER = {"red": 0, "yellow": 1, "green": 2, None: 3}
OPEN_STATUSES = (
    CaseStatus.PROCESSING, CaseStatus.TRIAGED, CaseStatus.AI_FAILED, CaseStatus.IN_REVIEW,
)


@router.get("/queue")
def get_queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SPECIALIST, UserRole.ADMIN)),
    mine: bool = Query(default=False, description="faqat mening mutaxassisligim"),
    include_decided: bool = Query(default=False),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    """Red first, then yellow, then green; oldest waits first inside a zone."""
    statuses = list(OPEN_STATUSES)
    if include_decided:
        statuses += [CaseStatus.DECIDED, CaseStatus.CLOSED]
    query = select(Case).where(Case.status.in_(statuses)).order_by(Case.created_at)
    cases = [case for case in db.scalars(query) if case_visible_to(case, user)]
    if mine and user.specialty:
        cases = [case for case in cases if case.specialist_type == user.specialty]
    cases.sort(key=lambda case: (ZONE_ORDER.get(case.zone, 3), case.created_at))
    return [case_view.queue_item(case) for case in cases[:limit]]
