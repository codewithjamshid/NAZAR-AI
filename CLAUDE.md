# NAZAR AI — project rules for Claude Code

## What this is
Hackathon MVP (National AI Hackathon, Khorezm, 17–20 Sep 2026, healthcare track, problem #13).
A rural nurse uploads CT / chest X-ray / lab-sheet photo / voice → AI reads it first →
triage zone (red/yellow/green) + specialist routing → regional specialist confirms in a panel.

**The full spec is `docs/TZ.md`. Read the relevant section before touching a module.**
Section map: 5 architecture · 6 functional requirements (F-xx / S-xx ids) · 7 AI modules ·
8 triage rules · 9 data model + API · 10 stack + folder layout · 11 safety · 12 UI screens ·
13 demo scenario · 14 3-day plan · 15 risks + cut order.

## Non-negotiable product rules
- AI is the *first reader, never the last*: no case closes without a specialist decision.
- Zone decisions come from classifiers + `rules/triage.yaml`, never from free LLM text.
- MedGemma and the cloud LLM must return JSON that passes a Pydantic schema; anything else → retry twice, then status `ai_failed`.
- Missing data or disagreement between the two readers → **yellow**, never auto-green.
- Every AI result stores `confidence`, `model_version`, and (for images) a heatmap path.
- Patient name never goes to the cloud LLM; DICOM metadata is anonymised on ingest.
- Every specialist action is written to `audit_log`.

## Stack (do not swap without asking)
- Backend: Python 3.11, FastAPI, SQLAlchemy 2, Pydantic v2, PostgreSQL 16, Celery + Redis, MinIO or local disk.
- AI: MedGemma 1.5 4B as a separate service (`medgemma-service/`, HTTP `/infer`), torchxrayvision (CXR), optional ICH CNN, faster-whisper (STT), Claude/Gemini API (report only).
- Frontend: React + Vite. `nurse-app/` is a PWA (mobile-first, offline queue in IndexedDB via Dexie). `specialist-panel/` is desktop, Tailwind.
- Infra: local dev runs natively (no Docker) — `scripts/services.sh start` brings up PostgreSQL + Redis.
  MedGemma runs on a separate GPU machine and is reached over its ngrok URL (`MEDGEMMA_URL`).
  `docker-compose.yml` is kept for the GPU box / teammates but is not the local path.
- Folder layout is fixed in TZ §10 — create files there, not elsewhere.

## How to work
- Build in the order of TZ §14. Day-1 goal: one image upload → AI result → visible in the panel. Nothing else matters until that works end-to-end.
- One module per task. Finish, run it, show me the command that proves it works, then stop.
- Prefer boring, working code over abstractions. No new frameworks, no premature generalisation.
- Every AI module needs a fallback path (TZ §7, "Zaxira" rows) — implement the fallback in the same task.
- If a requirement is unclear, ask one short question; do not invent clinical logic (BE-FAST scores, thresholds) — those come from `rules/triage.yaml` and the neurosurgeon.
- Demo data lives in `demo-data/`; never hard-code demo values into application code.
- Start services (`scripts/services.sh start`), run the endpoint and show the command that proves it, before declaring a task done.

## Commands
Backend uses a Python 3.11 venv at `backend/.venv` (created with `uv venv --python 3.11`).
- Services (PostgreSQL + Redis): `scripts/services.sh start` | `stop` | `status`
- Backend dev: `cd backend && .venv/bin/uvicorn app.main:app --reload`
- Worker: `cd backend && .venv/bin/celery -A app.workers.tasks worker -l info`
- Tests: `cd backend && .venv/bin/python -m pytest -q`
- Seed demo users/facilities: `cd backend && .venv/bin/python -m app.seed`
- CXR module on one image: `cd backend && .venv/bin/python -m app.ai.cxr <image> --heatmap out.png`
- Nurse app: `cd nurse-app && npm run dev`
- Panel: `cd specialist-panel && npm run dev`
- One-off, if redis-server is missing: `scripts/install-redis.sh`

## Language
Code, identifiers, commits, comments: English. UI strings: Uzbek (Latin). I may write to you in Uzbek — answer in the language I use.
