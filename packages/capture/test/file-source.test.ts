import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectBursts, encodeWav16, synthesize } from '@gnomeola/testkit/rig'
import { describe, expect, it } from 'vitest'
import {
  encodeWavHeader,
  FileCaptureSource,
  type FileOps,
  nodeFileOps,
  readWavInfo,
  recoverWav,
  wavToInt16,
} from '../src/index.ts'
import { observe, tempDir } from './scenario.ts'

const fixture = (
  dir: string,
  name: string,
  freq: number,
  totalMs: number,
  bursts = [{ atMs: 0, durationMs: totalMs }],
) => {
  const p = join(dir, name)
  writeFileSync(p, encodeWav16(synthesize({ freq, bursts, totalMs })))
  return p
}

describe('FileCaptureSource', () => {
  it('writes both tracks bit-identically, pads a shorter track with silence (not a gap)', async () => {
    const dir = tempDir('fs-basic')
    const mic = fixture(dir, 'mic.wav', 440, 1000)
    const sys = fixture(dir, 'sys.wav', 1250, 600)
    const src = new FileCaptureSource({ speed: Number.POSITIVE_INFINITY })
    const obs = observe(src)
    const states: string[] = []
    src.on('state', (s) => states.push(s))
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: mic },
      { kind: 'system', device: sys },
    ])
    const r = await src.done
    expect(states).toEqual(['recording', 'stopped'])
    expect(r.durationMs).toBe(1000)
    expect(r.tracks.map((t) => [t.kind, t.device, t.gaps])).toEqual([
      ['mic', `file:${mic}`, []],
      ['system', `file:${sys}`, []],
    ])
    const micOut = wavToInt16(readFileSync(r.tracks[0]!.audioPath!)).samples
    const sysOut = wavToInt16(readFileSync(r.tracks[1]!.audioPath!)).samples
    expect(micOut).toEqual(wavToInt16(readFileSync(mic)).samples)
    expect(sysOut.length).toBe(16000)
    expect(sysOut.subarray(0, 9600)).toEqual(wavToInt16(readFileSync(sys)).samples)
    expect(sysOut.subarray(9600).every((x) => x === 0)).toBe(true)
    expect(obs.gaps).toEqual([])
    expect(obs.frames.mic.every((f) => !f.synthetic)).toBe(true)
    expect(obs.levels.mic).toHaveLength(10)
  })

  it('resamples and downmixes a 48 kHz stereo input to 16 kHz mono', async () => {
    const dir = tempDir('fs-48k')
    const n = 48000
    const data = Buffer.alloc(n * 4)
    for (let i = 0; i < n; i++) {
      const v = Math.round(0.4 * 32767 * Math.sin((2 * Math.PI * 1000 * i) / 48000))
      data.writeInt16LE(v, i * 4)
      data.writeInt16LE(v, i * 4 + 2)
    }
    const p = join(dir, 'in48.wav')
    writeFileSync(
      p,
      Buffer.concat([
        encodeWavHeader({ audioFormat: 1, channels: 2, sampleRate: 48000, bitsPerSample: 16 }, data.length),
        data,
      ]),
    )
    const src = new FileCaptureSource({ speed: Number.POSITIVE_INFINITY })
    await src.start(join(dir, 's'), [{ kind: 'mic', device: p }])
    const r = await src.done
    const info = readWavInfo(r.tracks[0]!.audioPath!)
    expect([info.sampleRate, info.channels]).toEqual([16000, 1])
    expect(r.durationMs).toBe(1000)
    const out = wavToInt16(readFileSync(r.tracks[0]!.audioPath!)).samples
    expect(detectBursts(out, 1000, { amplitude: 0.4 })).toHaveLength(1)
  })

  it('plays at the requested speed: 2 s at 20× takes ~100 ms of wall time', async () => {
    const dir = tempDir('fs-speed')
    const mic = fixture(dir, 'mic.wav', 440, 2000)
    const src = new FileCaptureSource({ speed: 20 })
    const t0 = performance.now()
    await src.start(join(dir, 's'), [{ kind: 'mic', device: mic }])
    const r = await src.done
    const wall = performance.now() - t0
    expect(r.durationMs).toBe(2000)
    expect(wall).toBeGreaterThan(90)
    expect(wall).toBeLessThan(400)
  })

  it('injected faults become padded, reported gaps with the timeline intact', async () => {
    const dir = tempDir('fs-fault')
    const mic = fixture(dir, 'mic.wav', 440, 3000)
    const src = new FileCaptureSource({
      speed: Number.POSITIVE_INFINITY,
      chunkMs: 100,
      faults: [
        { track: 'mic', atMs: 1050, durationMs: 420 },
        { track: 'mic', atMs: 2800, durationMs: 500 }, // runs past the end: closed out at stop
      ],
    })
    const obs = observe(src)
    await src.start(join(dir, 's'), [{ kind: 'mic', device: mic }])
    const r = await src.done
    expect(r.tracks[0]!.gaps).toEqual([
      { atMs: 1050, durationMs: 420, reason: 'injected' },
      { atMs: 2800, durationMs: 200, reason: 'injected' },
    ])
    expect(obs.gaps.map((g) => g.track)).toEqual(['mic', 'mic'])
    const out = wavToInt16(readFileSync(r.tracks[0]!.audioPath!)).samples
    expect(out.length).toBe(48000)
    const orig = wavToInt16(readFileSync(mic)).samples
    expect(out.subarray(0, 16800)).toEqual(orig.subarray(0, 16800))
    expect(out.subarray(16800, 23520).every((x) => x === 0)).toBe(true)
    expect(out.subarray(23520, 44800)).toEqual(orig.subarray(23520, 44800))
    const synthetic = obs.frames.mic.filter((f) => f.synthetic)
    expect(synthetic.reduce((a, f) => a + f.samples.length, 0)).toBe(6720 + 3200)
    // real + padded = timeline
    let pos = 0
    for (const f of obs.frames.mic) {
      expect(f.startSample).toBe(pos)
      pos += f.samples.length
    }
    expect(pos).toBe(48000)
  })

  it('pause freezes the timeline; resume continues where it left off', async () => {
    const dir = tempDir('fs-pause')
    const mic = fixture(dir, 'mic.wav', 440, 1000)
    const src = new FileCaptureSource({ speed: 10 })
    await src.start(join(dir, 's'), [{ kind: 'mic', device: mic }])
    await new Promise((r) => setTimeout(r, 30))
    await src.pause()
    const at = src.elapsedMs()
    expect(src.state).toBe('paused')
    await new Promise((r) => setTimeout(r, 60))
    expect(src.elapsedMs()).toBe(at)
    await src.resume()
    const r = await src.done
    expect(r.durationMs).toBe(1000)
    expect(wavToInt16(readFileSync(r.tracks[0]!.audioPath!)).samples).toEqual(
      wavToInt16(readFileSync(mic)).samples,
    )
  })

  it("atEnd: 'continue' keeps emitting silence until stop()", async () => {
    const dir = tempDir('fs-continue')
    const mic = fixture(dir, 'mic.wav', 440, 200)
    const src = new FileCaptureSource({ speed: 20, atEnd: 'continue' })
    await src.start(join(dir, 's'), [{ kind: 'mic', device: mic }])
    await new Promise((r) => setTimeout(r, 60))
    const r = await src.stop()
    expect(r.durationMs).toBeGreaterThan(400)
    expect(await src.done).toBe(r)
    expect(await src.stop()).toBe(r) // idempotent
  })

  it('disk full mid-recording: fatal ENOSPC error, clean stop, readable WAVs', async () => {
    const dir = tempDir('fs-enospc')
    const mic = fixture(dir, 'mic.wav', 440, 3000)
    const sys = fixture(dir, 'sys.wav', 1250, 3000)
    let budget = 44 * 2 + 40_000 // header + ~1.25 s across both tracks
    const ops: FileOps = {
      ...nodeFileOps,
      pwrite(fd, buf, off, len, pos) {
        if (pos >= 44) {
          if (len > budget)
            throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
          budget -= len
        }
        return nodeFileOps.pwrite(fd, buf, off, len, pos)
      },
    }
    const src = new FileCaptureSource({ speed: Number.POSITIVE_INFINITY, fileOps: ops })
    const obs = observe(src)
    const states: string[] = []
    src.on('state', (s) => states.push(s))
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: mic },
      { kind: 'system', device: sys },
    ])
    const r = await src.done
    expect(r.error).toMatchObject({ code: 'ENOSPC', fatal: true })
    expect(obs.errors).toHaveLength(1)
    expect(states.at(-1)).toBe('failed')
    for (const t of r.tracks) {
      expect(recoverWav(t.audioPath!).status).toBe('ok') // header already finalised, nothing to repair
      const info = readWavInfo(t.audioPath!)
      expect(info.dataBytes).toBeGreaterThan(15_000)
      expect(info.dataBytes).toBeLessThan(25_000)
    }
  })

  it('rejects bad specs', async () => {
    const dir = tempDir('fs-bad')
    const mic = fixture(dir, 'mic.wav', 440, 100)
    await expect(new FileCaptureSource().start(join(dir, 's'), [])).rejects.toThrow()
    await expect(
      new FileCaptureSource().start(join(dir, 's'), [
        { kind: 'mic', device: mic },
        { kind: 'mic', device: mic },
      ]),
    ).rejects.toThrow(/one spec per track/)
    await expect(new FileCaptureSource().start(join(dir, 's'), [{ kind: 'mic' }])).rejects.toThrow(/WAV path/)
  })
})
