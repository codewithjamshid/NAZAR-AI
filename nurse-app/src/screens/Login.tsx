// N1 Kirish — phone + password, then the facility name is shown on every screen.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, ErrorBanner, Field } from '../components/ui'
import { useApp } from '../state/AppContext'

export function LoginScreen() {
  const { login, online } = useApp()
  const [phone, setPhone] = useState('+998')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(phone.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kirishda xatolik')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-slate-900 px-5 py-8">
      <div className="mb-8 text-center text-white">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800">
          <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
            <ellipse cx="32" cy="28" rx="20" ry="13" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="32" cy="28" r="7" fill="#dc2626" />
            <circle cx="21" cy="52" r="3" fill="#dc2626" />
            <circle cx="32" cy="52" r="3" fill="#eab308" />
            <circle cx="43" cy="52" r="3" fill="#16a34a" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold">NAZAR AI</h1>
        <p className="mt-1 text-base text-slate-300">Hamshira ilovasi</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-lg">
        <ErrorBanner message={error} />
        {!online ? (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
            Internet yoʻq. Kirish uchun ulanish kerak.
          </div>
        ) : null}
        <Field
          label="Telefon raqami"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998901000001"
          required
        />
        <Field
          label="Parol"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy || !online}>
          {busy ? 'Tekshirilmoqda…' : 'Kirish'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Dastlabki tahlil tizimi. Shifokor tasdigʻi talab qilinadi.
      </p>
    </div>
  )
}
