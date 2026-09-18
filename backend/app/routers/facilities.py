"""Facility lookup (TZ §9 GET /facilities/nearest)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Facility, User
from app.services import facilities
from app.services.auth import get_current_user

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("/nearest")
def nearest_facility(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    has_ct: bool = Query(default=True),
    limit: int = Query(default=3, le=10),
) -> list[dict]:
    """Nearest facility with a CT scanner; defaults to the caller's own facility."""
    if lat is None or lng is None:
        origin = user.facility
        if origin is not None:
            lat, lng = origin.lat, origin.lng
    return facilities.nearest(db, lat, lng, has_ct=has_ct, limit=limit)


@router.get("")
def list_facilities(db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)) -> list[dict]:
    return [{
        "id": row.id, "name": row.name, "type": row.type, "district": row.district,
        "lat": row.lat, "lng": row.lng, "has_ct": row.has_ct, "has_xray": row.has_xray,
    } for row in db.scalars(select(Facility).order_by(Facility.district, Facility.name))]
