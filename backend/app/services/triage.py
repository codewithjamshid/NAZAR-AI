"""M6 triage engine (TZ §7, §8).

Two independent readers, then the neurosurgeon's rules:

* every threshold comes from rules/triage.yaml — nothing clinical is hard-coded here;
* a signal is a named condition the rules file can put in a zone or a routing rule;
* missing data, a failed module or two readers that disagree can only produce
  yellow, never green (TZ §11 "xavfsiz tomonga xato").

``evaluate`` is a pure function so it can be tested without a database.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app import i18n

# Every signal the engine can raise. rules/triage.yaml is validated against this.
KNOWN_SIGNALS = {
    "stroke_in_window", "stroke_late", "stroke_onset_unknown",
    "red_flag_unconscious", "red_flag_breathing", "chest_pain",
    "ich_high", "ich_moderate",
    "ct_hemorrhage", "ct_uncertain", "ct_not_read", "ct_single_reader",
    "cxr_red", "cxr_yellow", "cxr_multi",
    "lab_critical", "readers_disagree", "ai_failed", "data_incomplete",
}

# Status values a study can have while triage runs.
PENDING = "pending"
DONE = "done"
FAILED = "failed"


@dataclass
class CTReadings:
    status: str = PENDING
    medgemma: dict | None = None        # validated CTReading payload
    ich_probability: float | None = None  # ICH CNN second reader, None when absent


@dataclass
class CXRReadings:
    status: str = PENDING
    probabilities: dict[str, float] | None = None  # torchxrayvision, primary reader
    medgemma: dict | None = None                   # validated CXRReading payload


@dataclass
class TriageInputs:
    befast: dict[str, bool] | None = None     # None = questionnaire not filled
    flags: dict[str, bool] = field(default_factory=dict)
    onset_at: datetime | None = None
    ct: CTReadings | None = None              # None = no head CT uploaded
    cxr: CXRReadings | None = None
    labs: dict[str, float] = field(default_factory=dict)
    failed_modules: list[str] = field(default_factory=list)


@dataclass
class TriageOutcome:
    zone: str
    specialist_type: str
    route: str
    reasons: list[str]
    signals: list[str]
    time_window_min: int | None
    readers_agree: bool | None
    stroke: dict
    rules_version: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _befast_summary(befast: dict[str, bool], rules: dict) -> tuple[int, list[str], bool]:
    points = rules["befast"]["points"]
    yes = [key for key, value in befast.items() if value and key in points]
    score = sum(points[key] for key in yes)
    suspected = score >= rules["befast"]["stroke_min_score"] or any(
        key in yes for key in rules["befast"]["stroke_any_of"]
    )
    labels = [i18n.BEFAST_UZ.get(key, key) for key in yes]
    return score, labels, suspected


class _Signals:
    """Collects fired signals with their Uzbek explanation, preserving order."""

    def __init__(self) -> None:
        self.fired: dict[str, str] = {}
        self.context: list[str] = []

    def fire(self, name: str, reason: str) -> None:
        if name not in KNOWN_SIGNALS:
            raise ValueError(f"unknown signal: {name}")
        self.fired.setdefault(name, reason)

    def note(self, text: str) -> None:
        self.context.append(text)


def _evaluate_stroke(inp: TriageInputs, rules: dict, now: datetime, sig: _Signals) -> dict:
    window = rules["stroke_window"]
    stroke = {
        "befast_done": inp.befast is not None,
        "score": None,
        "suspected": False,
        "onset_at": inp.onset_at.isoformat() if inp.onset_at else None,
        "elapsed_min": None,
        "remaining_min": None,
        "window_state": None,
    }
    if inp.onset_at is not None:
        elapsed = int((now - _aware(inp.onset_at)).total_seconds() // 60)
        stroke["elapsed_min"] = max(0, elapsed)

    if inp.befast is None:
        return stroke

    score, labels, suspected = _befast_summary(inp.befast, rules)
    stroke["score"] = score
    stroke["suspected"] = suspected
    if not suspected:
        sig.note(f"BE-FAST: insult belgilari topilmadi ({score} ball)")
        return stroke

    detail = ", ".join(labels) if labels else "belgilar"
    elapsed = stroke["elapsed_min"]
    if elapsed is None:
        sig.fire(
            "stroke_onset_unknown",
            f"BE-FAST: {detail} ({score} ball) — insult shubhasi; "
            "simptom boshlangan vaqt noma'lum",
        )
        return stroke

    limit = window["thrombolysis_min"]
    stroke["remaining_min"] = max(0, limit - elapsed)
    if elapsed < window["warning_min"]:
        stroke["window_state"] = "open"
    elif elapsed < limit:
        stroke["window_state"] = "closing"
    else:
        stroke["window_state"] = "closed"

    if elapsed < limit:
        sig.fire(
            "stroke_in_window",
            f"BE-FAST: {detail} ({score} ball) — insult shubhasi; simptomdan "
            f"{elapsed} daqiqa o'tdi, trombolizis oynasi ochiq "
            f"({stroke['remaining_min']} daqiqa qoldi)",
        )
    else:
        sig.fire(
            "stroke_late",
            f"BE-FAST: {detail} ({score} ball) — insult shubhasi; simptomdan "
            f"{elapsed} daqiqa o'tdi, {i18n.hours(limit)} soatlik oyna yopilgan",
        )
    return stroke


def _evaluate_flags(inp: TriageInputs, sig: _Signals) -> None:
    if inp.flags.get("unconscious"):
        sig.fire("red_flag_unconscious", "Anketa: bemor hushsiz")
    if inp.flags.get("breathing_difficulty"):
        sig.fire("red_flag_breathing", "Anketa: nafas qiyinlashgan")
    if inp.flags.get("chest_pain"):
        sig.fire("chest_pain", "Anketa: ko'krak og'rig'i")


def _evaluate_ct(inp: TriageInputs, rules: dict, sig: _Signals) -> bool | None:
    """Returns the CT readers' agreement, or None when they cannot be compared."""
    ct = inp.ct
    if ct is None:
        return None
    if ct.status == PENDING:
        return None

    thresholds = rules["ct_head"]["ich_probability"]
    probability = ct.ich_probability
    reading = ct.medgemma

    if probability is not None:
        if probability >= thresholds["high"]:
            sig.fire(
                "ich_high",
                f"KT (ICH CNN): qon quyilishi ehtimoli {i18n.number(probability)}",
            )
        elif probability >= thresholds["moderate"]:
            sig.fire(
                "ich_moderate",
                f"KT (ICH CNN): qon quyilishi ehtimoli {i18n.number(probability)} — oraliq",
            )
        else:
            sig.note(f"KT (ICH CNN): qon quyilishi ehtimoli {i18n.number(probability)}")

    if reading is None:
        if probability is None:
            sig.fire("ct_not_read", "KT yuklandi, AI o'qimadi — mutaxassis o'zi ko'rsin")
        return None

    hemorrhage = reading.get("hemorrhage")
    confidence = reading.get("confidence")
    bleed_type = i18n.HEMORRHAGE_TYPE_UZ.get(reading.get("hemorrhage_type", "none"), "")

    if hemorrhage == "yes" and confidence == "high":
        sig.fire(
            "ct_hemorrhage",
            f"KT (MedGemma): qon quyilishi bor — {bleed_type}, ishonch yuqori",
        )
    elif hemorrhage in ("yes", "no") and confidence == "high":
        sig.note("KT (MedGemma): qon quyilishi belgilari yo'q (ishonch yuqori)")
    else:
        sig.fire(
            "ct_uncertain",
            f"KT (MedGemma): natija noaniq (qon quyilishi: {hemorrhage}, "
            f"ishonch: {confidence})",
        )

    if reading.get("midline_shift") == "yes":
        sig.note("KT (MedGemma): o'rta chiziq siljishi bor")

    # TZ §7 M3: green needs MedGemma "no/high" AND (CNN < moderate, or no CNN and
    # a negative BE-FAST). A single reader with no questionnaire cannot clear a case.
    if hemorrhage == "no" and confidence == "high" and probability is None:
        befast_negative = inp.befast is not None and not _befast_summary(inp.befast, rules)[2]
        if not befast_negative:
            sig.fire(
                "ct_single_reader",
                "KT: faqat bitta o'quvchi o'qidi (ICH CNN yo'q), BE-FAST to'ldirilmagan",
            )

    if hemorrhage in ("yes", "no") and probability is not None:
        cnn_says_bleed = probability >= thresholds["agree_at"]
        agree = cnn_says_bleed == (hemorrhage == "yes")
        if not agree:
            sig.fire(
                "readers_disagree",
                f"Ikki o'quvchi kelishmadi: MedGemma «{hemorrhage}», "
                f"ICH CNN {i18n.number(probability)}",
            )
        return agree
    return None


def _evaluate_cxr(inp: TriageInputs, rules: dict, sig: _Signals) -> bool | None:
    cxr = inp.cxr
    if cxr is None or cxr.status == PENDING:
        return None

    config = rules["cxr"]
    probabilities = cxr.probabilities
    if probabilities is None:
        if cxr.medgemma is None:
            sig.fire("ai_failed", "Rentgen: AI moduli o'qimadi")
        return None

    red_hits = [
        (name, probabilities[name])
        for name, threshold in config["red"].items()
        if probabilities.get(name) is not None and probabilities[name] >= threshold
    ]
    if red_hits:
        detail = ", ".join(f"{i18n.pathology(n)} {i18n.number(p)}" for n, p in red_hits)
        sig.fire("cxr_red", f"Rentgen: {detail}")

    yellow_hits = [
        (name, probabilities[name])
        for name, threshold in config["yellow"].items()
        if probabilities.get(name) is not None and probabilities[name] >= threshold
    ]
    if yellow_hits:
        detail = ", ".join(f"{i18n.pathology(n)} {i18n.number(p)}" for n, p in yellow_hits)
        sig.fire("cxr_yellow", f"Rentgen: {detail}")

    findings = sorted(
        ((name, value) for name, value in probabilities.items()
         if value is not None and value >= config["finding_min"]),
        key=lambda item: item[1],
        reverse=True,
    )
    if len(findings) >= config["multi_pathology_min_count"]:
        sig.fire(
            "cxr_multi",
            f"Rentgen: {len(findings)} ta patologiya belgisi "
            f"(chegara {i18n.number(config['finding_min'], 1)})",
        )
    if findings and not red_hits and not yellow_hits:
        top = ", ".join(f"{i18n.pathology(n)} {i18n.number(p)}" for n, p in findings[:3])
        sig.note(f"Rentgen: {top}")
    if not findings:
        sig.note("Rentgen: patologiya belgilari topilmadi")

    reading = cxr.medgemma
    if reading is None:
        return None

    watched = {**config["red"], **config["yellow"]}
    missed = []
    for finding in reading.get("findings", []):
        label = str(finding.get("label", "")).lower()
        for name in watched:
            if name.lower().replace("_", " ") == label.replace("_", " "):
                value = probabilities.get(name)
                if value is None or value < config["finding_min"]:
                    missed.append(i18n.pathology(name))
    if missed:
        sig.fire(
            "readers_disagree",
            f"Ikki o'quvchi kelishmadi: MedGemma «{', '.join(sorted(set(missed)))}» "
            "deydi, klassifikator bu belgini topmadi",
        )
        return False
    return True


def _evaluate_labs(inp: TriageInputs, rules: dict, sig: _Signals) -> None:
    critical = rules["labs"].get("critical") or {}
    for name, value in inp.labs.items():
        limits = critical.get(name)
        if not limits:
            continue
        below, above = limits.get("below"), limits.get("above")
        if (below is not None and value < below) or (above is not None and value > above):
            sig.fire("lab_critical", f"Tahlil: {name} {i18n.number(value, 1)} — kritik qiymat")


def _matches(condition: dict, fired: set[str], inp: TriageInputs) -> bool:
    if condition.get("always"):
        return True
    if set(condition.get("any_signal", [])) & fired:
        return True
    probabilities = (inp.cxr.probabilities if inp.cxr else None) or {}
    for name, threshold in (condition.get("cxr_any") or {}).items():
        value = probabilities.get(name)
        if value is not None and value >= threshold:
            return True
    for flag in condition.get("any_flag", []):
        if inp.flags.get(flag):
            return True
    return False


def evaluate(inp: TriageInputs, rules: dict, now: datetime | None = None) -> TriageOutcome:
    now = now or _now()
    sig = _Signals()

    stroke = _evaluate_stroke(inp, rules, now, sig)
    _evaluate_flags(inp, sig)
    ct_agree = _evaluate_ct(inp, rules, sig)
    cxr_agree = _evaluate_cxr(inp, rules, sig)
    _evaluate_labs(inp, rules, sig)

    if inp.failed_modules:
        sig.fire("ai_failed", f"AI moduli ishlamadi: {', '.join(sorted(set(inp.failed_modules)))}")

    read_something = any(
        source is not None and source.status == DONE and payload is not None
        for source, payload in (
            (inp.ct, (inp.ct.medgemma or inp.ct.ich_probability) if inp.ct else None),
            (inp.cxr, (inp.cxr.probabilities or inp.cxr.medgemma) if inp.cxr else None),
        )
    )
    if not read_something:
        sig.fire("data_incomplete", "Ma'lumot to'liq emas — AI hali hech bir tasvirni o'qimagan")

    fired = set(sig.fired)
    zones = rules["zones"]
    red = [name for name in zones.get("red", []) if name in fired]
    yellow = [name for name in zones.get("yellow", []) if name in fired]
    zone = "red" if red else "yellow" if yellow else "green"

    specialist, route, matched_default = None, None, False
    for rule in rules["routing"]:
        if _matches(rule.get("when") or {}, fired, inp):
            specialist, route = rule["specialist"], rule["route"]
            matched_default = bool((rule.get("when") or {}).get("always"))
            break
    if specialist is None:
        specialist, route = "family_doctor", "onsite"
        matched_default = True
    if zone == "red" and matched_default:
        fallback = rules.get("red_zone_default") or {}
        specialist = fallback.get("specialist", specialist)
        route = fallback.get("route", route)

    ordered = red + yellow + [name for name in sig.fired if name not in red + yellow]
    reasons = [sig.fired[name] for name in ordered]
    reasons.extend(sig.context)
    if zone == "green" and not reasons:
        reasons.append("Xavf belgilari topilmadi")

    agreements = [value for value in (ct_agree, cxr_agree) if value is not None]
    readers_agree = all(agreements) if agreements else None

    return TriageOutcome(
        zone=zone,
        specialist_type=specialist,
        route=route,
        reasons=reasons,
        signals=ordered,
        time_window_min=stroke.get("remaining_min") if stroke.get("suspected") else None,
        readers_agree=readers_agree,
        stroke=stroke,
        rules_version=rules["version"],
    )


# --- database adapter --------------------------------------------------------

_STUDY_STATUS_MAP = {"queued": PENDING, "processing": PENDING, "done": DONE, "failed": FAILED}


def _latest_results(study) -> dict:
    """module -> AIResult, keeping the newest row per module."""
    latest = {}
    for result in study.ai_results:
        latest[result.module] = result
    return latest


def gather_inputs(case) -> TriageInputs:
    """Collect everything the engine needs from one loaded Case."""
    from app.models import StudyType

    anamnesis = case.anamnesis
    structured = (anamnesis.structured_json if anamnesis else None) or {}
    befast = anamnesis.befast_json if anamnesis else None
    flags = structured.get("flags") or {}
    labs = dict(structured.get("labs") or {})

    newest: dict[str, object] = {}
    for study in case.studies:
        newest[study.type] = study

    failed_modules: list[str] = []
    ct_input = cxr_input = None

    ct_study = newest.get(StudyType.CT_HEAD)
    if ct_study is not None:
        results = _latest_results(ct_study)
        medgemma = results.get("medgemma_ct")
        ich = results.get("ich")
        ct_input = CTReadings(
            status=_STUDY_STATUS_MAP.get(ct_study.status, PENDING),
            medgemma=medgemma.output_json if medgemma and not medgemma.error else None,
            ich_probability=(
                (ich.output_json or {}).get("probability") if ich and not ich.error else None
            ),
        )
        failed_modules += [name for name, row in results.items() if row.error]

    cxr_study = newest.get(StudyType.CXR)
    if cxr_study is not None:
        results = _latest_results(cxr_study)
        cnn = results.get("cxr")
        medgemma = results.get("medgemma_cxr")
        cxr_input = CXRReadings(
            status=_STUDY_STATUS_MAP.get(cxr_study.status, PENDING),
            probabilities=(
                (cnn.output_json or {}).get("probabilities") if cnn and not cnn.error else None
            ),
            medgemma=medgemma.output_json if medgemma and not medgemma.error else None,
        )
        failed_modules += [name for name, row in results.items() if row.error]

    lab_study = newest.get(StudyType.LAB_PHOTO)
    if lab_study is not None:
        results = _latest_results(lab_study)
        ocr = results.get("medgemma_lab")
        if ocr and not ocr.error and not labs:
            labs = dict((ocr.output_json or {}).get("values") or {})
        failed_modules += [name for name, row in results.items() if row.error]

    return TriageInputs(
        befast=befast,
        flags=flags,
        onset_at=case.symptom_onset_at,
        ct=ct_input,
        cxr=cxr_input,
        labs=labs,
        failed_modules=failed_modules,
    )


def _model_versions(case) -> list[str]:
    versions = []
    for study in case.studies:
        for result in study.ai_results:
            if result.model_version and result.model_version not in versions:
                versions.append(result.model_version)
    return versions


STICKY_STATUSES = {"in_review", "decided", "closed"}


def triage_case(db, case, *, now=None, actor_user_id: int | None = None):
    """Recompute triage for a case, store the result and move the case status."""
    from app.models import CaseStatus, StudyStatus, TriageResult
    from app.services import audit, report
    from app.services.rules import load_rules

    rules = load_rules()
    inputs = gather_inputs(case)
    outcome = evaluate(inputs, rules, now)

    context = {
        "zone": outcome.zone,
        "specialist_type": outcome.specialist_type,
        "route": outcome.route,
        "reasons": outcome.reasons,
        "readers_agree": outcome.readers_agree,
        "time_window_min": outcome.time_window_min,
        "rules_version": outcome.rules_version,
        "models": _model_versions(case),
        "patient_age": None,
    }
    if case.patient and case.patient.birth_year:
        context["patient_age"] = (now or _now()).year - case.patient.birth_year
    nurse_text, specialist_text, report_model = report.generate(context)

    result = TriageResult(
        case_id=case.id,
        zone=outcome.zone,
        specialist_type=outcome.specialist_type,
        route=outcome.route,
        reasons_json=outcome.reasons,
        time_window_min=outcome.time_window_min,
        readers_agree=outcome.readers_agree,
        rules_version=outcome.rules_version,
        signals_json=outcome.signals,
        stroke_json=outcome.stroke,
        summary_nurse=nurse_text,
        summary_specialist=specialist_text,
        report_model=report_model,
    )
    db.add(result)

    case.zone = outcome.zone
    case.specialist_type = outcome.specialist_type
    case.route = outcome.route
    if case.status not in STICKY_STATUSES:
        pending = any(
            study.status in (StudyStatus.QUEUED, StudyStatus.PROCESSING) for study in case.studies
        )
        all_failed = bool(case.studies) and all(
            study.status == StudyStatus.FAILED for study in case.studies
        )
        if pending:
            case.status = CaseStatus.PROCESSING
        elif all_failed:
            case.status = CaseStatus.AI_FAILED
        else:
            case.status = CaseStatus.TRIAGED

    audit.record(
        db, action="triage.computed", user_id=actor_user_id, case_id=case.id,
        payload={
            "zone": outcome.zone,
            "specialist_type": outcome.specialist_type,
            "route": outcome.route,
            "signals": outcome.signals,
            "rules_version": outcome.rules_version,
            "readers_agree": outcome.readers_agree,
            "report_model": report_model,
        },
    )
    db.flush()
    return result
