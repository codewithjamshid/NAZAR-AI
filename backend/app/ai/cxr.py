"""M4 chest X-ray reader: torchxrayvision DenseNet121 + Grad-CAM (TZ §7).

The module returns numbers only. Zone thresholds (Pneumothorax >= 0.7 etc.)
live in rules/triage.yaml and are applied by services/triage.py.

CLI:  python -m app.ai.cxr <image> [--heatmap out.png] [--view out_view.png]
"""

import argparse
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch
import torchvision
import torchxrayvision as xrv

from app.ai.preprocess import load_gray

log = logging.getLogger(__name__)

WEIGHTS = "densenet121-res224-all"
MODEL_VERSION = f"torchxrayvision-{xrv.__version__}/{WEIGHTS}"

# TZ §7 M4: "patologiya >= 0,5 belgilanadi". The model's outputs are
# operating-point normalised by torchxrayvision, so 0.5 is its own threshold.
FINDING_THRESHOLD = 0.5

HEATMAP_SIZE = 512  # output PNG side, upscaled from the model's 224 view

_model: xrv.models.DenseNet | None = None


@dataclass
class CXRResult:
    probabilities: dict[str, float | None]
    findings: list[dict] = field(default_factory=list)
    top_pathology: str | None = None
    confidence: float = 0.0
    model_version: str = MODEL_VERSION
    heatmap_path: str | None = None
    view_path: str | None = None
    duration_ms: int = 0

    def to_output_json(self) -> dict:
        """Payload stored in ai_results.output_json."""
        return {
            "probabilities": self.probabilities,
            "findings": self.findings,
            "top_pathology": self.top_pathology,
            "threshold": FINDING_THRESHOLD,
            "view_path": self.view_path,
        }


def get_model() -> xrv.models.DenseNet:
    """Load the pretrained model once per process (weights are cached on disk)."""
    global _model
    if _model is None:
        _model = xrv.models.DenseNet(weights=WEIGHTS)
        _model.eval()
    return _model


def _model_input(gray: np.ndarray) -> np.ndarray:
    """uint8 HxW -> 1x224x224 float array in torchxrayvision's [-1024, 1024] range."""
    img = xrv.datasets.normalize(gray.astype(np.float32), 255)
    img = img[None, ...]
    transform = torchvision.transforms.Compose(
        [xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(224, engine="cv2")]
    )
    return transform(img)


def _base_rgb(model_input: np.ndarray) -> np.ndarray:
    """The exact view the model saw, as float 0..1 RGB for overlaying."""
    view = (model_input[0] + 1024.0) / 2048.0
    view = np.clip(view, 0.0, 1.0)
    return np.repeat(view[..., None], 3, axis=2)


def _write_png(path: Path, rgb_uint8: np.ndarray) -> None:
    import cv2

    path.parent.mkdir(parents=True, exist_ok=True)
    resized = cv2.resize(rgb_uint8, (HEATMAP_SIZE, HEATMAP_SIZE), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(str(path), cv2.cvtColor(resized, cv2.COLOR_RGB2BGR))


def _grad_cam(model, tensor: torch.Tensor, class_index: int) -> np.ndarray | None:
    """Grad-CAM for one pathology. Returns a 224x224 map in 0..1, or None on failure."""
    from pytorch_grad_cam import GradCAM
    from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

    with GradCAM(model=model, target_layers=[model.features[-1]]) as cam:
        grayscale = cam(input_tensor=tensor, targets=[ClassifierOutputTarget(class_index)])[0]
    if not np.isfinite(grayscale).all() or float(grayscale.max()) <= 0.0:
        return None
    return grayscale


def analyze(
    image_path: Path | str,
    heatmap_path: Path | str | None = None,
    view_path: Path | str | None = None,
) -> CXRResult:
    """Read a chest X-ray and return per-pathology probabilities (+ optional heatmap).

    Heatmap failure is not fatal: the probabilities are the module's contract,
    the overlay is an explanation aid (TZ §11).
    """
    started = time.monotonic()
    model = get_model()
    model_input = _model_input(load_gray(Path(image_path)))
    tensor = torch.from_numpy(model_input)[None, ...]

    with torch.no_grad():
        raw = model(tensor)[0].numpy()

    probabilities: dict[str, float | None] = {}
    for name, value in zip(model.pathologies, raw, strict=True):
        probabilities[name] = None if not np.isfinite(value) else round(float(value), 4)

    findings = sorted(
        (
            {"pathology": name, "probability": prob}
            for name, prob in probabilities.items()
            if prob is not None and prob >= FINDING_THRESHOLD
        ),
        key=lambda item: item["probability"],
        reverse=True,
    )
    scored = {name: prob for name, prob in probabilities.items() if prob is not None}
    top_pathology = max(scored, key=scored.get) if scored else None
    confidence = scored[top_pathology] if top_pathology else 0.0

    result = CXRResult(
        probabilities=probabilities,
        findings=findings,
        top_pathology=top_pathology,
        confidence=confidence,
    )

    if heatmap_path is not None and top_pathology is not None:
        from pytorch_grad_cam.utils.image import show_cam_on_image

        base = _base_rgb(model_input)
        try:
            cam_map = _grad_cam(model, tensor, model.pathologies.index(top_pathology))
            if cam_map is not None:
                _write_png(Path(heatmap_path), show_cam_on_image(base, cam_map, use_rgb=True))
                result.heatmap_path = str(heatmap_path)
        except Exception:  # noqa: BLE001 - explanation is optional, numbers are not
            log.exception("Grad-CAM failed for %s", image_path)
        if view_path is not None:
            _write_png(Path(view_path), (base * 255).astype(np.uint8))
            result.view_path = str(view_path)

    result.duration_ms = int((time.monotonic() - started) * 1000)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the CXR module on one image")
    parser.add_argument("image", type=Path)
    parser.add_argument("--heatmap", type=Path, default=None)
    parser.add_argument("--view", type=Path, default=None)
    args = parser.parse_args()

    result = analyze(args.image, args.heatmap, args.view)
    print(json.dumps({
        "model_version": result.model_version,
        "duration_ms": result.duration_ms,
        "confidence": result.confidence,
        "top_pathology": result.top_pathology,
        "findings": result.findings,
        "heatmap_path": result.heatmap_path,
        "view_path": result.view_path,
        "probabilities": result.probabilities,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
