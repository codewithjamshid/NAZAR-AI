"""Real-time queue updates for the panel (TZ §9 WS /ws/queue, §6 F-13).

The browser cannot send an Authorization header on a WebSocket, so the client
sends `{"token": "..."}` as its first message instead of putting the JWT in the
URL. Events arrive from the worker over Redis and are filtered per user.
"""

import asyncio
import json
import logging

import jwt
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.db import SessionLocal
from app.models import User, UserRole
from app.services.events import CHANNEL

log = logging.getLogger(__name__)
router = APIRouter(tags=["ws"])

AUTH_TIMEOUT = 10.0


def _authenticate(token: str) -> tuple[int, str, int | None, str | None] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    with SessionLocal() as db:
        user = db.get(User, int(payload["sub"]))
        if user is None:
            return None
        district = user.facility.district if user.facility else None
        return user.id, user.role, user.facility_id, district


def _visible(event: dict, role: str, facility_id: int | None, district: str | None) -> bool:
    if role in (UserRole.SPECIALIST, UserRole.ADMIN):
        return True
    if role == UserRole.NURSE:
        return event.get("facility_id") == facility_id
    if role == UserRole.OPERATOR:
        return event.get("district") == district
    return False


@router.websocket("/ws/queue")
async def ws_queue(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        first = await asyncio.wait_for(websocket.receive_json(), timeout=AUTH_TIMEOUT)
    except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
        await websocket.close(code=4401)
        return

    identity = _authenticate(str(first.get("token", "")))
    if identity is None:
        await websocket.send_json({"type": "error", "detail": "Token yaroqsiz"})
        await websocket.close(code=4401)
        return
    _, role, facility_id, district = identity
    await websocket.send_json({"type": "ready", "role": role})

    client = aioredis.Redis.from_url(settings.redis_url)
    pubsub = client.pubsub()
    try:
        await pubsub.subscribe(CHANNEL)
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
            if message is None:
                await websocket.send_json({"type": "ping"})
                continue
            try:
                event = json.loads(message["data"])
            except (TypeError, ValueError):
                continue
            if _visible(event, role, facility_id, district):
                await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - one bad socket must not take others down
        log.warning("websocket closed: %s", exc)
    finally:
        try:
            await pubsub.unsubscribe(CHANNEL)
            await pubsub.aclose()
            await client.aclose()
        except Exception:  # noqa: BLE001
            pass
