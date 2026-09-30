import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TrackKind } from '@gnomeola/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type CaptureErrorEvent,
  ExternalCaptureHub,
  ExternalCaptureSource,
  type GapEvent,
  type LevelEvent,
  readWavInfo,
  wavToInt16,
} from '../src/index.ts'
import { tempDir } from './scenario.ts'

// The external source's placement rules on a virtual clock: every sample of the WAV is accounted for as
// either the client's audio (bit-exact) or a reported gap, whatever the client does — reconnect, resend,
// drop, freeze, race ahead, pause.

const MS = 16 // samples per ms
let clock = 0
const tick = (ms: number) => {
  clock += ms
  vi.advanceTimersByTime(ms)
}

/** A client's audio: a recognisable ramp, so placement errors show up as wrong sample values. */
const ramp = (from: number, n: number) =>
  Int16Array.from({ length: n }, (_, i) => ((from + i) % 20_000) - 10_000)

function observe(src: ExternalCaptureSource) {
  const gaps: GapEvent[] = []
  const errors: CaptureErrorEvent[] = []
  const levels: LevelEvent[] = []
  src.on('gap', (g) => gaps.push(g))
  src.on('error', (e) => errors.push(e))
  src.on('level', (l) => levels.push(l))
  return { gaps, errors, levels }
}

async function started(kinds: TrackKind[] = ['mic', 'system']) {
  const dir = join(tempDir('external'), 's')
  const src = new ExternalCaptureSource({ now: () => clock, flushIntervalMs: 50 })
  const obs = observe(src)
  await src.start(
    dir,
    kinds.map((kind) => ({ kind })),
  )
  return { src, dir, ...obs }
}

const wav = (dir: string, kind: TrackKind) => wavToInt16(readFileSync(join(dir, `${kind}.wav`))).samples

beforeEach(() => {
  clock = 1_000_000
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('ExternalCaptureSource', () => {
  it('records a real-time client bit-exactly, with levels, and pads nothing but end latency', async () => {
    const { src, dir, gaps, levels } = await started(['mic'])
    const c = src.attach('mic')
    // the first frame arrives 20 ms after start (capture latency): under the jitter threshold
    for (let i = 0; i < 50; i++) {
      tick(20)
      expect(c.push({ epoch: 1, sample: i * 320, samples: ramp(i * 320, 320) })).toEqual({
        written: 320,
        discarded: 0,
      })
    }
    const r = await src.stop()
    expect(gaps).toEqual([])
    expect(r.durationMs).toBe(1000)
    const pcm = wav(dir, 'mic')
    expect(pcm.length).toBe(1000 * MS)
    expect([...pcm.subarray(0, 16_000)]).toEqual([...ramp(0, 16_000)])
    expect(levels.length).toBe(10) // 100 ms windows
    expect(r.tracks[0]).toMatchObject({
      kind: 'mic',
      device: 'external:default',
      sampleRate: 16_000,
      gaps: [],
    })
    expect(await c.ended).toBe('stopped')
  })

  it('reconnects losslessly: a resend from an earlier sample is trimmed, not duplicated', async () => {
    const { src, dir, gaps } = await started(['mic'])
    let c = src.attach('mic')
    for (let i = 0; i < 10; i++) {
      tick(20)
      c.push({ epoch: 9, sample: i * 320, samples: ramp(i * 320, 320) })
    }
    c.detach()
    tick(60) // the client notices, reconnects, and resends its last 100 ms plus what it buffered
    c = src.attach('mic')
    const r1 = c.push({ epoch: 9, sample: 1600, samples: ramp(1600, 1600 + 3 * 320) })
    expect(r1).toEqual({ written: 3 * 320, discarded: 1600 })
    for (let i = 13; i < 25; i++) {
      tick(20)
      c.push({ epoch: 9, sample: i * 320, samples: ramp(i * 320, 320) })
    }
    // a newer stream supersedes the old one
    const c2 = src.attach('mic')
    expect(await c.ended).toBe('superseded')
    expect(c.push({ epoch: 9, sample: 25 * 320, samples: ramp(25 * 320, 320) }).written).toBe(0)
    c2.push({ epoch: 9, sample: 25 * 320, samples: ramp(25 * 320, 320) })
    await src.stop()
    expect(gaps).toEqual([])
    expect([...wav(dir, 'mic').subarray(0, 26 * 320)]).toEqual([...ramp(0, 26 * 320)])
  })

  it('a sample jump is a client-drop gap; a disconnect without resend is a disconnected gap of the right size', async () => {
    const { src, dir, gaps } = await started(['mic'])
    let c = src.attach('mic')
    tick(20)
    c.push({ epoch: 1, sample: 0, samples: ramp(0, 320) })
    tick(40)
    // the client's worklet skipped 320 samples (20 ms)
    c.push({ epoch: 1, sample: 640, samples: ramp(640, 320) })
    expect(gaps).toEqual([{ track: 'mic', atMs: 20, durationMs: 20, reason: 'client-drop' }])
    c.detach()
    tick(500) // offline for 0.5 s; it kept counting but has nothing to resend
    c = src.attach('mic')
    // its next frame ends now: [540 ms, 560 ms) of the session
    c.push({ epoch: 1, sample: 960 + 480 * MS, samples: ramp(0, 320) })
    expect(gaps[1]).toEqual({ track: 'mic', atMs: 60, durationMs: 480, reason: 'disconnected' })
    await src.stop()
    const pcm = wav(dir, 'mic')
    expect(pcm.length).toBe(Math.round((clock - 1_000_000) * MS))
    expect([...pcm.subarray(320, 640)].every((x) => x === 0)).toBe(true)
  })

  it('a new epoch is anchored to the wall clock; the outage before it is padded with its reason', async () => {
    const { src, gaps, errors } = await started(['system'])
    const c = src.attach('system')
    tick(20)
    c.push({ epoch: 1, sample: 0, samples: ramp(0, 320) })
    tick(3000) // silent attached stream → stall reported once
    expect(errors.filter((e) => e.code === 'stall')).toHaveLength(1)
    // the app restarted capture (new device): epoch 2 starting at 0, ending now
    c.push({ epoch: 2, sample: 0, samples: ramp(0, 320) })
    expect(gaps).toEqual([{ track: 'system', atMs: 20, durationMs: 2980, reason: 'stall' }])
    expect(src.status()).toEqual([{ kind: 'system', connected: true, positionMs: 3020, gaps: 1 }])
  })

  it('a frozen client (same epoch, not counting) is re-anchored; one racing ahead is dropped', async () => {
    const { src, gaps, errors } = await started(['mic'])
    const c = src.attach('mic')
    tick(20)
    c.push({ epoch: 1, sample: 0, samples: ramp(0, 320) })
    tick(8000) // frozen for 8 s, then continues as if nothing happened
    c.push({ epoch: 1, sample: 320, samples: ramp(320, 320) })
    expect(gaps.at(-1)).toMatchObject({ atMs: 20, reason: 'stall' })
    expect(src.status()[0]!.positionMs).toBe(8020)
    // 2 s of audio in one go, far ahead of real time
    const ahead = c.push({ epoch: 1, sample: 640 + 2000 * MS, samples: ramp(0, 320) })
    expect(ahead).toEqual({ written: 0, discarded: 320 })
    expect(errors.some((e) => e.code === 'client-ahead')).toBe(true)
  })

  it('pause discards audio and excludes paused time; resume re-anchors (latency threshold)', async () => {
    const { src, dir, gaps } = await started(['mic'])
    const c = src.attach('mic')
    for (let i = 0; i < 5; i++) {
      tick(20)
      c.push({ epoch: 1, sample: i * 320, samples: ramp(i * 320, 320) })
    }
    await src.pause()
    tick(5000)
    expect(c.push({ epoch: 1, sample: 1600, samples: ramp(1600, 320) }).discarded).toBe(320)
    await src.resume()
    tick(20)
    // the client keeps its epoch across the pause: its sample index includes paused time, yet the audio
    // lands right after the pre-pause audio
    c.push({ epoch: 1, sample: 1600 + 5000 * MS, samples: ramp(7, 320) })
    const r = await src.stop()
    expect(r.durationMs).toBe(120)
    expect(gaps).toEqual([])
    const pcm = wav(dir, 'mic')
    expect([...pcm.subarray(1600, 1920)]).toEqual([...ramp(7, 320)])
  })

  it('a track the app never streams: reported, and padded as disconnected at stop', async () => {
    const { src, errors } = await started(['mic', 'system'])
    const mic = src.attach('mic')
    for (let i = 0; i < 350; i++) {
      tick(20)
      mic.push({ epoch: 1, sample: i * 320, samples: ramp(i * 320, 320) })
    }
    expect(errors).toEqual([
      expect.objectContaining({ track: 'system', code: 'device-missing', fatal: false }),
    ])
    const r = await src.stop()
    expect(r.tracks.find((t) => t.kind === 'system')!.gaps).toEqual([
      { atMs: 0, durationMs: 7000, reason: 'disconnected' },
    ])
    expect(r.tracks.find((t) => t.kind === 'mic')!.gaps).toEqual([])
  })

  it('WAVs are crash-safe: the header is kept current while recording', async () => {
    const { src, dir } = await started(['mic'])
    const c = src.attach('mic')
    for (let i = 0; i < 20; i++) {
      tick(20)
      c.push({ epoch: 1, sample: i * 320, samples: ramp(i * 320, 320) })
    }
    tick(100)
    c.push({ epoch: 1, sample: 20 * 320, samples: ramp(20 * 320, 320) })
    const info = readWavInfo(join(dir, 'mic.wav'))
    expect(info.sampleRate).toBe(16_000)
    expect(info.dataBytes).toBeGreaterThanOrEqual(20 * 320 * 2)
    await src.stop()
  })

  it('refuses unknown tracks and attaching after stop; the hub forgets stopped recordings', async () => {
    const hub = new ExternalCaptureHub({ now: () => clock })
    const src = hub.create('ses_a')
    expect(hub.get('ses_a')).toBeNull() // not started yet
    await src.start(join(tempDir('hub'), 's'), [{ kind: 'mic' }])
    expect(hub.get('ses_a')).toBe(src)
    expect(hub.list().map((x) => x.sessionId)).toEqual(['ses_a'])
    expect(() => src.attach('system')).toThrow(/no system track/)
    await src.stop()
    expect(hub.get('ses_a')).toBeNull()
    expect(hub.list()).toEqual([])
    expect(() => src.attach('mic')).toThrow(/stopped/)
  })
})
