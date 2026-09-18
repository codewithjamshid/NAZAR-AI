"""Anamnesis, queue, decisions and file access over HTTP (TZ §6, §9, §11)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import models as m
from app.config import settings
from app.db import get_db
from app.main import app
from app.services import files
from app.services.auth import hash_password

API = "/api/v1"
PASSWORD = "demo1234"


@pytest.fixture
def world(db):
    fap = m.Facility(name="FAP A", type="fap", district="Hazorasp", lat=41.25, lng=61.02)
    district = m.Facility(name="Tuman A", type="district", district="Hazorasp",
                          lat=41.31, lng=61.07, has_ct=True)
    regional = m.Facility(name="Viloyat", type="regional", district="Urganch",
                          lat=41.55, lng=60.63, has_ct=True)
    pw = hash_password(PASSWORD)
    users = {
        "nurse": m.User(full_name="N", role="nurse", phone="+1", password_hash=pw, facility=fap),
        "operator": m.User(full_name="O", role="operator", phone="+2", password_hash=pw,
                           facility=district),
        "neuro": m.User(full_name="Dr Neuro", role="specialist", specialty="neurologist",
                        phone="+4", password_hash=pw, facility=regional),
        "therapist": m.User(full_name="Dr Ter", role="specialist", specialty="therapist",
                            phone="+5", password_hash=pw, facility=regional),
    }
    db.add_all([fap, district, regional, *users.values()])
    db.flush()
    return users


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_path", tmp_path)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def auth(client, phone):
    resp = client.post(f"{API}/auth/login", json={"phone": phone, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def make_case(client, headers, minutes_ago: int | None = 40, phone: str | None = None):
    """The dev database also holds real demo rows, so each test uses a fresh phone."""
    patient = client.post(f"{API}/patients", headers=headers, json={
        "full_name": "Bekmurod Aka", "birth_year": 1968, "sex": "male",
        "phone": phone or f"+9989{uuid.uuid4().int % 10**8:08d}"}).json()
    body = {"patient_id": patient["id"]}
    if minutes_ago is not None:
        onset = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
        body["symptom_onset_at"] = onset.isoformat()
    return client.post(f"{API}/cases", headers=headers, json=body).json()["id"]


STROKE_BEFAST = {"face": True, "arms": True, "speech": True, "balance": False, "eyes": False}


# --- meta --------------------------------------------------------------------

def test_meta_exposes_the_rules_the_screens_need(client, world):
    body = client.get(f"{API}/meta", headers=auth(client, "+1")).json()
    assert body["rules_version"]
    assert body["befast"]["points"]["face"] == 2
    assert body["stroke_window"]["thrombolysis_min"] == 270
    assert "Shifokor tasdig'i" in body["disclaimer"]


# --- anamnesis triage (demo minute 0:50) -------------------------------------

def test_befast_makes_the_case_red_before_any_image(client, world):
    nurse = auth(client, "+1")
    case_id = make_case(client, nurse)

    body = client.post(f"{API}/cases/{case_id}/anamnesis", headers=nurse, json={
        "befast": STROKE_BEFAST, "flags": {}, "chief_complaint": "gapirolmayapti"}).json()

    triage = body["triage"]
    assert triage["zone"] == "red"
    assert triage["specialist_type"] == "neurologist" and triage["route"] == "regional"
    assert 225 <= triage["time_window_min"] <= 230
    assert triage["stroke"]["score"] == 6 and triage["stroke"]["window_state"] == "open"
    assert triage["summary_nurse"].startswith("QIZIL")
    assert body["status"] == "triaged"
    assert "Shifokor tasdig'i" in body["disclaimer"]


def test_nearest_ct_is_offered_when_the_facility_has_none(client, world):
    nurse = auth(client, "+1")
    case_id = make_case(client, nurse)
    client.post(f"{API}/cases/{case_id}/anamnesis", headers=nurse,
                json={"befast": STROKE_BEFAST, "flags": {}})

    body = client.get(f"{API}/cases/{case_id}", headers=nurse).json()
    names = [row["name"] for row in body["nearest_ct"]]
    assert names and names[0] == "Tuman A"
    assert body["nearest_ct"][0]["distance_km"] > 0


def test_critical_lab_value_pushes_the_case_to_yellow(client, world):
    nurse = auth(client, "+1")
    case_id = make_case(client, nurse, minutes_ago=None)
    client.post(f"{API}/cases/{case_id}/anamnesis", headers=nurse,
                json={"befast": {"face": False}, "flags": {}})

    body = client.post(f"{API}/cases/{case_id}/labs", headers=nurse,
                       json={"values": {"glucose": 18.4}}).json()

    assert body["triage"]["zone"] == "yellow"
    assert any("glucose" in reason for reason in body["triage"]["reasons"])


# --- queue (demo minute 1:10) ------------------------------------------------

def test_queue_is_sorted_red_first_and_respects_the_specialty_filter(client, world):
    nurse = auth(client, "+1")
    red_case = make_case(client, nurse)
    client.post(f"{API}/cases/{red_case}/anamnesis", headers=nurse,
                json={"befast": STROKE_BEFAST, "flags": {}})
    yellow_case = make_case(client, nurse, minutes_ago=None)
    client.post(f"{API}/cases/{yellow_case}/anamnesis", headers=nurse,
                json={"befast": {"face": False}, "flags": {}})

    queue = client.get(f"{API}/queue", headers=auth(client, "+4")).json()
    assert [row["zone"] for row in queue][:2] == ["red", "yellow"]
    assert queue[0]["case_id"] == red_case
    assert queue[0]["summary"] and queue[0]["waiting_min"] >= 0

    mine = client.get(f"{API}/queue?mine=true", headers=auth(client, "+4")).json()
    assert [row["case_id"] for row in mine] == [red_case]

    assert client.get(f"{API}/queue", headers=nurse).status_code == 403


# --- decision and close (demo minutes 2:20-2:40) -----------------------------

def test_decision_closes_the_loop_and_is_audited(client, world, db):
    nurse = auth(client, "+1")
    neuro = auth(client, "+4")
    case_id = make_case(client, nurse)
    client.post(f"{API}/cases/{case_id}/anamnesis", headers=nurse,
                json={"befast": STROKE_BEFAST, "flags": {}})

    opened = client.post(f"{API}/cases/{case_id}/open", headers=neuro).json()
    assert opened["status"] == "in_review"

    assert client.post(f"{API}/cases/{case_id}/decision", headers=neuro,
                       json={"action": "modify"}).status_code == 400

    decided = client.post(f"{API}/cases/{case_id}/decision", headers=neuro, json={
        "action": "confirm", "route_final": "regional",
        "note": "Viloyatga transport"}).json()
    assert decided["status"] == "decided" and decided["route"] == "regional"
    assert decided["decisions"][0]["specialist_name"] == "Dr Neuro"

    nurse_view = client.get(f"{API}/cases/{case_id}", headers=nurse).json()
    assert nurse_view["decisions"][0]["note"] == "Viloyatga transport"

    closed = client.post(f"{API}/cases/{case_id}/close", headers=nurse).json()
    assert closed["status"] == "closed" and closed["closed_at"]

    actions = [row.action for row in db.query(m.AuditLog).order_by(m.AuditLog.id)]
    assert "case.open" in actions and "decision.confirm" in actions and "case.close" in actions
    payload = next(row.payload_json for row in db.query(m.AuditLog)
                   if row.action == "decision.confirm")
    assert payload["rules_version"] and payload["route_final"] == "regional"


def test_a_case_cannot_close_without_a_specialist_decision(client, world):
    nurse = auth(client, "+1")
    case_id = make_case(client, nurse)
    resp = client.post(f"{API}/cases/{case_id}/close", headers=nurse)
    assert resp.status_code == 409
    assert "qarorisiz" in resp.json()["detail"]


def test_nurses_cannot_decide(client, world):
    nurse = auth(client, "+1")
    case_id = make_case(client, nurse)
    assert client.post(f"{API}/cases/{case_id}/decision", headers=nurse,
                       json={"action": "confirm"}).status_code == 403


# --- operator search (F-10) --------------------------------------------------

def test_operator_finds_a_case_from_another_facility_in_the_same_district(client, world):
    nurse = auth(client, "+1")
    phone = f"+9989{uuid.uuid4().int % 10**8:08d}"
    case_id = make_case(client, nurse, phone=phone)

    found = client.get(f"{API}/cases", headers=auth(client, "+2"),
                       params={"q": phone}).json()
    assert [row["case_id"] for row in found] == [case_id]

    by_id = client.get(f"{API}/cases", headers=auth(client, "+2"),
                       params={"q": str(case_id)}).json()
    assert [row["case_id"] for row in by_id] == [case_id]


# --- signed files (TZ §11) ---------------------------------------------------

def test_signed_url_serves_the_file_and_a_tampered_one_does_not(client, world, tmp_path):
    target = tmp_path / "cases" / "1" / "heat.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"\x89PNG\r\n\x1a\n-fake-")

    url = files.sign("cases/1/heat.png")
    assert client.get(url).status_code == 200

    assert client.get(url.replace("sig=", "sig=x")).status_code == 403
    expired = files.sign("cases/1/heat.png", ttl=-10)
    assert client.get(expired).status_code == 403


def test_signed_url_cannot_escape_the_storage_root(client, world):
    """The URL client normalises `..` away, so the guard is checked directly."""
    with pytest.raises(files.FileAccessError):
        files.resolve("../../etc/passwd")
    with pytest.raises(files.FileAccessError):
        files.resolve("cases/../../../etc/hosts")
