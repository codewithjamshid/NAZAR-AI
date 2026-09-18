"""M4 chest X-ray module: preprocessing and the torchxrayvision reader."""

import pytest

from app.ai import preprocess
from app.config import settings

CXR_DIR = settings.demo_data_path / "cxr"
PNG_SAMPLE = CXR_DIR / "00000001_000.png"
DICOM_SAMPLE = CXR_DIR / "siim_pneumothorax_sample.dcm"

pytestmark = pytest.mark.skipif(
    not PNG_SAMPLE.is_file(), reason="demo-data/cxr samples not present"
)


# --- preprocessing -----------------------------------------------------------

def test_loads_png_as_2d_uint8():
    arr = preprocess.load_gray(PNG_SAMPLE)
    assert arr.ndim == 2 and arr.dtype.name == "uint8"
    assert arr.max() > arr.min()


def test_loads_jpeg_compressed_dicom():
    arr = preprocess.load_gray(DICOM_SAMPLE)
    assert arr.shape == (1024, 1024) and arr.dtype.name == "uint8"


def test_rejects_unsupported_and_missing_files(tmp_path):
    junk = tmp_path / "notes.txt"
    junk.write_bytes(b"hello, this is not an image")
    with pytest.raises(preprocess.PreprocessError):
        preprocess.load_gray(junk)
    with pytest.raises(preprocess.PreprocessError):
        preprocess.load_gray(tmp_path / "missing.png")


# --- model -------------------------------------------------------------------

@pytest.fixture(scope="module")
def cxr():
    """Import the module and load weights once; skip if they cannot be fetched."""
    from app.ai import cxr as module

    try:
        module.get_model()
    except Exception as exc:  # noqa: BLE001 - offline box without cached weights
        pytest.skip(f"torchxrayvision weights unavailable: {exc}")
    return module


def test_analyze_returns_all_18_pathologies(cxr):
    result = cxr.analyze(PNG_SAMPLE)

    assert len(result.probabilities) == 18
    assert {"Pneumothorax", "Pneumonia", "Effusion", "Cardiomegaly"} <= set(result.probabilities)
    assert all(p is None or 0.0 <= p <= 1.0 for p in result.probabilities.values())
    assert result.model_version.startswith("torchxrayvision-")
    assert result.duration_ms > 0

    # findings are the >= threshold subset, strongest first
    probs = [f["probability"] for f in result.findings]
    assert probs == sorted(probs, reverse=True)
    assert all(p >= cxr.FINDING_THRESHOLD for p in probs)
    assert result.confidence == max(p for p in result.probabilities.values() if p is not None)


def test_analyze_writes_aligned_heatmap_and_view(cxr, tmp_path):
    heatmap, view = tmp_path / "cam.png", tmp_path / "view.png"
    result = cxr.analyze(DICOM_SAMPLE, heatmap_path=heatmap, view_path=view)

    assert heatmap.is_file() and view.is_file()
    assert heatmap.stat().st_size > 1000 and view.stat().st_size > 1000
    assert result.heatmap_path == str(heatmap) and result.view_path == str(view)

    from PIL import Image

    with Image.open(heatmap) as cam_img, Image.open(view) as view_img:
        assert cam_img.size == view_img.size == (cxr.HEATMAP_SIZE, cxr.HEATMAP_SIZE)


def test_heatmap_failure_does_not_lose_the_numbers(cxr, tmp_path, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("grad-cam exploded")

    monkeypatch.setattr(cxr, "_grad_cam", boom)
    result = cxr.analyze(PNG_SAMPLE, heatmap_path=tmp_path / "cam.png")

    assert result.heatmap_path is None
    assert len(result.probabilities) == 18
    assert result.top_pathology is not None


def test_output_json_shape(cxr):
    payload = cxr.analyze(PNG_SAMPLE).to_output_json()
    assert set(payload) == {"probabilities", "findings", "top_pathology", "threshold", "view_path"}
    assert payload["threshold"] == cxr.FINDING_THRESHOLD
