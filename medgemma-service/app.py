"""MedGemma 1.5 inference service (TZ §7, §10).

Runs on the GPU machine, published to the backend with ngrok. The backend calls
POST /infer with base64 PNG images and a prompt; this service only generates —
all JSON validation happens on the backend (`backend/app/ai/medgemma.py`), so a
malformed answer is retried and then recorded as `ai_failed`.

Start:
    pip install -r requirements.txt
    HF_TOKEN=hf_... uvicorn app:app --host 0.0.0.0 --port 8001
    ngrok http 8001            # put the https URL in the backend's MEDGEMMA_URL
"""

import base64
import io
import logging
import os
import time
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("medgemma")

MODEL_ID = os.environ.get("MEDGEMMA_MODEL", "google/medgemma-1.5-4b-it")
MAX_NEW_TOKENS = int(os.environ.get("MEDGEMMA_MAX_NEW_TOKENS", "512"))
MAX_IMAGES = int(os.environ.get("MEDGEMMA_MAX_IMAGES", "24"))

SYSTEM_PROMPT = (
    "You are an expert radiologist supporting a rural triage system. "
    "You describe what is visible; you never make a final diagnosis. "
    "Answer with a single JSON object and nothing else."
)

_model = None
_processor = None

app = FastAPI(title="MedGemma service", version="0.1.0")


class InferRequest(BaseModel):
    task: Literal["ct_head", "cxr", "lab"]
    prompt: str = Field(min_length=1)
    images: list[str] = Field(default_factory=list)
    max_new_tokens: int | None = None


class InferResponse(BaseModel):
    text: str
    model_version: str
    duration_ms: int
    image_count: int


def _device_and_dtype() -> tuple[str, torch.dtype]:
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    if torch.backends.mps.is_available():
        return "mps", torch.float16
    return "cpu", torch.float32


def load_model():
    """Load MedGemma once. The weights are gated: accept the licence and set HF_TOKEN."""
    global _model, _processor
    if _model is not None:
        return _model, _processor

    from transformers import AutoModelForImageTextToText, AutoProcessor

    device, dtype = _device_and_dtype()
    log.info("loading %s on %s (%s)", MODEL_ID, device, dtype)
    token = os.environ.get("HF_TOKEN") or None
    _processor = AutoProcessor.from_pretrained(MODEL_ID, token=token)
    _model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        device_map="auto" if device == "cuda" else None,
        token=token,
    )
    if device != "cuda":
        _model = _model.to(device)
    _model.eval()
    log.info("model ready")
    return _model, _processor


def _decode_images(encoded: list[str]) -> list[Image.Image]:
    images = []
    for index, blob in enumerate(encoded[:MAX_IMAGES]):
        try:
            images.append(Image.open(io.BytesIO(base64.b64decode(blob))).convert("RGB"))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, detail=f"image {index} decode failed: {exc}") from exc
    return images


@app.get("/health")
def health() -> dict:
    device, dtype = _device_and_dtype()
    return {
        "status": "ok",
        "model": MODEL_ID,
        "loaded": _model is not None,
        "device": device,
        "dtype": str(dtype),
    }


@app.post("/infer", response_model=InferResponse)
def infer(request: InferRequest) -> InferResponse:
    started = time.monotonic()
    try:
        model, processor = load_model()
    except Exception as exc:  # noqa: BLE001 - surface the real cause to the backend log
        log.exception("model load failed")
        raise HTTPException(503, detail=f"model unavailable: {exc}") from exc

    images = _decode_images(request.images)
    content: list[dict] = [{"type": "text", "text": request.prompt}]
    content += [{"type": "image", "image": image} for image in images]
    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM_PROMPT}]},
        {"role": "user", "content": content},
    ]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)
    prompt_length = inputs["input_ids"].shape[-1]

    with torch.inference_mode():
        generated = model.generate(
            **inputs,
            max_new_tokens=request.max_new_tokens or MAX_NEW_TOKENS,
            do_sample=False,          # temperature 0: the schema must be reproducible
        )
    text = processor.decode(generated[0][prompt_length:], skip_special_tokens=True).strip()

    return InferResponse(
        text=text,
        model_version=MODEL_ID,
        duration_ms=int((time.monotonic() - started) * 1000),
        image_count=len(images),
    )
