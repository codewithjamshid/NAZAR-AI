from datetime import datetime, timezone

from sqlalchemy import select

from app.db import Base
from app import models as m

EXPECTED_TABLES = {
    "users", "facilities", "patients", "cases", "anamnesis", "studies",
    "ai_results", "triage_results", "decisions", "audit_log",
}


def test_all_tz_tables_registered():
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_case_graph_round_trip(db):
    fap = m.Facility(name="Qorako'l FAP", type=m.FacilityType.FAP, district="Xiva")
    nurse = m.User(full_name="Hamshira", role=m.UserRole.NURSE, phone="+998900000001",
                   password_hash="x", facility=fap)
    doc = m.User(full_name="Nevrolog", role=m.UserRole.SPECIALIST,
                 specialty=m.SpecialistType.NEUROLOGIST, phone="+998900000002",
                 password_hash="x")
    patient = m.Patient(full_name="Test Bemor", birth_year=1968, sex=m.Sex.MALE)
    db.add_all([fap, nurse, doc, patient])
    db.flush()

    case = m.Case(patient=patient, created_by=nurse.id, facility=fap,
                  symptom_onset_at=datetime(2026, 9, 18, 7, 40, tzinfo=timezone.utc))
    case.anamnesis = m.Anamnesis(befast_json={"face": True, "arms": True, "speech": True},
                                 chief_complaint="o'ng qo'l ishlamayapti")
    study = m.Study(case=case, type=m.StudyType.CXR, source=m.StudySource.PHOTO,
                    file_path="cases/1/cxr.png")
    study.ai_results.append(m.AIResult(module=m.AIModule.CXR, output_json={"Pneumonia": 0.84},
                                       confidence=0.84, heatmap_path="cases/1/cxr_cam.png",
                                       model_version="txrv-densenet121-res224-all",
                                       duration_ms=1200))
    case.triage_results.append(m.TriageResult(zone=m.Zone.YELLOW,
                                              specialist_type=m.SpecialistType.THERAPIST,
                                              route=m.Route.DISTRICT,
                                              reasons_json=["CXR: Pneumonia 0.84"],
                                              readers_agree=True, rules_version="draft"))
    case.decisions.append(m.Decision(specialist=doc, action=m.DecisionAction.CONFIRM,
                                     route_final=m.Route.DISTRICT))
    db.add(case)
    db.flush()
    db.add(m.AuditLog(user_id=doc.id, case_id=case.id, action="decision.confirm",
                      payload_json={"route_final": "district"}))
    db.flush()
    db.expire_all()

    loaded = db.scalar(select(m.Case).where(m.Case.id == case.id))
    assert loaded.status == m.CaseStatus.CREATED
    assert loaded.patient.full_name == "Test Bemor"
    assert loaded.anamnesis.befast_json["speech"] is True
    assert loaded.studies[0].ai_results[0].output_json["Pneumonia"] == 0.84
    assert loaded.triage_results[0].zone == "yellow"
    assert loaded.decisions[0].specialist.specialty == "neurologist"
    audit = db.scalars(select(m.AuditLog).where(m.AuditLog.case_id == case.id)).all()
    assert [a.action for a in audit] == ["decision.confirm"]
