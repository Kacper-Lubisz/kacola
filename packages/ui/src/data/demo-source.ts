import {
  type AnyEvent,
  type AskStreamEvent,
  type AudioDevice,
  type DurableEvent,
  type DurableEventData,
  type Health,
  type ModelInfo,
  newId,
  type Segment,
  type Session,
  type Settings,
  type SettingsPatch,
  type TrackKind,
} from '@gnomeola/protocol'
import type { DataSource, Snapshot, SubscribeHandlers } from './source.ts'

// GNOMEOLA_UI_DEMO=1: an in-process stand-in for the daemon. It speaks the same event vocabulary
// (durable session.upserted with a gap-free seq, ephemeral audio.level), so the store, the hooks and
// every widget run the same code paths they will against gnomeolad — only the transport differs.
//
// Behaviour: three finished sessions at start, each with a short transcript; every `intervalMs` the
// current recording is finished and a new one starts (until `maxSessions`); the recording session's
// duration ticks once a second, with a synthetic level meter, a growing partial line, and a segment
// that closes every few seconds (live) and is finalised a second later. Settings live in memory;
// every model is ready; asking a question answers "unavailable" — the demo has no LLM.

export type DemoOptions = {
  intervalMs?: number
  maxSessions?: number
  now?: () => number
  /** Timer hooks, injectable so unit tests can drive time by hand. */
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (h: unknown) => void
}

const TITLES = [
  'Standup',
  'Customer call: Acme',
  'Sprint planning',
  'Interview: backend engineer',
  'Retro',
  'Pairing on the reconciler',
  'Budget review',
  'All hands',
]

const LINES: [TrackKind, string][] = [
  ['mic', 'Shall we start with the numbers from last week?'],
  ['system', 'Sure. Sign-ups are up eleven percent, mostly from the new landing page.'],
  ['system', 'Churn is flat, which is fine for now.'],
  ['mic', 'Good. What about the onboarding changes?'],
  ['system', 'They ship on Thursday, assuming the review goes through.'],
  ['mic', 'And who is on call this week?'],
  ['system', 'Ana takes the rota; Ben owns the rollout plan.'],
  ['mic', 'Great, let us wrap up there. Thanks, everyone.'],
]

const LIVE_WORDS =
  'so the next thing on the list is the budget review and whether we can move it to friday'.split(' ')

export const DEMO_DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: 'anthropic',
    model: 'claude-opus-5',
    ollamaUrl: 'http://127.0.0.1:11434',
    apiKeyConfigured: false,
  },
  stt: { liveModel: 'demo-live', finalModel: 'demo-final', finalPass: 'during' },
  capture: { micDevice: 'default', systemDevice: 'default' },
  retention: { audio: 'keep', days: 30, archive: false },
}

const DEMO_DEVICES: AudioDevice[] = [
  { name: 'demo-microphone', description: 'Demo Microphone', kind: 'source', isDefault: true },
  { name: 'demo-speakers', description: 'Demo Speakers', kind: 'sink', isDefault: true },
]

const DEMO_MODELS: ModelInfo[] = [
  {
    id: 'demo-live',
    role: 'live',
    title: 'Demo live model',
    sizeBytes: 70_000_000,
    state: 'ready',
    progress: 1,
  },
  {
    id: 'demo-final',
    role: 'final',
    title: 'Demo final model',
    sizeBytes: 480_000_000,
    state: 'ready',
    progress: 1,
  },
]

function track(kind: TrackKind): Session['tracks'][number] {
  return {
    kind,
    device: kind === 'mic' ? 'demo-microphone' : 'demo-speakers.monitor',
    sampleRate: 16_000,
    audioPath: null,
    archivePath: null,
    gaps: [],
  }
}

export function createDemoSource(opts: DemoOptions = {}): DataSource & { dispose(): void } {
  const intervalMs = opts.intervalMs ?? 4000
  const maxSessions = opts.maxSessions ?? 40
  const now = opts.now ?? Date.now
  const setIv = opts.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearIv = opts.clearInterval ?? ((h: unknown) => clearInterval(h as NodeJS.Timeout))

  const sessions = new Map<string, Session>()
  const segments = new Map<string, Segment[]>()
  let settings: Settings = DEMO_DEFAULT_SETTINGS
  const log: DurableEvent[] = []
  const listeners = new Set<(e: AnyEvent) => void>()
  let seq = 0
  let made = 0

  const iso = (ms: number) => new Date(ms).toISOString()

  function emit(e: AnyEvent) {
    for (const l of [...listeners]) l(e)
  }

  function durable(sessionId: string | null, data: DurableEventData) {
    const ev: DurableEvent = { seq: ++seq, at: iso(now()), sessionId, data }
    log.push(ev)
    if (log.length > 2000) log.splice(0, log.length - 2000)
    emit(ev)
  }

  function upsert(s: Session) {
    sessions.set(s.id, s)
    durable(s.id, { type: 'session.upserted', session: s })
  }

  function upsertSegment(seg: Segment) {
    const list = segments.get(seg.sessionId) ?? []
    const i = list.findIndex((x) => x.id === seg.id)
    if (i === -1) list.push(seg)
    else list[i] = seg
    segments.set(seg.sessionId, list)
    durable(seg.sessionId, { type: 'segment.upserted', segment: seg })
  }

  function seedTranscript(sessionId: string, at: number) {
    const list: Segment[] = LINES.map(([t, text], i) => ({
      id: newId('seg', at + i),
      sessionId,
      track: t,
      speaker: t === 'mic' ? 'me' : 'them',
      startMs: i * 6000 + 2000,
      endMs: i * 6000 + 7000,
      text,
      quality: 'final',
      revision: 2,
      confidence: 0.9,
    }))
    segments.set(sessionId, list)
  }

  function finished(title: string, startedAgoMs: number, durationMs: number): Session {
    const start = now() - startedAgoMs
    return {
      id: newId('ses', start),
      title,
      createdAt: iso(start),
      startedAt: iso(start),
      endedAt: iso(start + durationMs),
      status: 'stopped',
      private: false,
      durationMs,
      tracks: [track('mic'), track('system')],
      error: null,
    }
  }

  // Seed history, oldest first so seq order matches creation order.
  const H = 3_600_000
  for (const s of [
    finished('Weekly product sync', 50 * H, 45 * 60_000),
    finished('Design review: onboarding flow', 26 * H, 30 * 60_000),
    finished('1:1 with Sam', 3 * H, 25 * 60_000),
  ]) {
    upsert(s)
    seedTranscript(s.id, Date.parse(s.createdAt))
  }

  function recording(): Session | undefined {
    for (const s of sessions.values()) if (s.status === 'recording') return s
    return undefined
  }

  function stop(id: string): Session {
    const s = sessions.get(id)
    if (!s) throw new Error(`no session ${id}`)
    if (s.status !== 'recording' && s.status !== 'paused') return s
    const t = now()
    const durationMs = Math.max(s.durationMs, t - Date.parse(s.startedAt ?? s.createdAt))
    const next: Session = { ...s, status: 'stopped', endedAt: iso(t), durationMs }
    upsert(next)
    if (toFinalise?.sessionId === id) finalisePending()
    if (open?.sessionId === id) open = null
    return next
  }

  function start(title: string): Session {
    const cur = recording()
    if (cur) stop(cur.id)
    const t = now()
    made++
    const s: Session = {
      id: newId('ses', t),
      title,
      createdAt: iso(t),
      startedAt: iso(t),
      endedAt: null,
      status: 'recording',
      private: false,
      durationMs: 0,
      tracks: [track('mic'), track('system')],
      error: null,
    }
    upsert(s)
    return s
  }

  function nextTitle(): string {
    return `${TITLES[made % TITLES.length]} #${made + 1}`
  }

  // the open line on the recording session: a partial every tick, closed as a segment every 3 ticks
  let open: { sessionId: string; track: TrackKind; startMs: number; words: string[] } | null = null
  let toFinalise: Segment | null = null
  let wordAt = 0

  function finalisePending() {
    if (!toFinalise) return
    const fin = toFinalise
    toFinalise = null
    upsertSegment({
      ...fin,
      text: `${fin.text.charAt(0).toUpperCase()}${fin.text.slice(1)}.`,
      quality: 'final',
      revision: fin.revision + 1,
      confidence: 0.92,
    })
  }

  function liveTranscript(cur: Session, elapsedMs: number) {
    finalisePending()
    if (!open || open.sessionId !== cur.id) {
      open = { sessionId: cur.id, track: 'mic', startMs: elapsedMs, words: [] }
    }
    open.words.push(LIVE_WORDS[wordAt++ % LIVE_WORDS.length]!)
    if (open.words.length >= 3) {
      const seg: Segment = {
        id: newId('seg', now()),
        sessionId: cur.id,
        track: open.track,
        speaker: open.track === 'mic' ? 'me' : 'them',
        startMs: open.startMs,
        endMs: Math.max(open.startMs + 1, elapsedMs),
        text: open.words.join(' '),
        quality: 'live',
        revision: 1,
        confidence: 0.6,
      }
      upsertSegment(seg)
      toFinalise = seg
      const nextTrack: TrackKind = open.track === 'mic' ? 'system' : 'mic'
      open = { sessionId: cur.id, track: nextTrack, startMs: seg.endMs, words: [] }
      return
    }
    emit({
      seq: null,
      at: iso(now()),
      sessionId: cur.id,
      data: {
        type: 'transcript.partial',
        track: open.track,
        speaker: open.track === 'mic' ? 'me' : 'them',
        startMs: open.startMs,
        text: open.words.join(' '),
      },
    })
  }

  let phase = 0
  const tick = setIv(() => {
    const cur = recording()
    if (cur) {
      const durationMs = Math.max(0, now() - Date.parse(cur.startedAt ?? cur.createdAt))
      upsert({ ...cur, durationMs })
      liveTranscript(cur, durationMs)
      phase++
      for (const trackKind of ['mic', 'system'] as const) {
        const base = trackKind === 'mic' ? 0.35 : 0.55
        const rms = Math.min(1, Math.max(0, base + 0.3 * Math.sin(phase * (trackKind === 'mic' ? 0.9 : 1.7))))
        emit({
          seq: null,
          at: iso(now()),
          sessionId: cur.id,
          data: {
            type: 'audio.level',
            track: trackKind,
            rms,
            peak: Math.min(1, rms + 0.1),
            elapsedMs: durationMs,
          },
        })
      }
    }
  }, 1000)
  // Once the list reaches maxSessions the demo finishes its last recording and goes quiet, so a
  // recording started by hand afterwards is left alone.
  let churning = true
  const churn = setIv(() => {
    if (!churning) return
    if (sessions.size >= maxSessions) {
      churning = false
      clearIv(churn)
      const cur = recording()
      if (cur) stop(cur.id)
      return
    }
    start(nextTitle())
  }, intervalMs)

  function health(): Health {
    return {
      ok: true,
      version: 'demo',
      uptimeMs: 0,
      lastSeq: seq,
      capture: { available: true, backend: 'demo', detail: null },
      models: DEMO_MODELS,
      llm: { provider: settings.llm.provider, ready: false },
    }
  }

  function patchSettings(p: SettingsPatch): Settings {
    settings = {
      llm: { ...settings.llm, ...p.llm },
      stt: { ...settings.stt, ...p.stt },
      capture: { ...settings.capture, ...p.capture },
      retention: { ...settings.retention, ...p.retention },
    }
    const { apiKeyConfigured: _configured, ...llm } = settings.llm
    durable(null, { type: 'settings.updated', settings: { ...settings, llm } })
    return settings
  }

  async function* demoAsk(body: { question: string; sessionId?: string }): AsyncGenerator<AskStreamEvent> {
    const message = {
      id: newId('qa', now()),
      sessionId: body.sessionId ?? null,
      requestId: newId('req', now()),
      role: 'user' as const,
      text: body.question,
      citations: [],
      model: null,
      usage: null,
      stopReason: null,
      createdAt: iso(now()),
    }
    yield { type: 'question', message }
    yield {
      type: 'error',
      error: { code: 'unavailable', message: 'the demo has no question-answering engine' },
    }
  }

  return {
    origin: 'demo',
    async load(): Promise<Snapshot> {
      return { sessions: [...sessions.values()], seq, health: health() }
    },
    subscribe(h: SubscribeHandlers): Promise<void> {
      return new Promise<void>((resolve) => {
        if (h.signal.aborted) return resolve()
        h.onConnect()
        for (const e of log) if (e.seq > h.since) h.onEvent(e)
        const l = (e: AnyEvent) => h.onEvent(e)
        listeners.add(l)
        h.signal.addEventListener(
          'abort',
          () => {
            listeners.delete(l)
            resolve()
          },
          { once: true },
        )
      })
    },
    async startRecording() {
      return start('New recording')
    },
    async stopRecording(id: string) {
      return stop(id)
    },
    async transcript(id: string) {
      const s = sessions.get(id)
      if (!s) throw new Error(`no session ${id}`)
      const list = [...(segments.get(id) ?? [])].sort((a, b) => a.startMs - b.startMs)
      return { session: s, segments: list, window: null, total: list.length }
    },
    async qaHistory() {
      return []
    },
    ask: (body) => demoAsk(body),
    async health() {
      return health()
    },
    async getSettings() {
      return settings
    },
    async updateSettings(p: SettingsPatch) {
      return patchSettings(p)
    },
    async setApiKey(key: string | null) {
      settings = { ...settings, llm: { ...settings.llm, apiKeyConfigured: key !== null } }
      return { configured: key !== null }
    },
    async listDevices() {
      return DEMO_DEVICES
    },
    async listModels() {
      return DEMO_MODELS
    },
    async downloadModel(id: string) {
      const m = DEMO_MODELS.find((x) => x.id === id)
      if (!m) throw new Error(`no model ${id}`)
      return m
    },
    dispose() {
      clearIv(tick)
      clearIv(churn)
      listeners.clear()
    },
  }
}
