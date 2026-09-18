"""Head CT preprocessing on a real hospital series (TZ §7 M3)."""

import io
import zipfile

import numpy as np
import pydicom
import pytest

from app.ai import preprocess
from app.ai.medgemma import cache_key
from app.config import settings
from app.services.ingest import anonymise_dataset

CT_SAMPLE = settings.demo_data_path / "ct" / "cq500_head_ct_plain.zip"

pytestmark = pytest.mark.skipif(not CT_SAMPLE.is_file(), reason="demo CT sample missing")


def test_brain_window_maps_hounsfield_to_bytes():
    hounsfield = np.array([[-1000.0, 0.0, 40.0, 80.0, 3000.0]], dtype=np.float32)
    windowed = preprocess.brain_window(hounsfield)
    assert windowed.tolist() == [[0, 0, 128, 255, 255]]  # WL 40 / WW 80


def test_reads_a_jpeg_lossless_series_in_order():
    series = preprocess.load_ct_series(CT_SAMPLE)

    assert len(series) == 30
    assert all(image.shape == (512, 512) and image.dtype.name == "uint8" for image in series)
    middle = series[len(series) // 2]
    assert middle.max() == 255 and middle.mean() > 10   # brain tissue, not an empty frame


def test_writes_viewer_slices_and_samples_a_subset(tmp_path):
    paths = preprocess.write_ct_slice_pngs(CT_SAMPLE, tmp_path / "slices")

    assert len(paths) == 30
    assert [path.name for path in paths] == sorted(path.name for path in paths)
    assert all(path.is_file() and path.stat().st_size > 1000 for path in paths)

    sampled = preprocess.sample_slice_paths(paths, 16)
    assert len(sampled) == 16
    assert sampled[0] == paths[0] and sampled[-1] == paths[-1]


def test_long_series_is_subsampled_for_the_viewer(tmp_path):
    paths = preprocess.write_ct_slice_pngs(CT_SAMPLE, tmp_path / "few", max_slices=8)
    assert len(paths) == 8


def test_cache_key_is_the_series_uid_and_survives_reanonymisation(tmp_path):
    """The stub lookup must not change when a file is anonymised or re-zipped."""
    first = cache_key(CT_SAMPLE)
    assert first.startswith("series-")

    rebuilt = tmp_path / "again.zip"
    with zipfile.ZipFile(CT_SAMPLE) as src, zipfile.ZipFile(rebuilt, "w") as dst:
        for info in src.infolist():
            ds = pydicom.dcmread(io.BytesIO(src.read(info)))
            anonymise_dataset(ds)
            buf = io.BytesIO()
            ds.save_as(buf, enforce_file_format=True)
            dst.writestr(info.filename, buf.getvalue())

    assert cache_key(rebuilt) == first


def test_anonymisation_removed_the_identifiers():
    with zipfile.ZipFile(CT_SAMPLE) as archive:
        ds = pydicom.dcmread(io.BytesIO(archive.read(archive.namelist()[0])))
    assert str(ds.PatientName) == "ANONYMIZED"
    assert "PatientBirthDate" not in ds
    assert "InstitutionName" not in ds
    assert ds.Modality == "CT"
