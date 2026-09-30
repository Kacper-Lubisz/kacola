import type { Track, TrackKind } from '@gnomeola/protocol'

// The capture contract every source implements — PipeWire in production, files in hermetic tests.
//
// Format: 16 kHz, mono, signed 16-bit PCM, delivered as Int16Array. Int16 because that is what
// pw-record emits and what the WAV stores, so the live stream and the file are bit-identical and no
// conversion happens on the hot path; STT consumers that want float divide by 32768.
//
// Timeline: every timestamp is on the *session timeline* — milliseconds of active recording since
// start(), with paused time excluded. Sample n of a track's WAV is at n / 16 ms on that timeline, for
// both tracks, so the two WAVs line up sample-for-sample.
//
// Gaps: when a track loses its device (the pw-record child dies, the default device changes, the node
// disappears, the stream stalls) the missing time is filled with digital silence, both in the WAV and
// in the frame stream, and reported as a `gap` event and in Track.gaps. The timeline therefore stays
// continuous and aligned across tracks, and a consumer can always tell real silence from missing audio.
// Invariant: the samples of a track = real samples + Σ gap samples, and Σ over time = session duration.

export const SAMPLE_RATE = 16_000
export const SAMPLES_PER_MS = SAMPLE_RATE / 1000
/** Level windows are 100 ms. */
export const LEVEL_WINDOW_SAMPLES = SAMPLE_RATE / 10

export type TrackSpec = {
  kind: TrackKind
  /**
   * PipeWire: a node.name, or undefined / 'default' to follow the default source (mic) or default sink
   * (system — its monitor is recorded). File source: path of the WAV to play back.
   */
  device?: string
}

export type PcmFrame = {
  track: TrackKind
  /** 16 kHz mono s16. Owned by the receiver; the source never reuses it. */
  samples: Int16Array
  /** Index of samples[0] on the session timeline. */
  startSample: number
  /** startSample in ms. */
  atMs: number
  /** True for silence inserted to cover a gap. */
  synthetic: boolean
}

export type LevelEvent = {
  track: TrackKind
  rms: number
  peak: number
  /** End of the 100 ms window, on the session timeline. Matches protocol `audio.level.elapsedMs`. */
  elapsedMs: number
}

export type GapReason =
  | 'child-exit' // pw-record died
  | 'device-changed' // the default device moved; reattached to the new one
  | 'device-missing' // the target node is gone (and has not come back yet, or came back later)
  | 'stall' // attached but no audio arrived for too long
  | 'latency' // start/resume/stop latency (or clock drift) larger than the jitter threshold
  | 'injected' // FileCaptureSource fault injection
  | 'disconnected' // ExternalCaptureSource: the app's stream went away (or never came)
  | 'client-drop' // ExternalCaptureSource: the app skipped samples (its sample index jumped ahead)

export type GapEvent = { track: TrackKind; atMs: number; durationMs: number; reason: GapReason }

export type CaptureErrorEvent = {
  track: TrackKind | null
  /** errno-style code where there is one (ENOSPC, ENOENT) or a capture-specific one. */
  code: string
  message: string
  /** Fatal errors stop the source; `stop()` has already run (or is running) when this fires. */
  fatal: boolean
}

export type CaptureState = 'idle' | 'recording' | 'paused' | 'stopped' | 'failed'

export type CaptureEvents = {
  frame: [PcmFrame]
  level: [LevelEvent]
  gap: [GapEvent]
  error: [CaptureErrorEvent]
  state: [CaptureState]
}

export type CaptureResult = {
  /** Protocol tracks: resolved device, WAV path, gaps. archivePath is always null here. */
  tracks: Track[]
  /** Session timeline length (active time, pauses excluded). */
  durationMs: number
  /** Set when the capture ended because of a fatal error. */
  error: CaptureErrorEvent | null
}

export interface CaptureSource {
  readonly backend: 'pipewire' | 'file' | 'external'
  readonly state: CaptureState
  /** Starts every track and writes `<sessionDir>/<kind>.wav`. Rejects if a track cannot start at all. */
  start(sessionDir: string, tracks: readonly TrackSpec[]): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  /** Stops, finalises the WAVs, and reports the tracks. Idempotent. */
  stop(): Promise<CaptureResult>
  /** Active ms on the session timeline so far. */
  elapsedMs(): number
  on<K extends keyof CaptureEvents>(event: K, fn: (...args: CaptureEvents[K]) => void): () => void
}

/**
 * A minimal typed emitter. Unlike node's EventEmitter an `error` event with no listener is not thrown —
 * a recorder must never crash its host because nobody subscribed to a warning.
 */
export class Emitter<E extends Record<string, unknown[]>> {
  private readonly listeners = new Map<keyof E, Set<(...args: never[]) => void>>()

  on<K extends keyof E>(event: K, fn: (...args: E[K]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn as unknown as (...args: never[]) => void)
    return () => set.delete(fn as unknown as (...args: never[]) => void)
  }

  emit<K extends keyof E>(event: K, ...args: E[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of [...set]) {
      try {
        ;(fn as unknown as (...a: E[K]) => void)(...args)
      } catch (e) {
        // A throwing listener must not break capture (or crash the host); surface it as a warning.
        process.emitWarning(`capture listener for '${String(event)}' threw: ${(e as Error)?.stack ?? e}`)
      }
    }
  }
}
