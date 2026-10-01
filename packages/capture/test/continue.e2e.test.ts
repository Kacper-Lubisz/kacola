import { join } from 'node:path'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PipeWireCaptureSource, recoverWav, SAMPLES_PER_MS } from '../src/index.ts'
import { observe, readTrack, sleep, tempDir } from './scenario.ts'

// A recording continued after a daemon restart, through real PipeWire: a second capture source appends
// to the WAVs the first one left, pads the time nobody was recording with silence reported as a
// `restart` gap, and carries the session timeline on — the first run's audio untouched, both tracks
// aligned, every sample accounted for.

let rig: PipeWireRig
let defaults: Awaited<ReturnType<typeof readDefaults>>
beforeAll(async () => {
  defaults = await readDefaults()
  rig = await PipeWireRig.create()
}, 60_000)
afterAll(async () => {
  await rig?.teardown()
  if (defaults) await assertDefaultsUnchanged(defaults)
}, 60_000)

describe('continuing a recording (PipeWire)', () => {
  it('appends after a restart gap, keeping the first run byte-for-byte', async () => {
    const session = join(tempDir('continue'), 'session')
    const tracks = [
      { kind: 'mic' as const, device: rig.mic.captureTarget },
      { kind: 'system' as const, device: rig.system.captureTarget },
    ]
    const first = new PipeWireCaptureSource({ defaultsWatcher: null })
    await first.start(session, tracks)
    await sleep(2000)
    const r1 = await first.stop()
    expect(r1.error).toBeNull()
    const before = Object.fromEntries(r1.tracks.map((t) => [t.kind, readTrack(t.audioPath!)]))
    const offsetMs = Math.max(...Object.values(before).map((s) => s.length / SAMPLES_PER_MS))
    for (const t of r1.tracks) expect(recoverWav(t.audioPath!).status).toBe('ok')

    const gapMs = 1500
    const second = new PipeWireCaptureSource({ defaultsWatcher: null })
    const obs = observe(second)
    await second.start(session, tracks, { continueAt: { offsetMs, gapMs } })
    // the timeline carries on from after the gap
    expect(second.elapsedMs()).toBeGreaterThanOrEqual(offsetMs + gapMs)
    await sleep(2000)
    const r2 = await second.stop()
    expect(r2.error).toBeNull()
    expect(obs.errors).toEqual([])

    const restartGaps = obs.gaps.filter((g) => g.reason === 'restart')
    expect(restartGaps.map((g) => g.track).sort()).toEqual(['mic', 'system'])
    for (const g of restartGaps) {
      // from where that track's audio ended, up to the common resume point
      expect(g.atMs).toBe(Math.round(before[g.track]!.length / SAMPLES_PER_MS))
      expect(g.atMs + g.durationMs).toBeCloseTo(offsetMs + gapMs, -1)
    }
    for (const t of r2.tracks) {
      const all = readTrack(t.audioPath!)
      const old = before[t.kind]!
      // the first run is untouched
      expect(Buffer.from(all.buffer, all.byteOffset, old.byteLength).equals(Buffer.from(old.buffer))).toBe(
        true,
      )
      // then digital silence for the gap, then the second run (about 2 s more)
      const resumeAt = Math.round((offsetMs + gapMs) * SAMPLES_PER_MS)
      expect(all.subarray(old.length, resumeAt).every((x) => x === 0)).toBe(true)
      const ms = all.length / SAMPLES_PER_MS
      expect(ms).toBeGreaterThan(offsetMs + gapMs + 1500)
      expect(Math.abs(ms - r2.durationMs)).toBeLessThanOrEqual(80)
    }
    // both tracks still line up sample for sample
    const [a, b] = r2.tracks.map((t) => readTrack(t.audioPath!).length / SAMPLES_PER_MS)
    expect(Math.abs(a! - b!)).toBeLessThanOrEqual(60)
  }, 60_000)
})
