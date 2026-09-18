// Time helpers. The backend always sends ISO 8601 with a timezone.

export function isoNow(): string {
  return new Date().toISOString()
}

export function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

/** Local `HH:MM` for a datetime-local style input, from an ISO string. */
export function toLocalTimeInput(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** `HH:MM` typed for today (or yesterday, if that time is still in the future). */
export function fromLocalTimeInput(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1)
  return d.toISOString()
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

/** "3 soat 50 daqiqa" / "45 daqiqa" */
export function humanMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours === 0) return `${minutes} daqiqa`
  if (minutes === 0) return `${hours} soat`
  return `${hours} soat ${minutes} daqiqa`
}

/** "3:50" for the big countdown. */
export function clockCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
