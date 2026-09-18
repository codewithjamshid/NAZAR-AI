// N3 Yangi holat (F-01) — five fields and a "Boshlash" button.
// Symptom onset has quick picks; "Uygʻonganda" asks for the last-seen-well time,
// which is what actually gets sent as symptom_onset_at.

import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { NetworkError, api } from '../api/client'
import type { Sex } from '../api/types'
import { Button, Card, ErrorBanner, Field, Screen } from '../components/ui'
import { createPendingCase } from '../offline/db'
import { fromLocalTimeInput, isoMinutesAgo, isoNow, toLocalTimeInput } from '../lib/time'
import { useApp } from '../state/AppContext'

type OnsetMode = 'now' | 'hour' | 'wakeup' | 'custom'

const ONSET_OPTIONS: { mode: OnsetMode; label: string }[] = [
  { mode: 'now', label: 'Hozir' },
  { mode: 'hour', label: '1 soat oldin' },
  { mode: 'wakeup', label: 'Uygʻonganda' },
  { mode: 'custom', label: 'Boshqa vaqt' },
]

const CURRENT_YEAR = new Date().getFullYear()

/** The nurse may type an age (58) or a birth year (1968); both are accepted. */
function resolveBirthYear(raw: string): number | null {
  const value = Number(raw.trim())
  if (!Number.isFinite(value) || value <= 0) return null
  if (value >= 1900 && value <= CURRENT_YEAR) return Math.trunc(value)
  if (value <= 130) return CURRENT_YEAR - Math.trunc(value)
  return null
}

export function NewCaseScreen() {
  const navigate = useNavigate()
  const { facilityName } = useApp()

  const [fullName, setFullName] = useState('')
  const [ageOrYear, setAgeOrYear] = useState('')
  const [sex, setSex] = useState<Sex | null>(null)
  const [phone, setPhone] = useState('')
  const [onsetMode, setOnsetMode] = useState<OnsetMode>('now')
  const [onsetTime, setOnsetTime] = useState(() => toLocalTimeInput(isoNow()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const birthYear = useMemo(() => resolveBirthYear(ageOrYear), [ageOrYear])
  const needsTime = onsetMode === 'wakeup' || onsetMode === 'custom'

  function onsetIso(): string | null {
    if (onsetMode === 'now') return isoNow()
    if (onsetMode === 'hour') return isoMinutesAgo(60)
    return fromLocalTimeInput(onsetTime)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Bemor ismini kiriting')
    if (!birthYear) return setError('Yosh yoki tugʻilgan yilni toʻgʻri kiriting')
    if (!sex) return setError('Jinsni tanlang')
    const onset = onsetIso()
    if (needsTime && !onset) return setError('Vaqtni SS:DD koʻrinishida kiriting, masalan 07:40')

    const patient = {
      full_name: fullName.trim(),
      birth_year: birthYear,
      sex,
      phone: phone.trim() || null,
    }

    setBusy(true)
    try {
      const created = await api.createPatient(patient)
      const newCase = await api.createCase({ patient_id: created.id, symptom_onset_at: onset })
      navigate(`/case/${newCase.id}/anamnesis`, { replace: true })
    } catch (err) {
      if (err instanceof NetworkError) {
        // F-08: keep the case on the phone and carry on with the questionnaire.
        const localId = await createPendingCase(patient, onset)
        navigate(`/case/${localId}/anamnesis`, { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Holat ochilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      title="Yangi holat"
      subtitle={facilityName ?? undefined}
      back="/"
      footer={
        <Button type="submit" form="new-case" disabled={busy}>
          {busy ? 'Saqlanmoqda…' : 'Boshlash'}
        </Button>
      }
    >
      <form id="new-case" onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />

        <Card className="space-y-4">
          <Field
            label="Ism familiya"
            value={fullName}
            autoComplete="off"
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Bekmurod Aka"
            required
          />
          <Field
            label="Yosh yoki tugʻilgan yil"
            inputMode="numeric"
            value={ageOrYear}
            onChange={(e) => setAgeOrYear(e.target.value)}
            placeholder="58"
            hint={
              birthYear
                ? `Tugʻilgan yil: ${birthYear} · ${CURRENT_YEAR - birthYear} yosh`
                : 'Masalan 58 (yosh) yoki 1968 (yil)'
            }
          />
          <div>
            <span className="mb-1 block text-base font-semibold text-slate-700">Jins</span>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as Sex[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(option)}
                  aria-pressed={sex === option}
                  className={`min-h-[56px] rounded-xl border-2 text-lg font-semibold ${
                    sex === option
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {option === 'male' ? 'Erkak' : 'Ayol'}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Telefon (ixtiyoriy)"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998911112233"
          />
        </Card>

        <Card className="space-y-3">
          <span className="block text-base font-semibold text-slate-700">
            Simptom qachon boshlandi?
          </span>
          <div className="grid grid-cols-2 gap-3">
            {ONSET_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                onClick={() => {
                  setOnsetMode(option.mode)
                  if (option.mode === 'custom' || option.mode === 'wakeup') {
                    setOnsetTime(toLocalTimeInput(isoNow()))
                  }
                }}
                aria-pressed={onsetMode === option.mode}
                className={`min-h-[56px] rounded-xl border-2 px-2 text-base font-semibold ${
                  onsetMode === option.mode
                    ? 'border-sky-700 bg-sky-700 text-white'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {onsetMode === 'wakeup' ? (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <p className="mb-2 text-base text-amber-900">
                Uyqudan keyin boshlangan boʻlsa, vaqt oynasi <b>oxirgi marta sogʻlom koʻrilgan</b> paytdan
                sanaladi. Bemor kecha soat nechada yotgan?
              </p>
              <Field
                label="Oxirgi marta sogʻlom koʻrilgan vaqt"
                type="time"
                value={onsetTime}
                onChange={(e) => setOnsetTime(e.target.value)}
                required
              />
            </div>
          ) : null}

          {onsetMode === 'custom' ? (
            <Field
              label="Simptom boshlangan vaqt"
              type="time"
              value={onsetTime}
              onChange={(e) => setOnsetTime(e.target.value)}
              hint="Masalan 07:40. Kelajakdagi vaqt kechagi kun deb olinadi."
              required
            />
          ) : null}
        </Card>
      </form>
    </Screen>
  )
}
