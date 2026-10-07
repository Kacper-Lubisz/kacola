import { join } from 'node:path'
import {
  assertDefaultsUnchanged,
  detectBursts,
  PipeWireRig,
  readDefaults,
  writeFixture,
} from '@kacola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PipeWireCaptureSource } from '../src/index.ts'
import { readTrack, sleep, tempDir } from './scenario.ts'

// Calibration of the capture path's own timeline anchoring. Both tracks record the SAME node, so they
// receive identical samples in the same graph cycle; any offset between them is purely the error of
// anchoring each pw-record stream to the session clock (nothing from playback or the rig).

let rig: PipeWireRig
let before: Awaited<ReturnType<typeof readDefaults>>
beforeAll(async () => {
  before = await readDefaults()
  rig = await PipeWireRig.create()
})
afterAll(async () => {
  await rig.teardown()
  await assertDefaultsUnchanged(before)
})

async function offsetOnce(wav: string, dir: string): Promise<number> {
  const src = new PipeWireCaptureSource({ defaultsWatcher: null })
  await src.start(dir, [
    { kind: 'mic', device: rig.system.captureTarget },
    { kind: 'system', device: rig.system.captureTarget },
  ])
  await sleep(400)
  await rig.play(rig.system, wav)
  await sleep(200)
  const r = await src.stop()
  const a = detectBursts(readTrack(r.tracks[0]!.audioPath!), 800)
  const b = detectBursts(readTrack(r.tracks[1]!.audioPath!), 800)
  expect(a).toHaveLength(1)
  expect(b).toHaveLength(1)
  return b[0]!.startMs - a[0]!.startMs
}

describe('timeline anchoring calibration', () => {
  // Measured on PipeWire 1.6.8 (rig graph quantum 512 @ 48 kHz = 10.7 ms): offsets are ±10.7 ms (one
  // quantum), structural rather than jitter: a min-over-first-300-ms anchor estimate was tried and gave the
  // same distribution, so it was not kept. Bound: two quanta (21.3 ms) plus margin.
  it('two captures of one node agree to within two graph quanta', async () => {
    const dir = tempDir('calib')
    const wav = writeFixture(join(dir, 'b.wav'), {
      freq: 800,
      bursts: [{ atMs: 100, durationMs: 200 }],
      totalMs: 400,
    })
    const offsets: number[] = []
    for (let i = 0; i < 8; i++) offsets.push(await offsetOnce(wav, join(dir, `r${i}`)))
    console.log(`[calib] same-node track offsets (ms): ${offsets.map((x) => x.toFixed(1)).join(', ')}`)
    for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(24)
  })
})
