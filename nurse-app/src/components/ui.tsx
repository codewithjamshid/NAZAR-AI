// Shared building blocks. Touch targets stay at 56px, well over the 48px floor.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Zone } from '../api/types'
import { ZONE_BADGE, zoneLabel } from '../lib/labels'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-700 text-white active:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500',
  secondary: 'bg-white text-slate-900 border-2 border-slate-300 active:bg-slate-100',
  danger: 'bg-red-600 text-white active:bg-red-700',
  ghost: 'bg-transparent text-sky-800 underline',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-[56px] w-full rounded-xl px-4 py-3 text-lg font-semibold transition ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-base font-semibold text-slate-700">{label}</span>
      <input
        className={`w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg outline-none focus:border-sky-600 ${className}`}
        {...rest}
      />
      {hint ? <span className="mt-1 block text-sm text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function ZoneBadge({ zone, className = '' }: { zone: Zone | null; className?: string }) {
  if (!zone) {
    return (
      <span
        className={`inline-block rounded-lg border-2 border-slate-400 bg-slate-200 px-3 py-1 text-base font-bold text-slate-700 ${className}`}
      >
        ZONA YOʻQ
      </span>
    )
  }
  return (
    <span
      className={`inline-block rounded-lg border-2 px-3 py-1 text-base font-bold uppercase ${ZONE_BADGE[zone]} ${className}`}
    >
      {zoneLabel(zone)}
    </span>
  )
}

/** F-08: anything still sitting in the offline queue says so, in words. */
export function PendingBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border-2 border-slate-400 bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
      Yuborish kutilmoqda
    </span>
  )
}

/** The permanent line next to every AI result (TZ §12). */
export function Disclaimer({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p
      className={`rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ${className}`}
      role="note"
    >
      {text}
    </p>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">
      {message}
    </div>
  )
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
      {children}
    </div>
  )
}

export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  back?: string | number
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          {back !== undefined ? (
            <button
              type="button"
              aria-label="Orqaga"
              onClick={() => (typeof back === 'number' ? navigate(back) : navigate(back))}
              className="-ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white active:bg-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            {subtitle ? <div className="truncate text-sm text-slate-300">{subtitle}</div> : null}
          </div>
          {right}
        </div>
      </header>
      <main className="flex-1 space-y-4 px-4 py-4 pb-6">{children}</main>
      {footer ? (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
