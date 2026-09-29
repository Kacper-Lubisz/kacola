import { Worker } from 'node:worker_threads'
import { EmbeddingDiarizer, type EmbeddingDiarizerOptions } from '../diarize/session.ts'
import type { LocalTurn, SpeakerEmbedder, TurnDetector } from '../diarize/types.ts'
import type { CatalogEntry } from '../model-manager/catalog.ts'
import type { ModelManager } from '../model-manager/manager.ts'
import type { DiarizeRequest, DiarizeResponse, DiarizeWorkerData } from './diarize-worker.ts'

// A-2 — sherpa-onnx diarization engines: a speaker-embedding extractor and pyannote segmentation 3.0
// (via sherpa's offline diarizer, run per segment for local turns), both in one worker thread.

export type SherpaDiarizationOptions = {
  numThreads?: number
  /** Local clustering distance for turn detection inside one segment. */
  turnThreshold?: number
}

type Pending = { resolve: (r: DiarizeResponse) => void; reject: (e: Error) => void }

export class SherpaDiarizationEngine {
  readonly embedder: SpeakerEmbedder
  readonly turns: TurnDetector | null
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private closed = false
  private failure: Error | null = null

  constructor(
    embedding: { entry: CatalogEntry; dir: string },
    segmentation: { entry: CatalogEntry; dir: string } | null,
    opts: SherpaDiarizationOptions = {},
  ) {
    const file = (e: CatalogEntry, dir: string) => {
      if (e.engine.kind !== 'speaker-embedding' && e.engine.kind !== 'pyannote-segmentation')
        throw new Error(`${e.id} is not a diarization model (${e.engine.kind})`)
      return `${dir}/${e.engine.model}`
    }
    const data: DiarizeWorkerData = {
      embeddingModel: file(embedding.entry, embedding.dir),
      segmentationModel: segmentation ? file(segmentation.entry, segmentation.dir) : null,
      numThreads: opts.numThreads ?? 2,
      turnThreshold: opts.turnThreshold ?? 0.7,
    }
    this.worker = new Worker(new URL('./diarize-worker.ts', import.meta.url), { workerData: data })
    this.worker.unref()
    this.worker.on('message', (r: DiarizeResponse) => {
      const p = this.pending.get(r.id)
      if (!p) return
      this.pending.delete(r.id)
      p.resolve(r)
    })
    this.worker.on('error', (err) => this.fail(err))
    this.worker.on('exit', (code) => {
      if (!this.closed) this.fail(new Error(`diarization worker exited (${code})`))
    })

    const call = (op: DiarizeRequest['op'], samples: Float32Array) => this.call(op, samples)
    this.embedder = {
      modelId: embedding.entry.id,
      async embed(samples) {
        const r = await call('embed', samples)
        if (!r.ok) throw new Error(r.error)
        if (!('embedding' in r)) throw new Error('unexpected diarization reply')
        return r.embedding
      },
    }
    this.turns = segmentation
      ? {
          modelId: segmentation.entry.id,
          async turns(samples): Promise<LocalTurn[]> {
            const r = await call('turns', samples)
            if (!r.ok) throw new Error(r.error)
            if (!('turns' in r)) throw new Error('unexpected diarization reply')
            return r.turns.map((t) => ({
              startMs: Math.round(t.start * 1000),
              endMs: Math.round(t.end * 1000),
              speaker: t.speaker,
            }))
          },
        }
      : null
  }

  private fail(err: Error): void {
    this.failure = err
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
  }

  private call(op: DiarizeRequest['op'], samples: Float32Array): Promise<DiarizeResponse> {
    if (this.failure) return Promise.reject(this.failure)
    if (this.closed) return Promise.reject(new Error('diarization engine closed'))
    const id = this.nextId++
    // copy: the caller's buffer may be a view into retained audio
    const copy = Float32Array.from(samples)
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.ref()
      this.worker.postMessage({ id, op, samples: copy } satisfies DiarizeRequest, [copy.buffer])
    }).finally(() => {
      if (!this.pending.size) this.worker.unref()
    }) as Promise<DiarizeResponse>
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.fail(new Error('diarization engine closed'))
    await this.worker.terminate()
  }
}

/**
 * The daemon's diarizer: embeddings from `embeddingId`, local turns from `segmentationId` (optional),
 * clustered by EmbeddingDiarizer. Never downloads: both models must be `ready`.
 */
export async function createDiarizer(
  models: ModelManager,
  ids: { embedding: string; segmentation: string | null },
  opts: SherpaDiarizationOptions & Omit<EmbeddingDiarizerOptions, 'embedder' | 'turns'> = {},
): Promise<EmbeddingDiarizer & { engine: SherpaDiarizationEngine }> {
  const emb = { entry: models.entry(ids.embedding), dir: await models.require(ids.embedding) }
  const seg = ids.segmentation
    ? { entry: models.entry(ids.segmentation), dir: await models.require(ids.segmentation) }
    : null
  const engine = new SherpaDiarizationEngine(emb, seg, opts)
  const d = new EmbeddingDiarizer({
    ...opts,
    embedder: engine.embedder,
    turns: engine.turns,
  }) as EmbeddingDiarizer & {
    engine: SherpaDiarizationEngine
  }
  d.engine = engine
  const close = d.close.bind(d)
  d.close = () => {
    close()
    void engine.close()
  }
  return d
}
