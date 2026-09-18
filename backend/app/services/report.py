"""M7 report generator (TZ §7).

Turns the triage outcome into two texts: one for the nurse, one for the
specialist. Two guards keep the LLM inside its job (TZ §11):

* it may only restate findings that are already in the input — a draft that
  names a diagnosis nobody reported is rejected;
* if the API is absent, slow or rejected, the deterministic Uzbek template is
  used instead, so a case always carries a readable summary.

The patient's name never reaches the cloud: the payload carries age, zone,
reasons and model numbers only.
"""

import json
import logging
import re

from app import i18n
from app.config import settings

log = logging.getLogger(__name__)

TEMPLATE_VERSION = "template-v1"
MAX_TOKENS = 700

SYSTEM_PROMPT = (
    "Sen tibbiy triyaj tizimining hisobot yozuvchisisan. Sen tashxis qo'ymaysan "
    "va yangi topilma qo'shmaysan: faqat berilgan natijalarni tushuntirasan. "
    "Kirishda bo'lmagan kasallik nomini ishlatma. Javob o'zbek tilida (lotin), "
    "faqat JSON: {\"nurse\": \"...\", \"specialist\": \"...\"}. "
    "nurse — 2-3 sodda jumla va keyingi qadam. "
    "specialist — strukturali xulosa: topilmalar, ehtimollar, ikki o'quvchi kelishuvi, tavsiya."
)

# Diagnosis words the report may only use when the input already mentions them.
WATCHED_TERMS = sorted(
    {term.lower() for term in i18n.PATHOLOGY_UZ.values()}
    | {term.lower() for term in i18n.PATHOLOGY_UZ}
    | {term.lower() for term in i18n.HEMORRHAGE_TYPE_UZ.values() if term != "yo'q"}
    | {"insult", "gemorragik", "ishemik", "qon quyilishi", "o'sma", "sil", "rak"}
)


def _next_step(zone: str, specialist: str, route: str) -> str:
    specialist_uz = i18n.SPECIALIST_UZ.get(specialist, specialist)
    route_uz = i18n.ROUTE_UZ.get(route, route)
    if zone == "red":
        return (f"Shoshilinch: bemorni {route_uz}ga yuboring, {specialist_uz} xabardor qilindi.")
    if zone == "yellow":
        return (f"{specialist_uz.capitalize()} navbatda ko'radi. Yo'nalish: {route_uz}.")
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
        nurse_lines.append(
            f"Trombolizis oynasi: {context['time_window_min']} daqiqa qoldi."
        )

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


def _mentions(text: str, term: str) -> bool:
    """Whole-word match, so 'sil' does not hide inside 'osilishi'."""
    return re.search(rf"(?<![\w'])({re.escape(term)})(?![\w'])", text) is not None


def _allowed_terms(context: dict) -> set[str]:
    haystack = " ".join(
        [*(context.get("reasons") or []), json.dumps(context.get("findings") or [], ensure_ascii=False)]
    ).lower()
    return {term for term in WATCHED_TERMS if _mentions(haystack, term)}


def unsupported_terms(text: str, context: dict) -> list[str]:
    """Diagnosis words in `text` that the input never mentioned."""
    allowed = _allowed_terms(context)
    lowered = text.lower()
    return sorted(
        term for term in WATCHED_TERMS
        if term not in allowed and _mentions(lowered, term)
    )


def _llm_report(context: dict) -> tuple[str, str, str]:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.llm_api_key)
    payload = json.dumps(context, ensure_ascii=False, indent=2)
    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": f"Triyaj natijasi:\n{payload}"}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("model javob berishdan bosh tortdi")
    text = "".join(block.text for block in response.content if block.type == "text")

    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("JSON topilmadi")
    data = json.loads(text[start : end + 1])
    nurse, specialist = str(data["nurse"]).strip(), str(data["specialist"]).strip()
    if not nurse or not specialist:
        raise ValueError("bo'sh matn")

    invented = unsupported_terms(nurse + " " + specialist, context)
    if invented:
        raise ValueError(f"kirishda bo'lmagan tashxis: {', '.join(invented)}")
    return nurse, specialist, f"{settings.llm_model}"


def generate(context: dict) -> tuple[str, str, str]:
    """Return (nurse text, specialist text, model label). Falls back to the template."""
    if settings.llm_api_key and settings.llm_provider == "anthropic":
        try:
            return _llm_report(context)
        except Exception as exc:  # noqa: BLE001 - any failure falls back to the template
            log.warning("LLM report failed, using template: %s", exc)
    return template_report(context)
