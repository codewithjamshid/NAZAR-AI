"""NAZAR AI API entrypoint: FastAPI app, routers, health check."""

from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI
from sqlalchemy import text

import app.models  # noqa: F401 - registers tables on Base.metadata
from app.config import settings
from app.db import Base, engine
from app.routers import auth, cases, patients, studies

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Hackathon MVP: no Alembic, tables are created on startup.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="NAZAR AI API", version="0.1.0", lifespan=lifespan)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(patients.router, prefix=API_PREFIX)
app.include_router(cases.router, prefix=API_PREFIX)
app.include_router(studies.router, prefix=API_PREFIX)


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

    status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return {
        "status": status,
        "db": db_status,
        "redis": redis_status,
        "medgemma_stub": settings.medgemma_stub,
    }
