# MedGemma service

MedGemma 1.5 4B as a separate HTTP service, on the GPU machine. The NAZAR AI
backend reaches it over `MEDGEMMA_URL` (an ngrok URL when the two machines are
not on the same network).

## Run it

```bash
cd medgemma-service
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# The weights are gated: accept the licence on the model page first.
export HF_TOKEN=hf_...
export MEDGEMMA_API_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app:app --host 0.0.0.0 --port 8001
```

Roughly 10 GB of VRAM in bf16. On a Mac, MPS with float16 works but is slow; a
quantised build (MLX or llama.cpp) is the documented fallback in TZ §15 R1.

## Publish it to the backend

```bash
ngrok http 8001
```

Then on the backend machine set, in `.env`:

```
MEDGEMMA_URL=https://<your-subdomain>.ngrok-free.app
MEDGEMMA_API_KEY=<the same key as on the GPU box>
MEDGEMMA_STUB=false
```

Check the link end to end:

```bash
curl -s -H 'ngrok-skip-browser-warning: true' https://<your-subdomain>.ngrok-free.app/health
```

## API

`POST /infer` → `{"task": "ct_head"|"cxr"|"lab", "prompt": "...", "images": ["<base64 png>", ...]}`
returns `{"text", "model_version", "duration_ms", "image_count"}`.

The service only generates. The backend validates the answer against a Pydantic
schema, retries twice and then records `ai_failed` — so a malformed or
out-of-list answer never reaches a clinician (TZ §11).

## Recording stub readings

With the service reachable and `MEDGEMMA_STUB=false`, cache a reading for a demo
file so the demo also runs with the GPU box switched off:

```bash
cd backend
.venv/bin/python -m app.ai.medgemma record ../demo-data/cxr/00000001_000.png --task cxr
```

The file lands in `demo-data/medgemma/<task>/<key>.json` and its `model_version`
is reported to the panel with an `@stub` suffix, so a cached reading is always
visibly distinct from a live one.
