import type { DurableEvent, EphemeralEvent, Segment, Session, SubscribeOptions } from '@gnomeola/protocol'
import type { BridgeClient } from '../src/renderer/data/event-bridge.ts'

export const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  title: id,
  createdAt: '2026-09-28T09:00:00.000Z',
  startedAt: null,
  endedAt: null,
  status: 'idle',
  private: false,
  durationMs: 0,
  tracks: [],
  error: null,
  ...over,
})

export const segment = (id: string, sessionId: string, over: Partial<Segment> = {}): Segment => ({
  id,
  sessionId,
  track: 'mic',
  speaker: 'me',
  startMs: 0,
  endMs: 1000,
  text: id,
  quality: 'live',
  revision: 1,
  confidence: null,
  ...over,
})

let at = 0
const stamp = () => new Date(Date.UTC(2026, 8, 28, 12, 0, at++)).toISOString()

export const durable = (
  seq: number,
  data: DurableEvent['data'],
  sessionId: string | null = null,
): DurableEvent => ({
  seq,
  at: stamp(),
  sessionId,
  data,
})

export const upserted = (seq: number, s: Session): DurableEvent =>
  durable(seq, { type: 'session.upserted', session: s }, s.id)

export const ephemeral = (data: EphemeralEvent['data'], sessionId: string | null = null): EphemeralEvent => ({
  seq: null,
  at: stamp(),
  sessionId,
  data,
})

/**
 * A daemon stand-in for the EventBridge: `call` answers health / listSessions (and records every call),
 * `subscribe` hands the test the handlers so it can connect, drop and feed events at will.
 */
export type Handler = (opts: { params?: Record<string, string>; query?: unknown; body?: unknown }) => unknown

export function fakeDaemon(
  init: {
    sessions?: Session[]
    lastSeq?: number
    /** Answers for other routes (by route name); may throw to fail the call. */
    handlers?: Record<string, Handler>
  } = {},
) {
  const state = { sessions: init.sessions ?? [], lastSeq: init.lastSeq ?? 0, fail: null as Error | null }
  const calls: string[] = []
  /** Every call with its options (params, body …), in order. */
  const log: { name: string; opts: Parameters<Handler>[0] }[] = []
  const subs: SubscribeOptions[] = []
  const handlers: Record<string, Handler> = { ...init.handlers }
  const client: BridgeClient = {
    call: (async (name: string, opts: Parameters<Handler>[0] = {}) => {
      calls.push(name)
      log.push({ name, opts })
      if (state.fail) throw state.fail
      const h = handlers[name]
      if (h) return h(opts)
      if (name === 'health') return { lastSeq: state.lastSeq }
      if (name === 'listSessions') return { sessions: state.sessions }
      throw new Error(`fakeDaemon: unexpected call ${name}`)
    }) as unknown as BridgeClient['call'],
    subscribe: (s) => {
      subs.push(s)
      return new Promise<void>((resolve) => {
        if (s.signal?.aborted) resolve()
        s.signal?.addEventListener('abort', () => resolve(), { once: true })
      })
    },
  }
  const current = () => {
    const s = subs.at(-1)
    if (!s) throw new Error('not subscribed')
    return s
  }
  return {
    state,
    calls,
    log,
    handlers,
    subs,
    client,
    current,
    emit: (e: DurableEvent | EphemeralEvent) => current().onEvent(e),
    connect: () => current().onConnect?.(),
    drop: (err: unknown = new Error('socket hang up')) => current().onDisconnect?.(err),
  }
}

export const flush = () => new Promise((r) => setTimeout(r, 0))

export async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('until: timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}
