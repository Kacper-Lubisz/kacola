import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TrackKind } from '@gnomeola/protocol'
import {
  assertDefaultsUnchanged,
  detectBursts,
  PipeWireRig,
  readDefaults,
  separationDb,
  synthesize,
  type ToneFixture,
  writeFixture,
} from '@gnomeola/testkit/rig'
import { expect } from 'vitest'
import {
  type CaptureResult,
  type CaptureSource,
  FileCaptureSource,
  type GapEvent,
  type LevelEvent,
  type PcmFrame,
  PipeWireCaptureSource,
  readWavInfo,
  wavToInt16,
} from '../src/index.ts'

// "One fixture set, one set of assertions, two capture paths." The same scenario runs through the
// FileCaptureSource (level 1, int tier, hermetic) and the PipeWireCaptureSource against the rig
// (level 2, e2e tier). If the fake were wrong in the same way as the real code, the two would still
// both have to satisfy these assertions — about the audio itself, measured, not about the code path.

export const MIC_FIXTURE: ToneFixture = {
  freq: 440,
  bursts: [
    { atMs: 500, durationMs: 1000 },
    { atMs: 3000, durationMs: 1000 },
  ],
  totalMs: 5000,
}
// 1250 Hz: far from 440 and not one of its harmonics. The second burst overlaps the mic's (cross-talk).
export const SYSTEM_FIXTURE: ToneFixture = {
  freq: 1250,
  bursts: [
    { atMs: 1500, durationMs: 1000 },
    { atMs: 3500, durationMs: 1000 },
  ],
  totalMs: 5000,
}

export type Level = 'file' | 'pipewire'

export type CaptureRun = {
  level: Level
  dir: string
  result: CaptureResult
  frames: Record<TrackKind, PcmFrame[]>
  levels: Record<TrackKind, LevelEvent[]>
  gaps: GapEvent[]
  errors: unknown[]
  pcm: Record<TrackKind, Int16Array>
}

export function tempDir(label: string): string {
  const base = join(tmpdir(), 'gnomeola-capture-tests')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, `${label}-`))
}

export function observe(src: CaptureSource) {
  const frames: Record<TrackKind, PcmFrame[]> = { mic: [], system: [] }
  const levels: Record<TrackKind, LevelEvent[]> = { mic: [], system: [] }
  const gaps: GapEvent[] = []
  const errors: unknown[] = []
  src.on('frame', (f) => frames[f.track].push(f))
  src.on('level', (l) => levels[l.track].push(l))
  src.on('gap', (g) => gaps.push(g))
  src.on('error', (e) => errors.push(e))
  return { frames, levels, gaps, errors }
}

export function readTrack(path: string): Int16Array {
  return wavToInt16(readFileSync(path)).samples
}

export async function runScenario(level: Level): Promise<CaptureRun> {
  const dir = tempDir(level)
  const micWav = writeFixture(join(dir, 'fixture-mic.wav'), MIC_FIXTURE)
  const sysWav = writeFixture(join(dir, 'fixture-system.wav'), SYSTEM_FIXTURE)
  const session = join(dir, 'session')
  if (level === 'file') {
    const src = new FileCaptureSource({ speed: 20 })
    const obs = observe(src)
    await src.start(session, [
      { kind: 'mic', device: micWav },
      { kind: 'system', device: sysWav },
    ])
    const result = await src.done
    return { level, dir, result, ...obs, pcm: pcmOf(result) }
  }
  const before = await readDefaults()
  const rig = await PipeWireRig.create()
  try {
    const src = new PipeWireCaptureSource({ defaultsWatcher: null })
    const obs = observe(src)
    await src.start(session, [
      { kind: 'mic', device: rig.mic.captureTarget },
      { kind: 'system', device: rig.system.captureTarget },
    ])
    await sleep(400)
    await rig.playTogether([
      [rig.mic, micWav],
      [rig.system, sysWav],
    ])
    await sleep(400)
    const result = await src.stop()
    return { level, dir, result, ...obs, pcm: pcmOf(result) }
  } finally {
    await rig.teardown()
    await assertDefaultsUnchanged(before)
  }
}

function pcmOf(result: CaptureResult): Record<TrackKind, Int16Array> {
  const get = (k: TrackKind) => readTrack(result.tracks.find((t) => t.kind === k)!.audioPath!)
  return { mic: get('mic'), system: get('system') }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Cross-track alignment on real PipeWire: each track is anchored to the wall clock from its first
 * chunk, and chunks arrive once per graph cycle (1024 frames @ 48 kHz = 21.3 ms), so the pair is good to
 * ±2 quanta. Within a take the offset is constant (no drift).
 */
export const ALIGN_TOLERANCE_MS = 45

/** Tolerances: the file path is sample-exact; PipeWire adds resampling and graph-cycle quantisation. */
export function tolerances(level: Level) {
  return level === 'file'
    ? { intervalMs: 1, durationMs: 0.1, alignMs: 1, lengthMs: 1 }
    : { intervalMs: 5, durationMs: 3, alignMs: ALIGN_TOLERANCE_MS, lengthMs: 60 }
}

/** The shared assertion set. Returns measurements for the report. */
export function assertCaptureRun(run: CaptureRun) {
  const tol = tolerances(run.level)
  const { result, pcm } = run
  expect(result.error).toBeNull()
  expect(result.tracks.map((t) => t.kind).sort()).toEqual(['mic', 'system'])

  // 1. Valid 16 kHz mono s16 WAVs whose header describes the whole file.
  for (const t of result.tracks) {
    const info = readWavInfo(t.audioPath!)
    expect({
      rate: info.sampleRate,
      ch: info.channels,
      bits: info.bitsPerSample,
      fmt: info.audioFormat,
    }).toEqual({
      rate: 16000,
      ch: 1,
      bits: 16,
      fmt: 1,
    })
    expect(info.dataBytes).toBe(pcm[t.kind].length * 2)
    expect(t.sampleRate).toBe(16000)
    expect(t.gaps).toEqual([])
  }
  expect(run.gaps).toEqual([])

  // 2. The live frame stream is bit-identical to the WAV and contiguous on the timeline.
  for (const kind of ['mic', 'system'] as const) {
    const frames = run.frames[kind]
    let pos = 0
    for (const f of frames) {
      expect(f.startSample).toBe(pos)
      pos += f.samples.length
    }
    expect(pos).toBe(pcm[kind].length)
    const joined = new Int16Array(pos)
    let o = 0
    for (const f of frames) {
      joined.set(f.samples, o)
      o += f.samples.length
    }
    expect(Buffer.from(joined.buffer).equals(Buffer.from(pcm[kind].buffer))).toBe(true)
  }

  // 3. Track separation: each track holds its own tone and not the other's.
  const micSep = separationDb(pcm.mic, MIC_FIXTURE.freq, SYSTEM_FIXTURE.freq)
  const sysSep = separationDb(pcm.system, SYSTEM_FIXTURE.freq, MIC_FIXTURE.freq)
  expect(micSep).toBeGreaterThan(40)
  expect(sysSep).toBeGreaterThan(40)

  // 4. Every burst is present with the right length and spacing (no dropped or duplicated samples).
  const micB = detectBursts(pcm.mic, MIC_FIXTURE.freq)
  const sysB = detectBursts(pcm.system, SYSTEM_FIXTURE.freq)
  expect(micB).toHaveLength(2)
  expect(sysB).toHaveLength(2)
  // Durations are compared with the same detector run on the pristine fixture, so detector bias (ramps,
  // half-amplitude threshold) cancels and what remains is what the capture path did to the audio.
  const refLen = (f: ToneFixture) => detectBursts(synthesize(f), f.freq).map((b) => b.endMs - b.startMs)
  const ref = [...refLen(MIC_FIXTURE), ...refLen(SYSTEM_FIXTURE)]
  const lens = [...micB, ...sysB].map((b) => b.endMs - b.startMs)
  for (let i = 0; i < lens.length; i++)
    expect(Math.abs(lens[i]! - ref[i]!)).toBeLessThanOrEqual(tol.durationMs)
  const micInterval = micB[1]!.startMs - micB[0]!.startMs
  const sysInterval = sysB[1]!.startMs - sysB[0]!.startMs
  expect(Math.abs(micInterval - 2500)).toBeLessThanOrEqual(tol.intervalMs)
  expect(Math.abs(sysInterval - 2000)).toBeLessThanOrEqual(tol.intervalMs)

  // 5. Alignment across tracks: system burst 1 starts 1000 ms after mic burst 1, as in the fixtures.
  const skew = sysB[0]!.startMs - micB[0]!.startMs - 1000
  expect(Math.abs(skew)).toBeLessThanOrEqual(tol.alignMs)

  // 6. Duration: both WAVs cover the session timeline.
  const lenMs = (k: TrackKind) => (pcm[k].length / 16000) * 1000
  expect(Math.abs(lenMs('mic') - result.durationMs)).toBeLessThanOrEqual(tol.lengthMs)
  expect(Math.abs(lenMs('system') - result.durationMs)).toBeLessThanOrEqual(tol.lengthMs)
  if (run.level === 'file') expect(result.durationMs).toBe(MIC_FIXTURE.totalMs)

  // 7. Levels: one per 100 ms, plausible inside bursts (sine at 0.5 → rms 0.354, peak 0.5), ~0 in silence.
  for (const [kind, bursts] of [
    ['mic', micB],
    ['system', sysB],
  ] as const) {
    const lv = run.levels[kind]
    expect(lv.length).toBe(Math.floor(pcm[kind].length / 1600))
    expect(lv.map((l) => l.elapsedMs)).toEqual(lv.map((_, i) => (i + 1) * 100))
    const inside = lv.filter((l) =>
      bursts.some((b) => l.elapsedMs - 100 >= b.startMs + 20 && l.elapsedMs <= b.endMs - 20),
    )
    const outside = lv.filter((l) =>
      bursts.every((b) => l.elapsedMs < b.startMs - 30 || l.elapsedMs - 100 > b.endMs + 30),
    )
    expect(inside.length).toBeGreaterThanOrEqual(14)
    expect(outside.length).toBeGreaterThanOrEqual(10)
    for (const l of inside) {
      expect(l.rms).toBeGreaterThan(0.33)
      expect(l.rms).toBeLessThan(0.38)
      expect(l.peak).toBeGreaterThan(0.47)
      expect(l.peak).toBeLessThan(0.53)
    }
    for (const l of outside) expect(l.rms).toBeLessThan(0.002)
  }
  return {
    micSepDb: micSep,
    sysSepDb: sysSep,
    skewMs: skew,
    micIntervalMs: micInterval,
    sysIntervalMs: sysInterval,
  }
}
