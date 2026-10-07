import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { TrackKind } from '@kacola/protocol'
import { floatToInt16, resample } from './resample.ts'
import { TrackRecorder, toFatalError } from './track-recorder.ts'
import {
  type CaptureErrorEvent,
  type CaptureEvents,
  type CaptureResult,
  type CaptureSource,
  type CaptureState,
  Emitter,
  SAMPLE_RATE,
  SAMPLES_PER_MS,
  type StartOptions,
  type TrackSpec,
} from './types.ts'
import { decodeWav } from './wav.ts'
import type { FileOps } from './wav-writer.ts'

// The plan's "FakeCaptureSource": plays per-track WAV files through the exact same TrackRecorder the
// PipeWire source uses (same WAV writer, same level meter, same gap accounting), at wall-clock speed or
// accelerated. Needs no sound server, so hermetic tests anywhere can use it.
//
// Its session timeline is virtual: elapsedMs() is the playback position, not wall time, so a 60 s
// fixture played at 20× reports 60 s. Any input format decodeWav understands is downmixed and
// resampled to 16 kHz mono s16 up front. Tracks shorter than the longest are continued with silence
// (that is what the fixture contains), not reported as gaps.

export type FileFault = { track: TrackKind; atMs: number; durationMs: number }

export type FileCaptureOptions = {
  /** Playback speed factor. 1 = real time, 20 = 20× faster, Infinity = as fast as the event loop allows. */
  speed?: number
  /** Chunk size delivered per tick. Default 100 ms. */
  chunkMs?: number
  flushIntervalMs?: number
  fileOps?: FileOps
  /**
   * Simulated device outages: inside each window the track delivers nothing, and on recovery the
   * TrackRecorder pads + reports a gap with reason `injected` — the same accounting a PipeWire reattach
   * produces, so downstream code can be tested against gaps without a sound server.
   */
  faults?: FileFault[]
  /** 'stop' (default): stop automatically after the longest input ends. 'continue': emit silence until stop(). */
  atEnd?: 'stop' | 'continue'
}

type FileTrack = {
  kind: TrackKind
  rec: TrackRecorder
  pcm: Int16Array
  faults: Array<[number, number]>
  inFault: boolean
}

export class FileCaptureSource implements CaptureSource {
  readonly backend = 'file' as const
  private readonly ev = new Emitter<CaptureEvents>()
  private readonly speed: number
  private readonly chunk: number
  private readonly opts: FileCaptureOptions
  private tracks: FileTrack[] = []
  private _state: CaptureState = 'idle'
  private position = 0
  private total = 0
  private timer: NodeJS.Timeout | NodeJS.Immediate | null = null
  private wallStart = 0
  private posAtWallStart = 0
  private fatal: CaptureErrorEvent | null = null
  private stopping: Promise<CaptureResult> | null = null
  private endResolve!: (r: CaptureResult) => void
  /** Resolves with the result when the source stops for any reason (end of input, stop(), fatal error). */
  readonly done: Promise<CaptureResult>

  constructor(opts: FileCaptureOptions = {}) {
    this.opts = opts
    this.speed = opts.speed ?? 1
    if (!(this.speed > 0)) throw new Error('speed must be > 0')
    this.chunk = Math.round((opts.chunkMs ?? 100) * SAMPLES_PER_MS)
    this.done = new Promise((r) => {
      this.endResolve = r
    })
  }

  get state(): CaptureState {
    return this._state
  }

  on<K extends keyof CaptureEvents>(event: K, fn: (...args: CaptureEvents[K]) => void): () => void {
    return this.ev.on(event, fn)
  }

  elapsedMs(): number {
    return this.position / SAMPLES_PER_MS
  }

  async start(sessionDir: string, specs: readonly TrackSpec[], opts: StartOptions = {}): Promise<void> {
    if (opts.continueAt)
      throw new Error(`the ${this.backend} source cannot continue a recording after a restart`)
    if (this._state !== 'idle') throw new Error(`cannot start from state ${this._state}`)
    const kinds = new Set(specs.map((s) => s.kind))
    if (!specs.length || kinds.size !== specs.length) throw new Error('need one spec per track kind')
    const decoded = specs.map((spec) => {
      if (!spec.device) throw new Error(`file source needs a WAV path for the ${spec.kind} track`)
      const path = resolve(spec.device)
      const wav = decodeWav(readFileSync(path))
      const mono16k =
        wav.sampleRate === SAMPLE_RATE ? wav.samples : resample(wav.samples, wav.sampleRate, SAMPLE_RATE)
      return { spec, path, pcm: floatToInt16(mono16k) }
    })
    mkdirSync(sessionDir, { recursive: true })
    this.tracks = decoded.map(({ spec, path, pcm }) => ({
      kind: spec.kind,
      pcm,
      rec: new TrackRecorder({
        kind: spec.kind,
        path: join(sessionDir, `${spec.kind}.wav`),
        device: `file:${path}`,
        flushIntervalMs: this.opts.flushIntervalMs,
        fileOps: this.opts.fileOps,
        emit: (e, ...a) => this.ev.emit(e, ...a),
      }),
      faults: (this.opts.faults ?? [])
        .filter((f) => f.track === spec.kind)
        .map((f): [number, number] => [
          Math.round(f.atMs * SAMPLES_PER_MS),
          Math.round((f.atMs + f.durationMs) * SAMPLES_PER_MS),
        ])
        .sort((a, b) => a[0] - b[0]),
      inFault: false,
    }))
    this.total = Math.max(...this.tracks.map((t) => t.pcm.length))
    this.setState('recording')
    this.startClock()
  }

  async pause(): Promise<void> {
    if (this._state !== 'recording') return
    this.clearTimer()
    this.setState('paused')
  }

  async resume(): Promise<void> {
    if (this._state !== 'paused') return
    this.setState('recording')
    this.startClock()
  }

  stop(): Promise<CaptureResult> {
    if (!this.stopping) this.stopping = Promise.resolve().then(() => this.doStop())
    return this.stopping
  }

  private doStop(): CaptureResult {
    this.clearTimer()
    if (this._state === 'idle') {
      this._state = 'stopped'
      const r = { tracks: [], durationMs: 0, error: null }
      this.endResolve(r)
      return r
    }
    this._state = 'stopped'
    if (!this.fatal) {
      for (const t of this.tracks) {
        if (t.inFault) {
          try {
            t.rec.padTo(this.position, 'injected')
          } catch (e) {
            this.fatal ??= toFatalError(t.kind, e)
          }
        }
      }
    }
    const tracks = this.tracks.map((t) => t.rec.close())
    this.setState(this.fatal ? 'failed' : 'stopped')
    const result = { tracks, durationMs: Math.round(this.elapsedMs()), error: this.fatal }
    this.endResolve(result)
    return result
  }

  private startClock(): void {
    this.wallStart = performance.now()
    this.posAtWallStart = this.position
    this.schedule()
  }

  private schedule(): void {
    if (this._state !== 'recording') return
    if (!Number.isFinite(this.speed)) {
      this.timer = setImmediate(() => this.step())
      return
    }
    // Drift-free pacing: chunk k is due at wallStart + k·chunk/speed.
    const nextPos = this.position + this.chunk
    const due = this.wallStart + (nextPos - this.posAtWallStart) / SAMPLES_PER_MS / this.speed
    this.timer = setTimeout(() => this.step(), Math.max(0, due - performance.now()))
  }

  private step(): void {
    this.timer = null
    if (this._state !== 'recording') return
    const atEnd = this.opts.atEnd ?? 'stop'
    const end =
      atEnd === 'stop' ? Math.min(this.total, this.position + this.chunk) : this.position + this.chunk
    for (const t of this.tracks) {
      try {
        this.feed(t, this.position, end)
      } catch (e) {
        this.fatal = toFatalError(t.kind, e)
        this.ev.emit('error', this.fatal)
        void this.stop()
        return
      }
    }
    this.position = end
    if (atEnd === 'stop' && this.position >= this.total) {
      void this.stop()
      return
    }
    this.schedule()
  }

  /** Deliver [from, to) of a track, honouring fault windows. */
  private feed(t: FileTrack, from: number, to: number): void {
    let pos = from
    while (pos < to) {
      const fault = t.faults.find(([a, b]) => pos >= a && pos < b)
      if (fault) {
        t.inFault = true
        pos = Math.min(to, fault[1])
        continue
      }
      const nextFault = t.faults.find(([a]) => a > pos)
      const segEnd = Math.min(to, nextFault ? nextFault[0] : to)
      if (t.inFault) {
        t.rec.padTo(pos, 'injected')
        t.inFault = false
      }
      const slice = new Int16Array(segEnd - pos)
      if (pos < t.pcm.length) slice.set(t.pcm.subarray(pos, Math.min(segEnd, t.pcm.length)))
      t.rec.append(slice)
      pos = segEnd
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer as NodeJS.Timeout)
      clearImmediate(this.timer as NodeJS.Immediate)
    }
    this.timer = null
  }

  private setState(s: CaptureState): void {
    this._state = s
    this.ev.emit('state', s)
  }
}
