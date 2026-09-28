import { type AnyEvent, type DurableEvent, newId, type Session, type TrackKind } from '@gnomeola/protocol'
import type { DataSource, Snapshot, SubscribeHandlers } from './source.ts'

// GNOMEOLA_UI_DEMO=1: an in-process stand-in for the daemon. It speaks the same event vocabulary
// (durable session.upserted with a gap-free seq, ephemeral audio.level), so the store, the hooks and
// every widget run the same code paths they will against gnomeolad — only the transport differs.
//
// Behaviour: three finished sessions at start; every `intervalMs` the current recording is
// finished and a new one starts (until `maxSessions`); the recording session's duration ticks once
// a second, with a synthetic level meter.

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
  const log: DurableEvent[] = []
  const listeners = new Set<(e: AnyEvent) => void>()
  let seq = 0
  let made = 0

  const iso = (ms: number) => new Date(ms).toISOString()

  function emit(e: AnyEvent) {
    for (const l of [...listeners]) l(e)
  }

  function upsert(s: Session) {
    sessions.set(s.id, s)
    const ev: DurableEvent = {
      seq: ++seq,
      at: iso(now()),
      sessionId: s.id,
      data: { type: 'session.upserted', session: s },
    }
    log.push(ev)
    if (log.length > 2000) log.splice(0, log.length - 2000)
    emit(ev)
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

  let phase = 0
  const tick = setIv(() => {
    const cur = recording()
    if (cur) {
      const durationMs = Math.max(0, now() - Date.parse(cur.startedAt ?? cur.createdAt))
      upsert({ ...cur, durationMs })
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

  return {
    origin: 'demo',
    async load(): Promise<Snapshot> {
      return { sessions: [...sessions.values()], seq }
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
    dispose() {
      clearIv(tick)
      clearIv(churn)
      listeners.clear()
    },
  }
}
