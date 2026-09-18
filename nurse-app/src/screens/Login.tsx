// N1 Kirish — phone + password, then the facility name is shown on every screen.
// Phone / tablet: one centred card on the dark brand background.
// Desktop: brand panel on the left, the form on the right.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { CloudOff, LogIn, Route as RouteIcon, ShieldCheck, WifiOff } from 'lucide-react'
import { Button, ErrorBanner, Field, Spinner } from '../components/ui'
import type { Icon } from '../components/ui'
import { LogoMark, Wordmark } from '../components/Logo'
import { useApp } from '../state/AppContext'

const POINTS: { icon: Icon; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: 'AI birinchi oʻqiydi, shifokor tasdiqlaydi',
    text: 'Har bir natija mutaxassis qaroridan keyin yopiladi.',
  },
  {
    icon: RouteIcon,
    title: 'Zona va yoʻnalish bir qarashda',
    text: 'Qizil, sariq, yashil — qaysi mutaxassis va qayerga yuborish.',
  },
  {
    icon: CloudOff,
    title: 'Internet uzilsa ham ishlaydi',
    text: 'Holat qurilmada saqlanadi, ulanganda oʻzi yuboriladi.',
  },
]

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
    <div className="min-h-dvh bg-slate-900 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:bg-slate-100">
      {/* Brand panel: desktop only. */}
      <aside className="relative hidden overflow-hidden bg-slate-900 px-12 py-12 text-white lg:flex lg:flex-col xl:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-brand-600/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <Wordmark subtitle="Hamshira va operator ilovasi" />
        </div>
        <div className="relative my-auto max-w-lg py-12">
          <h1 className="text-4xl leading-tight font-bold tracking-tight xl:text-5xl">
            Chekka tumandagi bemor uchun tez triyaj
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            KT, rentgen, tahlil surati yoki ovoz — AI dastlabki xulosa beradi, viloyat mutaxassisi tasdiqlaydi.
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map((point) => {
              const PointIcon = point.icon
              return (
                <li key={point.title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <PointIcon className="h-5 w-5 text-brand-300" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{point.title}</div>
                    <div className="text-base text-slate-400">{point.text}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">Dastlabki tahlil tizimi. Shifokor tasdigʻi talab qilinadi.</p>
      </aside>

      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <LogoMark className="h-16 w-16" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">NAZAR AI</h1>
            <p className="mt-1 text-base text-slate-300">Hamshira ilovasi</p>
          </div>

          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl bg-white p-5 shadow-raised sm:p-8 lg:border lg:border-slate-200 lg:shadow-card"
          >
            <div className="hidden lg:block">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tizimga kirish</h2>
              <p className="mt-1 text-base text-slate-500">Telefon raqamingiz va parolingizni kiriting.</p>
            </div>
            <ErrorBanner message={error} />
            {!online ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
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
              {busy ? <Spinner /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
              {busy ? 'Tekshirilmoqda…' : 'Kirish'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400 lg:hidden">
            Dastlabki tahlil tizimi. Shifokor tasdigʻi talab qilinadi.
          </p>
        </div>
      </main>
    </div>
  )
}
