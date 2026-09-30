import type { AskStreamEvent, BodyIn, EnhanceStreamEvent } from '@gnomeola/protocol'
import { enhanceEvents } from '@gnomeola/protocol'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { EphemeralStore, StreamState } from './ephemeral.ts'
import type { Api } from './queries.ts'

// Streaming calls (ask, enhance) as async iterators folded into the ephemeral store: tokens land in
// `streams[localId]` as they arrive, and the durable result (qa.message, note.version) reaches the
// query cache through the EventBridge like any other change — the stream never writes server state.

type Terminal = { code: string; message: string }

async function pump<E extends { type: string }>(
  store: EphemeralStore,
  localId: string,
  events: AsyncIterable<E>,
  on: { delta: (e: E) => string | null; done: (e: E) => boolean; error: (e: E) => Terminal | null },
): Promise<StreamState> {
  const set = (s: StreamState) => store.setState((st) => ({ streams: { ...st.streams, [localId]: s } }))
  let text = ''
  set({ text, status: 'streaming' })
  try {
    for await (const e of events) {
      const d = on.delta(e)
      if (d !== null) {
        text += d
        set({ text, status: 'streaming' })
        continue
      }
      const err = on.error(e)
      if (err) {
        const s: StreamState = { text, status: 'error', error: err }
        set(s)
        return s
      }
      if (on.done(e)) break
    }
    const s: StreamState = { text, status: 'done' }
    set(s)
    return s
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string }
    const s: StreamState = {
      text,
      status: 'error',
      error: {
        code: e.name === 'AbortError' ? 'aborted' : (e.code ?? 'internal'),
        message: e.message ?? String(err),
      },
    }
    set(s)
    return s
  }
}

export function runAsk(
  api: Pick<Api, 'ask'>,
  store: EphemeralStore,
  localId: string,
  body: BodyIn<'ask'>,
  signal?: AbortSignal,
): Promise<StreamState> {
  return pump<AskStreamEvent>(store, localId, api.ask(body, signal), {
    delta: (e) => (e.type === 'delta' ? e.text : null),
    done: (e) => e.type === 'answer',
    error: (e) => (e.type === 'error' ? e.error : null),
  })
}

export function runEnhance(
  api: Pick<Api, 'stream'>,
  store: EphemeralStore,
  localId: string,
  sessionId: string,
  body: BodyIn<'enhanceNotes'>,
  signal?: AbortSignal,
): Promise<StreamState> {
  return pump<EnhanceStreamEvent>(
    store,
    localId,
    enhanceEvents(api.stream('enhanceNotes', { params: { id: sessionId }, body, signal })),
    {
      delta: (e) => (e.type === 'delta' ? e.text : null),
      done: (e) => e.type === 'done',
      error: (e) => (e.type === 'error' ? e.error : null),
    },
  )
}

let nextId = 0
const localIdOf = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nextId++}`

/** `const { start, cancel, stream } = useStream(store, (id, signal) => runAsk(api, store, id, body, signal))` */
export function useStream(
  store: EphemeralStore,
  run: (localId: string, signal: AbortSignal) => Promise<StreamState>,
  prefix = 'stream',
) {
  const [localId, setLocalId] = useState<string | null>(null)
  const ac = useRef<AbortController | null>(null)
  const stream = useStore(store, (s) => (localId ? s.streams[localId] : undefined))
  const start = useCallback(() => {
    ac.current?.abort()
    const c = new AbortController()
    ac.current = c
    const id = localIdOf(prefix)
    setLocalId(id)
    return run(id, c.signal)
  }, [run, prefix])
  const cancel = useCallback(() => ac.current?.abort(), [])
  useEffect(() => () => ac.current?.abort(), [])
  return { start, cancel, stream, localId }
}
