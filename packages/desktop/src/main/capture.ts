import type { ExternalCaptureStatus, IngestOptions, IngestResult, PcmFrame } from '@gnomeola/protocol'
import type { CaptureCommand, CaptureState, CaptureTrack } from '../shared/capture.ts'

// In-app capture, main's half (docs/desktop-app.md, "In-app capture"). When the daemon records with the
// `external` backend (macOS always; Linux with GNOMEOLA_CAPTURE=external), it cannot reach the sound
// server itself: it lists each recording that waits for audio at GET /capture/external. This controller
// makes that list true:
//
//   reconcile   whenever something may have changed (a session event, a poll tick, the daemon coming up):
//               for a listed recording, start the tracks this platform can capture in the capture window
//               and stream each to POST /capture/external/:id/:track (protocol ingestPcm); a stream whose
//               recording is no longer listed is stopped.
//   frames      the capture window's frames are numbered here: one epoch per capture run of a track (a new
//               run — restart, device loss — is a new epoch, anchored by the daemon to its wall clock), the
//               sample index counting within it.
//   outages     an ingest request that fails (daemon restarting, a timeout) is retried with backoff and
//               resends the last RESEND_SECONDS of the epoch: delivery is by (epoch, sample), so the daemon
//               drops what it already has and records a gap only for what really never arrived.
//   rotation    ingestPcm ends each request after `rotateMs` and continues in a new one (lossless).
//
// The recording's pause/resume needs nothing here: the daemon discards what arrives while paused.

export const RESEND_SECONDS = 10
const SAMPLE_RATE = 16_000

export type CaptureWindowLike = {
  send(c: CaptureCommand): void
}

export type CaptureDeps = {
  /** GET /capture/external */
  status: () => Promise<ExternalCaptureStatus>
  /** protocol ingestPcm, bound to the daemon's URL and token */
  ingest: (o: Pick<IngestOptions, 'sessionId' | 'track' | 'frames' | 'signal'>) => Promise<IngestResult>
  /** The hidden capture window, created on first use. */
  window: () => CaptureWindowLike
  /** Which tracks this platform can capture (macOS: both; Linux Chromium has no loopback: mic). */
  tracks: readonly CaptureTrack[]
  newEpoch?: () => number
  log?: (line: Record<string, unknown>) => void
  retryMs?: (attempt: number) => number
  /** After a capture error, how long before the track is opened again (default 5 s). */
  cooldownMs?: number
}

/** One track of one recording: numbered frames, a resend window, and the ingest loop. */
class TrackStream {
  readonly track: CaptureTrack
  readonly sessionId: string
  epoch = 0
  private next = 0
  /** Every frame gets a sequence number: the order they are sent in, across epochs. */
  private seq = 0
  /** The last RESEND_SECONDS of frames, oldest first (may span an epoch change). */
  private ring: { seq: number; frame: PcmFrame }[] = []
  private ringSamples = 0
  private wake: (() => void) | null = null
  stopped = false
  result: IngestResult | null = null
  errors = 0
  readonly done: Promise<void>

  private readonly deps: CaptureDeps
  private readonly onEnded: (s: TrackStream, why: string) => void

  constructor(
    sessionId: string,
    track: CaptureTrack,
    deps: CaptureDeps,
    onEnded: (s: TrackStream, why: string) => void,
  ) {
    this.sessionId = sessionId
    this.track = track
    this.deps = deps
    this.onEnded = onEnded
    this.newEpoch()
    this.done = this.loop()
  }

  /** Samples pushed in the current epoch. */
  get position(): number {
    return this.next
  }

  newEpoch(): void {
    this.epoch = this.deps.newEpoch?.() ?? (Math.random() * 0xffffffff) >>> 0
    this.next = 0
  }

  push(samples: Int16Array): void {
    if (this.stopped) return
    const frame: PcmFrame = { epoch: this.epoch, sample: this.next, samples }
    this.next += samples.length
    this.ring.push({ seq: this.seq++, frame })
    this.ringSamples += samples.length
    while (this.ringSamples - (this.ring[0]?.frame.samples.length ?? 0) >= RESEND_SECONDS * SAMPLE_RATE) {
      this.ringSamples -= this.ring.shift()!.frame.samples.length
    }
    this.wake?.()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.wake?.()
  }

  /**
   * One request's frames: from the oldest kept frame of the current epoch (a reconnect resends what the
   * daemon may have missed; an older epoch is never resent — the daemon would re-anchor on it), then
   * every frame as it comes, in order.
   */
  private async *frames(): AsyncGenerator<PcmFrame> {
    let cursor = this.ring.find((x) => x.frame.epoch === this.epoch)?.seq ?? this.seq
    for (;;) {
      if (this.stopped) return
      const e = this.ring.find((x) => x.seq >= cursor)
      if (e) {
        cursor = e.seq + 1
        yield e.frame
        continue
      }
      await new Promise<void>((r) => {
        this.wake = r
      })
      this.wake = null
    }
  }

  private async loop(): Promise<void> {
    let attempt = 0
    while (!this.stopped) {
      const since = Date.now()
      try {
        const r = await this.deps.ingest({
          sessionId: this.sessionId,
          track: this.track,
          frames: this.frames(),
        })
        this.result = r
        if (r.ended !== 'client') return this.onEnded(this, r.ended)
        if (this.stopped) return
      } catch (err) {
        if (this.stopped) return
        this.errors++
        this.deps.log?.({ event: 'capture', kind: 'ingest-error', track: this.track, error: String(err) })
        // a request that ran for a while was a working connection: back off from scratch
        if (Date.now() - since > 10_000) attempt = 0
        const ms = this.deps.retryMs?.(attempt) ?? Math.min(250 * 2 ** attempt, 5000)
        attempt++
        await new Promise((r) => setTimeout(r, ms))
      }
    }
  }
}

export type CaptureSnapshot = {
  sessionId: string | null
  tracks: { track: CaptureTrack; epoch: number; state: string; errors: number; detail?: string }[]
}

export class CaptureController {
  private streams = new Map<CaptureTrack, TrackStream>()
  private states = new Map<CaptureTrack, CaptureState>()
  private sessionId: string | null = null
  /** A track whose capture failed is retried by a later reconcile, not before this (ms epoch). */
  private cooldown = new Map<CaptureTrack, number>()
  private busy: Promise<void> | null = null
  private again = false
  private readonly deps: CaptureDeps

  constructor(deps: CaptureDeps) {
    this.deps = deps
  }

  /** Bring the capture in line with what the daemon waits for. Coalesces overlapping calls. */
  reconcile(): Promise<void> {
    if (this.busy) {
      this.again = true
      return this.busy
    }
    this.busy = (async () => {
      do {
        this.again = false
        await this.reconcileOnce().catch((err: unknown) =>
          this.deps.log?.({ event: 'capture', kind: 'status-error', error: String(err) }),
        )
      } while (this.again)
    })().finally(() => {
      this.busy = null
    })
    return this.busy
  }

  private async reconcileOnce(): Promise<void> {
    const { captures } = await this.deps.status()
    // one recording at a time: the first listed one (the daemon never records two)
    const want = captures[0] ?? null
    if (this.sessionId && this.sessionId !== want?.sessionId) this.stopAll('not waiting any more')
    if (!want) return
    this.sessionId = want.sessionId
    const listed = new Set(want.tracks.map((t) => t.kind as CaptureTrack))
    for (const track of this.deps.tracks) {
      if (!listed.has(track) || this.streams.has(track)) continue
      if ((this.cooldown.get(track) ?? 0) > Date.now()) continue
      const s = new TrackStream(want.sessionId, track, this.deps, (st, why) => this.ended(st, why))
      this.streams.set(track, s)
      this.deps.log?.({ event: 'capture', kind: 'start', sessionId: want.sessionId, track, epoch: s.epoch })
      this.deps.window().send({ type: 'start', track })
    }
  }

  private ended(s: TrackStream, why: string): void {
    if (this.streams.get(s.track) !== s) return
    this.deps.log?.({ event: 'capture', kind: 'ended', track: s.track, why })
    this.streams.delete(s.track)
    s.stop()
    this.deps.window().send({ type: 'stop', track: s.track })
    if (!this.streams.size) this.sessionId = null
  }

  private stopAll(why: string): void {
    for (const s of [...this.streams.values()]) this.ended(s, why)
    this.sessionId = null
  }

  /** A frame from the capture window (s16 LE, 16 kHz). */
  onFrame(track: CaptureTrack, samples: Int16Array): void {
    this.streams.get(track)?.push(samples)
  }

  /** The capture window's report: a (re)started run is a new epoch; an error stops that track's run. */
  onState(s: CaptureState): void {
    this.states.set(s.track, s)
    const stream = this.streams.get(s.track)
    this.deps.log?.({ event: 'capture', kind: 'state', ...s })
    if (!stream) return
    // a run that restarted (device lost and reopened) is a new epoch; the first run keeps the initial one
    if (s.state === 'running' && stream.position > 0) stream.newEpoch()
    if (s.state === 'error') {
      // the device went away or was refused: end this run; a later reconcile opens a new one (new epoch)
      this.cooldown.set(s.track, Date.now() + (this.deps.cooldownMs ?? 5000))
      this.ended(stream, `capture error: ${s.detail}`)
    }
  }

  /** Stop everything (quit). */
  async stop(): Promise<void> {
    const all = [...this.streams.values()]
    this.stopAll('quit')
    await Promise.all(all.map((s) => s.done))
  }

  snapshot(): CaptureSnapshot {
    return {
      sessionId: this.sessionId,
      tracks: this.deps.tracks.map((track) => {
        const s = this.streams.get(track)
        const st = this.states.get(track)
        return {
          track,
          epoch: s?.epoch ?? 0,
          state: s ? (st?.state ?? 'starting') : 'idle',
          errors: s?.errors ?? 0,
          ...(st?.state === 'error' ? { detail: st.detail } : {}),
        }
      }),
    }
  }
}

/** The tracks the capture window can open on this platform (GNOMEOLA_CAPTURE_TRACKS overrides, tests). */
export function captureTracks(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): CaptureTrack[] {
  const o = env.GNOMEOLA_CAPTURE_TRACKS
  if (o) return o.split(',').filter((t): t is CaptureTrack => t === 'mic' || t === 'system')
  return platform === 'darwin' ? ['mic', 'system'] : ['mic']
}
