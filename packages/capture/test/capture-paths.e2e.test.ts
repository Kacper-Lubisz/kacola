import { join } from 'node:path'
import {
  assertDefaultsUnchanged,
  detectBursts,
  PipeWireRig,
  readDefaults,
  writeFixture,
} from '@gnomeola/testkit/rig'
import { describe, expect, it } from 'vitest'
import { PipeWireCaptureSource } from '../src/index.ts'
import {
  ALIGN_TOLERANCE_MS,
  assertCaptureRun,
  observe,
  readTrack,
  runScenario,
  sleep,
  tempDir,
} from './scenario.ts'

// Level 2: the shared scenario through real PipeWire — rig devices, pw-play, the production pw-record
// path. The level-1 twin is capture-paths.int.test.ts.
describe('capture paths — level 2 (real PipeWire rig)', () => {
  it('separates, times, aligns and meters both tracks', async () => {
    const run = await runScenario('pipewire')
    const m = assertCaptureRun(run)
    console.log(`[level 2] ${JSON.stringify(m)}`)
  })

  it('30 s soak: no gaps, no stalls, both WAVs track the wall clock', async () => {
    const before = await readDefaults()
    const rig = await PipeWireRig.create()
    const dir = tempDir('soak')
    try {
      const src = new PipeWireCaptureSource({ defaultsWatcher: null })
      const obs = observe(src)
      const t0 = performance.now()
      await src.start(join(dir, 'session'), [
        { kind: 'mic', device: rig.mic.captureTarget },
        { kind: 'system', device: rig.system.captureTarget },
      ])
      const drift: number[] = []
      for (let i = 0; i < 30; i++) {
        await sleep(1000)
        for (const s of src.status()) drift.push(s.positionMs - src.elapsedMs())
      }
      const result = await src.stop()
      const wall = performance.now() - t0
      expect(result.error).toBeNull()
      expect(obs.gaps).toEqual([])
      expect(obs.errors).toEqual([])
      expect(Math.abs(result.durationMs - wall)).toBeLessThan(100)
      for (const t of result.tracks) {
        const ms = (readTrack(t.audioPath!).length / 16000) * 1000
        expect(Math.abs(ms - result.durationMs)).toBeLessThanOrEqual(60)
      }
      // position vs session clock, sampled every second: bounded by delivery latency, not growing
      console.log(
        `[soak] position−clock over 30 s: min ${Math.min(...drift).toFixed(0)} ms, max ${Math.max(...drift).toFixed(0)} ms`,
      )
      expect(Math.min(...drift)).toBeGreaterThan(-100)
      expect(Math.max(...drift)).toBeLessThan(50)
    } finally {
      await rig.teardown()
      await assertDefaultsUnchanged(before)
    }
  })

  it('aligns the two tracks: one stream fanned into both devices lands at the same timeline position', async () => {
    const before = await readDefaults()
    const rig = await PipeWireRig.create()
    const dir = tempDir('align')
    try {
      // 600 ms of silence, then three 200 ms bursts, 1 s apart.
      const wav = writeFixture(join(dir, 'fanout.wav'), {
        freq: 800,
        bursts: [
          { atMs: 600, durationMs: 200 },
          { atMs: 1600, durationMs: 200 },
          { atMs: 2600, durationMs: 200 },
        ],
        totalMs: 3200,
      })
      const src = new PipeWireCaptureSource({ defaultsWatcher: null })
      const obs = observe(src)
      await src.start(join(dir, 'session'), [
        { kind: 'mic', device: rig.mic.captureTarget },
        { kind: 'system', device: rig.system.captureTarget },
      ])
      await sleep(300)
      await rig.playInto([rig.mic, rig.system], wav)
      await sleep(300)
      const result = await src.stop()
      expect(result.error).toBeNull()
      expect(obs.gaps).toEqual([])
      const mic = detectBursts(readTrack(join(dir, 'session', 'mic.wav')), 800)
      const sys = detectBursts(readTrack(join(dir, 'session', 'system.wav')), 800)
      expect(mic).toHaveLength(3)
      expect(sys).toHaveLength(3)
      const offsets = mic.map((b, i) => sys[i]!.startMs - b.startMs)
      console.log(`[align] per-burst system−mic offsets (ms): ${offsets.map((o) => o.toFixed(2)).join(', ')}`)
      // Each track is anchored to the wall clock from its first chunk, which PipeWire delivers once per
      // graph cycle (1024 frames @ 48 kHz = 21.3 ms), so each anchor is good to ±1 quantum and the pair to
      // ±2 quanta. Observed over 11 runs: 0 ms ×8, ±10.7 ms ×2, −21.3 ms ×1.
      for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(ALIGN_TOLERANCE_MS)
      // Offsets must not drift within a take.
      expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThanOrEqual(1)
    } finally {
      await rig.teardown()
      await assertDefaultsUnchanged(before)
    }
  })
})
