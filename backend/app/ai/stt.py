"""M2 Uzbek voice anamnesis: speech -> transcript -> structured card (TZ §7, F-02).

Two providers, chosen with STT_PROVIDER:

* ``gemini`` (default): recognises Uzbek well. The audio leaves the building,
  which conflicts with the rule that patient names never reach the cloud, so
  the nurse app warns "do not say the patient's name", the prompt asks the
  model to write [ism] for any spoken name, and the known name is scrubbed
  from every returned field before anything is stored. The audio itself has
  still been sent; for the pilot the local provider is the compliant choice.
* ``whisper``: faster-whisper on this machine, nothing leaves. Optional package.

The structured card is informational. Its "onset" is never written into the
case's symptom time: a misheard phrase must not move the thrombolysis timer.
If transcription is unavailable the nurse's text field is the fallback (TZ §15 R6).
"""

import base64
import json
import logging
import re
from difflib import SequenceMatcher
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.config import settings
from app.services import gemini

log = logging.getLogger(__name__)

NAME_PLACEHOLDER = "[ism]"

PROMPT = """This is a voice note recorded by a rural nurse. The speech is Uzbek.

1. Transcribe it verbatim in Uzbek Latin script (use o', g', sh, ch).
2. If a person's name is spoken, write [ism] instead of the name.
3. Fill a short card using only what was actually said. If something was not
   said, use null or an empty list. Do not add diagnoses, advice or anything
   that was not spoken.

Answer with a single JSON object and nothing else:
{"transcript": "...", "chief_complaint": "..." | null, "onset": "..." | null,
 "comorbidities": ["..."], "medications": ["..."]}"""


class STTUnavailable(RuntimeError):
    """No transcript: provider not configured, out of quota, or the output was unusable."""


class VoiceCard(BaseModel):
    model_config = ConfigDict(extra="ignore")

    transcript: str = Field(min_length=1, max_length=5000)
    chief_complaint: str | None = Field(default=None, max_length=500)
    onset: str | None = Field(default=None, max_length=200)
    comorbidities: list[str] = Field(default_factory=list, max_length=10)
    medications: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("comorbidities", "medications", mode="after")
    @classmethod
    def _clean(cls, items: list[str]) -> list[str]:
        return [item.strip()[:120] for item in items if item and item.strip()]


@dataclass
class STTResult:
    text: str
    language: str
    confidence: float | None
    model_version: str
    duration_ms: int
    audio_seconds: float | None = None
    card: dict = field(default_factory=dict)
    redacted: bool = False


# --- identity scrubbing ------------------------------------------------------

def _name_pattern(token: str) -> re.Pattern:
    """Match a name even when speech-to-text split it: "Bekmurod" ~ "bek murod".

    Names of four letters or more also swallow an Uzbek suffix ("Bekmurodga").
    Three-letter names must match as a whole word, so "Ali" does not eat
    "alimentar".
    """
    letters = [re.escape(char) for char in token]
    body = r"[\s'\-ʻʼ`]*".join(letters)
    tail = r"\w*" if len(token) >= 4 else r"(?!\w)"
    return re.compile(rf"(?<![\w]){body}{tail}", re.IGNORECASE)


FUZZY_MIN_LETTERS = 5    # shorter names only match exactly
FUZZY_RATIO = 0.75       # "ism o'ylos" ~ "Ismoilov" scores 0.75


def _letters(value: str) -> str:
    return re.sub(r"[\W_]", "", value.lower())


def _fuzzy_scrub(text: str, token: str) -> tuple[str, int]:
    """Catch a misheard name: one or two neighbouring words whose letters are
    close to the name's letters and start with the same letter."""
    target = _letters(token)
    words = [match for match in re.finditer(r"[\w'ʻʼ`\[\]]+", text)]
    hits: list[tuple[int, int]] = []
    index = 0
    while index < len(words):
        matched = False
        for size in (2, 1):
            window = words[index:index + size]
            if len(window) < size or any("[" in word.group() for word in window):
                continue
            joined = _letters("".join(word.group() for word in window))
            if (joined[:1] == target[:1] and abs(len(joined) - len(target)) <= 2
                    and SequenceMatcher(None, joined, target).ratio() >= FUZZY_RATIO):
                hits.append((window[0].start(), window[-1].end()))
                index += size
                matched = True
                break
        if not matched:
            index += 1
    for start, end in reversed(hits):
        text = text[:start] + NAME_PLACEHOLDER + text[end:]
    return text, len(hits)


def scrub_names(text: str, names: list[str]) -> tuple[str, bool]:
    """Replace every token of the patient's name (3+ letters) with [ism].

    Exact first (tolerating split letters and suffixes), then a conservative
    fuzzy pass for names of five letters or more, because speech-to-text often
    mishears a surname ("Ismoilov" -> "ism o'ylos").
    """
    changed = False
    for name in names:
        for token in re.split(r"[\s\-]+", name or ""):
            token = re.sub(r"[^\w']", "", token)
            if len(token) < 3:
                continue
            text, count = _name_pattern(token).subn(NAME_PLACEHOLDER, text)
            changed = changed or count > 0
            if len(_letters(token)) >= FUZZY_MIN_LETTERS:
                text, count = _fuzzy_scrub(text, token)
                changed = changed or count > 0
    return text, changed


def _scrub_card(card: VoiceCard, names: list[str]) -> tuple[VoiceCard, bool]:
    data = card.model_dump()
    changed = False
    for key in ("transcript", "chief_complaint", "onset"):
        if data.get(key):
            data[key], hit = scrub_names(data[key], names)
            changed = changed or hit
    for key in ("comorbidities", "medications"):
        cleaned = []
        for item in data[key]:
            item, hit = scrub_names(item, names)
            changed = changed or hit
            cleaned.append(item)
        data[key] = cleaned
    return VoiceCard.model_validate(data), changed


# --- providers ---------------------------------------------------------------

def _api_key() -> str:
    return settings.stt_api_key or settings.llm_api_key


def _gemini(audio_path: Path, names: list[str]) -> STTResult:
    from app.ai import preprocess

    if not _api_key():
        raise STTUnavailable("Gemini kaliti yo'q — matn maydonidan foydalaning")

    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="nazar-voice-") as tmp:
        flac = Path(tmp) / "voice.flac"
        seconds = preprocess.voice_to_flac(audio_path, flac)
        if seconds > preprocess.MAX_VOICE_SECONDS:
            raise STTUnavailable(f"Ovoz {seconds:.0f} s — {preprocess.MAX_VOICE_SECONDS} s dan uzun")
        audio = base64.b64encode(flac.read_bytes()).decode("ascii")

    body = {
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": "audio/flac", "data": audio}},
            {"text": PROMPT},
        ]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "maxOutputTokens": 2048,
        },
    }
    models = gemini.split_models(settings.stt_model, "gemini-3.1-flash-lite")
    try:
        text, model = gemini.generate(models, body, key=_api_key(), timeout=60.0)
    except gemini.GeminiError as exc:
        raise STTUnavailable(f"Gemini: {exc}") from exc

    try:
        start, end = text.find("{"), text.rfind("}")
        card = VoiceCard.model_validate(json.loads(text[start : end + 1]))
    except (ValueError, ValidationError) as exc:
        raise STTUnavailable(f"Gemini javobi schema'dan o'tmadi: {exc}") from exc

    card, redacted = _scrub_card(card, names)
    return STTResult(
        text=card.transcript,
        language=settings.stt_language,
        confidence=None,
        model_version=model,
        duration_ms=int((time.monotonic() - started) * 1000),
        audio_seconds=round(seconds, 1),
        card=card.model_dump(exclude={"transcript"}),
        redacted=redacted,
    )


_whisper_model = None


def _whisper(audio_path: Path, names: list[str]) -> STTResult:
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise STTUnavailable(
                "faster-whisper o'rnatilmagan — matn kiritish maydonidan foydalaning"
            ) from exc
        try:
            _whisper_model = WhisperModel(settings.whisper_model, device="cpu",
                                          compute_type="int8")
        except Exception as exc:  # noqa: BLE001 - download or load failure
            raise STTUnavailable(f"STT modeli yuklanmadi: {exc}") from exc

    started = time.monotonic()
    segments, info = _whisper_model.transcribe(str(audio_path), language=settings.stt_language)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    if not text:
        raise STTUnavailable("Nutq topilmadi")
    text, redacted = scrub_names(text, names)
    return STTResult(
        text=text,
        language=getattr(info, "language", settings.stt_language),
        confidence=getattr(info, "language_probability", None),
        model_version=f"faster-whisper/{settings.whisper_model}",
        duration_ms=int((time.monotonic() - started) * 1000),
        redacted=redacted,
    )


_PROVIDERS = {"gemini": _gemini, "whisper": _whisper}


def transcribe(audio_path: Path, *, patient_names: list[str] | None = None) -> STTResult:
    """Transcribe one voice note, with the patient's name scrubbed from the result."""
    provider = _PROVIDERS.get(settings.stt_provider)
    if provider is None:
        raise STTUnavailable(f"Noma'lum STT_PROVIDER: {settings.stt_provider}")
    return provider(Path(audio_path), [name for name in (patient_names or []) if name])
