# NAZAR AI

Rural nurse uploads a CT / chest X-ray / lab photo / voice note → AI reads it first →
triage zone (red / yellow / green) + specialist routing → a regional specialist confirms.

Hackathon MVP. Full specification: `docs/TZ.md` (source: the TZ .docx in this repo).
AI is the first reader, never the last — no case closes without a specialist decision.

## Running it locally (no Docker)

Requirements: macOS with Xcode command line tools, Postgres.app (or any PostgreSQL 16+),
Python 3.11, Node 20+.

```bash
# 1. one-off: Python 3.11 venv + dependencies
pip install uv && uv python install 3.11
cd backend && uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt

# 2. one-off: redis-server into ~/.local/bin
./scripts/install-redis.sh

# 3. every session
cp .env.example .env          # then set JWT_SECRET and MEDGEMMA_URL
./scripts/services.sh start   # PostgreSQL + Redis
cd backend && .venv/bin/python -m app.seed
```

Two terminals:

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload
```

```bash
cd backend && .venv/bin/celery -A app.workers.tasks worker -l info
```

Check it: `curl -s localhost:8000/health` → `{"status":"ok",...}`,
API docs at <http://localhost:8000/docs>.

MedGemma is **not** started here. It runs on a separate GPU machine, is published with
ngrok, and the backend reaches it through `MEDGEMMA_URL` in `.env`. Until that box is up,
`MEDGEMMA_STUB=true` serves cached JSON from `demo-data/`.

`docker-compose.yml` is kept for the GPU machine and for teammates who prefer containers;
it is not needed for local development.

## Layout

| Path | What |
|---|---|
| `backend/app/models/` | SQLAlchemy tables (TZ §9) |
| `backend/app/routers/` | auth, patients, cases, studies |
| `backend/app/services/` | auth, storage, ingest (DICOM anonymisation), audit |
| `backend/app/ai/` | `cxr.py` (torchxrayvision + Grad-CAM), `preprocess.py` |
| `rules/triage.yaml` | clinical triage rules, owned by the neurosurgeon |
| `demo-data/` | demo facilities, users, sample chest X-rays |
| `scripts/` | local service management |

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q
```
