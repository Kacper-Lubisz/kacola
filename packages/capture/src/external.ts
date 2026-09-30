import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TrackKind } from '@gnomeola/protocol'
import { TrackRecorder, toFatalError } from './track-recorder.ts'
import {
  type CaptureErrorEvent,
  type CaptureEvents,
  type CaptureResult,
  type CaptureSource,
  type CaptureState,
  Emitter,
  type GapReason,
  SAMPLES_PER_MS,
  type TrackSpec,
} from './types.ts'
import type { FileOps } from './wav-writer.ts'

// P-3: a capture source fed from outside the daemon — the desktop app on macOS captures the microphone
// (getUserMedia) and system audio (loopback getDisplayMedia) and streams 16 kHz s16 frames to the
// daemon's ingest route (protocol capture.ts), which pushes them in here. Everything downstream is the
// same TrackRecorder the PipeWire source uses: the same WAV writer (crash-safe, flushed every second), the
// same level meter, the same gap accounting and session timeline.
//
// Placement. Frames carry (epoch, sample): the client's capture run and the sample index within it.
//   - First frame of an epoch (and the first after start/resume): anchored to the session wall clock like
//     a fresh pw-record child — the frame ends "now"; a shortfall is padded, as `latency` when under the
//     jitter threshold is exceeded, or with the outage's reason (`disconnected`, `stall`) after a failure.
//   - Later frames of the same epoch are placed by their sample index, so a stream that reconnects (or is
//     rotated on purpose) and resends from any earlier sample loses and duplicates nothing: overlap is
//     trimmed, and a jump forward — audio the client dropped or never resent — is padded and reported
//     (`client-drop`, or the outage's reason).
//   - Guards: a frame lagging the wall clock by more than maxLagMs (a client that froze without counting)
//     re-anchors the epoch; a frame more than maxLeadMs ahead (a client faster than real time) is dropped.
// Outages: no stream attached, or an attached stream silent for too long, is reported as a non-fatal
// error once per outage, and the time is padded when audio returns or at stop.

export type ExternalCaptureOptions = {
  flushIntervalMs?: number
  /** Start/resume latency below this is jitter, not a gap. Default 100 ms (clients send 20–100 ms frames). */
  minGapMs?: number
  /** An attached stream silent this long is a stall. Default 2000 ms. */
  stallTimeoutMs?: number
  /** No stream at all this long after start/resume or a disconnect is reported. Default 5000 ms. */
  attachTimeoutMs?: number
  /** Default 5000 ms: a client may buffer this much through a hiccup and still be placed exactly. */
  maxLagMs?: number
  /** Default 1000 ms. */
  maxLeadMs?: number
  fileOps?: FileOps
  /** Test seam for the wall clock (ms, monotonic). */
  now?: () => number
}

export type ExternalFrame = { epoch: number; sample: number; samples: Int16Array }
export type PushResult = { written: number; discarded: number }
export type ConnectionEnd = 'stopped' | 'superseded'

/** One client stream attached to a track. */
export interface ExternalConnection {
  readonly track: TrackKind
  /** Resolves when the daemon ends this stream (the recording stopped, or a newer stream took over). */
  readonly ended: Promise<ConnectionEnd>
  readonly closed: boolean
  push(frame: ExternalFrame): PushResult
  /** The client went away (request ended or aborted). */
  detach(): void
}

type Conn = ExternalConnection & { end(why: ConnectionEnd): void }

type TrackState = {
  kind: TrackKind
  rec: TrackRecorder
  conn: Conn | null
  epoch: number | null
  /** Session sample where the current epoch's sample 0 lies. */
  base: number
  needAnchor: boolean
  pendingReason: GapReason | null
  /** Wall ms of the last frame, or of the last (re)start of the waiting period. */
  lastAt: number
  outageReported: boolean
  aheadReported: boolean
}

export class ExternalCaptureSource implements CaptureSource {
  readonly backend = 'external' as const
  private readonly ev = new Emitter<CaptureEvents>()
  private readonly o: Required<Omit<ExternalCaptureOptions, 'fileOps' | 'now'>>
  private readonly fileOps: FileOps | undefined
  private readonly now: () => number
  private tracks: TrackState[] = []
  private _state: CaptureState = 'idle'
  private activeMsBefore = 0
  private activeSince: number | null = null
  private tick: NodeJS.Timeout | null = null
  private fatal: CaptureErrorEvent | null = null
  private stopping: Promise<CaptureResult> | null = null

  constructor(opts: ExternalCaptureOptions = {}) {
    this.o = {
      flushIntervalMs: opts.flushIntervalMs ?? 1000,
      minGapMs: opts.minGapMs ?? 100,
      stallTimeoutMs: opts.stallTimeoutMs ?? 2000,
      attachTimeoutMs: opts.attachTimeoutMs ?? 5000,
      maxLagMs: opts.maxLagMs ?? 5000,
      maxLeadMs: opts.maxLeadMs ?? 1000,
    }
    this.fileOps = opts.fileOps
    this.now = opts.now ?? (() => performance.now())
  }

  get state(): CaptureState {
    return this._state
  }

  on<K extends keyof CaptureEvents>(event: K, fn: (...args: CaptureEvents[K]) => void): () => void {
    return this.ev.on(event, fn)
  }

  elapsedMs(): number {
    return this.activeMsBefore + (this.activeSince === null ? 0 : this.now() - this.activeSince)
  }

  kinds(): TrackKind[] {
    return this.tracks.map((t) => t.kind)
  }

  status(): { kind: TrackKind; connected: boolean; positionMs: number; gaps: number }[] {
    return this.tracks.map((t) => ({
      kind: t.kind,
      connected: t.conn !== null,
      positionMs: Math.round(t.rec.positionMs),
      gaps: t.rec.gaps.length,
    }))
  }

  async start(sessionDir: string, specs: readonly TrackSpec[]): Promise<void> {
    if (this._state !== 'idle') throw new Error(`cannot start from state ${this._state}`)
    const kinds = new Set(specs.map((s) => s.kind))
    if (!specs.length || kinds.size !== specs.length) throw new Error('need one spec per track kind')
    mkdirSync(sessionDir, { recursive: true })
    const now = this.now()
    this.tracks = specs.map((spec) => ({
      kind: spec.kind,
      rec: new TrackRecorder({
        kind: spec.kind,
        path: join(sessionDir, `${spec.kind}.wav`),
        device: `external:${spec.device && spec.device !== 'default' ? spec.device : 'default'}`,
        flushIntervalMs: this.o.flushIntervalMs,
        fileOps: this.fileOps,
        emit: (e, ...a) => this.ev.emit(e, ...a),
      }),
      conn: null,
      epoch: null,
      base: 0,
      needAnchor: true,
      pendingReason: null,
      lastAt: now,
      outageReported: false,
      aheadReported: false,
    }))
    this.activeSince = now
    this.setState('recording')
    this.tick = setInterval(() => this.supervise(), 100)
    this.tick.unref?.()
  }

  /** Attach a client stream to a track; a previous stream on it is superseded. */
  attach(kind: TrackKind): ExternalConnection {
    const t = this.tracks.find((x) => x.kind === kind)
    if (!t) throw new Error(`this recording has no ${kind} track`)
    if (this._state === 'stopped' || this._state === 'failed' || this._state === 'idle')
      throw new Error(`capture is ${this._state}`)
    t.conn?.end('superseded')
    let resolveEnd!: (w: ConnectionEnd) => void
    const ended = new Promise<ConnectionEnd>((r) => {
      resolveEnd = r
    })
    let closed = false
    const conn: Conn = {
      track: kind,
      ended,
      get closed() {
        return closed
      },
      push: (frame) => (closed ? { written: 0, discarded: frame.samples.length } : this.push(t, frame)),
      detach: () => {
        if (closed) return
        closed = true
        if (t.conn === conn) this.lost(t, 'disconnected')
      },
      end: (why) => {
        if (closed) return
        closed = true
        if (t.conn === conn) t.conn = null
        resolveEnd(why)
      },
    }
    t.conn = conn
    t.lastAt = this.now()
    return conn
  }

  async pause(): Promise<void> {
    if (this._state !== 'recording') return
    this.freezeClock()
    for (const t of this.tracks) t.needAnchor = true
    this.setState('paused')
  }

  async resume(): Promise<void> {
    if (this._state !== 'paused') return
    const now = this.now()
    this.activeSince = now
    for (const t of this.tracks) {
      t.needAnchor = true
      t.lastAt = now
    }
    this.setState('recording')
  }

  stop(): Promise<CaptureResult> {
    if (!this.stopping) this.stopping = Promise.resolve().then(() => this.doStop())
    return this.stopping
  }

  private doStop(): CaptureResult {
    if (this._state === 'idle') {
      this._state = 'stopped'
      return { tracks: [], durationMs: 0, error: null }
    }
    this.freezeClock()
    const wasFatal = this.fatal !== null
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    this._state = 'stopped'
    for (const t of this.tracks) t.conn?.end('stopped')
    const endSample = Math.round(this.elapsedMs() * SAMPLES_PER_MS)
    if (!wasFatal) {
      for (const t of this.tracks) {
        const reason = t.pendingReason ?? (t.conn === null && t.epoch === null ? 'disconnected' : null)
        const threshold = reason ? 0 : this.o.minGapMs * SAMPLES_PER_MS
        if (endSample - t.rec.position > threshold) {
          try {
            t.rec.padTo(endSample, reason ?? 'latency')
          } catch (e) {
            this.fatal ??= toFatalError(t.kind, e)
          }
        }
      }
    }
    const tracks = this.tracks.map((t) => t.rec.close())
    this.setState(this.fatal ? 'failed' : 'stopped')
    return { tracks, durationMs: Math.round(this.elapsedMs()), error: this.fatal }
  }

  // ---------------------------------------------------------------------------------------- ingest

  private push(t: TrackState, f: ExternalFrame): PushResult {
    const n = f.samples.length
    if (this._state !== 'recording' || !n) return { written: 0, discarded: n }
    t.lastAt = this.now()
    t.outageReported = false
    const wall = Math.round(this.elapsedMs() * SAMPLES_PER_MS)
    try {
      if (
        t.epoch === f.epoch &&
        !t.needAnchor &&
        wall - (t.base + f.sample + n) > this.o.maxLagMs * SAMPLES_PER_MS
      ) {
        // the client froze without counting: its clock no longer tells us where this audio belongs
        this.ev.emit('error', {
          track: t.kind,
          code: 'stall',
          message: `${t.kind} audio from the app is ${Math.round((wall - t.base - f.sample - n) / SAMPLES_PER_MS)} ms behind; re-anchoring`,
          fatal: false,
        })
        t.pendingReason ??= 'stall'
        t.needAnchor = true
      }
      if (t.epoch !== f.epoch || t.needAnchor) {
        const anchor = wall - n
        const shortfall = anchor - t.rec.position
        const threshold = t.pendingReason ? 0 : this.o.minGapMs * SAMPLES_PER_MS
        if (shortfall > threshold) t.rec.padTo(anchor, t.pendingReason ?? 'latency')
        t.base = t.rec.position - f.sample
        t.epoch = f.epoch
        t.needAnchor = false
      }
      const at = t.base + f.sample
      if (at > wall + this.o.maxLeadMs * SAMPLES_PER_MS) {
        if (!t.aheadReported) {
          t.aheadReported = true
          this.ev.emit('error', {
            track: t.kind,
            code: 'client-ahead',
            message: `${t.kind} audio from the app runs ahead of real time; dropping`,
            fatal: false,
          })
        }
        return { written: 0, discarded: n }
      }
      if (at > t.rec.position) t.rec.padTo(at, t.pendingReason ?? 'client-drop')
      const skip = t.rec.position - at
      if (skip >= n) return { written: 0, discarded: n }
      t.rec.append(skip > 0 ? f.samples.subarray(skip) : f.samples)
      t.pendingReason = null
      return { written: n - Math.max(0, skip), discarded: Math.max(0, skip) }
    } catch (e) {
      this.onFatal(toFatalError(t.kind, e))
      return { written: 0, discarded: n }
    }
  }

  /** A stream went away or went quiet: report once, and pad with this reason when audio returns. */
  private lost(t: TrackState, reason: GapReason): void {
    if (reason === 'disconnected') t.conn = null
    t.pendingReason ??= reason
    t.lastAt = this.now()
  }

  private supervise(): void {
    if (this._state !== 'recording') return
    const now = this.now()
    for (const t of this.tracks) {
      if (t.outageReported) continue
      const silent = now - t.lastAt
      if (t.conn && silent > this.o.stallTimeoutMs) {
        t.outageReported = true
        this.lost(t, 'stall')
        this.ev.emit('error', {
          track: t.kind,
          code: 'stall',
          message: `no ${t.kind} audio from the app for ${Math.round(silent)} ms`,
          fatal: false,
        })
      } else if (!t.conn && silent > this.o.attachTimeoutMs) {
        t.outageReported = true
        t.pendingReason ??= 'disconnected'
        this.ev.emit('error', {
          track: t.kind,
          code: 'device-missing',
          message: `no ${t.kind} audio: the app is not streaming this track`,
          fatal: false,
        })
      }
    }
  }

  private onFatal(err: CaptureErrorEvent): void {
    if (this.fatal) return
    this.fatal = err
    this.ev.emit('error', err)
    void this.stop()
  }

  private freezeClock(): void {
    if (this.activeSince !== null) {
      this.activeMsBefore += this.now() - this.activeSince
      this.activeSince = null
    }
  }

  private setState(s: CaptureState): void {
    this._state = s
    this.ev.emit('state', s)
  }
}

/**
 * The daemon's registry of recordings waiting for (or receiving) external audio, by session id. The
 * recording pipeline creates a source per recording through it; the ingest route looks it up.
 */
export class ExternalCaptureHub {
  private readonly sources = new Map<string, ExternalCaptureSource>()
  private readonly opts: ExternalCaptureOptions

  constructor(opts: ExternalCaptureOptions = {}) {
    this.opts = opts
  }

  create(sessionId: string): ExternalCaptureSource {
    const src = new ExternalCaptureSource(this.opts)
    this.sources.set(sessionId, src)
    src.on('state', (s) => {
      if ((s === 'stopped' || s === 'failed') && this.sources.get(sessionId) === src)
        this.sources.delete(sessionId)
    })
    return src
  }

  get(sessionId: string): ExternalCaptureSource | null {
    const s = this.sources.get(sessionId)
    return s && (s.state === 'recording' || s.state === 'paused') ? s : null
  }

  list(): { sessionId: string; source: ExternalCaptureSource }[] {
    return [...this.sources].flatMap(([sessionId, source]) =>
      source.state === 'recording' || source.state === 'paused' ? [{ sessionId, source }] : [],
    )
  }
}
