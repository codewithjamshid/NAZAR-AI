"""Load demo facilities and users from demo-data/ (idempotent). Run: python -m app.seed"""

import json

from sqlalchemy import select

import app.models  # noqa: F401
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import Facility, User
from app.services.auth import hash_password


def run() -> None:
    Base.metadata.create_all(engine)
    facilities = json.loads((settings.demo_data_path / "facilities.json").read_text())
    users = json.loads((settings.demo_data_path / "users.json").read_text())

    with SessionLocal() as db:
        facility_ids: dict[str, int] = {}
        for item in facilities:
            fields = {k: v for k, v in item.items() if k != "key"}
            row = db.scalar(select(Facility).where(Facility.name == item["name"]))
            if row is None:
                row = Facility(**fields)
                db.add(row)
            else:
                for k, v in fields.items():
                    setattr(row, k, v)
            db.flush()
            facility_ids[item["key"]] = row.id

        for item in users:
            fields = {
                "full_name": item["full_name"],
                "role": item["role"],
                "specialty": item.get("specialty"),
                "phone": item["phone"],
                "facility_id": facility_ids.get(item.get("facility")),
                "password_hash": hash_password(item["password"]),
            }
            row = db.scalar(select(User).where(User.phone == item["phone"]))
            if row is None:
                db.add(User(**fields))
            else:
                for k, v in fields.items():
                    setattr(row, k, v)
        db.commit()
    print(f"seeded {len(facilities)} facilities, {len(users)} users")


if __name__ == "__main__":
    run()
