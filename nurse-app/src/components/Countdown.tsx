// Thrombolysis window timer (F-14 on the panel, N6 here). Thresholds come from
// GET /meta (rules/triage.yaml) — nothing about 4.5 hours is written here.

import { useEffect, useState } from 'react'
import type { Meta } from '../api/types'
import { clockCountdown, humanMinutes } from '../lib/time'

export type WindowState = 'open' | 'warning' | 'closed'

const STATE_STYLE: Record<WindowState, string> = {
  open: 'bg-green-700 text-white',
  warning: 'bg-amber-400 text-slate-900',
  closed: 'bg-red-700 text-white',
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

  return (
    <div className={`rounded-2xl px-4 py-3 ${STATE_STYLE[state]}`}>
      <div className="text-sm font-semibold uppercase tracking-wide opacity-90">
        Trombolizis oynasi — {STATE_WORD[state]}
      </div>
      <div className="mt-1 font-mono text-4xl font-bold tabular-nums">
        {remainingSec > 0 ? clockCountdown(remainingSec) : '0:00:00'}
      </div>
      <div className="mt-1 text-base">
        {remainingSec > 0
          ? `${humanMinutes(remainingSec / 60)} qoldi`
          : 'Vaqt oynasi yopildi — baribir zudlik bilan mutaxassisga yuboring'}
        {' · '}
        simptomdan {humanMinutes(Math.max(0, elapsedMin))} oʻtdi
      </div>
    </div>
  )
}
