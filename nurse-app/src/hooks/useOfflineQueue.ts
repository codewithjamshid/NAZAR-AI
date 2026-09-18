// Live view of the offline queue (F-08) for the sidebar, the case list and
// the "Qayta yuborish" buttons. Reads Dexie only; sending stays in offline/sync.

import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, retryAll } from '../offline/db'
import { flush } from '../offline/sync'

export function useOfflineQueue() {
  const pendingCases = useLiveQuery(() => db.pendingCases.orderBy('createdAt').reverse().toArray(), [], [])
  const outbox = useLiveQuery(() => db.outbox.toArray(), [], [])

  const queuedByCase = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of outbox ?? []) {
      if (item.caseId != null) map.set(item.caseId, (map.get(item.caseId) ?? 0) + 1)
    }
    return map
  }, [outbox])

  const queueSize = (pendingCases?.length ?? 0) + (outbox?.length ?? 0)
  const failedCount =
    (pendingCases ?? []).filter((c) => c.status === 'failed').length +
    (outbox ?? []).filter((i) => i.status === 'failed').length

  const retryNow = useCallback(async () => {
    await retryAll()
    await flush()
  }, [])

  return {
    pendingCases: pendingCases ?? [],
    queuedByCase,
    queueSize,
    failedCount,
    retryNow,
  }
}
