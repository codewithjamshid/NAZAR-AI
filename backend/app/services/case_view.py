"""Response builders for the nurse app and the specialist panel.

Keeps image URLs signed and short-lived (TZ §11) and puts the stroke timer and
the AI disclaimer next to every result (TZ §12).
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import AIModule, StudyType
from app.services import facilities, files
from app.services.rules import load_rules

AI_DISCLAIMER = "Dastlabki tahlil. Shifokor tasdig'i talab qilinadi."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _ai_result_view(result) -> dict:
    return {
        "id": result.id,
        "module": result.module,
        "output": result.output_json,
        "confidence": result.confidence,
        "model_version": result.model_version,
        "duration_ms": result.duration_ms,
        "error": result.error,
        "heatmap_url": files.sign(result.heatmap_path),
        "processed_at": result.processed_at,
    }


def _images(study, results: dict) -> dict:
    """What the viewer shows: aligned base images plus the heatmap layer."""
    from app.services import storage

    if study.type == StudyType.CXR:
        cnn = results.get(AIModule.CXR)
        view_path = (cnn.output_json or {}).get("view_path") if cnn and cnn.output_json else None
        base = files.sign(view_path) or files.sign(study.file_path)
        return {
            "kind": "cxr",
            "base": [base] if base else [],
            "heatmap": [files.sign(cnn.heatmap_path)] if cnn and cnn.heatmap_path else [],
            "key_index": 0,
        }

    if study.type == StudyType.CT_HEAD:
        slice_dir = storage.absolute(f"cases/{study.case_id}/study_{study.id}/slices")
        names = sorted(path.name for path in slice_dir.glob("slice_*.png")) if slice_dir.is_dir() else []
        base = [files.sign(f"cases/{study.case_id}/study_{study.id}/slices/{name}") for name in names]
        medgemma = results.get(AIModule.MEDGEMMA_CT)
        ich = results.get(AIModule.ICH)
        key_index = None
        for source in (ich, medgemma):
            if source and source.output_json:
                key_index = source.output_json.get("key_slice")
                if key_index is not None:
                    break
        return {
            "kind": "ct",
            "base": base,
            "heatmap": [files.sign(ich.heatmap_path)] if ich and ich.heatmap_path else [],
            "key_index": key_index if key_index is not None else (len(base) // 2 if base else 0),
        }

    return {"kind": study.type, "base": [files.sign(study.file_path)], "heatmap": [], "key_index": 0}


def study_view(study) -> dict:
    latest = {result.module: result for result in study.ai_results}
    return {
        "id": study.id,
        "case_id": study.case_id,
        "type": study.type,
        "source": study.source,
        "status": study.status,
        "error": study.error,
        "uploaded_at": study.uploaded_at,
        "images": _images(study, latest),
        "ai_results": [_ai_result_view(result) for result in study.ai_results],
    }


def triage_view(result) -> dict | None:
    if result is None:
        return None
    return {
        "id": result.id,
        "zone": result.zone,
        "specialist_type": result.specialist_type,
        "route": result.route,
        "reasons": result.reasons_json or [],
        "signals": result.signals_json or [],
        "time_window_min": result.time_window_min,
        "readers_agree": result.readers_agree,
        "rules_version": result.rules_version,
        "stroke": result.stroke_json or {},
        "summary_nurse": result.summary_nurse,
        "summary_specialist": result.summary_specialist,
        "report_model": result.report_model,
        "computed_at": result.computed_at,
    }


def _patient_view(patient, *, with_name: bool) -> dict:
    now = _utcnow()
    return {
        "id": patient.id,
        "full_name": patient.full_name if with_name else None,
        "birth_year": patient.birth_year,
        "age": now.year - patient.birth_year if patient.birth_year else None,
        "sex": patient.sex,
        "phone": patient.phone if with_name else None,
        "district": patient.district,
    }


def case_detail(db: Session, case, *, with_name: bool = True) -> dict:
    triage = case.triage_results[-1] if case.triage_results else None
    anamnesis = case.anamnesis
    facility = case.facility
    nearest_ct = []
    if facility is not None and not facility.has_ct:
        nearest_ct = facilities.nearest(db, facility.lat, facility.lng, has_ct=True, limit=2)

    return {
        "id": case.id,
        "status": case.status,
        "zone": case.zone,
        "specialist_type": case.specialist_type,
        "route": case.route,
        "symptom_onset_at": case.symptom_onset_at,
        "created_at": case.created_at,
        "closed_at": case.closed_at,
        "facility": {
            "id": facility.id, "name": facility.name, "district": facility.district,
            "type": facility.type, "has_ct": facility.has_ct,
        } if facility else None,
        "patient": _patient_view(case.patient, with_name=with_name),
        "anamnesis": {
            "befast": anamnesis.befast_json,
            "flags": (anamnesis.structured_json or {}).get("flags", {}),
            "labs": (anamnesis.structured_json or {}).get("labs", {}),
            "chief_complaint": anamnesis.chief_complaint,
            "voice_transcript": anamnesis.voice_transcript,
            "voice_card": (anamnesis.structured_json or {}).get("voice_card"),
        } if anamnesis else None,
        "studies": [study_view(study) for study in case.studies],
        "triage": triage_view(triage),
        "decisions": [{
            "id": decision.id,
            "specialist_id": decision.specialist_id,
            "specialist_name": decision.specialist.full_name if decision.specialist else None,
            "specialty": decision.specialist.specialty if decision.specialist else None,
            "action": decision.action,
            "note": decision.note,
            "route_final": decision.route_final,
            "decided_at": decision.decided_at,
        } for decision in case.decisions],
        "nearest_ct": nearest_ct,
        "disclaimer": AI_DISCLAIMER,
    }


def queue_item(case) -> dict:
    triage = case.triage_results[-1] if case.triage_results else None
    now = _utcnow()
    created = _aware(case.created_at) or now
    facility = case.facility
    patient = case.patient
    return {
        "case_id": case.id,
        "zone": case.zone,
        "status": case.status,
        "specialist_type": case.specialist_type,
        "route": case.route,
        "district": facility.district if facility else None,
        "facility_name": facility.name if facility else None,
        "age": (now.year - patient.birth_year) if patient and patient.birth_year else None,
        "sex": patient.sex if patient else None,
        "summary": (triage.summary_nurse or "").split("\n")[0] if triage else None,
        "reasons": (triage.reasons_json or [])[:2] if triage else [],
        "readers_agree": triage.readers_agree if triage else None,
        "time_window_min": triage.time_window_min if triage else None,
        "stroke": (triage.stroke_json or {}) if triage else {},
        "waiting_min": int((now - created).total_seconds() // 60),
        "created_at": case.created_at,
        "has_decision": bool(case.decisions),
    }


def meta() -> dict:
    """Clinical constants the interfaces need, straight from rules/triage.yaml."""
    rules = load_rules()
    return {
        "rules_version": rules["version"],
        "befast": rules["befast"],
        "stroke_window": rules["stroke_window"],
        "disclaimer": AI_DISCLAIMER,
    }
