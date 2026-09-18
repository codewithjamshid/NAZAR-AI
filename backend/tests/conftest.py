import os

# Tests never touch the demo database: the running stack commits to `nazar`
# while pytest runs, which made two tests flaky and put test cases on the
# specialist's live panel. Must be set before anything imports app.config.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://nazar:nazar@localhost:5432/nazar_test"
)

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.db import Base, engine


@pytest.fixture
def db():
    """Session bound to an outer transaction that is rolled back after the test."""
    try:
        Base.metadata.create_all(engine)
        conn = engine.connect()
    except OperationalError as exc:
        pytest.skip(f"database not reachable: {exc.orig}")
    trans = conn.begin()
    session = Session(bind=conn)
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()


@pytest.fixture(autouse=True)
def no_celery(monkeypatch):
    """Tests never hand work to a real broker; the pipeline is tested directly."""
    from app.workers import tasks

    monkeypatch.setattr(tasks.process_study, "delay", lambda *a, **k: None)
    monkeypatch.setattr(tasks.write_report, "delay", lambda *a, **k: None)
    monkeypatch.setattr(tasks.write_report, "apply_async", lambda *a, **k: None)


@pytest.fixture(autouse=True)
def no_cloud_llm(monkeypatch):
    """.env may hold a real LLM key; tests never spend it. LLM tests opt back in."""
    from app.config import settings

    monkeypatch.setattr(settings, "llm_api_key", "")


@pytest.fixture(autouse=True)
def no_live_events(monkeypatch):
    """Keep test cases off the WebSocket that the live panel listens to."""
    from app.services import events

    monkeypatch.setattr(events, "publish", lambda *a, **k: None)
