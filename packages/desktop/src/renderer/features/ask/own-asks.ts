import { createStore } from 'zustand/vanilla'
import type { OwnAsk } from './ask-stream.ts'

// This window's own questions, per session pane, outside React state: the Ask pane unmounts when
// another tab is shown (following a citation does exactly that), and a question still streaming — or
// a cross-meeting answer, which no session history holds — must be there when it comes back. Lossy
// like the rest of the ephemeral state: nothing here survives a reload.

export const ownAsks = createStore<{ bySession: Record<string, readonly OwnAsk[]> }>(() => ({
  bySession: {},
}))

const controllers = new Map<string, AbortController>()

export function addOwnAsk(sessionId: string, ask: OwnAsk): AbortSignal {
  ownAsks.setState((s) => ({
    bySession: { ...s.bySession, [sessionId]: [...(s.bySession[sessionId] ?? []), ask] },
  }))
  const ac = new AbortController()
  controllers.set(ask.localId, ac)
  return ac.signal
}

export function patchOwnAsk(sessionId: string, localId: string, patch: Partial<OwnAsk>): void {
  ownAsks.setState((s) => ({
    bySession: {
      ...s.bySession,
      [sessionId]: (s.bySession[sessionId] ?? []).map((o) =>
        o.localId === localId ? { ...o, ...patch } : o,
      ),
    },
  }))
}

export function finishOwnAsk(localId: string): void {
  controllers.delete(localId)
}

/** Stop a question that is still streaming. */
export function stopOwnAsk(localId: string): void {
  controllers.get(localId)?.abort()
  controllers.delete(localId)
}
