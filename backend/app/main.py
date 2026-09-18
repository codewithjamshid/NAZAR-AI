"""NAZAR AI API entrypoint: FastAPI app, routers, health check."""

from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import app.models  # noqa: F401 - registers tables on Base.metadata
from app.config import settings
from app.db import Base, engine
from app.routers import (
    anamnesis, auth, cases, decisions, facilities, files, meta, patients, queue, stats, studies, ws,
)

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Hackathon MVP: no Alembic, tables are created on startup.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="NAZAR AI API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router, patients.router, cases.router, anamnesis.router, studies.router,
    decisions.router, queue.router, facilities.router, stats.router, meta.router,
    files.router, ws.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/health")
def health() -> dict:
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - report, don't crash
        db_status = f"error: {type(exc).__name__}"

    redis_status = "ok"
    try:
        redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1).ping()
    except Exception as exc:  # noqa: BLE001
        redis_status = f"error: {type(exc).__name__}"

    rules_status = "ok"
    rules_version = None
    try:
        from app.services.rules import load_rules

        rules_version = load_rules()["version"]
    except Exception as exc:  # noqa: BLE001
        rules_status = f"error: {exc}"

    status = "ok" if "ok" == db_status == redis_status == rules_status else "degraded"
    from app.ai import ich
    from app.services import report

    return {
        "status": status,
        "db": db_status,
        "redis": redis_status,
        "rules": rules_status,
        "rules_version": rules_version,
        "medgemma_stub": settings.medgemma_stub,
        "medgemma": _medgemma_status(),
        "ich_second_reader": ich.is_available(),
        "report_llm": f"{settings.llm_provider}/{report.model_name()}"
        if report.llm_enabled() else "template",
    }


def _medgemma_status() -> str:
    """Reachability of the GPU box behind MEDGEMMA_URL (the ngrok link).

    Tries /health (our medgemma-service) and /healthz (other MedGemma servers),
    with the X-API-Key header when one is configured. Never sends images.
    """
    if settings.medgemma_stub:
        return "stub"
    import httpx

    from app.ai.medgemma import service_headers

    base = settings.medgemma_url.rstrip("/")
    last = "no answer"
    for path in ("/health", "/healthz"):
        try:
            response = httpx.get(base + path, headers=service_headers(), timeout=4.0)
        except Exception as exc:  # noqa: BLE001
            return f"unreachable: {type(exc).__name__}"
        if response.status_code == 200:
            try:
                body = response.json()
            except ValueError:
                body = {}
            detail = body.get("device") or body.get("status") or "ok"
            return f"ok ({path}: {detail}, loaded={body.get('loaded', '?')})"
        last = f"{path} HTTP {response.status_code}"
        if response.status_code in (401, 403):
            return f"rejected: {last} — MEDGEMMA_API_KEY?"
    return f"unreachable: {last}"
