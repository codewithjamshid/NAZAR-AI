// Thrombolysis window timer (F-14 on the panel, N6 here). Thresholds come from
// GET /meta (rules/triage.yaml) — nothing about 4.5 hours is written here.

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import type { Meta } from '../api/types'
import { clockCountdown, humanMinutes } from '../lib/time'

export type WindowState = 'open' | 'warning' | 'closed'

// Same tinted look as the specialist panel's StrokeTimer, so both screens
// show the window the same way.
const STATE_STYLE: Record<WindowState, { box: string; label: string; bar: string }> = {
  open: { box: 'border-green-600 bg-green-50', label: 'text-green-800', bar: 'bg-green-600' },
  warning: { box: 'border-amber-500 bg-amber-50', label: 'text-amber-900', bar: 'bg-amber-500' },
  closed: { box: 'border-red-600 bg-red-50', label: 'text-red-800', bar: 'bg-red-600' },
}

const STATE_WORD: Record<WindowState, string> = {
  open: 'OCHIQ',
  warning: 'YOPILISHGA OZ QOLDI',
  closed: 'YOPILDI',
}

export function windowState(elapsedMin: number, meta: Meta | null): WindowState {
  const warning = meta?.stroke_window.warning_min
  const limit = meta?.stroke_window.thrombolysis_min
  if (warning === undefined || limit === undefined) return 'open'
  if (elapsedMin < warning) return 'open'
  if (elapsedMin < limit) return 'warning'
  return 'closed'
}

interface Props {
  /** When the symptoms started — the countdown is live from this moment. */
  onsetAt: string | null
  /** Fallback: minutes left as the server computed them, with the moment it did. */
  fallbackMinutes: number | null
  fallbackFrom: string | null
  meta: Meta | null
}

export function Countdown({ onsetAt, fallbackMinutes, fallbackFrom, meta }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const limitMin = meta?.stroke_window.thrombolysis_min ?? null
  let elapsedMin: number
  let remainingSec: number

  if (onsetAt && limitMin !== null) {
    elapsedMin = (now - new Date(onsetAt).getTime()) / 60_000
    remainingSec = limitMin * 60 - elapsedMin * 60
  } else if (fallbackMinutes !== null && fallbackFrom) {
    const sinceComputed = (now - new Date(fallbackFrom).getTime()) / 1000
    remainingSec = fallbackMinutes * 60 - sinceComputed
    elapsedMin = limitMin !== null ? limitMin - remainingSec / 60 : 0
  } else {
    return null
  }

  const state = windowState(elapsedMin, meta)
  const style = STATE_STYLE[state]
  // Share of the window still left, for the bar. Only drawn when /meta gave the limit.
  const leftShare = limitMin ? Math.min(1, Math.max(0, remainingSec / (limitMin * 60))) : null

  return (
    <section className={`rounded-2xl border-2 p-4 sm:p-5 ${style.box}`} aria-label="Trombolizis oynasi">
      <div className={`flex items-center gap-2 text-base font-semibold ${style.label}`}>
        <Timer className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          Trombolizis oynasi — <span className="font-bold">{STATE_WORD[state]}</span>
        </span>
      </div>
      <div className="mt-2 text-5xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-6xl lg:text-5xl">
        {remainingSec > 0 ? clockCountdown(remainingSec) : '0:00:00'}
      </div>
      {leftShare !== null ? (
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-black/5 ring-inset">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${leftShare * 100}%` }} />
        </div>
      ) : null}
      <p className="mt-3 text-base text-slate-800">
        {remainingSec > 0
          ? `${humanMinutes(remainingSec / 60)} qoldi`
          : 'Vaqt oynasi yopildi — baribir zudlik bilan mutaxassisga yuboring'}
        {' · '}
        simptomdan {humanMinutes(Math.max(0, elapsedMin))} oʻtdi
      </p>
    </section>
  )
}
