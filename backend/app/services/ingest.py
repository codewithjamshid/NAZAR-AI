"""Upload ingest: size limits, magic-byte validation, DICOM anonymisation (TZ §11).

The client-declared file name and content type are ignored; the file's own
bytes decide its format and the study's ``source``.
"""

import io
import os
import tempfile
import zipfile
from dataclasses import dataclass
from typing import BinaryIO

import pydicom
from pydicom.dataset import Dataset
from pydicom.errors import InvalidDicomError

from app.models.enums import StudySource, StudyType
from app.services import storage

MB = 1024 * 1024

MAX_BYTES: dict[str, int] = {
    StudyType.CT_HEAD: 300 * MB,
    StudyType.CXR: 20 * MB,
    StudyType.LAB_PHOTO: 20 * MB,
    StudyType.VOICE: 20 * MB,
}

ALLOWED_FORMATS: dict[str, set[str]] = {
    StudyType.CT_HEAD: {"dcm", "zip"},
    StudyType.CXR: {"png", "jpg", "dcm"},
    StudyType.LAB_PHOTO: {"png", "jpg"},
    StudyType.VOICE: {"webm", "ogg", "wav", "m4a"},
}

SOURCE_BY_FORMAT: dict[str, str] = {
    "dcm": StudySource.DICOM,
    "zip": StudySource.DICOM,
    "png": StudySource.PHOTO,
    "jpg": StudySource.PHOTO,
    "webm": StudySource.AUDIO,
    "ogg": StudySource.AUDIO,
    "wav": StudySource.AUDIO,
    "m4a": StudySource.AUDIO,
}

# Tags that identify the patient or staff. Name/ID are Type 2 (must exist) -> overwritten,
# the rest are removed. Private tags are dropped as well.
_PHI_OVERWRITE = ("PatientName", "PatientID")
_PHI_REMOVE = (
    "PatientBirthDate", "PatientBirthName", "PatientAddress", "PatientTelephoneNumbers",
    "OtherPatientIDs", "OtherPatientNames", "IssuerOfPatientID",
    "ReferringPhysicianName", "PerformingPhysicianName", "OperatorsName",
    "InstitutionName", "InstitutionAddress",
)


class IngestError(ValueError):
    """Client-facing validation error (mapped to HTTP 400)."""


@dataclass(frozen=True)
class StoredFile:
    rel_path: str
    source: str
    format: str
    size: int


def sniff(head: bytes) -> str | None:
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[128:132] == b"DICM":
        return "dcm"
    if head[:4] == b"PK\x03\x04":
        return "zip"
    if head[:4] == b"\x1aE\xdf\xa3":
        return "webm"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[4:8] == b"ftyp":
        return "m4a"
    return None


def anonymise_dataset(ds: Dataset) -> Dataset:
    for keyword in _PHI_OVERWRITE:
        if keyword in ds:
            setattr(ds, keyword, "ANONYMIZED")
    for keyword in _PHI_REMOVE:
        if keyword in ds:
            delattr(ds, keyword)
    ds.remove_private_tags()
    return ds


def _anonymise_dicom_file(rel_path: str) -> None:
    path = storage.absolute(rel_path)
    try:
        ds = pydicom.dcmread(path)
    except InvalidDicomError as exc:
        raise IngestError("DICOM fayl o'qilmadi") from exc
    anonymise_dataset(ds)
    ds.save_as(path, enforce_file_format=True)


def _anonymise_dicom_zip(rel_path: str) -> int:
    """Rewrite the ZIP keeping only anonymised DICOM entries. Returns slice count."""
    path = storage.absolute(rel_path)
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".zip", delete=False) as tmp:
        tmp_path = tmp.name
    count = 0
    try:
        with zipfile.ZipFile(path) as src, zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as dst:
            for info in src.infolist():
                if info.is_dir() or info.filename.startswith("__MACOSX/"):
                    continue
                try:
                    ds = pydicom.dcmread(io.BytesIO(src.read(info)))
                except InvalidDicomError:
                    continue  # not a DICOM slice: drop it
                anonymise_dataset(ds)
                buf = io.BytesIO()
                ds.save_as(buf, enforce_file_format=True)
                dst.writestr(info.filename, buf.getvalue())
                count += 1
        if count == 0:
            raise IngestError("ZIP ichida DICOM fayl topilmadi")
    except zipfile.BadZipFile as exc:
        raise IngestError("ZIP fayl buzilgan") from exc
    except BaseException:
        os.unlink(tmp_path)
        raise
    os.replace(tmp_path, path)
    return count


def store_upload(stream: BinaryIO, case_id: int, study_type: str) -> StoredFile:
    """Stream an upload to storage, validate it, anonymise DICOM. Raises IngestError."""
    if study_type not in MAX_BYTES:
        raise IngestError(f"Noma'lum study turi: {study_type}")
    stream.seek(0)
    tmp_rel = storage.new_relative_path(case_id, study_type, ".part")
    try:
        size = storage.save_stream(stream, tmp_rel, MAX_BYTES[study_type])
    except storage.FileTooLarge as exc:
        raise IngestError(str(exc)) from exc

    with storage.absolute(tmp_rel).open("rb") as fh:
        fmt = sniff(fh.read(132))
    if fmt is None or fmt not in ALLOWED_FORMATS[study_type]:
        storage.delete(tmp_rel)
        allowed = ", ".join(sorted(ALLOWED_FORMATS[study_type]))
        raise IngestError(f"Fayl formati '{study_type}' uchun mos emas (ruxsat: {allowed})")

    rel_path = tmp_rel[: -len(".part")] + "." + fmt
    storage.rename(tmp_rel, rel_path)
    try:
        if fmt == "dcm":
            _anonymise_dicom_file(rel_path)
        elif fmt == "zip":
            _anonymise_dicom_zip(rel_path)
    except IngestError:
        storage.delete(rel_path)
        raise
    return StoredFile(rel_path=rel_path, source=SOURCE_BY_FORMAT[fmt], format=fmt, size=size)
