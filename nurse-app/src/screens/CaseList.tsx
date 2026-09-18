// N2 Holatlar roʻyxati — today's cases, offline queue badges, "+ Yangi holat".
// Operators (F-10) also search by case id or patient phone and attach a CT.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NetworkError, api } from '../api/client'
import type { CaseListItem } from '../api/types'
import { Button, Card, ErrorBanner, PendingBadge, Screen, ZoneBadge } from '../components/ui'
import { db, retryAll } from '../offline/db'
import { flush, onSynced } from '../offline/sync'
import { clockTime, humanMinutes } from '../lib/time'
import { sexLabel, specialistLabel, statusLabel } from '../lib/labels'
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

export function CaseListScreen() {
  const { user, facilityName, online, logout } = useApp()
  const navigate = useNavigate()
  const isOperator = user?.role === 'operator'

  const [cases, setCases] = useState<CaseListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOlder, setShowOlder] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CaseListItem[] | null>(null)
  const [searching, setSearching] = useState(false)

  const pendingCases = useLiveQuery(() => db.pendingCases.orderBy('createdAt').reverse().toArray(), [], [])
  const outbox = useLiveQuery(() => db.outbox.toArray(), [], [])

  const queuedByCase = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of outbox ?? []) {
      if (item.caseId != null) map.set(item.caseId, (map.get(item.caseId) ?? 0) + 1)
    }
    return map
  }, [outbox])

  const queueSize = (pendingCases?.length ?? 0) + (outbox?.length ?? 0)
  const failedCount =
    (pendingCases ?? []).filter((c) => c.status === 'failed').length +
    (outbox ?? []).filter((i) => i.status === 'failed').length

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

  async function retryNow() {
    await retryAll()
    await flush()
    await load(true)
  }

  const todays = cases.filter((c) => isToday(c.created_at))
  const older = cases.filter((c) => !isToday(c.created_at))
  const visible = showOlder ? cases : todays

  return (
    <Screen
      title={facilityName ?? 'NAZAR AI'}
      subtitle={user ? `${user.full_name} · ${user.role === 'operator' ? 'operator' : 'hamshira'}` : undefined}
      right={
        <button
          type="button"
          onClick={logout}
          className="min-h-[48px] rounded-xl px-3 text-base font-semibold text-slate-200 active:bg-slate-700"
        >
          Chiqish
        </button>
      }
      footer={
        !isOperator ? (
          <Button onClick={() => navigate('/new')}>+ Yangi holat</Button>
        ) : (
          <Button variant="secondary" onClick={() => void load(true)}>
            Yangilash
          </Button>
        )
      }
    >
      {!online ? (
        <div className="rounded-xl border-2 border-slate-400 bg-slate-200 px-4 py-3 text-base font-semibold text-slate-800">
          Internet yoʻq. Yangi holatlar telefonda saqlanadi va ulanganda yuboriladi.
        </div>
      ) : null}

      {queueSize > 0 ? (
        <Card className="border-slate-400">
          <div className="flex items-center justify-between gap-3">
            <div>
              <PendingBadge />
              <p className="mt-2 text-base text-slate-700">
                {queueSize} ta yozuv navbatda
                {failedCount > 0 ? `, ${failedCount} tasi yuborilmadi` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void retryNow()}
              className="min-h-[48px] shrink-0 rounded-xl border-2 border-slate-300 px-4 text-base font-semibold active:bg-slate-100"
            >
              Qayta yuborish
            </button>
          </div>
        </Card>
      ) : null}

      <ErrorBanner message={error} />

      {isOperator ? (
        <Card>
          <label className="mb-1 block text-base font-semibold text-slate-700">
            Holatni qidirish (ID yoki bemor telefoni)
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void runSearch()
            }}
          >
            <input
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg outline-none focus:border-sky-600"
              value={query}
              inputMode="search"
              placeholder="1 yoki +998911112233"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              className="min-h-[52px] shrink-0 rounded-xl bg-sky-700 px-5 text-base font-semibold text-white active:bg-sky-800"
            >
              {searching ? '…' : 'Qidirish'}
            </button>
          </form>
          {searchResults !== null ? (
            <button
              type="button"
              onClick={() => {
                setSearchResults(null)
                setQuery('')
              }}
              className="mt-2 min-h-[48px] text-base font-semibold text-sky-800 underline"
            >
              Qidiruvni tozalash
            </button>
          ) : null}
        </Card>
      ) : null}

      {searchResults !== null ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-700">Qidiruv natijasi ({searchResults.length})</h2>
          {searchResults.length === 0 ? (
            <Card>
              <p className="text-base text-slate-600">Holat topilmadi. ID yoki telefonni tekshiring.</p>
            </Card>
          ) : null}
          {searchResults.map((item) => (
            <CaseRow key={item.case_id} item={item} queued={queuedByCase.get(item.case_id) ?? 0} showAttach />
          ))}
        </section>
      ) : (
        <section className="space-y-3">
          {(pendingCases ?? []).map((pending) => (
            <Link
              key={pending.localId}
              to={`/case/${pending.localId}`}
              className="block rounded-2xl border-2 border-dashed border-slate-400 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{pending.patient.full_name}</div>
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
          ))}

          <h2 className="text-lg font-bold text-slate-700">
            Bugungi holatlar ({todays.length})
          </h2>
          {loading ? <Card><p className="text-base text-slate-600">Yuklanmoqda…</p></Card> : null}
          {!loading && visible.length === 0 && (pendingCases?.length ?? 0) === 0 ? (
            <Card>
              <p className="text-base text-slate-600">
                Bugun holat yoʻq. “+ Yangi holat” tugmasi bilan boshlang.
              </p>
            </Card>
          ) : null}
          {visible.map((item) => (
            <CaseRow key={item.case_id} item={item} queued={queuedByCase.get(item.case_id) ?? 0} showAttach={isOperator} />
          ))}
          {older.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowOlder((v) => !v)}
              className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white text-base font-semibold text-slate-700"
            >
              {showOlder ? 'Faqat bugungisi' : `Avvalgi kunlar (${older.length})`}
            </button>
          ) : null}
        </section>
      )}
    </Screen>
  )
}

function CaseRow({
  item,
  queued,
  showAttach,
}: {
  item: CaseListItem
  queued: number
  showAttach?: boolean
}) {
  const remaining = item.stroke?.remaining_min ?? null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Link to={`/case/${item.case_id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <ZoneBadge zone={item.zone} />
          <span className="text-sm text-slate-500">#{item.case_id} · {clockTime(item.created_at)}</span>
        </div>
        <div className="mt-2 text-lg font-bold text-slate-900">
          {item.age ? `${item.age} yosh` : 'Yosh nomaʼlum'} · {sexLabel(item.sex)}
        </div>
        {item.summary ? <p className="mt-1 text-base text-slate-700">{item.summary}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">{statusLabel(item.status)}</span>
          {item.specialist_type ? (
            <span className="rounded-lg bg-slate-100 px-2 py-1">{specialistLabel(item.specialist_type)}</span>
          ) : null}
          {item.has_decision ? (
            <span className="rounded-lg bg-green-100 px-2 py-1 font-semibold text-green-900">
              Mutaxassis javob berdi
            </span>
          ) : null}
          {remaining != null ? (
            <span className="rounded-lg bg-slate-100 px-2 py-1">Oyna: {humanMinutes(remaining)}</span>
          ) : null}
          {queued > 0 ? <PendingBadge /> : null}
        </div>
      </Link>
      {showAttach ? (
        <div className="border-t border-slate-200 p-3">
          <Link
            to={`/case/${item.case_id}/upload`}
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-sky-700 px-4 text-base font-semibold text-white"
          >
            KT / rentgen biriktirish
          </Link>
        </div>
      ) : null}
    </div>
  )
}
