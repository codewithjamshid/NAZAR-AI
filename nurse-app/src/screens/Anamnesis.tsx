// N4 Anamnez (F-02, F-03) — complaint text, voice note, BE-FAST and red flags.
// BE-FAST points and the suspicion rule come from GET /meta; nothing clinical
// is written into this file.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NetworkError, api } from '../api/client'
import type { AnamnesisPayload, Befast, BefastKey, FlagKey, Meta, Study } from '../api/types'
import { BEFAST_KEYS, FLAG_KEYS } from '../api/types'
import { BefastIcon } from '../components/BefastIcon'
import { Button, Card, Disclaimer, ErrorBanner, InfoBanner, PendingBadge, Screen } from '../components/ui'
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

  return (
    <Screen
      title="Anamnez"
      subtitle={local ? 'Oflayn holat' : `Holat #${caseId}`}
      back={`/case/${caseId}`}
      footer={
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saqlanmoqda…' : 'Saqlash va davom etish'}
        </Button>
      }
    >
      <ErrorBanner message={error} />
      {local ? (
        <div className="flex items-center gap-2">
          <PendingBadge />
          <span className="text-base text-slate-700">Holat telefonda saqlanmoqda</span>
        </div>
      ) : null}

      <Card className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-base font-semibold text-slate-700">Shikoyat</span>
          <textarea
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg outline-none focus:border-sky-600"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Oʻng qoʻli ishlamayapti, gapirolmayapti"
          />
        </label>

        <button
          type="button"
          onClick={() => void toggleRecording()}
          disabled={voiceBusy}
          className={`flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border-2 text-lg font-semibold ${
            recording
              ? 'nazar-pulse border-red-700 bg-red-600 text-white'
              : 'border-slate-300 bg-white text-slate-800'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </svg>
          {recording ? 'Toʻxtatish va yuborish' : voiceBusy ? 'Yuborilmoqda…' : 'Ovoz bilan aytish'}
        </button>
        {voiceNote ? <p className="text-base text-slate-700">{voiceNote}</p> : null}
        {!online ? (
          <p className="text-sm text-slate-500">Internet yoʻq — ovoz navbatga qoʻyiladi.</p>
        ) : null}
      </Card>

      {!showBefast ? (
        <Button variant="secondary" onClick={() => setShowBefast(true)}>
          Insult shubhasi? — BE-FAST
        </Button>
      ) : null}

      {showBefast ? (
        <section className="space-y-3">
          <div
            className={`rounded-2xl px-4 py-3 ${
              suspected ? 'bg-red-600 text-white' : 'bg-white text-slate-900 border border-slate-200'
            }`}
          >
            <div className="text-2xl font-bold">
              BE-FAST: {score} ball
            </div>
            <div className="text-base">
              {suspected
                ? 'INSULT SHUBHASI — vaqt oynasi muhim'
                : 'Hozircha insult belgilari yoʻq'}
            </div>
            {meta ? (
              <div className="mt-1 text-sm opacity-90">
                Chegara: {meta.befast.stroke_min_score} ball yoki F/A/S dan bittasi · qoidalar{' '}
                {meta.rules_version}
              </div>
            ) : (
              <div className="mt-1 text-sm opacity-90">Chegaralar serverdan olinmadi</div>
            )}
          </div>

          {BEFAST_QUESTIONS.map((question) => {
            const key = question.key as BefastKey
            const value = befast[key]
            return (
              <Card key={key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <BefastIcon name={key} className="h-8 w-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-slate-900">
                      <span className="mr-2 rounded bg-slate-900 px-2 py-0.5 text-base text-white">
                        {question.letter}
                      </span>
                      {question.title}
                    </div>
                    <p className="mt-1 text-base text-slate-600">{question.hint}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Ball: {meta?.befast.points[key] ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={value}
                    onClick={() => setBefast((current) => ({ ...current, [key]: true }))}
                    className={`min-h-[56px] rounded-xl border-2 text-lg font-bold ${
                      value ? 'border-red-800 bg-red-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    HA
                  </button>
                  <button
                    type="button"
                    aria-pressed={!value}
                    onClick={() => setBefast((current) => ({ ...current, [key]: false }))}
                    className={`min-h-[56px] rounded-xl border-2 text-lg font-bold ${
                      !value ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    YOʻQ
                  </button>
                </div>
              </Card>
            )
          })}

          {/* The T of BE-FAST: the onset recorded on N3 drives the whole time window. */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <BefastIcon name="time" className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold text-slate-900">
                  <span className="mr-2 rounded bg-slate-900 px-2 py-0.5 text-base text-white">T</span>
                  Vaqt — simptom qachon boshlandi?
                </div>
                {onsetAt ? (
                  <p className="mt-1 text-base text-slate-700">
                    {clockTime(onsetAt)} · {elapsed != null ? `${humanMinutes(elapsed)} oʻtdi` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-base font-semibold text-amber-800">
                    Vaqt yozilmagan — vaqt oynasi hisoblanmaydi.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <Card className="space-y-3">
        <span className="block text-base font-semibold text-slate-700">Xavfli belgilar</span>
        {FLAG_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={flags[key]}
            onClick={() => setFlags((current) => ({ ...current, [key]: !current[key] }))}
            className={`flex min-h-[56px] w-full items-center justify-between rounded-xl border-2 px-4 text-lg font-semibold ${
              flags[key] ? 'border-red-800 bg-red-600 text-white' : 'border-slate-300 bg-white text-slate-800'
            }`}
          >
            <span>{FLAG_LABEL[key]}</span>
            <span className="text-base">{flags[key] ? 'HA' : 'YOʻQ'}</span>
          </button>
        ))}
      </Card>

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
