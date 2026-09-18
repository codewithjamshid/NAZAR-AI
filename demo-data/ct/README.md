# Demo head CT

`cq500_head_ct_plain.zip` — one non-contrast head CT series, 30 axial slices,
512×512, JPEG Lossless, already de-identified upstream and anonymised again by
our own ingest path (`PatientName` = ANONYMIZED, institution and physician tags
removed, private tags dropped).

| Field | Value |
|---|---|
| Source | CQ500 head CT dataset, qure.ai (`headctstudy.qure.ai`), study CQ500-CT-0 |
| Series | "Plain", the standard-thickness non-contrast series of that study |
| Licence | CC BY-NC-SA 4.0 — research and demonstration only, no commercial use |
| Size | 4.4 MB (the original study archive is 157 MB; only this one series is kept) |

The dataset ships radiologist reads for each study. Do not treat this file as
ground truth for our own output: it is here so the CT path, the slice viewer and
the anonymisation can be exercised with real hospital data.

Check the preprocessing on it:

    cd backend
    .venv/bin/python -c "from app.ai import preprocess; \
      print(len(preprocess.write_ct_slice_pngs('../demo-data/ct/cq500_head_ct_plain.zip', '/tmp/slices')))"
