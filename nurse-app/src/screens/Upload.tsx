// N5 Yuklash (F-04, F-05, F-06) — four cards, file or camera, upload percentage,
// then the OCR lab table the nurse checks before it counts.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight, Brain, Camera, CircleCheck, CloudOff, FileText, FlaskConical, Info, ListChecks, ScanLine,
  Upload as UploadIcon,
} from 'lucide-react'
import { NetworkError, api } from '../api/client'
import type { CaseDetail, Study, StudyType } from '../api/types'
import { StudyRow } from '../components/StudyRow'
import {
  Button, Card, CardTitle, Disclaimer, ErrorBanner, FOOTER_ACTION, INPUT_BASE, Notice, PendingBadge, Screen,
  Skeleton, Spinner,
} from '../components/ui'
import type { Icon } from '../components/ui'
import { enqueue, isLocalId } from '../offline/db'
import { LAB_LABEL } from '../lib/labels'
import { useApp } from '../state/AppContext'

interface UploadCard {
  key: string
  type: StudyType
  title: string
  hint: string
  accept: string
  icon: Icon
}

const CARDS: UploadCard[] = [
  {
    key: 'ct_head',
    icon: Brain,
    type: 'ct_head',
    title: 'Bosh KT',
    hint: 'DICOM (.dcm) yoki seriya ZIP · 300 MB gacha',
    accept: '.dcm,.zip,application/dicom,application/zip',
  },
  {
    key: 'cxr',
    icon: ScanLine,
    type: 'cxr',
    title: 'Koʻkrak rentgeni',
    hint: 'DICOM yoki rasm · plyonkani suratga olsa ham boʻladi',
    accept: '.dcm,image/png,image/jpeg',
  },
  {
    key: 'lab_photo',
    icon: FlaskConical,
    type: 'lab_photo',
    title: 'Tahlil surati',
    hint: 'Qon tahlili qogʻozi · qiymatlarni AI oʻqiydi, siz tasdiqlaysiz',
    accept: 'image/png,image/jpeg',
  },
  {
    key: 'other',
    icon: FileText,
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
  const [progress, setProgress] = useState<{ card: string; label: string; percent: number } | null>(null)
  const [loaded, setLoaded] = useState(local)
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
    } finally {
      setLoaded(true)
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
      setProgress({ card: card.key, label, percent: 0 })
      const study = await api.uploadStudy(Number(caseId), card.type, file, file.name, (percent) =>
        setProgress({ card: card.key, label, percent }),
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

  const uploading = progress !== null

  return (
    <Screen
      title="Tekshiruv yuklash"
      subtitle={local ? 'Oflayn holat' : `Holat #${caseId}`}
      back={`/case/${caseId}/anamnesis`}
      footer={
        <Button onClick={() => navigate(`/case/${caseId}`)} className={FOOTER_ACTION}>
          Natijaga oʻtish
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      }
    >
      <ErrorBanner message={error} />

      {queuedLocally.length > 0 ? (
        <Notice icon={CloudOff}>
          <PendingBadge />
          <p className="mt-1.5 text-base text-slate-700">
            {queuedLocally.join(', ')} — internet kelganda avtomatik yuboriladi.
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:gap-5 @xl:grid-cols-2">
        {CARDS.map((card) => {
          const CardIcon = card.icon
          const busyHere = progress?.card === card.key
          return (
            <Card key={card.key} className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <CardIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">{card.title}</h2>
                  <p className="mt-0.5 text-base text-slate-600">{card.hint}</p>
                </div>
              </div>
              {card.type === 'cxr' ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  Plyonkani suratga olayotganda: ramka toʻliq kirsin, yorugʻlik orqadan boʻlsin.
                </p>
              ) : null}

              {busyHere && progress ? (
                <div className="mt-4" aria-live="polite">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-base font-semibold text-slate-800">
                    <span className="flex items-center gap-2">
                      <Spinner className="h-4 w-4 text-brand-600" />
                      Yuklanmoqda
                    </span>
                    <span className="tabular-nums">{progress.percent}%</span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label={progress.label}
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
                <label
                  className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-lg font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-within:ring-4 focus-within:ring-brand-500/25 lg:min-h-12 lg:text-base ${
                    uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <UploadIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  Fayl
                  <input
                    type="file"
                    accept={card.accept}
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void handleFile(card, e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                <label
                  className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-3 text-lg font-semibold text-brand-800 transition-colors hover:bg-brand-100 focus-within:ring-4 focus-within:ring-brand-500/25 lg:min-h-12 lg:text-base ${
                    uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  Kamera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void handleFile(card, e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </Card>
          )
        })}
      </div>

      {labStudyId !== null ? (
        <Card>
          <CardTitle icon={FlaskConical}>Tahlil qiymatlari</CardTitle>
          {labRows === null ? (
            <div className="space-y-3" aria-live="polite">
              <p className="flex items-center gap-2 text-base text-slate-600">
                <Spinner className="h-5 w-5 text-brand-600" />
                AI qogʻozni oʻqimoqda…
              </p>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base text-slate-600">
                Qiymatlarni tekshiring va tuzating. Tasdiqlamaguningizcha hisobga olinmaydi.
              </p>
              {labRows.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-base text-amber-900">
                  AI qiymat topa olmadi — pastdagi roʻyxatdan qoʻlda qoʻshing.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_3rem] gap-2 bg-slate-50 px-3 py-2 sm:gap-3 text-sm font-semibold text-slate-500 @xl:grid-cols-[minmax(0,1fr)_10rem_6rem]">
                    <span>Koʻrsatkich</span>
                    <span>Qiymat</span>
                    <span>Birlik</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {labRows.map((row, index) => (
                      <div
                        key={row.name}
                        className="grid grid-cols-[minmax(0,1fr)_6.5rem_3rem] items-center gap-2 px-3 py-2 sm:gap-3 @xl:grid-cols-[minmax(0,1fr)_10rem_6rem]"
                      >
                        <label htmlFor={`lab-${row.name}`} className="min-w-0 break-words text-base font-medium text-slate-800">
                          {LAB_LABEL[row.name] ?? row.name}
                        </label>
                        <input
                          id={`lab-${row.name}`}
                          className={`${INPUT_BASE} min-h-12 px-3 tabular-nums`}
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
                        <span className="truncate text-base text-slate-500">{row.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {missingAnalytes.length > 0 ? (
                <select
                  aria-label="Koʻrsatkich qoʻshish"
                  className={`${INPUT_BASE} min-h-13 px-3`}
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
              <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
                <Button
                  variant="brandOutline"
                  onClick={() => void saveLabs()}
                  disabled={labBusy}
                  className="@xl:w-auto @xl:min-w-64"
                >
                  {labBusy ? <Spinner /> : <ListChecks className="h-5 w-5" aria-hidden="true" />}
                  {labBusy ? 'Saqlanmoqda…' : 'Qiymatlarni tasdiqlash'}
                </Button>
                {labSaved ? (
                  <p className="flex items-center gap-2 text-base font-semibold text-green-800">
                    <CircleCheck className="h-5 w-5" aria-hidden="true" />
                    Qiymatlar tasdiqlandi.
                  </p>
                ) : null}
              </div>
            </div>
          )}
          <Disclaimer text={disclaimer} className="mt-4" />
        </Card>
      ) : null}

      {!local && !loaded ? (
        <Card>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-4 h-12 w-full" />
        </Card>
      ) : null}

      {detail && detail.studies.length > 0 ? (
        <Card>
          <CardTitle icon={ListChecks}>Yuklangan tekshiruvlar</CardTitle>
          <ul className="divide-y divide-slate-100">
            {detail.studies.map((study) => (
              <StudyRow key={study.id} study={study} />
            ))}
          </ul>
        </Card>
      ) : null}
    </Screen>
  )
}
