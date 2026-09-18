"""MedGemma 1.5 client (TZ §7).

The model itself runs as a separate service (`medgemma-service/`) on a GPU
machine, reached over `MEDGEMMA_URL` (an ngrok URL in the field). This module
only talks to it, validates what comes back and gives up loudly:

* the answer must parse as JSON and pass a Pydantic schema (TZ §11);
* two retries, then `MedGemmaInvalidOutput` -> the case becomes `ai_failed`;
* with `MEDGEMMA_STUB=true` nothing is called: cached readings recorded from a
  real run are served from `demo-data/medgemma/`, and a missing entry is an
  honest failure rather than an invented reading.

CLI (run against the real service to fill the cache):
    python -m app.ai.medgemma record <file> --task ct_head|cxr|lab
"""

import argparse
import base64
import hashlib
import io
import json
import logging
import re
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

import httpx
import pydicom
from pydicom.errors import InvalidDicomError
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas.medgemma import SCHEMAS

log = logging.getLogger(__name__)

ATTEMPTS = 3          # first try + two retries (TZ §15 R3)
TIMEOUTS = {"ct_head": 240.0, "cxr": 90.0, "lab": 90.0}
PROMPTS = {
    "ct_head": "medgemma_ct.txt",
    "cxr": "medgemma_cxr.txt",
    "lab": "medgemma_lab.txt",
}
STUB_VERSION_SUFFIX = "@stub"


class MedGemmaError(RuntimeError):
    """Base class: the module could not produce a validated reading."""


class MedGemmaUnavailable(MedGemmaError):
    """Service unreachable, or no cached reading in stub mode."""


class MedGemmaInvalidOutput(MedGemmaError):
    """The service answered, but never with JSON that passes the schema."""


@dataclass
class MedGemmaResult:
    reading: dict
    model_version: str
    duration_ms: int
    raw_text: str | None = None


def prompt_for(task: str) -> str:
    return (Path(__file__).parent / "prompts" / PROMPTS[task]).read_text(encoding="utf-8")


def cache_key(path: Path | str) -> str:
    """Stable id for a study file.

    DICOM keeps its SeriesInstanceUID (survives our anonymisation and re-zipping);
    ordinary images are hashed. Patient identifiers are never part of the key.
    """
    path = Path(path)
    data = path.read_bytes()
    if data[128:132] == b"DICM":
        try:
            ds = pydicom.dcmread(io.BytesIO(data), stop_before_pixels=True)
            return f"series-{ds.SeriesInstanceUID}"
        except (InvalidDicomError, AttributeError):
            pass
    elif data[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for info in sorted(archive.infolist(), key=lambda i: i.filename):
                    if info.is_dir():
                        continue
                    try:
                        ds = pydicom.dcmread(
                            io.BytesIO(archive.read(info)), stop_before_pixels=True
                        )
                    except InvalidDicomError:
                        continue
                    return f"series-{ds.SeriesInstanceUID}"
        except (zipfile.BadZipFile, AttributeError):
            pass
    return f"sha256-{hashlib.sha256(data).hexdigest()[:32]}"


def _cache_path(task: str, key: str) -> Path:
    return settings.demo_data_path / "medgemma" / task / f"{key}.json"


def extract_json(text: str) -> dict:
    """Pull the JSON object out of the model's answer (it may add a fence or prose)."""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else None
    if candidate is None:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise MedGemmaInvalidOutput("Javobda JSON topilmadi")
        candidate = text[start : end + 1]
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise MedGemmaInvalidOutput(f"JSON o'qilmadi: {exc}") from exc
    if not isinstance(payload, dict):
        raise MedGemmaInvalidOutput("JSON obyekt bo'lishi kerak")
    return payload


def validate(task: str, payload: dict) -> BaseModel:
    schema = SCHEMAS[task]
    try:
        return schema.model_validate(payload)
    except ValidationError as exc:
        raise MedGemmaInvalidOutput(f"Schema validatsiyadan o'tmadi: {exc.error_count()} xato") from exc


def _encode(images: list[Path]) -> list[str]:
    return [base64.b64encode(Path(image).read_bytes()).decode("ascii") for image in images]


def _from_cache(task: str, key: str) -> MedGemmaResult:
    path = _cache_path(task, key)
    if not path.is_file():
        raise MedGemmaUnavailable(
            f"MEDGEMMA_STUB=true, lekin keshda natija yo'q: {task}/{key}. "
            "GPU serverni ulang yoki 'python -m app.ai.medgemma record' bilan yozib oling."
        )
    stored = json.loads(path.read_text(encoding="utf-8"))
    meta = stored.pop("_meta", {})
    reading = validate(task, stored)
    version = meta.get("model_version", settings.medgemma_model)
    return MedGemmaResult(
        reading=reading.model_dump(),
        model_version=f"{version}{STUB_VERSION_SUFFIX}",
        duration_ms=0,
    )


def _call_service(task: str, images: list[Path], prompt: str) -> tuple[str, str, int]:
    url = settings.medgemma_url.rstrip("/") + "/infer"
    payload = {"task": task, "prompt": prompt, "images": _encode(images)}
    headers = {"ngrok-skip-browser-warning": "true"}  # ngrok free tier interstitial
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=TIMEOUTS[task])
        response.raise_for_status()
        body = response.json()
    except httpx.HTTPError as exc:
        raise MedGemmaUnavailable(f"MedGemma servisi javob bermadi: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise MedGemmaUnavailable(f"MedGemma servisi noto'g'ri javob qaytardi: {exc}") from exc
    return (
        body.get("text", ""),
        body.get("model_version", settings.medgemma_model),
        int(body.get("duration_ms", 0)),
    )


def infer(task: str, images: list[Path], key: str) -> MedGemmaResult:
    """Read `images` with MedGemma and return a schema-valid reading."""
    if task not in SCHEMAS:
        raise ValueError(f"unknown task: {task}")
    if settings.medgemma_stub:
        return _from_cache(task, key)
    if not images:
        raise MedGemmaUnavailable("Tasvir berilmadi")

    prompt = prompt_for(task)
    started = time.monotonic()
    last_error: MedGemmaError | None = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            text, version, service_ms = _call_service(task, images, prompt)
            reading = validate(task, extract_json(text))
            return MedGemmaResult(
                reading=reading.model_dump(),
                model_version=version,
                duration_ms=service_ms or int((time.monotonic() - started) * 1000),
                raw_text=text,
            )
        except MedGemmaInvalidOutput as exc:
            last_error = exc
            log.warning("MedGemma %s: invalid output on attempt %s/%s: %s",
                        task, attempt, ATTEMPTS, exc)
        except MedGemmaUnavailable as exc:
            last_error = exc
            log.warning("MedGemma %s: service error on attempt %s/%s: %s",
                        task, attempt, ATTEMPTS, exc)
    raise last_error or MedGemmaInvalidOutput("MedGemma javob bermadi")


def record(task: str, source: Path, images: list[Path]) -> Path:
    """Call the real service and store the reading as a stub cache entry."""
    if settings.medgemma_stub:
        raise SystemExit("MEDGEMMA_STUB=false qilib, GPU servisga ulanib ishga tushiring.")
    key = cache_key(source)
    result = infer(task, images, key)
    path = _cache_path(task, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        **result.reading,
        "_meta": {
            "model_version": result.model_version,
            "service_url": settings.medgemma_url,
            "source_file": source.name,
            "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "duration_ms": result.duration_ms,
        },
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="MedGemma client utilities")
    sub = parser.add_subparsers(dest="command", required=True)

    rec = sub.add_parser("record", help="run the real service and cache the reading")
    rec.add_argument("file", type=Path, help="study file (DICOM / ZIP / image)")
    rec.add_argument("--task", choices=sorted(SCHEMAS), required=True)

    key_cmd = sub.add_parser("key", help="print the cache key for a file")
    key_cmd.add_argument("file", type=Path)

    args = parser.parse_args()
    if args.command == "key":
        print(cache_key(args.file))
        return

    from app.ai import preprocess

    if args.task == "ct_head":
        images = preprocess.ct_slices_for_model(args.file)
    else:
        images = [preprocess.as_png(args.file)]
    print("saved:", record(args.task, args.file, images))


if __name__ == "__main__":
    main()
