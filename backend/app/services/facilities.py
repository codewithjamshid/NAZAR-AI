"""Nearest facility lookup (TZ §9 GET /facilities/nearest)."""

import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Facility

EARTH_RADIUS_KM = 6371.0


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def nearest(db: Session, lat: float | None, lng: float | None, *,
            has_ct: bool = True, limit: int = 3) -> list[dict]:
    if lat is None or lng is None:
        return []
    query = select(Facility).where(Facility.lat.is_not(None), Facility.lng.is_not(None))
    if has_ct:
        query = query.where(Facility.has_ct.is_(True))
    rows = []
    for facility in db.scalars(query):
        rows.append({
            "id": facility.id,
            "name": facility.name,
            "type": facility.type,
            "district": facility.district,
            "has_ct": facility.has_ct,
            "has_xray": facility.has_xray,
            "distance_km": round(distance_km(lat, lng, facility.lat, facility.lng), 1),
        })
    rows.sort(key=lambda row: row["distance_km"])
    return rows[:limit]
