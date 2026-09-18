"""Region statistics for the map and the dashboard (TZ §9 GET /stats/region)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Case, Facility, User, UserRole
from app.services.auth import require_roles

router = APIRouter(prefix="/stats", tags=["stats"])


def _aware(value):
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@router.get("/region")
def region_stats(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SPECIALIST, UserRole.ADMIN)),
    days: int = Query(default=1, ge=1, le=30),
) -> dict:
    """Cases per district with average AI and specialist response times."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    districts: dict[str, dict] = {}
    ai_durations: list[int] = []
    response_minutes: list[float] = []
    zone_totals = {"red": 0, "yellow": 0, "green": 0}
    ai_error_count = decision_count = 0

    for case in db.scalars(select(Case)):
        created = _aware(case.created_at)
        if created is None or created < since:
            continue
        facility = case.facility
        district = facility.district if facility else "—"
        bucket = districts.setdefault(
            district,
            {"district": district, "total": 0, "red": 0, "yellow": 0, "green": 0,
             "avg_response_min": None, "lat": None, "lng": None},
        )
        bucket["total"] += 1
        if case.zone in zone_totals:
            bucket[case.zone] += 1
            zone_totals[case.zone] += 1
        if facility and facility.lat and bucket["lat"] is None:
            bucket["lat"], bucket["lng"] = facility.lat, facility.lng

        for study in case.studies:
            for result in study.ai_results:
                if result.duration_ms:
                    ai_durations.append(result.duration_ms)

        if case.decisions:
            decision_count += 1
            decided = _aware(case.decisions[0].decided_at)
            if decided:
                minutes = (decided - created).total_seconds() / 60
                response_minutes.append(minutes)
                bucket.setdefault("_response", []).append(minutes)
            ai_error_count += sum(1 for d in case.decisions if d.action == "reject_ai")

    for bucket in districts.values():
        values = bucket.pop("_response", [])
        bucket["avg_response_min"] = round(sum(values) / len(values), 1) if values else None

    return {
        "days": days,
        "districts": sorted(districts.values(), key=lambda row: -row["total"]),
        "totals": {
            "cases": sum(row["total"] for row in districts.values()),
            **zone_totals,
            "avg_ai_ms": round(sum(ai_durations) / len(ai_durations)) if ai_durations else None,
            "avg_response_min": round(sum(response_minutes) / len(response_minutes), 1)
            if response_minutes else None,
            "ai_error_rate": round(ai_error_count / decision_count, 3) if decision_count else None,
            "decisions": decision_count,
        },
    }
