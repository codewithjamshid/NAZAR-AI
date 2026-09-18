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
