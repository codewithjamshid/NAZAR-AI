// Zone styling, kept in step with the specialist panel (specialist-panel/src/lib/zone.ts):
// the same red / amber / green / slate hues, so both apps read as one product.
// TZ §12: a zone is never colour alone — every place that uses these classes
// also prints the zone word (see zoneLabel in labels.ts).
//
// Text colour is chosen per hue for daylight contrast: amber carries dark text,
// green uses the 700 shade so white text stays readable.

import type { Zone } from '../api/types'

export interface ZoneStyle {
  /** Solid badge: background + text. */
  badge: string
  /** The big result block on N6. */
  block: string
  /** Thin colour bar on list rows. */
  bar: string
  /** Tinted surface for secondary emphasis. */
  soft: string
  /** Coloured text on a white surface. */
  text: string
}

const STYLES: Record<Zone | 'none', ZoneStyle> = {
  red: {
    badge: 'bg-red-600 text-white',
    block: 'bg-red-600 text-white',
    bar: 'bg-red-600',
    soft: 'bg-red-50 text-red-900 ring-red-200',
    text: 'text-red-700',
  },
  yellow: {
    badge: 'bg-amber-500 text-slate-950',
    block: 'bg-amber-500 text-slate-950',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-950 ring-amber-200',
    text: 'text-amber-800',
  },
  green: {
    badge: 'bg-green-700 text-white',
    block: 'bg-green-700 text-white',
    bar: 'bg-green-600',
    soft: 'bg-green-50 text-green-900 ring-green-200',
    text: 'text-green-800',
  },
  none: {
    badge: 'bg-slate-500 text-white',
    block: 'bg-slate-600 text-white',
    bar: 'bg-slate-400',
    soft: 'bg-slate-50 text-slate-800 ring-slate-200',
    text: 'text-slate-700',
  },
}

export function zoneStyle(zone: Zone | null | undefined): ZoneStyle {
  return STYLES[zone ?? 'none'] ?? STYLES.none
}
