"""Image loading for the AI modules: DICOM / PNG / JPG -> 8-bit grayscale array.

Head-CT specific steps (brain window, slice selection) are added with the CT
module; this file currently covers what the chest X-ray module needs.
"""

import io
import tempfile
import zipfile
from pathlib import Path

import numpy as np
import pydicom
from PIL import Image
from pydicom.errors import InvalidDicomError
from pydicom.pixels import apply_voi_lut

from app.services.ingest import sniff


class PreprocessError(ValueError):
    """The file could not be turned into an image array."""


def _to_uint8(arr: np.ndarray) -> np.ndarray:
    """Scale an arbitrary-range array to full 0..255 range."""
    arr = arr.astype(np.float32)
    lo, hi = float(arr.min()), float(arr.max())
    if hi <= lo:
        return np.zeros(arr.shape, dtype=np.uint8)
    return np.round((arr - lo) / (hi - lo) * 255.0).astype(np.uint8)


def load_dicom_gray(path: Path) -> np.ndarray:
    """Read a single-frame DICOM as 8-bit grayscale (VOI LUT + MONOCHROME1 handled)."""
    try:
        ds = pydicom.dcmread(path)
        arr = ds.pixel_array
    except Exception as exc:  # noqa: BLE001 - pydicom raises many types
        raise PreprocessError(f"DICOM o'qilmadi: {exc}") from exc

    if arr.ndim == 3:  # multi-frame: take the middle frame
        arr = arr[arr.shape[0] // 2]

    try:
        arr = apply_voi_lut(arr, ds)
    except Exception:  # noqa: BLE001 - LUT is optional, raw values still usable
        pass

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = arr.max() - arr  # MONOCHROME1 stores white-is-low
    return _to_uint8(arr)


def load_raster_gray(path: Path) -> np.ndarray:
    try:
        with Image.open(path) as img:
            return np.array(img.convert("L"))
    except Exception as exc:  # noqa: BLE001 - PIL raises many types
        raise PreprocessError(f"Rasm o'qilmadi: {exc}") from exc


def load_gray(path: Path) -> np.ndarray:
    """Load any supported image file as a 2D uint8 array. Format comes from the bytes."""
    path = Path(path)
    if not path.is_file():
        raise PreprocessError(f"Fayl topilmadi: {path}")
    with path.open("rb") as fh:
        fmt = sniff(fh.read(132))
    if fmt == "dcm":
        return load_dicom_gray(path)
    if fmt in ("png", "jpg"):
        return load_raster_gray(path)
    raise PreprocessError(f"Tasvir formati qo'llab-quvvatlanmaydi: {fmt or 'aniqlanmadi'}")


# --- head CT series (TZ §7 M3) -----------------------------------------------

BRAIN_WINDOW_LEVEL = 40   # WL 40 / WW 80 (TZ §7 M3, §17 glossary)
BRAIN_WINDOW_WIDTH = 80


def _iter_dicom_datasets(path: Path):
    """Yield pydicom datasets from a single .dcm or from a ZIP series."""
    data = path.read_bytes()
    if data[:4] == b"PK\x03\x04":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for info in sorted(archive.infolist(), key=lambda i: i.filename):
                if info.is_dir() or info.filename.startswith("__MACOSX/"):
                    continue
                try:
                    yield pydicom.dcmread(io.BytesIO(archive.read(info)))
                except InvalidDicomError:
                    continue
        return
    try:
        yield pydicom.dcmread(io.BytesIO(data))
    except InvalidDicomError as exc:
        raise PreprocessError(f"DICOM o'qilmadi: {exc}") from exc


def _slice_position(ds) -> float:
    position = getattr(ds, "ImagePositionPatient", None)
    if position is not None and len(position) == 3:
        return float(position[2])
    return float(getattr(ds, "InstanceNumber", 0) or 0)


def _to_hounsfield(ds) -> np.ndarray:
    arr = ds.pixel_array.astype(np.float32)
    slope = float(getattr(ds, "RescaleSlope", 1) or 1)
    intercept = float(getattr(ds, "RescaleIntercept", 0) or 0)
    return arr * slope + intercept


def brain_window(hounsfield: np.ndarray,
                 level: float = BRAIN_WINDOW_LEVEL,
                 width: float = BRAIN_WINDOW_WIDTH) -> np.ndarray:
    """Apply the brain window and return 8-bit pixels."""
    low, high = level - width / 2.0, level + width / 2.0
    clipped = np.clip(hounsfield, low, high)
    return np.round((clipped - low) / (high - low) * 255.0).astype(np.uint8)


def load_ct_series(path: Path) -> list[np.ndarray]:
    """Read a head CT study as ordered 8-bit brain-window slices."""
    slices = []
    for ds in _iter_dicom_datasets(Path(path)):
        try:
            hounsfield = _to_hounsfield(ds)
        except Exception:  # noqa: BLE001 - slices without pixel data are skipped
            continue
        if hounsfield.ndim == 3:  # enhanced/multi-frame object
            for frame in hounsfield:
                slices.append((len(slices), brain_window(frame)))
            continue
        slices.append((_slice_position(ds), brain_window(hounsfield)))
    if not slices:
        raise PreprocessError("KT seriyasida o'qiladigan kesim topilmadi")
    slices.sort(key=lambda item: item[0])
    return [image for _, image in slices]


def _write_png(image: np.ndarray, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image).save(path)
    return path


def write_ct_slice_pngs(path: Path, out_dir: Path, max_slices: int = 200) -> list[Path]:
    """Write viewer PNGs for a CT study, subsampling very long series."""
    series = load_ct_series(path)
    if len(series) > max_slices:
        indices = np.linspace(0, len(series) - 1, max_slices).round().astype(int)
        series = [series[i] for i in indices]
    out_dir.mkdir(parents=True, exist_ok=True)
    return [_write_png(image, out_dir / f"slice_{index:03d}.png")
            for index, image in enumerate(series)]


def sample_slice_paths(slice_paths: list[Path], count: int) -> list[Path]:
    """Evenly spaced subset, used to keep MedGemma inside its time budget."""
    if count <= 0 or len(slice_paths) <= count:
        return list(slice_paths)
    indices = np.linspace(0, len(slice_paths) - 1, count).round().astype(int)
    return [slice_paths[i] for i in dict.fromkeys(indices.tolist())]


def ct_slices_for_model(path: Path, count: int = 16) -> list[Path]:
    """Slices for a one-off CLI run: written to a temporary directory."""
    temp_dir = Path(tempfile.mkdtemp(prefix="nazar-ct-"))
    return sample_slice_paths(write_ct_slice_pngs(Path(path), temp_dir), count)


def as_png(path: Path, out_path: Path | None = None) -> Path:
    """Any supported image (including DICOM) as a PNG file, for MedGemma input."""
    path = Path(path)
    if out_path is None:
        if path.suffix.lower() == ".png":
            return path
        out_path = Path(tempfile.mkdtemp(prefix="nazar-img-")) / (path.stem + ".png")
    return _write_png(load_gray(path), out_path)
