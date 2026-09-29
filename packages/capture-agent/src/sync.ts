import {
  AnyEvent,
  type DurableEvent,
  type GnomeolaClient,
  isDurable,
  type Session,
  SYNC_MAX_ITEMS,
  type SyncItem,
  type SyncPushResult,
} from '@gnomeola/protocol'

// H-7 — hybrid sync, the recommended hosted topology: capture AND transcription stay on the laptop;
// transcripts, notes and Q&A are pushed up to a hosted server. The agent is a protocol client of both
// ends — it reads the local daemon's /events and POSTs /sync/push to the remote — so it needs nothing
// from the daemon's internals and can run in the daemon, beside it, or in `gnomeola-agent sync`.
//
// Idempotent and resumable by construction: items carry the LOCAL seq; the server keeps a cursor per
// device and skips anything at or below it, inside the same transaction that applies the rest. After any
// crash, lost response or restart the agent asks the server for its cursor and carries on from there.
//
// What leaves the machine (docs/hosting.md, "Hybrid sync"):
//   - sessions (with local audio paths blanked — audio never syncs), segments, session Q&A, notes;
//   - NOT private sessions: while a session is private none of its events are pushed; making a synced
//     session private pushes a delete; making it public again pushes a snapshot of it;
//   - NOT settings, notes templates, or cross-session Q&A (it may quote private meetings).
//
// Privacy is decided per event from the log itself, so the agent folds the whole local log from seq 1
// on every start (pushing only what lies beyond the server's cursor).

export type SyncAgentOptions = {
  local: GnomeolaClient
  remote: GnomeolaClient
  /** Identifies this device when the remote has no auth (tests); a device token overrides it. */
  deviceId?: string
  /** Items per push (default and max SYNC_MAX_ITEMS). */
  batchSize?: number
  /** Push whatever is pending after this much quiet (continuous mode). */
  flushMs?: number
  retryMinMs?: number
  retryMaxMs?: number
  log?: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

export type SyncStats = {
  /** Local seq folded so far. */
  folded: number
  /** The server's cursor for this device after the last push. */
  remoteCursor: number
  pushes: number
  items: number
  applied: number
  skipped: number
  rejected: number
  failures: number
}

const scrub = (s: Session): Session => ({
  ...s,
  tracks: s.tracks.map((t) => ({ ...t, audioPath: null, archivePath: null })),
})

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true },
    )
  })

export class SyncAgent {
  private readonly o: Required<Omit<SyncAgentOptions, 'deviceId' | 'log'>> &
    Pick<SyncAgentOptions, 'deviceId' | 'log'>
  /** session id → private, as of the last event folded. */
  private readonly privacy = new Map<string, boolean>()
  private pending: SyncItem[] = []
  private pendingSince = 0
  private chain: Promise<void> = Promise.resolve()
  readonly stats: SyncStats = {
    folded: 0,
    remoteCursor: 0,
    pushes: 0,
    items: 0,
    applied: 0,
    skipped: 0,
    rejected: 0,
    failures: 0,
  }

  constructor(opts: SyncAgentOptions) {
    this.o = {
      batchSize: Math.min(opts.batchSize ?? SYNC_MAX_ITEMS, SYNC_MAX_ITEMS),
      flushMs: 500,
      retryMinMs: 200,
      retryMaxMs: 30_000,
      ...opts,
    }
  }

  private log(level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) {
    this.o.log?.(level, msg, fields)
  }

  // ------------------------------------------------------------------------------------ plan

  /** One local durable event → the items to push (none for anything that must not leave). */
  async plan(e: DurableEvent): Promise<SyncItem[]> {
    const d = e.data
    const push = e.seq > this.stats.remoteCursor
    const item = (data: SyncItem['data']): SyncItem => ({ seq: e.seq, data })
    switch (d.type) {
      case 'session.upserted': {
        const was = this.privacy.get(d.session.id)
        const now = d.session.private
        this.privacy.set(d.session.id, now)
        if (!push) return []
        if (now) return was === false ? [item({ type: 'session.deleted', sessionId: d.session.id })] : []
        if (was === true) return this.snapshot(e.seq, d.session.id)
        return [item({ type: 'session.upserted', session: scrub(d.session) })]
      }
      case 'session.deleted':
        this.privacy.delete(d.sessionId)
        return push ? [item(d)] : []
      case 'segment.upserted':
        return push && this.privacy.get(d.segment.sessionId) === false ? [item(d)] : []
      case 'qa.message':
        return push && d.message.sessionId !== null && this.privacy.get(d.message.sessionId) === false
          ? [item(d)]
          : []
      case 'note.version':
        return push && this.privacy.get(d.version.sessionId) === false ? [item(d)] : []
      default:
        return [] // settings, templates: device-local
    }
  }

  /** A session that just stopped being private: everything the server has not been allowed to see. */
  private async snapshot(seq: number, id: string): Promise<SyncItem[]> {
    const { local } = this.o
    const t = await local.call('getTranscript', { params: { id }, query: { includePrivate: true } })
    const qa = await local.call('getQaHistory', { params: { id }, query: { includePrivate: true } })
    const notes = await local.call('listNoteVersions', { params: { id }, query: { includePrivate: true } })
    // The current state may already be ahead of this event; later events are then no-ops or converge.
    return [
      { seq, data: { type: 'session.upserted', session: scrub({ ...t.session, private: false }) } },
      ...t.segments.map((segment): SyncItem => ({ seq, data: { type: 'segment.upserted', segment } })),
      ...qa.messages.map((message): SyncItem => ({ seq, data: { type: 'qa.message', message } })),
      ...notes.versions.map((version): SyncItem => ({ seq, data: { type: 'note.version', version } })),
    ]
  }

  // ------------------------------------------------------------------------------------ push

  private async pushWithRetry(items: SyncItem[], partial: boolean, signal?: AbortSignal): Promise<void> {
    let delay = this.o.retryMinMs
    for (;;) {
      if (signal?.aborted) throw new Error('aborted')
      try {
        const r: SyncPushResult = await this.o.remote.call('syncPush', {
          body: {
            items,
            ...(this.o.deviceId ? { deviceId: this.o.deviceId } : {}),
            ...(partial ? { partial } : {}),
          },
          signal,
        })
        this.stats.pushes++
        this.stats.items += items.length
        this.stats.applied += r.applied
        this.stats.skipped += r.skipped
        this.stats.rejected += r.rejected.length
        this.stats.remoteCursor = r.cursor
        for (const x of r.rejected) this.log('warn', 'sync item rejected by the server', { ...x })
        return
      } catch (err) {
        if (signal?.aborted) throw err
        this.stats.failures++
        this.log('warn', 'sync push failed; retrying', { err: (err as Error).message, inMs: delay })
        await sleep(delay, signal)
        delay = Math.min(delay * 2, this.o.retryMaxMs)
      }
    }
  }

  /** Push everything pending, in order, never splitting a same-seq group except when it cannot fit. */
  flush(signal?: AbortSignal): Promise<void> {
    const run = this.chain.then(async () => {
      while (this.pending.length) {
        let n = Math.min(this.pending.length, this.o.batchSize)
        let partial = false
        if (n < this.pending.length && this.pending[n - 1]!.seq === this.pending[n]!.seq) {
          // don't cut a group in two unless the group alone is bigger than a batch
          const seq = this.pending[n - 1]!.seq
          let start = n - 1
          while (start > 0 && this.pending[start - 1]!.seq === seq) start--
          if (start > 0) n = start
          else partial = true
        }
        await this.pushWithRetry(this.pending.slice(0, n), partial, signal)
        this.pending = this.pending.slice(n)
      }
    })
    this.chain = run.catch(() => {})
    return run
  }

  private async fold(e: DurableEvent, signal?: AbortSignal): Promise<void> {
    if (e.seq !== this.stats.folded + 1)
      throw new Error(`local event gap: expected seq ${this.stats.folded + 1}, got ${e.seq}`)
    const items = await this.plan(e)
    this.stats.folded = e.seq
    if (!items.length) return
    if (!this.pending.length) this.pendingSince = Date.now()
    this.pending.push(...items)
    if (this.pending.length >= this.o.batchSize) await this.flush(signal)
  }

  // ------------------------------------------------------------------------------------ run

  /** Fresh fold state and per-run stats; the server's cursor for this device (retried until reachable). */
  private async start(signal?: AbortSignal): Promise<void> {
    this.privacy.clear()
    this.pending = []
    Object.assign(this.stats, {
      folded: 0,
      pushes: 0,
      items: 0,
      applied: 0,
      skipped: 0,
      rejected: 0,
      failures: 0,
    })
    let delay = this.o.retryMinMs
    for (;;) {
      try {
        this.stats.remoteCursor = (
          await this.o.remote.call('syncCursor', {
            query: this.o.deviceId ? { deviceId: this.o.deviceId } : {},
            signal,
          })
        ).cursor
        return
      } catch (err) {
        if (signal?.aborted) throw err
        this.stats.failures++
        this.log('warn', 'cannot reach the sync server; retrying', {
          err: (err as Error).message,
          inMs: delay,
        })
        await sleep(delay, signal)
        delay = Math.min(delay * 2, this.o.retryMaxMs)
      }
    }
  }

  /** Read the local log from `folded` and fold every event, until `until` (or forever). */
  private async consume(until: number | null, signal?: AbortSignal): Promise<void> {
    let delay = this.o.retryMinMs
    while (!signal?.aborted && (until === null || this.stats.folded < until)) {
      try {
        for await (const msg of this.o.local.stream('events', {
          query: { since: this.stats.folded, ephemeral: false },
          signal,
        })) {
          if (!msg.data) continue
          const e = AnyEvent.parse(JSON.parse(msg.data))
          if (!isDurable(e) || e.seq <= this.stats.folded) continue
          await this.fold(e, signal)
          delay = this.o.retryMinMs
          if (until !== null && this.stats.folded >= until) return
        }
      } catch (err) {
        if (signal?.aborted) return
        this.log('warn', 'local event stream failed; reconnecting', { err: (err as Error).message })
        await sleep(delay, signal)
        delay = Math.min(delay * 2, this.o.retryMaxMs)
      }
    }
  }

  /** Push everything the local log holds right now, then return (gnomeola-agent sync --once, tests). */
  async syncOnce(signal?: AbortSignal): Promise<SyncStats> {
    await this.start(signal)
    const { lastSeq } = await this.o.local.call('health', { signal })
    await this.consume(lastSeq, signal)
    await this.flush(signal)
    return { ...this.stats }
  }

  /** Keep the remote in step with the local log until `signal` aborts. */
  async run(signal: AbortSignal): Promise<void> {
    try {
      await this.start(signal)
    } catch {
      return // aborted while the server was unreachable
    }
    const timer = setInterval(
      () => {
        if (this.pending.length && Date.now() - this.pendingSince >= this.o.flushMs)
          this.flush(signal).catch(() => {})
      },
      Math.max(20, this.o.flushMs / 2),
    )
    try {
      await this.consume(null, signal)
    } finally {
      clearInterval(timer)
    }
  }
}
