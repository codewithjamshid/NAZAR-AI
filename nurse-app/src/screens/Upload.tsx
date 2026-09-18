// N5 Yuklash (F-04, F-05, F-06) — four cards, file or camera, upload percentage,
// then the OCR lab table the nurse checks before it counts.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NetworkError, api } from '../api/client'
import type { CaseDetail, Study, StudyType } from '../api/types'
import { Button, Card, Disclaimer, ErrorBanner, PendingBadge, Screen } from '../components/ui'
import { enqueue, isLocalId } from '../offline/db'
import { LAB_LABEL, STUDY_STATUS, STUDY_TYPE } from '../lib/labels'
import { useApp } from '../state/AppContext'

interface UploadCard {
  type: StudyType
  title: string
  hint: string
  accept: string
}

const CARDS: UploadCard[] = [
  {
    type: 'ct_head',
    title: 'Bosh KT',
    hint: 'DICOM (.dcm) yoki seriya ZIP · 300 MB gacha',
    accept: '.dcm,.zip,application/dicom,application/zip',
  },
  {
    type: 'cxr',
    title: 'Koʻkrak rentgeni',
    hint: 'DICOM yoki rasm · plyonkani suratga olsa ham boʻladi',
    accept: '.dcm,image/png,image/jpeg',
  },
  {
    type: 'lab_photo',
    title: 'Tahlil surati',
    hint: 'Qon tahlili qogʻozi · qiymatlarni AI oʻqiydi, siz tasdiqlaysiz',
    accept: 'image/png,image/jpeg',
  },
  {
    type: 'lab_photo',
    title: 'Boshqa hujjat',
    hint: 'Yoʻllanma, boshqa qogʻoz · tahlil surati kanali orqali yuboriladi',
    accept: 'image/png,image/jpeg',
  },
]

interface LabRow {
  name: string
  value: string
  unit: string
}

export function UploadScreen() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const { disclaimer } = useApp()
  const local = isLocalId(caseId)

  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null)
  const [queuedLocally, setQueuedLocally] = useState<string[]>([])
  const [labStudyId, setLabStudyId] = useState<number | null>(null)
  const [labRows, setLabRows] = useState<LabRow[] | null>(null)
  const [labBusy, setLabBusy] = useState(false)
  const [labSaved, setLabSaved] = useState(false)

  const load = useCallback(async () => {
    if (local) return
    try {
      setDetail(await api.caseDetail(Number(caseId)))
    } catch (err) {
      if (!(err instanceof NetworkError)) {
        setError(err instanceof Error ? err.message : 'Holat yuklanmadi')
      }
    }
  }, [caseId, local])

  useEffect(() => {
    void load()
  }, [load])

  // Keep polling while any study is still being read (S-01: within 60 s).
  useEffect(() => {
    if (local) return
    const pending = detail?.studies.some((s) => s.status === 'queued' || s.status === 'processing')
    if (!pending) return
    const timer = window.setTimeout(() => void load(), 4000)
    return () => window.clearTimeout(timer)
  }, [detail, load, local])

  const readLabValues = useCallback(async (studyId: number) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let study: Study
      try {
        study = await api.studyResult(studyId)
      } catch {
        return
      }
      const lab = study.ai_results.find(
        (result) => result.module === 'medgemma_lab' || result.module === 'ocr',
      )
      const output = lab?.output as
        | { values?: Record<string, number>; units?: Record<string, string> }
        | undefined
      if (output?.values && Object.keys(output.values).length > 0) {
        setLabRows(
          Object.entries(output.values).map(([name, value]) => ({
            name,
            value: String(value),
            unit: output.units?.[name] ?? '',
          })),
        )
        return
      }
      if (study.status === 'done' || study.status === 'failed') {
        // Fallback (TZ §7 M5 "Zaxira"): the nurse types the values herself.
        setLabRows([])
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    setLabRows([])
  }, [])

  async function handleFile(card: UploadCard, file: File | null) {
    if (!file) return
    setError(null)
    setLabSaved(false)
    const label = `${card.title} yuklanmoqda`
    try {
      if (local) {
        await enqueue({
          kind: 'study',
          caseId: null,
          localId: caseId,
          studyType: card.type,
          blob: file,
          fileName: file.name,
        })
        setQueuedLocally((current) => [...current, card.title])
        return
      }
      setProgress({ label, percent: 0 })
      const study = await api.uploadStudy(Number(caseId), card.type, file, file.name, (percent) =>
        setProgress({ label, percent }),
      )
      setProgress(null)
      await load()
      if (card.type === 'lab_photo') {
        setLabStudyId(study.id)
        setLabRows(null)
        void readLabValues(study.id)
      }
    } catch (err) {
      setProgress(null)
      if (err instanceof NetworkError) {
        await enqueue({
          kind: 'study',
          caseId: Number(caseId),
          studyType: card.type,
          blob: file,
          fileName: file.name,
        })
        setQueuedLocally((current) => [...current, card.title])
        return
      }
      setError(err instanceof Error ? err.message : 'Fayl yuborilmadi')
    }
  }

  async function saveLabs() {
    if (!labRows) return
    const values: Record<string, number> = {}
    for (const row of labRows) {
      const numeric = Number(row.value.replace(',', '.'))
      if (row.name && Number.isFinite(numeric)) values[row.name] = numeric
    }
    setLabBusy(true)
    setError(null)
    try {
      if (local) {
        await enqueue({ kind: 'labs', caseId: null, localId: caseId, payload: values })
      } else {
        setDetail(await api.confirmLabs(Number(caseId), values))
      }
      setLabSaved(true)
    } catch (err) {
      if (err instanceof NetworkError) {
        await enqueue({ kind: 'labs', caseId: Number(caseId), payload: values })
        setLabSaved(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Tahlil qiymatlari saqlanmadi')
    } finally {
      setLabBusy(false)
    }
  }

  const missingAnalytes = Object.keys(LAB_LABEL).filter(
    (key) => !(labRows ?? []).some((row) => row.name === key),
  )

  return (
    <Screen
      title="Tekshiruv yuklash"
      subtitle={local ? 'Oflayn holat' : `Holat #${caseId}`}
      back={`/case/${caseId}/anamnesis`}
      footer={<Button onClick={() => navigate(`/case/${caseId}`)}>Natijaga oʻtish</Button>}
    >
      <ErrorBanner message={error} />

      {progress ? (
        <Card>
          <div className="mb-2 flex items-center justify-between text-base font-semibold">
            <span>{progress.label}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-sky-700 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
        </Card>
      ) : null}

      {queuedLocally.length > 0 ? (
        <Card className="border-slate-400">
          <PendingBadge />
          <p className="mt-2 text-base text-slate-700">
            {queuedLocally.join(', ')} — internet kelganda avtomatik yuboriladi.
          </p>
        </Card>
      ) : null}

      {CARDS.map((card) => {
        const key = `${card.type}-${card.title}`
        return (
          <Card key={key}>
            <div className="text-lg font-bold text-slate-900">{card.title}</div>
            <p className="mt-1 text-base text-slate-600">{card.hint}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex min-h-[56px] cursor-pointer items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-800">
                Fayl
                <input
                  type="file"
                  accept={card.accept}
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(card, e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
              <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-sky-700 bg-sky-700 text-lg font-semibold text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 8h4l2-3h6l2 3h4v11H3z" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Kamera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(card, e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {card.type === 'cxr' ? (
              <p className="mt-2 text-sm text-slate-500">
                Plyonkani suratga olayotganda: ramka toʻliq kirsin, yorugʻlik orqadan boʻlsin.
              </p>
            ) : null}
          </Card>
        )
      })}

      {labStudyId !== null ? (
        <Card className="space-y-3">
          <div className="text-lg font-bold">Tahlil qiymatlari</div>
          {labRows === null ? (
            <p className="text-base text-slate-600">AI qogʻozni oʻqimoqda…</p>
          ) : (
            <>
              <p className="text-base text-slate-600">
                Qiymatlarni tekshiring va tuzating. Tasdiqlamaguningizcha hisobga olinmaydi.
              </p>
              {labRows.length === 0 ? (
                <p className="text-base text-amber-800">
                  AI qiymat topa olmadi — pastdagi roʻyxatdan qoʻlda qoʻshing.
                </p>
              ) : null}
              {labRows.map((row, index) => (
                <div key={row.name} className="flex items-center gap-2">
                  <span className="w-1/2 text-base font-semibold text-slate-800">
                    {LAB_LABEL[row.name] ?? row.name}
                  </span>
                  <input
                    className="w-1/3 rounded-xl border-2 border-slate-300 px-3 py-2 text-lg"
                    inputMode="decimal"
                    value={row.value}
                    onChange={(e) =>
                      setLabRows((current) =>
                        (current ?? []).map((item, i) =>
                          i === index ? { ...item, value: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <span className="w-1/6 text-base text-slate-500">{row.unit}</span>
                </div>
              ))}
              {missingAnalytes.length > 0 ? (
                <select
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-lg"
                  value=""
                  onChange={(e) => {
                    const name = e.target.value
                    if (!name) return
                    setLabRows((current) => [...(current ?? []), { name, value: '', unit: '' }])
                  }}
                >
                  <option value="">+ Koʻrsatkich qoʻshish</option>
                  {missingAnalytes.map((name) => (
                    <option key={name} value={name}>
                      {LAB_LABEL[name]}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button onClick={() => void saveLabs()} disabled={labBusy}>
                {labBusy ? 'Saqlanmoqda…' : 'Qiymatlarni tasdiqlash'}
              </Button>
              {labSaved ? (
                <p className="text-base font-semibold text-green-800">Qiymatlar tasdiqlandi.</p>
              ) : null}
            </>
          )}
          <Disclaimer text={disclaimer} />
        </Card>
      ) : null}

      {detail && detail.studies.length > 0 ? (
        <Card className="space-y-2">
          <div className="text-lg font-bold">Yuklangan tekshiruvlar</div>
          {detail.studies.map((study) => (
            <div key={study.id} className="flex items-center justify-between gap-2 text-base">
              <span className="font-semibold text-slate-800">{STUDY_TYPE[study.type] ?? study.type}</span>
              <span
                className={
                  study.status === 'failed'
                    ? 'font-semibold text-red-700'
                    : study.status === 'done'
                      ? 'font-semibold text-green-800'
                      : 'text-slate-600'
                }
              >
                {STUDY_STATUS[study.status] ?? study.status}
              </span>
            </div>
          ))}
        </Card>
      ) : null}
    </Screen>
  )
}
