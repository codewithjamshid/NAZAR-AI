# Demo chest X-rays

Open, freely redistributable samples used to exercise the M4 module (TZ §7).
No patient of ours is in this folder.

| File | Source | Note |
|---|---|---|
| `00000001_000.png` | NIH Clinical Center ChestX-ray8, via the torchxrayvision test set | NIH labels this case Cardiomegaly |
| `00027426_000.png` | NIH Clinical Center ChestX-ray8, via the torchxrayvision test set | |
| `siim_pneumothorax_sample.dcm` | SIIM-ACR Pneumothorax Segmentation sample (derived from NIH), via the torchxrayvision test set | real DICOM: JPEG Baseline, MONOCHROME2, already de-identified upstream |

Fetched from `https://github.com/mlmed/torchxrayvision/tree/main/tests`.
The NIH ChestX-ray collection is released by the NIH Clinical Center for free public use.

Run the module on one of them:

    cd backend && .venv/bin/python -m app.ai.cxr ../demo-data/cxr/00000001_000.png --heatmap /tmp/cam.png
