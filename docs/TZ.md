<!-- Generated from 'NAZAR AI — Universal texnik topshiriq (TZ).docx'. Edit the docx, then regenerate. -->

# NAZAR AI — Universal texnik topshiriq (TZ)

Sep 17, 2026 · @Someone

## 1. Loyiha pasporti

NAZAR AI — chekka hududlardagi hamshira yuklagan tibbiy tasvir va tahlillarni sun'iy intellekt birinchi bo'lib o'qiydigan, xavf darajasini belgilaydigan va viloyat mutaxassisiga saralab yetkazadigan platforma.

| Maydon | Qiymat |
|---|---|
| Loyiha nomi | NAZAR AI (ishchi nom, o'zgartirilishi mumkin) |
| Shior | Har bir qishloqqa — mutaxassis nazari |
| Hakaton | Umummilliy AI Xakaton, Xorazm viloyati, 17–20 sentabr 2026 |
| Yo'nalish | Sog'liqni saqlash vazirligi va farmatsevtika sanoati |
| Tanlangan muammo | №13 — chekka qishloqlarda tor soha mutaxassislari va diagnostika uskunalari yetishmasligi |
| Vazirlik taklif qilgan yechim | Hududiy SI-Mobil Diagnostika: hamshira rentgen/tahlilni bulutga yuklaydi, SI tahlil qilib markaziy shifoxonaga yuboradi |
| Bizning kengaytma | Insult (neyro) yo'nalishi flagman modul sifatida, telefon-plyonka kirishi, o'zbek ovozli anamnez, xavfsizlik standarti |
| Jamoa | Neyroxirurg (klinik rahbar), tibbiyot talabasi + AI muhandis, dasturchi |
| Mahsulot turi | Web-platforma: hamshira PWA ilovasi + mutaxassis paneli + AI server |

Bu hujjat uch maqsadga xizmat qiladi: jamoa loyihani bir xil tushunishi, taqdimot uchun tayyor mazmun, kod yozishda spetsifikatsiya. Har bir bo'lim mustaqil o'qiladi.

## 2. Muammo va asoslash

Chekka qishloqda bemor bor, tasvir bor, lekin uni o'qiydigan mutaxassis yo'q — vaqt shu yerda yo'qoladi.

Uch darajali uzilish:

Qishloq (FAP, mobil klinika). Hamshira yoki feldsher bemorni ko'radi, lekin rentgen/KT ni talqin qila olmaydi. Qaror: "tumanga yuboraymi yoki yo'qmi?" — tajribaga tayanadi.

Tuman shifoxonasi. KT yoki rentgen apparati bor, lekin nevrolog, kardiolog, onkolog yo'q yoki faqat kunduzi bor. Tasvir viloyatga jo'natiladi, javob soatlab kutiladi.

Viloyat markazi (Urganch). Mutaxassis bor, lekin u tartibsiz kelayotgan tasvirlarni navbat bilan ko'radi — qaysi biri shoshilinch ekanini oldindan bilmaydi.

Nega insult — eng og'riqli nuqta:

Ishemik insultda trombolizis faqat simptom boshlanganidan 4,5 soat ichida samarali. Har 30 daqiqa kechikish nogironlik xavfini oshiradi.

Trombolizisdan oldin KT da qon quyilishi (gemorragik insult) yo'qligini tasdiqlash shart — buni o'qiydigan odam kerak.

Tuman shifoxonasida KT bor, o'qiydigan yo'q — bu aynan AI yechadigan bo'shliq.

Mavjud jarayon (soddalashtirilgan):

flowchart LR    A[Qishloq: simptom] --> B[Tumanga transport]    B --> C[KT qilinadi]    C --> D[Tasvir viloyatga yuboriladi]    D --> E[Mutaxassis navbatda ko'radi]    E --> F[Qaror tumanga qaytadi]

D va E qadamlar orasida soatlar yo'qoladi; NAZAR AI aynan shu ikki qadamni daqiqalarga tushiradi.

Raqamlar (neyroxirurg to'ldiradi):

| Ko'rsatkich | Qiymat |
|---|---|
| Xorazmdagi tumanlar soni | ___ |
| KT apparati bor tuman shifoxonalari | ___ |
| Viloyatdagi nevrolog/neyroxirurglar soni | ___ |
| Eng chekka tumandan Urganchgacha yo'l vaqti | ___ soat |
| Yiliga insult holatlari (taxminan) | ___ |
| Tasvir yuborilgandan mutaxassis javobigacha o'rtacha vaqt | ___ |

## 3. Yechim konsepsiyasi

NAZAR AI — "birinchi o'quvchi": tasvir va tahlillarni AI birinchi o'qiydi, mutaxassis esa AI saralagan va oldindan belgilangan holatlarni tasdiqlaydi. AI hech qachon oxirgi so'zni aytmaydi.

Yechim uch narsani qiladi:

| Vazifa | AI siz | AI bilan |
|---|---|---|
| Tasvirni o'qish | Mutaxassis navbatda, soatlab | 60 soniyada dastlabki xulosa + heatmap |
| Xavfni aniqlash | Hamshira tajribasiga qarab | Qizil/sariq/yashil + qaysi mutaxassis kerak |
| Yo'naltirish | Telefon qo'ng'iroqlari, kutish | Avtomatik navbat, shoshilinch holatga push |

AI-native asoslash — "AI olib tashlansa nima qoladi?"

AI olib tashlansa faqat fayl yuklash va chat qoladi: mutaxassis baribir hammasini o'zi o'qiydi, navbat o'zgarmaydi, hamshira qaror qila olmaydi. Ya'ni mahsulot yo'q bo'ladi. Bu loyihaning qiymati to'liq AI natijasida: tasvir tasnifi, xavf hisoblash, yo'naltirish.

Nega bu GPT-wrapper emas:

Zona qarorini ixtisoslashgan klassifikatorlar va neyroxirurg qoidalari chiqaradi; MedGemma 1.5 (mahalliy tibbiy VLM) tavsiflaydi, bulut LLM tushuntiradi — hech biri yolg'iz tashxis qo'ymaydi, ikki o'quvchi kelishmasa sariq.

LLM faqat tushuntiradi va strukturalaydi — tashxis qo'ymaydi.

Klinik qoidalar (BE-FAST, xavf zonalari) neyroxirurg tomonidan yozilgan, promptdan emas.

Dunyodagi analoglar (isbotlangan yo'nalish):

| Mahsulot | Nima qiladi | Holat |
|---|---|---|
| Viz.ai | KT da insult belgilarini aniqlab, nevrologga darhol xabar beradi | FDA tasdiqlagan |
| Aidoc | KT da qon quyilishini aniqlab, navbatda birinchi qo'yadi | FDA tasdiqlagan |
| Qure.ai qXR | Ko'krak rentgenida sil va boshqa patologiyalar | Ko'plab mamlakatlarda skrining |

Farqimiz: bu yechimlar katta shifoxonalar uchun. NAZAR AI qishloq hamshirasi telefonidan boshlanadi — DICOM bo'lmasa plyonka surati, internet bo'lmasa offline navbat, o'zbek tilida ovoz.

## 4. Foydalanuvchilar va rollar

Tizimda to'rt rol bor; hakaton MVP da birinchi uchtasi ishlaydi, administrator faqat ma'lumot to'ldirish uchun.

| Rol | Kim | Asosiy maqsadi | Qaysi interfeys | Huquqlari |
|---|---|---|---|---|
| Hamshira / feldsher | Qishloq FAP yoki mobil klinika xodimi | Bemorni tez ro'yxatga olish, tasvir/tahlil yuklash, qayerga yuborishni bilish | Hamshira ilovasi (telefon, PWA) | Holat yaratish, yuklash, AI natijasini ko'rish, mutaxassis qarorini ko'rish |
| Tuman operatori | Tuman shifoxonasi KT/rentgen laboranti yoki navbatchi shifokor | KT/rentgen tasvirini holatga biriktirish, AI natijasini ko'rish | Hamshira ilovasi (planshet/kompyuter) | Mavjud holatga DICOM biriktirish, AI natijasini ko'rish |
| Viloyat mutaxassisi | Nevrolog, neyroxirurg, kardiolog, radiolog (Urganch) | Shoshilinch holatni birinchi ko'rish, AI xulosasini tasdiqlash yoki o'zgartirish, qaror berish | Mutaxassis paneli (kompyuter) | Navbatni ko'rish, tasvir + heatmap, tasdiqlash/rad etish, ko'rsatma yozish, holatni yopish |
| Administrator | Viloyat sog'liqni saqlash boshqarmasi | Muassasalar, xodimlar, statistika | Admin panel (MVP da minimal) | Foydalanuvchi qo'shish, hisobotlar |

Rollar orasidagi oqim:

sequenceDiagram    participant H as Hamshira    participant AI as NAZAR AI    participant M as Mutaxassis    H->>AI: Anamnez + tasvir + tahlil    AI->>AI: Tasnif, xavf, yo'naltirish    AI->>M: Saralangan holat (qizil: push)    M->>AI: Tasdiq / o'zgartirish / ko'rsatma    AI->>H: Yakuniy qaror va keyingi qadam

Hamshira hech qachon AI bilan yolg'iz qolmaydi: har bir qizil va sariq holat mutaxassis qarori bilan yopiladi. Yashil holatda ham mutaxassis 24 soat ichida ko'rib tasdiqlaydi.

## 5. Tizim arxitekturasi va modullar

Tizim uch qatlamdan iborat: dala (hamshira ilovasi), AI (server), markaz (mutaxassis paneli). Hammasi bitta backend orqali bog'lanadi.

flowchart TD    subgraph Dala        N[Hamshira PWA<br/>offline navbat]    end    subgraph Server        API[FastAPI backend]        Q[Vazifa navbati<br/>Celery / Redis]        DB[(PostgreSQL)]        S3[(Fayl saqlash<br/>MinIO)]    end    subgraph AI        MG[MedGemma 1.5 4B<br/>mahalliy: KT, rentgen, tahlil]        CXR[torchxrayvision<br/>18 patologiya]        ICH[ICH CNN<br/>ixtiyoriy]        STT[O'zbek ovoz to'liq matn]        TR[Triyaj dvigateli<br/>kelishuv + qoidalar]        LLM[Hisobot generatori]    end    subgraph Markaz        P[Mutaxassis paneli<br/>real-time]    end    N --> API    API --> DB    API --> S3    API --> Q    Q --> MG    Q --> CXR    Q --> ICH    Q --> STT    MG --> TR    CXR --> TR    ICH --> TR    STT --> TR    TR --> LLM    LLM --> DB    DB --> P    API -.WebSocket.-> P

Hamshira yuklagan har bir fayl navbatga tushadi, AI modullar parallel ishlaydi, triyaj dvigateli natijalarni birlashtirib xavf zonasini chiqaradi, mutaxassis paneli WebSocket orqali darhol yangilanadi.

Modullar ro'yxati:

| # | Modul | Vazifasi | MVP da |
|---|---|---|---|
| M1 | Holat boshqaruvi | Bemor + holat yaratish, fayllar biriktirish, status | Ha |
| M2 | Anamnez moduli | BE-FAST anketasi, ovozli shikoyat, strukturali karta | Ha |
| M3 | KT-ICH moduli | Bosh KT: MedGemma o'qiydi (JSON), ICH CNN ikkinchi o'quvchi + heatmap | Ha (flagman) |
| M4 | Ko'krak rentgeni moduli | Pnevmoniya, sil belgilari, kardiomegaliya, tugun | Ha |
| M5 | Tahlil OCR moduli | Qon tahlili varag'idan qiymatlarni o'qish | Ha (soddalashtirilgan) |
| M6 | Triyaj dvigateli | Barcha natijalardan qizil/sariq/yashil + mutaxassis + yo'naltirish | Ha |
| M7 | Hisobot generatori | LLM: natijalarni shifokor tilida strukturali xulosaga aylantiradi | Ha |
| M8 | Mutaxassis paneli | Saralangan navbat, tasvir ko'ruvchi, tasdiqlash, taymer | Ha |
| M9 | Offline sinxronizatsiya | Internet yo'qda mahalliy saqlash, ulanganda yuklash | Ha (asosiy holat) |
| M10 | Audit va statistika | Har qaror logi, viloyat xaritasi, javob vaqti | Qisman |
| M11 | Admin panel | Muassasa va xodimlar boshqaruvi | Keyingi bosqich |
| M12 | Milliy tizim integratsiyasi | Elektron sog'liqni saqlash tizimi bilan almashinuv | Keyingi bosqich |

## 6. Funksional talablar

MVP = hakatonda ishlashi shart bo'lgan talablar (P0), demo uchun kuchli qo'shimcha (P1), keyingi bosqich (P2).

Hamshira / feldsher:

| ID | User story | Qabul mezoni | Ustuvorlik |
|---|---|---|---|
| F-01 | Hamshira sifatida 30 soniyada yangi holat ochmoqchiman | Ism, yosh, jins, telefon, simptom boshlangan vaqt — 5 ta maydon, keyin "Boshlash" | P0 |
| F-02 | Shikoyatni ovoz bilan aytmoqchiman, yozishga vaqt yo'q | Mikrofon tugmasi, o'zbek nutq matnga aylanadi, LLM strukturali kartaga yozadi, tahrirlash mumkin | P1 |
| F-03 | Insult shubhasida BE-FAST anketasini to'ldirmoqchiman | 6 ta ha/yo'q savol, har biri rasm bilan, natija darhol ko'rinadi | P0 |
| F-04 | KT yoki rentgen faylini yuklamoqchiman | DICOM (.dcm, ZIP) va rasm (JPG/PNG) qabul qilinadi, yuklash foizi ko'rinadi | P0 |
| F-05 | Rentgen plyonkasini telefon bilan suratga olmoqchiman | Kamera ochiladi, ramka ko'rsatiladi, perspektiva avtomatik tuzatiladi | P1 |
| F-06 | Qon tahlili qog'ozini suratga olib qiymatlarni olmoqchiman | OCR jadval chiqaradi, hamshira tekshirib tasdiqlaydi | P1 |
| F-07 | AI natijasini va nima qilishni tushunarli ko'rmoqchiman | Rang zonasi, 1 jumlalik xulosa, "Keyingi qadam" bloki, qaysi mutaxassisga yuborilgani | P0 |
| F-08 | Internet yo'qda ham ishlashni xohlayman | Holat mahalliy saqlanadi, "Yuborish kutilmoqda" belgisi, ulanganda avtomatik yuboriladi | P1 |
| F-09 | Mutaxassis qarorini o'z ilovamda ko'rmoqchiman | Bildirishnoma keladi, holatda mutaxassis ko'rsatmasi ko'rinadi | P0 |

Tuman operatori:

| ID | User story | Qabul mezoni | Ustuvorlik |
|---|---|---|---|
| F-10 | Qishloqdan kelgan bemorning mavjud holatiga KT biriktirmoqchiman | Holat ID yoki telefon orqali qidirish, DICOM yuklash | P0 |
| F-11 | AI natijasini KT qilingan zahoti ko'rmoqchiman | 60 soniya ichida natija va heatmap ko'rinadi | P0 |

Viloyat mutaxassisi:

| ID | User story | Qabul mezoni | Ustuvorlik |
|---|---|---|---|
| F-12 | Navbatni xavf bo'yicha saralangan ko'rmoqchiman | Qizil yuqorida, keyin sariq, yashil; har qatorda tuman, yosh, AI xulosasi, kutish vaqti | P0 |
| F-13 | Qizil holat kelganda darhol bilmoqchiman | Ekranda push + ovoz, brauzer bildirishnomasi | P0 |
| F-14 | Insult holatida vaqt oynasini ko'rmoqchiman | Simptom boshlangan vaqtdan 4,5 soat sanaydigan taymer, rang o'zgaradi | P0 |
| F-15 | Tasvirni heatmap bilan ko'rmoqchiman | Asl tasvir / heatmap almashtirish, KT da kesimlar bo'ylab yurish, zoom | P0 |
| F-16 | AI xulosasini tasdiqlash yoki o'zgartirmoqchiman | "Tasdiqlash", "O'zgartirish" (matn), "AI xato" tugmalari; ko'rsatma maydoni | P0 |
| F-17 | Bemorni qayerga yuborishni belgilamoqchiman | Ro'yxatdan tanlash: joyida davolash / tumanda qoldirish / viloyatga transport | P0 |
| F-18 | Har qarorim saqlanishini xohlayman | Audit jurnali: kim, qachon, nima o'zgartirdi | P1 |

Tizim (foydalanuvchisiz):

| ID | Talab | Ustuvorlik |
|---|---|---|
| S-01 | Har yuklangan tasvir 60 soniya ichida AI tomonidan qayta ishlanadi | P0 |
| S-02 | Triyaj dvigateli barcha mavjud natijalarni birlashtirib zona chiqaradi; ma'lumot kam bo'lsa "sariq" (ehtiyot) | P0 |
| S-03 | AI natija bilan birga ishonch foizi va "bu tashxis emas" belgisi saqlanadi | P0 |
| S-04 | Modul ishlamasa holat "AI natijasi yo'q, mutaxassis ko'rsin" statusi bilan navbatga tushadi | P0 |
| S-05 | Viloyat xaritasi: tumanlar bo'yicha holatlar va o'rtacha javob vaqti | P1 |
| S-06 | Admin panel, muassasa boshqaruvi, milliy tizim integratsiyasi | P2 |

## 7. AI modullari spetsifikatsiyasi

Tamoyil — ikki mustaqil o'quvchi: MedGemma 1.5 4B (Google'ning ochiq tibbiy modeli, mahalliy serverda, o'zgartirilmagan) tasvirni tavsiflaydi, ixtisoslashgan klassifikatorlar raqam beradi; yashil zona faqat ikkalasi kelishganda chiqadi, kelishmasa — sariq.

Model ro'yxati:

| Model | Turi | Qayerda ishlaydi | Vazifasi |
|---|---|---|---|
| MedGemma 1.5 4B (google/medgemma-1.5-4b-it) | Ochiq tibbiy VLM, o'zgartirilmagan | Mahalliy GPU (bf16, ~10 GB VRAM) yoki M4 MacBook (kvantlangan) | Bosh KT o'qish (3D), ko'krak rentgen tavsifi + bounding box, tahlil varag'i → JSON, offline hisobot |
| torchxrayvision DenseNet121 | Ixtisoslashgan CNN | CPU yetarli | Ko'krak rentgen: 18 patologiya ehtimoli + Grad-CAM |
| ICH CNN (RSNA og'irliklari) | Ixtisoslashgan CNN | GPU yoki CPU | Bosh KT: qon quyilishi ehtimoli + Grad-CAM — topilsa ikkinchi o'quvchi, topilmasa bo'sh |
| faster-whisper (medium) yoki HF o'zbekcha Whisper | STT | CPU | O'zbek ovoz → matn |
| Claude / Gemini API | Bulut LLM | Bulut (bemor ismi yuborilmaydi) | Hisobotni hamshira va mutaxassis tiliga; internet yo'qda MedGemma bajaradi |

M3 — Bosh KT o'qish (flagman)

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | Bosh KT, DICOM seriya; pydicom bilan o'qiladi, brain window (WL 40 / WW 80); MedGemma uchun seriyadan teng oraliqda N kesim (long-context slicing) |
| Asosiy o'quvchi | MedGemma 1.5, temperature=0, faqat JSON: hemorrhage (yes / no / uncertain), hemorrhage_type (epidural / subdural / subarachnoid / intraparenchymal / intraventricular / none), midline_shift (yes / no / uncertain), findings[], confidence (high / medium / low); schema validatsiya, ro'yxatdan tashqari tashxis rad etiladi |
| Ikkinchi o'quvchi | ICH CNN: ich_probability (0–1), eng shubhali kesim, Grad-CAM heatmap PNG. Og'irliklar 1-kun 18:00 gacha topilmasa — bo'sh qoladi |
| Qaror qoidasi | yes + high → qizil; uncertain yoki low → sariq; no + high va (CNN < 0,3 yoki CNN yo'q + BE-FAST manfiy) → yashil; MedGemma va CNN kelishmasa → sariq |
| Vaqt | ≤ 90 s (GPU); demo holatlari oldindan hisoblanib keshlanadi |
| Zaxira | MedGemma ishlamasa → faqat CNN; ikkalasi yo'q → "KT yuklandi, AI o'qimadi", nevrologga birinchi navbat, triyaj BE-FAST asosida |
| Cheklov (pitchda ochiq aytiladi) | Google MedGemma'ni validatsiya va moslashtirishsiz klinik foydalanishga mo'ljallamagan; bosh KT da moslashtirilmagan holda aniqligi cheklangan — shuning uchun bu tashxis emas, triyaj, va mutaxassis tasdig'i majburiy |

M4 — Ko'krak rentgeni

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | DICOM yoki JPG/PNG; plyonka surati bo'lsa OpenCV: kulrang, perspektiva tuzatish, 224×224 (CNN) va asl o'lcham (MedGemma) |
| Asosiy o'quvchi | torchxrayvision DenseNet(weights="densenet121-res224-all"): 18 patologiya ehtimoli, Grad-CAM; o'qitish shart emas |
| Ikkinchi o'quvchi | MedGemma 1.5: topilmalar tavsifi + bounding box lokalizatsiya, JSON |
| Qaror qoidasi | Raqam qaror qiladi: patologiya ≥ 0,5 belgilanadi; Pneumothorax ≥ 0,7 → qizil; Pneumonia/Consolidation/Effusion ≥ 0,6 yoki ko'p patologiya → sariq. MedGemma CNN topmagan muhim topilma aytsa → sariq |
| Vaqt | CNN ≤ 5 s; MedGemma ≤ 20 s |
| Zaxira | Yo'q — CNN kafolatli ishlaydi; KT muammo bo'lsa bu modul demoda flagman bo'ladi |

M5 — Tahlil varag'i (OCR)

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | Qon tahlili qog'ozining surati |
| Model | MedGemma 1.5 document understanding: rasm → JSON {"hemoglobin":112,"glucose":7.8,"wbc":11.2,...}; norma chegarasidan chiqqanlar belgilanadi |
| Zaxira | Bulut multimodal LLM; u ham bo'lmasa hamshira qo'lda kiritadi (forma tayyor) |
| Nazorat | Hamshira jadvalni ko'rib tasdiqlaydi |

M2 — O'zbek ovozli anamnez (STT)

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | Hamshira ovozi, 10–60 s, brauzer MediaRecorder (webm/ogg) |
| Chiqish | Matn → LLM → strukturali karta: asosiy shikoyat, boshlangan vaqt, qo'shimcha kasalliklar, dorilar |
| Model | faster-whisper (medium) yoki HF o'zbekcha fine-tune Whisper; CPU da yetarli |
| Zaxira | Matn kiritish maydoni |

M6 — Triyaj dvigateli

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | BE-FAST natijasi, MedGemma JSON (KT, rentgen), CNN ehtimollari, OCR qiymatlari, yosh, simptom boshlangan vaqt |
| Chiqish | zone (red/yellow/green), specialist (nevrolog, kardiolog, pulmonolog, radiolog, terapevt), route (joyida / tuman / viloyat), reasons[], time_window_min, readers_agree (true/false) |
| Mantiq | Qoidalar rules/triage.yaml da (8-bo'lim), neyroxirurg yozadi; kodga qattiq yozilmaydi |
| Tamoyil | Ma'lumot yetarli bo'lmasa — sariq; ikki o'quvchi kelishmasa — sariq; har zona uchun sabab ko'rsatiladi |

M7 — Hisobot generatori

| Parametr | Spetsifikatsiya |
|---|---|
| Kirish | Barcha modullar natijasi JSON holida (bemor ismisiz) |
| Chiqish | Ikki matn: hamshira uchun (oddiy tilda, 2–3 jumla, keyingi qadam) va mutaxassis uchun (strukturali: topilmalar, ehtimollar, ikki o'quvchi kelishuvi, tavsiya) |
| Model | Claude yoki Gemini API; internet yo'qda MedGemma (offline rejim) |
| Nazorat | System prompt: "Sen tashxis qo'ymaysan, faqat natijalarni tushuntirasan; yangi topilma qo'shma"; JSON schema + kalit so'z tekshiruvi — model natijasida bo'lmagan tashxis rad etiladi |

Umumiy AI oqimi:

flowchart LR    U[Yuklangan fayl] --> T{Turi?}    T -->|Bosh KT| MG1[MedGemma: KT JSON]    T -->|Bosh KT| ICH[ICH CNN: ehtimol]    T -->|Ko'krak rentgen| CXR[torchxrayvision: 18 raqam]    T -->|Ko'krak rentgen| MG2[MedGemma: tavsif + box]    T -->|Tahlil surati| MG3[MedGemma: JSON]    T -->|Ovoz| STT    MG1 --> TR[Triyaj: kelishuv + qoidalar]    ICH --> TR    CXR --> TR    MG2 --> TR    MG3 --> TR    STT --> TR    TR --> LLM[Hisobot]    LLM --> OUT[Zona + xulosa + heatmap]

Bitta tasvir ikki o'quvchiga parallel boradi; triyaj avval kelishuvni tekshiradi, keyin qoidalarni qo'llaydi. Fayl turini hamshira tanlaydi (KT / rentgen / tahlil / ovoz), avtomatik aniqlash MVP da yo'q.

## 8. Klinik triyaj protokoli

Qoidalar neyroxirurg tomonidan tasdiqlanadi va rules/triage.yaml faylida saqlanadi; quyidagi jadvallar boshlang'ich taklif, klinik jamoa o'zgartiradi.

BE-FAST anketasi (insult shubhasi):

| Harf | Savol (hamshira uchun) | Ha bo'lsa |
|---|---|---|
| B — Balance | Bemor to'satdan muvozanatini yo'qotdimi, gandiraklayaptimi? | +1 |
| E — Eyes | To'satdan ko'rish buzildimi (bir ko'z yoki ikkalasi)? | +1 |
| F — Face | Kulganda yuzning bir tomoni osilib qoladimi? | +2 |
| A — Arms | Ikki qo'lni ko'targanda bittasi tushib ketadimi? | +2 |
| S — Speech | Nutq buzilgan, so'zlar tushunarsizmi? | +2 |
| T — Time | Simptom qachon boshlangan? (aniq vaqt yoki "uyg'onganda bor edi") | Taymer |

Ball ≥ 2 yoki F/A/S dan bittasi "ha" → insult shubhasi, holat avtomatik "neyro yo'l"ga tushadi.

Xavf zonalari:

| Zona | Mezon (birortasi yetarli) | Tizim harakati |
|---|---|---|
| Qizil | Insult shubhasi + simptomdan 4,5 soat o'tmagan; ICH ehtimoli ≥ 0,8; CXR da Pneumothorax ≥ 0,7; hushsizlik, nafas qiyinlashuvi (anketa) | Nevrologga darhol push + ovoz; taymer; eng yaqin KT/viloyatga transport tavsiyasi |
| Sariq | Insult shubhasi, lekin 4,5 soatdan o'tgan; ICH 0,3–0,8; CXR da Pneumonia/Consolidation/Effusion ≥ 0,6; ikki va undan ko'p patologiya; OCR da kritik qiymat (masalan glukoza > 15 yoki < 3) ; ma'lumot to'liq emas | Mutaxassis navbatida yuqori; 2 soat ichida ko'rish |
| Yashil | Hech qanday xavf belgisi yo'q, ICH < 0,3, CXR patologiyalar < 0,5, tahlillar normada | Oddiy navbat; 24 soat ichida tasdiq |

Mutaxassisga yo'naltirish:

| Topilma | Mutaxassis | Yo'nalish |
|---|---|---|
| Insult shubhasi / ICH | Nevrolog (qon quyilishi ≥ 0,8 bo'lsa neyroxirurg ham) | Viloyat |
| Pneumothorax, ko'p Consolidation | Pulmonolog / xirurg | Tuman yoki viloyat |
| Pneumonia, Effusion | Terapevt / pulmonolog | Tuman |
| Cardiomegaly, ko'krak og'rig'i (anketa) | Kardiolog | Viloyat |
| Nodule / Mass | Onkolog / radiolog | Viloyat (rejali) |
| Hech narsa | Oilaviy shifokor | Joyida |

Insult vaqt oynasi:

stateDiagram-v2    [*] --> Oyna_ochiq: simptom vaqti kiritildi    Oyna_ochiq --> Oyna_yopilmoqda: 3 soat o'tdi    Oyna_yopilmoqda --> Oyna_yopiq: 4,5 soat o'tdi    Oyna_ochiq --> Qaror: mutaxassis tasdiqladi    Oyna_yopilmoqda --> Qaror: mutaxassis tasdiqladi    Oyna_yopiq --> Qaror: kech davolash yo'li

Panelda taymer yashil (0–3 soat), sariq (3–4,5 soat), qizil (4,5 soatdan keyin) rangda ko'rinadi; "uyg'onganda bor edi" bo'lsa oxirgi sog'lom ko'rilgan vaqt olinadi.

Neyroxirurg tekshirib to'ldiradi:

☐ BE-FAST ballari va chegarasi to'g'rimi?

☐ ICH threshold'lar (0,3 / 0,5 / 0,8) klinik jihatdan maqbulmi?

☐ Yo'naltirish jadvalida Xorazm sharoitiga mos mutaxassislar ko'rsatilganmi?

☐ Demo uchun 5 ta test holat: 2 qizil, 2 sariq, 1 yashil

## 9. Ma'lumotlar modeli va API

Yettita asosiy jadval va 14 ta endpoint MVP uchun yetarli; nomlar kodda aynan shu holda ishlatiladi.

Entitylar:

| Jadval | Asosiy maydonlar | Izoh |
|---|---|---|
| users | id, full_name, role (nurse / operator / specialist / admin), specialty, facility_id, phone, password_hash | Rol va mutaxassislik yo'naltirish uchun |
| facilities | id, name, type (fap / district / regional), district, lat, lng, has_ct, has_xray | Xarita va "eng yaqin KT" uchun |
| patients | id, full_name, birth_year, sex, phone, district | Minimal identifikatsiya, PINFL yo'q (MVP) |
| cases | id, patient_id, created_by, facility_id, status, zone, specialist_type, route, symptom_onset_at, created_at, closed_at | Bitta murojaat = bitta case |
| anamnesis | id, case_id, befast_json, voice_transcript, structured_json, chief_complaint | BE-FAST + ovoz natijasi |
| studies | id, case_id, type (ct_head / cxr / lab_photo / voice), file_path, source (dicom / photo), uploaded_at | Har fayl alohida study |
| ai_results | id, study_id, module (ich / cxr / ocr / stt), output_json, confidence, heatmap_path, model_version, processed_at, duration_ms | Model chiqishi o'zgartirilmaydi |
| triage_results | id, case_id, zone, specialist_type, route, reasons_json, time_window_min, rules_version, computed_at | Triyaj natijasi, qayta hisoblanishi mumkin |
| decisions | id, case_id, specialist_id, action (confirm / modify / reject_ai), note, route_final, decided_at | Mutaxassis qarori |
| audit_log | id, user_id, case_id, action, payload_json, created_at | Har muhim harakat |

Case statuslari:

stateDiagram-v2    [*] --> created    created --> uploading: fayl yuklanmoqda    uploading --> processing: AI navbatda    processing --> triaged: zona chiqdi    processing --> ai_failed: modul ishlamadi    triaged --> in_review: mutaxassis ochdi    ai_failed --> in_review    in_review --> decided: qaror berildi    decided --> closed

REST endpointlar (prefiks /api/v1):

| Metod | Yo'l | Kim | Vazifa |
|---|---|---|---|
| POST | /auth/login | Hamma | JWT olish |
| POST | /patients | Hamshira | Bemor yaratish |
| POST | /cases | Hamshira | Holat ochish (patient_id, symptom_onset_at) |
| GET | /cases/{id} | Hamma | Holat to'liq: anamnez, studies, ai_results, triage, decisions |
| POST | /cases/{id}/anamnesis | Hamshira | BE-FAST va shikoyat saqlash |
| POST | /cases/{id}/voice | Hamshira | Ovoz fayli → STT → strukturali karta |
| POST | /cases/{id}/studies | Hamshira, operator | Fayl yuklash (multipart; type maydoni) → navbatga |
| GET | /studies/{id}/result | Hamma | AI natijasi + heatmap URL |
| POST | /cases/{id}/triage | Tizim | Triyajni qayta hisoblash (ichki) |
| GET | /queue | Mutaxassis | Saralangan navbat (zone, kutish vaqti bo'yicha) |
| POST | /cases/{id}/decision | Mutaxassis | Tasdiqlash / o'zgartirish / rad etish + ko'rsatma |
| GET | /facilities/nearest?lat=&lng=&has_ct=true | Hamshira | Eng yaqin KT bor muassasa |
| GET | /stats/region | Admin, mutaxassis | Tumanlar bo'yicha holatlar va o'rtacha javob vaqti |
| WS | /ws/queue | Mutaxassis | Yangi/qizil holat real-time |

Triyaj natijasi JSON namunasi:

{  "case_id": 1042,  "zone": "red",  "specialist_type": "neurologist",  "route": "regional",  "time_window_min": 187,  "reasons": [    "BE-FAST: yuz osilishi + nutq buzilishi (4 ball)",    "KT: qon quyilishi ehtimoli 0.06 — ishemik insult ehtimoli yuqori",    "Simptomdan 83 daqiqa o'tdi, trombolizis oynasi ochiq"  ],  "ai_summary_nurse": "Insult shubhasi. Bemorni darhol viloyat shifoxonasiga yuboring, nevrolog xabardor.",  "rules_version": "2026-09-18-v1"}

reasons ro'yxati har doim to'ldiriladi — mutaxassis va hamshira nega shu zona ekanini ko'radi.

## 10. Texnologiyalar steki

Stek jamoa allaqachon biladigan vositalardan tuzilgan; 3 kunda yangi texnologiya o'rganilmaydi.

| Qatlam | Texnologiya | Nega |
|---|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy, Pydantic | AI kutubxonalari bilan bitta tilda; avtomatik OpenAPI hujjat |
| Fon vazifalar | Celery + Redis (yoki FastAPI BackgroundTasks — soddaroq) | AI ishlovi so'rovni bloklamasin |
| Ma'lumotlar bazasi | PostgreSQL 16 | JSONB maydonlar AI natijalari uchun qulay |
| Fayl saqlash | MinIO (S3-mos) yoki oddiy disk | DICOM va heatmaplar |
| Real-time | WebSocket (FastAPI native) | Mutaxassis paneliga push |
| Hamshira ilovasi | React + Vite, PWA (Workbox), IndexedDB (Dexie) | Telefonda o'rnatiladi, offline navbat |
| Mutaxassis paneli | React + Vite, Tailwind, Cornerstone.js yoki serverda PNG + slayder | DICOM kesimlarini ko'rish, heatmap qatlami |
| Tibbiy VLM (asosiy o'quvchi) | MedGemma 1.5 4B — transformers ≥ 4.50 (bf16) yoki vLLM; Mac da MLX/llama.cpp kvantlangan | KT o'qish, rentgen tavsifi, tahlil OCR, offline hisobot — bitta model, mahalliy |
| CXR klassifikatori | torchxrayvision | Tayyor, o'qitish shart emas, CPU da ishlaydi |
| KT-ICH klassifikatori (ixtiyoriy) | PyTorch, torchvision (ResNet/EfficientNet), pytorch-grad-cam, RSNA og'irliklari | Ikkinchi o'quvchi; topilmasa tashlab ketiladi |
| DICOM ishlov | pydicom, numpy | Seriya o'qish, brain window, kesim tanlash |
| STT | faster-whisper (medium) yoki HF o'zbekcha Whisper | CPU da ishlaydi |
| Bulut LLM | Claude yoki Gemini API | Hisobot va strukturalash; internet yo'qda MedGemma |
| Tasvir oldindan ishlov | OpenCV, Pillow | Plyonka surati: perspektiva, kulrang, kontrast |
| Infratuzilma | Docker Compose (api, worker, medgemma, db, redis, minio, web) | Bir buyruq bilan ko'tariladi; MedGemma alohida konteyner/servis |
| Hosting (demo) | GPU li noutbuk yoki M4 MacBook (≥ 24 GB) — MedGemma uchun; yoki bitta GPU VPS (≥ 16 GB VRAM) + ngrok | MedGemma uchun GPU shart; qolgani CPU da |

Loyiha papka tuzilmasi:

nazar-ai/├── docker-compose.yml├── backend/│   ├── app/│   │   ├── main.py            # FastAPI, routerlar, WS│   │   ├── models/            # SQLAlchemy jadvallar (9-bo'lim)│   │   ├── schemas/           # Pydantic (MedGemma JSON schema'lari ham shu yerda)│   │   ├── routers/           # auth, cases, studies, queue, decisions, stats│   │   ├── services/│   │   │   ├── triage.py      # qoidalar dvigateli + ikki o'quvchi kelishuvi│   │   │   ├── report.py      # hisobot: bulut LLM yoki MedGemma│   │   │   └── storage.py     # fayl saqlash│   │   ├── ai/│   │   │   ├── medgemma.py    # MedGemma 1.5 klienti: KT, rentgen, tahlil — JSON + validatsiya│   │   │   ├── cxr.py         # torchxrayvision + Grad-CAM│   │   │   ├── ich.py         # ICH CNN (ixtiyoriy ikkinchi o'quvchi)│   │   │   ├── stt.py         # whisper│   │   │   ├── prompts/       # medgemma_ct.txt, medgemma_cxr.txt, medgemma_lab.txt│   │   │   └── preprocess.py  # dicom → array, brain window, kesim tanlash, plyonka surati│   │   └── workers/tasks.py   # Celery vazifalari (parallel ikki o'quvchi)│   ├── rules/triage.yaml      # neyroxirurg tahrirlaydi│   ├── weights/               # model og'irliklari (gitga qo'shilmaydi)│   └── tests/├── medgemma-service/          # alohida servis: transformers/vLLM, /infer endpoint├── nurse-app/                 # React PWA│   └── src/│       ├── pages/             # NewCase, BeFast, Upload, Result│       ├── offline/queue.ts   # IndexedDB navbat + sync│       └── api/├── specialist-panel/          # React│   └── src/│       ├── pages/             # Queue, CaseView, Map│       ├── viewer/            # DICOM + heatmap│       └── ws/└── demo-data/                 # 5 ta test holat, DICOM namunalar, keshlangan MedGemma natijalari

Muhit o'zgaruvchilari (.env): DATABASE_URL, REDIS_URL, STORAGE_PATH, LLM_API_KEY, LLM_PROVIDER, ICH_WEIGHTS_PATH, JWT_SECRET, RULES_PATH.

Ochiq manbalar (kod yozishda kerak):

| Resurs | Nima uchun |
|---|---|
| MedGemma 1.5 4B (Hugging Face) | Asosiy o'quvchi; litsenziyani qabul qilish kerak |
| MedGemma 1.5 model card | Imkoniyatlar, cheklovlar, KT/laboratoriya misollari, notebooklar |
| MedGemma 1.5 texnik hisobot | Pitchda manba: 3D KT, tahlil hisobotlari, lokalizatsiya |
| torchxrayvision | CXR klassifikatori: pip install torchxrayvision |
| RSNA ICH Detection (Kaggle) | KT dataseti va ochiq yechimlar (ixtiyoriy) |
| pytorch-grad-cam | Heatmap |
| faster-whisper | STT |
| pydicom | DICOM o'qish |

## 11. Nofunksional talablar, xavfsizlik va etika

Besh tamoyil: AI oxirgi so'zni aytmaydi, har natija tushuntiriladi, har qaror saqlanadi, tizim internetsiz ham ishlaydi, bemor ma'lumoti minimal.

Nofunksional talablar:

| Talab | Mezon |
|---|---|
| AI javob vaqti | CXR ≤ 5 s; KT seriya ≤ 60 s (GPU) / ≤ 180 s (CPU); OCR ≤ 15 s; STT ≤ 20 s |
| Interfeys tezligi | Hamshira ilovasida har ekran ≤ 2 s; panel navbati ≤ 1 s yangilanadi |
| Offline | Holat va fayllar IndexedDB da saqlanadi; ulanganda avtomatik yuklanadi; 24 soatgacha saqlash |
| Fayl hajmi | KT seriya ≤ 300 MB (ZIP), rasm ≤ 20 MB; katta fayl qismlarga bo'lib yuklanadi |
| Ishonchlilik | Bitta AI modul yiqilsa boshqalar ishlaydi; natija yo'q holat mutaxassisga baribir boradi |
| Bir vaqtda foydalanuvchi | Demo: 10; maqsad: viloyat bo'yicha 200 |
| Brauzerlar | Chrome/Safari (mobil), Chrome/Edge (panel) |

AI xavfsizlik tamoyillari (6-muammoga javob):

Birinchi o'quvchi, oxirgi emas. Har AI natijasi yonida "Dastlabki tahlil — shifokor tasdig'i talab qilinadi" belgisi; hech qanday holat mutaxassis qarorisiz yopilmaydi.

Tushuntirish majburiy. Har tasnif bilan ishonch foizi va Grad-CAM heatmap; triyaj bilan reasons ro'yxati.

LLM tashxis qo'ymaydi. Hisobot generatori faqat model natijalarini qayta aytadi; schema validatsiya + kalit so'z tekshiruvi model natijasida bo'lmagan tashxisni bloklaydi.

Xavfsiz tomonga xato. Ma'lumot kam yoki modul ishlamasa — sariq; hech qachon avtomatik yashil emas.

To'liq audit. Kim, qachon, qaysi model versiyasi, qaysi qoidalar versiyasi, mutaxassis nimani o'zgartirdi — hammasi audit_log da; "AI xato" tugmasi bosilganlar alohida hisobotda (model sifatini kuzatish).

Chegara aniq. Tizim skrining va triyaj vositasi, tibbiy buyum sifatida sertifikatlanmagan — demo va pilotda shunday e'lon qilinadi.

Ma'lumot himoyasi:

Bemor identifikatsiyasi minimal: ism, tug'ilgan yil, jins, telefon; PINFL va manzil MVP da yig'ilmaydi.

HTTPS majburiy; JWT muddati 12 soat; rol asosida ruxsat (hamshira faqat o'z muassasasi holatlarini ko'radi).

Tasvirlar va heatmaplar faqat tizim ichida, tashqi havola yo'q; DICOM metama'lumotidan ism o'chiriladi (anonimlashtirish).

Model og'irliklari va bemor ma'lumotlari O'zbekiston hududidagi serverda saqlanadi (pilot talabi).

LLM API ga faqat strukturali raqamlar va topilmalar yuboriladi, bemor ismi yuborilmaydi.

Kirish tekshiruvi: DICOM fayl haqiqiyligi (magic bytes), rasm o'lchami va formati, ovoz davomiyligi ≤ 120 s; noto'g'ri fayl aniq xato xabari bilan rad etiladi.

## 12. UI ekranlar ro'yxati

Hamshira ilovasida 6 ekran, mutaxassis panelida 4 ekran; hamshira ilovasi bir qo'l bilan, katta tugmalar bilan ishlaydi.

Hamshira ilovasi (telefon, PWA):

| # | Ekran | Nima bor | Asosiy harakat |
|---|---|---|---|
| N1 | Kirish | Telefon + parol, muassasa nomi | Kirish |
| N2 | Holatlar ro'yxati | Bugungi holatlar, rang belgisi, "Yuborish kutilmoqda" belgisi (offline) | "+ Yangi holat" katta tugma |
| N3 | Yangi holat | Ism, tug'ilgan yil, jins, telefon, simptom boshlangan vaqt (tez tanlash: "hozir", "1 soat oldin", "uyg'onganda") | Boshlash |
| N4 | Anamnez | Mikrofon tugmasi (ovoz), matn maydoni, "Insult shubhasi?" tugmasi → BE-FAST 6 savol rasmlar bilan | Davom etish |
| N5 | Yuklash | 4 karta: Bosh KT / Ko'krak rentgen / Tahlil surati / Boshqa; har birida "Fayl" yoki "Kamera"; kamerada plyonka uchun ramka | Yuborish |
| N6 | Natija | Katta rang bloki (qizil/sariq/yashil), 2 jumlalik xulosa, "Keyingi qadam" (qayerga yuborish, qaysi mutaxassis xabardor), taymer (insultda), keyin mutaxassis javobi shu yerda paydo bo'ladi | Qo'ng'iroq / Yopish |

Mutaxassis paneli (kompyuter):

| # | Ekran | Nima bor | Asosiy harakat |
|---|---|---|---|
| P1 | Navbat | Jadval: zona (rang), tuman/muassasa, yosh, AI xulosasi (1 qator), kutish vaqti, taymer (insult); qizil kelganda ovoz + yuqorida yonadi; filtr: mening mutaxassisligim | Holatni ochish |
| P2 | Holat ko'rinishi | Chap: bemor + anamnez + BE-FAST + tahlillar (norma tashqarisi belgilangan). O'rta: tasvir ko'ruvchi — KT kesimlar slayderi, heatmap yoqish/o'chirish, zoom; eng shubhali kesimga sakrash. O'ng: AI xulosasi (ishonch %, reasons), taymer, qaror bloki | Tasdiqlash / O'zgartirish / AI xato; yo'naltirish tanlash; ko'rsatma matni; Yuborish |
| P3 | Xarita | Xorazm xaritasi, tumanlar bo'yicha bugungi holatlar (rang bilan), o'rtacha AI vaqti, o'rtacha mutaxassis javob vaqti | Tumanga bosib navbatni filtrlash |
| P4 | Statistika | Kunlik/haftalik holatlar, zonalar taqsimoti, "AI xato" foizi, o'rtacha vaqtlar | Eksport (keyingi bosqich) |

Dizayn qoidalari:

Rang zonalari faqat rang bilan emas, so'z bilan ham ("QIZIL — shoshilinch") — rang ko'rlik uchun.

Hamshira ilovasida shrift ≥ 16 px, tugma balandligi ≥ 48 px, bir ekranda bitta asosiy harakat.

Har AI natija yonida doimiy yozuv: "Dastlabki tahlil. Shifokor tasdig'i talab qilinadi."

Panelda qizil holat qatorlari pulsatsiya qiladi, tasdiqlangach to'xtaydi.

Til: o'zbek (lotin); demo uchun rus tili shart emas.

## 13. Demo ssenariysi

Demo 3 daqiqa, ikki ekran: chapda hamshira telefoni (proyektorga), o'ngda mutaxassis paneli; neyroxirurg hikoyani aytadi, siz bosasiz.

Bemor: Bekmurod aka, 58 yosh, chekka tuman qishlog'i. Ertalab 07:40 da o'ng qo'l va oyog'i ishlamay qoldi, gapi tushunarsiz bo'lib qoldi. Qishloq FAPiga 08:20 da olib kelishdi.

| Vaqt | Ekran | Nima bo'ladi | Hakam ko'radigan narsa |
|---|---|---|---|
| 0:00 | Telefon | Hamshira "+ Yangi holat": ism, 58, erkak, simptom "07:40" | 30 soniyada holat ochildi |
| 0:30 | Telefon | Mikrofon: "O'ng qo'li ishlamayapti, gapirolmayapti, ertalab boshlandi" → matn → strukturali karta | O'zbek ovoz ishlayapti |
| 0:50 | Telefon | BE-FAST: yuz — ha, qo'l — ha, nutq — ha → 6 ball | Ekranda "INSULT SHUBHASI" |
| 1:00 | Telefon | Natija: QIZIL, "Eng yaqin KT: tuman shifoxonasi, 35 km", taymer 4:10 qoldi, "Nevrolog xabardor qilindi" | AI qaror va yo'naltirish |
| 1:10 | Panel | Qizil holat navbat tepasida paydo bo'ladi, ovoz signali, taymer | Real-time push |
| 1:30 | Telefon/planshet | Tuman operatori: holatni topadi, bosh KT DICOM yuklaydi (demo-data dan) | DICOM yuklandi |
| 2:00 | Panel | AI: "Qon quyilishi ehtimoli 0,06", heatmap toza; xulosa: "Gemorragiya belgilari yo'q, ishemik insult ehtimoli, oyna ochiq: 3:05" | 40 soniyada KT o'qildi |
| 2:20 | Panel | Nevrolog: kesimlarni ko'radi, heatmap yoqadi, "Tasdiqlash", yo'naltirish: "Viloyatga transport, trombolizisga tayyorlansin", ko'rsatma yozadi | Shifokor qarori |
| 2:40 | Telefon | Hamshiraga bildirishnoma: nevrolog qarori va ko'rsatma | Halqa yopildi |
| 2:50 | Slayd | Taqqoslash: an'anaviy yo'l ___ soat; NAZAR AI bilan 12 daqiqa (raqamni neyroxirurg beradi) | Ta'sir |

Ikkinchi holat (vaqt qolsa, 40 soniya): 45 yoshli ayol, yo'tal, isitma; hamshira rentgen plyonkasini telefon bilan suratga oladi → CXR modeli: Pneumonia 0,84, Effusion 0,61 → SARIQ, terapevt, tumanda davolash. Ko'rsatadi: DICOM shart emas, plyonka ham ishlaydi.

Uchinchi holat (savol-javobga zaxira): ICH ehtimoli 0,91 — heatmapda qon quyilishi joyi yorug' — neyroxirurgga yo'naltirish. "AI xato qilsa-chi?" savoliga: mutaxassis "AI xato" tugmasini bosadi, audit jurnalida ko'rinadi.

Demo tayyorgarligi (checklist):

☐ 5 ta test holat demo-data/ da: 2 qizil (ishemik, gemorragik), 2 sariq (pnevmoniya, aniq emas), 1 yashil

☐ DICOM namunalar oldindan yuklangan va sinovdan o'tgan (internet sekin bo'lsa ham)

☐ Ovoz yozuvi oldindan tayyor (mikrofon ishlamasa fayldan)

☐ Ikkala ekran bitta noutbukda ikki oyna sifatida ochilgan; ikkinchi noutbuk zaxira

☐ Internet: telefon hotspot + zal Wi-Fi; hammasi lokal ishlasa yaxshiroq

☐ Demo 3 marta boshidan oxirigacha o'ynalgan, har biri ≤ 3 daqiqa

## 14. 3 kunlik ish rejasi va rollar

Qoida: 1-kun oxirida bitta KT yuklanib, AI javob berib, panelda ko'rinishi shart; chiroy va qo'shimcha modullar keyin.

Rollar:

| Kim | Mas'uliyat | Kod yozadimi |
|---|---|---|
| Neyroxirurg (klinik rahbar) | Triyaj qoidalari (rules/triage.yaml), BE-FAST, test holatlar, AI natijalarini klinik tekshirish, muammo raqamlari, pitchda klinik qism va tibbiy savollar | Yo'q (YAML ni birga to'ldiradi) |
| Azizbek (AI + mahsulot) | AI modullar (ICH, CXR, OCR, STT, LLM hisobot), triyaj dvigateli, demo-data, pitch slaydlari, umumiy arxitektura | Ha — backend/ai, services |
| Dasturchi (platforma) | FastAPI routerlar, DB, fayl yuklash, Celery, WebSocket, hamshira PWA, mutaxassis paneli, Docker | Ha — backend/routers, frontend |

Kunlar bo'yicha:

| Kun | Neyroxirurg | Azizbek | Dasturchi | Kun oxiridagi natija |
|---|---|---|---|---|
| 1-kun (17.09) | BE-FAST va zonalar qoidalari birinchi versiyasi; 5 ta test holat tavsifi; Xorazm raqamlari | CXR moduli ishga tushirish (torchxrayvision), ICH og'irliklarini topish va sinash, preprocess (DICOM → array), Grad-CAM | Docker Compose, DB jadvallar, /cases, /studies yuklash, Celery vazifa, oddiy panel navbati | Bitta KT/rentgen yuklanadi → AI natija → panelda ko'rinadi |
| 2-kun (18.09) | Qoidalarni YAML ga to'liq; ICH/CXR natijalarini test holatlarda tekshirish; yo'naltirish jadvali; muammo slaydlari matni | Triyaj dvigateli, LLM hisobot + validatsiya, STT (whisper), OCR (LLM), insult taymeri mantiqi | Hamshira PWA: N3–N6 ekranlar, kamera, offline navbat; panel: P1–P2 to'liq, WebSocket, DICOM ko'ruvchi + heatmap qatlami | To'liq oqim: hamshira → AI → mutaxassis → hamshira |
| 3-kun (19.09) | Demo hikoyasi, pitch mashqi, savol-javob tayyorgarligi, "AI xato qilsa" javobi | Demo-data yakuniy, xarita (P3), statistika, xatolarni tuzatish, slaydlar | Chiroy (Tailwind), xatolar, ikki ekran rejimi, zaxira noutbuk, ngrok/hosting | Demo 3 marta muammosiz o'ynaladi; slaydlar tayyor |
| 4-kun (20.09) | Taqdimot | Taqdimot | Taqdimot | Himoya |

Har kuni:

09:00 — 10 daqiqalik sinxron: kecha nima bo'ldi, bugun nima, nima to'sib turibdi.

21:00 — end-to-end sinov: hamshira ekranidan boshlab mutaxassis qarorigacha.

Git: main faqat ishlaydigan holat; har kishi o'z branchida.

Ish tartibi tamoyillari:

Avval ishlasin, keyin chiroyli bo'lsin.

Har modul zaxira yo'li bilan qurilsin (7-bo'lim).

Demo ma'lumotlari real internet holatida emas, lokal fayllardan ishlasin.

Slaydlar 3-kun kechqurungacha muzlatiladi; 4-kun faqat mashq.

## 15. Xavflar va zaxira rejalar

Eng katta xavf — ICH modeli 1-kunda ishlamasligi; endi MedGemma 1.5 KT ni xom holda o'qiydi va CNN ikkinchi o'quvchi bo'ldi, shuning uchun loyiha baribir AI-native qoladi; yangi asosiy xavf — MedGemma'ning GPU talabi va yolg'on ishonchi.

| # | Xavf | Ehtimol | Ta'sir | Zaxira reja | Qaror muddati |
|---|---|---|---|---|---|
| R1 | MedGemma 1.5 mahalliy GPU da ishga tushmaydi (VRAM, litsenziya, transformers versiyasi) | O'rta | Yuqori | Kvantlangan versiya M4 MacBook da; u ham bo'lmasa bulut GPU (ngrok orqali); u ham bo'lmasa CXR (torchxrayvision) flagman, KT ni mutaxassis o'qiydi | 1-kun 18:00 |
| R2 | MedGemma bosh KT da xato yoki noaniq javob beradi (xom, moslashtirilmagan) | Yuqori | Yuqori | uncertain/low → avtomatik sariq; CNN ikkinchi o'quvchi; kelishmasa sariq; demo holatlari neyroxirurg tomonidan oldindan tekshirilgan; pitchda cheklov ochiq aytiladi | 2-kun |
| R3 | MedGemma JSON o'rniga erkin matn yoki ro'yxatdan tashqari tashxis chiqaradi | Yuqori | O'rta | temperature=0, qattiq prompt, schema validatsiya, 2 marta qayta urinish, keyin "AI o'qimadi" statusi | 1-kun |
| R4 | KT seriya MedGemma da 90 soniyadan uzoq ishlaydi | O'rta | O'rta | Kesim sonini kamaytirish (N=16–24); demo natijalari keshlangan; jonli hisoblash rentgenda | 2-kun |
| R5 | RSNA ICH og'irliklari topilmaydi | O'rta | Past | Ikkinchi o'quvchi bo'sh qoladi, MedGemma yolg'iz o'qiydi, qoida: no bo'lsa ham BE-FAST musbat → sariq | 1-kun 18:00 |
| R6 | O'zbek STT sifati past | Yuqori | Past | Oldindan yozilgan aniq ovoz fayli; matn kiritish har doim mavjud; STT "bonus" sifatida | 2-kun |
| R7 | Zalda internet yo'q yoki sekin | Yuqori | Yuqori | Hammasi bitta noutbukda lokal (Docker + MedGemma); bulut LLM ishlamasa hisobotni MedGemma yozadi | 3-kun |
| R8 | DICOM ko'ruvchi (Cornerstone) 2 kunda tayyor bo'lmaydi | O'rta | O'rta | Kesimlarni serverda PNG ga aylantirib slayder; heatmap PNG ustiga qatlam | 2-kun |
| R9 | Offline sinxronizatsiya murakkab chiqadi | O'rta | Past | "Yuborish kutilmoqda" belgisi + qayta yuborish tugmasi; avtomatik sync keyingi bosqich | 2-kun |
| R10 | Hakam: "Bu oddiy MedGemma wrapper-ku?" | Yuqori | Yuqori | Javob: MedGemma tavsiflaydi, klassifikator qaror qiladi, ikki o'quvchi kelishmasa sariq; triyaj qoidalari neyroxirurgniki; hamshira oqimi, taymer, yo'naltirish — bular modelda yo'q | Pitch |
| R11 | Hakam: "AI xato qilsa kim javob beradi?" | Yuqori | Yuqori | 11-bo'lim: birinchi o'quvchi, mutaxassis tasdig'i, audit, "AI xato" tugmasi jonli ko'rsatiladi | Pitch |
| R12 | Hakam: "Real bemor ma'lumoti bormi? Validatsiya?" | O'rta | O'rta | Ochiq datasetlar (RSNA, NIH CXR) da sinalgan; MedGemma texnik hisobotidagi KT natijalari; pilot uchun viloyat boshqarmasi bilan kelishuv taklifi | Pitch |
| R13 | Vaqt yetmaydi, hammasi yarim | O'rta | Yuqori | Qisqartirish tartibi (quyida); asosiy oqim hech qachon qisqarmaydi | Har kun 21:00 |

Qisqartirish tartibi (agar kerak bo'lsa, shu ketma-ketlikda tashlanadi):

Statistika ekrani (P4)

Xarita (P3)

Tahlil OCR (M5)

Ovozli anamnez (M2 STT) — matn qoladi

Offline sinxronizatsiya (M9) — belgisi qoladi

Plyonka surati perspektiva tuzatish — oddiy surat qabul qilinadi

Hech qachon tashlanmaydi: holat ochish, BE-FAST, fayl yuklash, kamida bitta ko'rish modeli (MedGemma yoki torchxrayvision), triyaj zonasi, mutaxassis navbati va tasdiqlash, taymer.

## 16. KPI va taqdimot strukturasi

Bitta asosiy ko'rsatkich: tasvir yuklanganidan mutaxassis qarorigacha o'tgan vaqt — soatlardan daqiqalarga.

KPI (pilot uchun, 6 oy):

| Ko'rsatkich | Hozir (taxmin, neyroxirurg aniqlaydi) | Maqsad |
|---|---|---|
| Tasvir → mutaxassis birinchi ko'rishi | ___ soat | ≤ 15 daqiqa (qizil), ≤ 2 soat (sariq) |
| Insult shubhasida simptom → KT | ___ soat | ≤ 90 daqiqa |
| Trombolizis oynasida yetib kelgan bemorlar ulushi | ___ % | +20 foiz punkt |
| Mutaxassis "AI xato" bosgan holatlar | — | ≤ 10 % (model sifati) |
| Bitta mutaxassis kuniga ko'rgan holatlar | ___ | ×2 (saralangan navbat hisobiga) |
| Tizimga ulangan FAP va tuman shifoxonalari | 0 | 1 viloyat: barcha tumanlar |

Hakaton uchun o'lchanadigan natijalar (demo da aytiladi):

CXR modeli: 18 patologiya, ochiq datasetlarda o'qitilgan, javob ≤ 5 s.

MedGemma 1.5 4B: Google'ning ochiq tibbiy modeli, mahalliy serverda, KT/rentgen/tahlil — javob ≤ 90 s; ICH CNN ikkinchi o'quvchi, ikkalasi kelishmasa sariq.

To'liq halqa (hamshira → AI → mutaxassis → hamshira) demoda 12 daqiqadan kam.

3 kunda 3 kishi bilan qurilgan, 100 % ochiq manba modellar, o'zbek tilida.

Pitch strukturasi (5 daqiqa + 3 daqiqa savol):

| # | Slayd | Vaqt | Kim | Mazmun |
|---|---|---|---|---|
| 1 | Sarlavha | 0:10 | Azizbek | NAZAR AI — har bir qishloqqa mutaxassis nazari. Jamoa. |
| 2 | Muammo | 0:40 | Neyroxirurg | Bekmurod aka hikoyasi; Xorazm raqamlari: tumanlar, mutaxassislar, yo'l vaqti; 4,5 soat |
| 3 | Nega hozir yechilmaydi | 0:20 | Neyroxirurg | KT bor, o'qiydigan yo'q; navbat saralanmagan |
| 4 | Yechim bir jumlada | 0:20 | Azizbek | Birinchi o'quvchi: AI o'qiydi, saralaydi, yo'naltiradi; shifokor tasdiqlaydi |
| 5 | "AI olib tashlansa nima qoladi?" | 0:20 | Azizbek | Fayl yuklash. Tamom. — bu AI-native ekanining isboti |
| 6 | Jonli demo | 2:00 | Ikkalasi | 13-bo'lim ssenariysi |
| 7 | Xavfsizlik va etika | 0:30 | Neyroxirurg | Birinchi o'quvchi, oxirgi emas; heatmap; audit; "AI xato" tugmasi; 6-muammoga javob |
| 8 | Texnologiya | 0:20 | Dasturchi | Arxitektura diagrammasi; ochiq modellar; offline; o'zbek ovoz |
| 9 | Ta'sir va kengayish | 0:20 | Azizbek | KPI jadvali; modullar: kardio, onko; milliy tizim integratsiyasi |
| 10 | Model va keyingi qadam | 0:20 | Azizbek | B2G: viloyat boshqarmasi pilot → tumanlar litsenziyasi; 6 oylik pilot taklifi |

Savol-javobga tayyor javoblar:

| Savol | Javob (1 jumla) |
|---|---|
| AI xato qilsa? | AI hech qachon oxirgi qarorni bermaydi; mutaxassis tasdiqlaydi, xato bosilsa audit va model tuzatiladi. |
| Mavjud rentgen AI dan farqi? | Bular shifoxona ichi uchun; biz qishloq hamshirasidan boshlaymiz — plyonka, ovoz, offline, yo'naltirish, taymer. |
| Sertifikat bormi? | Yo'q, bu skrining va triyaj vositasi; pilot viloyat boshqarmasi nazorati ostida, sertifikatlash yo'l xaritasida. |
| Ma'lumot qayerda saqlanadi? | O'zbekiston serverida; LLM ga bemor ismi yuborilmaydi. |
| Hamshira ishlata oladimi? | 6 ekran, katta tugmalar, ovoz bilan; o'qitish 30 daqiqa. |
| Nega bu hakatonda emas, keyin ham yashaydi? | Modullar YAML qoidalar bilan kengayadi; modelni almashtirish arxitekturani o'zgartirmaydi. |

## 17. Glossariy

| Atama | Ma'nosi |
|---|---|
| Triyaj | Bemorlarni xavf darajasiga qarab saralash va navbat belgilash |
| BE-FAST | Insultni tez aniqlash anketasi: Balance, Eyes, Face, Arms, Speech, Time |
| ICH (Intracranial Hemorrhage) | Bosh miya ichiga qon quyilishi; gemorragik insult |
| Ishemik insult | Miya tomirining tiqilishi; trombolizis bilan davolanadi |
| Trombolizis | Tiqilgan tomirni dori bilan ochish; simptomdan 4,5 soat ichida samarali |
| Vaqt oynasi | Trombolizis mumkin bo'lgan 4,5 soatlik muddat |
| KT | Kompyuter tomografiya |
| CXR (Chest X-Ray) | Ko'krak qafasi rentgeni |
| DICOM | Tibbiy tasvirlarning standart fayl formati |
| Brain window | KT tasvirini miya to'qimasi ko'rinadigan qilib sozlash (WL 40 / WW 80) |
| Grad-CAM | Model tasvirning qaysi joyiga qarab qaror qilganini ko'rsatuvchi "issiqlik xaritasi" (heatmap) |
| Threshold | Model ehtimoli qaysi qiymatdan yuqori bo'lsa "bor" deb hisoblanadi |
| Sezgirlik (sensitivity) | Kasali bor bemorlarning necha foizini model topadi |
| OCR | Rasmdan matn va raqamlarni o'qish |
| STT (Speech-to-Text) | Nutqni matnga aylantirish |
| LLM | Katta til modeli (Claude, Gemini) — matn tushuntirish va strukturalash uchun |
| PWA | Brauzerda ishlab telefonga ilova kabi o'rnatiladigan web-dastur |
| IndexedDB | Brauzerning offline ma'lumot saqlash ombori |
| WebSocket | Server → brauzerga real vaqtda xabar yuborish kanali |
| FAP | Feldsher-akusherlik punkti — qishloq tibbiyot punkti |
| OvaBMU | Ona va bola bosh ma'muriyati (vazirlik hujjatidagi qisqartma) |
| B2G | Biznesdan davlatga sotish modeli |
| RSNA | Radiologlar jamiyati; ICH datasetini e'lon qilgan |
| MVP | Eng kichik ishlaydigan mahsulot — hakatonda ko'rsatiladigan versiya |

