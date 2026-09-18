"""M3 second reader: head-CT intracranial haemorrhage CNN (TZ §7, optional).

The RSNA weights are optional by design: if `ICH_WEIGHTS_PATH` is empty or the
file is missing, this module reports "unavailable" and MedGemma reads the study
alone. The triage engine then refuses to call such a case green (TZ §15 R5).
"""

import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

log = logging.getLogger(__name__)

MODEL_VERSION_PREFIX = "ich-cnn"


class ICHUnavailable(RuntimeError):
    """No weights configured: the second reader stays empty."""


@dataclass
class ICHResult:
    probability: float
    key_slice: int | None
    heatmap_path: str | None
    model_version: str
    duration_ms: int


def weights_path() -> Path | None:
    path = settings.ich_weights_path
    if path is None:
        return None
    path = Path(path)
    return path if path.is_file() else None


def is_available() -> bool:
    return weights_path() is not None


def analyze(slice_paths: list[Path], heatmap_path: Path | None = None) -> ICHResult:
    """Score a CT series for haemorrhage. Raises ICHUnavailable without weights."""
    path = weights_path()
    if path is None:
        raise ICHUnavailable(
            "ICH_WEIGHTS_PATH sozlanmagan — ikkinchi o'quvchi bo'sh qoladi (TZ §15 R5)"
        )
    # Weights were not available during the hackathon build. When the RSNA
    # checkpoint lands, load it here (torchvision ResNet + pytorch-grad-cam) and
    # return the probability, the most suspicious slice and its heatmap.
    raise ICHUnavailable(
        f"ICH og'irliklari topildi ({path.name}), lekin yuklovchi hali yozilmagan"
    )
