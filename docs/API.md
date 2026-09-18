# NAZAR AI — API contract

Generated from live responses (`backend`, seed data). Base URL: `http://localhost:8000/api/v1`.
Every endpoint except `/auth/login` and `/files/...` needs `Authorization: Bearer <token>`.

Demo accounts, all with password `demo1234`:

| Phone | Role | Note |
|---|---|---|
| +998901000001 | nurse | Pichoqchi FAP (Hazorasp) |
| +998901000002 | nurse | Qorako'l FAP (Xiva) |
| +998901000003 | operator | Hazorasp district hospital, attaches CT |
| +998901000004 | specialist | neurologist, Urganch |
| +998901000005 | specialist | therapist, Urganch |
| +998901000000 | admin | |

Rules: zones, BE-FAST points and the stroke window all come from `GET /meta`
(backed by `rules/triage.yaml`). Never hard-code those numbers in a screen.

Images are returned as **signed, expiring URLs** (`heatmap_url`, `images.base[]`,
`images.heatmap[]`). Use them directly in `<img src>`; they already contain the
signature and need no Authorization header.


### POST /auth/login

Body: `{"phone": "+998901000001", "password": "demo1234"}`

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "full_name": "Nilufar Matyoqubova",
    "role": "nurse",
    "specialty": null,
    "facility_id": 4
  }
}
```

### GET /meta

Clinical constants for the UI: BE-FAST points, stroke-suspicion rule, timer thresholds.

```json
{
  "rules_version": "2026-09-18-draft1",
  "befast": {
    "points": {
      "balance": 1,
      "eyes": 1,
      "face": 2,
      "arms": 2,
      "speech": 2
    },
    "stroke_min_score": 2,
    "stroke_any_of": [
      "face",
      "arms",
      "speech"
    ]
  },
  "stroke_window": {
    "warning_min": 180,
    "thrombolysis_min": 270
  },
  "disclaimer": "Dastlabki tahlil. Shifokor tasdig'i talab qilinadi."
}
```

### GET /cases?q=<case id or patient phone>

Nurse screen N2 and the operator's search (F-10). Same item shape as the queue.

```json
[
  {
    "case_id": 2,
    "zone": "yellow",
    "status": "triaged",
    "specialist_type": "cardiologist",
    "route": "regional",
    "district": "Hazorasp",
    "facility_name": "Pichoqchi qishloq FAP",
    "age": 45,
    "sex": "female",
    "summary": "SARIQ zona. Ehtiyot zonasi — mutaxassis ko'rishi kerak.",
    "reasons": [
      "Rentgen: 8 ta patologiya belgisi (chegara 0,5)",
      "Rentgen: Hosila 0,61, Tugun 0,54, O'pka o'chog'i 0,53"
    ],
    "readers_agree": null,
    "time_window_min": null,
    "stroke": {
      "score": null,
      "onset_at": null,
      "suspected": false,
      "befast_done": false,
      "elapsed_min": null,
      "window_state": null,
      "remaining_min": null
    },
    "waiting_min": 1,
    "created_at": "2026-09-18T07:30:25.498581+05:00",
    "has_decision": false
  },
  {
    "case_id": 1,
    "zone": "red",
    "status": "closed",
    "specialist_type": "neurologist",
    "route": "regional",
    "district": "Hazorasp",
    "facility_name": "Pichoqchi qishloq FAP",
    "age": 58,
    "sex": "male",
    "summary": "QIZIL zona. Shoshilinch holat.",
    "reasons": [
      "BE-FAST: yuz osilishi, qo'l kuchsizligi, nutq buzilishi (6 ball) — insult shubhasi; simptomdan 40 daqiqa o'tdi, trombolizis oynasi ochiq (230 daqiqa qoldi)",
      "Ma'lumot to'liq emas — AI hali hech bir tasvirni o'qimagan"
    ],
    "readers_agree": null,
    "time_window_min": 230,
    "stroke": {
      "score": 6,
      "onset_at": "2026-09-18T06:50:25.421180+05:00",
      "suspected": true,
      "befast_done": true,
      "elapsed_min": 40,
      "window_state": "open",
      "remaining_min": 230
    },
    "waiting_min": 1,
    "created_at": "2026-09-18T07:30:25.458601+05:00",
    "has_decision": true
  }
]
```

### GET /queue?mine=false&include_decided=false

Panel screen P1. Already sorted: red, yellow, green; oldest first inside a zone.

```json
[
  {
    "case_id": 2,
    "zone": "yellow",
    "status": "triaged",
    "specialist_type": "cardiologist",
    "route": "regional",
    "district": "Hazorasp",
    "facility_name": "Pichoqchi qishloq FAP",
    "age": 45,
    "sex": "female",
    "summary": "SARIQ zona. Ehtiyot zonasi — mutaxassis ko'rishi kerak.",
    "reasons": [
      "Rentgen: 8 ta patologiya belgisi (chegara 0,5)",
      "Rentgen: Hosila 0,61, Tugun 0,54, O'pka o'chog'i 0,53"
    ],
    "readers_agree": null,
    "time_window_min": null,
    "stroke": {
      "score": null,
      "onset_at": null,
      "suspected": false,
      "befast_done": false,
      "elapsed_min": null,
      "window_state": null,
      "remaining_min": null
    },
    "waiting_min": 1,
    "created_at": "2026-09-18T07:30:25.498581+05:00",
    "has_decision": false
  }
]
```

### GET /cases/{id}

Nurse screen N6 and panel screen P2. `triage` is the latest result, `studies[].images` drives the viewer.

```json
{
  "id": 1,
  "status": "closed",
  "zone": "red",
  "specialist_type": "neurologist",
  "route": "regional",
  "symptom_onset_at": "2026-09-18T06:50:25.421180+05:00",
  "created_at": "2026-09-18T07:30:25.458601+05:00",
  "closed_at": "2026-09-18T07:30:30.706686+05:00",
  "facility": {
    "id": 4,
    "name": "Pichoqchi qishloq FAP",
    "district": "Hazorasp",
    "type": "fap",
    "has_ct": false
  },
  "patient": {
    "id": 1,
    "full_name": "Bekmurod Aka",
    "birth_year": 1968,
    "age": 58,
    "sex": "male",
    "phone": "+998911112233",
    "district": "Hazorasp"
  },
  "anamnesis": {
    "befast": {
      "arms": true,
      "eyes": false,
      "face": true,
      "speech": true,
      "balance": false
    },
    "flags": {
      "chest_pain": false,
      "unconscious": false,
      "breathing_difficulty": false
    },
    "labs": {},
    "chief_complaint": "O'ng qo'li ishlamayapti, gapirolmayapti",
    "voice_transcript": null
  },
  "studies": [],
  "triage": {
    "id": 1,
    "zone": "red",
    "specialist_type": "neurologist",
    "route": "regional",
    "reasons": [
      "BE-FAST: yuz osilishi, qo'l kuchsizligi, nutq buzilishi (6 ball) — insult shubhasi; simptomdan 40 daqiqa o'tdi, trombolizis oynasi ochiq (230 daqiqa qoldi)",
      "Ma'lumot to'liq emas — AI hali hech bir tasvirni o'qimagan"
    ],
    "signals": [
      "stroke_in_window",
      "data_incomplete"
    ],
    "time_window_min": 230,
    "readers_agree": null,
    "rules_version": "2026-09-18-draft1",
    "stroke": {
      "score": 6,
      "onset_at": "2026-09-18T06:50:25.421180+05:00",
      "suspected": true,
      "befast_done": true,
      "elapsed_min": 40,
      "window_state": "open",
      "remaining_min": 230
    },
    "summary_nurse": "QIZIL zona. Shoshilinch holat.\nAsos: BE-FAST: yuz osilishi, qo'l kuchsizligi, nutq buzilishi (6 ball) — insult shubhasi; simptomdan 40 daqiqa o'tdi, trombolizis oynasi ochiq (230 daqiqa qoldi)\nShoshilinch: bemorni viloyat markaziga yuboring, nevrolog xabardor qilindi.\nTrombolizis oynasi: 230 daqiqa qoldi.",
    "summary_specialist": "Zona: QIZIL. Mutaxassis: nevrolog. Yo'nalish: viloyat markazi.\nAsoslar:\n  - BE-FAST: yuz osilishi, qo'l kuchsizligi, nutq buzilishi (6 ball) — insult shubhasi; simptomdan 40 daqiqa o'tdi, trombolizis oynasi ochiq (230 daqiqa qoldi)\n  - Ma'lumot to'liq emas — AI hali hech bir tasvirni o'qimagan\nIkki o'quvchi: solishtirib bo'lmadi (ikkinchi o'quvchi yo'q).\nQoidalar versiyasi: 2026-09-18-draft1. Dastlabki tahlil — shifokor tasdig'i talab qilinadi.",
    "report_model": "template-v1",
    "computed_at": "2026-09-18T07:30:25.472633+05:00"
  },
  "decisions": [
    {
      "id": 1,
      "specialist_id": 4,
      "specialist_name": "Dr. Otabek Yusupov",
      "specialty": "neurologist",
      "action": "confirm",
      "note": "Viloyatga transport, trombolizisga tayyorlansin",
      "route_final": "regional",
      "decided_at": "2026-09-18T07:30:30.688946+05:00"
    }
  ],
  "ne
```

### GET /stats/region?days=1

Panel screens P3 (map) and P4 (stats).

```json
{
  "days": 1,
  "districts": [
    {
      "district": "Hazorasp",
      "total": 2,
      "red": 1,
      "yellow": 1,
      "green": 0,
      "avg_response_min": 0.1,
      "lat": 41.25,
      "lng": 61.02
    }
  ],
  "totals": {
    "cases": 2,
    "red": 1,
    "yellow": 1,
    "green": 0,
    "avg_ai_ms": 2523,
    "avg_response_min": 0.1,
    "ai_error_rate": 0.0,
    "decisions": 1
  }
}
```

### GET /facilities/nearest?has_ct=true

Defaults to the caller's own facility coordinates.

```json
[
  {
    "id": 3,
    "name": "Hazorasp tuman tibbiyot birlashmasi",
    "type": "district",
    "district": "Hazorasp",
    "has_ct": true,
    "has_xray": true,
    "distance_km": 9.0
  },
  {
    "id": 1,
    "name": "Xorazm viloyat ko'p tarmoqli tibbiyot markazi",
    "type": "regional",
    "district": "Urganch",
    "has_ct": true,
    "has_xray": true,
    "distance_km": 46.8
  },
  {
    "id": 2,
    "name": "Xiva tuman tibbiyot birlashmasi",
    "type": "district",
    "district": "Xiva",
    "has_ct": true,
    "has_xray": true,
    "distance_km": 56.6
  }
]
```

### Write endpoints

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/patients` | nurse | `{full_name, birth_year, sex: "male"\|"female", phone?, district?}` |
| POST | `/cases` | nurse | `{patient_id, symptom_onset_at?}` (ISO 8601 with timezone) |
| POST | `/cases/{id}/anamnesis` | nurse, operator | `{befast: {balance,eyes,face,arms,speech: bool}, flags: {unconscious,breathing_difficulty,chest_pain: bool}, chief_complaint?, voice_transcript?}` → returns the full case detail with a fresh triage |
| POST | `/cases/{id}/studies` | nurse, operator | multipart: `type` = `ct_head`\|`cxr`\|`lab_photo`\|`voice`, `file` → returns the study; AI runs in the background |
| POST | `/cases/{id}/voice` | nurse, operator | multipart `file` (webm/ogg/wav/m4a) |
| POST | `/cases/{id}/labs` | nurse, operator | `{values: {"glucose": 7.8, ...}}` — nurse confirms the OCR table |
| POST | `/cases/{id}/open` | specialist | none → marks the case `in_review` |
| POST | `/cases/{id}/decision` | specialist | `{action: "confirm"\|"modify"\|"reject_ai", note?, route_final?: "onsite"\|"district"\|"regional"}` (`modify` requires a note) |
| POST | `/cases/{id}/close` | any with access | none → 409 if there is no specialist decision yet |
| POST | `/cases/{id}/triage` | any with access | none → recompute after the rules file changed |
| GET | `/studies/{id}/result` | any with access | poll one study while its AI runs |

Upload limits: head CT 300 MB (`.dcm` or a `.zip` series), images 20 MB (PNG/JPG, CXR also accepts `.dcm`),
voice 20 MB (webm/ogg/wav/m4a). The file's own bytes decide the format; a mismatch returns 400 with an Uzbek message.

### WebSocket

`ws://localhost:8000/api/v1/ws/queue` — after connecting send `{"token": "<jwt>"}` as the first
message. The server replies `{"type":"ready","role":"specialist"}`, then pushes
`{"type":"case.updated"|"case.decided", "case_id", "zone", "status", "specialist_type", "facility_id", "district"}`
and a `{"type":"ping"}` every 15 s. Events are filtered by role: a nurse sees her facility, an
operator sees his district, a specialist sees everything.

### Case status flow

`created` → `uploading` → `processing` → `triaged` (or `ai_failed`) → `in_review` → `decided` → `closed`.
A case never reaches `closed` without a decision row.

