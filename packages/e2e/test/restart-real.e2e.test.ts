import { execFileSync } from 'node:child_process'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import { assertNoViolations, checkSegments } from '@gnomeola/testkit/invariants'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// A real meeting through a daemon restart: the REAL daemon records two virtual PipeWire devices with the
// production capture path and the real models; mid-meeting it gets SIGTERM (systemctl restart), a new
// daemon comes up on the same data dir a couple of seconds later, and the same session carries on —
// the WAVs continue after a `restart` gap of the real length and the second half of the meeting is
// transcribed into the same transcript.

const FIXTURE = loadFixture('standup-2p')
const box = mkdtempSync(join(tmpdir(), 'gnomeola-restart-real-'))

let rig: PipeWireRig
let d: DaemonHandle
let defaults: Awaited<ReturnType<typeof readDefaults>>

/** Seconds [from, from+len) of the fixture's track, as its own WAV. */
const clip = (t: 'mic' | 'system', from: number, len: number) => {
  const out = join(box, `${t}-${from}.wav`)
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    String(from),
    '-t',
    String(len),
    '-i',
    FIXTURE.wavPath(t),
    out,
  ])
  return out
}

beforeAll(async () => {
  defaults = await readDefaults()
  rig = await PipeWireRig.create()
  d = await startDaemon({ fake: false, env: { GNOMEOLA_RESUME_WINDOW_MS: '60000' } })
  await d.client.call('updateSettings', {
    body: { capture: { micDevice: rig.mic.captureTarget, systemDevice: rig.system.captureTarget } },
  })
  expect((await d.client.call('health')).capture).toMatchObject({ available: true, backend: 'pipewire' })
}, 120_000)

afterAll(async () => {
  await d?.stop()
  await rig?.teardown()
  if (defaults) await assertDefaultsUnchanged(defaults)
}, 120_000)

describe('a real meeting through a daemon restart', () => {
  it('SIGTERM mid-meeting, a new daemon 2 s later: same session, real gap, the second half transcribed', async () => {
    const s = await d.client.call('createSession', { body: { title: 'Standup through a restart' } })
    await d.client.call('startSession', { params: { id: s.id } })
    await rig.playTogether(
      [
        [rig.mic, clip('mic', 0, 20)],
        [rig.system, clip('system', 0, 20)],
      ],
      { timeoutMs: 60_000 },
    )
    await waitFor(
      async () => (await d.client.call('getTranscript', { params: { id: s.id } })).total >= 2,
      30_000,
      'segments from the first half',
    )
    expect(await d.kill('SIGTERM')).toEqual({ code: 0, signal: null })
    await new Promise((r) => setTimeout(r, 2000))
    await d.restart()
    await waitFor(
      async () => (await d.client.call('getSession', { params: { id: s.id } })).status === 'recording',
      60_000,
      'the session to be recording again (models load first)',
    )
    const resumed = await d.client.call('getSession', { params: { id: s.id } })
    const gaps = resumed.tracks.map((t) => t.gaps.find((g) => g.reason === 'restart'))
    for (const g of gaps) expect(g?.durationMs).toBeGreaterThanOrEqual(2000)
    const gap = gaps[0]!
    const firstHalf = (await d.client.call('getTranscript', { params: { id: s.id } })).segments

    await rig.playTogether(
      [
        [rig.mic, clip('mic', 20, 20)],
        [rig.system, clip('system', 20, 20)],
      ],
      { timeoutMs: 60_000 },
    )
    const stopped = await d.client.call('stopSession', { params: { id: s.id } })
    expect(stopped.status).toBe('stopped')
    const all = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    const before = new Set(firstHalf.map((g: Segment) => g.id))
    const after = all.filter((g) => !before.has(g.id))
    expect(after.length, 'segments from the second half').toBeGreaterThan(0)
    for (const g of after) expect(g.startMs).toBeGreaterThanOrEqual(gap.atMs + gap.durationMs - 50)
    assertNoViolations(
      checkSegments(all, { durationMs: stopped.durationMs }),
      'transcript across the restart',
    )
    // one WAV per track across both daemons: first half + gap + second half
    for (const t of stopped.tracks) {
      const ms = (statSync(t.audioPath!).size - 44) / 2 / 16 // 16 kHz s16 mono after our 44-byte header
      expect(ms).toBeGreaterThan(gap.atMs + gap.durationMs + 15_000)
    }
    console.log(
      `[restart-real] ${firstHalf.length} segments before, ${after.length} after a ${gap.durationMs} ms gap at ${gap.atMs} ms`,
    )
  }, 240_000)
})
