"""Study upload and AI results (TZ §6 F-04, F-10, F-11)."""

import logging

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status,
)
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CaseStatus, Study, StudyStatus, StudyType, User, UserRole
from app.services import audit, case_view, ingest
from app.services.auth import get_current_user, get_visible_case, require_roles

log = logging.getLogger(__name__)
router = APIRouter(tags=["studies"])


def store_and_enqueue(db: Session, case, user: User, study_type: str,
                      file: UploadFile, background: BackgroundTasks | None = None) -> Study:
    """Validate and store an upload, then hand it to the worker."""
    from app.ai.medgemma import cache_key
    from app.services import storage
    from app.workers.tasks import process_study

    try:
        stored = ingest.store_upload(file.file, case.id, study_type)
    except ingest.IngestError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    study = Study(
        case_id=case.id, type=study_type, file_path=stored.rel_path,
        source=stored.source, status=StudyStatus.QUEUED,
    )
    try:
        study.cache_key = cache_key(storage.absolute(stored.rel_path))
    except Exception as exc:  # noqa: BLE001 - key is only used for the MedGemma stub
        log.warning("cache key failed for %s: %s", stored.rel_path, exc)

    if case.status in (CaseStatus.CREATED, CaseStatus.TRIAGED):
        case.status = CaseStatus.UPLOADING
    db.add(study)
    db.flush()
    audit.record(
        db, action="study.upload", user_id=user.id, case_id=case.id,
        payload={"study_id": study.id, "type": study_type,
                 "format": stored.format, "size": stored.size},
    )
    db.commit()
    db.refresh(study)

    try:
        process_study.delay(study.id)
    except Exception as exc:  # noqa: BLE001 - broker down: run it in this process instead
        log.warning("Celery enqueue failed (%s); processing in-process", exc)
        if background is not None:
            background.add_task(process_study, study.id)
        else:
            process_study(study.id)
    return study


@router.post("/cases/{case_id}/studies", status_code=status.HTTP_201_CREATED)
def upload_study(
    case_id: int,
    background: BackgroundTasks,
    type: StudyType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE, UserRole.OPERATOR)),
) -> dict:
    case = get_visible_case(db, case_id, user)
    study = store_and_enqueue(db, case, user, type, file, background)
    return case_view.study_view(study)


@router.get("/studies/{study_id}/result")
def study_result(
    study_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    study = db.get(Study, study_id)
    if study is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tekshiruv topilmadi")
    get_visible_case(db, study.case_id, user)
    return case_view.study_view(study)
