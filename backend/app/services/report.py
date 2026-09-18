"""M7 report generator (TZ §7).

Turns a stored triage result into two texts: one for the nurse, one for the
specialist. The triage engine has already decided the zone and the route; the
report only restates them, so three guards keep the cloud model in that lane
(TZ §7 M7, §11):

* the prompt forbids diagnoses, treatment and orders of any kind;
* a draft that uses a clinical term (a diagnosis, a drug, a procedure) the input
  never mentioned is rejected;
* anything slow, refused or malformed falls back to the deterministic Uzbek
  template, which every case always carries first.

The model call runs in the worker after the triage is committed, never inside
the nurse's request (TZ §11: every nurse screen within 2 s).

Identity never reaches the cloud: the payload carries age, zone, reasons and
model numbers, built by `report_context` and nothing else.
"""

import json
import logging
import re
from datetime import datetime, timezone

from app import i18n
from app.config import settings
from app.services import gemini

log = logging.getLogger(__name__)

TEMPLATE_VERSION = "template-v1"
MAX_OUTPUT_TOKENS = 1024
LLM_TIMEOUT = 20.0

DEFAULT_MODELS = {"anthropic": "claude-opus-5", "gemini": "gemini-2.5-flash"}

SYSTEM_PROMPT = """Sen qishloq tibbiy triyaj tizimining hisobot yozuvchisisan.
Senga triyaj natijasi JSON holida beriladi. Vazifang faqat shu natijani sodda tilda qayta aytish.

Qat'iy qoidalar:
1. Faqat kirishdagi faktlarni ishlat: zona, sabablar (reasons), mutaxassis, yo'nalish, taymer, ikki o'quvchi kelishuvi.
2. Tashxis qo'yma. Kirishda bo'lmagan kasallik yoki topilma nomini yozma.
3. Hech qanday davolash, dori, muolaja yoki tekshiruv buyurma yoki tavsiya qilma
   (masalan EKG, tomir ichiga yuborish, kislorod, dori, MRT). Buni faqat mutaxassis hal qiladi.
4. Keyingi qadam sifatida faqat berilgan mutaxassis va yo'nalishni ayt va mutaxassis qarorini kutishni eslat.
5. Raqamlarni o'zgartirma, yangi raqam qo'shma.
6. Ikki o'quvchi haqida faqat "ikki_oquvchi" maydonidagi iborani so'zma-so'z ishlat.
7. O'zbek tili, lotin yozuvi.

Javob faqat JSON: {"nurse": "...", "specialist": "..."}
nurse: 2-3 qisqa jumla — zona, asosiy sabab, keyingi qadam.
specialist: 3-5 jumla — sabablar va raqamlar, ikki o'quvchi kelishuvi, qoidalar bo'yicha yo'nalish."""

# Clinical words a draft may only use when the input already contains them.
_DIAGNOSIS_TERMS = (
    {term.lower() for term in i18n.PATHOLOGY_UZ.values()}
    | {term.lower() for term in i18n.PATHOLOGY_UZ}
    | {term.lower() for term in i18n.HEMORRHAGE_TYPE_UZ.values() if term != "yo'q"}
    | {"insult", "gemorragik", "ishemik", "qon quyilishi", "o'sma", "sil", "rak",
       "infarkt", "sepsis", "meningit", "pnevmoniya", "tuberkulyoz"}
)
_ACTION_TERMS = {
    "ekg", "elektrokardiogramma", "tomir ichi", "tomir ichiga", "vena", "kateter",
    "infuziya", "tomchi", "dori", "preparat", "in'eksiya", "ukol", "kislorod",
    "intubatsiya", "tromboliz", "trombolitik", "trombolizis", "alteplaza", "aspirin",
    "geparin", "antibiotik", "mrt", "kt", "rentgen", "operatsiya", "jarrohlik",
    "reanimatsiya", "qon bosimi", "hayotiy belgilar", "analiz", "tahlil topshir",
    "shifoxonaga yotqiz", "gospitalizatsiya",
}
WATCHED_TERMS = sorted(_DIAGNOSIS_TERMS | _ACTION_TERMS)


class ReportRejected(ValueError):
    """The model answered, but the draft broke one of the rules above."""


RateLimited = gemini.RateLimited   # the worker retries later on this one


# --- context -----------------------------------------------------------------

def report_context(case, triage_row) -> dict:
    """Everything the report may talk about. No name, no phone, no free text."""
    age = None
    if case.patient is not None and case.patient.birth_year:
        age = datetime.now(timezone.utc).year - case.patient.birth_year
    models = []
    for study in case.studies:
        for result in study.ai_results:
            if result.model_version and result.model_version not in models:
                models.append(result.model_version)
    return {
        "zone": triage_row.zone,
        "zone_uz": i18n.ZONE_UZ.get(triage_row.zone, triage_row.zone),
        "specialist_type": triage_row.specialist_type,
        "specialist_uz": i18n.SPECIALIST_UZ.get(triage_row.specialist_type,
                                                triage_row.specialist_type),
        "route": triage_row.route,
        "route_uz": i18n.ROUTE_UZ.get(triage_row.route, triage_row.route),
        "reasons": list(triage_row.reasons_json or []),
        "readers_agree": triage_row.readers_agree,
        "time_window_min": triage_row.time_window_min,
        "rules_version": triage_row.rules_version,
        "models": models,
        "patient_age": age,
    }


# --- deterministic template --------------------------------------------------

def _next_step(zone: str, specialist: str, route: str) -> str:
    specialist_uz = i18n.SPECIALIST_UZ.get(specialist, specialist)
    route_uz = i18n.ROUTE_UZ.get(route, route)
    if zone == "red":
        return f"Shoshilinch: bemorni {route_uz}ga yuboring, {specialist_uz} xabardor qilindi."
    if zone == "yellow":
        return f"{specialist_uz.capitalize()} navbatda ko'radi. Yo'nalish: {route_uz}."
    return f"Shoshilinch belgi yo'q. Yo'nalish: {route_uz}, {specialist_uz} tasdiqlaydi."


def template_report(context: dict) -> tuple[str, str, str]:
    """Deterministic Uzbek summary built from the triage outcome."""
    zone = context["zone"]
    reasons = context.get("reasons") or []
    zone_word = i18n.ZONE_UZ.get(zone, zone.upper())
    headline = {
        "red": "Shoshilinch holat.",
        "yellow": "Ehtiyot zonasi — mutaxassis ko'rishi kerak.",
        "green": "Shoshilinch xavf belgilari topilmadi.",
    }[zone]

    nurse_lines = [f"{zone_word} zona. {headline}"]
    if reasons:
        nurse_lines.append(f"Asos: {reasons[0]}")
    nurse_lines.append(_next_step(zone, context["specialist_type"], context["route"]))
    if context.get("time_window_min") is not None:
        nurse_lines.append(f"Trombolizis oynasi: {context['time_window_min']} daqiqa qoldi.")

    specialist_lines = [
        f"Zona: {zone_word}. Mutaxassis: "
        f"{i18n.SPECIALIST_UZ.get(context['specialist_type'], context['specialist_type'])}. "
        f"Yo'nalish: {i18n.ROUTE_UZ.get(context['route'], context['route'])}.",
        "Asoslar:",
        *[f"  - {reason}" for reason in reasons],
    ]
    agree = context.get("readers_agree")
    specialist_lines.append(
        "Ikki o'quvchi: " + {
            True: "kelishdi.",
            False: "KELISHMADI — ehtiyot zonasi qo'llanildi.",
            None: "solishtirib bo'lmadi (ikkinchi o'quvchi yo'q).",
        }[agree]
    )
    if context.get("models"):
        specialist_lines.append("Modellar: " + ", ".join(context["models"]))
    specialist_lines.append(
        f"Qoidalar versiyasi: {context.get('rules_version', '-')}. "
        "Dastlabki tahlil — shifokor tasdig'i talab qilinadi."
    )
    return "\n".join(nurse_lines), "\n".join(specialist_lines), TEMPLATE_VERSION


# --- guard -------------------------------------------------------------------

def _mentions(text: str, term: str) -> bool:
    """Whole-word match, so 'sil' does not hide inside 'osilishi'."""
    return re.search(rf"(?<![\w'])({re.escape(term)})(?![\w'])", text) is not None


def _allowed_terms(context: dict) -> set[str]:
    haystack = " ".join([
        *(context.get("reasons") or []),
        str(context.get("specialist_uz", "")),
        str(context.get("route_uz", "")),
    ]).lower()
    return {term for term in WATCHED_TERMS if _mentions(haystack, term)}


def unsupported_terms(text: str, context: dict) -> list[str]:
    """Clinical words in `text` (diagnoses, drugs, procedures) the input never used."""
    allowed = _allowed_terms(context)
    lowered = text.lower()
    return sorted(term for term in WATCHED_TERMS
                  if term not in allowed and _mentions(lowered, term))


def check_draft(nurse: str, specialist: str, context: dict) -> tuple[str, str]:
    nurse, specialist = nurse.strip(), specialist.strip()
    if not nurse or not specialist:
        raise ReportRejected("bo'sh matn")
    invented = unsupported_terms(nurse + " " + specialist, context)
    if invented:
        raise ReportRejected(f"kirishda bo'lmagan klinik atama: {', '.join(invented)}")
    return nurse, specialist


def _parse(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ReportRejected("JSON topilmadi")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ReportRejected(f"JSON o'qilmadi: {exc}") from exc
    if not isinstance(data, dict) or "nurse" not in data or "specialist" not in data:
        raise ReportRejected("JSON da nurse/specialist yo'q")
    return data


# --- providers ---------------------------------------------------------------

def model_names() -> list[str]:
    """LLM_MODEL may list several models, comma separated. Free-tier quotas are
    per model, so when one answers 429 the next one is tried."""
    return gemini.split_models(settings.llm_model, DEFAULT_MODELS.get(settings.llm_provider, ""))


def model_name() -> str:
    return model_names()[0]


def llm_enabled() -> bool:
    return bool(settings.llm_api_key) and settings.llm_provider in DEFAULT_MODELS


READERS_UZ = {
    True: "ikki o'quvchi kelishdi",
    False: "ikki o'quvchi KELISHMADI, shuning uchun ehtiyot zonasi qo'llanildi",
    None: "ikki o'quvchini solishtirib bo'lmadi, chunki ikkinchi o'quvchi yo'q",
}


def llm_payload(context: dict) -> dict:
    """What the cloud model sees: the context with ambiguous fields spelled out.

    A bare `readers_agree: null` was paraphrased as "no agreement", which reads
    like a disagreement. The model now gets the exact phrase to repeat.
    """
    payload = {key: value for key, value in context.items() if key != "readers_agree"}
    payload["ikki_oquvchi"] = READERS_UZ[context.get("readers_agree")]
    return payload


def _user_message(context: dict) -> str:
    return "Triyaj natijasi:\n" + json.dumps(llm_payload(context), ensure_ascii=False, indent=2)


def _anthropic_draft(context: dict) -> tuple[str, str]:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.llm_api_key, timeout=LLM_TIMEOUT)
    response = client.messages.create(
        model=model_name(),
        max_tokens=MAX_OUTPUT_TOKENS,
        system=SYSTEM_PROMPT,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": _user_message(context)}],
    )
    if response.stop_reason == "refusal":
        raise ReportRejected("model javob berishdan bosh tortdi")
    return "".join(block.text for block in response.content if block.type == "text"), model_name()


def _gemini_draft(context: dict) -> tuple[str, str]:
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": _user_message(context)}]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            # Restating a result needs no reasoning; thinking tokens would also
            # eat the output budget and truncate the JSON.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    try:
        return gemini.generate(model_names(), body, key=settings.llm_api_key,
                               timeout=LLM_TIMEOUT)
    except gemini.Rejected as exc:
        raise ReportRejected(str(exc)) from exc


_PROVIDERS = {"anthropic": _anthropic_draft, "gemini": _gemini_draft}


def llm_report(context: dict) -> tuple[str, str, str]:
    """Ask the configured cloud model. Raises on any failure or rule break."""
    draft, used_model = _PROVIDERS[settings.llm_provider](context)
    data = _parse(draft)
    nurse, specialist = check_draft(str(data["nurse"]), str(data["specialist"]), context)
    return nurse, specialist, used_model


def generate(context: dict) -> tuple[str, str, str]:
    """Return (nurse text, specialist text, model label). Falls back to the template."""
    if llm_enabled():
        try:
            return llm_report(context)
        except Exception as exc:  # noqa: BLE001 - any failure falls back to the template
            log.warning("LLM report (%s) rejected, keeping the template: %s",
                        settings.llm_provider, exc)
    return template_report(context)
