// One uploaded study with its AI reading state (N5 and N6).

import { Brain, CircleCheck, CircleX, FileText, FlaskConical, Mic, ScanLine } from 'lucide-react'
import type { Study } from '../api/types'
import { STUDY_STATUS, STUDY_TYPE } from '../lib/labels'
import { clockTime } from '../lib/time'
import { Chip, Spinner } from './ui'
import type { Icon } from './ui'

const STUDY_ICON: Record<string, Icon> = {
  ct_head: Brain,
  cxr: ScanLine,
  lab_photo: FlaskConical,
  voice: Mic,
}

export function StudyStatus({ status }: { status: Study['status'] }) {
  const label = STUDY_STATUS[status] ?? status
  if (status === 'done') return <Chip tone="green" icon={CircleCheck}>{label}</Chip>
  if (status === 'failed') return <Chip tone="red" icon={CircleX}>{label}</Chip>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
      <Spinner className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export function StudyRow({ study }: { study: Study }) {
  const RowIcon = STUDY_ICON[study.type] ?? FileText
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <RowIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{STUDY_TYPE[study.type] ?? study.type}</div>
        <div className="text-sm text-slate-500 tabular-nums">{clockTime(study.uploaded_at)}</div>
      </div>
      <StudyStatus status={study.status} />
    </li>
  )
}
