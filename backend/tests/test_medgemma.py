"""MedGemma client: schema discipline, retries and the stub path (TZ §11, §15 R3)."""

import json

import httpx
import pytest

from app.ai import medgemma
from app.config import settings


@pytest.fixture
def cache_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "demo_data_path", tmp_path)
    return tmp_path


def write_cache(cache_dir, task: str, key: str, payload: dict):
    path = cache_dir / "medgemma" / task / f"{key}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


CLEAN_CT = {"hemorrhage": "no", "hemorrhage_type": "none",
            "midline_shift": "no", "findings": [], "confidence": "high"}


# --- parsing -----------------------------------------------------------------

def test_json_is_found_inside_a_fence_or_prose():
    assert medgemma.extract_json('```json\n{"a": 1}\n```')["a"] == 1
    assert medgemma.extract_json('Here it is: {"a": 2} — done')["a"] == 2


def test_an_answer_without_json_is_rejected():
    with pytest.raises(medgemma.MedGemmaInvalidOutput):
        medgemma.extract_json("The scan looks normal to me.")


def test_a_label_outside_the_list_is_rejected():
    with pytest.raises(medgemma.MedGemmaInvalidOutput):
        medgemma.validate("ct_head", {"hemorrhage": "probably", "confidence": "high"})
    with pytest.raises(medgemma.MedGemmaInvalidOutput):
        medgemma.validate("cxr", {"findings": [{"label": "tuberculosis"}],
                                  "confidence": "high"})


# --- stub mode ---------------------------------------------------------------

def test_stub_serves_a_recorded_reading_and_marks_it(cache_dir, monkeypatch):
    monkeypatch.setattr(settings, "medgemma_stub", True)
    write_cache(cache_dir, "ct_head", "series-1",
                {**CLEAN_CT, "_meta": {"model_version": "google/medgemma-1.5-4b-it"}})

    result = medgemma.infer("ct_head", [], "series-1")

    assert result.reading["hemorrhage"] == "no"
    assert result.model_version.endswith("@stub")


def test_stub_without_a_recording_is_unavailable_not_invented(cache_dir, monkeypatch):
    monkeypatch.setattr(settings, "medgemma_stub", True)
    with pytest.raises(medgemma.MedGemmaUnavailable):
        medgemma.infer("ct_head", [], "series-missing")


def test_a_corrupt_recording_is_rejected_too(cache_dir, monkeypatch):
    monkeypatch.setattr(settings, "medgemma_stub", True)
    write_cache(cache_dir, "ct_head", "series-2", {"hemorrhage": "sort of"})
    with pytest.raises(medgemma.MedGemmaInvalidOutput):
        medgemma.infer("ct_head", [], "series-2")


# --- live service ------------------------------------------------------------

def fake_service(monkeypatch, answers: list[str]):
    """Replace httpx.post with a scripted service; returns the call counter."""
    calls = {"n": 0}

    def post(url, json=None, headers=None, timeout=None):
        index = min(calls["n"], len(answers) - 1)
        calls["n"] += 1
        return httpx.Response(
            200,
            json={"text": answers[index], "model_version": "google/medgemma-1.5-4b-it",
                  "duration_ms": 1200},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", post)
    return calls


def test_a_good_answer_is_returned_on_the_first_try(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "medgemma_stub", False)
    calls = fake_service(monkeypatch, [json.dumps(CLEAN_CT)])
    image = tmp_path / "slice.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n")

    result = medgemma.infer("ct_head", [image], "series-x")

    assert calls["n"] == 1
    assert result.reading["confidence"] == "high"
    assert result.model_version == "google/medgemma-1.5-4b-it"
    assert not result.model_version.endswith("@stub")


def test_a_bad_answer_is_retried_and_then_accepted(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "medgemma_stub", False)
    calls = fake_service(monkeypatch, ["no json here", "{broken", json.dumps(CLEAN_CT)])
    image = tmp_path / "slice.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n")

    result = medgemma.infer("ct_head", [image], "series-x")

    assert calls["n"] == 3
    assert result.reading["hemorrhage"] == "no"


def test_three_bad_answers_end_as_a_failure_not_a_guess(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "medgemma_stub", False)
    calls = fake_service(monkeypatch, ["nope"])
    image = tmp_path / "slice.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n")

    with pytest.raises(medgemma.MedGemmaInvalidOutput):
        medgemma.infer("ct_head", [image], "series-x")
    assert calls["n"] == medgemma.ATTEMPTS == 3


def test_an_unreachable_service_is_unavailable(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "medgemma_stub", False)

    def boom(*args, **kwargs):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(httpx, "post", boom)
    image = tmp_path / "slice.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n")

    with pytest.raises(medgemma.MedGemmaUnavailable):
        medgemma.infer("ct_head", [image], "series-x")


def test_prompts_exist_for_every_task():
    for task in ("ct_head", "cxr", "lab"):
        text = medgemma.prompt_for(task)
        assert "JSON" in text and len(text) > 200
