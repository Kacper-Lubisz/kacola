import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import {
  encodePcmFrame,
  floatToPcm16,
  ingestPcm,
  MAX_FRAME_BYTES,
  PCM_FRAME_CONTENT_TYPE,
  PCM_FRAME_HEADER_BYTES,
  type PcmFrame,
  PcmFrameDecoder,
  PcmFrameError,
} from '../src/capture.ts'

const frame = (epoch: number, sample: number, n: number, base = 0): PcmFrame => ({
  epoch,
  sample,
  samples: Int16Array.from({ length: n }, (_, i) => ((base + i) % 65536) - 32768),
})

describe('PCM frame codec', () => {
  it('round-trips header fields and payload, including u64 sample indices', () => {
    const f = frame(0xfffffffe, 2 ** 40 + 3, 320, 7)
    const bytes = encodePcmFrame(f)
    expect(bytes.length).toBe(PCM_FRAME_HEADER_BYTES + 640)
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('GPCM')
    const [out] = new PcmFrameDecoder().push(bytes)
    expect(out).toEqual(f)
  })

  it('reassembles frames split at every possible byte boundary', () => {
    const frames = [frame(1, 0, 160), frame(1, 160, 0), frame(1, 160, 321, 9), frame(2, 0, 16)]
    const wire = Uint8Array.from(frames.flatMap((f) => [...encodePcmFrame(f)]))
    for (const cut of [1, 3, 23, 24, 25, 100, 7]) {
      const d = new PcmFrameDecoder()
      const got: PcmFrame[] = []
      for (let i = 0; i < wire.length; i += cut) got.push(...d.push(wire.subarray(i, i + cut)))
      expect(got, `chunks of ${cut}`).toEqual(frames)
      expect(d.pending).toBe(0)
    }
  })

  it('rejects garbage, oversize and odd frames', () => {
    const good = encodePcmFrame(frame(1, 0, 4))
    const bad = good.slice()
    bad[0] = 0
    expect(() => new PcmFrameDecoder().push(bad)).toThrow(PcmFrameError)
    const version = good.slice()
    version[4] = 9
    expect(() => new PcmFrameDecoder().push(version)).toThrow(/version 9/)
    const odd = good.slice()
    new DataView(odd.buffer).setUint32(20, 7, true)
    expect(() => new PcmFrameDecoder().push(odd)).toThrow(/length 7/)
    const huge = good.slice()
    new DataView(huge.buffer).setUint32(20, MAX_FRAME_BYTES + 2, true)
    expect(() => new PcmFrameDecoder().push(huge)).toThrow(/length/)
    expect(() => encodePcmFrame(frame(1, 0, MAX_FRAME_BYTES))).toThrow(PcmFrameError)
    expect(() => encodePcmFrame(frame(-1, 0, 1))).toThrow(PcmFrameError)
    expect(() => encodePcmFrame(frame(1, -5, 1))).toThrow(PcmFrameError)
  })

  it('floatToPcm16 clamps and scales like Web Audio → s16', () => {
    expect([...floatToPcm16(Float32Array.from([0, 1, -1, 2, -2, 0.5]))]).toEqual([
      0, 32767, -32768, 32767, -32768, 16384,
    ])
  })
})

describe('ingestPcm', () => {
  it('streams frames in rotated requests and sums the daemon answers; stops when the daemon ends it', async () => {
    const requests: { type: string | undefined; frames: PcmFrame[] }[] = []
    let answerStopped = false
    const server = createServer(async (req, res) => {
      const d = new PcmFrameDecoder()
      const got: PcmFrame[] = []
      requests.push({ type: req.headers['content-type'], frames: got })
      for await (const chunk of req) {
        got.push(...d.push(new Uint8Array(chunk as Buffer)))
        if (answerStopped && got.length >= 2) break
      }
      res.setHeader('content-type', 'application/json')
      if (answerStopped) res.setHeader('connection', 'close')
      const samples = got.reduce((n, f) => n + f.samples.length, 0)
      res.end(
        JSON.stringify({
          frames: got.length,
          samples,
          discarded: 0,
          ended: answerStopped ? 'stopped' : 'client',
        }),
      )
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      async function* paced(n: number) {
        for (let i = 0; i < n; i++) {
          await new Promise((r) => setTimeout(r, 5))
          yield frame(7, i * 160, 160, i)
        }
      }
      const r = await ingestPcm({
        baseUrl,
        sessionId: 'ses_1',
        track: 'mic',
        frames: paced(30),
        rotateMs: 40,
      })
      expect(r).toEqual({ frames: 30, samples: 30 * 160, discarded: 0, ended: 'client' })
      expect(requests.length).toBeGreaterThan(1) // rotated
      expect(requests.every((q) => q.type === PCM_FRAME_CONTENT_TYPE)).toBe(true)
      // lossless and in order across the rotations
      expect(requests.flatMap((q) => q.frames.map((f) => f.sample))).toEqual(
        Array.from({ length: 30 }, (_, i) => i * 160),
      )

      requests.length = 0
      answerStopped = true
      async function* endless() {
        for (let i = 0; ; i++) {
          await new Promise((r) => setTimeout(r, 5))
          yield frame(8, i * 160, 160)
        }
      }
      const s = await ingestPcm({
        baseUrl,
        sessionId: 'ses_1',
        track: 'system',
        frames: endless(),
        rotateMs: 10_000,
      })
      expect(s.ended).toBe('stopped')
      expect(requests).toHaveLength(1)
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })

  it('surfaces the daemon error message', async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 404
      res.setHeader('content-type', 'application/json')
      res.setHeader('connection', 'close')
      res.end(
        JSON.stringify({
          error: { code: 'not_found', message: 'session x is not waiting for external audio' },
        }),
      )
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      async function* one() {
        yield frame(1, 0, 16)
      }
      await expect(ingestPcm({ baseUrl, sessionId: 'x', track: 'mic', frames: one() })).rejects.toThrow(
        /not waiting for external audio/,
      )
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })
})
