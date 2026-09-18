"""Image loading for the AI modules: DICOM / PNG / JPG -> 8-bit grayscale array.

Head-CT specific steps (brain window, slice selection) are added with the CT
module; this file currently covers what the chest X-ray module needs.
"""

from pathlib import Path

import numpy as np
import pydicom
from PIL import Image
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
