import type { Segment, TrackKind } from '@gnomeola/protocol'
import {
  type FinalizeRequest,
  type FinalPass,
  type PartialOut,
  Reconciler,
  type ReconcilerInput,
  type ReconcilerOutput,
  type UpsertOut,
} from './reconciler.ts'
import {
  type FinalTranscriber,
  type LiveRecognizer,
  type LiveStream,
  msToSamples,
  SAMPLE_RATE,
  samplesToMs,
  type VadStream,
  type VoiceActivityDetector,
} from './types.ts'

// The transcription pipeline: VAD + tier 1 + tier 2 + reconciler behind one small API.
//
//   pipeline.push('mic', pcm, atMs)   16 kHz mono float PCM for one track, with its session offset
//   pipeline.pause(atMs) / resume(atMs) / gap(track, atMs, durationMs, reason)
//   await pipeline.stop(atMs)        flushes both tiers and drains every pending final pass
//
// Events come out through `onEvent` in the order the reconciler produced them. Per chunk the VAD runs
// before tier 1, so segment boundaries exist by the time the words that belong in them arrive.

export type PipelineEvent = PartialOut | UpsertOut

/** Supplies tier-2 audio when the in-memory buffer is not enough (e.g. `after` on a long session). */
export type AudioSource = (track: TrackKind, startMs: number, endMs: number) => Promise<Float32Array>

export type PipelineOptions = {
  sessionId: string
  live: LiveRecognizer
  vad: VoiceActivityDetector
  final?: FinalTranscriber | null
  finalPass?: FinalPass
  onEvent: (e: PipelineEvent) => void
  newSegmentId?: () => string
  /** Context added either side of a segment for the final pass (never changes segment bounds). */
  finalPaddingMs?: number
  /** A push whose `atMs` is this far past where the track's audio ended is treated as a gap. */
  gapToleranceMs?: number
  audioSource?: AudioSource
  /** Observability hook for every reconciler input (tests, tracing). */
  onInput?: (i: ReconcilerInput) => void
}

type TrackRuntime = {
  kind: TrackKind
  vad: VadStream | null
  live: LiveStream | null
  /** Session time of the next sample we expect. */
  nextMs: number
  /** Retained audio for tier 2, as int16 runs on the session timeline. */
  runs: { startMs: number; chunks: Int16Array[]; samples: number }[]
}

export class TranscriptionPipeline {
  readonly reconciler: Reconciler
  private readonly opts: PipelineOptions
  private readonly tracks = new Map<TrackKind, TrackRuntime>()
  private readonly queue: FinalizeRequest[] = []
  private worker: Promise<void> | null = null
  private readonly liveWork = new Set<Promise<void>>()
  private paused = false
  private stopped = false
  private droppedWhilePaused = 0
  readonly errors: Error[] = []

  constructor(opts: PipelineOptions) {
    this.opts = opts
    const finalPass = opts.final ? (opts.finalPass ?? 'during') : 'off'
    this.reconciler = new Reconciler({
      sessionId: opts.sessionId,
      finalPass,
      ...(opts.newSegmentId ? { newSegmentId: opts.newSegmentId } : {}),
    })
  }

  get finalPass(): FinalPass {
    return this.reconciler.finalPass
  }

  segments(): Segment[] {
    return this.reconciler.segments()
  }

  stats() {
    return {
      ...this.reconciler.stats,
      queuedFinals: this.queue.length,
      droppedWhilePausedSamples: this.droppedWhilePaused,
    }
  }

  push(track: TrackKind, samples: Float32Array, atMs?: number): void {
    if (this.stopped) throw new Error('pipeline stopped')
    if (this.paused) {
      this.droppedWhilePaused += samples.length
      return
    }
    const t = this.runtime(track)
    const tol = this.opts.gapToleranceMs ?? 250
    if (atMs !== undefined && t.vad && atMs > t.nextMs + tol) {
      this.gap(track, t.nextMs, atMs - t.nextMs, 'discontinuity')
    }
    if (!t.vad || !t.live) this.startStreams(t, atMs ?? t.nextMs)
    this.retain(t, samples)
    t.vad!.accept(samples)
    const r = t.live!.accept(samples)
    if (r) this.trackLive(r)
    t.nextMs += samplesToMs(samples.length)
    this.prune(t)
  }

  pause(atMs: number): void {
    if (this.paused || this.stopped) return
    for (const t of this.tracks.values()) this.flushTrack(t)
    this.feed({ type: 'pause', atMs })
    this.paused = true
  }

  resume(atMs: number): void {
    if (!this.paused || this.stopped) return
    this.paused = false
    this.feed({ type: 'resume', atMs })
    for (const t of this.tracks.values()) t.nextMs = Math.max(t.nextMs, atMs)
  }

  /** A recorded gap (device switch, suspend): audio for [atMs, atMs + durationMs) never arrived. */
  gap(track: TrackKind | null, atMs: number, durationMs: number, reason: string): void {
    const targets = track ? [this.runtime(track)] : [...this.tracks.values()]
    for (const t of targets) this.flushTrack(t)
    this.feed({ type: 'gap', track, atMs, durationMs, reason })
    for (const t of targets) t.nextMs = Math.max(t.nextMs, atMs + durationMs)
  }

  /** Flush both tiers, end the session in the reconciler, and wait for every pending final pass. */
  async stop(atMs?: number): Promise<void> {
    if (this.stopped) return this.idle()
    const end = atMs ?? Math.max(0, ...[...this.tracks.values()].map((t) => t.nextMs))
    for (const t of this.tracks.values()) this.flushTrack(t)
    await Promise.all(this.liveWork)
    this.stopped = true
    this.feed({ type: 'end', atMs: end })
    await this.idle()
  }

  /** Resolves when tier-2 work queued so far has finished. */
  async idle(): Promise<void> {
    while (this.worker) await this.worker
  }

  // ------------------------------------------------------------------------------------ internals

  private runtime(track: TrackKind): TrackRuntime {
    let t = this.tracks.get(track)
    if (!t) {
      t = { kind: track, vad: null, live: null, nextMs: 0, runs: [] }
      this.tracks.set(track, t)
    }
    return t
  }

  private startStreams(t: TrackRuntime, atMs: number): void {
    t.nextMs = atMs
    t.vad = this.opts.vad.createStream({
      track: t.kind,
      startMs: atMs,
      onEvent: (e) =>
        this.feed(
          e.kind === 'start'
            ? { type: 'vad.start', track: e.track, atMs: e.atMs }
            : { type: 'vad.end', track: e.track, startMs: e.startMs, endMs: e.endMs },
        ),
    })
    t.live = this.opts.live.createStream({
      track: t.kind,
      startMs: atMs,
      onHypothesis: (hyp) => this.feed({ type: 'live', hyp }),
    })
    t.runs.push({ startMs: atMs, chunks: [], samples: 0 })
  }

  private flushTrack(t: TrackRuntime): void {
    if (t.vad) t.vad.flush()
    if (t.live) {
      const r = t.live.flush()
      if (r) this.trackLive(r)
    }
    t.vad = null
    t.live = null
  }

  private trackLive(p: Promise<void>): void {
    const w = p.catch((err: Error) => {
      this.errors.push(err)
    })
    this.liveWork.add(w)
    void w.finally(() => this.liveWork.delete(w))
  }

  private feed(input: ReconcilerInput): void {
    this.opts.onInput?.(input)
    this.handle(this.reconciler.step(input))
  }

  private handle(outs: ReconcilerOutput[]): void {
    for (const o of outs) {
      if (o.type === 'finalize') {
        this.queue.push(o)
        this.kick()
      } else this.opts.onEvent(o)
    }
  }

  private kick(): void {
    if (this.worker) return
    this.worker = (async () => {
      while (this.queue.length) {
        const req = this.queue.shift()!
        try {
          const pcm = await this.audioFor(req)
          const r = await this.opts.final!.transcribe(pcm)
          this.feed({ type: 'final', segmentId: req.segmentId, text: r.text, confidence: r.confidence })
        } catch (err) {
          this.errors.push(err as Error)
          this.feed({ type: 'final.failed', segmentId: req.segmentId, error: (err as Error).message })
        }
      }
    })().finally(() => {
      this.worker = null
    })
  }

  private retain(t: TrackRuntime, samples: Float32Array): void {
    if (this.finalPass === 'off' || this.opts.audioSource) return
    const run = t.runs.at(-1)!
    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++)
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * 32767)))
    run.chunks.push(pcm)
    run.samples += pcm.length
  }

  /** Drop retained audio no pending or future final pass can need. */
  private prune(t: TrackRuntime): void {
    if (this.finalPass !== 'during') return
    const pad = this.opts.finalPaddingMs ?? 150
    const pendingStarts = this.queue.filter((q) => q.track === t.kind).map((q) => q.startMs)
    // Keep a generous window for the segment still open (VAD caps speech at ~20 s).
    const keepFrom = Math.min(t.nextMs - 60_000, ...pendingStarts) - pad
    while (t.runs.length > 1 && runEnd(t.runs[0]!) < keepFrom) t.runs.shift()
    const run = t.runs[0]
    if (!run) return
    while (run.chunks.length > 1 && run.startMs + samplesToMs(run.chunks[0]!.length) < keepFrom) {
      const c = run.chunks.shift()!
      run.startMs += samplesToMs(c.length)
      run.samples -= c.length
    }
  }

  private async audioFor(req: FinalizeRequest): Promise<Float32Array> {
    const pad = this.opts.finalPaddingMs ?? 150
    const from = Math.max(0, req.startMs - pad)
    const to = req.endMs + pad
    if (this.opts.audioSource) return this.opts.audioSource(req.track, from, to)
    const t = this.runtime(req.track)
    const out = new Float32Array(Math.max(0, msToSamples(to - from)))
    for (const run of t.runs) {
      const runStart = run.startMs
      if (runEnd(run) <= from || runStart >= to) continue
      let offset = 0
      for (const c of run.chunks) {
        const cStart = runStart + samplesToMs(offset)
        offset += c.length
        const cEnd = runStart + samplesToMs(offset)
        if (cEnd <= from || cStart >= to) continue
        for (let i = 0; i < c.length; i++) {
          const ms = cStart + samplesToMs(i)
          if (ms < from || ms >= to) continue
          const idx = msToSamples(ms - from)
          if (idx < out.length) out[idx] = c[i]! / 32768
        }
      }
    }
    return out
  }
}

const runEnd = (r: { startMs: number; samples: number }): number =>
  r.startMs + (r.samples * 1000) / SAMPLE_RATE
