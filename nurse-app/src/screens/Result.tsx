// N6 Natija (F-07, F-09) — zone in words, what to do next, the nearest CT,
// the live stroke timer, and the specialist's answer as soon as it lands.
//
// Narrow: one column in reading order (zone, timer, next step, decision…).
// Wide (≥ 672px of content): two columns — zone + summary + next step on the
// left, timer + nearest CT + specialist decision on the right. The same DOM
// serves both: column wrappers are `display: contents` on narrow screens and
// `order` puts the cards back in reading order.

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CircleCheck, CircleCheckBig, CircleDashed, CloudOff, FilePlus, ListChecks, MapPin, Navigation, PhoneCall,
  RefreshCw, Siren, SquarePen, Stethoscope, Route as RouteIcon, Sparkles, Trash2, TriangleAlert, UserRound,
} from 'lucide-react'
import { NetworkError, api } from '../api/client'
import type { CaseDetail, Facility, Zone } from '../api/types'
import { Countdown } from '../components/Countdown'
import { StudyRow } from '../components/StudyRow'
import {
  Button, ButtonLink, Card, CardTitle, Disclaimer, ErrorBanner, FOOTER_ACTION, Notice, PendingBadge, Screen,
  Skeleton, Spinner,
} from '../components/ui'
import type { Icon } from '../components/ui'
import { db, discardPendingCase, enqueue, isLocalId, retryAll } from '../offline/db'
import { flush } from '../offline/sync'
import {
  DECISION_ACTION, FLAG_LABEL, LAB_LABEL, routeLabel, sexLabel, specialistLabel, statusLabel, zoneLabel,
} from '../lib/labels'
import { clockTime, humanMinutes } from '../lib/time'
import { zoneStyle } from '../lib/zone'
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
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {pending ? (
              <div className="min-w-0">
                <div className="text-xl font-semibold tracking-tight text-slate-900">{pending.patient.full_name}</div>
                <div className="text-base text-slate-600">
                  {pending.patient.birth_year} · {sexLabel(pending.patient.sex)}
                </div>
              </div>
            ) : (
              <p className="text-base text-slate-700">Holat yuborildi yoki oʻchirildi.</p>
            )}
            <PendingBadge />
          </div>
          {pending ? (
            <p className="mt-3 text-base text-slate-700">
              Simptom boshlangan vaqt: <b className="tabular-nums">{clockTime(pending.symptom_onset_at)}</b>
            </p>
          ) : null}
          {pending?.lastError ? (
            <div className="mt-3">
              <ErrorBanner message={pending.lastError} />
            </div>
          ) : null}
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-base text-slate-700">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              {queued} ta fayl/yozuv navbatda. Internet kelganda avtomatik yuboriladi va AI natijasi shu
              yerda paydo boʻladi.
            </span>
          </p>
        </Card>
        <div className="grid gap-3 @xl:grid-cols-3">
          <Button
            variant="secondary"
            onClick={async () => {
              await retryAll()
              await flush()
            }}
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            Qayta yuborish
          </Button>
          <ButtonLink to={`/case/${caseId}/anamnesis`}>
            <SquarePen className="h-5 w-5" aria-hidden="true" />
            Anamnezni tahrirlash
          </ButtonLink>
          <ButtonLink to={`/case/${caseId}/upload`}>
            <FilePlus className="h-5 w-5" aria-hidden="true" />
            Fayl qoʻshish
          </ButtonLink>
        </div>
        {pending ? (
          <button
            type="button"
            className="mx-auto flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-semibold text-red-700 hover:bg-red-50"
            onClick={async () => {
              await discardPendingCase(caseId)
              navigate('/')
            }}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
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
        <div className="flex flex-col gap-4 sm:gap-5 @2xl:grid @2xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          <div className="space-y-4 sm:space-y-5">
            <Card>
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-9 w-full max-w-64" />
                </div>
              </div>
              <Skeleton className="mt-5 h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-4/5" />
            </Card>
            <Card>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-4 h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-2/3" />
            </Card>
          </div>
          <div className="space-y-4 sm:space-y-5">
            <Card>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-4 h-12 w-48" />
            </Card>
            <Card>
              <Skeleton className="h-6 w-44" />
              <Skeleton className="mt-4 h-5 w-full" />
            </Card>
          </div>
        </div>
      </Screen>
    )
  }

  if (!detail) {
    return (
      <Screen title="Natija" back="/">
        <ErrorBanner
          message={error ?? 'Holat topilmadi'}
          action={
            <Button variant="secondary" size="md" block={false} onClick={() => void load()}>
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Qayta urinish
            </Button>
          }
        />
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
  const aiDisclaimer = detail.disclaimer || disclaimer

  return (
    <Screen
      title={`Holat #${detail.id}`}
      subtitle={detail.patient.full_name ?? undefined}
      back="/"
      footerNote={
        detail.status === 'closed'
          ? `Yopilgan: ${clockTime(detail.closed_at)}`
          : decision
            ? undefined
            : 'Holat mutaxassis qaroridan keyin yopiladi'
      }
      footer={
        detail.status === 'closed' ? (
          <Button variant="secondary" onClick={() => navigate('/')} className={FOOTER_ACTION}>
            Roʻyxatga qaytish
          </Button>
        ) : decision ? (
          <Button onClick={() => void closeCase()} disabled={closing} className={FOOTER_ACTION}>
            {closing ? <Spinner /> : <CircleCheck className="h-5 w-5" aria-hidden="true" />}
            {closing ? 'Yopilmoqda…' : 'Holatni yopish'}
          </Button>
        ) : (
          <Button disabled className={FOOTER_ACTION}>
            <Spinner />
            Mutaxassis javobi kutilmoqda…
          </Button>
        )
      }
    >
      <ErrorBanner message={error} />
      {queued > 0 ? (
        <Notice icon={CloudOff}>
          <span className="flex flex-wrap items-center gap-2">
            <PendingBadge />
            <span>{queued} ta yozuv navbatda</span>
          </span>
        </Notice>
      ) : null}

      <div className="flex flex-col gap-4 sm:gap-5 @2xl:grid @2xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] @2xl:items-start">
        {/* Left column on wide screens. */}
        <div className="contents @2xl:flex @2xl:flex-col @2xl:gap-5">
          <div className="order-1">
            <ZoneHero
              zone={zone}
              status={statusLabel(detail.status)}
              summary={
                summaryLines.length > 0
                  ? summaryLines.slice(0, 2).join(' ')
                  : aiWorking
                    ? 'AI tekshiruvni oʻqimoqda…'
                    : 'Xulosa hali tayyor emas.'
              }
              aiWorking={aiWorking}
            />
            <Disclaimer text={aiDisclaimer} className="mt-3" />
          </div>

          <div className="order-4">
            <Card>
              <CardTitle icon={Navigation}>Keyingi qadam</CardTitle>
              <dl className="space-y-3">
                <InfoRow icon={Stethoscope} label="Mutaxassis">
                  {specialistLabel(detail.specialist_type ?? triage?.specialist_type)}
                  {detail.specialist_type ? ' xabardor qilindi' : ''}
                </InfoRow>
                <InfoRow icon={RouteIcon} label="Yoʻnalish">
                  {routeLabel(detail.route ?? triage?.route)}
                </InfoRow>
              </dl>
              {zone === 'red' ? (
                <a
                  href="tel:103"
                  className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-center text-base font-bold text-white shadow-sm hover:bg-red-700 sm:text-lg lg:min-h-12 lg:text-base"
                >
                  <PhoneCall className="h-5 w-5" aria-hidden="true" />
                  103 — tez yordamga qoʻngʻiroq
                </a>
              ) : null}
            </Card>
          </div>

          {triage && triage.reasons.length > 0 ? (
            <div className="order-7">
              <Card>
                <CardTitle icon={Sparkles}>AI asoslari</CardTitle>
                <ul className="space-y-2">
                  {triage.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2.5 text-base text-slate-800">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span className="min-w-0 break-words">{reason}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-slate-500">
                  Qoidalar: {triage.rules_version}
                  {triage.readers_agree === false ? ' · ikki oʻquvchi kelishmadi' : ''}
                </p>
                <Disclaimer text={aiDisclaimer} className="mt-3" />
              </Card>
            </div>
          ) : null}

          <div className="order-8">
            <Card>
              <CardTitle icon={UserRound}>Bemor</CardTitle>
              <dl className="divide-y divide-slate-100">
                <DetailRow label="Yosh, jins">
                  {detail.patient.age ? `${detail.patient.age} yosh` : 'Yosh nomaʼlum'} ·{' '}
                  {sexLabel(detail.patient.sex)}
                </DetailRow>
                {detail.patient.phone ? <DetailRow label="Telefon">{detail.patient.phone}</DetailRow> : null}
                <DetailRow label="Simptom">
                  <span className="tabular-nums">{clockTime(detail.symptom_onset_at)}</span>
                  {triage?.stroke?.elapsed_min != null
                    ? ` · ${humanMinutes(triage.stroke.elapsed_min)} oʻtdi`
                    : ''}
                </DetailRow>
                {detail.anamnesis?.chief_complaint ? (
                  <DetailRow label="Shikoyat">{detail.anamnesis.chief_complaint}</DetailRow>
                ) : null}
                {detail.anamnesis?.voice_transcript ? (
                  <DetailRow label="Ovoz">{detail.anamnesis.voice_transcript}</DetailRow>
                ) : null}
                {triage?.stroke?.score != null ? (
                  <DetailRow label="BE-FAST">
                    {triage.stroke.score} ball
                    {triage.stroke.suspected ? ' · insult shubhasi' : ''}
                  </DetailRow>
                ) : null}
                {activeFlags.length > 0 ? (
                  <DetailRow label="Xavfli belgilar">
                    <span className="font-semibold text-red-700">
                      {activeFlags.map(([key]) => FLAG_LABEL[key] ?? key).join(', ')}
                    </span>
                  </DetailRow>
                ) : null}
                {Object.keys(labs).length > 0 ? (
                  <DetailRow label="Tahlillar">
                    {Object.entries(labs)
                      .map(([name, value]) => `${LAB_LABEL[name] ?? name} ${value}`)
                      .join(', ')}
                  </DetailRow>
                ) : null}
              </dl>
            </Card>
          </div>
        </div>

        {/* Right column on wide screens. */}
        <div className="contents @2xl:flex @2xl:flex-col @2xl:gap-5">
          {/* Only a suspected stroke gets a window: the server sets time_window_min then. */}
          {triage?.time_window_min != null ? (
            <div className="order-3">
              <Countdown
                onsetAt={triage?.stroke?.onset_at ?? detail.symptom_onset_at}
                fallbackMinutes={triage?.time_window_min ?? null}
                fallbackFrom={triage?.computed_at ?? null}
                meta={meta}
              />
            </div>
          ) : null}

          {nearest || detail.facility?.has_ct ? (
            <div className="order-5">
              <NearestCt nearest={nearest} others={detail.nearest_ct.slice(1, 3)} />
            </div>
          ) : null}

          <div className="order-6" aria-live="polite">
            {decision ? (
              <section className="rounded-2xl border-2 border-green-600 bg-green-50 p-4 shadow-card sm:p-5">
                <div className="flex items-center gap-2.5 text-lg font-semibold text-green-900 lg:text-base">
                  <CircleCheckBig className="h-5 w-5 shrink-0" aria-hidden="true" />
                  Mutaxassis javobi
                </div>
                <p className="mt-2 text-base font-semibold text-green-950">
                  {decision.specialist_name ?? 'Mutaxassis'}
                  {decision.specialty ? ` (${specialistLabel(decision.specialty)})` : ''} —{' '}
                  {DECISION_ACTION[decision.action] ?? decision.action}
                </p>
                {decision.note ? (
                  <p className="mt-3 rounded-xl bg-white px-4 py-3 text-lg leading-snug text-slate-900 ring-1 ring-green-200">
                    {decision.note}
                  </p>
                ) : null}
                {decision.route_final ? (
                  <p className="mt-3 text-base text-slate-800">
                    <span className="font-semibold">Yakuniy yoʻnalish:</span> {routeLabel(decision.route_final)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-green-800 tabular-nums">{clockTime(decision.decided_at)}</p>
              </section>
            ) : (
              <Card>
                <div className="flex items-start gap-3">
                  <span className="relative mt-1.5 flex h-3 w-3 shrink-0" aria-hidden="true">
                    {online ? (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                    ) : null}
                    <span className={`relative inline-flex h-3 w-3 rounded-full ${online ? 'bg-brand-500' : 'bg-slate-400'}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-900 lg:text-base">Mutaxassis javobi</div>
                    <p className="mt-0.5 text-base text-slate-600">
                      {online
                        ? 'Mutaxassis javobi kutilmoqda. Javob kelganda shu ekranda paydo boʻladi.'
                        : 'Internet yoʻq — javob ulanganda koʻrinadi.'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="order-9">
            <Card>
              <CardTitle icon={ListChecks}>Tekshiruvlar</CardTitle>
              {detail.studies.length === 0 ? (
                <p className="text-base text-slate-600">Hali tekshiruv yuklanmagan.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detail.studies.map((study) => (
                    <StudyRow key={study.id} study={study} />
                  ))}
                </ul>
              )}
              <div className="@container mt-4">
                <div className="grid gap-3 @md:grid-cols-2">
                  <ButtonLink to={`/case/${detail.id}/upload`} size="md">
                    <FilePlus className="h-5 w-5" aria-hidden="true" />
                    Tekshiruv qoʻshish
                  </ButtonLink>
                  <ButtonLink to={`/case/${detail.id}/anamnesis`} size="md">
                    <SquarePen className="h-5 w-5" aria-hidden="true" />
                    Anamnezni tahrirlash
                  </ButtonLink>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Screen>
  )
}

const ZONE_ICON: Record<Zone | 'none', Icon> = {
  red: Siren,
  yellow: TriangleAlert,
  green: CircleCheck,
  none: CircleDashed,
}

/** The big colour block (TZ §12 N6): colour AND the zone word, always. */
function ZoneHero({
  zone,
  status,
  summary,
  aiWorking,
}: {
  zone: Zone | null
  status: string
  summary: string
  aiWorking: boolean
}) {
  const ZoneIcon = ZONE_ICON[zone ?? 'none']
  const overlay = zone === 'yellow' ? 'bg-slate-950/10 ring-slate-950/15' : 'bg-white/15 ring-white/25'
  return (
    <section className={`rounded-2xl p-5 shadow-raised sm:p-6 ${zoneStyle(zone).block}`} aria-label="Triyaj natijasi">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${overlay}`}>
          <ZoneIcon className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-wider uppercase opacity-85">Triyaj zonasi</div>
          <div className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{zoneLabel(zone)}</div>
        </div>
      </div>
      <p className="mt-4 text-lg leading-snug break-words">{summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ring-1 ${overlay}`}>
          {status}
        </span>
        {aiWorking ? (
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ring-1 ${overlay}`}>
            <Spinner className="h-3.5 w-3.5" />
            AI oʻqimoqda
          </span>
        ) : null}
      </div>
    </section>
  )
}

function NearestCt({ nearest, others }: { nearest: Facility | null; others: Facility[] }) {
  return (
    <Card>
      <CardTitle icon={MapPin}>Eng yaqin KT</CardTitle>
      {nearest ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg leading-snug font-semibold text-slate-900 lg:text-base">{nearest.name}</div>
              {nearest.district ? <div className="text-base text-slate-600">{nearest.district}</div> : null}
            </div>
            {nearest.distance_km != null ? (
              <div className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-right">
                <div className="text-xl font-bold text-slate-900 tabular-nums">{nearest.distance_km}</div>
                <div className="text-sm text-slate-500">km</div>
              </div>
            ) : null}
          </div>
          {others.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {others.map((facility) => (
                <li key={facility.id} className="flex items-baseline justify-between gap-3 text-base text-slate-600">
                  <span className="min-w-0">{facility.name}</span>
                  {facility.distance_km != null ? (
                    <span className="shrink-0 text-slate-500 tabular-nums">{facility.distance_km} km</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-base text-slate-800">KT shu muassasada bor.</p>
      )}
    </Card>
  )
}

function InfoRow({ icon: RowIcon, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <RowIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <dt className="text-sm text-slate-500">{label}</dt>
        <dd className="text-base font-semibold text-slate-900">{children}</dd>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-base text-slate-500">{label}</dt>
      <dd className="text-base break-words text-slate-900">{children}</dd>
    </div>
  )
}
