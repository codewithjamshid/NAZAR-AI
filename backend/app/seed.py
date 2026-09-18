"""Load demo facilities, users and cases from demo-data/ (idempotent).

    python -m app.seed            # facilities + users only
    python -m app.seed --cases    # also build the demo cases and run the AI on them
    python -m app.seed --reset    # drop and recreate the schema first

Demo values live in demo-data/, never in application code (CLAUDE.md).
"""

import argparse
import json
import shutil
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

import app.models  # noqa: F401
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import (
    Anamnesis, Case, Facility, Patient, Study, StudyStatus, User,
)
from app.services.auth import hash_password


def _load(name: str):
    return json.loads((settings.demo_data_path / name).read_text(encoding="utf-8"))


def seed_reference(db) -> tuple[dict[str, int], int]:
    facilities = _load("facilities.json")
    users = _load("users.json")

    facility_ids: dict[str, int] = {}
    for item in facilities:
        fields = {key: value for key, value in item.items() if key != "key"}
        row = db.scalar(select(Facility).where(Facility.name == item["name"]))
        if row is None:
            row = Facility(**fields)
            db.add(row)
        else:
            for key, value in fields.items():
                setattr(row, key, value)
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
            for key, value in fields.items():
                setattr(row, key, value)
    db.commit()
    return facility_ids, len(users)


def seed_cases(db) -> list[dict]:
    """Create the demo cases through the real pipeline, so the AI actually runs."""
    from app.ai.medgemma import cache_key
    from app.services import storage
    from app.services.triage import commit_triage, triage_case
    from app.workers.tasks import process_study

    created = []
    for item in _load("cases.json"):
        nurse = db.scalar(select(User).where(User.phone == item["nurse_phone"]))
        if nurse is None:
            raise SystemExit(f"seed users first: {item['nurse_phone']} topilmadi")

        spec = item["patient"]
        patient = db.scalar(select(Patient).where(Patient.phone == spec["phone"]))
        if patient is None:
            patient = Patient(**spec)
            db.add(patient)
            db.flush()

        existing = db.scalar(
            select(Case).where(Case.patient_id == patient.id).order_by(Case.id.desc())
        )
        if existing is not None:
            created.append({"key": item["key"], "case_id": existing.id, "zone": existing.zone,
                            "skipped": True})
            continue

        onset = None
        if item.get("onset_minutes_ago") is not None:
            onset = datetime.now(timezone.utc) - timedelta(minutes=item["onset_minutes_ago"])
        case = Case(patient_id=patient.id, created_by=nurse.id,
                    facility_id=nurse.facility_id, symptom_onset_at=onset)
        db.add(case)
        db.flush()

        db.add(Anamnesis(
            case_id=case.id,
            befast_json=item.get("befast"),
            structured_json={"flags": item.get("flags", {})},
            chief_complaint=item.get("chief_complaint"),
        ))
        db.flush()

        study_ids = []
        for spec_study in item.get("studies", []):
            source_file = settings.demo_data_path / spec_study["file"]
            rel_path = f"cases/{case.id}/{spec_study['type']}{source_file.suffix}"
            target = storage.absolute(rel_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(source_file, target)
            study = Study(case_id=case.id, type=spec_study["type"], file_path=rel_path,
                          source="photo" if source_file.suffix != ".dcm" else "dicom",
                          status=StudyStatus.QUEUED, cache_key=cache_key(target))
            db.add(study)
            db.flush()
            study_ids.append(study.id)

        triage_case(db, case)
        commit_triage(db, case)

        for study_id in study_ids:
            process_study(study_id)      # run inline: seeding should be deterministic

        db.expire_all()
        case = db.get(Case, case.id)
        created.append({"key": item["key"], "case_id": case.id, "zone": case.zone,
                        "specialist": case.specialist_type, "status": case.status})
    return created


def run(*, with_cases: bool = False, reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        facility_ids, user_count = seed_reference(db)
        print(f"seeded {len(facility_ids)} facilities, {user_count} users")
        if with_cases:
            for row in seed_cases(db):
                if row.get("skipped"):
                    print(f"  case {row['key']}: already present (#{row['case_id']})")
                else:
                    print(f"  case {row['key']}: #{row['case_id']} "
                          f"{str(row['zone']).upper()} -> {row['specialist']} ({row['status']})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo data")
    parser.add_argument("--cases", action="store_true", help="also create the demo cases")
    parser.add_argument("--reset", action="store_true", help="drop and recreate the schema")
    args = parser.parse_args()
    run(with_cases=args.cases, reset=args.reset)
