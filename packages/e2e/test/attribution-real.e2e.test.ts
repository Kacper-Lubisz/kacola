import type { Segment } from '@kacola/protocol'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { type Fixture, loadFixture } from '@kacola/testkit/fixtures'
import { assertNoViolations, checkAttribution, checkSegments } from '@kacola/testkit/invariants'
import { der } from '@kacola/testkit/metrics'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@kacola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { kacola } from '../src/cli.ts'

// M3 on real audio (V-3 + A-6). Multi-speaker fixture meetings are played in real time into the
// synthetic PipeWire rig; the REAL daemon records them through the production capture path and the real
// models — VAD, both tiers, pyannote turn splitting, TitaNet embeddings, online clustering, the echo gate
// — then we check attribution end to end:
//   · the absolute invariant: every mic segment is `me`, no far-end segment ever is
//   · the far end is told apart (DER within a real-path bound, the right number of speakers)
//   · naming a speaker relabels the transcript for the CLI's --speaker, and (voiceprints on) the same
//     voice in the NEXT meeting arrives already named
//   · loud speaker bleed never becomes "me" (the echo gate on the real path)

let rig: PipeWireRig
let d: DaemonHandle
let defaults: Awaited<ReturnType<typeof readDefaults>>

beforeAll(async () => {
  defaults = await readDefaults()
  rig = await PipeWireRig.create()
  d = await startDaemon({ fake: false })
  await d.client.call('updateSettings', {
    body: {
      capture: { micDevice: rig.mic.captureTarget, systemDevice: rig.system.captureTarget },
      speakers: { diarize: true, voiceprints: true },
    },
  })
  const models = (await d.client.call('health')).models
  for (const role of ['segmentation', 'embedding'] as const)
    expect(
      models.some((m) => m.role === role && m.state === 'ready'),
      `${role} model installed`,
    ).toBe(true)
}, 120_000)

afterAll(async () => {
  await d?.stop()
  await rig?.teardown()
  if (defaults) await assertDefaultsUnchanged(defaults)
}, 120_000)

async function record(f: Fixture, title: string): Promise<{ id: string; segments: Segment[] }> {
  const s = await d.client.call('createSession', { body: { title } })
  await d.client.call('startSession', { params: { id: s.id } })
  await rig.playTogether(
    [
      [rig.mic, f.wavPath('mic')],
      [rig.system, f.wavPath('system')],
    ],
    { timeoutMs: f.truth.durationMs + 30_000 },
  )
  const stopped = await d.client.call('stopSession', { params: { id: s.id } })
  expect(stopped.status, stopped.error ?? '').toBe('stopped')
  const segments = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
  assertNoViolations(checkSegments(segments, { durationMs: stopped.durationMs, requireFinal: true }), title)
  // V-3: attribution is never wrong about the user
  assertNoViolations(checkAttribution(segments), `${title} attribution`)
  for (const g of segments.filter((x) => x.track === 'system'))
    expect(g.speakerId, `far-end ${g.id} attributed`).toMatch(/^spk_/)
  return { id: s.id, segments }
}

/** Real capture starts a little after the file does: shift the hypothesis by the best offset (±1 s). */
function farEndDer(f: Fixture, segments: Segment[]) {
  const ref = f.utterances('system').map((u) => ({ speaker: u.speaker, startMs: u.startMs, endMs: u.endMs }))
  let best = Number.POSITIVE_INFINITY
  for (let shift = -1000; shift <= 1000; shift += 50) {
    const hyp = segments
      .filter((s) => s.track === 'system')
      .map((s) => ({ speaker: s.speakerId!, startMs: s.startMs + shift, endMs: s.endMs + shift }))
    best = Math.min(best, der(ref, hyp, { collarMs: 250 }).der)
  }
  return best
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

describe('attribution on real audio', () => {
  const planning = loadFixture('planning-3p-crosstalk')
  const standup = loadFixture('standup-2p')
  const bleed = loadFixture('crosstalk-bleed-3p')
  let first: { id: string; segments: Segment[] }

  it('planning-3p-crosstalk: two far-end people told apart, the user always me', async () => {
    first = await record(planning, 'Planning (real audio)')
    const sp = (await d.client.call('listSpeakers', { params: { id: first.id } })).speakers
    const far = sp.filter((s) => s.id.startsWith('spk_') && s.segments > 0)
    expect(far.map((s) => s.label).sort()).toEqual(['Speaker 1', 'Speaker 2'])
    const x = farEndDer(planning, first.segments)
    console.log(`[real-audio] planning-3p-crosstalk far-end DER ${(x * 100).toFixed(1)}%`)
    expect(x).toBeLessThan(0.15)
  }, 240_000)

  it('naming a speaker relabels their lines for the CLI, and remembers their voice', async () => {
    const ana = whoIs(planning, first.segments, 'Ana')
    const r = await d.client.call('renameSpeaker', {
      params: { id: first.id, speakerId: ana },
      body: { label: 'Ana' },
    })
    expect(r.voiceprintId).toMatch(/^vp_/)
    const cli = await kacola(['speakers', first.id], d.baseUrl)
    expect(cli.code, cli.stderr).toBe(0)
    expect(JSON.parse(cli.stdout).speakers.map((s: { label: string }) => s.label)).toContain('Ana')
    const w = await kacola(
      ['transcript', first.id, '--from', '0:00', '--to', '1:10', '--speaker', 'ana'],
      d.baseUrl,
    )
    expect(w.code, w.stderr).toBe(0)
    const lines = JSON.parse(w.stdout).segments as { speaker: string; text: string }[]
    expect(lines.length).toBeGreaterThan(2)
    expect(new Set(lines.map((l) => l.speaker))).toEqual(new Set(['Ana']))
    expect(lines.map((l) => l.text).join(' ')).toMatch(/dashboard/i) // Ana's line from the script
    const vps = await d.client.call('listVoiceprints')
    expect(vps.voiceprints.map((v) => v.name)).toEqual(['Ana'])
  })

  it('A-6: in the next meeting (standup-2p, the same voice) Ana arrives already named', async () => {
    const next = await record(standup, 'Standup (real audio)')
    const sp = (await d.client.call('listSpeakers', { params: { id: next.id } })).speakers
    const far = sp.filter((s) => s.id.startsWith('spk_') && s.segments > 0)
    console.log(`[real-audio] standup-2p speakers: ${JSON.stringify(far.map((s) => [s.label, s.segments]))}`)
    const ana = far.find((s) => s.label === 'Ana')
    expect(ana, 'Ana recognised from her voiceprint').toBeDefined()
    // and she is the one who said most of the far end
    expect(ana!.talkMs).toBeGreaterThan(0.8 * far.reduce((a, s) => a + s.talkMs, 0))
    const x = farEndDer(standup, next.segments)
    console.log(`[real-audio] standup-2p far-end DER ${(x * 100).toFixed(1)}%`)
    expect(x).toBeLessThan(0.1)
  }, 240_000)

  it('crosstalk-bleed-3p: loud speaker bleed never becomes "me"', async () => {
    const r = await record(bleed, 'Bleed (real audio)')
    const truth = bleed.utterances('mic')
    let phantom = 0
    for (const s of r.segments.filter((x) => x.track === 'mic'))
      for (let t = s.startMs; t < s.endMs; t += 10)
        if (!truth.some((u) => t >= u.startMs - 800 && t < u.endMs + 800)) phantom += 10
    const x = farEndDer(bleed, r.segments)
    console.log(
      `[real-audio] crosstalk-bleed-3p: far-end DER ${(x * 100).toFixed(1)}%, phantom me ${phantom} ms`,
    )
    expect(phantom).toBeLessThan(1000)
    expect(x).toBeLessThan(0.2)
  }, 240_000)
})
