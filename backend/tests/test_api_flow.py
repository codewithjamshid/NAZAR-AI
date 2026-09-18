import io
import struct
import zipfile
import zlib

import pydicom
import pytest
from fastapi.testclient import TestClient
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid

from app import models as m
from app.config import settings
from app.db import get_db
from app.main import app
from app.services.auth import hash_password

API = "/api/v1"
PASSWORD = "demo1234"


def tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(b"\x00\x00")) + chunk(b"IEND", b""))


def tiny_dicom(patient_name: str = "Bekmurod Aka") -> bytes:
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = Dataset()
    ds.file_meta = meta
    ds.PatientName = patient_name
    ds.PatientID = "PID-001"
    ds.PatientBirthDate = "19680101"
    ds.InstitutionName = "Tuman shifoxonasi"
    ds.Modality = "CT"
    ds.SOPClassUID = meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    buf = io.BytesIO()
    ds.save_as(buf, enforce_file_format=True)
    return buf.getvalue()


@pytest.fixture
def seeded(db):
    fap = m.Facility(name="FAP A", type="fap", district="Hazorasp")
    district = m.Facility(name="Tuman A", type="district", district="Hazorasp", has_ct=True)
    other_fap = m.Facility(name="FAP B", type="fap", district="Xiva")
    regional = m.Facility(name="Viloyat", type="regional", district="Urganch", has_ct=True)
    pw = hash_password(PASSWORD)
    users = {
        "nurse": m.User(full_name="N", role="nurse", phone="+1", password_hash=pw, facility=fap),
        "operator": m.User(full_name="O", role="operator", phone="+2", password_hash=pw, facility=district),
        "other_nurse": m.User(full_name="N2", role="nurse", phone="+3", password_hash=pw, facility=other_fap),
        "specialist": m.User(full_name="S", role="specialist", specialty="neurologist",
                             phone="+4", password_hash=pw, facility=regional),
    }
    db.add_all([fap, district, other_fap, regional, *users.values()])
    db.flush()
    return users


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_path", tmp_path)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client: TestClient, phone: str) -> dict:
    resp = client.post(f"{API}/auth/login", json={"phone": phone, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_login_rejects_bad_password(client, seeded):
    resp = client.post(f"{API}/auth/login", json={"phone": "+1", "password": "wrong"})
    assert resp.status_code == 401


def test_endpoints_require_token_and_role(client, seeded):
    body = {"full_name": "X", "birth_year": 1970, "sex": "male"}
    assert client.post(f"{API}/patients", json=body).status_code == 401
    spec = login(client, "+4")
    assert client.post(f"{API}/patients", json=body, headers=spec).status_code == 403


def test_full_upload_flow(client, seeded, db, tmp_path):
    nurse = login(client, "+1")

    patient = client.post(f"{API}/patients", headers=nurse,
                          json={"full_name": "Test Bemor", "birth_year": 1968, "sex": "male"})
    assert patient.status_code == 201, patient.text

    case = client.post(f"{API}/cases", headers=nurse,
                       json={"patient_id": patient.json()["id"],
                             "symptom_onset_at": "2026-09-18T07:40:00+05:00"})
    assert case.status_code == 201, case.text
    case_id = case.json()["id"]
    assert case.json()["status"] == "created"

    # wrong content for the declared type -> 400 and nothing left on disk
    bad = client.post(f"{API}/cases/{case_id}/studies", headers=nurse, data={"type": "cxr"},
                      files={"file": ("notes.txt", b"hello", "text/plain")})
    assert bad.status_code == 400, bad.text
    assert not [p for p in tmp_path.rglob("*") if p.is_file()]

    # chest X-ray photo -> source derived from bytes, not from the client
    ok = client.post(f"{API}/cases/{case_id}/studies", headers=nurse, data={"type": "cxr"},
                     files={"file": ("x.bin", tiny_png(), "application/octet-stream")})
    assert ok.status_code == 201, ok.text
    assert ok.json()["source"] == "photo"
    stored = list(tmp_path.rglob("cxr_*.png"))
    assert len(stored) == 1 and stored[0].read_bytes() == tiny_png()

    # district operator attaches a head CT; PHI is stripped on ingest
    operator = login(client, "+2")
    ct = client.post(f"{API}/cases/{case_id}/studies", headers=operator, data={"type": "ct_head"},
                     files={"file": ("head.dcm", tiny_dicom(), "application/dicom")})
    assert ct.status_code == 201, ct.text
    assert ct.json()["source"] == "dicom"
    ds = pydicom.dcmread(next(tmp_path.rglob("ct_head_*.dcm")))
    assert str(ds.PatientName) == "ANONYMIZED"
    assert "PatientBirthDate" not in ds and "InstitutionName" not in ds
    assert ds.Modality == "CT"

    # ZIP series: non-DICOM entries dropped, DICOM entries anonymised
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("series/1.dcm", tiny_dicom("A"))
        z.writestr("series/2.dcm", tiny_dicom("B"))
        z.writestr("__MACOSX/._1.dcm", b"junk")
        z.writestr("readme.txt", b"junk")
    zres = client.post(f"{API}/cases/{case_id}/studies", headers=operator, data={"type": "ct_head"},
                       files={"file": ("series.zip", zbuf.getvalue(), "application/zip")})
    assert zres.status_code == 201, zres.text
    with zipfile.ZipFile(next(tmp_path.rglob("ct_head_*.zip"))) as z:
        assert sorted(z.namelist()) == ["series/1.dcm", "series/2.dcm"]
        assert str(pydicom.dcmread(io.BytesIO(z.read("series/1.dcm"))).PatientName) == "ANONYMIZED"

    # case detail: status moved to uploading, studies listed, nested patient
    detail = client.get(f"{API}/cases/{case_id}", headers=nurse)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["status"] == "uploading"
    assert [s["type"] for s in body["studies"]] == ["cxr", "ct_head", "ct_head"]
    assert body["patient"]["full_name"] == "Test Bemor"
    assert body["triage"] is None and body["decisions"] == []

    # visibility: other facility's nurse -> 404, specialist -> 200
    assert client.get(f"{API}/cases/{case_id}", headers=login(client, "+3")).status_code == 404
    assert client.get(f"{API}/cases/{case_id}", headers=login(client, "+4")).status_code == 200

    actions = [a.action for a in db.query(m.AuditLog).filter_by(case_id=case_id).order_by(m.AuditLog.id)]
    assert actions == ["case.create", "study.upload", "study.upload", "study.upload"]
