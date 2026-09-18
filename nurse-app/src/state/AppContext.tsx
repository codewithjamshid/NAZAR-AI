// Session, facility name and the clinical constants from GET /meta.
// Meta is cached in localStorage so BE-FAST scoring still works offline —
// the numbers always come from the server, never from the screens.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, clearSession, getToken, readStoredUser, setSession, setUnauthorizedHandler } from '../api/client'
import type { Meta, User } from '../api/types'

const META_KEY = 'nazar.meta'
const FACILITY_KEY = 'nazar.facility'

interface AppState {
  user: User | null
  meta: Meta | null
  facilityName: string | null
  online: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
  disclaimer: string
}

const FALLBACK_DISCLAIMER = 'Dastlabki tahlil. Shifokor tasdigʻi talab qilinadi.'

const AppContext = createContext<AppState | null>(null)

function readCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCached(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? readStoredUser<User>() : null))
  const [meta, setMeta] = useState<Meta | null>(() => readCached<Meta>(META_KEY))
  const [facilityName, setFacilityName] = useState<string | null>(() => readCached<string>(FACILITY_KEY))
  const [online, setOnline] = useState<boolean>(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  // The cached facility name belongs to the previous user; drop it on a new login.
  const forgetFacility = useCallback(() => {
    setFacilityName(null)
    try {
      localStorage.removeItem(FACILITY_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Refresh the clinical constants and the facility name whenever there is a session.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const fresh = await api.meta()
        if (cancelled) return
        setMeta(fresh)
        writeCached(META_KEY, fresh)
      } catch {
        /* offline: the cached copy stays in use */
      }
      try {
        const list = await api.facilities()
        if (cancelled) return
        const own = list.find((item) => item.id === user.facility_id)
        if (own) {
          setFacilityName(own.name)
          writeCached(FACILITY_KEY, own.name)
        }
      } catch {
        /* offline: keep the cached name */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const login = useCallback(async (phone: string, password: string) => {
    const result = await api.login(phone, password)
    setSession(result.access_token, result.user)
    forgetFacility()
    setUser(result.user)
  }, [forgetFacility])

  const value = useMemo<AppState>(
    () => ({
      user,
      meta,
      facilityName,
      online,
      login,
      logout,
      disclaimer: meta?.disclaimer ?? FALLBACK_DISCLAIMER,
    }),
    [user, meta, facilityName, online, login, logout],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
