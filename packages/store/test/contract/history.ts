import {
  type DurableEvent,
  defaultChoices,
  diffNoteBlocks,
  type QaMessage,
  type StoredSettings,
  type TrackKind,
} from '@kacola/protocol'
import { pick, randInt } from '@kacola/testkit/daemon'
import type { StoreApi } from '../../src/api.ts'
import { NoteStore } from '../../src/notes.ts'
import { Store } from '../../src/store.ts'

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
    autoRecord: { calendar: false, micActivity: false },
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
      const sid = id('ses')
      const withMeeting = rnd() < 0.3
      const x = await s.createSession({
        id: sid,
        title: text(),
        private: rnd() < 0.3,
        // M4: some sessions are recorded for a calendar meeting
        ...(withMeeting
          ? {
              meeting: {
                id: `mtg_${sid}`,
                uid: `${sid}@example.com`,
                title: text(),
                start: '2026-09-01T10:00:00.000Z',
                end: '2026-09-01T10:30:00.000Z',
                join: null,
                calendar: 'Work',
              },
            }
          : {}),
      })
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

/**
 * A device log WITH notes, written by the real notes writer (NoteStore over the SQLite Store): user
 * edits, an enhancement awaiting review, a merge, a restore, custom templates, and a deleted session
 * whose notes must vanish with it. StoreApi has no notes writes — hosted stores only receive notes by
 * replay or sync — so this is how every dialect's notes path gets exercised.
 */
export function notesLog(): { store: Store; events: DurableEvent[] } {
  const now = tickingClock()
  const store = Store.open(':memory:', { now })
  const notes = new NoteStore(store)
  const a = store.createSession({ id: 'ses_notes0001', title: 'Standup' })
  const b = store.createSession({ id: 'ses_notes0002', title: 'Retro' })
  const gone = store.createSession({ id: 'ses_notes0003', title: 'Deleted later' })
  notes.put(a.id, '# Standup\n\n- retry budget\n', 0, now())
  notes.put(a.id, '# Standup\n\n- retry budget is three\n- [ ] Ana: ship Thursday\n', 1, now())
  const enh = notes.addEnhanced(
    a.id,
    '# Standup\n\n## Decisions\n\n- Retry budget: three attempts [1]\n\n## Actions\n\n- [ ] Ana: ship Thursday\n',
    2,
    { templateId: 'standup', model: 'claude-opus-5', usage: null, stopReason: 'end_turn', citations: [] },
    now(),
  )
  const hunks = diffNoteBlocks(notes.get(a.id).markdown, enh.markdown)
  notes.merge(a.id, enh.version, 2, defaultChoices(hunks), now())
  notes.restore(a.id, 1, notes.get(a.id).version, now())
  notes.put(b.id, 'café naïve notes', 0, now())
  notes.addEnhanced(
    b.id,
    '# Retro\n\ncafé',
    1,
    { templateId: 'retro', model: null, usage: null, stopReason: null, citations: [] },
    now(),
  )
  notes.put(gone.id, 'soon gone', 0, now())
  notes.putTemplate({
    id: 'one-on-one',
    name: '1:1',
    builtIn: false,
    keywords: ['1:1', 'one on one'],
    body: '## Topics',
  })
  notes.putTemplate({ id: 'tmp', name: 'Temp', builtIn: false, keywords: [], body: 'x' })
  notes.deleteTemplate('tmp')
  store.deleteSession(gone.id)
  return { store, events: store.eventsAfter(0) }
}

/**
 * A device log WITH M3 attribution, written by the real writer (the SQLite Store): diarized speakers,
 * segments attributed automatically and by a person, a rename, a merge, a split, voiceprints linked,
 * upserted and deleted, and a deleted session whose speakers must vanish with it.
 */
export function speakersLog(): { store: Store; events: DurableEvent[] } {
  const store = Store.open(':memory:', { now: tickingClock() })
  const a = store.createSession({ id: 'ses_spk0001', title: 'Standup with Ana and Ben' })
  const gone = store.createSession({ id: 'ses_spk0002', title: 'Deleted later' })
  const s1 = store.createSpeaker(a.id, { id: 'spk_a1' })
  const s2 = store.createSpeaker(a.id, { id: 'spk_a2' })
  const s3 = store.createSpeaker(a.id, { id: 'spk_a3' })
  store.createSpeaker(gone.id, { id: 'spk_g1' })
  const seg = (id: string, n: number, speakerId?: string) =>
    store.upsertSegment({
      id,
      sessionId: a.id,
      track: 'system',
      speaker: 'them',
      ...(speakerId ? { speakerId } : {}),
      startMs: n * 1000,
      endMs: n * 1000 + 900,
      text: `far end line ${n} about the retry budget`,
      quality: 'live',
      confidence: null,
    })
  seg('seg_s1', 1, s1.id)
  seg('seg_s2', 2, s2.id)
  seg('seg_s3', 3, s3.id)
  seg('seg_s4', 4)
  seg('seg_s5', 5)
  store.upsertSegment({
    id: 'seg_m1',
    sessionId: a.id,
    track: 'mic',
    speaker: 'me',
    startMs: 6000,
    endMs: 6500,
    text: 'my own words',
    quality: 'final',
    confidence: 0.9,
  })
  store.attributeSegments(a.id, s1.id, ['seg_s4'], 'auto')
  store.attributeSegments(a.id, s2.id, ['seg_s5'], 'user')
  store.renameSpeaker(a.id, s1.id, 'Ana')
  store.mergeSpeakers(a.id, s3.id, s2.id)
  store.renameSpeaker(a.id, s2.id, 'Ben')
  store.splitSpeaker(a.id, s2.id, ['seg_s5'])
  const vp = {
    id: 'vp_ana',
    name: 'Ana',
    model: 'embed-test',
    embedding: [0.25, -0.5, 0.125],
    samples: 1,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  }
  store.upsertVoiceprint(vp)
  store.linkVoiceprint(a.id, s1.id, vp.id)
  store.upsertVoiceprint({ ...vp, id: 'vp_tmp', name: 'Temp' })
  store.deleteVoiceprint('vp_tmp')
  store.deleteSession(gone.id)
  return { store, events: store.eventsAfter(0) }
}
