"""Signed image delivery (TZ §11: images stay inside the system)."""

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.services import files

router = APIRouter(tags=["files"])


@router.get("/files/{path:path}")
def get_file(path: str, exp: int = Query(...), sig: str = Query(...)) -> FileResponse:
    try:
        files.verify(path, exp, sig)
        target = files.resolve(path)
    except files.FileAccessError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return FileResponse(target, headers={"Cache-Control": "private, max-age=600"})
