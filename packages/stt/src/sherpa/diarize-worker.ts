import { parentPort, workerData } from 'node:worker_threads'
import { SAMPLE_RATE } from '../types.ts'
import { sherpa } from './native.ts'

// The diarization models run here, off the event loop: sherpa-onnx's speaker APIs are synchronous, and
// a pyannote pass over a 20 s segment takes long enough to stall capture and tier 1 if it ran inline.

export type DiarizeWorkerData = {
  embeddingModel: string
  segmentationModel: string | null
  numThreads: number
  /** sherpa's local clustering threshold for turn detection (a cosine distance). */
  turnThreshold: number
}

export type DiarizeRequest =
  | { id: number; op: 'embed'; samples: Float32Array }
  | { id: number; op: 'turns'; samples: Float32Array }
export type DiarizeResponse =
  | { id: number; ok: true; embedding: Float32Array }
  | { id: number; ok: true; turns: { start: number; end: number; speaker: number }[] }
  | { id: number; ok: false; error: string }

const cfg = workerData as DiarizeWorkerData
const s = sherpa()
const extractor = new s.SpeakerEmbeddingExtractor({
  model: cfg.embeddingModel,
  numThreads: cfg.numThreads,
  provider: 'cpu',
  debug: 0,
})
const segmenter = cfg.segmentationModel
  ? new s.OfflineSpeakerDiarization({
      segmentation: { pyannote: { model: cfg.segmentationModel }, numThreads: cfg.numThreads, debug: 0 },
      embedding: { model: cfg.embeddingModel, numThreads: cfg.numThreads, debug: 0 },
      clustering: { numClusters: -1, threshold: cfg.turnThreshold },
      minDurationOn: 0.3,
      minDurationOff: 0.5,
    })
  : null

parentPort!.on('message', (m: DiarizeRequest) => {
  try {
    if (m.op === 'embed') {
      const stream = extractor.createStream()
      stream.acceptWaveform({ samples: m.samples, sampleRate: SAMPLE_RATE })
      stream.inputFinished()
      if (!extractor.isReady(stream)) throw new Error('too little audio for a speaker embedding')
      const embedding = Float32Array.from(extractor.compute(stream, false))
      parentPort!.postMessage({ id: m.id, ok: true, embedding } satisfies DiarizeResponse, [embedding.buffer])
    } else {
      if (!segmenter) throw new Error('no segmentation model loaded')
      const turns = segmenter
        .process(m.samples)
        .map((t) => ({ start: t.start, end: t.end, speaker: t.speaker }))
      parentPort!.postMessage({ id: m.id, ok: true, turns } satisfies DiarizeResponse)
    }
  } catch (err) {
    parentPort!.postMessage({ id: m.id, ok: false, error: (err as Error).message } satisfies DiarizeResponse)
  }
})
