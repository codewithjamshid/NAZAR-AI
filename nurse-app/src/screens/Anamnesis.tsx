// N4 Anamnez (F-02, F-03) — complaint text, voice note, BE-FAST and red flags.
// BE-FAST points and the suspicion rule come from GET /meta; nothing clinical
// is written into this file.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NetworkError, api } from '../api/client'
import type { AnamnesisPayload, Befast, BefastKey, FlagKey, Meta, Study } from '../api/types'
import { BEFAST_KEYS, FLAG_KEYS } from '../api/types'
import {
  Activity, ArrowRight, Brain, ChevronRight, CloudOff, MessageSquareText, Mic, ShieldAlert, Square, TriangleAlert,
} from 'lucide-react'
import { BefastIcon } from '../components/BefastIcon'
import {
  Button, Card, CardTitle, ChoiceButton, Disclaimer, ErrorBanner, FOOTER_ACTION, InfoBanner, Notice, PendingBadge,
  Screen, Spinner, TextArea,
} from '../components/ui'
import { db, enqueue, isLocalId, savePendingAnamnesis } from '../offline/db'
import { flush } from '../offline/sync'
import { BEFAST_QUESTIONS, FLAG_LABEL } from '../lib/labels'
import { clockTime, humanMinutes, minutesSince } from '../lib/time'
import { useApp } from '../state/AppContext'

const EMPTY_BEFAST: Befast = { balance: false, eyes: false, face: false, arms: false, speech: false }
const EMPTY_FLAGS: Record<FlagKey, boolean> = {
  unconscious: false,
  breathing_difficulty: false,
  chest_pain: false,
}

function befastScore(befast: Befast, meta: Meta | null): number {
  const points = meta?.befast.points ?? {}
  return BEFAST_KEYS.reduce((total, key) => total + (befast[key] ? (points[key] ?? 0) : 0), 0)
}

/** Same rule as the server: score >= stroke_min_score OR any of F/A/S. */
function strokeSuspected(befast: Befast, meta: Meta | null): boolean {
  if (!meta) return false
  const score = befastScore(befast, meta)
  if (score >= meta.befast.stroke_min_score) return true
  return meta.befast.stroke_any_of.some((key) => befast[key as BefastKey])
}

function audioExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function AnamnesisScreen() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const { meta, disclaimer, online } = useApp()
  const local = isLocalId(caseId)

  const [complaint, setComplaint] = useState('')
  const [befast, setBefast] = useState<Befast>(EMPTY_BEFAST)
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>(EMPTY_FLAGS)
  const [showBefast, setShowBefast] = useState(false)
  const [onsetAt, setOnsetAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Prefill from whatever already exists (a re-visit, or an offline case).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (local) {
        const pending = await db.pendingCases.get(caseId)
        if (cancelled || !pending) return
        setOnsetAt(pending.symptom_onset_at)
        if (pending.anamnesis) {
          setComplaint(pending.anamnesis.chief_complaint ?? '')
          setBefast({ ...EMPTY_BEFAST, ...pending.anamnesis.befast })
          setFlags({ ...EMPTY_FLAGS, ...pending.anamnesis.flags })
          setShowBefast(Object.values(pending.anamnesis.befast).some(Boolean))
        }
        return
      }
      try {
        const detail = await api.caseDetail(Number(caseId))
        if (cancelled) return
        setOnsetAt(detail.symptom_onset_at)
        if (detail.anamnesis) {
          setComplaint(detail.anamnesis.chief_complaint ?? '')
          if (detail.anamnesis.befast) {
            setBefast({ ...EMPTY_BEFAST, ...detail.anamnesis.befast })
            setShowBefast(Object.values(detail.anamnesis.befast).some(Boolean))
          }
          setFlags({ ...EMPTY_FLAGS, ...detail.anamnesis.flags })
          if (detail.anamnesis.voice_transcript) {
            setVoiceNote(detail.anamnesis.voice_transcript)
          }
        }
      } catch {
        /* offline or a fresh case: the empty form is correct */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, local])

  const score = useMemo(() => befastScore(befast, meta), [befast, meta])
  const suspected = useMemo(() => strokeSuspected(befast, meta), [befast, meta])
  const elapsed = minutesSince(onsetAt)

  const payload = useCallback(
    (): AnamnesisPayload => ({
      befast,
      flags,
      chief_complaint: complaint.trim() || null,
    }),
    [befast, flags, complaint],
  )

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (local) {
        await savePendingAnamnesis(caseId, payload())
        void flush()
        navigate(`/case/${caseId}/upload`)
        return
      }
      await api.saveAnamnesis(Number(caseId), payload())
      navigate(`/case/${caseId}/upload`)
    } catch (err) {
      if (err instanceof NetworkError) {
        await enqueue({ kind: 'anamnesis', caseId: Number(caseId), payload: payload() })
        navigate(`/case/${caseId}/upload`)
        return
      }
      setError(err instanceof Error ? err.message : 'Saqlanmadi')
    } finally {
      setBusy(false)
    }
  }

  /** Poll the voice study until the STT module reports back (it may be absent). */
  async function waitForTranscript(studyId: number) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      let study: Study
      try {
        study = await api.studyResult(studyId)
      } catch {
        return
      }
      const stt = study.ai_results.find((result) => result.module === 'stt')
      if (stt?.output && typeof stt.output.text === 'string' && stt.output.text.trim()) {
        const text = stt.output.text.trim()
        setVoiceNote(text)
        setComplaint((current) => (current.trim() ? current : text))
        return
      }
      if (study.status === 'done' || study.status === 'failed') {
        setVoiceNote(
          'Ovoz saqlandi, lekin matnga aylantirilmadi. Shikoyatni matn maydoniga yozing.',
        )
        return
      }
    }
    setVoiceNote('Ovoz saqlandi. Matn hali tayyor emas — shikoyatni matn maydoniga yozing.')
  }

  async function sendVoice(blob: Blob, mimeType: string) {
    const fileName = `voice.${audioExtension(mimeType)}`
    setVoiceBusy(true)
    try {
      if (local) {
        await enqueue({ kind: 'voice', caseId: null, localId: caseId, blob, fileName })
        setVoiceNote('Ovoz telefonda saqlandi, ulanganda yuboriladi.')
        return
      }
      const study = await api.uploadVoice(Number(caseId), blob, fileName)
      setVoiceNote('Ovoz yuborildi, matnga aylantirilmoqda…')
      void waitForTranscript(study.id)
    } catch (err) {
      if (err instanceof NetworkError) {
        await enqueue({ kind: 'voice', caseId: Number(caseId), blob, fileName })
        setVoiceNote('Internet yoʻq — ovoz navbatga qoʻyildi.')
        return
      }
      setError(err instanceof Error ? err.message : 'Ovoz yuborilmadi')
    } finally {
      setVoiceBusy(false)
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      // Documented fallback (TZ §15 R6): the text field keeps working.
      setVoiceNote('Mikrofon mavjud emas. Shikoyatni matn maydoniga yozing.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4'].find(
        (type) => MediaRecorder.isTypeSupported?.(type) ?? false,
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size > 0) void sendVoice(blob, type)
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setVoiceNote('Mikrofonga ruxsat berilmadi. Shikoyatni matn maydoniga yozing.')
    }
  }

  useEffect(() => () => recorderRef.current?.stream?.getTracks().forEach((t) => t.stop()), [])

  const answered = BEFAST_KEYS.filter((key) => befast[key]).length
  const thresholdText =
    (meta
      ? `Chegara: ${meta.befast.stroke_min_score} ball yoki F/A/S dan bittasi · qoidalar ${meta.rules_version}`
      : 'Chegaralar serverdan olinmadi') + (answered > 0 ? ` · ${answered} ta belgi` : '')

  return (
    <Screen
      title="Anamnez"
      subtitle={local ? 'Oflayn holat' : `Holat #${caseId}`}
      back={`/case/${caseId}`}
      footer={
        <Button onClick={() => void save()} disabled={busy} className={FOOTER_ACTION}>
          {busy ? <Spinner /> : null}
          {busy ? 'Saqlanmoqda…' : 'Saqlash va davom etish'}
          {!busy ? <ArrowRight className="h-5 w-5" aria-hidden="true" /> : null}
        </Button>
      }
    >
      <ErrorBanner message={error} />
      {local ? (
        <Notice icon={CloudOff}>
          <span className="flex flex-wrap items-center gap-2">
            <PendingBadge />
            <span>Holat telefonda saqlanmoqda</span>
          </span>
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:gap-5 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @3xl:items-start">
        <Card>
          <CardTitle icon={MessageSquareText}>Shikoyat</CardTitle>
          <TextArea
            label="Bemor nimadan shikoyat qilyapti?"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Oʻng qoʻli ishlamayapti, gapirolmayapti"
          />

          {/* F-02: voice is optional; the text field above always works. */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
              <button
                type="button"
                onClick={() => void toggleRecording()}
                disabled={voiceBusy}
                aria-pressed={recording}
                className={`inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-xl px-5 text-lg font-semibold transition-colors lg:min-h-12 lg:text-base ${
                  recording
                    ? 'animate-soft-pulse bg-red-600 text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50 disabled:text-slate-400'
                }`}
              >
                {voiceBusy ? (
                  <Spinner className="h-6 w-6" />
                ) : recording ? (
                  <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                ) : (
                  <Mic className="h-6 w-6 text-brand-600" aria-hidden="true" />
                )}
                {recording ? 'Toʻxtatish va yuborish' : voiceBusy ? 'Yuborilmoqda…' : 'Ovoz bilan aytish'}
              </button>
              <p className="flex items-start gap-2 text-base text-amber-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>Bemorning ismini aytmang — ovoz tahlil uchun bulut xizmatiga yuboriladi.</span>
              </p>
            </div>
            {voiceNote ? (
              <p className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-base text-slate-700" aria-live="polite">
                <Mic className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <span>{voiceNote}</span>
              </p>
            ) : null}
            {!online ? (
              <p className="mt-2 text-sm text-slate-500">Internet yoʻq — ovoz navbatga qoʻyiladi.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle icon={TriangleAlert}>Xavfli belgilar</CardTitle>
          <div className="grid gap-3 @xl:grid-cols-3 @3xl:grid-cols-1">
            {FLAG_KEYS.map((key) => (
              <ChoiceButton
                key={key}
                pressed={flags[key]}
                tone="danger"
                size="md"
                spread
                onClick={() => setFlags((current) => ({ ...current, [key]: !current[key] }))}
              >
                <span className="text-left">{FLAG_LABEL[key]}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-sm font-bold ${
                    flags[key] ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {flags[key] ? 'HA' : 'YOʻQ'}
                </span>
              </ChoiceButton>
            ))}
          </div>
        </Card>
      </div>

      {!showBefast ? (
        <button
          type="button"
          onClick={() => setShowBefast(true)}
          className="group flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-left shadow-card transition hover:border-brand-400 hover:bg-brand-50/40 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <Brain className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-slate-900">Insult shubhasi? — BE-FAST</span>
            <span className="block text-base text-slate-600">5 ta savol va simptom vaqti</span>
          </span>
          <ChevronRight className="h-6 w-6 shrink-0 text-slate-400 group-hover:text-brand-600" aria-hidden="true" />
        </button>
      ) : null}

      {showBefast ? (
        <section className="space-y-3 sm:space-y-4" aria-label="BE-FAST">
          {/* Sticks under the app bar so the score stays in view while answering. */}
          <div
            className={`sticky top-18 z-20 rounded-2xl px-4 py-2.5 shadow-raised sm:px-5 sm:py-3 ${
              suspected ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white text-slate-900'
            }`}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <div className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <Activity className="h-6 w-6" aria-hidden="true" />
                BE-FAST: {score} ball
              </div>
              <div className="text-base font-semibold sm:text-lg">
                {suspected ? 'INSULT SHUBHASI — vaqt oynasi muhim' : 'Hozircha insult belgilari yoʻq'}
              </div>
            </div>
            <div className={`mt-1 hidden text-sm sm:block ${suspected ? 'text-red-50' : 'text-slate-500'}`}>
              {thresholdText}
            </div>
          </div>
          {/* Phones: the rule line scrolls away instead of taking sticky space. */}
          <p className="px-1 text-sm text-slate-500 sm:hidden">{thresholdText}</p>

          <div className="grid gap-3 sm:gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
            {BEFAST_QUESTIONS.map((question) => {
              const key = question.key as BefastKey
              const value = befast[key]
              return (
                <div
                  key={key}
                  className={`flex flex-col rounded-2xl border bg-white p-4 shadow-card transition sm:p-5 ${
                    value ? 'border-red-300 ring-2 ring-red-500/15' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        value ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <BefastIcon name={key} className="h-8 w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-900 px-1.5 text-sm font-bold text-white">
                          {question.letter}
                        </span>
                        <span className="text-sm text-slate-500">Ball: {meta?.befast.points[key] ?? '—'}</span>
                      </div>
                      <h3 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">{question.title}</h3>
                      <p className="mt-0.5 text-base text-slate-600">{question.hint}</p>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <ChoiceButton
                      pressed={value}
                      tone="danger"
                      onClick={() => setBefast((current) => ({ ...current, [key]: true }))}
                    >
                      HA
                    </ChoiceButton>
                    <ChoiceButton
                      pressed={!value}
                      tone="ink"
                      onClick={() => setBefast((current) => ({ ...current, [key]: false }))}
                    >
                      YOʻQ
                    </ChoiceButton>
                  </div>
                </div>
              )
            })}

            {/* The T of BE-FAST: the onset recorded on N3 drives the whole time window. */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <BefastIcon name="time" className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-900 px-1.5 text-sm font-bold text-white">
                    T
                  </span>
                  <h3 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">
                    Vaqt — simptom qachon boshlandi?
                  </h3>
                  {onsetAt ? (
                    <p className="mt-0.5 text-base text-slate-700">
                      <b className="tabular-nums">{clockTime(onsetAt)}</b>
                      {elapsed != null ? ` · ${humanMinutes(elapsed)} oʻtdi` : ''}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-base font-semibold text-amber-800">
                      Vaqt yozilmagan — vaqt oynasi hisoblanmaydi.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {suspected && !onsetAt ? (
        <InfoBanner>
          Insult shubhasi bor, lekin simptom vaqti yozilmagan. Vaqt oynasi hisoblanmaydi —
          mutaxassisga darhol xabar bering.
        </InfoBanner>
      ) : null}

      <Disclaimer text={disclaimer} />
    </Screen>
  )
}
