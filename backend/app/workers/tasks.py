"""Celery application and background tasks (AI processing is added in step 7)."""

from celery import Celery

from app.config import settings

celery_app = Celery("nazar", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    task_track_started=True,
    # macOS + Python 3.11 breaks billiard's prefork pool ("not enough values to
    # unpack" in fast_trace_task). Threads also let the AI modules keep one
    # loaded model per process instead of one per forked child.
    worker_pool="threads",
    worker_concurrency=2,
)


@celery_app.task(name="ping")
def ping() -> str:
    return "pong"
