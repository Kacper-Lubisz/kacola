import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TrackKind } from '@gnomeola/protocol'
import { trackChild } from './children.ts'
import { type DefaultsWatcher, PwMetadataWatcher } from './defaults-watcher.ts'
import { type Defaults, type GraphSnapshot, snapshotGraph } from './devices.ts'
import { TrackRecorder, toFatalError } from './track-recorder.ts'
import {
  type CaptureErrorEvent,
  type CaptureEvents,
  type CaptureResult,
  type CaptureSource,
  type CaptureState,
  Emitter,
  type GapReason,
  SAMPLE_RATE,
  SAMPLES_PER_MS,
  type TrackSpec,
} from './types.ts'

import type { FileOps } from './wav-writer.ts'

// R-2 / R-3: dual-track capture from PipeWire, one `pw-record` child per track, raw s16le 16 kHz mono on
// stdout.
//
//   mic    → pw-record --target <source node.name>
//   system → pw-record --target <sink node.name> -P '{ stream.capture.sink=true }'   (the sink's monitor)
//
// Every stream is created with node.dont-fallback / dont-reconnect / dont-move: if its target vanishes,
// pw-record exits instead of WirePlumber silently re-routing it (possibly to a different microphone).
// Reattaching is our job, so that it is *recorded*: the supervisor below respawns the child on the
// right target and the missing time is padded with silence and reported as a gap.
//
// Timeline anchoring: within one attachment, samples are counted (the device clock). On every attach
// (start, resume, reattach) the first chunk is anchored to the session wall clock: it ends "now", so it
// started at now − its length; any shortfall between the track's position and that anchor is padded.
// For plain start/resume latency, shortfalls under `minGapMs` are treated as measurement jitter; after a
// failure every shortfall is padded and reported.

export type PipeWireCaptureOptions = {
  /** WAV header rewrite + fdatasync cadence (crash-safety granularity). Default 1000 ms. */
  flushIntervalMs?: number
  /** pw-record --latency. Default 20 ms. */
  latencyMs?: number
  /** Kill and reattach if a freshly spawned child produces no audio for this long. Default 3000 ms. */
  attachTimeoutMs?: number
  /** Kill and reattach if a running child stops producing audio for this long. Default 2000 ms. */
  stallTimeoutMs?: number
  /** Reattach retry backoff bounds. Defaults 100 / 1000 ms. */
  retryMinMs?: number
  retryMaxMs?: number
  /** Start/resume latency below this is jitter, not a gap. Default 30 ms. */
  minGapMs?: number
  /** Follow default-device changes. Default: a PwMetadataWatcher. Pass null to disable. */
  defaultsWatcher?: DefaultsWatcher | null
  /** Graph snapshot provider (tests may wrap it). Default: pw-dump. */
  snapshot?: () => Promise<GraphSnapshot>
  fileOps?: FileOps
  /** Run pw-record under `stdbuf -o0` so audio is delivered in ~latency-sized chunks, not 4 KiB. Default: auto. */
  unbuffered?: boolean
}

type TrackState = {
  spec: TrackSpec
  followDefault: boolean
  rec: TrackRecorder
  target: string | null
  child: ChildProcess | null
  /** Bumped whenever the current child is abandoned; events from older children are ignored. */
  generation: number
  needAnchor: boolean
  /** Why the next anchor may pad; null means ordinary start/resume latency. */
  pendingReason: GapReason | null
  carry: number | null
  lastDataAt: number
  spawnedAt: number
  gotData: boolean
  retryTimer: NodeJS.Timeout | null
  retryDelay: number
  attaching: boolean
  detaching: boolean
  stderrTail: string
  outageReported: boolean
}

let stdbufAvailable: boolean | null = null
function hasStdbuf(): boolean {
  if (stdbufAvailable === null) stdbufAvailable = spawnSync('stdbuf', ['--version']).status === 0
  return stdbufAvailable
}

export class PipeWireCaptureSource implements CaptureSource {
  readonly backend = 'pipewire' as const
  private readonly ev = new Emitter<CaptureEvents>()
  private readonly opts: Required<
    Omit<PipeWireCaptureOptions, 'defaultsWatcher' | 'snapshot' | 'fileOps' | 'unbuffered'>
  >
  private readonly watcher: DefaultsWatcher | null
  private readonly snapshot: () => Promise<GraphSnapshot>
  private readonly fileOps: FileOps | undefined
  private readonly unbuffered: boolean
  private tracks: TrackState[] = []
  private _state: CaptureState = 'idle'
  private activeMsBefore = 0
  private activeSince: number | null = null
  private tick: NodeJS.Timeout | null = null
  private unwatch: (() => void) | null = null
  private fatal: CaptureErrorEvent | null = null
  /** Set once stop() has drained every child; output after that is dropped. */
  private closed = false
  private stopping: Promise<CaptureResult> | null = null

  constructor(opts: PipeWireCaptureOptions = {}) {
    this.opts = {
      flushIntervalMs: opts.flushIntervalMs ?? 1000,
      latencyMs: opts.latencyMs ?? 20,
      attachTimeoutMs: opts.attachTimeoutMs ?? 3000,
      stallTimeoutMs: opts.stallTimeoutMs ?? 2000,
      retryMinMs: opts.retryMinMs ?? 100,
      retryMaxMs: opts.retryMaxMs ?? 1000,
      minGapMs: opts.minGapMs ?? 30,
    }
    this.watcher = opts.defaultsWatcher === undefined ? new PwMetadataWatcher() : opts.defaultsWatcher
    this.snapshot = opts.snapshot ?? snapshotGraph
    this.fileOps = opts.fileOps
    this.unbuffered = opts.unbuffered ?? hasStdbuf()
  }

  get state(): CaptureState {
    return this._state
  }

  on<K extends keyof CaptureEvents>(event: K, fn: (...args: CaptureEvents[K]) => void): () => void {
    return this.ev.on(event, fn)
  }

  elapsedMs(): number {
    return this.activeMsBefore + (this.activeSince === null ? 0 : performance.now() - this.activeSince)
  }

  /** Per-track diagnostics: current target, child pid (null while detached), position, gaps so far. */
  status(): Array<{
    kind: TrackKind
    target: string | null
    pid: number | null
    positionMs: number
    gaps: number
  }> {
    return this.tracks.map((t) => ({
      kind: t.spec.kind,
      target: t.target,
      pid: t.child?.pid ?? null,
      positionMs: Math.round(t.rec.positionMs),
      gaps: t.rec.gaps.length,
    }))
  }

  async start(sessionDir: string, specs: readonly TrackSpec[]): Promise<void> {
    if (this._state !== 'idle') throw new Error(`cannot start from state ${this._state}`)
    const kinds = new Set(specs.map((s) => s.kind))
    if (!specs.length || kinds.size !== specs.length) throw new Error('need one spec per track kind')
    const graph = await this.snapshot()
    const recorders: TrackRecorder[] = []
    let resolved: Array<{ spec: TrackSpec; followDefault: boolean; target: string }>
    try {
      if (this.watcher) await this.watcher.start(graph.defaults)
      const defaults = this.watcher?.current() ?? graph.defaults
      resolved = specs.map((spec) => {
        const followDefault = !spec.device || spec.device === 'default'
        const target = followDefault ? defaultFor(spec.kind, defaults) : spec.device!
        if (!target || !graph.nodeNames.has(target)) {
          throw new Error(
            `no ${spec.kind} device: ${followDefault ? `default ${spec.kind === 'mic' ? 'source' : 'sink'}` : `node '${target}'`} not found`,
          )
        }
        return { spec, followDefault, target }
      })
      mkdirSync(sessionDir, { recursive: true })
      for (const { spec, target } of resolved)
        recorders.push(
          new TrackRecorder({
            kind: spec.kind,
            path: join(sessionDir, `${spec.kind}.wav`),
            device: target,
            flushIntervalMs: this.opts.flushIntervalMs,
            fileOps: this.fileOps,
            emit: (e, ...a) => this.ev.emit(e, ...a),
          }),
        )
    } catch (e) {
      this.watcher?.stop()
      for (const r of recorders) r.close()
      throw e
    }
    this.tracks = resolved.map(({ spec, followDefault, target }, i) => ({
      spec,
      followDefault,
      rec: recorders[i]!,
      target,
      child: null,
      generation: 0,
      needAnchor: true,
      pendingReason: null,
      carry: null,
      lastDataAt: 0,
      spawnedAt: 0,
      gotData: false,
      retryTimer: null,
      retryDelay: this.opts.retryMinMs,
      attaching: false,
      detaching: false,
      stderrTail: '',
      outageReported: false,
    }))
    if (this.watcher) this.unwatch = this.watcher.onChange((d) => this.onDefaultsChanged(d))
    this.activeSince = performance.now()
    this.setState('recording')
    for (const t of this.tracks) this.spawnChild(t, graph)
    this.tick = setInterval(() => this.supervise(), 100)
  }

  async pause(): Promise<void> {
    if (this._state !== 'recording') return
    this.freezeClock()
    this.setState('paused')
    // Stop the children so the microphone is actually released (GNOME's privacy indicator goes off).
    await Promise.all(this.tracks.map((t) => this.detach(t, null)))
  }

  async resume(): Promise<void> {
    if (this._state !== 'paused') return
    this.activeSince = performance.now()
    this.setState('recording')
    for (const t of this.tracks) void this.attach(t)
  }

  stop(): Promise<CaptureResult> {
    if (!this.stopping) this.stopping = this.doStop()
    return this.stopping
  }

  private async doStop(): Promise<CaptureResult> {
    if (this._state === 'idle') {
      this._state = 'stopped'
      return { tracks: [], durationMs: 0, error: null }
    }
    this.freezeClock()
    const wasFatal = this.fatal !== null
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    this.unwatch?.()
    this.watcher?.stop()
    this._state = 'stopped' // stop accepting new attaches before detaching
    await Promise.all(this.tracks.map((t) => this.detach(t, null)))
    this.closed = true
    const endSample = Math.round(this.elapsedMs() * SAMPLES_PER_MS)
    if (!wasFatal) {
      for (const t of this.tracks) {
        // A track that was detached at the end (device missing, mid-reattach) gets its outage padded;
        // a healthy track only the pipeline latency, if that exceeds the jitter threshold.
        const reason = t.pendingReason
        const threshold = reason ? 0 : this.opts.minGapMs * SAMPLES_PER_MS
        if (endSample - t.rec.position > threshold) {
          try {
            t.rec.padTo(endSample, reason ?? 'latency')
          } catch (e) {
            this.fatal ??= toFatalError(t.spec.kind, e)
          }
        }
      }
    }
    const tracks = this.tracks.map((t) => t.rec.close())
    this.setState(this.fatal ? 'failed' : 'stopped')
    return { tracks, durationMs: Math.round(this.elapsedMs()), error: this.fatal }
  }

  // ------------------------------------------------------------------ supervision

  private supervise(): void {
    if (this._state !== 'recording') return
    const now = performance.now()
    for (const t of this.tracks) {
      if (!t.child || t.detaching) continue
      const silentFor = now - (t.gotData ? t.lastDataAt : t.spawnedAt)
      const limit = t.gotData ? this.opts.stallTimeoutMs : this.opts.attachTimeoutMs
      if (silentFor > limit) {
        this.ev.emit('error', {
          track: t.spec.kind,
          code: 'stall',
          message: `no audio from ${t.target} for ${Math.round(silentFor)} ms; reattaching`,
          fatal: false,
        })
        void this.detach(t, 'stall').then(() => this.attach(t))
      }
    }
  }

  private onDefaultsChanged(d: Defaults): void {
    if (this._state !== 'recording') return
    for (const t of this.tracks) {
      if (!t.followDefault) continue
      const next = defaultFor(t.spec.kind, d)
      if (!next || next === t.target) continue
      void this.detach(t, 'device-changed').then(() => this.attach(t))
    }
  }

  /** Resolve the target and spawn a child, retrying with backoff while the device is missing. */
  private async attach(t: TrackState): Promise<void> {
    if (this._state !== 'recording' || t.child || t.attaching) return
    t.attaching = true
    let graph: GraphSnapshot | null = null
    try {
      graph = await this.snapshot()
    } catch {
      graph = null
    }
    t.attaching = false
    if (this._state !== 'recording' || t.child) return
    const defaults = this.watcher?.current() ?? graph?.defaults
    const target = t.followDefault ? (defaults ? defaultFor(t.spec.kind, defaults) : null) : t.spec.device!
    if (!graph || !target || !graph.nodeNames.has(target)) {
      t.pendingReason = t.pendingReason === 'device-changed' ? 'device-changed' : 'device-missing'
      if (!t.outageReported) {
        t.outageReported = true
        this.ev.emit('error', {
          track: t.spec.kind,
          code: 'device-missing',
          message: graph
            ? `${t.spec.kind} device ${target ?? '(none)'} is not present; waiting`
            : 'pw-dump failed',
          fatal: false,
        })
      }
      this.scheduleRetry(t)
      return
    }
    t.target = target
    this.spawnChild(t, graph)
  }

  private scheduleRetry(t: TrackState): void {
    if (t.retryTimer || this._state !== 'recording') return
    t.retryTimer = setTimeout(() => {
      t.retryTimer = null
      void this.attach(t)
    }, t.retryDelay)
    t.retryDelay = Math.min(this.opts.retryMaxMs, t.retryDelay * 2)
  }

  private spawnChild(t: TrackState, graph: GraphSnapshot): void {
    const target = t.target!
    const isSink = graph.devices.some((d) => d.name === target && d.kind === 'sink')
    const props = [
      'node.dont-fallback=true',
      'node.dont-reconnect=true',
      'node.dont-move=true',
      `node.name=gnomeola-capture-${t.spec.kind}`,
      `node.description="gnomeola ${t.spec.kind} capture"`,
      'media.role=Communication',
      ...(isSink ? ['stream.capture.sink=true'] : []),
    ]
    const args = [
      '--target',
      target,
      '--rate',
      String(SAMPLE_RATE),
      '--channels',
      '1',
      '--format',
      's16',
      '--latency',
      `${this.opts.latencyMs}ms`,
      '-P',
      `{ ${props.join(' ')} }`,
      '--raw',
      '-',
    ]
    const [cmd, argv] = this.unbuffered ? ['stdbuf', ['-o0', 'pw-record', ...args]] : ['pw-record', args]
    const gen = ++t.generation
    const child = spawn(cmd, argv as string[], { stdio: ['ignore', 'pipe', 'pipe'] })
    trackChild(child)
    t.child = child
    t.rec.device = target
    t.carry = null
    t.gotData = false
    t.spawnedAt = performance.now()
    t.needAnchor = true
    t.stderrTail = ''
    child.stdout!.on('data', (buf: Buffer) => {
      if (gen !== t.generation) return
      this.onData(t, buf)
    })
    child.stderr!.on('data', (buf: Buffer) => {
      t.stderrTail = (t.stderrTail + buf.toString()).slice(-2000)
    })
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (gen !== t.generation) return
      this.ev.emit('error', {
        track: t.spec.kind,
        code: err.code ?? 'spawn-failed',
        message: `could not run pw-record: ${err.message}`,
        fatal: false,
      })
    })
    child.on('close', (code, signal) => {
      if (t.child === child) t.child = null
      if (gen !== t.generation || this._state !== 'recording') return
      // Unexpected death: device vanished, pw-record crashed, or someone killed it.
      t.generation++
      t.pendingReason ??= 'child-exit'
      this.ev.emit('error', {
        track: t.spec.kind,
        code: 'child-exit',
        message: `pw-record for ${target} exited (code ${code}, signal ${signal}): ${t.stderrTail.trim().split('\n').slice(-2).join(' | ')}`,
        fatal: false,
      })
      // First retry is immediate; the backoff only grows while attaches keep failing.
      void this.attach(t)
    })
  }

  private onData(t: TrackState, buf: Buffer): void {
    // During stop() children are drained (their output is real audio); only after that is it dropped.
    if (this.closed) return
    // Chunks can split a sample; carry the odd byte over.
    let bytes = buf
    if (t.carry !== null) {
      bytes = Buffer.concat([Buffer.from([t.carry]), buf])
      t.carry = null
    }
    if (bytes.length & 1) {
      t.carry = bytes[bytes.length - 1]!
      bytes = bytes.subarray(0, bytes.length - 1)
    }
    const n = bytes.length >> 1
    if (!n) return
    const samples = new Int16Array(n)
    for (let i = 0; i < n; i++) samples[i] = bytes.readInt16LE(i * 2)
    t.lastDataAt = performance.now()
    t.gotData = true
    try {
      if (t.needAnchor && this._state === 'recording') {
        t.needAnchor = false
        const anchor = Math.round(this.elapsedMs() * SAMPLES_PER_MS) - n
        const shortfall = anchor - t.rec.position
        const threshold = t.pendingReason ? 0 : this.opts.minGapMs * SAMPLES_PER_MS
        if (shortfall > threshold) t.rec.padTo(anchor, t.pendingReason ?? 'latency')
        t.pendingReason = null
        t.retryDelay = this.opts.retryMinMs
        t.outageReported = false
      }
      t.rec.append(samples)
    } catch (e) {
      this.onFatal(toFatalError(t.spec.kind, e))
    }
  }

  /** Stop the track's child (gracefully, draining its output) and mark why the next attach may pad. */
  private async detach(t: TrackState, reason: GapReason | null): Promise<void> {
    if (t.retryTimer) clearTimeout(t.retryTimer)
    t.retryTimer = null
    if (reason) t.pendingReason ??= reason
    const child = t.child
    if (!child || t.detaching) return
    t.detaching = true
    // Keep accepting this child's remaining output (it was captured before the detach), but make its
    // exit an expected one.
    child.removeAllListeners('close')
    const done = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve()
      child.once('close', () => resolve())
    })
    child.kill('SIGTERM')
    child.kill('SIGCONT') // a stopped (hung) child cannot act on SIGTERM until continued
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000)
    await done
    clearTimeout(timer)
    t.generation++
    if (t.child === child) t.child = null
    t.detaching = false
  }

  private onFatal(err: CaptureErrorEvent): void {
    if (this.fatal) return
    this.fatal = err
    this.ev.emit('error', err)
    void this.stop()
  }

  private freezeClock(): void {
    if (this.activeSince !== null) {
      this.activeMsBefore += performance.now() - this.activeSince
      this.activeSince = null
    }
  }

  private setState(s: CaptureState): void {
    this._state = s
    this.ev.emit('state', s)
  }
}

export function defaultFor(kind: TrackKind, d: Defaults): string | null {
  return kind === 'mic' ? d.source : d.sink
}
