"""Strict schemas for MedGemma output (TZ §7, §11).

MedGemma describes, it does not diagnose: every categorical field is a closed
list, so a label outside the list is rejected and the module retries. Anything
that still fails validation ends as `ai_failed`, never as a silent guess.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Confidence = Literal["high", "medium", "low"]
YesNoUncertain = Literal["yes", "no", "uncertain"]

HEMORRHAGE_TYPES = Literal[
    "epidural", "subdural", "subarachnoid",
    "intraparenchymal", "intraventricular", "none",
]

CXR_LABELS = Literal[
    "pneumonia", "consolidation", "effusion", "pneumothorax", "cardiomegaly",
    "nodule", "mass", "atelectasis", "edema", "fracture", "other",
]

# Analytes the lab reader may return; anything else is dropped as unvalidated.
LAB_ANALYTES = {
    "hemoglobin", "glucose", "wbc", "rbc", "platelets", "esr", "crp",
    "creatinine", "urea", "alt", "ast", "bilirubin", "potassium", "sodium", "inr",
}


class CTReading(BaseModel):
    """Head CT (TZ §7 M3)."""

    model_config = ConfigDict(extra="forbid")

    hemorrhage: YesNoUncertain
    hemorrhage_type: HEMORRHAGE_TYPES = "none"
    midline_shift: YesNoUncertain = "uncertain"
    findings: list[str] = Field(default_factory=list, max_length=10)
    confidence: Confidence
    key_slice: int | None = Field(default=None, ge=0)

    @field_validator("findings", mode="after")
    @classmethod
    def _trim(cls, value: list[str]) -> list[str]:
        return [item.strip()[:200] for item in value if item and item.strip()]

    @model_validator(mode="after")
    def _consistent(self) -> "CTReading":
        if self.hemorrhage == "no" and self.hemorrhage_type != "none":
            raise ValueError("hemorrhage='no' bilan hemorrhage_type 'none' bo'lishi kerak")
        return self


class CXRFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: CXR_LABELS
    location: str | None = Field(default=None, max_length=120)
    # Gemma localisation convention: [x_min, y_min, x_max, y_max] normalised to 0..1000.
    box: list[float] | None = None

    @field_validator("box", mode="after")
    @classmethod
    def _valid_box(cls, value: list[float] | None) -> list[float] | None:
        if value is None:
            return None
        if len(value) != 4:
            raise ValueError("box 4 ta sondan iborat bo'lishi kerak")
        x0, y0, x1, y1 = value
        if not all(0 <= coord <= 1000 for coord in value) or x0 >= x1 or y0 >= y1:
            raise ValueError("box koordinatalari 0..1000 oralig'ida va o'sib borishi kerak")
        return [float(coord) for coord in value]


class CXRReading(BaseModel):
    """Chest X-ray description, the second reader next to torchxrayvision (TZ §7 M4)."""

    model_config = ConfigDict(extra="forbid")

    findings: list[CXRFinding] = Field(default_factory=list, max_length=10)
    impression: str = Field(default="", max_length=600)
    confidence: Confidence


class LabReading(BaseModel):
    """Lab sheet photo -> values (TZ §7 M5)."""

    model_config = ConfigDict(extra="forbid")

    values: dict[str, float] = Field(default_factory=dict)
    units: dict[str, str] = Field(default_factory=dict)
    confidence: Confidence = "medium"

    @field_validator("values", mode="before")
    @classmethod
    def _known_analytes(cls, value):
        if not isinstance(value, dict):
            raise ValueError("values lug'at bo'lishi kerak")
        cleaned = {}
        for key, raw in value.items():
            name = str(key).strip().lower()
            if name not in LAB_ANALYTES:
                continue
            try:
                cleaned[name] = float(raw)
            except (TypeError, ValueError):
                continue
        return cleaned


SCHEMAS = {"ct_head": CTReading, "cxr": CXRReading, "lab": LabReading}
