import type { Segment, TrackKind } from '@gnomeola/protocol'
import type { DiarizationSession } from './diarize/types.ts'
import { EchoGate, type EchoGateOptions } from './echo-gate.ts'
import {
  type ClosedOut,
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

// The transcription pipeline: VAD + tier 1 + tier 2 + reconciler (+ diarization, M3) behind one small API.
//
//   pipeline.push('mic', pcm, atMs)   16 kHz mono float PCM for one track, with its session offset
//   pipeline.pause(atMs) / resume(atMs) / gap(track, atMs, durationMs, reason)
//   await pipeline.stop(atMs)        flushes both tiers and drains every pending final pass
//
// Events come out through `onEvent` in the order the reconciler produced them. Per chunk the VAD runs
// before tier 1, so segment boundaries exist by the time the words that belong in them arrive.
//
// Attribution (M3). The mic is the user; nothing about it is ever diarized. Two things protect that:
//   · the echo gate silences mic audio that the far end explains (speaker bleed) before VAD sees it, so
//     the far end's words cannot become "me" segments. Mic chunks wait (≤ maxMicHoldMs) for the far-end
//     audio of the same moment to arrive, since the gate needs both.
//   · only far-end segments reach the diarizer: when one closes, its tier-2 request is held while the
//     diarizer looks for a change of speaker inside it (split first, so each piece is transcribed on
//     its own), then each piece is attributed to a speaker cluster. At stop, the diarizer may re-cluster
//     everything; changed attributions are emitted again.

/** A far-end segment attributed to a speaker cluster (ids are stable within the session). */
export type SpeakerOut = {
  type: 'speaker.attributed'
  segmentIds: string[]
  cluster: number
  /** The known voice this cluster was recognised as (A-6), if any. */
  voiceprintId: string | null
  /** True for re-clustering at the end of the session. */
  final: boolean
}

/** The final speaker clusters with their centroids (emitted once, at stop). */
export type ClustersOut = {
  type: 'speaker.clusters'
  model: string
  clusters: {
    cluster: number
    centroid: number[]
    weightMs: number
    segments: number
    voiceprintId: string | null
  }[]
}

export type PipelineEvent = PartialOut | UpsertOut | SpeakerOut | ClustersOut

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
  /** Far-end diarization (M3). Without it the far end stays `them`. */
  diarizer?: DiarizationSession | null
  /** Re-cluster at stop (default true). */
  recluster?: boolean
  /** The echo gate on the mic (default on; it only engages once far-end audio exists). */
  echoGate?: boolean | EchoGateOptions
  /** Longest a mic chunk waits for the far-end audio of the same moment (ms). */
  maxMicHoldMs?: number
}

type TrackRuntime = {
  kind: TrackKind
  vad: VadStream | null
  live: LiveStream | null
  /** Session time of the next sample we expect. */
  nextMs: number
  /** Retained audio for tier 2 and diarization, as int16 runs on the session timeline. */
  runs: { startMs: number; chunks: Int16Array[]; samples: number }[]
}

type DiarJob = { segmentId: string; startMs: number; endMs: number }

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
  // M3
  private readonly diarizer: DiarizationSession | null
  private readonly diarQueue: DiarJob[] = []
  private readonly diarPending = new Set<string>()
  private readonly held = new Map<string, FinalizeRequest>()
  private diarWorker: Promise<void> | null = null
  private splitPieces: ClosedOut[] = []
  readonly gate: EchoGate | null
  private readonly micQueue: { samples: Float32Array; atMs: number }[] = []
  private sawFar = false

  constructor(opts: PipelineOptions) {
    this.opts = opts
    const finalPass = opts.final ? (opts.finalPass ?? 'during') : 'off'
    this.reconciler = new Reconciler({
      sessionId: opts.sessionId,
      finalPass,
      ...(opts.newSegmentId ? { newSegmentId: opts.newSegmentId } : {}),
    })
    this.diarizer = opts.diarizer ?? null
    const g = opts.echoGate ?? true
    this.gate = g === false ? null : new EchoGate(g === true ? {} : g)
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
      echoGate: this.gate ? { ...this.gate.stats } : null,
    }
  }

  push(track: TrackKind, samples: Float32Array, atMs?: number): void {
    if (this.stopped) throw new Error('pipeline stopped')
    if (this.paused) {
      this.droppedWhilePaused += samples.length
      return
    }
    if (this.gate && track === 'system') {
      const at = atMs ?? this.runtime('system').nextMs
      this.sawFar = true
      this.gate.pushFar(samples, at)
      this.pushTrack('system', samples, at)
      this.drainMic(false)
      return
    }
    if (this.gate && track === 'mic' && this.sawFar) {
      const last = this.micQueue.at(-1)
      const at = atMs ?? (last ? last.atMs + samplesToMs(last.samples.length) : this.runtime('mic').nextMs)
      this.micQueue.push({ samples, atMs: at })
      this.drainMic(false)
      return
    }
    this.pushTrack(track, samples, atMs)
  }

  /** Release queued mic chunks the gate can judge now (or all of them, when forced). */
  private drainMic(force: boolean): void {
    if (!this.gate) return
    const hold = this.opts.maxMicHoldMs ?? 300
    const newest = this.micQueue.at(-1)
    const newestEnd = newest ? newest.atMs + samplesToMs(newest.samples.length) : 0
    while (this.micQueue.length) {
      const c = this.micQueue[0]!
      const end = c.atMs + samplesToMs(c.samples.length)
      if (!force && this.gate.farCoverageMs < end && newestEnd - c.atMs <= hold) break
      this.micQueue.shift()
      this.pushTrack('mic', this.gate.processMic(c.samples, c.atMs), c.atMs)
    }
  }

  private pushTrack(track: TrackKind, samples: Float32Array, atMs?: number): void {
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
    this.drainMic(true)
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
    if (track !== 'system') this.drainMic(true)
    const targets = track ? [this.runtime(track)] : [...this.tracks.values()]
    for (const t of targets) this.flushTrack(t)
    this.feed({ type: 'gap', track, atMs, durationMs, reason })
    for (const t of targets) t.nextMs = Math.max(t.nextMs, atMs + durationMs)
  }

  /** Flush both tiers, end the session in the reconciler, and wait for every pending final pass. */
  async stop(atMs?: number): Promise<void> {
    if (this.stopped) return this.idle()
    this.drainMic(true)
    const end = atMs ?? Math.max(0, ...[...this.tracks.values()].map((t) => t.nextMs))
    for (const t of this.tracks.values()) this.flushTrack(t)
    await Promise.all(this.liveWork)
    this.stopped = true
    this.feed({ type: 'end', atMs: end })
    await this.idle()
    if (this.diarizer) await this.finishDiarization()
  }

  /** Resolves when tier-2 and diarization work queued so far has finished. */
  async idle(): Promise<void> {
    while (this.worker || this.diarWorker) await (this.diarWorker ?? this.worker)
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
        if (this.diarPending.has(o.segmentId)) this.held.set(o.segmentId, o)
        else {
          this.queue.push(o)
          this.kick()
        }
      } else if (o.type === 'closed') {
        if (!this.diarizer || o.track !== 'system') continue
        if (o.splitFrom) this.splitPieces.push(o)
        else {
          this.diarQueue.push({ segmentId: o.segmentId, startMs: o.startMs, endMs: o.endMs })
          this.diarPending.add(o.segmentId)
          this.kickDiar()
        }
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

  /** Far-end segments, one at a time in close order: look for a change of speaker, then attribute. */
  private kickDiar(): void {
    if (this.diarWorker || !this.diarizer) return
    const d = this.diarizer
    this.diarWorker = (async () => {
      while (this.diarQueue.length) {
        const job = this.diarQueue.shift()!
        let pieces: DiarJob[] = [job]
        try {
          const pcm = this.retained('system', job.startMs, job.endMs)
          const cuts = await d.changes(job, pcm)
          if (cuts.length) {
            this.splitPieces = []
            // the held request is for the old bounds: drop it; the split asks again per piece
            this.held.delete(job.segmentId)
            this.diarPending.delete(job.segmentId)
            this.feed({ type: 'split', segmentId: job.segmentId, atMs: cuts })
            const first = cuts.filter((c) => c > job.startMs && c < job.endMs).sort((a, b) => a - b)[0]
            if (first !== undefined)
              pieces = [
                { ...job, endMs: first },
                ...this.splitPieces.map((p) => ({
                  segmentId: p.segmentId,
                  startMs: p.startMs,
                  endMs: p.endMs,
                })),
              ]
            this.splitPieces = []
          }
        } catch (err) {
          this.errors.push(err as Error)
        }
        this.release(job.segmentId)
        for (const p of pieces) {
          try {
            const a = await d.assign(p, this.retained('system', p.startMs, p.endMs))
            this.emitAttribution([p.segmentId], a.cluster, false)
          } catch (err) {
            this.errors.push(err as Error)
          }
        }
      }
    })().finally(() => {
      this.diarWorker = null
    })
  }

  /** Let a held tier-2 request go. */
  private release(segmentId: string): void {
    this.diarPending.delete(segmentId)
    const req = this.held.get(segmentId)
    if (!req) return
    this.held.delete(segmentId)
    this.queue.push(req)
    this.kick()
  }

  private emitAttribution(segmentIds: string[], cluster: number, final: boolean): void {
    const info = this.diarizer?.clusters().find((c) => c.cluster === cluster)
    this.opts.onEvent({
      type: 'speaker.attributed',
      segmentIds,
      cluster,
      voiceprintId: info?.voiceprintId ?? null,
      final,
    })
  }

  private async finishDiarization(): Promise<void> {
    const d = this.diarizer!
    if (this.opts.recluster ?? true) {
      try {
        const changed = await d.finish()
        const byCluster = new Map<number, string[]>()
        for (const c of changed) byCluster.set(c.cluster, [...(byCluster.get(c.cluster) ?? []), c.segmentId])
        for (const [cluster, ids] of [...byCluster].sort((a, b) => a[0] - b[0]))
          this.emitAttribution(ids.sort(), cluster, true)
      } catch (err) {
        this.errors.push(err as Error)
      }
    }
    this.opts.onEvent({
      type: 'speaker.clusters',
      model: d.embeddingModel,
      clusters: d.clusters().map((c) => ({
        cluster: c.cluster,
        centroid: [...c.centroid],
        weightMs: c.weightMs,
        segments: c.segments,
        voiceprintId: c.voiceprintId,
      })),
    })
  }

  private retain(t: TrackRuntime, samples: Float32Array): void {
    const needed = this.finalPass !== 'off' || (this.diarizer !== null && t.kind === 'system')
    if (!needed || (this.opts.audioSource && !(this.diarizer && t.kind === 'system'))) return
    const run = t.runs.at(-1)!
    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++)
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * 32767)))
    run.chunks.push(pcm)
    run.samples += pcm.length
  }

  /** Drop retained audio no pending or future final pass (or diarization) can need. */
  private prune(t: TrackRuntime): void {
    if (this.finalPass === 'after') return
    const pad = this.opts.finalPaddingMs ?? 150
    const pendingStarts = [
      ...this.queue.filter((q) => q.track === t.kind).map((q) => q.startMs),
      ...[...this.held.values()].filter((q) => q.track === t.kind).map((q) => q.startMs),
      ...(t.kind === 'system' ? this.diarQueue.map((j) => j.startMs) : []),
    ]
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
    const from = Math.max(0, req.contextFromMs ?? 0, req.startMs - pad)
    const to = Math.min(req.contextToMs ?? Number.POSITIVE_INFINITY, req.endMs + pad)
    if (this.opts.audioSource) return this.opts.audioSource(req.track, from, to)
    return this.retained(req.track, from, to)
  }

  /** Retained audio for [from, to) of a track; silence where none was kept. */
  private retained(track: TrackKind, from: number, to: number): Float32Array {
    const t = this.runtime(track)
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
