import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Track, TrackKind } from '@kacola/protocol'
import type {
  PipelineSink,
  PipelineStartOptions,
  RecordingHandle,
  TranscriptionPipeline,
} from '../interfaces.ts'

// A pipeline that replays a scripted meeting (e.g. an agenda fixture's ground-truth utterances) in audio
// time: each line closes as a `final` segment once the recording's audio clock passes its end, with a
// partial shortly before. Mic lines are `me` (the store's rule). `speed` compresses time (10 = a 2-minute
// meeting in 12 s). stop() closes what was said so far, like the real pipeline flushing.

export type ScriptLine = { track: TrackKind; speaker: string; startMs: number; endMs: number; text: string }

export class ScriptedPipeline implements TranscriptionPipeline {
  readonly recordings: ScriptedRecording[] = []
  readonly #lines: readonly ScriptLine[]
  readonly #speed: number
  constructor(lines: readonly ScriptLine[], opts: { speed?: number } = {}) {
    this.#lines = [...lines].sort((a, b) => a.endMs - b.endMs)
    this.#speed = opts.speed ?? 1
  }
  async health() {
    return { available: true, backend: 'scripted', detail: null }
  }
  async start(o: PipelineStartOptions, sink: PipelineSink): Promise<RecordingHandle> {
    if (o.continueAt) throw new Error('a scripted recording cannot continue after a restart')
    const r = new ScriptedRecording(o, sink, this.#lines, this.#speed)
    this.recordings.push(r)
    return r
  }
}

export class ScriptedRecording implements RecordingHandle {
  readonly tracks: Track[]
  #next = 0
  #audioMs = 0
  #last = Date.now()
  #paused = false
  #timer: NodeJS.Timeout
  readonly #sink: PipelineSink
  readonly #lines: readonly ScriptLine[]
  readonly #speed: number
  constructor(o: PipelineStartOptions, sink: PipelineSink, lines: readonly ScriptLine[], speed: number) {
    this.#sink = sink
    this.#lines = lines
    this.#speed = speed
    mkdirSync(o.sessionDir, { recursive: true })
    this.tracks = o.tracks.map((t) => {
      const audioPath = join(o.sessionDir, `${t.kind}.wav`)
      writeFileSync(audioPath, '')
      return {
        kind: t.kind,
        device: `scripted.${t.kind}`,
        sampleRate: 16000,
        audioPath,
        archivePath: null,
        gaps: [],
      }
    })
    this.#timer = setInterval(() => this.#tick(), 20)
  }
  /** Every line has been emitted. */
  get done(): boolean {
    return this.#next >= this.#lines.length
  }
  #tick(): void {
    const now = Date.now()
    if (!this.#paused) this.#audioMs += (now - this.#last) * this.#speed
    this.#last = now
    this.#emitUpTo(this.#audioMs)
  }
  #emitUpTo(ms: number): void {
    while (this.#next < this.#lines.length && this.#lines[this.#next]!.endMs <= ms) {
      const l = this.#lines[this.#next]!
      const speaker = l.track === 'mic' ? 'me' : l.speaker
      this.#sink.partial({ track: l.track, speaker, startMs: l.startMs, text: l.text })
      this.#sink.segment({
        id: `scr_${this.#next}`,
        track: l.track,
        speaker,
        startMs: l.startMs,
        endMs: l.endMs,
        text: l.text,
        quality: 'final',
        confidence: null,
      })
      this.#next++
    }
  }
  async pause() {
    this.#paused = true
  }
  async resume() {
    this.#last = Date.now()
    this.#paused = false
  }
  async stop() {
    clearInterval(this.#timer)
    this.#emitUpTo(this.#audioMs)
  }
}
