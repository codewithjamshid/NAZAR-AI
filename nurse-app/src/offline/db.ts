// Offline queue (F-08). Everything the nurse does without a connection lands in
// IndexedDB and is replayed when the phone comes back online.
//
// Two tables, deliberately flat:
//   pendingCases - a case that does not exist on the server yet (patient + case + anamnesis)
//   outbox       - one POST waiting to be sent, either for a server case or for a pending one

import Dexie, { type Table } from 'dexie'
import type { AnamnesisPayload, Sex, StudyType } from '../api/types'

export type QueueStatus = 'queued' | 'sending' | 'failed'

export interface PendingPatient {
  full_name: string
  birth_year: number
  sex: Sex
  phone?: string | null
  district?: string | null
}

export interface PendingCase {
  localId: string
  patient: PendingPatient
  symptom_onset_at: string | null
  anamnesis: AnamnesisPayload | null
  createdAt: string
  status: QueueStatus
  lastError?: string
}

export type OutboxKind = 'anamnesis' | 'labs' | 'study' | 'voice' | 'close'

export interface OutboxItem {
  id?: number
  kind: OutboxKind
  caseId: number | null
  localId?: string
  payload?: unknown
  studyType?: StudyType
  blob?: Blob
  fileName?: string
  createdAt: string
  status: QueueStatus
  lastError?: string
}

class NazarDB extends Dexie {
  pendingCases!: Table<PendingCase, string>
  outbox!: Table<OutboxItem, number>

  constructor() {
    super('nazar-nurse')
    this.version(1).stores({
      pendingCases: 'localId, status, createdAt',
      outbox: '++id, status, caseId, localId, createdAt',
    })
  }
}

export const db = new NazarDB()

export function newLocalId(): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `local-${Date.now().toString(36)}-${random}`
}

export function isLocalId(id: string): boolean {
  return id.startsWith('local-')
}

export async function createPendingCase(
  patient: PendingPatient,
  symptomOnsetAt: string | null,
): Promise<string> {
  const localId = newLocalId()
  await db.pendingCases.add({
    localId,
    patient,
    symptom_onset_at: symptomOnsetAt,
    anamnesis: null,
    createdAt: new Date().toISOString(),
    status: 'queued',
  })
  return localId
}

export async function savePendingAnamnesis(
  localId: string,
  payload: AnamnesisPayload,
): Promise<void> {
  await db.pendingCases.update(localId, { anamnesis: payload, status: 'queued', lastError: undefined })
}

export async function enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'status'>): Promise<number> {
  return db.outbox.add({ ...item, createdAt: new Date().toISOString(), status: 'queued' })
}

/** How many items are still waiting, for the "Yuborish kutilmoqda" badge. */
export async function pendingCountForCase(caseId: number): Promise<number> {
  return db.outbox.where('caseId').equals(caseId).filter((i) => i.status !== 'sending').count()
}

export async function retryAll(): Promise<void> {
  await db.outbox.where('status').equals('failed').modify({ status: 'queued', lastError: undefined })
  await db.pendingCases.where('status').equals('failed').modify({ status: 'queued', lastError: undefined })
}

export async function discardPendingCase(localId: string): Promise<void> {
  await db.outbox.where('localId').equals(localId).delete()
  await db.pendingCases.delete(localId)
}
