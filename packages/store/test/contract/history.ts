import type { QaMessage, StoredSettings, TrackKind } from '@gnomeola/protocol'
import { pick, randInt } from '@gnomeola/testkit/daemon'
import type { StoreApi } from '../../src/api.ts'

// Shared fixtures for the dialect contract suite. Everything is deterministic — ids included — so two
// stores of different dialects driven with the same seed and clock must end up byte-identical.

export function tickingClock(start = Date.parse('2026-09-01T09:00:00.000Z')) {
  let t = start
  return () => {
    t += 1000
    return new Date(t)
  }
}

export function defaultsForTest(): StoredSettings {
  return {
    llm: { provider: 'anthropic', model: 'claude-opus-5', ollamaUrl: 'http://127.0.0.1:11434' },
    stt: { liveModel: 'l', finalModel: 'f', finalPass: 'during' },
    capture: { micDevice: 'default', systemDevice: 'default' },
    retention: { audio: 'keep', days: 30, archive: false },
  }
}

let qaCounter = 0
export function qa(sessionId: string | null, role: QaMessage['role'] = 'user', id?: string): QaMessage {
  const n = ++qaCounter
  return {
    id: id ?? `qa_test${String(n).padStart(8, '0')}`,
    sessionId,
    requestId: id ? `req_${id}` : `req_test${String(n).padStart(8, '0')}`,
    role,
    text: 'what did we decide?',
    citations: [],
    model: role === 'assistant' ? 'claude-opus-5' : null,
    usage:
      role === 'assistant'
        ? { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }
        : null,
    stopReason: null,
    createdAt: '2026-09-01T10:00:00.000Z',
  }
}

export const WORDS = [
  'retry',
  'budget',
  'migration',
  'thursday',
  'dashboard',
  'café',
  'naïve',
  'ship',
  'zebra',
  'œuvre',
  'on-call',
  'Ünïcödé',
]

/** Drive a store through a random but legal history; returns how many events it produced. */
export async function randomHistory(s: StoreApi, rnd: () => number, steps: number): Promise<number> {
  const cursor = new Map<string, Record<TrackKind, number>>()
  const segIds = new Map<string, { id: string; track: TrackKind; final: boolean }[]>()
  let n = 0
  let ids = 0
  const id = (kind: string) => `${kind}_h${String(++ids).padStart(8, '0')}`
  const text = () => Array.from({ length: randInt(rnd, 1, 12) }, () => pick(rnd, WORDS)).join(' ')
  for (let i = 0; i < steps; i++) {
    const sessions = [...cursor.keys()]
    const r = rnd()
    if (!sessions.length || r < 0.08) {
      const x = await s.createSession({ id: id('ses'), title: text(), private: rnd() < 0.3 })
      cursor.set(x.id, { mic: 0, system: 0 })
      segIds.set(x.id, [])
    } else if (r < 0.15) {
      const sid = pick(rnd, sessions)
      const title = text()
      const priv = rnd() < 0.5
      const status = pick(rnd, ['idle', 'recording', 'paused', 'stopped'] as const)
      const add = randInt(rnd, 0, 5000)
      const gap = rnd() < 0.3
      await s.updateSession(sid, (x) => ({
        ...x,
        title,
        private: priv,
        status,
        durationMs: x.durationMs + add,
        tracks: gap
          ? [
              {
                kind: 'system',
                device: 'alsa_output.x.monitor',
                sampleRate: 16000,
                audioPath: `/a/${sid}/system.wav`,
                archivePath: null,
                gaps: [{ atMs: add, durationMs: 250, reason: 'device switch' }],
              },
            ]
          : x.tracks,
      }))
    } else if (r < 0.18 && sessions.length > 2) {
      const sid = pick(rnd, sessions)
      await s.deleteSession(sid)
      cursor.delete(sid)
      segIds.delete(sid)
    } else if (r < 0.22) {
      const sid = pick(rnd, sessions)
      await s.addQaMessage(qa(rnd() < 0.8 ? sid : null, rnd() < 0.5 ? 'user' : 'assistant', id('qa')))
    } else if (r < 0.24) {
      const v = defaultsForTest()
      v.retention.days = randInt(rnd, 1, 90)
      await s.putSettings(v)
    } else {
      const sid = pick(rnd, sessions)
      const known = segIds.get(sid)!
      const open = known.filter((k) => !k.final)
      if (open.length && rnd() < 0.5) {
        const k = pick(rnd, open)
        const cur = (await s.getSegment(k.id))!
        const final = rnd() < 0.5
        await s.upsertSegment({ ...cur, text: text(), quality: final ? 'final' : 'live', confidence: rnd() })
        k.final = final
      } else {
        const track: TrackKind = rnd() < 0.5 ? 'mic' : 'system'
        const c = cursor.get(sid)!
        const start = c[track] + randInt(rnd, 0, 500)
        const end = start + randInt(rnd, 200, 4000)
        c[track] = end
        const g = await s.upsertSegment({
          id: id('seg'),
          sessionId: sid,
          track,
          speaker: track === 'mic' ? 'me' : pick(rnd, ['them', 'speaker-1', 'Ana']),
          startMs: start,
          endMs: end,
          text: text(),
          quality: 'live',
          confidence: null,
        })
        known.push({ id: g.id, track, final: false })
      }
    }
    n++
  }
  return n
}
