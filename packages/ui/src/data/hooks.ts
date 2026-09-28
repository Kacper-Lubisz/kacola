import type { AnyEvent, Session } from '@gnomeola/protocol'
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Connection, SessionStore } from './store.ts'

// React bindings for SessionStore. Components never touch the protocol client directly.

const StoreContext = createContext<SessionStore | null>(null)

export function StoreProvider({ store, children }: { store: SessionStore; children?: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children)
}

export function useStore(): SessionStore {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore() outside <StoreProvider>')
  return s
}

/** Every session, newest first. Re-renders only when the list actually changes. */
export function useSessions(): readonly Session[] {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().sessions.ordered)
}

export function useSession(id: string | null | undefined): Session | undefined {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () =>
    id ? store.getSnapshot().sessions.byId.get(id) : undefined,
  )
}

export function useConnection(): Connection {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().connection)
}

/**
 * Subscribe to the raw event stream (durable and ephemeral). The handler may change every render;
 * the subscription does not.
 */
export function useEvents(handler: (e: AnyEvent) => void): void {
  const store = useStore()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => store.onEvent((e) => ref.current(e)), [store])
}

/** The current time, refreshed every `everyMs` — for "5 min ago" labels that must keep moving. */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(h)
  }, [everyMs])
  return now
}
