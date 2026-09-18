# Demo runbook (3 daqiqa)

TZ §13 ssenariysi, haqiqiy tugmalar bilan. Ikki oyna: chapda hamshira ilovasi
(telefon o'lchami), o'ngda mutaxassis paneli.

## Tayyorgarlik (demo oldidan bir marta)

```bash
scripts/dev.sh start
cd backend && .venv/bin/python -m app.seed --cases --reset
```

`--reset` bazani tozalab, `demo-data/cases.json` dagi besh holatni qaytadan
quradi. Zonalar qoidalardan va modellardan chiqadi, qo'lda yozilmaydi.

Tekshiruv:

```bash
curl -s localhost:8000/health
```

`status: ok` bo'lishi kerak. Butun oqimni bir buyruq bilan tekshirish:

```bash
backend/.venv/bin/python scripts/smoke.py
```

14 ta tekshiruv: kirish, BE-FAST qizil zonasi, taymer, yuklash, worker, heatmap,
imzolangan havola, navbat tartibi, qaror, yopish taqiqi va jonli hodisalar. `medgemma_stub: true` — MedGemma GPU mashinada
ishlamayapti degani; ulangan bo'lsa `.env` da `MEDGEMMA_STUB=false` va
`MEDGEMMA_URL` ngrok manzili turadi.

Kirish: hamshira `+998901000001`, mutaxassis (nevrolog) `+998901000004`,
tuman operatori `+998901000003`. Parol hammasiga `demo1234`.

## Ssenariy

| Vaqt | Ekran | Harakat | Hakam ko'radigan narsa |
|---|---|---|---|
| 0:00 | Telefon | "+ Yangi holat": ism, 1968, erkak, simptom vaqti "1 soat oldin" | 30 soniyada holat ochildi |
| 0:30 | Telefon | Anamnez: shikoyatni yozish yoki mikrofon | O'zbek matn |
| 0:50 | Telefon | "Insult shubhasi?" → BE-FAST: yuz, qo'l, nutq → ha | Ekranda ball va "INSULT SHUBHASI" |
| 1:00 | Telefon | Natija ekrani | QIZIL, taymer ~230 daqiqa, eng yaqin KT masofasi, "nevrolog xabardor" |
| 1:10 | Panel | Navbat o'zi yangilanadi | Qizil qator tepada, ovoz signali, taymer |
| 1:30 | Planshet | Operator holatni telefon raqami bo'yicha topadi, bosh KT ZIP ni yuklaydi (`demo-data/ct/cq500_head_ct_plain.zip`) | DICOM yuklandi, anonimlashtirildi |
| 2:00 | Panel | Holatni ochish → KT ko'ruvchi | 30 kesim slayderi, eng shubhali kesimga sakrash |
| 2:20 | Panel | "Tasdiqlash", yo'nalish "viloyat", ko'rsatma yozish | Shifokor qarori, audit yozuvi |
| 2:40 | Telefon | Natija ekranida mutaxassis javobi paydo bo'ladi | Halqa yopildi |

Ikkinchi holat (vaqt qolsa): yangi holat → ko'krak rentgeni sifatida
`demo-data/cxr/00027426_000.png` ni yuklash → 3 soniyada natija, heatmap
yoqib/o'chirish → SARIQ zona.

## Savol-javobga tayyor jonli javoblar

- **"AI xato qilsa?"** Panelda "AI xato" tugmasini bosing. Qaror `audit_log` ga
  tushadi va statistika ekranida "AI xato" foizi o'zgaradi.
- **"AI o'zi yopadimi?"** Yo'q. Qarorsiz yopishga urinib ko'ring: server 409
  qaytaradi, "Holat mutaxassis qarorisiz yopilmaydi".
- **"Model ishlamasa?"** Demo holat #1 aynan shunday: KT yuklangan, MedGemma
  stub rejimida o'qimagan. Holat yo'qolmaydi — "KT yuklandi, AI o'qimadi"
  sababi bilan nevrolog navbatiga tushadi va qizil bo'lib qoladi.
- **"Qoidalar qayerda?"** `rules/triage.yaml`. Faylni tahrirlang (masalan
  `cxr.finding_min` ni 0,6 ga), keyin panelda holatni ochib "Qoidalar bo'yicha
  qayta hisoblash" tugmasini bosing. Server faylni qaytadan o'qiydi, zona va
  "Qoidalar versiyasi" yangilanadi — serverni qayta ishga tushirish shart emas.
- **"Bemor ismi bulutga ketadimi?"** Yo'q. Hisobot generatoriga faqat zona,
  sabablar va raqamlar yuboriladi; DICOM metama'lumoti yuklashda tozalanadi.

## Nosozlik bo'lsa

| Belgi | Nima qilish |
|---|---|
| Panel bo'sh | `scripts/dev.sh status`, keyin seed ni qayta ishga tushiring |
| Rasm ochilmaydi | Imzolangan havola muddati 1 soat — sahifani yangilang |
| AI natija kelmaydi | `.logs/worker.log` ga qarang; worker to'xtagan bo'lsa `scripts/dev.sh start` |
| MedGemma javob bermaydi | `.env` da `MEDGEMMA_STUB=true` qilib qo'ying: tizim CNN va qoidalar bilan ishlayveradi |
