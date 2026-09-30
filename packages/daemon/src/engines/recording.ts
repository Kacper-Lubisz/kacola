import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { type CaptureSource, listDevices, PipeWireCaptureSource } from '@gnomeola/capture'
import {
  type AudioDevice,
  DEFAULT_SPEAKER_SETTINGS,
  type ModelInfo,
  type Track,
  type TrackKind,
} from '@gnomeola/protocol'
import {
  CATALOG,
  createDiarizer,
  createFinalTranscriber,
  createLiveRecognizer,
  createVad,
  DEFAULT_MODELS,
  type DiarizationSession,
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
  SpeakerVoices,
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
  /**
   * P-3: where audio comes from. 'pipewire' (default): pw-record children. 'external': a client streams it
   * to the ingest route (macOS), and `captureFactory` must hand out the hub's source for the session.
   */
  backend?: 'pipewire' | 'external'
  /** A capture source other than PipeWire (FileCaptureSource in tests, the external hub on macOS). */
  captureFactory?: (opts: PipelineStartOptions) => CaptureSource
}

const known = (id: string, role: 'live' | 'final') => CATALOG.some((e) => e.id === id && e.role === role)

function int16ToFloat(s: Int16Array): Float32Array {
  const out = new Float32Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s[i]! / 32768
  return out
}

export class RecordingPipeline implements TranscriptionPipeline {
  private readonly models: ModelManager
  private readonly captureFactory: (opts: PipelineStartOptions) => CaptureSource
  private readonly backend: 'pipewire' | 'external'

  constructor(opts: RecordingPipelineOptions) {
    this.models = opts.models
    this.backend = opts.backend ?? 'pipewire'
    if (this.backend === 'external' && !opts.captureFactory)
      throw new Error('the external capture backend needs a captureFactory (the ingest hub)')
    this.captureFactory = opts.captureFactory ?? (() => new PipeWireCaptureSource())
  }

  async health() {
    const backend = this.backend
    if (backend === 'pipewire') {
      // never probed for 'external': a macOS daemon has no pw-record and must not look for one
      const pw = spawnSync('pw-record', ['--version'], { stdio: 'ignore' })
      if (pw.error) return { available: false, backend, detail: 'pw-record is not installed' }
    }
    const missing: string[] = []
    for (const id of [DEFAULT_MODELS.live, DEFAULT_MODELS.final, DEFAULT_MODELS.vad]) {
      const s = await this.models.status(id)
      if (s.state !== 'ready') missing.push(id)
    }
    return {
      available: true,
      backend,
      detail: missing.length
        ? `models not ready: ${missing.join(', ')} (transcription unavailable until downloaded)`
        : null,
    }
  }

  /**
   * The far-end diarizer for a recording, when attribution is on and its models are installed. Never a
   * reason not to record: without it the far end is simply `them`.
   */
  private async diarizer(opts: PipelineStartOptions, sink: PipelineSink) {
    if (!(opts.settings.speakers ?? DEFAULT_SPEAKER_SETTINGS).diarize) return null
    for (const id of [DEFAULT_MODELS.embedding, DEFAULT_MODELS.segmentation])
      if ((await this.models.status(id)).state !== 'ready') {
        sink.error({
          message: `speaker model ${id} is not installed: far-end speakers stay "them"`,
          fatal: false,
        })
        return null
      }
    try {
      return await createDiarizer(this.models, {
        embedding: DEFAULT_MODELS.embedding,
        segmentation: DEFAULT_MODELS.segmentation,
      })
    } catch (err) {
      sink.error({ message: `diarization unavailable: ${(err as Error).message}`, fatal: false })
      return null
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

    const [live, vad, final, diarizer] = await Promise.all([
      createLiveRecognizer(this.models, liveId),
      createVad(this.models, DEFAULT_MODELS.vad),
      stt.finalPass === 'off' ? Promise.resolve(null) : createFinalTranscriber(this.models, finalId),
      this.diarizer(opts, sink),
    ])
    const diarization: DiarizationSession | null =
      diarizer?.createSession({
        voices: (opts.voices ?? []).filter((v) => v.model === diarizer.embeddingModel),
      }) ?? null

    // M3: cluster → speaker id, and segment → speaker id for segments attributed before they were
    // first published (their first upsert then carries it; the store never lets it override later).
    const speakerOf = new Map<number, string>()
    const segSpeaker = new Map<string, string>()
    const voicesOf = (clusters: { cluster: number; centroid: number[] | Float32Array; weightMs: number }[]) =>
      clusters.flatMap((c) => {
        const speakerId = speakerOf.get(c.cluster)
        return speakerId ? [{ speakerId, embedding: [...c.centroid], weightMs: c.weightMs }] : []
      })

    const pipeline = new SttPipeline({
      sessionId: opts.sessionId,
      live,
      vad,
      final,
      finalPass: stt.finalPass,
      diarizer: diarization,
      onEvent: (e) => {
        if (e.type === 'transcript.partial') {
          sink.partial({ track: e.track, speaker: e.speaker, startMs: e.startMs, text: e.text })
        } else if (e.type === 'segment.upserted') {
          const { revision: _r, sessionId: _s, ...seg } = e.segment
          const speakerId = seg.track === 'system' ? segSpeaker.get(seg.id) : undefined
          sink.segment(speakerId ? { ...seg, speakerId } : seg)
        } else if (e.type === 'speaker.attributed') {
          const speakerId = sink.speaker({ key: String(e.cluster), voiceprintId: e.voiceprintId })
          if (!speakerId) return
          speakerOf.set(e.cluster, speakerId)
          for (const id of e.segmentIds) segSpeaker.set(id, speakerId)
          sink.attribute({ speakerId, segmentIds: e.segmentIds })
        } else if (e.type === 'speaker.clusters') {
          sink.voices({ model: e.model, voices: voicesOf(e.clusters) })
        }
      },
    })

    const capture = this.captureFactory(opts)
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
      diarizer?.close()
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
      voices: (): SpeakerVoices | null =>
        diarization
          ? {
              model: diarization.embeddingModel,
              voices: voicesOf(diarization.clusters().map((c) => ({ ...c, centroid: [...c.centroid] }))),
            }
          : null,
      stop: async () => {
        const res = await capture.stop()
        for (const off of offs) off()
        // Drain both tiers: the last segments and every pending final pass are emitted before we resolve.
        await pipeline.stop(res.durationMs).finally(() => diarizer?.close())
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

export type RecordingDiarizer = Awaited<ReturnType<typeof createDiarizer>>

export class PipeWireDevices implements DeviceProvider {
  async list(): Promise<AudioDevice[]> {
    return listDevices()
  }
}

/**
 * P-3: with external capture the app picks the devices (the OS default microphone, and the system audio
 * loopback); the daemon only knows the defaults exist.
 */
export class ExternalDevices implements DeviceProvider {
  async list(): Promise<AudioDevice[]> {
    return [
      {
        name: 'default',
        description: 'Default microphone (chosen by the app)',
        kind: 'source',
        isDefault: true,
      },
      { name: 'default', description: 'System audio (captured by the app)', kind: 'sink', isDefault: true },
    ]
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
