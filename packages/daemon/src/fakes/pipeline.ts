import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { newId, type Track, type TrackKind } from '@gnomeola/protocol'
import type {
  KnownVoice,
  PipelineSink,
  PipelineStartOptions,
  RecordingHandle,
  SegmentUpsert,
  SpeakerVoices,
  TranscriptionPipeline,
} from '../interfaces.ts'

// A capture + STT stand-in that behaves like the real thing from the daemon's point of view: levels
// and partials at a steady cadence, segments that close every so often per track and are later revised
// live → final, pause/resume that freeze audio time, and a stop() that flushes. Its output satisfies the
// segment invariants by construction (non-overlapping per track, inside the session, mic = me).

export type FakePipelineOptions = {
  /** Wall-clock tick. */
  tickMs?: number
  levelEveryMs?: number
  partialEveryMs?: number
  /** A segment closes on each track every this many ms of audio. */
  segmentEveryMs?: number
  /** Wall ms after which a live segment is re-emitted as final. */
  finalizeAfterMs?: number
  /** Audio ms per wall ms. */
  speed?: number
  /** Emit a fatal error after this much audio. */
  failAfterMs?: number
  /** Emit a gap on the system track at this audio offset. */
  gapAtMs?: number
  /** Delay before start() resolves (models warming up). */
  startDelayMs?: number
  /** Make start() reject with this message. */
  failStart?: string
  /**
   * Diarize the far end (M3): system segments cycle through FAKE_VOICES speakers in a fixed pattern,
   * each voice a fixed embedding, recognised against the recording's known voices like the real thing.
   */
  diarize?: boolean
}

/** The fake far end's voices: one-hot embeddings of the `fake-embedding` model. */
export const FAKE_EMBEDDING_MODEL = 'fake-embedding'
export const FAKE_VOICES = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
]
/** Which fake voice speaks the n-th far-end segment. */
export const fakeVoiceFor = (n: number): number => [0, 1, 1, 0, 2, 0, 1][n % 7]!

const WORDS = (
  'the retry budget is three attempts then dead letter we ship the migration on thursday ' +
  'dashboard latency looks fine ana will take the on call rota and ben owns the rollout plan ' +
  'let us revisit the incident review next week because the alert fired twice'
).split(' ')

export class FakePipeline implements TranscriptionPipeline {
  readonly opts: Required<Omit<FakePipelineOptions, 'failAfterMs' | 'gapAtMs' | 'failStart' | 'diarize'>> &
    Pick<FakePipelineOptions, 'failAfterMs' | 'gapAtMs' | 'failStart' | 'diarize'>
  /** Every recording this pipeline started, for assertions. */
  readonly recordings: FakeRecording[] = []

  constructor(opts: FakePipelineOptions = {}) {
    this.opts = {
      tickMs: 20,
      levelEveryMs: 100,
      partialEveryMs: 80,
      segmentEveryMs: 300,
      finalizeAfterMs: 250,
      speed: 1,
      startDelayMs: 0,
      ...opts,
    }
  }

  async health() {
    return { available: true, backend: 'fake', detail: null }
  }

  async start(o: PipelineStartOptions, sink: PipelineSink): Promise<RecordingHandle> {
    if (this.opts.startDelayMs) await new Promise((r) => setTimeout(r, this.opts.startDelayMs))
    if (this.opts.failStart) throw new Error(this.opts.failStart)
    const rec = new FakeRecording(o, sink, this.opts)
    this.recordings.push(rec)
    return rec
  }
}

type OpenSeg = { startMs: number; words: string[]; nextCloseAt: number; lastPartialAt: number }

export class FakeRecording implements RecordingHandle {
  readonly tracks: Track[]
  private readonly sink: PipelineSink
  private readonly o: FakePipeline['opts']
  private timer: NodeJS.Timeout | null = null
  private readonly finalizers = new Set<NodeJS.Timeout>()
  private readonly pendingFinal = new Map<string, SegmentUpsert>()
  private activeWallMs = 0
  private lastTick = 0
  private lastLevelAt = 0
  private word = 0
  private failed = false
  private gapped = false
  private readonly open = new Map<TrackKind, OpenSeg>()
  private readonly known: KnownVoice[]
  private farSegments = 0
  /** The option, and the user's setting (settings.speakers.diarize), both on. */
  private readonly diarize: boolean
  /** Fake voice index → the known voice it was recognised as (null: nobody we know). */
  private readonly recognised = new Map<number, string | null>()
  private readonly heard = new Map<number, string>()
  stopped = false
  paused = false
  emitted = 0

  constructor(opts: PipelineStartOptions, sink: PipelineSink, o: FakePipeline['opts']) {
    this.sink = sink
    this.o = o
    this.diarize = Boolean(o.diarize) && (opts.settings.speakers?.diarize ?? true)
    this.known = (opts.voices ?? []).filter((v) => v.model === FAKE_EMBEDDING_MODEL)
    mkdirSync(opts.sessionDir, { recursive: true })
    this.tracks = opts.tracks.map((t) => {
      const audioPath = join(opts.sessionDir, `${t.kind}.wav`)
      writeFileSync(audioPath, '')
      return {
        kind: t.kind,
        device: t.device === 'default' ? `fake.${t.kind}` : t.device,
        sampleRate: 16000,
        audioPath,
        archivePath: null,
        gaps: [],
      }
    })
    // stagger the tracks so segments on mic and system do not close in lock-step
    this.tracks.forEach((t, i) => {
      this.open.set(t.kind, {
        startMs: 0,
        words: [],
        nextCloseAt: o.segmentEveryMs * (1 + i * 0.5),
        lastPartialAt: 0,
      })
    })
    this.lastTick = Date.now()
    this.timer = setInterval(() => this.tick(), o.tickMs)
  }

  private audioMs(): number {
    return Math.floor(this.activeWallMs * this.o.speed)
  }

  private tick(): void {
    const now = Date.now()
    if (!this.paused) this.activeWallMs += now - this.lastTick
    this.lastTick = now
    if (this.paused || this.stopped) return
    const t = this.audioMs()

    if (this.o.failAfterMs !== undefined && t >= this.o.failAfterMs && !this.failed) {
      this.failed = true
      this.sink.error({ message: 'fake capture device vanished', fatal: true })
      return
    }
    if (this.o.gapAtMs !== undefined && t >= this.o.gapAtMs && !this.gapped) {
      this.gapped = true
      this.sink.gap({
        track: 'system',
        atMs: this.o.gapAtMs,
        durationMs: 120,
        reason: 'default sink changed',
      })
    }
    if (t - this.lastLevelAt >= this.o.levelEveryMs) {
      this.lastLevelAt = t
      for (const tr of this.tracks) {
        const rms = 0.1 + 0.3 * Math.abs(Math.sin(t / 700 + (tr.kind === 'mic' ? 0 : 1)))
        this.sink.level({ track: tr.kind, rms, peak: Math.min(1, rms * 1.8), elapsedMs: t })
      }
    }
    for (const tr of this.tracks) {
      const seg = this.open.get(tr.kind)!
      if (t - seg.lastPartialAt >= this.o.partialEveryMs) {
        seg.lastPartialAt = t
        seg.words.push(WORDS[this.word++ % WORDS.length]!)
        this.sink.partial({
          track: tr.kind,
          speaker: speaker(tr.kind),
          startMs: seg.startMs,
          text: seg.words.join(' '),
        })
      }
      if (t >= seg.nextCloseAt) this.close(tr.kind, t)
    }
  }

  /** Close the open segment on a track at audio time `t` and schedule its final revision. */
  private close(track: TrackKind, t: number): void {
    const seg = this.open.get(track)!
    if (t > seg.startMs) {
      if (!seg.words.length) seg.words.push(WORDS[this.word++ % WORDS.length]!)
      const live: SegmentUpsert = {
        id: newId('seg'),
        track,
        speaker: speaker(track),
        startMs: seg.startMs,
        endMs: t,
        text: seg.words.join(' '),
        quality: 'live',
        confidence: 0.6,
      }
      this.sink.segment(live)
      this.emitted++
      if (track === 'system' && this.diarize) this.attribute(live.id)
      const fin: SegmentUpsert = { ...live, text: capitalise(live.text), quality: 'final', confidence: 0.92 }
      this.pendingFinal.set(live.id, fin)
      const timer = setTimeout(() => {
        this.finalizers.delete(timer)
        this.finalise(live.id)
      }, this.o.finalizeAfterMs)
      this.finalizers.add(timer)
    }
    this.open.set(track, { startMs: t, words: [], nextCloseAt: t + this.o.segmentEveryMs, lastPartialAt: t })
  }

  /** The far-end segment just published: which (fake) voice it is, as the real diarizer would say. */
  private attribute(segmentId: string): void {
    const v = fakeVoiceFor(this.farSegments++)
    if (!this.recognised.has(v)) {
      const match = this.known.find((k) => cos(k.embedding, FAKE_VOICES[v]!) >= 0.6)
      this.recognised.set(v, match?.id ?? null)
    }
    const speakerId = this.sink.speaker({ key: String(v), voiceprintId: this.recognised.get(v)! })
    if (!speakerId) return
    this.heard.set(v, speakerId)
    this.sink.attribute({ speakerId, segmentIds: [segmentId] })
  }

  voices(): SpeakerVoices | null {
    if (!this.diarize) return null
    return {
      model: FAKE_EMBEDDING_MODEL,
      voices: [...this.heard].map(([v, speakerId]) => ({
        speakerId,
        embedding: FAKE_VOICES[v]!,
        weightMs: 1000,
      })),
    }
  }

  private finalise(id: string): void {
    const fin = this.pendingFinal.get(id)
    if (!fin) return
    this.pendingFinal.delete(id)
    this.sink.segment(fin)
  }

  async pause(): Promise<void> {
    this.tick()
    this.paused = true
  }

  async resume(): Promise<void> {
    this.lastTick = Date.now()
    this.paused = false
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.tick()
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    // flush: close what is open, then finalise everything still live
    const t = this.audioMs()
    for (const tr of this.tracks) this.close(tr.kind, t)
    for (const timer of this.finalizers) clearTimeout(timer)
    this.finalizers.clear()
    for (const id of [...this.pendingFinal.keys()]) this.finalise(id)
    const v = this.voices()
    if (v) this.sink.voices(v)
  }
}

function cos(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return 0
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0
}

const speaker = (t: TrackKind) => (t === 'mic' ? 'me' : 'them')
const capitalise = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`
