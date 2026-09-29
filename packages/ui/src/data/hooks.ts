import type { AnyEvent, Health, Session, Settings } from '@gnomeola/protocol'
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { NotesFeed, type NotesFeedState } from './notes.ts'
import { QaFeed, type QaFeedState } from './qa.ts'
import type { Connection, SessionStore } from './store.ts'
import { TranscriptFeed, type TranscriptFeedState } from './transcript.ts'

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

export function useSettings(): Settings | null {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().settings)
}

export function useHealth(): Health | null {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().health)
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

/** One session's transcript, loaded and then kept live. A new feed per session id. */
export function useTranscriptFeed(sessionId: string): TranscriptFeedState {
  const store = useStore()
  const feed = useMemo(
    () =>
      new TranscriptFeed(sessionId, {
        load: (id, signal) => store.api.transcript(id, signal),
        onEvent: (l) => store.onEvent(l),
      }),
    [store, sessionId],
  )
  useEffect(() => {
    feed.start()
    return () => feed.dispose()
  }, [feed])
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot)
}

/** One session's Q&A: history, live messages, and `feed.ask` for this window's own questions. */
export function useQaFeed(sessionId: string): { state: QaFeedState; feed: QaFeed } {
  const store = useStore()
  const feed = useMemo(
    () =>
      new QaFeed(sessionId, {
        history: (id, signal) => store.api.qaHistory(id, signal),
        onEvent: (l) => store.onEvent(l),
        ask: (body, signal) => store.api.ask(body, signal),
      }),
    [store, sessionId],
  )
  useEffect(() => {
    feed.start()
    return () => feed.dispose()
  }, [feed])
  return { state: useSyncExternalStore(feed.subscribe, feed.getSnapshot), feed }
}

/** One session's notes: draft + autosave, enhancement, review. A new feed per session id. */
export function useNotesFeed(sessionId: string): { state: NotesFeedState; feed: NotesFeed } {
  const store = useStore()
  const feed = useMemo(
    () =>
      new NotesFeed(sessionId, {
        load: (id, signal) => store.api.notes(id, signal),
        put: (id, body) => store.api.putNotes(id, body),
        enhance: (id, body, signal) => store.api.enhanceNotes(id, body, signal),
        merge: (id, body) => store.api.mergeNotes(id, body),
        templates: (id, signal) => store.api.templates(id, signal),
        onEvent: (l) => store.onEvent(l),
      }),
    [store, sessionId],
  )
  useEffect(() => {
    feed.start()
    return () => {
      // save what was typed before leaving the session, then let go
      void feed.flush().finally(() => feed.dispose())
    }
  }, [feed])
  return { state: useSyncExternalStore(feed.subscribe, feed.getSnapshot), feed }
}
