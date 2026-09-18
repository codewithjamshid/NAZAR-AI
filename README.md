# NAZAR AI

Har bir qishloqqa — mutaxassis nazari.

A rural nurse uploads a CT, a chest X-ray, a lab-sheet photo or a voice note.
The AI reads it **first, never last**: it produces a triage zone (red / yellow /
green), routes the case to the right specialist, and a regional specialist
confirms every case in the panel. No case closes without a human decision.

Hackathon MVP for the National AI Hackathon, Khorezm, 17–20 September 2026
(healthcare track, problem #13). Full specification: [docs/TZ.md](docs/TZ.md).

## What is built

| Part | State |
|---|---|
| Triage engine (M6) | Rules in [rules/triage.yaml](rules/triage.yaml), owned by the neurosurgeon; 30 tests |
| Chest X-ray reader (M4) | torchxrayvision DenseNet121, 18 pathologies, Grad-CAM heatmap, ~2 s |
| Head CT (M3) | DICOM series, brain window, slice viewer; MedGemma reads it, ICH CNN is the optional second reader |
| Report (M7) | Uzbek template always; Claude API when `LLM_API_KEY` is set, rejected if it invents a diagnosis |
| Lab OCR (M5), voice (M2) | MedGemma / faster-whisper, both with their documented fallbacks |
| API | 21 endpoints + `WS /ws/queue`, JWT, per-facility visibility, signed image URLs, audit log |
| Nurse PWA | `nurse-app/` — screens N1–N6, offline queue |
| Specialist panel | `specialist-panel/` — screens P1–P4, real-time queue, viewer, decisions |

## Run it (no Docker)

Requirements: macOS with Xcode command line tools, PostgreSQL 16+ (Postgres.app
works), Python 3.11, Node 20+.

```bash
# one-off
pip install uv && uv python install 3.11
cd backend && uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt && cd ..
./scripts/install-redis.sh
cp .env.example .env        # set JWT_SECRET, and MEDGEMMA_URL when the GPU box is up
(cd nurse-app && npm install) && (cd specialist-panel && npm install)

# every session
./scripts/dev.sh start
cd backend && .venv/bin/python -m app.seed --cases
```

| Service | URL |
|---|---|
| API docs | http://localhost:8000/docs |
| Nurse app | http://localhost:5173 |
| Specialist panel | http://localhost:5174 |

Stop everything with `./scripts/dev.sh stop`; logs are in `.logs/`.

Demo accounts (password `demo1234`): nurse `+998901000001`, district operator
`+998901000003`, neurologist `+998901000004`.

MedGemma runs on a **separate GPU machine** and is reached over its ngrok URL —
see [medgemma-service/README.md](medgemma-service/README.md). Until it is up,
`MEDGEMMA_STUB=true` serves recorded readings and labels them `@stub`; a missing
recording means "this reader was absent", which the rules treat as a reason to
stay yellow rather than as a silent pass.

## Layout

| Path | What |
|---|---|
| `rules/triage.yaml` | Clinical thresholds and routing. The neurosurgeon edits this, not the code |
| `backend/app/ai/` | `cxr.py`, `medgemma.py`, `ich.py`, `stt.py`, `preprocess.py`, `prompts/` |
| `backend/app/services/` | `triage.py`, `report.py`, `ingest.py` (DICOM anonymisation), `storage.py`, `files.py`, `events.py` |
| `backend/app/routers/` | auth, patients, cases, anamnesis, studies, queue, decisions, facilities, stats, files, ws |
| `medgemma-service/` | MedGemma 1.5 HTTP service for the GPU machine |
| `demo-data/` | Facilities, users, five demo cases, open chest X-rays and one head CT |
| `docs/` | [TZ.md](docs/TZ.md) spec, [API.md](docs/API.md) contract, [DEMO.md](docs/DEMO.md) runbook |

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q
```

75 tests: the triage rules, the AI pipeline from upload to zone, DICOM
anonymisation, MedGemma's retry contract, signed URLs, role visibility and the
demo path. Against a running stack, `scripts/smoke.py` checks the same journey
end to end including the worker and the WebSocket.

## Safety rules that the code enforces

- AI is the first reader. Every result carries "Dastlabki tahlil. Shifokor
  tasdig'i talab qilinadi." and no case closes without a specialist decision.
- Zones come from classifiers plus `rules/triage.yaml`, never from free LLM text.
- Missing data, a failed module or two readers that disagree → yellow, never green.
- Every AI result stores its confidence, `model_version` and heatmap path; every
  specialist action lands in `audit_log`.
- Patient names never reach the cloud model; DICOM metadata is anonymised on ingest.
