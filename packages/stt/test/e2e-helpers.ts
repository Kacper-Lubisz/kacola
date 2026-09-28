import { setImmediate as yieldToLoop } from 'node:timers/promises'
import { EphemeralEventData, Segment, type TrackKind } from '@gnomeola/protocol'
import type { Fixture } from '@gnomeola/testkit/fixtures'
import { DEFAULT_MODELS } from '../src/model-manager/catalog.ts'
import { ModelManager } from '../src/model-manager/manager.ts'
import { type PipelineEvent, TranscriptionPipeline } from '../src/pipeline.ts'
import type { FinalPass, PartialOut } from '../src/reconciler.ts'
import { createFinalTranscriber, createLiveRecognizer, createVad } from '../src/sherpa/index.ts'
import type { FinalTranscriber, LiveRecognizer, VoiceActivityDetector } from '../src/types.ts'

// Shared plumbing for the real-model e2e suites. Models are resolved through the model manager against
// the user's models dir and downloaded (checksum-verified) on first use.

export type Engines = { live: LiveRecognizer; final: FinalTranscriber; vad: VoiceActivityDetector }

export const LIVE_MODEL = process.env.GNOMEOLA_LIVE_MODEL ?? DEFAULT_MODELS.live
export const FINAL_MODEL = process.env.GNOMEOLA_FINAL_MODEL ?? DEFAULT_MODELS.final

let engines: Promise<Engines> | null = null
export function loadEngines(): Promise<Engines> {
  engines ??= (async () => {
    const models = new ModelManager()
    for (const id of [LIVE_MODEL, FINAL_MODEL, DEFAULT_MODELS.vad]) await models.ensure(id)
    return {
      live: await createLiveRecognizer(models, LIVE_MODEL),
      final: await createFinalTranscriber(models, FINAL_MODEL, { numThreads: 4 }),
      vad: await createVad(models, DEFAULT_MODELS.vad),
    }
  })()
  return engines
}

export type RunResult = {
  upserts: Segment[]
  partials: PartialOut[]
  events: PipelineEvent[]
  latest: Segment[]
  wallMs: number
  audioMs: number
  pipeline: TranscriptionPipeline
}

export type RunOptions = {
  finalPass: FinalPass
  /** Pause at `atMs` and resume at `resumeMs`; audio in between is never delivered. */
  pause?: { atMs: number; resumeMs: number }
}

/**
 * Feed a fixture through a real pipeline as a capture engine would — both tracks interleaved in time
 * order, 100 ms chunks, gaps skipped — as fast as the engines allow, yielding to the event loop so
 * tier 2 runs concurrently with tier 1 like it does in the daemon.
 */
export async function runFixture(f: Fixture, e: Engines, opts: RunOptions): Promise<RunResult> {
  const events: PipelineEvent[] = []
  const pipeline = new TranscriptionPipeline({
    sessionId: `ses_e2e_${f.id}`,
    live: e.live,
    final: opts.finalPass === 'off' ? null : e.final,
    vad: e.vad,
    finalPass: opts.finalPass,
    onEvent: (ev) => {
      // every event must be wire-valid
      if (ev.type === 'segment.upserted') Segment.parse(ev.segment)
      else EphemeralEventData.parse(ev)
      events.push(ev)
    },
  })
  const chunks = (['mic', 'system'] as const)
    .flatMap((track) => f.chunks(track, 100).map((c) => ({ track: track as TrackKind, ...c })))
    .sort((a, b) => a.atMs - b.atMs || a.track.localeCompare(b.track))
  const t0 = performance.now()
  let paused = false
  let i = 0
  for (const c of chunks) {
    if (opts.pause && !paused && c.atMs >= opts.pause.atMs && c.atMs < opts.pause.resumeMs) {
      pipeline.pause(opts.pause.atMs)
      paused = true
    }
    if (paused && opts.pause && c.atMs >= opts.pause.resumeMs) {
      pipeline.resume(opts.pause.resumeMs)
      paused = false
    }
    if (paused) continue
    pipeline.push(c.track, c.samples, c.atMs)
    if (++i % 20 === 0) await yieldToLoop()
  }
  await pipeline.stop(f.truth.durationMs)
  const wallMs = performance.now() - t0
  const upserts = events.flatMap((ev) => (ev.type === 'segment.upserted' ? [ev.segment] : []))
  return {
    upserts,
    partials: events.filter((ev): ev is PartialOut => ev.type === 'transcript.partial'),
    events,
    latest: [...new Map(upserts.map((s) => [s.id, s])).values()],
    wallMs,
    audioMs: f.truth.durationMs,
    pipeline,
  }
}

/** The transcript of one track (or both) as the store would hold it, in time order. */
export const transcript = (segs: readonly Segment[], track?: TrackKind): string =>
  segs
    .filter((s) => !track || s.track === track)
    .sort((a, b) => a.startMs - b.startMs)
    .map((s) => s.text)
    .join(' ')
