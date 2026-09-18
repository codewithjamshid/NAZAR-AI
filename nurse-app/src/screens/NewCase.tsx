// N3 Yangi holat (F-01) — five fields and a "Boshlash" button.
// Symptom onset has quick picks; "Uygʻonganda" asks for the last-seen-well time,
// which is what actually gets sent as symptom_onset_at.

import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, Moon, PencilLine, TimerReset, UserRound } from 'lucide-react'
import { NetworkError, api } from '../api/client'
import type { Sex } from '../api/types'
import {
  Button, Card, CardTitle, ChoiceButton, ErrorBanner, FOOTER_ACTION, Field, FieldLabel, Screen, Spinner,
} from '../components/ui'
import type { Icon } from '../components/ui'
import { createPendingCase } from '../offline/db'
import { clockTime, fromLocalTimeInput, isoMinutesAgo, isoNow, toLocalTimeInput } from '../lib/time'
import { useApp } from '../state/AppContext'

type OnsetMode = 'now' | 'hour' | 'wakeup' | 'custom'

const ONSET_OPTIONS: { mode: OnsetMode; label: string; icon: Icon }[] = [
  { mode: 'now', label: 'Hozir', icon: Clock },
  { mode: 'hour', label: '1 soat oldin', icon: TimerReset },
  { mode: 'wakeup', label: 'Uygʻonganda', icon: Moon },
  { mode: 'custom', label: 'Boshqa vaqt', icon: PencilLine },
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

  // What will be sent, in words, so the nurse can check it before "Boshlash".
  const onsetPreview = onsetIso()

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
      footerNote="Keyingi qadam: anamnez va BE-FAST"
      footer={
        <Button type="submit" form="new-case" disabled={busy} className={FOOTER_ACTION}>
          {busy ? <Spinner /> : null}
          {busy ? 'Saqlanmoqda…' : 'Boshlash'}
          {!busy ? <ArrowRight className="h-5 w-5" aria-hidden="true" /> : null}
        </Button>
      }
    >
      <form id="new-case" onSubmit={submit} className="space-y-4 sm:space-y-5" noValidate>
        <ErrorBanner message={error} />

        <Card>
          <CardTitle icon={UserRound}>Bemor</CardTitle>
          <div className="grid gap-4 @xl:grid-cols-2 @xl:gap-5">
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
            <div role="group" aria-label="Jins">
              <FieldLabel>Jins</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                {(['male', 'female'] as Sex[]).map((option) => (
                  <ChoiceButton key={option} pressed={sex === option} onClick={() => setSex(option)}>
                    {option === 'male' ? 'Erkak' : 'Ayol'}
                  </ChoiceButton>
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
          </div>
        </Card>

        <Card>
          <CardTitle icon={Clock}>Simptom qachon boshlandi?</CardTitle>
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
            {ONSET_OPTIONS.map((option) => {
              const OptionIcon = option.icon
              return (
                <ChoiceButton
                  key={option.mode}
                  pressed={onsetMode === option.mode}
                  size="md"
                  stacked
                  onClick={() => {
                    setOnsetMode(option.mode)
                    if (option.mode === 'custom' || option.mode === 'wakeup') {
                      setOnsetTime(toLocalTimeInput(isoNow()))
                    }
                  }}
                >
                  <OptionIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {option.label}
                </ChoiceButton>
              )
            })}
          </div>

          {onsetMode === 'wakeup' ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="mb-3 text-base text-amber-950">
                Uyqudan keyin boshlangan boʻlsa, vaqt oynasi <b>oxirgi marta sogʻlom koʻrilgan</b> paytdan
                sanaladi. Bemor kecha soat nechada yotgan?
              </p>
              <div className="max-w-xs">
                <Field
                  label="Oxirgi marta sogʻlom koʻrilgan vaqt"
                  type="time"
                  value={onsetTime}
                  onChange={(e) => setOnsetTime(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}

          {onsetMode === 'custom' ? (
            <div className="mt-4 max-w-xs">
              <Field
                label="Simptom boshlangan vaqt"
                type="time"
                value={onsetTime}
                onChange={(e) => setOnsetTime(e.target.value)}
                hint="Masalan 07:40. Kelajakdagi vaqt kechagi kun deb olinadi."
                required
              />
            </div>
          ) : null}

          <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-base text-slate-600">
            <Clock className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            {onsetPreview ? (
              <span>
                Vaqt oynasi shu paytdan sanaladi:{' '}
                <b className="text-slate-900 tabular-nums">{clockTime(onsetPreview)}</b>
              </span>
            ) : (
              <span>Vaqtni kiriting</span>
            )}
          </p>
        </Card>
      </form>
    </Screen>
  )
}
