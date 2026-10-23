import {
  AnyEvent,
  type DurableEvent,
  isDurable,
  type KacolaClient,
  type Session,
  SYNC_MAX_ITEMS,
  type SyncItem,
  type SyncPushResult,
} from '@kacola/protocol'

// H-7 — hybrid sync, the recommended hosted topology: capture AND transcription stay on the laptop;
// transcripts, notes and Q&A are pushed up to a hosted server. The agent is a protocol client of both
// ends — it reads the local daemon's /events and POSTs /sync/push to the remote — so it needs nothing
// from the daemon's internals and can run in the daemon, beside it, or in `kacola-agent sync`.
//
// Idempotent and resumable by construction: items carry the LOCAL seq; the server keeps a cursor per
// device and skips anything at or below it, inside the same transaction that applies the rest. After any
// crash, lost response or restart the agent asks the server for its cursor and carries on from there.
//
// What leaves the machine (docs/hosting.md, "Hybrid sync"):
//   - sessions (with local audio paths blanked — audio never syncs), segments, session Q&A, notes —
//     made here: what was pulled from another device (`origin`) is never pushed back;
//   - NOT deletes: deleting a session here leaves the server's and the other devices' copies;
//   - NOT private sessions: while a session is private none of its events are pushed; making a synced
//     session private pushes a delete; making it public again pushes a snapshot of it;
//   - NOT settings, notes templates, or cross-session Q&A (it may quote private meetings).
//
// Privacy is decided per event from the log itself, so the agent folds the whole local log from seq 1
// on every start (pushing only what lies beyond the server's cursor).

export type SyncAgentOptions = {
  local: KacolaClient
  remote: KacolaClient
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
    // two-way sync: a change pulled from another device is already on the server. Its privacy is still
    // folded (a session's later events here decide by it), but it is never pushed back.
    const push = e.seq > this.stats.remoteCursor && e.origin === undefined
    const item = (data: SyncItem['data']): SyncItem => ({ seq: e.seq, data })
    switch (d.type) {
      case 'session.upserted': {
        const was = this.privacy.get(d.session.id)
        const now = d.session.private
        let out: SyncItem[] = []
        if (push) {
          if (now) out = was === false ? [item({ type: 'session.deleted', sessionId: d.session.id })] : []
          else if (was === true) out = await this.snapshot(e.seq, d.session.id)
          else out = [item({ type: 'session.upserted', session: scrub(d.session) })]
        }
        // folded only once planned: if the snapshot read failed, the retry must see the same transition
        this.privacy.set(d.session.id, now)
        return out
      }
      case 'session.deleted':
        // deleting a recording here removes it here only: the server and the other devices keep it
        // (a session made private still leaves the server, above)
        this.privacy.delete(d.sessionId)
        return []
      case 'segment.upserted':
        return push && this.privacy.get(d.segment.sessionId) === false ? [item(d)] : []
      case 'qa.message':
        return push && d.message.sessionId !== null && this.privacy.get(d.message.sessionId) === false
          ? [item(d)]
          : []
      case 'note.version':
        return push && this.privacy.get(d.version.sessionId) === false ? [item(d)] : []
      // M3: who spoke goes up; the voiceprint link does not (the print itself never leaves the device)
      case 'speaker.upserted':
        return push && this.privacy.get(d.speaker.sessionId) === false
          ? [item({ ...d, speaker: { ...d.speaker, voiceprintId: null } })]
          : []
      case 'speaker.merged':
      case 'segments.attributed':
        return push && this.privacy.get(d.sessionId) === false ? [item(d)] : []
      default:
        return [] // settings, templates, voiceprints: device-local
    }
  }

  /** A session that just stopped being private: everything the server has not been allowed to see. */
  private async snapshot(seq: number, id: string): Promise<SyncItem[]> {
    const { local } = this.o
    const t = await local.call('getTranscript', { params: { id }, query: { includePrivate: true } })
    const qa = await local.call('getQaHistory', { params: { id }, query: { includePrivate: true } })
    const notes = await local.call('listNoteVersions', { params: { id }, query: { includePrivate: true } })
    const who = await local.call('listSpeakers', { params: { id }, query: { includePrivate: true } })
    // The current state may already be ahead of this event; later events are then no-ops or converge.
    // Speakers are rebuilt from their summaries (live ones only: segments already point at survivors).
    const speakers = who.speakers.filter((x) => x.track === 'system' && x.colour !== null)
    return [
      { seq, data: { type: 'session.upserted', session: scrub({ ...t.session, private: false }) } },
      ...speakers.map(
        (x): SyncItem => ({
          seq,
          data: {
            type: 'speaker.upserted',
            speaker: {
              id: x.id,
              sessionId: id,
              label: x.label,
              named: x.named,
              colour: x.colour!,
              voiceprintId: null,
              mergedInto: null,
              createdAt: t.session.createdAt,
            },
          },
        }),
      ),
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

  /** Push everything the local log holds right now, then return (kacola-agent sync --once, tests). */
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

// ------------------------------------------------------------------------------------ pull

export type SyncPullerOptions = {
  local: KacolaClient
  remote: KacolaClient
  /** This device's id on the server (its own changes come back with it as origin, and are skipped). */
  self: string
  batchSize?: number
  flushMs?: number
  retryMinMs?: number
  retryMaxMs?: number
  log?: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

export type PullStats = {
  cursor: number
  pulled: number
  applied: number
  skipped: number
  rejected: number
  failures: number
}

/**
 * Two-way sync, the other half: follows the hosted server's log and applies the OTHER devices' changes to
 * the local daemon, through its loopback /sync/push — the same ingest the server runs, so the same conflict
 * rules (@kacola/store decideIngest) hold on every replica. The local cursor is the server's seq, kept by the
 * daemon in the same transaction as what it applied: resumable and idempotent like the push.
 */
export class SyncPuller {
  private readonly o: Required<Omit<SyncPullerOptions, 'log'>> & Pick<SyncPullerOptions, 'log'>
  private pending: SyncItem[] = []
  readonly stats: PullStats = { cursor: 0, pulled: 0, applied: 0, skipped: 0, rejected: 0, failures: 0 }

  constructor(opts: SyncPullerOptions) {
    this.o = {
      batchSize: Math.min(opts.batchSize ?? SYNC_MAX_ITEMS, SYNC_MAX_ITEMS),
      flushMs: 300,
      retryMinMs: 200,
      retryMaxMs: 30_000,
      ...opts,
    }
  }

  private log(level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) {
    this.o.log?.(level, msg, fields)
  }

  private async apply(signal?: AbortSignal): Promise<void> {
    if (!this.pending.length) return
    const items = this.pending
    this.pending = []
    const r = await this.o.local.call('syncPush', { body: { items }, signal })
    this.stats.applied += r.applied
    this.stats.skipped += r.skipped
    this.stats.rejected += r.rejected.length
    this.stats.cursor = Math.max(this.stats.cursor, r.cursor)
    for (const x of r.rejected) this.log('warn', 'pulled item not applied here', { ...x })
  }

  /** Pull until `signal` aborts (or, with `until`, until the server's log up to that seq is applied). */
  async run(signal?: AbortSignal, until: number | null = null): Promise<PullStats> {
    let delay = this.o.retryMinMs
    while (!signal?.aborted) {
      try {
        this.stats.cursor = (await this.o.local.call('syncCursor', { query: {}, signal })).cursor
        if (until !== null && this.stats.cursor >= until) return { ...this.stats }
        let quiet: ReturnType<typeof setTimeout> | null = null
        let failed: unknown = null
        const flushSoon = () => {
          if (quiet) clearTimeout(quiet)
          quiet = setTimeout(() => {
            this.apply(signal).catch((err) => {
              failed = err
            })
          }, this.o.flushMs)
        }
        for await (const msg of this.o.remote.stream('events', {
          query: { since: this.stats.cursor, ephemeral: false },
          signal,
        })) {
          if (failed) throw failed
          if (!msg.data) continue
          const e = AnyEvent.parse(JSON.parse(msg.data))
          if (!isDurable(e) || e.seq <= this.stats.cursor) continue
          this.stats.pulled++
          // our own changes, back from the server: already here
          if (e.origin !== this.o.self)
            this.pending.push({ seq: e.seq, data: e.data, ...(e.origin ? { origin: e.origin } : {}) })
          else this.stats.cursor = Math.max(this.stats.cursor, e.seq)
          if (this.pending.length >= this.o.batchSize) await this.apply(signal)
          else if (this.pending.length) flushSoon()
          delay = this.o.retryMinMs
          if (until !== null && e.seq >= until) {
            if (quiet) clearTimeout(quiet)
            await this.apply(signal)
            return { ...this.stats }
          }
        }
        if (quiet) clearTimeout(quiet)
        await this.apply(signal)
      } catch (err) {
        if (signal?.aborted) break
        this.stats.failures++
        this.log('warn', 'sync pull failed; retrying', { err: (err as Error).message, inMs: delay })
        await sleep(delay, signal)
        delay = Math.min(delay * 2, this.o.retryMaxMs)
      }
    }
    return { ...this.stats }
  }

  /** Apply everything the server's log holds right now, then return (tests, `kacola-agent sync --once`). */
  async pullOnce(signal?: AbortSignal): Promise<PullStats> {
    const { lastSeq } = await this.o.remote.call('health', { signal })
    return this.run(signal, lastSeq)
  }
}
