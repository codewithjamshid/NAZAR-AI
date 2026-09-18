// Layout for the logged-in app.
//
//   < 1024px  one screen at a time (phone / tablet), each screen brings its own
//             app bar and sticky bottom action.
//   ≥ 1024px  desktop shell: sidebar | case list | selected case. The list stays
//             mounted, so an operator can search, attach a CT and read the
//             result without page hopping.

import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  CircleCheck, CloudUpload, Inbox, LayoutList, LogOut, Plus, RefreshCw, Wifi, WifiOff,
} from 'lucide-react'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { roleLabel } from '../lib/labels'
import { CaseListScreen } from '../screens/CaseList'
import { useApp } from '../state/AppContext'
import { LogoMark, Wordmark } from './Logo'
import { ButtonLink, EmptyState } from './ui'

export function AppShell() {
  const desktop = useIsDesktop()
  const location = useLocation()
  const detailRef = useRef<HTMLDivElement>(null)

  // A new screen starts at the top (BrowserRouter does not restore scroll).
  useEffect(() => {
    if (desktop) detailRef.current?.scrollTo({ top: 0 })
    else window.scrollTo({ top: 0 })
  }, [location.pathname, desktop])

  // Keyed by path so switching cases never shows the previous case's data.
  const outlet = <Outlet key={location.pathname} />

  if (!desktop) return outlet

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 xl:w-[380px]">
        <CaseListScreen variant="pane" />
      </div>
      <div ref={detailRef} className="min-w-0 flex-1 overflow-y-auto">
        {outlet}
      </div>
    </div>
  )
}

/** Index route: the list on phones, a "pick a case" panel next to the list on desktop. */
export function HomeRoute() {
  const desktop = useIsDesktop()
  const { user } = useApp()
  if (!desktop) return <CaseListScreen variant="page" />
  const nurse = user?.role !== 'operator'
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-card">
        <EmptyState
          icon={Inbox}
          title="Holatni tanlang"
          action={
            nurse ? (
              <ButtonLink to="/new" variant="primary">
                <Plus className="h-5 w-5" aria-hidden="true" />
                Yangi holat
              </ButtonLink>
            ) : null
          }
        >
          {nurse
            ? 'Chapdagi roʻyxatdan holatni oching yoki yangi bemor uchun holat yarating.'
            : 'Holatni ID yoki bemor telefoni orqali qidiring, keyin KT yoki rentgen biriktiring.'}
        </EmptyState>
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, facilityName, online, logout, meta } = useApp()
  const { queueSize, failedCount, retryNow } = useOfflineQueue()
  const { pathname } = useLocation()
  const nurse = user?.role !== 'operator'
  const casesActive = pathname === '/' || pathname.startsWith('/case/')

  const initials = (user?.full_name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-slate-900 text-slate-300 xl:w-64">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <LogoMark className="h-10 w-10 shrink-0" />
        <Wordmark subtitle={nurse ? 'Hamshira ilovasi' : 'Operator ilovasi'} />
      </div>

      <div className="mx-3 rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
        <div className="text-sm text-slate-400">Muassasa</div>
        <div className="mt-0.5 font-semibold leading-snug text-white">{facilityName ?? '—'}</div>
      </div>

      <nav className="mt-5 space-y-1 px-3" aria-label="Asosiy menyu">
        {nurse ? (
          <Link
            to="/new"
            className="mb-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-500"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Yangi holat
          </Link>
        ) : null}
        <Link
          to="/"
          aria-current={casesActive ? 'page' : undefined}
          className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 font-medium ${
            casesActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <LayoutList className="h-5 w-5" aria-hidden="true" />
          Holatlar
        </Link>
      </nav>

      <div className="mt-auto space-y-3 p-3">
        {/* F-08: connection and offline queue, always in view on desktop. */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <div className="flex items-center gap-2 font-medium text-white">
            {online ? (
              <Wifi className="h-5 w-5 text-green-400" aria-hidden="true" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-400" aria-hidden="true" />
            )}
            {online ? 'Onlayn' : 'Internet yoʻq'}
          </div>
          {queueSize > 0 ? (
            <>
              <p className="mt-2 flex items-start gap-2 text-sm text-slate-300">
                <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Yuborish kutilmoqda: {queueSize} ta yozuv
                  {failedCount > 0 ? `, ${failedCount} tasi yuborilmadi` : ''}
                </span>
              </p>
              <button
                type="button"
                onClick={() => void retryNow()}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-semibold text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Qayta yuborish
              </button>
            </>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Hammasi yuborilgan
            </p>
          )}
        </div>

        <div className="rounded-xl px-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-semibold break-words text-white">{user?.full_name}</div>
              <div className="text-sm text-slate-400">{roleLabel(user?.role)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Chiqish
          </button>
        </div>
        {meta?.rules_version ? (
          <p className="px-2 text-xs text-slate-500">Qoidalar: {meta.rules_version}</p>
        ) : null}
      </div>
    </aside>
  )
}
