"""Short-lived signed URLs for stored images (TZ §11: no public links).

`<img src>` cannot carry an Authorization header, so each image URL is signed
with the server secret and expires. The signature covers the exact path, so one
link never grants access to another case's files.
"""

import hashlib
import hmac
import time
from pathlib import Path
from urllib.parse import quote

from app.config import settings
from app.services import storage

DEFAULT_TTL = 3600


class FileAccessError(ValueError):
    """Bad signature, expired link or a path outside the storage root."""


def _signature(rel_path: str, expires: int) -> str:
    message = f"{rel_path}:{expires}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()[:32]


def sign(rel_path: str | None, ttl: int = DEFAULT_TTL) -> str | None:
    if not rel_path:
        return None
    expires = int(time.time()) + ttl
    quoted = quote(rel_path)
    return f"/api/v1/files/{quoted}?exp={expires}&sig={_signature(rel_path, expires)}"


def verify(rel_path: str, expires: int, signature: str) -> None:
    if expires < int(time.time()):
        raise FileAccessError("Havola muddati tugagan")
    if not hmac.compare_digest(_signature(rel_path, expires), signature):
        raise FileAccessError("Havola imzosi noto'g'ri")


def resolve(rel_path: str) -> Path:
    """Absolute path inside the storage root, or FileAccessError."""
    root = storage.root().resolve()
    target = (root / rel_path).resolve()
    if not target.is_relative_to(root):
        raise FileAccessError("Yo'l ruxsat etilmagan")
    if not target.is_file():
        raise FileAccessError("Fayl topilmadi")
    return target
