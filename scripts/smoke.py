#!/usr/bin/env python
"""End-to-end check of the running stack, to run before the demo.

    backend/.venv/bin/python scripts/smoke.py

Exercises the real path a nurse and a specialist walk: login, case, BE-FAST,
upload, worker, queue, decision, close, plus the WebSocket and the guard that
stops a case closing without a decision. Exits non-zero on the first failure.
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import websockets

API = "http://localhost:8000/api/v1"
WS = "ws://localhost:8000/api/v1/ws/queue"
PASSWORD = "demo1234"
ROOT = Path(__file__).resolve().parent.parent

failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f' — {detail}' if detail else ''}")
    if not ok:
        failures.append(label)


def login(phone: str) -> tuple[str, dict]:
    response = httpx.post(f"{API}/auth/login", json={"phone": phone, "password": PASSWORD})
    response.raise_for_status()
    body = response.json()
    return body["access_token"], {"Authorization": f"Bearer {body['access_token']}"}


async def collect_events(token: str, seen: list, stop: asyncio.Event) -> None:
    async with websockets.connect(WS) as socket:
        await socket.send(json.dumps({"token": token}))
        await socket.recv()
        while not stop.is_set():
            try:
                message = json.loads(await asyncio.wait_for(socket.recv(), timeout=1.0))
            except asyncio.TimeoutError:
                continue
            if message.get("type") != "ping":
                seen.append(message)


async def main() -> int:
    print("health")
    health = httpx.get("http://localhost:8000/health").json()
    check("api, database, redis and rules are up", health["status"] == "ok", str(health))

    print("auth and rules")
    nurse_token, nurse = login("+998901000001")
    spec_token, spec = login("+998901000004")
    meta = httpx.get(f"{API}/meta", headers=nurse).json()
    check("rules version is served", bool(meta["rules_version"]), meta["rules_version"])

    seen: list = []
    stop = asyncio.Event()
    watcher = asyncio.create_task(collect_events(spec_token, seen, stop))
    await asyncio.sleep(1.0)

    print("nurse: stroke case")
    onset = (datetime.now(timezone.utc) - timedelta(minutes=40)).isoformat()
    patient = httpx.post(f"{API}/patients", headers=nurse, json={
        "full_name": "Smoke Test", "birth_year": 1968, "sex": "male"}).json()
    case_id = httpx.post(f"{API}/cases", headers=nurse, json={
        "patient_id": patient["id"], "symptom_onset_at": onset}).json()["id"]
    detail = httpx.post(f"{API}/cases/{case_id}/anamnesis", headers=nurse, json={
        "befast": {"face": True, "arms": True, "speech": True},
        "flags": {}, "chief_complaint": "smoke test"}).json()
    triage = detail["triage"]
    check("BE-FAST inside the window is red for the neurologist",
          triage["zone"] == "red" and triage["specialist_type"] == "neurologist")
    check("the thrombolysis timer is counting", 220 <= (triage["time_window_min"] or 0) <= 235,
          f"{triage['time_window_min']} min")
    check("the nurse gets a readable summary", bool(triage["summary_nurse"]))

    print("upload and worker")
    sample = ROOT / "demo-data" / "cxr" / "00027426_000.png"
    case2 = httpx.post(f"{API}/cases", headers=nurse,
                       json={"patient_id": patient["id"]}).json()["id"]
    with sample.open("rb") as handle:
        httpx.post(f"{API}/cases/{case2}/studies", headers=nurse, data={"type": "cxr"},
                   files={"file": (sample.name, handle, "image/png")}, timeout=60)
    result = {}
    for _ in range(60):
        await asyncio.sleep(1)
        result = httpx.get(f"{API}/cases/{case2}", headers=nurse).json()
        if result["status"] in ("triaged", "ai_failed"):
            break
    study = result["studies"][0]
    cnn = next((row for row in study["ai_results"] if row["module"] == "cxr"), None)
    check("the worker read the X-ray", cnn is not None and cnn["error"] is None,
          f"{cnn['duration_ms']} ms" if cnn else "no result")
    check("a heatmap was produced", bool(cnn and cnn["heatmap_url"]))
    check("the viewer has an image", len(study["images"]["base"]) >= 1)
    if cnn and cnn["heatmap_url"]:
        check("the signed image URL serves the file",
              httpx.get("http://localhost:8000" + cnn["heatmap_url"]).status_code == 200)

    print("specialist")
    queue = httpx.get(f"{API}/queue", headers=spec).json()
    zones = [row["zone"] for row in queue]
    check("the queue is sorted red first",
          zones == sorted(zones, key=lambda zone: {"red": 0, "yellow": 1, "green": 2}[zone]),
          f"{len(queue)} cases")
    httpx.post(f"{API}/cases/{case_id}/open", headers=spec)
    decided = httpx.post(f"{API}/cases/{case_id}/decision", headers=spec, json={
        "action": "confirm", "route_final": "regional", "note": "smoke test"}).json()
    check("the decision closes the loop", decided["status"] == "decided")
    nurse_view = httpx.get(f"{API}/cases/{case_id}", headers=nurse).json()
    check("the nurse sees the decision", bool(nurse_view["decisions"]))

    print("safety guards")
    blocked = httpx.post(f"{API}/cases/{case2}/close", headers=nurse)
    check("a case cannot close without a decision", blocked.status_code == 409)
    closed = httpx.post(f"{API}/cases/{case_id}/close", headers=nurse).json()
    check("a decided case closes", closed["status"] == "closed")

    await asyncio.sleep(1.5)
    stop.set()
    await watcher
    check("the panel received live events", len(seen) >= 2, f"{len(seen)} events")

    print()
    if failures:
        print(f"{len(failures)} check(s) failed: " + ", ".join(failures))
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except httpx.HTTPError as exc:
        print(f"cannot reach the API: {exc}\nStart it with scripts/dev.sh start")
        sys.exit(2)
