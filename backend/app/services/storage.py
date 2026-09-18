"""File storage on local disk under STORAGE_PATH (MinIO can replace this later).

Paths handed around the app are *relative* to the storage root, e.g.
``cases/12/cxr_3fa1b2c4.png``; only this module knows the absolute location.
"""

import uuid
from pathlib import Path
from typing import BinaryIO

from app.config import settings

CHUNK = 1024 * 1024


class FileTooLarge(ValueError):
    def __init__(self, max_bytes: int):
        self.max_bytes = max_bytes
        super().__init__(f"Fayl juda katta (limit {max_bytes // (1024 * 1024)} MB)")


def root() -> Path:
    path = settings.storage_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def absolute(rel_path: str) -> Path:
    return root() / rel_path


def new_relative_path(case_id: int, prefix: str, suffix: str) -> str:
    return f"cases/{case_id}/{prefix}_{uuid.uuid4().hex[:8]}{suffix}"


def save_stream(stream: BinaryIO, rel_path: str, max_bytes: int) -> int:
    """Write ``stream`` to ``rel_path`` in chunks; abort and clean up past ``max_bytes``."""
    dest = absolute(rel_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := stream.read(CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise FileTooLarge(max_bytes)
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return size


def rename(rel_from: str, rel_to: str) -> None:
    absolute(rel_from).rename(absolute(rel_to))


def delete(rel_path: str) -> None:
    absolute(rel_path).unlink(missing_ok=True)
