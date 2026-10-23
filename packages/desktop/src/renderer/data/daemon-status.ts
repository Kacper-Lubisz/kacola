import { useEffect, useState } from 'react'
import type { DaemonStatus } from '../../shared/bridge.ts'
import type { Connection } from './ephemeral.ts'
import { useServices } from './services.tsx'

// What main's supervisor says about the daemon (starting, spawned, restarting, …), next to what the
// EventBridge sees (did a request get through). A request failing while the supervisor is still starting
// the daemon is not "can't reach kacola": that is every launch for the few seconds the daemon takes to
// come up, and every restart.

/** How long a start may go on before "not answering" is believed anyway (the supervisor allows 20 s). */
export const STARTUP_GRACE_MS = 30_000

/**
 * Before the window ever had data: is the daemon still coming up, or really not there? `sinceMs` is how
 * long the window has been trying. A daemon that keeps crashing (a second restart) is not coming up.
 */
export function startupState(
  c: Connection,
  daemon: DaemonStatus | null,
  sinceMs: number,
): 'starting' | 'unreachable' {
  if (c.kind !== 'unreachable') return 'starting'
  if (sinceMs > STARTUP_GRACE_MS) return 'unreachable'
  if (daemon === null) return 'starting'
  switch (daemon.kind) {
    case 'stopped':
    case 'starting':
    // answering now: the EventBridge is told to try again at once
    case 'spawned':
    case 'attached':
      return 'starting'
    case 'restarting':
      return daemon.attempt < 2 ? 'starting' : 'unreachable'
    case 'unreachable':
      return 'unreachable'
  }
}

/** While the event stream is down: is the daemon restarting (expected), or was the connection lost? */
export function restarting(daemon: DaemonStatus | null): boolean {
  return daemon?.kind === 'starting' || daemon?.kind === 'restarting' || daemon?.kind === 'stopped'
}

/**
 * Keeps the store's `daemon` in step with main's supervisor, and the moment the daemon answers, has the
 * EventBridge try again instead of waiting out its retry delay. Mounted once, by the window.
 */
export function useDaemonStatusFeed(): void {
  const { bridge, events, store } = useServices()
  useEffect(() => {
    let alive = true
    const apply = (s: DaemonStatus) => {
      if (!alive) return
      store.setState({ daemon: s })
      if (s.kind === 'spawned' || s.kind === 'attached') events.retryNow()
    }
    const off = bridge.onDaemonStatus(apply)
    bridge.daemonStatus().then(apply, () => {})
    return () => {
      alive = false
      off()
    }
  }, [bridge, events, store])
}

/** `flag`, once it has held for `ms` (a stream that comes back within a second never shows a banner). */
export function useHeld(flag: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!flag) {
      setHeld(false)
      return
    }
    const t = setTimeout(() => setHeld(true), ms)
    return () => clearTimeout(t)
  }, [flag, ms])
  return flag && held
}
