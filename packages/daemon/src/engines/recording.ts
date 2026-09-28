import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { type CaptureSource, listDevices, PipeWireCaptureSource } from '@gnomeola/capture'
import type { AudioDevice, ModelInfo, Track, TrackKind } from '@gnomeola/protocol'
import {
  CATALOG,
  createFinalTranscriber,
  createLiveRecognizer,
  createVad,
  DEFAULT_MODELS,
  ModelManager,
  TranscriptionPipeline as SttPipeline,
} from '@gnomeola/stt'
import { DaemonError } from '../errors.ts'
import type {
  DeviceProvider,
  ModelProvider,
  PipelineSink,
  PipelineStartOptions,
  RecordingHandle,
  TranscriptionPipeline,
} from '../interfaces.ts'

// The real recording pipeline: @gnomeola/capture (PipeWire, two tracks) feeding @gnomeola/stt (VAD + live
// tier + final tier + reconciler), behind the daemon's TranscriptionPipeline seam.
//
// Gaps: capture pads missing time with synthetic silence in the WAV (so the file stays aligned with the
// session timeline) and reports a gap. The STT pipeline has its own gap semantics, so synthetic frames
// are NOT pushed into it — the gap is forwarded instead, and nothing is transcribed out of padding.

export type RecordingPipelineOptions = {
  models: ModelManager
  /** Test seam: a capture source other than PipeWire (e.g. FileCaptureSource). */
  captureFactory?: () => CaptureSource
}

const known = (id: string, role: 'live' | 'final') => CATALOG.some((e) => e.id === id && e.role === role)

function int16ToFloat(s: Int16Array): Float32Array {
  const out = new Float32Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s[i]! / 32768
  return out
}

export class RecordingPipeline implements TranscriptionPipeline {
  private readonly models: ModelManager
  private readonly captureFactory: () => CaptureSource

  constructor(opts: RecordingPipelineOptions) {
    this.models = opts.models
    this.captureFactory = opts.captureFactory ?? (() => new PipeWireCaptureSource())
  }

  async health() {
    const pw = spawnSync('pw-record', ['--version'], { stdio: 'ignore' })
    if (pw.error) return { available: false, backend: 'pipewire', detail: 'pw-record is not installed' }
    const missing: string[] = []
    for (const id of [DEFAULT_MODELS.live, DEFAULT_MODELS.final, DEFAULT_MODELS.vad]) {
      const s = await this.models.status(id)
      if (s.state !== 'ready') missing.push(id)
    }
    return {
      available: true,
      backend: 'pipewire',
      detail: missing.length
        ? `models not ready: ${missing.join(', ')} (transcription unavailable until downloaded)`
        : null,
    }
  }

  async start(opts: PipelineStartOptions, sink: PipelineSink): Promise<RecordingHandle> {
    const stt = opts.settings.stt
    const liveId = known(stt.liveModel, 'live') ? stt.liveModel : DEFAULT_MODELS.live
    const finalId = known(stt.finalModel, 'final') ? stt.finalModel : DEFAULT_MODELS.final
    const needed = [liveId, DEFAULT_MODELS.vad, ...(stt.finalPass === 'off' ? [] : [finalId])]
    for (const id of needed) {
      const s = await this.models.status(id)
      if (s.state !== 'ready')
        throw new DaemonError(
          'unavailable',
          `speech model ${id} is ${s.state}; download it first (gnomeola onboarding or Preferences)`,
        )
    }

    const [live, vad, final] = await Promise.all([
      createLiveRecognizer(this.models, liveId),
      createVad(this.models, DEFAULT_MODELS.vad),
      stt.finalPass === 'off' ? Promise.resolve(null) : createFinalTranscriber(this.models, finalId),
    ])

    const pipeline = new SttPipeline({
      sessionId: opts.sessionId,
      live,
      vad,
      final,
      finalPass: stt.finalPass,
      onEvent: (e) => {
        if (e.type === 'transcript.partial') {
          sink.partial({ track: e.track, speaker: e.speaker, startMs: e.startMs, text: e.text })
        } else {
          const { revision: _r, sessionId: _s, ...seg } = e.segment
          sink.segment(seg)
        }
      },
    })

    const capture = this.captureFactory()
    const offs = [
      capture.on('frame', (f) => {
        if (f.synthetic) return
        try {
          pipeline.push(f.track, int16ToFloat(f.samples), f.atMs)
        } catch (err) {
          sink.error({ message: `transcription failed: ${(err as Error).message}`, fatal: false })
        }
      }),
      capture.on('level', (l) => sink.level(l)),
      capture.on('gap', (g) => {
        sink.gap(g)
        pipeline.gap(g.track, g.atMs, g.durationMs, g.reason)
      }),
      capture.on('error', (e) => sink.error({ message: e.message, fatal: e.fatal })),
    ]

    const specs = opts.tracks.map((t) => ({
      kind: t.kind,
      ...(t.device && t.device !== 'default' ? { device: t.device } : {}),
    }))
    try {
      await capture.start(opts.sessionDir, specs)
    } catch (err) {
      for (const off of offs) off()
      await pipeline.stop(0).catch(() => {})
      throw new DaemonError('unavailable', `could not start capture: ${(err as Error).message}`)
    }

    let tracks: Track[] = opts.tracks.map((t) => ({
      kind: t.kind as TrackKind,
      device: t.device,
      sampleRate: 16_000,
      audioPath: join(opts.sessionDir, `${t.kind}.wav`),
      archivePath: null,
      gaps: [],
    }))

    return {
      get tracks() {
        return tracks
      },
      pause: async () => {
        await capture.pause()
        pipeline.pause(capture.elapsedMs())
      },
      resume: async () => {
        pipeline.resume(capture.elapsedMs())
        await capture.resume()
      },
      stop: async () => {
        const res = await capture.stop()
        for (const off of offs) off()
        // Drain both tiers: the last segments and every pending final pass are emitted before we resolve.
        await pipeline.stop(res.durationMs)
        tracks = res.tracks
        if (pipeline.errors.length)
          sink.error({
            message: `transcription errors: ${pipeline.errors.map((e) => e.message).join('; ')}`,
            fatal: false,
          })
      },
    }
  }
}

export class PipeWireDevices implements DeviceProvider {
  async list(): Promise<AudioDevice[]> {
    return listDevices()
  }
}

export class SttModels implements ModelProvider {
  private readonly models: ModelManager
  constructor(models: ModelManager) {
    this.models = models
  }

  async list(): Promise<ModelInfo[]> {
    const all = await this.models.list()
    return all.filter((s) => s.role !== 'tts').map((s) => ModelManager.toModelInfo(s))
  }

  async startDownload(id: string, onProgress: (m: ModelInfo) => void): Promise<ModelInfo> {
    const entry = CATALOG.find((e) => e.id === id && e.role !== 'tts')
    if (!entry) throw new DaemonError('not_found', `no such model ${id}`)
    const base = ModelManager.toModelInfo(await this.models.status(id))
    await this.models.ensure(id, {
      onProgress: (p) =>
        onProgress({ ...base, state: 'downloading', progress: Math.min(1, Math.max(0, p.fraction)) }),
    })
    return ModelManager.toModelInfo(await this.models.status(id))
  }
}
