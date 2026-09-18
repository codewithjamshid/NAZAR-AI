"""M2 voice notes: audio handling, Gemini transcription and name scrubbing (TZ §7, §11)."""

import json
import math
import shutil
import struct
import wave

import httpx
import pytest

from app import models as m
from app.ai import preprocess, stt
from app.config import settings
from app.services import ingest
from app.services.auth import hash_password


def write_wav(path, seconds: float, rate: int = 16000):
    """A plain sine tone: decodable audio without shipping a recording."""
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        frames = int(seconds * rate)
        handle.writeframes(b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / rate)))
            for i in range(frames)))
    return path


# --- name scrubbing ----------------------------------------------------------

@pytest.mark.parametrize("text, expected", [
    ("Bemorni bek murod ismli, gapir olmay yatti", "Bemorni [ism] ismli, gapir olmay yatti"),
    ("Bekmurodga dori berildi", "[ism] dori berildi"),
    ("ISMOILOV aka keldi", "[ism] aka keldi"),
    ("alimentar muammo, Ali keldi", "alimentar muammo, [ism] keldi"),
    ("O'ng qo'li ishlamayapti", "O'ng qo'li ishlamayapti"),
    # seen live: the surname misheard by speech-to-text
    ("Bemorni bek murod ism o'ylos, qo'li ishlamayapti", "Bemorni [ism] [ism], qo'li ishlamayapti"),
    ("Ismailov aka", "[ism] aka"),
])
def test_the_patient_name_is_scrubbed_even_when_split_or_suffixed(text, expected):
    scrubbed, _ = stt.scrub_names(text, ["Bekmurod Ismoilov", "Ali"])
    assert scrubbed == expected


# --- audio -------------------------------------------------------------------

def test_any_recording_is_normalised_to_16k_mono_flac(tmp_path):
    source = write_wav(tmp_path / "note.wav", 3.0, rate=44100)
    seconds = preprocess.voice_to_flac(source, tmp_path / "note.flac")

    assert abs(seconds - 3.0) < 0.05
    assert (tmp_path / "note.flac").read_bytes()[:4] == b"fLaC"
    assert abs(preprocess.audio_duration(source) - 3.0) < 0.05


def test_an_undecodable_file_is_refused(tmp_path):
    junk = tmp_path / "junk.webm"
    junk.write_bytes(b"\x1aE\xdf\xa3" + b"\x00" * 200)
    with pytest.raises(preprocess.PreprocessError):
        preprocess.audio_duration(junk)


@pytest.fixture
def storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_path", tmp_path / "storage")
    return tmp_path / "storage"


def test_a_voice_note_over_120_seconds_is_refused_at_upload(tmp_path, storage_dir):
    long_note = write_wav(tmp_path / "long.wav", 125.0, rate=8000)
    with long_note.open("rb") as handle, pytest.raises(ingest.IngestError, match="120"):
        ingest.store_upload(handle, 1, "voice")
    assert not [path for path in storage_dir.rglob("*") if path.is_file()]


def test_a_normal_voice_note_is_accepted(tmp_path, storage_dir):
    note = write_wav(tmp_path / "note.wav", 5.0)
    with note.open("rb") as handle:
        stored = ingest.store_upload(handle, 1, "voice")
    assert stored.format == "wav" and stored.source == "audio"


# --- Gemini transcription ----------------------------------------------------

@pytest.fixture
def gemini_stt(monkeypatch):
    monkeypatch.setattr(settings, "stt_provider", "gemini")
    monkeypatch.setattr(settings, "stt_api_key", "test-key")
    monkeypatch.setattr(settings, "stt_model", "gemini-3.1-flash-lite,gemini-3.5-flash")
    from app.services import gemini

    monkeypatch.setattr(gemini.time, "sleep", lambda *_: None)


def reply(payload):
    text = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else payload
    return 200, {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}


def scripted(monkeypatch, responses):
    calls = []

    def post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        status, body = responses[min(len(calls) - 1, len(responses) - 1)]
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", post)
    return calls


CARD = {
    "transcript": "Bemor Bekmurod, o'ng qo'li ishlamayapti, ertalab boshlandi.",
    "chief_complaint": "Bekmurodning o'ng qo'li ishlamayapti",
    "onset": "ertalab",
    "comorbidities": ["qandli diabet"],
    "medications": ["metformin"],
}


def test_gemini_transcribes_and_the_name_never_survives(gemini_stt, monkeypatch, tmp_path):
    calls = scripted(monkeypatch, [reply(CARD)])
    note = write_wav(tmp_path / "note.wav", 2.0)

    result = stt.transcribe(note, patient_names=["Bekmurod Ismoilov"])

    assert "Bekmurod" not in result.text and "[ism]" in result.text
    assert "Bekmurod" not in json.dumps(result.card, ensure_ascii=False)
    assert result.redacted is True
    assert result.card["medications"] == ["metformin"]
    assert result.model_version == "gemini-3.1-flash-lite"

    request = calls[0]
    assert request["headers"]["x-goog-api-key"] == "test-key"
    assert "test-key" not in request["url"]
    audio_part = request["json"]["contents"][0]["parts"][0]["inline_data"]
    assert audio_part["mime_type"] == "audio/flac"


def test_a_second_model_is_used_when_the_first_is_out_of_quota(gemini_stt, monkeypatch, tmp_path):
    scripted(monkeypatch, [(429, {"error": {"message": "quota"}}), reply(CARD)])
    result = stt.transcribe(write_wav(tmp_path / "n.wav", 1.0), patient_names=[])
    assert result.model_version == "gemini-3.5-flash"


def test_no_usable_answer_means_no_transcript(gemini_stt, monkeypatch, tmp_path):
    scripted(monkeypatch, [reply("I could not understand the audio.")])
    with pytest.raises(stt.STTUnavailable):
        stt.transcribe(write_wav(tmp_path / "n.wav", 1.0))


def test_without_a_key_nothing_is_sent(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "stt_provider", "gemini")
    monkeypatch.setattr(settings, "stt_api_key", "")
    calls = scripted(monkeypatch, [reply(CARD)])
    with pytest.raises(stt.STTUnavailable):
        stt.transcribe(write_wav(tmp_path / "n.wav", 1.0))
    assert calls == []


# --- through the worker ------------------------------------------------------

def test_the_worker_stores_the_transcript_but_never_moves_the_timer(
        db, gemini_stt, monkeypatch, storage_dir, tmp_path):
    from datetime import datetime, timezone

    from app.workers import tasks

    scripted(monkeypatch, [reply({**CARD, "onset": "10 kun oldin"})])
    facility = m.Facility(name="FAP V", type="fap", district="Xiva")
    nurse = m.User(full_name="N", role="nurse", phone="+77", password_hash=hash_password("x"),
                   facility=facility)
    patient = m.Patient(full_name="Bekmurod Ismoilov", birth_year=1968, sex="male")
    db.add_all([facility, nurse, patient])
    db.flush()
    onset = datetime(2026, 9, 18, 7, 40, tzinfo=timezone.utc)
    case = m.Case(patient=patient, created_by=nurse.id, facility=facility, symptom_onset_at=onset)
    db.add(case)
    db.flush()

    rel_path = f"cases/{case.id}/voice.wav"
    target = storage_dir / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(write_wav(tmp_path / "v.wav", 2.0), target)
    study = m.Study(case_id=case.id, type="voice", source="audio", file_path=rel_path,
                    status="queued")
    db.add(study)
    db.flush()

    assert tasks._process(db, study) is True

    result = next(row for row in study.ai_results if row.module == "stt")
    assert "[ism]" in result.output_json["text"] and "Bekmurod" not in result.output_json["text"]
    assert result.output_json["name_redacted"] is True
    assert case.anamnesis.voice_transcript == result.output_json["text"]
    assert case.anamnesis.structured_json["voice_card"]["onset"] == "10 kun oldin"
    # The misheard onset stays text; the timer keeps the nurse's recorded time.
    assert case.symptom_onset_at == onset


@pytest.mark.parametrize("text", [
    "Qandli diabeti bor, metformin ichadi",
    "gapir olmay yatti, ertalab soat yettida boshlandi",
    "Ismli bemor keldi, ismini aytmadi",
    "Insult shubhasi, BE-FAST 6 ball",
])
def test_the_fuzzy_pass_leaves_clinical_words_alone(text):
    scrubbed, changed = stt.scrub_names(text, ["Bekmurod Ismoilov"])
    assert scrubbed == text and changed is False
