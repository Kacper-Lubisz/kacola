import type { AnyEvent, Session } from '@gnomeola/protocol'
import { applyEvent, emptySessions, fromSnapshot, type SessionsState } from './sessions.ts'
import type { DataSource } from './source.ts'

// The one place UI state lives. A plain external store (subscribe / getSnapshot) so React reads it
// through useSyncExternalStore with no tearing, and so it is testable without React or GTK.

export type Connection =
  | { kind: 'connecting' }
  | { kind: 'live' }
  /** We had data and lost the event stream; the list is shown but may be stale. */
  | { kind: 'reconnecting'; error: string }
  /** Never got a snapshot: the daemon is not answering at all. */
  | { kind: 'unreachable'; origin: string; error: string; retryInMs: number }

export type StoreState = {
  sessions: SessionsState
  connection: Connection
}

export type StoreOptions = {
  /** Delay before re-trying an unreachable daemon. */
  retryMs?: number
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (h: unknown) => void
}

const message = (err: unknown): string => {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? `: ${err.cause.message}` : ''
    return `${err.message}${cause}`
  }
  return String(err)
}

export class SessionStore {
  private state: StoreState = { sessions: emptySessions, connection: { kind: 'connecting' } }
  private readonly listeners = new Set<() => void>()
  private readonly eventListeners = new Set<(e: AnyEvent) => void>()
  private abort: AbortController | null = null
  private retryTimer: unknown = null
  private readonly source: DataSource
  private readonly retryMs: number
  private readonly setT: (fn: () => void, ms: number) => unknown
  private readonly clearT: (h: unknown) => void

  constructor(source: DataSource, opts: StoreOptions = {}) {
    this.source = source
    this.retryMs = opts.retryMs ?? 5000
    this.setT = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearT = opts.clearTimeout ?? ((h) => clearTimeout(h as NodeJS.Timeout))
  }

  get origin(): string {
    return this.source.origin
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getSnapshot = (): StoreState => this.state

  /** Every event, durable and ephemeral, as it arrives (for live meters, partial transcripts…). */
  onEvent(l: (e: AnyEvent) => void): () => void {
    this.eventListeners.add(l)
    return () => this.eventListeners.delete(l)
  }

  private set(next: Partial<StoreState>) {
    this.state = { ...this.state, ...next }
    for (const l of [...this.listeners]) l()
  }

  /** Load a snapshot, then follow the event stream. Safe to call again (it restarts). */
  start(): void {
    this.stop()
    const ac = new AbortController()
    this.abort = ac
    this.set({ connection: { kind: 'connecting' } })
    void this.run(ac)
  }

  /** Give up waiting and try an unreachable daemon now. */
  retry(): void {
    this.start()
  }

  stop(): void {
    this.abort?.abort()
    this.abort = null
    if (this.retryTimer !== null) this.clearT(this.retryTimer)
    this.retryTimer = null
  }

  private async run(ac: AbortController): Promise<void> {
    let snap: Awaited<ReturnType<DataSource['load']>>
    try {
      snap = await this.source.load(ac.signal)
    } catch (err) {
      if (ac.signal.aborted) return
      this.set({
        connection: {
          kind: 'unreachable',
          origin: this.source.origin,
          error: message(err),
          retryInMs: this.retryMs,
        },
      })
      this.retryTimer = this.setT(() => {
        this.retryTimer = null
        if (this.abort === ac) this.start()
      }, this.retryMs)
      return
    }
    if (ac.signal.aborted) return
    this.set({ sessions: fromSnapshot(snap.sessions, snap.seq), connection: { kind: 'live' } })
    await this.source.subscribe({
      since: snap.seq,
      signal: ac.signal,
      onConnect: () => {
        if (this.state.connection.kind !== 'live') this.set({ connection: { kind: 'live' } })
      },
      onDisconnect: (err) => {
        if (ac.signal.aborted) return
        this.set({ connection: { kind: 'reconnecting', error: err ? message(err) : 'stream closed' } })
      },
      onEvent: (e) => this.ingest(e),
    })
  }

  /** Fold one event into state and fan it out. Public so tests and the demo can inject. */
  ingest(e: AnyEvent): void {
    const sessions = applyEvent(this.state.sessions, e)
    if (sessions !== this.state.sessions) this.set({ sessions })
    for (const l of [...this.eventListeners]) l(e)
  }

  async startRecording(): Promise<Session> {
    return this.source.startRecording()
  }

  async stopRecording(id: string): Promise<Session> {
    return this.source.stopRecording(id)
  }
}
