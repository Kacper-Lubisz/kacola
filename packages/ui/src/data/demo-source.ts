import {
  type AnyEvent,
  type AskStreamEvent,
  type AudioDevice,
  type DurableEvent,
  type DurableEventData,
  type EnhanceStreamEvent,
  type Health,
  isReservedLabel,
  ME,
  type ModelInfo,
  type Note,
  type NoteTemplate,
  type NoteVersion,
  newId,
  type Segment,
  type Session,
  type Settings,
  type SettingsPatch,
  SPEAKER_COLOURS,
  type Speaker,
  type SpeakerSummary,
  THEM,
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

const DEMO_TEMPLATES: NoteTemplate[] = [
  {
    id: 'general',
    name: 'General meeting',
    builtIn: true,
    keywords: [],
    body: '## Summary\n\n## Action items',
  },
]

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
  speakers: { diarize: true, voiceprints: false },
  autoRecord: { calendar: false, micActivity: false },
}

/** Which of the two demo far-end voices says each seeded line (null: the user). */
const LINE_SPEAKER = [null, 0, 0, null, 1, null, 0, null] as const

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
  /** Far-end speakers per session, merged tombstones included (M3). */
  const speakers = new Map<string, Speaker[]>()
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
    const people: Speaker[] = [0, 1].map((k) => ({
      id: newId('spk', at + k),
      sessionId,
      label: `Speaker ${k + 1}`,
      named: false,
      colour: k,
      voiceprintId: null,
      mergedInto: null,
      createdAt: iso(at),
    }))
    speakers.set(sessionId, people)
    const list: Segment[] = LINES.map(([t, text], i) => {
      const who = LINE_SPEAKER[i] ?? null
      const p = who === null ? null : people[who]!
      return {
        id: newId('seg', at + i),
        sessionId,
        track: t,
        speaker: t === 'mic' ? 'me' : (p?.label ?? 'them'),
        ...(p ? { speakerId: p.id } : {}),
        startMs: i * 6000 + 2000,
        endMs: i * 6000 + 7000,
        text,
        quality: 'final',
        revision: 2,
        confidence: 0.9,
      }
    })
    segments.set(sessionId, list)
  }

  // ---- M3: speakers, with the daemon's rules (reserved and unique labels, merges, splits)
  const demoError = (code: string, message: string) => Object.assign(new Error(message), { code })
  const liveSpeakers = (id: string) => (speakers.get(id) ?? []).filter((p) => !p.mergedInto)
  function speakerOf(sessionId: string, id: string): Speaker {
    const p = liveSpeakers(sessionId).find((x) => x.id === id)
    if (!p) throw demoError('not_found', `no speaker ${id} in session ${sessionId}`)
    return p
  }
  function upsertSpeaker(p: Speaker) {
    const all = speakers.get(p.sessionId) ?? []
    const i = all.findIndex((x) => x.id === p.id)
    speakers.set(p.sessionId, i === -1 ? [...all, p] : all.map((x) => (x.id === p.id ? p : x)))
    for (const g of segments.get(p.sessionId) ?? []) if (g.speakerId === p.id) g.speaker = p.label
    durable(p.sessionId, { type: 'speaker.upserted', speaker: p })
  }
  function checkLabel(sessionId: string, label: string, except?: string) {
    if (isReservedLabel(label)) throw demoError('bad_request', `"${label.trim()}" is reserved`)
    const clash = liveSpeakers(sessionId).find(
      (x) => x.id !== except && x.label.toLowerCase() === label.trim().toLowerCase(),
    )
    if (clash)
      throw demoError(
        'conflict',
        `another speaker in this session is already called "${clash.label}" — merge them instead`,
      )
  }
  function attribute(sessionId: string, speakerId: string, ids: string[]) {
    const p = speakerOf(sessionId, speakerId)
    for (const g of segments.get(sessionId) ?? [])
      if (ids.includes(g.id)) {
        g.speakerId = p.id
        g.speaker = p.label
      }
    durable(sessionId, { type: 'segments.attributed', sessionId, speakerId, segmentIds: ids, by: 'user' })
  }
  function summaries(sessionId: string): SpeakerSummary[] {
    const segs = segments.get(sessionId) ?? []
    const stat = (f: (g: Segment) => boolean) => {
      const mine = segs.filter(f)
      return { segments: mine.length, talkMs: mine.reduce((a, g) => a + g.endMs - g.startMs, 0) }
    }
    const pseudo = (id: string, track: TrackKind, st: { segments: number; talkMs: number }) => ({
      id,
      label: id,
      track,
      named: false,
      colour: null,
      voiceprintId: null,
      ...st,
    })
    const out: SpeakerSummary[] = [
      pseudo(
        ME,
        'mic',
        stat((g) => g.track === 'mic'),
      ),
    ]
    for (const p of liveSpeakers(sessionId))
      out.push({
        id: p.id,
        label: p.label,
        track: 'system',
        named: p.named,
        colour: p.colour,
        voiceprintId: p.voiceprintId,
        ...stat((g) => g.speakerId === p.id),
      })
    const them = stat((g) => g.track === 'system' && !g.speakerId)
    if (them.segments) out.push(pseudo(THEM, 'system', them))
    return out
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
      speakers: { diarize: true, voiceprints: false, ...settings.speakers, ...p.speakers },
      autoRecord: { ...settings.autoRecord, ...p.autoRecord },
    }
    const { apiKeyConfigured: _configured, ...llm } = settings.llm
    durable(null, { type: 'settings.updated', settings: { ...settings, llm } })
    return settings
  }

  // notes: versions in memory, the same rules as the daemon (optimistic concurrency, append-only)
  const noteVersions = new Map<string, NoteVersion[]>()
  const noteOf = (id: string): Note => {
    const vs = noteVersions.get(id) ?? []
    const head = vs.filter((v) => v.kind !== 'enhanced').at(-1)
    return {
      sessionId: id,
      version: head?.version ?? 0,
      markdown: head?.markdown ?? '',
      updatedAt: head?.createdAt ?? null,
      pendingEnhancement: null,
    }
  }
  function appendNote(id: string, v: Omit<NoteVersion, 'sessionId' | 'version' | 'createdAt'>): Note {
    const vs = noteVersions.get(id) ?? []
    const version: NoteVersion = { ...v, sessionId: id, version: vs.length + 1, createdAt: iso(now()) }
    noteVersions.set(id, [...vs, version])
    durable(id, { type: 'note.version', version })
    return noteOf(id)
  }
  const conflict = (message: string) => Object.assign(new Error(message), { code: 'conflict' })

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
    async calendarStatus() {
      return {
        state: 'ok' as const,
        provider: 'demo',
        detail: null,
        calendars: [{ id: 'demo', name: 'Demo calendar' }],
        updatedAt: new Date().toISOString(),
      }
    },
    async notes(id: string) {
      return { note: noteOf(id), enhanced: null }
    },
    async putNotes(id: string, body: { markdown: string; baseVersion: number }) {
      const cur = noteOf(id)
      if (cur.version !== body.baseVersion) throw conflict(`the head is version ${cur.version}`)
      if (cur.markdown === body.markdown) return cur
      return appendNote(id, {
        kind: 'user',
        markdown: body.markdown,
        baseVersion: body.baseVersion,
        enhancement: null,
        merge: null,
        restoredFrom: null,
      })
    },
    async *enhanceNotes(id: string, body: { templateId?: string }): AsyncGenerator<EnhanceStreamEvent> {
      yield { type: 'started', templateId: body.templateId ?? 'general', baseVersion: noteOf(id).version }
      yield { type: 'error', error: { code: 'unavailable', message: 'the demo has no language model' } }
    },
    async mergeNotes(id: string) {
      throw conflict(`no enhanced version of ${id} to merge`)
    },
    async templates() {
      return {
        templates: DEMO_TEMPLATES,
        suggested: { templateId: 'general', reason: 'default' as const, matched: null },
      }
    },
    async listSpeakers(id: string) {
      if (!sessions.has(id)) throw demoError('not_found', `no session ${id}`)
      return summaries(id)
    },
    async renameSpeaker(id: string, speakerId: string, label: string) {
      const p = speakerOf(id, speakerId)
      checkLabel(id, label, speakerId)
      const next = { ...p, label: label.trim(), named: true }
      upsertSpeaker(next)
      return next
    },
    async mergeSpeaker(id: string, speakerId: string, into: string) {
      if (speakerId === into) throw demoError('bad_request', 'cannot merge a speaker into itself')
      speakerOf(id, speakerId)
      const target = speakerOf(id, into)
      speakers.set(
        id,
        (speakers.get(id) ?? []).map((x) => (x.id === speakerId ? { ...x, mergedInto: into } : x)),
      )
      for (const g of segments.get(id) ?? [])
        if (g.speakerId === speakerId) {
          g.speakerId = into
          g.speaker = target.label
        }
      durable(id, { type: 'speaker.merged', sessionId: id, fromId: speakerId, intoId: into })
      return target
    },
    async splitSpeaker(id: string, speakerId: string, segmentIds: string[]) {
      const segs = segments.get(id) ?? []
      for (const sid of segmentIds) {
        const g = segs.find((x) => x.id === sid)
        if (!g) throw demoError('not_found', `no segment ${sid}`)
        if (g.track !== 'system') throw demoError('bad_request', `segment ${sid} is the user's (mic)`)
        if ((g.speakerId ?? THEM) !== speakerId)
          throw demoError('bad_request', `segment ${sid} is not ${speakerId}'s`)
      }
      const all = speakers.get(id) ?? []
      const used = all.map((x) => Number(/^Speaker (\d+)$/.exec(x.label)?.[1] ?? 0))
      const p: Speaker = {
        id: newId('spk', now()),
        sessionId: id,
        label: `Speaker ${Math.max(0, ...used) + 1}`,
        named: false,
        colour: all.length % SPEAKER_COLOURS,
        voiceprintId: null,
        mergedInto: null,
        createdAt: iso(now()),
      }
      upsertSpeaker(p)
      attribute(id, p.id, [...segmentIds])
      return p
    },
    dispose() {
      clearIv(tick)
      clearIv(churn)
      listeners.clear()
    },
  }
}
