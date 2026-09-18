// N2 Holatlar roʻyxati — today's cases, offline queue badges, "+ Yangi holat".
// Operators (F-10) also search by case id or patient phone and attach a CT.
//
// Two layouts over the same data:
//   page  phone / tablet screen with its own app bar and sticky bottom action
//   pane  the always-visible master list next to the selected case on desktop

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import {
  CircleCheck, CloudOff, FileUp, Inbox, LogOut, Plus, RefreshCw, Search, SearchX, Stethoscope, Timer, WifiOff, X,
} from 'lucide-react'
import { NetworkError, api } from '../api/client'
import type { CaseListItem } from '../api/types'
import {
  Button, Card, Chip, EmptyState, ErrorBanner, FOOTER_ACTION, IconButton, INPUT_BASE, Notice,
  PendingBadge, Screen, Skeleton, Spinner, ZoneBadge,
} from '../components/ui'
import type { PendingCase } from '../offline/db'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { onSynced } from '../offline/sync'
import { clockTime, humanMinutes } from '../lib/time'
import { roleLabel, sexLabel, specialistLabel, statusLabel } from '../lib/labels'
import { zoneStyle } from '../lib/zone'
import { useApp } from '../state/AppContext'

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function CaseListScreen({ variant }: { variant: 'page' | 'pane' }) {
  const { user, facilityName, online, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const selected = useMatch('/case/:caseId/*')?.params.caseId ?? null
  const isOperator = user?.role === 'operator'
  const pane = variant === 'pane'

  const [cases, setCases] = useState<CaseListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showOlder, setShowOlder] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CaseListItem[] | null>(null)
  const [searching, setSearching] = useState(false)

  const { pendingCases, queuedByCase, queueSize, failedCount, retryNow: retryQueue } = useOfflineQueue()

  const lastLoadRef = useRef(0)

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < 3000) return
    lastLoadRef.current = Date.now()
    try {
      const list = await api.cases()
      setCases(list)
      setError(null)
    } catch (err) {
      if (err instanceof NetworkError) setError('Internet yoʻq — faqat saqlangan holatlar koʻrinadi')
      else setError(err instanceof Error ? err.message : 'Roʻyxat yuklanmadi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const unsubscribe = onSynced(() => void load(true))
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => {
      if (navigator.onLine) void load(true)
    }, 15_000)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [load])

  // Desktop: the list stays mounted while the nurse works in the detail pane,
  // so refresh it when she moves between screens (a new case shows up at once).
  useEffect(() => {
    if (pane) void load()
  }, [pane, location.pathname, load])

  async function refresh() {
    setRefreshing(true)
    await load(true)
    setRefreshing(false)
  }

  async function runSearch() {
    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      setSearchResults(await api.cases(q))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qidiruv ishlamadi')
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setSearchResults(null)
    setQuery('')
  }

  async function retryNow() {
    await retryQueue()
    await load(true)
  }

  const todays = cases.filter((c) => isToday(c.created_at))
  const older = cases.filter((c) => !isToday(c.created_at))
  const visible = showOlder ? cases : todays

  const searchForm = isOperator ? (
    <form
      role="search"
      className={pane ? 'mt-3' : ''}
      onSubmit={(e) => {
        e.preventDefault()
        void runSearch()
      }}
    >
      <label htmlFor={`case-search-${variant}`} className="mb-1.5 block text-base font-medium text-slate-700">
        Holatni qidirish
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={`case-search-${variant}`}
            className={`${INPUT_BASE} min-h-13 pr-4 pl-11`}
            value={query}
            inputMode="search"
            placeholder="ID yoki bemor telefoni"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" size="md" block={false} className="shrink-0" disabled={searching}>
          {searching ? <Spinner /> : <Search className="h-5 w-5" aria-hidden="true" />}
          <span className={pane ? 'sr-only' : 'max-sm:sr-only'}>Qidirish</span>
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-slate-500">Masalan: 12 yoki +998911112233</p>
    </form>
  ) : null

  const pendingRows = pendingCases.map((pending) => (
    <PendingRow key={pending.localId} pending={pending} compact={pane} selected={selected === pending.localId} />
  ))

  const body: ReactNode =
    searchResults !== null ? (
      <section className="space-y-3" aria-live="polite">
        <SectionHeading
          action={
            <Button variant="ghost" size="md" block={false} onClick={clearSearch}>
              <X className="h-5 w-5" aria-hidden="true" />
              Tozalash
            </Button>
          }
        >
          Qidiruv natijasi ({searchResults.length})
        </SectionHeading>
        {searchResults.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon={SearchX} title="Holat topilmadi">
              ID yoki telefon raqamini tekshirib, qayta qidiring.
            </EmptyState>
          </Card>
        ) : (
          <RowGrid pane={pane}>
            {searchResults.map((item) => (
              <CaseRow
                key={item.case_id}
                item={item}
                queued={queuedByCase.get(item.case_id) ?? 0}
                showAttach
                compact={pane}
                selected={selected === String(item.case_id)}
              />
            ))}
          </RowGrid>
        )}
      </section>
    ) : (
      <section className="space-y-3">
        {pendingRows.length > 0 ? <RowGrid pane={pane}>{pendingRows}</RowGrid> : null}

        <SectionHeading
          action={
            !pane ? (
              <IconButton
                label="Yangilash"
                icon={refreshing ? SpinnerIcon : RefreshCw}
                onClick={() => void refresh()}
              />
            ) : null
          }
        >
          Bugungi holatlar ({todays.length})
        </SectionHeading>

        {loading ? (
          <RowGrid pane={pane}>
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </RowGrid>
        ) : null}

        {!loading && visible.length === 0 && pendingCases.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon={Inbox} title="Bugun holat yoʻq">
              {isOperator
                ? 'Qishloqdan kelgan bemor holatini ID yoki telefon orqali qidiring.'
                : '“Yangi holat” tugmasi bilan birinchi bemorni qoʻshing.'}
            </EmptyState>
          </Card>
        ) : null}

        {visible.length > 0 ? (
          <RowGrid pane={pane}>
            {visible.map((item) => (
              <CaseRow
                key={item.case_id}
                item={item}
                queued={queuedByCase.get(item.case_id) ?? 0}
                showAttach={isOperator}
                compact={pane}
                selected={selected === String(item.case_id)}
              />
            ))}
          </RowGrid>
        ) : null}

        {older.length > 0 ? (
          <Button variant="secondary" size="md" onClick={() => setShowOlder((v) => !v)}>
            {showOlder ? 'Faqat bugungisi' : `Avvalgi kunlar (${older.length})`}
          </Button>
        ) : null}
      </section>
    )

  if (pane) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 pt-4 pb-3 backdrop-blur">
          <div className="flex min-h-12 items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Holatlar</h2>
              <p className="text-sm text-slate-500">
                Bugun: {todays.length}
                {queueSize > 0 ? ` · navbatda: ${queueSize}` : ''}
              </p>
            </div>
            <IconButton
              label="Yangilash"
              icon={refreshing ? SpinnerIcon : RefreshCw}
              onClick={() => void refresh()}
            />
          </div>
          {searchForm}
        </div>
        <div className="space-y-3 p-3">
          {!online ? (
            <Notice icon={WifiOff}>Internet yoʻq. Yangi holatlar qurilmada saqlanadi.</Notice>
          ) : null}
          <ErrorBanner message={error} />
          {body}
        </div>
      </div>
    )
  }

  return (
    <Screen
      title={facilityName ?? 'NAZAR AI'}
      subtitle={user ? `${user.full_name} · ${roleLabel(user.role).toLowerCase()}` : undefined}
      right={<IconButton label="Chiqish" icon={LogOut} tone="dark" onClick={logout} />}
      footer={
        !isOperator ? (
          <Button className={FOOTER_ACTION} onClick={() => navigate('/new')}>
            <Plus className="h-6 w-6" aria-hidden="true" />
            Yangi holat
          </Button>
        ) : (
          <Button variant="secondary" className={FOOTER_ACTION} onClick={() => void refresh()}>
            {refreshing ? <Spinner /> : <RefreshCw className="h-5 w-5" aria-hidden="true" />}
            Yangilash
          </Button>
        )
      }
    >
      {!online ? (
        <Notice icon={WifiOff}>
          Internet yoʻq. Yangi holatlar telefonda saqlanadi va ulanganda yuboriladi.
        </Notice>
      ) : null}

      {queueSize > 0 ? (
        <Notice
          icon={CloudOff}
          action={
            <Button variant="secondary" size="md" block={false} onClick={() => void retryNow()}>
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Qayta yuborish
            </Button>
          }
        >
          <PendingBadge />
          <p className="mt-1.5 text-base text-slate-700">
            {queueSize} ta yozuv navbatda
            {failedCount > 0 ? `, ${failedCount} tasi yuborilmadi` : ''}
          </p>
        </Notice>
      ) : null}

      <ErrorBanner message={error} />

      {searchForm ? <Card>{searchForm}</Card> : null}

      {body}
    </Screen>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return <Spinner className={className} />
}

function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-700">{children}</h2>
      {action}
    </div>
  )
}

/** Phone: one column. Tablet page: two columns. Desktop pane: one column. */
function RowGrid({ pane, children }: { pane: boolean; children: ReactNode }) {
  return <div className={`grid gap-3 ${pane ? '' : '@2xl:grid-cols-2'}`}>{children}</div>
}

function RowSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-3 h-5 w-32" />
      <Skeleton className="mt-2 h-4 w-full" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  )
}

function CaseRow({
  item,
  queued,
  showAttach,
  compact,
  selected,
}: {
  item: CaseListItem
  queued: number
  showAttach?: boolean
  compact: boolean
  selected: boolean
}) {
  const remaining = item.stroke?.remaining_min ?? null
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-card transition ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-500/25'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Colour bar is a second cue; the badge always carries the zone word. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${zoneStyle(item.zone).bar}`} />
      <Link
        to={`/case/${item.case_id}`}
        aria-current={selected ? 'page' : undefined}
        className={`block rounded-2xl ${compact ? 'py-3 pr-3 pl-5' : 'py-4 pr-4 pl-6'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ZoneBadge zone={item.zone} size={compact ? 'sm' : 'md'} />
          <span className="text-sm text-slate-500 tabular-nums">
            #{item.case_id} · {clockTime(item.created_at)}
          </span>
        </div>
        <div className={`mt-2 font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
          {item.age ? `${item.age} yosh` : 'Yosh nomaʼlum'} · {sexLabel(item.sex)}
        </div>
        {item.summary ? (
          <p className={`mt-0.5 line-clamp-2 text-slate-600 ${compact ? 'text-[15px]' : 'text-base'}`}>
            {item.summary}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip>{statusLabel(item.status)}</Chip>
          {item.specialist_type ? <Chip icon={Stethoscope}>{specialistLabel(item.specialist_type)}</Chip> : null}
          {item.has_decision ? (
            <Chip tone="green" icon={CircleCheck}>
              Mutaxassis javob berdi
            </Chip>
          ) : null}
          {remaining != null ? (
            <Chip icon={Timer}>
              Oyna: {humanMinutes(remaining)}
            </Chip>
          ) : null}
          {queued > 0 ? <PendingBadge /> : null}
        </div>
      </Link>
      {showAttach ? (
        <div className={`border-t border-slate-100 ${compact ? 'py-2 pr-2 pl-4' : 'py-3 pr-3 pl-5'}`}>
          <Link
            to={`/case/${item.case_id}/upload`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 text-base font-semibold text-brand-800 hover:bg-brand-100"
          >
            <FileUp className="h-5 w-5" aria-hidden="true" />
            KT / rentgen biriktirish
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function PendingRow({ pending, compact, selected }: { pending: PendingCase; compact: boolean; selected: boolean }) {
  return (
    <Link
      to={`/case/${pending.localId}`}
      aria-current={selected ? 'page' : undefined}
      className={`block rounded-2xl border-2 border-dashed bg-white ${compact ? 'p-3' : 'p-4'} ${
        selected ? 'border-brand-500' : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
            {pending.patient.full_name}
          </div>
          <div className="text-base text-slate-600">
            {pending.patient.birth_year} · {sexLabel(pending.patient.sex)}
          </div>
        </div>
        <PendingBadge />
      </div>
      {pending.lastError ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{pending.lastError}</p>
      ) : null}
    </Link>
  )
}
