import { useEffect, useState } from 'react'

// React hooks shared by the window's screens.

/** The current time, refreshed every `everyMs` — for "5 min ago" labels that must keep moving. */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(h)
  }, [everyMs])
  return now
}
