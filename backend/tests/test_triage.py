"""M6 triage engine against the rules the neurosurgeon owns (TZ §8)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.rules import RulesError, load_rules, validate_signals
from app.services.triage import (
    CTReadings,
    CXRReadings,
    DONE,
    PENDING,
    TriageInputs,
    evaluate,
)

NOW = datetime(2026, 9, 18, 8, 20, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def rules():
    return load_rules()


def run(rules, **kwargs):
    return evaluate(TriageInputs(**kwargs), rules, NOW)


def read_cxr(**probabilities) -> CXRReadings:
    base = {name: 0.1 for name in (
        "Atelectasis", "Consolidation", "Infiltration", "Pneumothorax", "Edema",
        "Emphysema", "Fibrosis", "Effusion", "Pneumonia", "Pleural_Thickening",
        "Cardiomegaly", "Nodule", "Mass", "Hernia", "Lung Lesion", "Fracture",
        "Lung Opacity", "Enlarged Cardiomediastinum")}
    base.update(probabilities)
    return CXRReadings(status=DONE, probabilities=base)


# --- rules file --------------------------------------------------------------

def test_rules_file_loads_and_has_a_version(rules):
    assert rules["version"]
    assert rules["stroke_window"]["thrombolysis_min"] == 270


def test_unknown_signal_in_rules_is_rejected(rules):
    broken = {**rules, "zones": {"red": ["stroke_in_window", "typo_signal"], "yellow": []}}
    with pytest.raises(RulesError, match="typo_signal"):
        validate_signals(broken)


# --- stroke path (demo scenario, TZ §13) -------------------------------------

def test_befast_inside_window_is_red_for_the_neurologist(rules):
    out = run(rules, befast={"face": True, "arms": True, "speech": True},
              onset_at=NOW - timedelta(minutes=40))

    assert out.zone == "red"
    assert out.specialist_type == "neurologist" and out.route == "regional"
    assert out.time_window_min == 230
    assert out.stroke["score"] == 6 and out.stroke["window_state"] == "open"
    assert "stroke_in_window" in out.signals
    assert any("insult shubhasi" in reason for reason in out.reasons)


def test_single_face_droop_is_enough_for_stroke_suspicion(rules):
    out = run(rules, befast={"face": True}, onset_at=NOW - timedelta(minutes=10))
    assert out.stroke["suspected"] is True and out.zone == "red"


def test_balance_plus_eyes_reaches_the_score_threshold(rules):
    out = run(rules, befast={"balance": True, "eyes": True},
              onset_at=NOW - timedelta(minutes=10))
    assert out.stroke["score"] == 2 and out.stroke["suspected"] is True


def test_late_stroke_is_yellow_not_red(rules):
    out = run(rules, befast={"speech": True}, onset_at=NOW - timedelta(minutes=300))

    assert out.zone == "yellow"
    assert out.specialist_type == "neurologist"
    assert out.stroke["window_state"] == "closed" and out.time_window_min == 0


def test_unknown_onset_with_stroke_signs_is_yellow(rules):
    out = run(rules, befast={"arms": True}, onset_at=None)
    assert out.zone == "yellow" and "stroke_onset_unknown" in out.signals


def test_window_turns_to_closing_after_the_warning_mark(rules):
    out = run(rules, befast={"face": True}, onset_at=NOW - timedelta(minutes=200))
    assert out.stroke["window_state"] == "closing" and out.zone == "red"


# --- questionnaire red flags -------------------------------------------------

def test_unconscious_patient_is_red_even_without_imaging(rules):
    out = run(rules, befast={}, flags={"unconscious": True})
    assert out.zone == "red" and "red_flag_unconscious" in out.signals
    assert out.specialist_type == "neurologist"  # red_zone_default


# --- head CT (TZ §7 M3) ------------------------------------------------------

def test_high_ich_probability_goes_to_the_neurosurgeon(rules):
    out = run(rules, befast={}, ct=CTReadings(status=DONE, ich_probability=0.91))
    assert out.zone == "red" and out.specialist_type == "neurosurgeon"


def test_moderate_ich_probability_is_yellow(rules):
    out = run(rules, befast={}, ct=CTReadings(status=DONE, ich_probability=0.45))
    assert out.zone == "yellow" and out.specialist_type == "neurologist"


def test_confident_medgemma_bleed_is_red(rules):
    reading = {"hemorrhage": "yes", "hemorrhage_type": "subdural",
               "midline_shift": "no", "findings": [], "confidence": "high"}
    out = run(rules, befast={}, ct=CTReadings(status=DONE, medgemma=reading))
    assert out.zone == "red" and out.specialist_type == "neurosurgeon"


def test_uncertain_medgemma_is_yellow(rules):
    reading = {"hemorrhage": "uncertain", "hemorrhage_type": "none",
               "midline_shift": "uncertain", "findings": [], "confidence": "low"}
    out = run(rules, befast={}, ct=CTReadings(status=DONE, medgemma=reading))
    assert out.zone == "yellow" and "ct_uncertain" in out.signals


def test_clean_ct_with_both_readers_and_negative_befast_is_green(rules):
    reading = {"hemorrhage": "no", "hemorrhage_type": "none",
               "midline_shift": "no", "findings": [], "confidence": "high"}
    out = run(rules, befast={"face": False, "arms": False, "speech": False},
              ct=CTReadings(status=DONE, medgemma=reading, ich_probability=0.06))

    assert out.zone == "green"
    assert out.readers_agree is True
    assert out.specialist_type == "family_doctor" and out.route == "onsite"


def test_clean_ct_without_the_cnn_and_without_befast_stays_yellow(rules):
    reading = {"hemorrhage": "no", "hemorrhage_type": "none",
               "midline_shift": "no", "findings": [], "confidence": "high"}
    out = run(rules, ct=CTReadings(status=DONE, medgemma=reading))
    assert out.zone == "yellow" and "ct_single_reader" in out.signals


def test_readers_that_disagree_force_yellow(rules):
    reading = {"hemorrhage": "no", "hemorrhage_type": "none",
               "midline_shift": "no", "findings": [], "confidence": "high"}
    out = run(rules, befast={"face": False},
              ct=CTReadings(status=DONE, medgemma=reading, ich_probability=0.62))

    assert out.zone == "yellow"
    assert out.readers_agree is False
    assert "readers_disagree" in out.signals


def test_ct_that_no_module_could_read_is_yellow_for_the_neurologist(rules):
    out = run(rules, befast={}, ct=CTReadings(status=FAILED_STATUS))
    assert out.zone == "yellow" and "ct_not_read" in out.signals
    assert out.specialist_type == "neurologist"


FAILED_STATUS = "failed"


def test_pending_ct_does_not_produce_a_verdict_yet(rules):
    out = run(rules, befast={}, ct=CTReadings(status=PENDING))
    assert out.zone == "yellow" and "data_incomplete" in out.signals
    assert "ct_not_read" not in out.signals


# --- chest X-ray (TZ §7 M4) --------------------------------------------------

def test_pneumothorax_above_the_red_threshold(rules):
    out = run(rules, befast={}, cxr=read_cxr(Pneumothorax=0.75))
    assert out.zone == "red" and out.specialist_type == "pulmonologist"


def test_pneumonia_and_effusion_are_yellow_for_the_therapist(rules):
    out = run(rules, befast={}, cxr=read_cxr(Pneumonia=0.84, Effusion=0.61))

    assert out.zone == "yellow"
    assert out.specialist_type == "therapist" and out.route == "district"
    assert any("Pnevmoniya 0,84" in reason for reason in out.reasons)


def test_two_pathologies_alone_make_it_yellow(rules):
    out = run(rules, befast={}, cxr=read_cxr(Nodule=0.55, Fibrosis=0.52))
    assert out.zone == "yellow" and "cxr_multi" in out.signals


def test_clean_chest_xray_is_green(rules):
    out = run(rules, befast={"face": False}, cxr=read_cxr())
    assert out.zone == "green" and out.specialist_type == "family_doctor"


def test_medgemma_finding_the_classifier_missed_is_yellow(rules):
    reading = {"findings": [{"label": "pneumothorax"}], "impression": "", "confidence": "medium"}
    cxr = read_cxr()
    cxr.medgemma = reading
    out = run(rules, befast={"face": False}, cxr=cxr)

    assert out.zone == "yellow"
    assert out.readers_agree is False and "readers_disagree" in out.signals


def test_nodule_routes_to_oncology(rules):
    out = run(rules, befast={}, cxr=read_cxr(Mass=0.66))
    assert out.specialist_type == "oncologist" and out.route == "regional"


def test_chest_pain_flag_routes_to_cardiology(rules):
    out = run(rules, befast={}, flags={"chest_pain": True}, cxr=read_cxr())
    assert out.specialist_type == "cardiologist"


# --- labs and failures -------------------------------------------------------

def test_critical_glucose_is_yellow(rules):
    out = run(rules, befast={"face": False}, cxr=read_cxr(), labs={"glucose": 18.2})
    assert out.zone == "yellow" and "lab_critical" in out.signals


def test_normal_glucose_does_not_fire(rules):
    out = run(rules, befast={"face": False}, cxr=read_cxr(), labs={"glucose": 5.4})
    assert out.zone == "green"


def test_failed_module_keeps_the_case_yellow(rules):
    out = run(rules, befast={"face": False}, cxr=read_cxr(), failed_modules=["medgemma_cxr"])
    assert out.zone == "yellow" and "ai_failed" in out.signals


def test_empty_case_is_yellow_never_green(rules):
    out = run(rules)
    assert out.zone == "yellow" and "data_incomplete" in out.signals


def test_every_outcome_carries_reasons_and_rules_version(rules):
    out = run(rules, befast={"face": True}, onset_at=NOW - timedelta(minutes=30))
    assert out.reasons and all(isinstance(reason, str) for reason in out.reasons)
    assert out.rules_version == rules["version"]
