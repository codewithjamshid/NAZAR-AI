"""Minimal Gemini REST client shared by the report writer and speech-to-text.

Why not the SDK: httpx is already a dependency and the surface we need is one
endpoint. The key travels in a header, never in the URL, so it cannot end up
in an access log.

Free-tier quotas are per model and small (measured 18.09.2026: 20 requests a
day for gemini-2.5-flash), so callers pass a list of models: a 429 or a busy
503 moves on to the next one.
"""

import logging
import time

import httpx

log = logging.getLogger(__name__)

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BUSY = (500, 502, 503, 504)


class GeminiError(RuntimeError):
    """The request failed for a reason other than quota."""


class RateLimited(GeminiError):
    """Every model answered 429: try again later, not now."""


class Rejected(GeminiError):
    """The model answered, but not with a complete, usable text."""


def split_models(value: str, default: str) -> list[str]:
    names = [name.strip() for name in (value or "").split(",") if name.strip()]
    return names or [default]


def _text_of(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        raise Rejected(f"javob yo'q: {data.get('promptFeedback')}")
    candidate = candidates[0]
    if candidate.get("finishReason") not in ("STOP", None):
        raise Rejected(f"javob to'liq emas: {candidate.get('finishReason')}")
    parts = (candidate.get("content") or {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts)


def generate(models: list[str], body: dict, *, key: str, timeout: float = 20.0,
             retry_busy: bool = True) -> tuple[str, str]:
    """POST `body` to each model in turn. Returns (text, model that answered)."""
    if not key:
        raise GeminiError("Gemini API kaliti sozlanmagan")
    headers = {"x-goog-api-key": key}
    failures: list[str] = []
    quota_only = True

    for model in models:
        attempts = 2 if retry_busy else 1
        for attempt in range(attempts):
            try:
                response = httpx.post(URL.format(model=model), json=body,
                                      headers=headers, timeout=timeout)
            except httpx.HTTPError as exc:
                quota_only = False
                failures.append(f"{model}: {type(exc).__name__}")
                break
            if response.status_code == 200:
                return _text_of(response.json()), model
            if response.status_code == 429:
                failures.append(f"{model}: 429")
                break                       # per-minute/day quota: next model
            quota_only = False
            failures.append(f"{model}: HTTP {response.status_code}")
            if response.status_code in BUSY and attempt + 1 < attempts:
                time.sleep(1.5)
                continue
            break

    message = "; ".join(failures) or "model ro'yxati bo'sh"
    if failures and quota_only:
        raise RateLimited(message)
    raise GeminiError(f"Gemini javob bermadi: {message}")
