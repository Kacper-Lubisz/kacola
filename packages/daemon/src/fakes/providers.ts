import type { AudioDevice, ModelInfo } from '@gnomeola/protocol'
import { DaemonError } from '../errors.ts'
import type {
  DeviceProvider,
  ModelProvider,
  QaChunk,
  QaEngine,
  QaRequest,
  TranscriptionPipeline,
} from '../interfaces.ts'

// ------------------------------------------------------------------ devices

export class FakeDevices implements DeviceProvider {
  async list(): Promise<AudioDevice[]> {
    return [
      { name: 'fake.mic', description: 'Fake Microphone', kind: 'source', isDefault: true },
      { name: 'fake.speakers', description: 'Fake Speakers', kind: 'sink', isDefault: true },
    ]
  }
}

// ------------------------------------------------------------------- models

export class FakeModels implements ModelProvider {
  private readonly models = new Map<string, ModelInfo>([
    ['zipformer-en-streaming', model('zipformer-en-streaming', 'live', 'ready', 1)],
    ['whisper-small.en', model('whisper-small.en', 'final', 'missing', null)],
    ['silero-vad', model('silero-vad', 'vad', 'ready', 1)],
  ])
  private readonly stepMs: number

  constructor(opts: { stepMs?: number } = {}) {
    this.stepMs = opts.stepMs ?? 20
  }

  async list(): Promise<ModelInfo[]> {
    return [...this.models.values()]
  }

  async startDownload(id: string, onProgress: (m: ModelInfo) => void): Promise<ModelInfo> {
    const m = this.models.get(id)
    if (!m) throw new DaemonError('not_found', `no model ${id}`)
    if (m.state === 'ready' || m.state === 'downloading') return m
    const next: ModelInfo = { ...m, state: 'downloading', progress: 0 }
    this.models.set(id, next)
    let step = 0
    const timer = setInterval(() => {
      step++
      const done = step >= 5
      const cur: ModelInfo = { ...next, state: done ? 'ready' : 'downloading', progress: done ? 1 : step / 5 }
      this.models.set(id, cur)
      onProgress(cur)
      if (done) clearInterval(timer)
    }, this.stepMs)
    return next
  }
}

function model(
  id: string,
  role: ModelInfo['role'],
  state: ModelInfo['state'],
  progress: number | null,
): ModelInfo {
  return { id, role, title: id, sizeBytes: 1_000_000, state, progress }
}

// ---------------------------------------------------------------------- Q&A

/**
 * Deterministic stand-in for the LLM: answers by quoting the first segment it was given, streamed a
 * word at a time, citing the first two segments. A question containing FAIL makes it throw mid-stream.
 */
export class FakeQaEngine implements QaEngine {
  readonly requests: QaRequest[] = []
  private readonly delayMs: number
  constructor(opts: { delayMs?: number } = {}) {
    this.delayMs = opts.delayMs ?? 2
  }

  ready(): boolean {
    return true
  }

  async *ask(req: QaRequest): AsyncIterable<QaChunk> {
    this.requests.push(req)
    const segs = req.transcripts.flatMap((t) => t.segments)
    const text = segs.length
      ? `From ${segs.length} segment(s): "${segs[0]!.text}"`
      : 'There is nothing in the transcript yet.'
    const words = text.split(' ')
    for (const [i, w] of words.entries()) {
      if (req.signal.aborted) return
      if (i === 2 && req.question.includes('FAIL'))
        throw new DaemonError('unavailable', 'fake upstream failure')
      await new Promise((r) => setTimeout(r, this.delayMs))
      yield { type: 'delta', text: i ? ` ${w}` : w }
    }
    yield {
      type: 'final',
      text,
      citations: segs.slice(0, 2).map((s) => ({
        sessionId: s.sessionId,
        segmentId: s.id,
        startMs: s.startMs,
        endMs: s.endMs,
        speaker: s.speaker,
      })),
      model: 'fake-qa',
      usage: { inputTokens: 10, outputTokens: words.length, cacheReadTokens: 0, cacheWriteTokens: 0 },
      stopReason: 'end_turn',
    }
  }
}

// ------------------------------------------------- "nothing wired yet" stubs

/** Used until real capture/STT is wired: health says so, start() is a 503. */
export class UnavailablePipeline implements TranscriptionPipeline {
  async health() {
    return { available: false, backend: 'none', detail: 'no capture/STT backend is wired into this daemon' }
  }
  async start(): Promise<never> {
    throw new DaemonError('unavailable', 'recording is not available: no capture/STT backend is wired')
  }
}

export class NoDevices implements DeviceProvider {
  async list(): Promise<AudioDevice[]> {
    return []
  }
}

export class NoModels implements ModelProvider {
  async list(): Promise<ModelInfo[]> {
    return []
  }
  async startDownload(id: string): Promise<ModelInfo> {
    throw new DaemonError('not_found', `no model ${id}`)
  }
}
