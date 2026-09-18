"""Re-running the seed must never bring the public demo password back."""

from sqlalchemy import select

from app import models as m
from app import seed
from app.services.auth import hash_password, verify_password


def test_reseeding_keeps_a_changed_password(db):
    seed.seed_reference(db)
    nurse = db.scalar(select(m.User).where(m.User.phone == "+998901000001"))
    assert verify_password("demo1234", nurse.password_hash)       # new user: demo password

    nurse.password_hash = hash_password("Production-Only-1")
    db.flush()
    seed.seed_reference(db)

    nurse = db.scalar(select(m.User).where(m.User.phone == "+998901000001"))
    assert verify_password("Production-Only-1", nurse.password_hash)
    assert not verify_password("demo1234", nurse.password_hash)
