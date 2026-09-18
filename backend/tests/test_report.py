"""M7 report: the Gemini path, its guard and the template fallback (TZ §7, §11)."""

import json

import httpx
import pytest

from app.config import settings
from app.services import report

CONTEXT = {
    "zone": "red", "zone_uz": "QIZIL",
    "specialist_type": "neurologist", "specialist_uz": "nevrolog",
    "route": "regional", "route_uz": "viloyat markazi",
    "reasons": ["BE-FAST: yuz osilishi (6 ball) — insult shubhasi; simptomdan 40 daqiqa "
                "o'tdi, trombolizis oynasi ochiq (230 daqiqa qoldi)"],
    "readers_agree": None, "time_window_min": 230,
    "rules_version": "draft1", "models": [], "patient_age": 58,
}

GOOD = {
    "nurse": "QIZIL zona: insult shubhasi. Bemorni viloyat markaziga yuboring, "
             "nevrolog xabardor qilindi, uning qarorini kuting.",
    "specialist": "BE-FAST 6 ball, insult shubhasi. Simptomdan 40 daqiqa o'tgan, "
                  "trombolizis oynasi ochiq. Qoidalar bo'yicha yo'nalish: viloyat markazi.",
}


@pytest.fixture
def gemini(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_model", "gemini-2.5-flash")
    from app.services import gemini as gemini_client

    monkeypatch.setattr(gemini_client.time, "sleep", lambda *_: None)


def scripted(monkeypatch, responses):
    """httpx.post that plays back (status, body) pairs and records each request."""
    calls = []

    def post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        status, body = responses[min(len(calls) - 1, len(responses) - 1)]
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", post)
    return calls


def answer(payload, finish="STOP"):
    text = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else payload
    return (200, {"candidates": [{"content": {"parts": [{"text": text}]},
                                  "finishReason": finish}]})


def test_a_clean_gemini_draft_is_used(gemini, monkeypatch):
    calls = scripted(monkeypatch, [answer(GOOD)])

    nurse, specialist, model = report.generate(CONTEXT)

    assert model == "gemini-2.5-flash"
    assert nurse.startswith("QIZIL") and "viloyat" in specialist
    assert len(calls) == 1


def test_the_key_goes_in_a_header_and_never_in_the_url(gemini, monkeypatch):
    calls = scripted(monkeypatch, [answer(GOOD)])
    report.generate(CONTEXT)

    assert calls[0]["headers"]["x-goog-api-key"] == "test-key"
    assert "test-key" not in calls[0]["url"] and "key=" not in calls[0]["url"]
    config = calls[0]["json"]["generationConfig"]
    assert config["temperature"] == 0 and config["responseMimeType"] == "application/json"


def test_a_draft_that_orders_treatment_is_thrown_away(gemini, monkeypatch):
    """The exact failure seen live: the model added an ECG and IV access."""
    bad = {"nurse": "Bemorning tomir ichiga kirishni ta'minlang va zudlik bilan EKG qiling.",
           "specialist": "Trombolitik terapiya imkoniyatini baholang."}
    scripted(monkeypatch, [answer(bad)])

    nurse, specialist, model = report.generate(CONTEXT)

    assert model == report.TEMPLATE_VERSION
    assert "EKG" not in nurse


def test_a_draft_with_an_invented_diagnosis_is_thrown_away(gemini, monkeypatch):
    bad = {"nurse": "Bemorda pnevmoniya bor.", "specialist": "Pnevmoniya belgilari."}
    scripted(monkeypatch, [answer(bad)])
    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION


def test_words_already_in_the_reasons_are_allowed(gemini, monkeypatch):
    """'trombolizis' is in the input, so restating the open window is fine."""
    assert report.unsupported_terms(GOOD["nurse"] + GOOD["specialist"], CONTEXT) == []


def test_a_busy_service_is_retried_once(gemini, monkeypatch):
    calls = scripted(monkeypatch, [(503, {"error": {"message": "high demand"}}), answer(GOOD)])
    assert report.generate(CONTEXT)[2] == "gemini-2.5-flash"
    assert len(calls) == 2


def test_a_bad_request_is_not_retried_and_keeps_the_template(gemini, monkeypatch):
    calls = scripted(monkeypatch, [(400, {"error": {"message": "bad"}})])
    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION
    assert len(calls) == 1


def test_a_truncated_answer_keeps_the_template(gemini, monkeypatch):
    scripted(monkeypatch, [answer('{"nurse": "QIZIL', finish="MAX_TOKENS")])
    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION


def test_prose_instead_of_json_keeps_the_template(gemini, monkeypatch):
    scripted(monkeypatch, [answer("Bemor holati og'ir.")])
    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION


def test_without_a_key_nothing_is_sent(monkeypatch):
    calls = scripted(monkeypatch, [answer(GOOD)])
    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION
    assert calls == []


def test_the_model_defaults_per_provider(monkeypatch):
    monkeypatch.setattr(settings, "llm_model", "")
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    assert report.model_name() == "gemini-2.5-flash"
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    assert report.model_name() == "claude-opus-5"


def test_the_missing_second_reader_is_spelled_out_for_the_model(gemini, monkeypatch):
    """A bare null was paraphrased as "no agreement", which reads like a disagreement."""
    calls = scripted(monkeypatch, [answer(GOOD)])
    report.generate(CONTEXT)

    sent = calls[0]["json"]["contents"][0]["parts"][0]["text"]
    assert "readers_agree" not in sent
    assert "ikkinchi o'quvchi yo'q" in sent


def test_disagreement_is_spelled_out_too():
    payload = report.llm_payload({**CONTEXT, "readers_agree": False})
    assert "KELISHMADI" in payload["ikki_oquvchi"]


def test_a_rate_limit_is_raised_for_a_later_retry_not_swallowed(gemini, monkeypatch):
    """The worker re-queues on 429; generate() alone still falls back to the template."""
    calls = scripted(monkeypatch, [(429, {"error": {"message": "quota"}})])

    with pytest.raises(report.RateLimited):
        report.llm_report(CONTEXT)
    assert len(calls) == 1                        # no pointless immediate retry

    assert report.generate(CONTEXT)[2] == report.TEMPLATE_VERSION


def test_a_second_model_takes_over_when_the_first_is_out_of_quota(gemini, monkeypatch):
    monkeypatch.setattr(settings, "llm_model", "gemini-3.1-flash-lite, gemini-2.5-flash")
    calls = scripted(monkeypatch, [(429, {"error": {"message": "quota"}}), answer(GOOD)])

    nurse, specialist, model = report.llm_report(CONTEXT)

    assert model == "gemini-2.5-flash"
    assert [call["url"].split("/models/")[1].split(":")[0] for call in calls] == [
        "gemini-3.1-flash-lite", "gemini-2.5-flash"]


def test_all_models_out_of_quota_is_a_rate_limit(gemini, monkeypatch):
    monkeypatch.setattr(settings, "llm_model", "a, b")
    scripted(monkeypatch, [(429, {"error": {"message": "quota"}})])
    with pytest.raises(report.RateLimited):
        report.llm_report(CONTEXT)
