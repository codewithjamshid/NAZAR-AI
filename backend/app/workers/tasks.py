"""Celery application and the AI pipeline (TZ §5, §7).

One task per uploaded study. Each reader writes its own `ai_results` row, the
triage engine runs after every reader so the panel updates as results arrive,
and a module that is simply not configured (ICH weights, MedGemma stub without a
cached reading) is recorded as absent rather than as a failure.
"""

import logging
from pathlib import Path

from celery import Celery

from app.config import settings

log = logging.getLogger(__name__)

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


def _study_dir(case_id: int, study_id: int) -> str:
    return f"cases/{case_id}/study_{study_id}"


def _record(db, study, module: str, *, output=None, confidence=None,
            heatmap=None, model_version="", duration_ms=None, error=None):
    from app.models import AIResult

    row = AIResult(
        study_id=study.id,
        module=module,
        output_json=output,
        confidence=confidence,
        heatmap_path=heatmap,
        model_version=model_version,
        duration_ms=duration_ms,
        error=error,
    )
    db.add(row)
    db.flush()
    return row


def _run_cxr(db, study, abs_path: Path, rel_dir: str) -> bool:
    from app.ai import cxr
    from app.services import storage

    heatmap_rel = f"{rel_dir}/cxr_heatmap.png"
    view_rel = f"{rel_dir}/cxr_view.png"
    try:
        result = cxr.analyze(abs_path, storage.absolute(heatmap_rel), storage.absolute(view_rel))
    except Exception as exc:  # noqa: BLE001 - the module owns its failure
        log.exception("CXR module failed for study %s", study.id)
        _record(db, study, "cxr", model_version=cxr.MODEL_VERSION, error=str(exc)[:500])
        return False

    payload = result.to_output_json()
    payload["view_path"] = view_rel if result.view_path else None
    _record(
        db, study, "cxr",
        output=payload,
        confidence=result.confidence,
        heatmap=heatmap_rel if result.heatmap_path else None,
        model_version=result.model_version,
        duration_ms=result.duration_ms,
    )
    return True


def _run_medgemma(db, study, task: str, module: str, images: list[Path]) -> bool:
    from app.ai import medgemma

    try:
        result = medgemma.infer(task, images, study.cache_key or "")
    except medgemma.MedGemmaUnavailable as exc:
        # Not configured / no cached reading: the reader is absent, not broken.
        log.info("MedGemma %s unavailable for study %s: %s", task, study.id, exc)
        return False
    except medgemma.MedGemmaError as exc:
        log.warning("MedGemma %s failed for study %s: %s", task, study.id, exc)
        _record(db, study, module, model_version=settings.medgemma_model, error=str(exc)[:500])
        return False

    confidence_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
    _record(
        db, study, module,
        output=result.reading,
        confidence=confidence_map.get(result.reading.get("confidence"), None),
        model_version=result.model_version,
        duration_ms=result.duration_ms,
    )
    return True


def _run_ich(db, study, slice_paths: list[Path], rel_dir: str) -> bool:
    from app.ai import ich
    from app.services import storage

    if not ich.is_available():
        log.info("ICH second reader not configured; MedGemma reads study %s alone", study.id)
        return False
    heatmap_rel = f"{rel_dir}/ich_heatmap.png"
    try:
        result = ich.analyze(slice_paths, storage.absolute(heatmap_rel))
    except ich.ICHUnavailable as exc:
        log.info("ICH second reader unavailable: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        log.exception("ICH module failed for study %s", study.id)
        _record(db, study, "ich", model_version=ich.MODEL_VERSION_PREFIX, error=str(exc)[:500])
        return False

    _record(
        db, study, "ich",
        output={"probability": result.probability, "key_slice": result.key_slice},
        confidence=result.probability,
        heatmap=heatmap_rel if result.heatmap_path else None,
        model_version=result.model_version,
        duration_ms=result.duration_ms,
    )
    return True


def _process(db, study) -> bool:
    """Run every reader for one study. Returns True if anything was read."""
    from app.ai import preprocess
    from app.models import StudyType
    from app.services import storage

    abs_path = storage.absolute(study.file_path)
    rel_dir = _study_dir(study.case_id, study.id)
    produced = False

    if study.type == StudyType.CXR:
        produced |= _run_cxr(db, study, abs_path, rel_dir)
        try:
            png = preprocess.as_png(abs_path, storage.absolute(f"{rel_dir}/cxr_source.png"))
            produced |= _run_medgemma(db, study, "cxr", "medgemma_cxr", [png])
        except preprocess.PreprocessError as exc:
            log.warning("CXR preprocessing for MedGemma failed: %s", exc)

    elif study.type == StudyType.CT_HEAD:
        try:
            slices = preprocess.write_ct_slice_pngs(
                abs_path, storage.absolute(f"{rel_dir}/slices"), settings.ct_viewer_max_slices
            )
        except preprocess.PreprocessError as exc:
            log.warning("CT preprocessing failed for study %s: %s", study.id, exc)
            _record(db, study, "medgemma_ct", model_version=settings.medgemma_model,
                    error=f"KT seriyasi o'qilmadi: {exc}"[:500])
            return False
        for_model = preprocess.sample_slice_paths(slices, settings.medgemma_ct_slices)
        produced |= _run_medgemma(db, study, "ct_head", "medgemma_ct", for_model)
        produced |= _run_ich(db, study, slices, rel_dir)

    elif study.type == StudyType.LAB_PHOTO:
        try:
            png = preprocess.as_png(abs_path, storage.absolute(f"{rel_dir}/lab_source.png"))
            produced |= _run_medgemma(db, study, "lab", "medgemma_lab", [png])
        except preprocess.PreprocessError as exc:
            log.warning("Lab photo preprocessing failed: %s", exc)

    elif study.type == StudyType.VOICE:
        from app.ai import stt

        case = study.case
        names = [case.patient.full_name] if case.patient else []
        try:
            result = stt.transcribe(abs_path, patient_names=names)
        except stt.STTUnavailable as exc:
            log.info("STT unavailable for study %s: %s", study.id, exc)
            study.error = str(exc)[:500]
        except Exception as exc:  # noqa: BLE001
            log.exception("STT failed for study %s", study.id)
            _record(db, study, "stt", model_version=settings.stt_provider, error=str(exc)[:500])
        else:
            _record(db, study, "stt",
                    output={"text": result.text, "language": result.language,
                            "card": result.card, "name_redacted": result.redacted,
                            "audio_seconds": result.audio_seconds},
                    confidence=result.confidence, model_version=result.model_version,
                    duration_ms=result.duration_ms)
            produced = True
            from app.models import Anamnesis

            if case.anamnesis is None:
                case.anamnesis = Anamnesis(case_id=case.id)
                db.add(case.anamnesis)
            case.anamnesis.voice_transcript = result.text
            structured = dict(case.anamnesis.structured_json or {})
            # Informational only: the card's "onset" never moves the case's timer.
            structured["voice_card"] = result.card
            case.anamnesis.structured_json = structured

    return produced


@celery_app.task(name="process_study")
def process_study(study_id: int) -> dict:
    """Read one uploaded study, then re-run triage for its case (TZ §5)."""
    from app.db import SessionLocal
    from app.models import Study, StudyStatus
    from app.services.triage import commit_triage, triage_case

    with SessionLocal() as db:
        study = db.get(Study, study_id)
        if study is None:
            return {"study_id": study_id, "status": "missing"}

        study.status = StudyStatus.PROCESSING
        db.commit()

        try:
            produced = _process(db, study)
            study.status = StudyStatus.DONE if produced else StudyStatus.FAILED
            if not produced:
                study.error = "Hech bir AI moduli natija bermadi"
        except Exception as exc:  # noqa: BLE001 - never leave a study stuck
            log.exception("process_study failed for %s", study_id)
            study.status = StudyStatus.FAILED
            study.error = str(exc)[:500]

        case = study.case
        triage_case(db, case)
        commit_triage(db, case)
        return {"study_id": study_id, "status": study.status, "zone": case.zone}


def upgrade_report(db, triage_id: int) -> dict:
    """Replace a triage row's template text with the cloud model's, if it passes the guard.

    Raises `report.RateLimited` so the Celery task can try again later; every
    other failure keeps the template that is already stored.
    """
    from app.models import TriageResult
    from app.services import events, report

    row = db.get(TriageResult, triage_id)
    if row is None:
        return {"triage_id": triage_id, "status": "missing"}
    if not report.llm_enabled():
        return {"triage_id": triage_id, "status": "skipped"}

    case = row.case
    newest = max((result.id for result in case.triage_results), default=row.id)
    if row.id != newest:
        # A later triage replaced this one; the free-tier quota is too small to
        # spend on text nobody will read.
        return {"triage_id": triage_id, "status": "superseded"}
    try:
        nurse, specialist, model = report.llm_report(report.report_context(case, row))
    except report.RateLimited:
        raise
    except Exception as exc:  # noqa: BLE001 - the template is already stored
        log.warning("LLM report for triage %s kept the template: %s", triage_id, exc)
        return {"triage_id": triage_id, "status": "template_kept", "reason": str(exc)[:200]}

    row.summary_nurse, row.summary_specialist, row.report_model = nurse, specialist, model
    db.commit()
    events.publish(events.case_event(case, kind="case.report"))
    return {"triage_id": triage_id, "status": "ok", "report_model": model}


REPORT_RETRY_DELAYS = (20, 40, 60, 90)   # seconds; the free tier quota is per minute


@celery_app.task(name="write_report", bind=True, max_retries=len(REPORT_RETRY_DELAYS))
def write_report(self, triage_id: int) -> dict:
    """Upgrade one triage summary with the cloud LLM (TZ §7 M7)."""
    from app.db import SessionLocal
    from app.services import report

    with SessionLocal() as db:
        try:
            return upgrade_report(db, triage_id)
        except report.RateLimited as exc:
            if self.request.retries >= len(REPORT_RETRY_DELAYS):
                log.warning("LLM report for triage %s: quota still exhausted, template kept",
                            triage_id)
                return {"triage_id": triage_id, "status": "template_kept", "reason": "429"}
            delay = REPORT_RETRY_DELAYS[self.request.retries]
            log.info("LLM report for triage %s rate limited, retrying in %ss", triage_id, delay)
            raise self.retry(exc=exc, countdown=delay)
