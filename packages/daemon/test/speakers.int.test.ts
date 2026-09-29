import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GnomeolaApiError } from '@gnomeola/protocol'
import { Store } from '@gnomeola/store'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkAttribution, checkEventLog } from '@gnomeola/testkit/invariants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// A-5/A-6 through the real daemon process with the diarizing fake pipeline: speakers appear as the far
// end is told apart, renames/merges/splits are durable, and — with voiceprints switched on — a person
// named in one meeting is recognised in the next. Switching voiceprints off forgets every voice.

const FAST = JSON.stringify({
  segmentEveryMs: 100,
  finalizeAfterMs: 60,
  partialEveryMs: 40,
  levelEveryMs: 50,
  diarize: true,
})

let d: DaemonHandle
beforeAll(async () => {
  d = await startDaemon({ env: { GNOMEOLA_FAKE_PIPELINE: FAST } })
})
afterAll(async () => {
  await d?.stop()
})

/** Record until the far end has spoken `n` times (the fake cycles its voices 0,1,1,0,2,0,1…). */
async function record(title: string, n = 4) {
  const c = d.client
  const s = await c.call('createSession', { body: { title } })
  await c.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () =>
      (await c.call('getTranscript', { params: { id: s.id }, query: { track: 'system' } })).segments.length >=
      n,
    15_000,
    'far-end segments',
  )
  await c.call('stopSession', { params: { id: s.id } })
  return s.id
}

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 200
  } catch (err) {
    return err instanceof GnomeolaApiError ? err.status : -1
  }
}

describe('speakers through the daemon', () => {
  let first = ''

  it('tells the far end apart; the mic is always me', async () => {
    const c = d.client
    first = await record('Planning', 4)
    const { speakers } = await c.call('listSpeakers', { params: { id: first } })
    // (stopping flushes a last far-end line, so a third fake voice may or may not have spoken)
    expect(speakers.map((s) => s.label).slice(0, 3)).toEqual(['me', 'Speaker 1', 'Speaker 2'])
    expect(speakers.length).toBeLessThanOrEqual(4)
    expect(speakers.map((s) => s.colour)).toEqual([null, 0, 1, 2].slice(0, speakers.length))
    const t = await c.call('getTranscript', { params: { id: first } })
    assertNoViolations(checkAttribution(t.segments))
    for (const s of t.segments)
      if (s.track === 'system') expect(s.speakerId, s.id).toMatch(/^spk_/)
      else expect(s.speakerId).toBeUndefined()
    // voiceprints are off by default: nothing about anyone's voice was kept
    expect(existsSync(join(d.dataDir, 'sessions', first, 'voices.json'))).toBe(false)
    expect((await c.call('listVoiceprints')).voiceprints).toEqual([])
  })

  it('rename relabels the transcript; reserved and duplicate names are refused; merge and split are durable', async () => {
    const c = d.client
    const [, s1, s2] = (await c.call('listSpeakers', { params: { id: first } })).speakers
    const p = (speakerId: string) => ({ id: first, speakerId })
    expect((await c.call('renameSpeaker', { params: p(s1!.id), body: { label: 'Ana' } })).label).toBe('Ana')
    expect(await code(c.call('renameSpeaker', { params: p(s2!.id), body: { label: 'ME' } }))).toBe(400)
    expect(await code(c.call('renameSpeaker', { params: p(s2!.id), body: { label: 'ana' } }))).toBe(409)
    expect(await code(c.call('renameSpeaker', { params: p('me'), body: { label: 'Zed' } }))).toBe(404)
    const ana = await c.call('getTranscript', { params: { id: first }, query: { speaker: 'ANA' } })
    expect(ana.segments.length).toBeGreaterThan(0)
    expect(new Set(ana.segments.map((s) => s.speaker))).toEqual(new Set(['Ana']))
    // split one of Ana's lines off, then merge it back
    const one = ana.segments[0]!
    const split = await c.call('splitSpeaker', { params: p(s1!.id), body: { segmentIds: [one.id] } })
    const before = (await c.call('listSpeakers', { params: { id: first } })).speakers
    expect(split.label).toBe(`Speaker ${before.length - 1}`) // one past the highest number in use
    const mic = (await c.call('getTranscript', { params: { id: first }, query: { track: 'mic' } }))
      .segments[0]!
    expect(await code(c.call('splitSpeaker', { params: p(s1!.id), body: { segmentIds: [mic.id] } }))).toBe(
      400,
    )
    await c.call('mergeSpeaker', { params: p(split.id), body: { into: s1!.id } })
    expect(
      (await c.call('listSpeakers', { params: { id: first } })).speakers.map((s) => s.label).slice(0, 3),
    ).toEqual(['me', 'Ana', 'Speaker 2'])
    expect(
      (await c.call('getTranscript', { params: { id: first }, query: { speaker: 'Ana' } })).segments.length,
    ).toBe(ana.segments.length)
    // the whole history replays to the same tables
    await d.kill('SIGTERM')
    const src = Store.open(join(d.dataDir, 'gnomeola.db'))
    const events = src.eventsAfter(0)
    assertNoViolations(checkEventLog(events))
    const dst = Store.open(':memory:')
    dst.replay(events)
    expect(dst.dump()).toBe(src.dump())
    src.close()
    dst.close()
    await d.restart()
  })

  it('A-6: with voiceprints on, a person named in one meeting is recognised in the next', async () => {
    const c = d.client
    await c.call('updateSettings', { body: { speakers: { voiceprints: true } } })
    const meeting1 = await record('Monday sync', 4)
    const voices = join(d.dataDir, 'sessions', meeting1, 'voices.json')
    expect(existsSync(voices)).toBe(true)
    expect(JSON.parse(readFileSync(voices, 'utf8')).model).toBe('fake-embedding')
    const [, s1] = (await c.call('listSpeakers', { params: { id: meeting1 } })).speakers
    expect(s1!.label).toBe('Speaker 1')
    // naming them after the meeting remembers their voice
    const named = await c.call('renameSpeaker', {
      params: { id: meeting1, speakerId: s1!.id },
      body: { label: 'Priya' },
    })
    expect(named.voiceprintId).toMatch(/^vp_/)
    expect((await c.call('listVoiceprints')).voiceprints).toEqual([
      expect.objectContaining({ name: 'Priya', model: 'fake-embedding', samples: 1 }),
    ])
    // the next meeting: Priya arrives named; the other voice is still just a number
    const meeting2 = await record('Tuesday sync', 4)
    const sp = (await c.call('listSpeakers', { params: { id: meeting2 } })).speakers
    expect(sp.map((s) => [s.label, s.named, s.voiceprintId]).slice(0, 3)).toEqual([
      ['me', false, null],
      ['Priya', true, named.voiceprintId],
      ['Speaker 1', false, null],
    ])
    expect(sp.slice(3).every((s) => !s.named && s.voiceprintId === null)).toBe(true)
    const t = await c.call('getTranscript', { params: { id: meeting2 }, query: { speaker: 'priya' } })
    expect(t.segments.length).toBeGreaterThan(0)
    // …and the meeting refined her voiceprint
    expect((await c.call('listVoiceprints')).voiceprints[0]!.samples).toBe(2)
  })

  it('switching voiceprints off forgets every voice, and diarize off leaves the far end as them', async () => {
    const c = d.client
    await c.call('updateSettings', { body: { speakers: { voiceprints: false } } })
    await waitFor(async () => (await c.call('listVoiceprints')).voiceprints.length === 0, 5_000, 'forgotten')
    const sessions = (await c.call('listSessions', { query: { limit: 50 } })).sessions
    for (const s of sessions)
      expect(existsSync(join(d.dataDir, 'sessions', s.id, 'voices.json')), s.id).toBe(false)
    await c.call('updateSettings', { body: { speakers: { diarize: false } } })
    const plain = await record('No diarization', 2)
    const t = await c.call('getTranscript', { params: { id: plain }, query: { track: 'system' } })
    expect(new Set(t.segments.map((s) => s.speaker))).toEqual(new Set(['them']))
    expect((await c.call('listSpeakers', { params: { id: plain } })).speakers.map((s) => s.id)).toEqual([
      'me',
      'them',
    ])
  })
})
