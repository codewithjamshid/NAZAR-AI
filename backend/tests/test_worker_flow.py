"""The AI pipeline end to end: upload -> readers -> triage (TZ §5, §7)."""

import shutil

import pytest

from app import models as m
from app.config import settings
from app.services.auth import hash_password
from app.services.triage import triage_case
from app.workers import tasks

CXR_SAMPLE = settings.demo_data_path / "cxr" / "00000001_000.png"

pytestmark = pytest.mark.skipif(not CXR_SAMPLE.is_file(), reason="demo CXR sample missing")


@pytest.fixture
def storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_path", tmp_path)
    return tmp_path


@pytest.fixture
def case_with_cxr(db, storage_dir):
    facility = m.Facility(name="FAP", type="fap", district="Hazorasp")
    nurse = m.User(full_name="N", role="nurse", phone="+70", password_hash=hash_password("x"),
                   facility=facility)
    patient = m.Patient(full_name="P", birth_year=1980, sex="female")
    db.add_all([facility, nurse, patient])
    db.flush()

    case = m.Case(patient=patient, created_by=nurse.id, facility=facility)
    db.add(case)
    db.flush()

    rel_path = f"cases/{case.id}/cxr.png"
    target = storage_dir / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(CXR_SAMPLE, target)

    study = m.Study(case_id=case.id, type="cxr", source="photo", file_path=rel_path,
                    status="queued", cache_key="sha256-not-in-cache")
    db.add(study)
    db.flush()
    return case, study


def test_pipeline_reads_the_xray_and_writes_a_heatmap(db, case_with_cxr, storage_dir):
    case, study = case_with_cxr

    produced = tasks._process(db, study)
    assert produced is True

    results = {row.module: row for row in study.ai_results}
    cnn = results["cxr"]
    assert cnn.error is None
    assert len(cnn.output_json["probabilities"]) == 18
    assert cnn.model_version.startswith("torchxrayvision-")
    assert 0.0 <= cnn.confidence <= 1.0
    assert cnn.duration_ms > 0
    assert (storage_dir / cnn.heatmap_path).is_file()
    assert (storage_dir / cnn.output_json["view_path"]).is_file()


def test_medgemma_without_a_cached_reading_is_absent_not_failed(db, case_with_cxr):
    """A stub miss means "no second reader", not a broken module (TZ §7)."""
    case, study = case_with_cxr
    tasks._process(db, study)

    assert "medgemma_cxr" not in {row.module for row in study.ai_results}


def test_triage_runs_after_the_readers_and_moves_the_case(db, case_with_cxr):
    case, study = case_with_cxr
    tasks._process(db, study)
    study.status = "done"

    result = triage_case(db, case)

    assert result.zone in ("red", "yellow", "green")
    assert result.reasons_json
    assert result.summary_nurse and result.summary_specialist
    assert result.report_model == "template-v1"
    assert case.zone == result.zone
    assert case.status == m.CaseStatus.TRIAGED
    assert any(row.action == "triage.computed" for row in db.query(m.AuditLog).all())


def test_unreadable_file_is_recorded_as_a_failure(db, case_with_cxr, storage_dir):
    case, study = case_with_cxr
    (storage_dir / study.file_path).write_bytes(b"not an image at all")

    produced = tasks._process(db, study)
    study.status = "failed" if not produced else "done"

    assert produced is False
    cnn = next(row for row in study.ai_results if row.module == "cxr")
    assert cnn.error

    result = triage_case(db, case)
    assert result.zone == "yellow"          # never green on a failure
    assert "ai_failed" in result.signals_json
    assert case.status == m.CaseStatus.AI_FAILED
