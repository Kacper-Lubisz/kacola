import type { ExternalCaptureStatus, IngestResult, PcmFrame } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { CaptureController, captureTracks, RESEND_SECONDS } from '../src/main/capture.ts'
import type { CaptureCommand } from '../src/shared/capture.ts'
import { FRAME_SAMPLES, Pcm16Framer } from '../src/shared/pcm-framer.ts'

// In-app capture (docs/desktop-app.md, "In-app capture"): the worklet's framer and main's controller.
// The real thing — Chromium's fake mic through the capture window into the daemon — is
// packages/e2e/test/desktop-capture.e2e.test.ts.

describe('Pcm16Framer', () => {
  it('at 16 kHz passes samples through as s16 in 40 ms frames', () => {
    const f = new Pcm16Framer(16_000)
    const q = new Float32Array(128).fill(0.5)
    const frames: Int16Array[] = []
    for (let i = 0; i < 10; i++) frames.push(...f.push(q))
    expect(frames).toHaveLength(2) // 1280 samples → two 640-sample frames
    expect(frames[0]!.length).toBe(FRAME_SAMPLES)
    expect(frames[0]![0]).toBe(Math.round(0.5 * 32767))
    expect(f.pending).toBe(0)
  })

  it('clips to the s16 range, asymmetric like the protocol’s floatToPcm16', () => {
    const f = new Pcm16Framer(16_000, 4)
    expect([...f.push(Float32Array.from([2, -2, 1, -1]))[0]!]).toEqual([32767, -32768, 32767, -32768])
  })

  it('resamples 48 kHz to 16 kHz: a third of the samples, the signal preserved', () => {
    const f = new Pcm16Framer(48_000, 160)
    const out: number[] = []
    // a 440 Hz sine over one second in 128-sample quanta
    for (let q = 0; q < 375; q++) {
      const buf = new Float32Array(128)
      for (let i = 0; i < 128; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * 440 * (q * 128 + i)) / 48_000)
      for (const fr of f.push(buf)) out.push(...fr)
    }
    expect(out.length + f.pending).toBe(16_000)
    for (let k = 0; k < out.length; k += 997) {
      const want = 0.5 * Math.sin((2 * Math.PI * 440 * k) / 16_000) * 32767
      expect(Math.abs(out[k]! - want)).toBeLessThan(200)
    }
  })

  it('resamples 44.1 kHz with the right count across quantum boundaries', () => {
    const f = new Pcm16Framer(44_100, 100)
    let n = 0
    for (let q = 0; q < 441 * 10; q++) n += f.push(new Float32Array(10)).length * 100
    expect(n + f.pending).toBe(16_000)
  })
})

const status = (captures: ExternalCaptureStatus['captures']): ExternalCaptureStatus => ({ captures })
const waiting = (id: string, tracks = ['mic', 'system']) =>
  status([
    {
      sessionId: id,
      state: 'recording',
      tracks: tracks.map((k) => ({ kind: k as 'mic', connected: false, positionMs: 0, gaps: 0 })),
    },
  ])

type Ingest = {
  sessionId: string
  track: string
  got: PcmFrame[]
  finish: (r: Partial<IngestResult>) => void
  fail: (e: Error) => void
}

function harness(tracks: ('mic' | 'system')[] = ['mic']) {
  let current = status([])
  const commands: CaptureCommand[] = []
  const ingests: Ingest[] = []
  let epoch = 100
  const c = new CaptureController({
    status: async () => current,
    tracks,
    window: () => ({ send: (cmd) => commands.push(cmd) }),
    newEpoch: () => epoch++,
    retryMs: () => 1,
    cooldownMs: 50,
    ingest: (o) =>
      new Promise<IngestResult>((resolve, reject) => {
        const rec: Ingest = {
          sessionId: o.sessionId,
          track: o.track,
          got: [],
          finish: (r) => resolve({ frames: 0, samples: 0, discarded: 0, ended: 'client', ...r }),
          fail: reject,
        }
        ingests.push(rec)
        void (async () => {
          for await (const f of o.frames) rec.got.push(f)
          resolve({ frames: rec.got.length, samples: 0, discarded: 0, ended: 'client' })
        })().catch(reject)
      }),
  })
  return {
    c,
    commands,
    ingests,
    set: (s: ExternalCaptureStatus) => {
      current = s
    },
  }
}

const tick = () => new Promise((r) => setTimeout(r, 5))
const samples = (n: number, v = 1) => new Int16Array(n).fill(v)

describe('CaptureController', () => {
  it('starts only the tracks the platform can capture, for the recording the daemon waits on', async () => {
    const h = harness(['mic'])
    h.set(waiting('s1'))
    await h.c.reconcile()
    expect(h.commands).toEqual([{ type: 'start', track: 'mic' }])
    expect(h.ingests.map((i) => [i.sessionId, i.track])).toEqual([['s1', 'mic']])
    // reconciling again changes nothing
    await h.c.reconcile()
    expect(h.commands).toHaveLength(1)
  })

  it('numbers frames by (epoch, sample) and streams them in order', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.c.onState({ track: 'mic', state: 'running', sampleRate: 16_000, label: 'fake' })
    h.c.onFrame('mic', samples(640))
    h.c.onFrame('mic', samples(640))
    await tick()
    expect(h.ingests[0]!.got.map((f) => [f.epoch, f.sample])).toEqual([
      [100, 0],
      [100, 640],
    ])
  })

  it('after an ingest failure, retries and resends the last seconds of the epoch (the daemon dedupes)', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    for (let i = 0; i < 3; i++) h.c.onFrame('mic', samples(640))
    await tick()
    h.ingests[0]!.fail(new Error('daemon restarting'))
    await tick()
    await tick()
    expect(h.ingests).toHaveLength(2)
    expect(h.ingests[1]!.got.map((f) => f.sample)).toEqual([0, 640, 1280])
    h.c.onFrame('mic', samples(640))
    await tick()
    expect(h.ingests[1]!.got.map((f) => f.sample)).toEqual([0, 640, 1280, 1920])
  })

  it('keeps only RESEND_SECONDS of audio for resending', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.ingests[0]!.fail(new Error('down'))
    // 20 s of frames while no request is open
    for (let i = 0; i < 500; i++) h.c.onFrame('mic', samples(640))
    await tick()
    await tick()
    const got = h.ingests.at(-1)!.got
    const span = (got.at(-1)!.sample + 640 - got[0]!.sample) / 16_000
    expect(span).toBeGreaterThanOrEqual(RESEND_SECONDS - 0.05)
    expect(span).toBeLessThanOrEqual(RESEND_SECONDS + 0.05)
  })

  it('a capture run that restarts is a new epoch starting at sample 0', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.c.onState({ track: 'mic', state: 'running', sampleRate: 16_000, label: 'a' })
    h.c.onFrame('mic', samples(640))
    h.c.onState({ track: 'mic', state: 'running', sampleRate: 16_000, label: 'b' })
    h.c.onFrame('mic', samples(640))
    await tick()
    expect(h.ingests[0]!.got.map((f) => [f.epoch, f.sample])).toEqual([
      [100, 0],
      [101, 0],
    ])
  })

  it('stops when the daemon ends the stream (recording stopped) or no longer lists the recording', async () => {
    const h = harness(['mic', 'system'])
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.ingests.find((i) => i.track === 'system')!.finish({ ended: 'stopped' })
    await tick()
    expect(h.commands).toContainEqual({ type: 'stop', track: 'system' })
    h.set(status([]))
    await h.c.reconcile()
    expect(h.commands).toContainEqual({ type: 'stop', track: 'mic' })
    expect(h.c.snapshot().sessionId).toBeNull()
  })

  it('a capture error ends that run; a later reconcile reopens it after the cooldown', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.c.onState({ track: 'mic', state: 'error', detail: 'NotAllowedError' })
    expect(h.commands.at(-1)).toEqual({ type: 'stop', track: 'mic' })
    await h.c.reconcile()
    expect(h.commands.filter((c) => c.type === 'start')).toHaveLength(1) // cooling down
    await new Promise((r) => setTimeout(r, 60))
    await h.c.reconcile()
    expect(h.commands.filter((c) => c.type === 'start')).toHaveLength(2)
  })

  it('a new recording replaces the old one', async () => {
    const h = harness()
    h.set(waiting('s1'))
    await h.c.reconcile()
    h.set(waiting('s2'))
    await h.c.reconcile()
    expect(h.ingests.map((i) => i.sessionId)).toEqual(['s1', 's2'])
    expect(h.c.snapshot().sessionId).toBe('s2')
  })
})

describe('captureTracks', () => {
  it('macOS captures mic + system (loopback); Linux Chromium the mic only; the env overrides', () => {
    expect(captureTracks('darwin', {})).toEqual(['mic', 'system'])
    expect(captureTracks('linux', {})).toEqual(['mic'])
    expect(captureTracks('linux', { KACOLA_CAPTURE_TRACKS: 'system,bogus' })).toEqual(['system'])
  })
})
