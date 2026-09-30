import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { newId, type Track, type TrackKind } from '@gnomeola/protocol'
import type { PipelineSink, PipelineStartOptions, RecordingHandle, SegmentUpsert } from '../interfaces.ts'

// A replayed meeting: the fake pipeline speaking a SCRIPT (a fixture's ground truth, or lines written for
// a test) instead of random words, so the agent channel and its evals see a real conversation, with
// real timings, on the fake capture path. Audio time runs at `speed` × the wall clock. Each utterance
// sends partials word by word while it is being "spoken", closes as a live segment at its end, and is
// finalised (capitalised, confidence up) shortly after. When the script runs out, the room goes quiet
// and the recording keeps running until stopped.

export type ScriptLine = {
  track: TrackKind
  /** The far-end speaker's label (`them` if absent); the mic is always `me`. */
  speaker?: string
  startMs: number
  endMs: number
  text: string
}

export type MeetingScript = { utterances: ScriptLine[] }

export type ScriptedOptions = {
  script: MeetingScript
  /** Audio ms per wall ms. */
  speed: number
  tickMs: number
  /** Audio ms between partials of an utterance. */
  partialEveryMs: number
  /** Wall ms before a live segment is re-emitted as final. */
  finalizeAfterMs: number
}

/** Read a script file: `{utterances: [...]}` (a testkit fixture's truth.json has this shape). */
export function loadScript(path: string): MeetingScript {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { utterances?: ScriptLine[] }
  if (!Array.isArray(raw.utterances)) throw new Error(`${path}: no utterances`)
  return {
    utterances: raw.utterances
      .map((u) => ({ track: u.track, speaker: u.speaker, startMs: u.startMs, endMs: u.endMs, text: u.text }))
      .sort((a, b) => a.startMs - b.startMs),
  }
}

export class ScriptedRecording implements RecordingHandle {
  readonly tracks: Track[]
  private readonly sink: PipelineSink
  private readonly o: ScriptedOptions
  private readonly lines: (ScriptLine & { id: string; sent: number; closed: boolean })[]
  private timer: NodeJS.Timeout | null = null
  private readonly finalizers = new Set<NodeJS.Timeout>()
  private readonly pending = new Map<string, SegmentUpsert>()
  private audioMs = 0
  private lastTick = Date.now()
  private paused = false
  stopped = false

  constructor(opts: PipelineStartOptions, sink: PipelineSink, o: ScriptedOptions) {
    this.sink = sink
    this.o = o
    const kinds = new Set(opts.tracks.map((t) => t.kind))
    this.lines = o.script.utterances
      .filter((u) => kinds.has(u.track))
      .map((u) => ({ ...u, id: newId('seg'), sent: 0, closed: false }))
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
    this.timer = setInterval(() => this.tick(), o.tickMs)
  }

  private speaker(l: ScriptLine): string {
    return l.track === 'mic' ? 'me' : l.speaker && l.speaker !== 'me' ? l.speaker : 'them'
  }

  private tick(): void {
    const now = Date.now()
    if (!this.paused && !this.stopped) this.audioMs += (now - this.lastTick) * this.o.speed
    this.lastTick = now
    if (this.paused || this.stopped) return
    const t = this.audioMs
    for (const l of this.lines) {
      if (l.closed || t < l.startMs) continue
      if (t >= l.endMs) {
        this.close(l)
        continue
      }
      // partials: the words "said so far", in proportion to the utterance's elapsed time
      const words = l.text.split(/\s+/)
      const due = Math.floor((l.sent + 1) * this.o.partialEveryMs)
      if (t - l.startMs >= due) {
        l.sent++
        const n = Math.max(1, Math.round((words.length * (t - l.startMs)) / (l.endMs - l.startMs)))
        this.sink.partial({
          track: l.track,
          speaker: this.speaker(l),
          startMs: l.startMs,
          text: words.slice(0, n).join(' ').toLowerCase(),
        })
      }
    }
    for (const tr of this.tracks) {
      const speaking = this.lines.some((l) => l.track === tr.kind && !l.closed && t >= l.startMs)
      const rms = speaking ? 0.3 : 0.02
      this.sink.level({ track: tr.kind, rms, peak: Math.min(1, rms * 1.8), elapsedMs: Math.floor(t) })
    }
  }

  private close(l: ScriptedRecording['lines'][number]): void {
    if (l.closed) return
    l.closed = true
    const live: SegmentUpsert = {
      id: l.id,
      track: l.track,
      speaker: this.speaker(l),
      startMs: Math.floor(l.startMs),
      endMs: Math.floor(l.endMs),
      text: l.text,
      quality: 'live',
      confidence: 0.7,
    }
    this.sink.segment(live)
    this.pending.set(l.id, { ...live, quality: 'final', confidence: 0.95 })
    const timer = setTimeout(() => {
      this.finalizers.delete(timer)
      this.finalise(l.id)
    }, this.o.finalizeAfterMs)
    this.finalizers.add(timer)
  }

  private finalise(id: string): void {
    const fin = this.pending.get(id)
    if (!fin) return
    this.pending.delete(id)
    this.sink.segment(fin)
  }

  /** Audio time so far (tests wait on it). */
  get elapsedMs(): number {
    return this.audioMs
  }

  /** Whether every line of the script has been spoken. */
  get finished(): boolean {
    return this.lines.every((l) => l.closed)
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
    // flush: what has started is closed at the point reached; what has not started was never said
    for (const l of this.lines)
      if (!l.closed && this.audioMs >= l.startMs) {
        l.endMs = Math.max(l.startMs, Math.min(l.endMs, this.audioMs))
        this.close(l)
      }
    for (const timer of this.finalizers) clearTimeout(timer)
    this.finalizers.clear()
    for (const id of [...this.pending.keys()]) this.finalise(id)
  }
}
