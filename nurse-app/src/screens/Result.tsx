// N6 Natija (F-07, F-09) — zone in words, what to do next, the nearest CT,
// the live stroke timer, and the specialist's answer as soon as it lands.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NetworkError, api } from '../api/client'
import type { CaseDetail } from '../api/types'
import { Countdown } from '../components/Countdown'
import { Button, Card, Disclaimer, ErrorBanner, PendingBadge, Screen } from '../components/ui'
import { db, discardPendingCase, enqueue, isLocalId, retryAll } from '../offline/db'
import { flush } from '../offline/sync'
import {
  DECISION_ACTION, FLAG_LABEL, LAB_LABEL, STUDY_STATUS, STUDY_TYPE,
  ZONE_BLOCK, routeLabel, sexLabel, specialistLabel, statusLabel, zoneLabel,
} from '../lib/labels'
import { clockTime, humanMinutes } from '../lib/time'
import { useApp } from '../state/AppContext'

const POLL_MS = 4000

export function ResultScreen() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const { meta, disclaimer, online } = useApp()
  const local = isLocalId(caseId)

  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const pending = useLiveQuery(
    async () => (local ? await db.pendingCases.get(caseId) : undefined),
    [caseId, local],
  )
  const queued = useLiveQuery(
    () =>
      local
        ? db.outbox.where('localId').equals(caseId).count()
        : db.outbox.where('caseId').equals(Number(caseId)).count(),
    [caseId, local],
    0,
  )

  const load = useCallback(async () => {
    if (local) {
      setLoaded(true)
      return
    }
    try {
      const fresh = await api.caseDetail(Number(caseId))
      setDetail(fresh)
      setError(null)
    } catch (err) {
      if (err instanceof NetworkError) setError('Internet yoʻq — natija yangilanmadi')
      else setError(err instanceof Error ? err.message : 'Holat yuklanmadi')
    } finally {
      setLoaded(true)
    }
  }, [caseId, local])

  // F-09: poll so the specialist's decision shows up without a refresh.
  useEffect(() => {
    void load()
    if (local) return
    const timer = window.setInterval(() => {
      if (navigator.onLine) void load()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load, local])

  async function closeCase() {
    setClosing(true)
    setError(null)
    try {
      setDetail(await api.closeCase(Number(caseId)))
    } catch (err) {
      if (err instanceof NetworkError) {
        await enqueue({ kind: 'close', caseId: Number(caseId) })
        setError('Internet yoʻq — yopish navbatga qoʻyildi')
        return
      }
      setError(err instanceof Error ? err.message : 'Holat yopilmadi')
    } finally {
      setClosing(false)
    }
  }

  if (local) {
    return (
      <Screen title="Holat (oflayn)" back="/">
        <Card className="space-y-2">
          <PendingBadge />
          {pending ? (
            <>
              <div className="text-xl font-bold">{pending.patient.full_name}</div>
              <div className="text-base text-slate-700">
                {pending.patient.birth_year} · {sexLabel(pending.patient.sex)}
              </div>
              <p className="text-base text-slate-700">
                Simptom boshlangan vaqt: {clockTime(pending.symptom_onset_at)}
              </p>
              {pending.lastError ? (
                <p className="text-base font-semibold text-red-700">{pending.lastError}</p>
              ) : null}
            </>
          ) : (
            <p className="text-base text-slate-700">Holat yuborildi yoki oʻchirildi.</p>
          )}
          <p className="text-base text-slate-700">
            {queued} ta fayl/yozuv navbatda. Internet kelganda avtomatik yuboriladi va AI natijasi shu
            yerda paydo boʻladi.
          </p>
        </Card>
        <Button
          variant="secondary"
          onClick={async () => {
            await retryAll()
            await flush()
          }}
        >
          Qayta yuborish
        </Button>
        <Link
          to={`/case/${caseId}/anamnesis`}
          className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold"
        >
          Anamnezni tahrirlash
        </Link>
        <Link
          to={`/case/${caseId}/upload`}
          className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold"
        >
          Fayl qoʻshish
        </Link>
        {pending ? (
          <button
            type="button"
            className="min-h-[56px] w-full text-base font-semibold text-red-700 underline"
            onClick={async () => {
              await discardPendingCase(caseId)
              navigate('/')
            }}
          >
            Navbatdan oʻchirish
          </button>
        ) : null}
        <Disclaimer text={disclaimer} />
      </Screen>
    )
  }

  if (!loaded) {
    return (
      <Screen title="Natija" back="/">
        <Card>
          <p className="text-base text-slate-600">Yuklanmoqda…</p>
        </Card>
      </Screen>
    )
  }

  if (!detail) {
    return (
      <Screen title="Natija" back="/">
        <ErrorBanner message={error ?? 'Holat topilmadi'} />
      </Screen>
    )
  }

  const triage = detail.triage
  const zone = detail.zone ?? triage?.zone ?? null
  const decision = detail.decisions.length > 0 ? detail.decisions[detail.decisions.length - 1] : null
  const nearest = detail.nearest_ct[0] ?? null
  const summaryLines = (triage?.summary_nurse ?? '').split('\n').filter(Boolean)
  const aiWorking = detail.studies.some((s) => s.status === 'queued' || s.status === 'processing')
  const labs = detail.anamnesis?.labs ?? {}
  const activeFlags = Object.entries(detail.anamnesis?.flags ?? {}).filter(([, on]) => on)

  return (
    <Screen
      title={`Holat #${detail.id}`}
      subtitle={detail.patient.full_name ?? undefined}
      back="/"
      footer={
        detail.status === 'closed' ? (
          <Button variant="secondary" onClick={() => navigate('/')}>
            Roʻyxatga qaytish
          </Button>
        ) : decision ? (
          <Button onClick={() => void closeCase()} disabled={closing}>
            {closing ? 'Yopilmoqda…' : 'Holatni yopish'}
          </Button>
        ) : (
          <Button disabled>Mutaxassis javobi kutilmoqda…</Button>
        )
      }
    >
      <ErrorBanner message={error} />
      {queued > 0 ? (
        <div className="flex items-center gap-2">
          <PendingBadge />
          <span className="text-base text-slate-700">{queued} ta yozuv navbatda</span>
        </div>
      ) : null}

      {/* Zone: colour AND word, always (TZ §12). */}
      <div className={`rounded-2xl px-4 py-5 ${zone ? ZONE_BLOCK[zone] : 'bg-slate-300 text-slate-900'}`}>
        <div className="text-4xl font-extrabold leading-tight">{zoneLabel(zone)}</div>
        <div className="mt-1 text-base font-semibold opacity-90">{statusLabel(detail.status)}</div>
        {summaryLines.length > 0 ? (
          <p className="mt-3 text-lg leading-snug">{summaryLines.slice(0, 2).join(' ')}</p>
        ) : (
          <p className="mt-3 text-lg leading-snug">
            {aiWorking ? 'AI tekshiruvni oʻqimoqda…' : 'Xulosa hali tayyor emas.'}
          </p>
        )}
      </div>

      <Disclaimer text={detail.disclaimer || disclaimer} />

      {/* Only a suspected stroke gets a window: the server sets time_window_min then. */}
      {triage?.time_window_min != null ? (
        <Countdown
          onsetAt={triage?.stroke?.onset_at ?? detail.symptom_onset_at}
          fallbackMinutes={triage?.time_window_min ?? null}
          fallbackFrom={triage?.computed_at ?? null}
          meta={meta}
        />
      ) : null}

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Keyingi qadam</h2>
        <div className="text-base text-slate-800">
          <span className="font-semibold">Mutaxassis:</span>{' '}
          {specialistLabel(detail.specialist_type ?? triage?.specialist_type)}
          {detail.specialist_type ? ' xabardor qilindi' : ''}
        </div>
        <div className="text-base text-slate-800">
          <span className="font-semibold">Yoʻnalish:</span> {routeLabel(detail.route ?? triage?.route)}
        </div>
        {nearest ? (
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-base text-slate-800">
            <span className="font-semibold">Eng yaqin KT:</span> {nearest.name}
            {nearest.distance_km != null ? ` — ${nearest.distance_km} km` : ''}
            {nearest.district ? ` (${nearest.district})` : ''}
          </div>
        ) : detail.facility?.has_ct ? (
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-base text-slate-800">
            KT shu muassasada bor.
          </div>
        ) : null}
        {zone === 'red' ? (
          <a
            href="tel:103"
            className="flex min-h-[56px] items-center justify-center rounded-xl bg-red-600 text-lg font-bold text-white"
          >
            103 — tez yordamga qoʻngʻiroq
          </a>
        ) : null}
      </Card>

      {decision ? (
        <Card className="border-2 border-green-600 bg-green-50">
          <h2 className="text-lg font-bold text-green-900">Mutaxassis javobi</h2>
          <p className="mt-1 text-base font-semibold text-green-900">
            {decision.specialist_name ?? 'Mutaxassis'}
            {decision.specialty ? ` (${specialistLabel(decision.specialty)})` : ''} —{' '}
            {DECISION_ACTION[decision.action] ?? decision.action}
          </p>
          {decision.note ? <p className="mt-2 text-lg text-slate-900">{decision.note}</p> : null}
          {decision.route_final ? (
            <p className="mt-2 text-base text-slate-800">
              <span className="font-semibold">Yakuniy yoʻnalish:</span> {routeLabel(decision.route_final)}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">{clockTime(decision.decided_at)}</p>
        </Card>
      ) : (
        <Card>
          <p className="text-base text-slate-700">
            {online
              ? 'Mutaxassis javobi kutilmoqda. Javob kelganda shu ekranda paydo boʻladi.'
              : 'Internet yoʻq — javob ulanganda koʻrinadi.'}
          </p>
        </Card>
      )}

      {triage && triage.reasons.length > 0 ? (
        <Card>
          <h2 className="text-lg font-bold">AI asoslari</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-800">
            {triage.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-500">
            Qoidalar: {triage.rules_version}
            {triage.readers_agree === false ? ' · ikki oʻquvchi kelishmadi' : ''}
          </p>
          <Disclaimer text={detail.disclaimer || disclaimer} className="mt-2" />
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Bemor</h2>
        <p className="text-base text-slate-800">
          {detail.patient.age ? `${detail.patient.age} yosh` : 'Yosh nomaʼlum'} ·{' '}
          {sexLabel(detail.patient.sex)}
          {detail.patient.phone ? ` · ${detail.patient.phone}` : ''}
        </p>
        <p className="text-base text-slate-700">
          Simptom: {clockTime(detail.symptom_onset_at)}
          {triage?.stroke?.elapsed_min != null
            ? ` · ${humanMinutes(triage.stroke.elapsed_min)} oʻtdi`
            : ''}
        </p>
        {detail.anamnesis?.chief_complaint ? (
          <p className="text-base text-slate-800">Shikoyat: {detail.anamnesis.chief_complaint}</p>
        ) : null}
        {detail.anamnesis?.voice_transcript ? (
          <p className="text-base text-slate-700">Ovoz: {detail.anamnesis.voice_transcript}</p>
        ) : null}
        {triage?.stroke?.score != null ? (
          <p className="text-base text-slate-800">
            BE-FAST: {triage.stroke.score} ball
            {triage.stroke.suspected ? ' · insult shubhasi' : ''}
          </p>
        ) : null}
        {activeFlags.length > 0 ? (
          <p className="text-base font-semibold text-red-700">
            Xavfli belgilar: {activeFlags.map(([key]) => FLAG_LABEL[key] ?? key).join(', ')}
          </p>
        ) : null}
        {Object.keys(labs).length > 0 ? (
          <p className="text-base text-slate-800">
            Tahlillar:{' '}
            {Object.entries(labs)
              .map(([name, value]) => `${LAB_LABEL[name] ?? name} ${value}`)
              .join(', ')}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Tekshiruvlar</h2>
        {detail.studies.length === 0 ? (
          <p className="text-base text-slate-600">Hali tekshiruv yuklanmagan.</p>
        ) : (
          detail.studies.map((study) => (
            <div key={study.id} className="flex items-center justify-between gap-2 text-base">
              <span className="font-semibold text-slate-800">{STUDY_TYPE[study.type] ?? study.type}</span>
              <span className={study.status === 'failed' ? 'text-red-700' : 'text-slate-600'}>
                {STUDY_STATUS[study.status] ?? study.status}
              </span>
            </div>
          ))
        )}
        <Link
          to={`/case/${detail.id}/upload`}
          className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold"
        >
          Tekshiruv qoʻshish
        </Link>
        <Link
          to={`/case/${detail.id}/anamnesis`}
          className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold"
        >
          Anamnezni tahrirlash
        </Link>
      </Card>
    </Screen>
  )
}
