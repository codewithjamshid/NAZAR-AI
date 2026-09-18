// Subscribes to a CSS media query. Used for the one layout decision CSS alone
// cannot make: whether the desktop shell (sidebar + list + detail) is mounted.

import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind `lg` (1024px): sidebar + master–detail from here up. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
