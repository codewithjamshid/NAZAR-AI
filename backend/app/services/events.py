"""Real-time events between the worker and the panel (TZ §9 WS /ws/queue).

The Celery worker is a separate process, so updates travel over a Redis
pub/sub channel that the API relays to connected WebSocket clients.
"""

import json
import logging

import redis

from app.config import settings

log = logging.getLogger(__name__)

CHANNEL = "nazar:events"


def publish(event: dict) -> None:
    """Fire-and-forget: a missing Redis must never fail a medical write."""
    try:
        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1)
        client.publish(CHANNEL, json.dumps(event, ensure_ascii=False, default=str))
    except Exception as exc:  # noqa: BLE001
        log.warning("event publish failed: %s", exc)


def case_event(case, kind: str = "case.updated") -> dict:
    facility = case.facility
    return {
        "type": kind,
        "case_id": case.id,
        "status": case.status,
        "zone": case.zone,
        "specialist_type": case.specialist_type,
        "facility_id": case.facility_id,
        "district": facility.district if facility else None,
    }
