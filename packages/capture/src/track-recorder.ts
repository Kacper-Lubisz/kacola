import type { Track, TrackKind } from '@gnomeola/protocol'
import { LevelMeter } from './levels.ts'
import type { CaptureErrorEvent, CaptureEvents, GapReason } from './types.ts'
import { LEVEL_WINDOW_SAMPLES, SAMPLE_RATE, SAMPLES_PER_MS } from './types.ts'
import { type FileOps, WavWriteError, WavWriter } from './wav-writer.ts'

// One track's sink for audio, shared by every CaptureSource so that the WAV, the frame stream, the
// level meter and the gap accounting behave identically whichever source feeds them. Sources only
// decide *what* samples arrive and *where on the timeline* they belong; this class enforces the rest.

const MAX_PAD_CHUNK = SAMPLE_RATE // pad in ≤1 s frames so a long gap does not allocate one huge array

export type TrackRecorderOptions = {
  kind: TrackKind
  path: string
  device: string
  flushIntervalMs?: number
  fileOps?: FileOps
  emit: <K extends keyof CaptureEvents>(event: K, ...args: CaptureEvents[K]) => void
}

export class TrackRecorder {
  readonly kind: TrackKind
  readonly path: string
  device: string
  readonly gaps: Track['gaps'] = []
  private readonly writer: WavWriter
  private readonly meter: LevelMeter
  private readonly emit: TrackRecorderOptions['emit']

  constructor(opts: TrackRecorderOptions) {
    this.kind = opts.kind
    this.path = opts.path
    this.device = opts.device
    this.emit = opts.emit
    this.writer = new WavWriter(opts.path, {
      sampleRate: SAMPLE_RATE,
      flushIntervalMs: opts.flushIntervalMs,
      ops: opts.fileOps,
    })
    this.meter = new LevelMeter(LEVEL_WINDOW_SAMPLES, (lvl, end) =>
      this.emit('level', {
        track: this.kind,
        rms: lvl.rms,
        peak: lvl.peak,
        elapsedMs: Math.round(end / SAMPLES_PER_MS),
      }),
    )
  }

  /** Samples on the session timeline so far (real + padded). */
  get position(): number {
    return this.writer.samplesWritten
  }

  get positionMs(): number {
    return this.position / SAMPLES_PER_MS
  }

  /** Append real audio at the current position. Throws WavWriteError on a disk failure. */
  append(samples: Int16Array): void {
    if (!samples.length) return
    const startSample = this.position
    this.writer.write(samples)
    this.frame(samples, startSample, false)
  }

  /**
   * Fill with silence up to `targetSample` and record a gap. Returns the gap length in samples (0 when
   * the track is already at or past the target).
   */
  padTo(targetSample: number, reason: GapReason): number {
    const missing = Math.floor(targetSample) - this.position
    if (missing <= 0) return 0
    const atMs = Math.round(this.positionMs)
    let left = missing
    while (left > 0) {
      const n = Math.min(left, MAX_PAD_CHUNK)
      const silence = new Int16Array(n)
      const startSample = this.position
      this.writer.write(silence)
      this.frame(silence, startSample, true)
      left -= n
    }
    const gap = { atMs, durationMs: Math.round(missing / SAMPLES_PER_MS), reason }
    this.gaps.push(gap)
    this.emit('gap', { track: this.kind, ...gap })
    return missing
  }

  flush(): void {
    this.writer.flush()
  }

  close(): Track {
    this.writer.close()
    return {
      kind: this.kind,
      device: this.device,
      sampleRate: SAMPLE_RATE,
      audioPath: this.path,
      archivePath: null,
      gaps: this.gaps.map((g) => ({ ...g })),
    }
  }

  private frame(samples: Int16Array, startSample: number, synthetic: boolean): void {
    this.emit('frame', {
      track: this.kind,
      samples,
      startSample,
      atMs: Math.round(startSample / SAMPLES_PER_MS),
      synthetic,
    })
    this.meter.push(samples)
  }
}

/** Map an exception from the write path to a fatal capture error. */
export function toFatalError(track: TrackKind | null, e: unknown): CaptureErrorEvent {
  if (e instanceof WavWriteError)
    return {
      track,
      code: e.code,
      message: `${e.message}; recording stopped, audio up to this point is kept`,
      fatal: true,
    }
  return { track, code: 'internal', message: (e as Error)?.message ?? String(e), fatal: true }
}
