import { floatToPcm16, ingestPcm, type Segment, type TrackKind } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { type Fixture, loadFixture } from '@kacola/testkit/fixtures'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pacedFrames } from '../src/external-client.ts'

// A-6 (recognising people across meetings) on the macOS recording path: the app's capture is stood in for
// by streaming each fixture meeting's two tracks to the ingest route in real time, into a daemon with the
// external backend and the real models (VAD, both tiers, pyannote, TitaNet). Name a far-end voice in one
// meeting; in the next meeting that voice arrives already named. attribution-real.e2e is the same story
// through PipeWire (Linux only); this one runs anywhere, the Mac included.

const TRACKS: TrackKind[] = ['mic', 'system']
let d: DaemonHandle

beforeAll(async () => {
  d = await startDaemon({ fake: false, env: { KACOLA_CAPTURE: 'external' } })
  const models = (await d.client.call('health')).models
  for (const role of ['segmentation', 'embedding'] as const)
    expect(
      models.some((m) => m.role === role && m.state === 'ready'),
      `${role} model installed`,
    ).toBe(true)
  // the default, now that the switch is gone from Preferences
  expect((await d.client.call('getSettings')).speakers).toEqual({ diarize: true, voiceprints: true })
}, 120_000)

afterAll(async () => {
  await d?.stop()
})

async function record(f: Fixture, title: string): Promise<{ id: string; segments: Segment[] }> {
  const s = await d.client.call('createSession', { body: { title } })
  await d.client.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () => (await d.client.call('externalCaptureStatus')).captures.some((c) => c.sessionId === s.id),
    5_000,
    'the recording to wait for external audio',
  )
  const t0 = performance.now()
  await Promise.all(
    TRACKS.map((track, i) =>
      ingestPcm({
        baseUrl: d.baseUrl,
        sessionId: s.id,
        track,
        frames: pacedFrames(floatToPcm16(f.pcm(track)), { epoch: 100 + i, t0 }),
      }),
    ),
  )
  const stopped = await d.client.call('stopSession', { params: { id: s.id } })
  expect(stopped.status, stopped.error ?? '').toBe('stopped')
  const segments = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
  for (const g of segments.filter((x) => x.track === 'system'))
    expect(g.speakerId, `far-end ${g.id} attributed`).toMatch(/^spk_/)
  return { id: s.id, segments }
}

/** The far-end speaker (id) who said most of a person's lines. */
function whoIs(f: Fixture, segments: Segment[], name: string): string {
  const time = new Map<string, number>()
  for (const u of f.utterances('system').filter((x) => x.speaker === name))
    for (const s of segments.filter((x) => x.track === 'system')) {
      const o = Math.min(u.endMs, s.endMs) - Math.max(u.startMs, s.startMs)
      if (o > 0) time.set(s.speakerId!, (time.get(s.speakerId!) ?? 0) + o)
    }
  return [...time].sort((a, b) => b[1] - a[1])[0]![0]
}

describe('recognising people across meetings, through the app’s capture path', () => {
  const planning = loadFixture('planning-3p-crosstalk')
  const standup = loadFixture('standup-2p')
  let first: { id: string; segments: Segment[] }

  it('planning: the far end is told apart', async () => {
    first = await record(planning, 'Planning (external capture)')
    const far = (await d.client.call('listSpeakers', { params: { id: first.id } })).speakers.filter(
      (s) => s.id.startsWith('spk_') && s.segments > 0,
    )
    console.log(`[voiceprints] planning speakers: ${JSON.stringify(far.map((s) => [s.label, s.segments]))}`)
    expect(far.length).toBe(2)
  }, 240_000)

  it('naming a voice remembers it', async () => {
    const r = await d.client.call('renameSpeaker', {
      params: { id: first.id, speakerId: whoIs(planning, first.segments, 'Ana') },
      body: { label: 'Ana' },
    })
    expect(r.voiceprintId).toMatch(/^vp_/)
    expect((await d.client.call('listVoiceprints')).voiceprints.map((v) => v.name)).toEqual(['Ana'])
  })

  it('in the next meeting the same voice arrives already named', async () => {
    const next = await record(standup, 'Standup (external capture)')
    const far = (await d.client.call('listSpeakers', { params: { id: next.id } })).speakers.filter(
      (s) => s.id.startsWith('spk_') && s.segments > 0,
    )
    console.log(`[voiceprints] standup speakers: ${JSON.stringify(far.map((s) => [s.label, s.talkMs]))}`)
    const ana = far.find((s) => s.label === 'Ana')
    expect(ana, 'Ana recognised from her voiceprint').toBeDefined()
    expect(ana!.talkMs).toBeGreaterThan(0.8 * far.reduce((a, s) => a + s.talkMs, 0))
  }, 240_000)
})
