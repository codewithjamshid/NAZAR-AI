"""M2 speech-to-text for Uzbek voice notes (TZ §7).

faster-whisper is optional: the package and its model are a large download, so
when either is missing this module reports "unavailable" and the nurse app falls
back to the text field, which is the documented fallback (TZ §15 R6).
"""

import logging
import time
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

log = logging.getLogger(__name__)

_model = None


class STTUnavailable(RuntimeError):
    """faster-whisper is not installed or the model could not be loaded."""


@dataclass
class STTResult:
    text: str
    language: str
    confidence: float | None
    model_version: str
    duration_ms: int


def get_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise STTUnavailable(
                "faster-whisper o'rnatilmagan — matn kiritish maydonidan foydalaning"
            ) from exc
        try:
            _model = WhisperModel(settings.stt_model, device="cpu", compute_type="int8")
        except Exception as exc:  # noqa: BLE001 - download or load failure
            raise STTUnavailable(f"STT modeli yuklanmadi: {exc}") from exc
    return _model


def transcribe(audio_path: Path) -> STTResult:
    started = time.monotonic()
    model = get_model()
    segments, info = model.transcribe(str(audio_path), language=settings.stt_language)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    return STTResult(
        text=text,
        language=getattr(info, "language", settings.stt_language),
        confidence=getattr(info, "language_probability", None),
        model_version=f"faster-whisper/{settings.stt_model}",
        duration_ms=int((time.monotonic() - started) * 1000),
    )
