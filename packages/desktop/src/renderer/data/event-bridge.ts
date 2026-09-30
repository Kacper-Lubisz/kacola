import type { AnyEvent, DurableEvent, GnomeolaClient, ModelInfo, Session, Settings } from '@gnomeola/protocol'
import { isDurable } from '@gnomeola/protocol'
import { applyQaEvent, type QaState } from '@gnomeola/ui-core/qa'
import { applyEvent, fromSnapshot, type SessionsState } from '@gnomeola/ui-core/sessions'
import { withStored } from '@gnomeola/ui-core/settings'
import { applySpeakerEvent, type SpeakersState } from '@gnomeola/ui-core/speakers'
import { applyTranscriptEvent, type TranscriptState } from '@gnomeola/ui-core/transcript'
import { onlineManager, type QueryCacheNotifyEvent, type QueryClient } from '@tanstack/react-query'
import { applyEphemeral, type Connection, type EphemeralStore } from './ephemeral.ts'
import { isSessionScoped, keys } from './keys.ts'

// The EventBridge: ONE long-lived `client.subscribe()` for the whole window, and the only thing that
// keeps React Query's cache in step with the daemon (docs/desktop-app.md, "Data flow").
//
//   snapshot   health (the durable cursor) then the session list, folded with ui-core's fromSnapshot;
//   durable    each event is folded into every cached query it concerns, with ui-core's pure folds
//              (idempotent and revision-checked, so a replay or duplicate is a no-op);
//   late data  a per-session query that finishes fetching while events flow may have missed some: the
//              bridge keeps the recent durable events and re-folds that session's into the fresh data;
//   gap        (a daemon replaced under us — its cursor went backwards — or a gap the client reports)
//              → stop, invalidate everything, take a new snapshot, subscribe from it;
//   deleted    `session.deleted` removes every query of that session;
//   ephemeral  levels, partials, tokens → the Zustand store, never the query cache.
//
// Its connection state drives React Query's onlineManager: queries and mutations pause while the
// stream is down and resume when it is back.

export type BridgeClient = Pick<GnomeolaClient, 'call' | 'subscribe'>

export type EventBridgeOptions = {
  reconnectDelayMs?: number
  /** Delay before retrying an unreachable daemon's snapshot. */
  retryMs?: number
  /** How many recent durable events to keep for re-folding into late query results. */
  recent?: number
  /** Drive React Query's onlineManager from the connection (default true; tests may turn it off). */
  driveOnline?: boolean
}

const message = (err: unknown): string => {
  if (err instanceof Error)
    return err.cause instanceof Error ? `${err.message}: ${err.cause.message}` : err.message
  return String(err)
}

export class EventBridge {
  private readonly client: BridgeClient
  private readonly qc: QueryClient
  private readonly store: EphemeralStore
  private readonly o: Required<EventBridgeOptions>
  private ac: AbortController | null = null
  private seq = 0
  private recent: DurableEvent[] = []
  private unwatch: (() => void) | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  /** Resolves when the first snapshot is in the cache. */
  readonly ready: Promise<void>
  private markReady: () => void = () => {}
  /** Counters, for tests and diagnostics. */
  readonly stats = { snapshots: 0, applied: 0, duplicates: 0, resnapshots: 0 }

  constructor(client: BridgeClient, qc: QueryClient, store: EphemeralStore, opts: EventBridgeOptions = {}) {
    this.client = client
    this.qc = qc
    this.store = store
    this.o = { reconnectDelayMs: 1000, retryMs: 3000, recent: 1000, driveOnline: true, ...opts }
    this.ready = new Promise((r) => {
      this.markReady = r
    })
  }

  get cursor(): number {
    return this.seq
  }

  start(): void {
    this.stop()
    this.unwatch = this.qc.getQueryCache().subscribe((e) => this.onCacheEvent(e))
    this.restart()
  }

  stop(): void {
    this.ac?.abort()
    this.ac = null
    this.unwatch?.()
    this.unwatch = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private setConnection(c: Connection): void {
    this.store.setState({ connection: c })
    if (this.o.driveOnline) onlineManager.setOnline(c.kind === 'live')
  }

  private restart(): void {
    this.ac?.abort()
    const ac = new AbortController()
    this.ac = ac
    void this.run(ac)
  }

  private async snapshot(signal: AbortSignal): Promise<void> {
    const health = await this.client.call('health', { signal })
    const { sessions } = await this.client.call('listSessions', {
      query: { includePrivate: true, limit: 500 },
      signal,
    })
    if (signal.aborted) return
    this.seq = health.lastSeq
    this.recent = []
    this.qc.setQueryData(keys.health(), health)
    this.qc.setQueryData<SessionsState>(keys.sessions(), fromSnapshot(sessions, health.lastSeq))
    for (const s of sessions)
      if (this.qc.getQueryData(keys.session(s.id))) this.qc.setQueryData(keys.session(s.id), s)
    this.stats.snapshots++
  }

  private async run(ac: AbortController): Promise<void> {
    const signal = ac.signal
    const first = this.stats.snapshots === 0
    try {
      if (!first) {
        this.stats.resnapshots++
        this.setConnection({ kind: 'connecting' })
      }
      await this.snapshot(signal)
    } catch (err) {
      if (signal.aborted) return
      this.setConnection({ kind: 'unreachable', error: message(err) })
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        if (this.ac === ac) this.restart()
      }, this.o.retryMs)
      return
    }
    if (signal.aborted) return
    if (!first) {
      // everything else may have missed events while we were away: refetch what is being watched
      void this.qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== 'sessions' && q.queryKey[0] !== 'health',
      })
    }
    this.setConnection({ kind: 'live' })
    this.markReady()

    let lost = false
    await this.client.subscribe({
      since: this.seq,
      signal,
      ephemeral: true,
      reconnectDelayMs: this.o.reconnectDelayMs,
      onConnect: () => {
        if (!lost) return
        lost = false
        // a daemon that came back with a cursor behind ours is a different log (reinstalled, new data
        // dir): our cache describes a world that no longer exists
        void this.client
          .call('health', { signal })
          .then((h) => {
            if (signal.aborted) return
            if (h.lastSeq < this.seq) this.restart()
            else this.setConnection({ kind: 'live' })
          })
          .catch(() => {})
      },
      onDisconnect: (err) => {
        if (signal.aborted) return
        lost = true
        if (err && /event gap/.test(message(err))) {
          this.restart()
          return
        }
        this.setConnection({ kind: 'reconnecting', error: err ? message(err) : 'stream closed' })
      },
      onEvent: (e) => this.ingest(e),
    })
  }

  /** Fold one event. Public so tests (and a future in-process demo) can inject. */
  ingest(e: AnyEvent): void {
    if (isDurable(e)) {
      if (e.seq <= this.seq) {
        this.stats.duplicates++
        return
      }
      this.seq = e.seq
      this.recent.push(e)
      if (this.recent.length > this.o.recent) this.recent.splice(0, this.recent.length - this.o.recent)
      this.foldDurable(e)
      this.stats.applied++
    }
    applyEphemeral(this.store, e)
    this.foldStatus(e)
  }

  /** Ephemeral status reports that also refresh a cached query (models, calendar). */
  private foldStatus(e: AnyEvent): void {
    const d = e.data
    if (d.type === 'model.progress')
      this.qc.setQueryData<ModelInfo[]>(keys.models(), (cur) =>
        cur?.map((m) => (m.id === d.model.id ? d.model : m)),
      )
    else if (d.type === 'calendar.updated') this.qc.setQueryData(keys.calendar(), d.calendar)
  }

  private foldDurable(e: DurableEvent): void {
    const d = e.data
    this.qc.setQueryData<SessionsState>(keys.sessions(), (s) => (s ? applyEvent(s, e) : s))
    if (d.type === 'session.deleted') {
      this.qc.removeQueries({ predicate: (q) => isSessionScoped(q.queryKey, d.sessionId) })
      return
    }
    if (d.type === 'session.upserted') {
      this.qc.setQueryData<Session>(keys.session(d.session.id), (cur) => (cur ? d.session : cur))
    }
    if (d.type === 'settings.updated') {
      this.qc.setQueryData<Settings>(keys.settings(), (cur) => (cur ? withStored(cur, d.settings) : cur))
    }
    if (d.type === 'template.upserted' || d.type === 'template.deleted') {
      void this.qc.invalidateQueries({ queryKey: ['templates'] })
    }
    for (const id of sessionIdsOf(e)) this.foldSession(id, e)
  }

  /** Fold one durable event into every cached query of session `id`. */
  private foldSession(id: string, e: DurableEvent): void {
    this.qc.setQueryData<TranscriptState>(keys.transcript(id), (t) =>
      t ? applyTranscriptEvent(t, id, e) : t,
    )
    this.qc.setQueryData<QaState>(keys.qa(id), (q) => (q ? applyQaEvent(q, id, e) : q))
    const sp = this.qc.getQueryData<SpeakersState>(keys.speakers(id))
    if (sp) {
      const r = applySpeakerEvent(sp, id, e)
      if (r.state !== sp) this.qc.setQueryData(keys.speakers(id), r.state)
      if (r.stale) void this.qc.invalidateQueries({ queryKey: keys.speakers(id), exact: true })
    }
    if (e.data.type === 'note.version' && this.qc.getQueryData(keys.notes(id))) {
      void this.qc.invalidateQueries({ queryKey: keys.notes(id), exact: true })
    }
  }

  /** A per-session query just fetched: re-fold the recent events it may have missed. */
  private onCacheEvent(ev: QueryCacheNotifyEvent): void {
    if (ev.type !== 'updated' || ev.action.type !== 'success' || ev.action.manual) return
    const [kind, id] = ev.query.queryKey
    if (typeof id !== 'string' || !['transcript', 'qa', 'speakers'].includes(kind as string)) return
    const missed = this.recent.filter((e) => sessionIdsOf(e).includes(id))
    if (!missed.length) return
    queueMicrotask(() => {
      for (const e of missed) this.foldSession(id, e)
    })
  }
}

/** Which sessions a durable event concerns (the envelope's, and any named in the payload). */
export function sessionIdsOf(e: DurableEvent): string[] {
  const ids = new Set<string>()
  if (e.sessionId) ids.add(e.sessionId)
  const d = e.data as {
    sessionId?: unknown
    segment?: { sessionId: string }
    speaker?: { sessionId: string }
  }
  if (typeof d.sessionId === 'string') ids.add(d.sessionId)
  if (d.segment) ids.add(d.segment.sessionId)
  if (d.speaker) ids.add(d.speaker.sessionId)
  return [...ids]
}
