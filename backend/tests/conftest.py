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
