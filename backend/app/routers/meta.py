"""Clinical constants for the interfaces (BE-FAST points, stroke window)."""

from fastapi import APIRouter, Depends

from app.models import User
from app.services import case_view
from app.services.auth import get_current_user

router = APIRouter(tags=["meta"])


@router.get("/meta")
def meta(user: User = Depends(get_current_user)) -> dict:
    """Thresholds come from rules/triage.yaml so no screen hard-codes them."""
    return case_view.meta()
