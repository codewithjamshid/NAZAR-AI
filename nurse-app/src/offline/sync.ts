// Replays the offline queue. Runs on the `online` event, on a slow timer and
// from the manual "Qayta yuborish" button.

import { ApiError, NetworkError, api, getToken } from '../api/client'
import type { AnamnesisPayload } from '../api/types'
import { db, type OutboxItem, type PendingCase } from './db'

type Listener = () => void
const listeners = new Set<Listener>()
let running = false

export function onSynced(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

async function sendOutboxItem(item: OutboxItem, caseId: number): Promise<void> {
  switch (item.kind) {
    case 'anamnesis':
      await api.saveAnamnesis(caseId, item.payload as AnamnesisPayload)
      return
    case 'labs':
      await api.confirmLabs(caseId, item.payload as Record<string, number>)
      return
    case 'close':
      await api.closeCase(caseId)
      return
    case 'study':
      if (!item.blob) throw new ApiError(400, 'Fayl topilmadi')
      await api.uploadStudy(caseId, item.studyType ?? 'cxr', item.blob, item.fileName ?? 'file')
      return
    case 'voice':
      if (!item.blob) throw new ApiError(400, 'Ovoz fayli topilmadi')
      await api.uploadVoice(caseId, item.blob, item.fileName ?? 'voice.webm')
      return
  }
}

/** Sends one queued item. Returns false when the device is still offline. */
async function flushItem(item: OutboxItem, caseId: number): Promise<boolean> {
  if (item.id === undefined) return true
  await db.outbox.update(item.id, { status: 'sending' })
  try {
    await sendOutboxItem(item, caseId)
    await db.outbox.delete(item.id)
    return true
  } catch (err) {
    if (err instanceof NetworkError) {
      await db.outbox.update(item.id, { status: 'queued' })
      return false
    }
    await db.outbox.update(item.id, {
      status: 'failed',
      lastError: err instanceof Error ? err.message : 'Yuborilmadi',
    })
    return true
  }
}

/** Creates the patient + case that were captured offline, then its queued items. */
async function flushPendingCase(pending: PendingCase): Promise<boolean> {
  await db.pendingCases.update(pending.localId, { status: 'sending' })
  let caseId: number
  try {
    const patient = await api.createPatient(pending.patient)
    const created = await api.createCase({
      patient_id: patient.id,
      symptom_onset_at: pending.symptom_onset_at,
    })
    caseId = created.id
    if (pending.anamnesis) await api.saveAnamnesis(caseId, pending.anamnesis)
  } catch (err) {
    if (err instanceof NetworkError) {
      await db.pendingCases.update(pending.localId, { status: 'queued' })
      return false
    }
    await db.pendingCases.update(pending.localId, {
      status: 'failed',
      lastError: err instanceof Error ? err.message : 'Yuborilmadi',
    })
    return true
  }

  const attached = await db.outbox.where('localId').equals(pending.localId).sortBy('id')
  for (const item of attached) {
    const online = await flushItem(item, caseId)
    if (!online) {
      // Keep the case row so the rest of its uploads follow later, but remember
      // the server id so we never create the patient twice.
      await db.outbox.where('localId').equals(pending.localId).modify({ caseId, localId: undefined })
      await db.pendingCases.delete(pending.localId)
      return false
    }
  }
  await db.pendingCases.delete(pending.localId)
  return true
}

export async function flush(): Promise<void> {
  if (running) return
  if (!getToken()) return
  running = true
  try {
    const cases = await db.pendingCases.where('status').equals('queued').sortBy('createdAt')
    for (const pending of cases) {
      const online = await flushPendingCase(pending)
      if (!online) return
    }
    const items = await db.outbox.where('status').equals('queued').sortBy('id')
    for (const item of items) {
      if (item.caseId === null || item.caseId === undefined) continue
      const online = await flushItem(item, item.caseId)
      if (!online) return
    }
  } finally {
    running = false
    notify()
  }
}

let started = false

export function startSync(): void {
  if (started) return
  started = true
  window.addEventListener('online', () => void flush())
  window.setInterval(() => {
    if (navigator.onLine) void flush()
  }, 20_000)
  if (navigator.onLine) void flush()
}
