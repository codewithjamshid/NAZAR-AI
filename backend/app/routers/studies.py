from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CaseStatus, Study, StudyType, User, UserRole
from app.schemas.studies import StudyOut
from app.services import audit, ingest
from app.services.auth import get_visible_case, require_roles

router = APIRouter(tags=["studies"])


@router.post("/cases/{case_id}/studies", response_model=StudyOut, status_code=status.HTTP_201_CREATED)
def upload_study(
    case_id: int,
    type: StudyType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.NURSE, UserRole.OPERATOR)),
) -> Study:
    case = get_visible_case(db, case_id, user)
    try:
        stored = ingest.store_upload(file.file, case.id, type)
    except ingest.IngestError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    study = Study(case_id=case.id, type=type, file_path=stored.rel_path, source=stored.source)
    if case.status == CaseStatus.CREATED:
        case.status = CaseStatus.UPLOADING
    db.add(study)
    db.flush()
    audit.record(
        db, action="study.upload", user_id=user.id, case_id=case.id,
        payload={"study_id": study.id, "type": type, "format": stored.format, "size": stored.size},
    )
    db.commit()
    db.refresh(study)
    # Step 7 enqueues process_study(study.id) here.
    return study
