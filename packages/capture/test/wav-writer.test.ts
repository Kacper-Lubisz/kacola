import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type FileOps,
  nodeFileOps,
  readWavInfo,
  recoverWav,
  WavWriteError,
  WavWriter,
  wavToInt16,
} from '../src/index.ts'

const dir = mkdtempSync(join(tmpdir(), 'gnomeola-writer-'))

function tone(n: number, offset = 0): Int16Array {
  const s = new Int16Array(n)
  for (let i = 0; i < n; i++) s[i] = Math.round(10000 * Math.sin((i + offset) / 7))
  return s
}

/** Real fs ops, but writes start failing with ENOSPC once `capacity` bytes are on "disk". */
function fullDiskOps(capacity: number, opts: { partial?: boolean } = {}): FileOps & { syncs: number } {
  let used = 0
  const ops = {
    ...nodeFileOps,
    syncs: 0,
    pwrite(fd: number, buf: Uint8Array, off: number, len: number, pos: number): number {
      // overwriting existing bytes (the header) never needs space
      const growth = Math.max(0, pos + len - used)
      if (growth > 0 && used + growth > capacity) {
        const room = capacity - used
        if (opts.partial && room > 0 && pos === used) {
          const n = nodeFileOps.pwrite(fd, buf, off, room, pos)
          used += n
          return n
        }
        throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' })
      }
      const n = nodeFileOps.pwrite(fd, buf, off, len, pos)
      used = Math.max(used, pos + n)
      return n
    },
    datasync(fd: number) {
      ops.syncs++
      nodeFileOps.datasync(fd)
    },
  }
  return ops
}

describe('WavWriter', () => {
  it('writes a valid WAV whose header is exact after close', () => {
    const p = join(dir, 'basic.wav')
    const w = new WavWriter(p, { sampleRate: 16000 })
    const a = tone(1600)
    const b = tone(800, 1600)
    w.write(a)
    w.write(b)
    expect(w.close()).toEqual({ dataBytes: 4800, durationMs: 150 })
    const info = readWavInfo(p)
    expect(info.dataBytes).toBe(4800)
    const back = wavToInt16(readFileSync(p)).samples
    expect(back).toEqual(tone(2400))
    expect(recoverWav(p).status).toBe('ok')
  })

  it('rewrites the header and syncs on the flush cadence, not on every write', () => {
    const p = join(dir, 'cadence.wav')
    let now = 0
    const ops = fullDiskOps(Number.POSITIVE_INFINITY)
    const w = new WavWriter(p, { sampleRate: 16000, flushIntervalMs: 1000, now: () => now, ops })
    const syncsAtOpen = ops.syncs
    for (let i = 0; i < 9; i++) {
      now += 100
      w.write(tone(1600))
    }
    // 900 ms in: data is on disk, the header still says 0 (last flush was at open)
    expect(statSync(p).size).toBe(44 + 9 * 3200)
    expect(readWavInfo(p).dataBytes).toBe(0)
    expect(ops.syncs).toBe(syncsAtOpen)
    now += 100
    w.write(tone(1600))
    expect(readWavInfo(p).dataBytes).toBe(10 * 3200)
    expect(w.flushedBytes).toBe(10 * 3200)
    expect(ops.syncs).toBe(syncsAtOpen + 1)
    w.close()
  })

  it('an abandoned writer (process killed) leaves a file recoverWav restores completely', () => {
    const p = join(dir, 'abandoned.wav')
    let now = 0
    const w = new WavWriter(p, { sampleRate: 16000, flushIntervalMs: 1000, now: () => now })
    for (let i = 0; i < 25; i++) {
      now += 100
      w.write(tone(1600, i * 1600))
    }
    // no close(): simulate SIGKILL. Header describes 2 s (last flush), file holds 2.5 s.
    expect(readWavInfo(p).dataBytes).toBe(20 * 3200)
    const r = recoverWav(p)
    expect(r).toMatchObject({ status: 'repaired', dataBytes: 25 * 3200, headerDataBytes: 20 * 3200 })
    expect(wavToInt16(readFileSync(p)).samples).toEqual(tone(25 * 1600))
  })

  for (const partial of [false, true]) {
    it(`on ENOSPC (${partial ? 'partial write first' : 'clean refusal'}) throws, keeps whole samples and finalises the header`, () => {
      const p = join(dir, `enospc-${partial}.wav`)
      // capacity chosen so the failing write lands mid-sample when partial
      const ops = fullDiskOps(44 + 3 * 3200 + 1001, { partial })
      const w = new WavWriter(p, { sampleRate: 16000, ops })
      w.write(tone(1600))
      w.write(tone(1600, 1600))
      w.write(tone(1600, 3200))
      let err: unknown
      try {
        w.write(tone(1600, 4800))
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(WavWriteError)
      expect((err as WavWriteError).code).toBe('ENOSPC')
      expect(w.failed?.code).toBe('ENOSPC')
      // further writes keep failing with the same error; close is safe
      expect(() => w.write(tone(10))).toThrow(WavWriteError)
      w.close()
      const kept = partial ? 3 * 3200 + 1000 : 3 * 3200
      const info = readWavInfo(p)
      expect(info.dataBytes).toBe(kept)
      expect(statSync(p).size).toBe(44 + kept)
      expect(recoverWav(p).status).toBe('ok')
      expect(wavToInt16(readFileSync(p)).samples).toEqual(tone(kept / 2))
    })
  }

  it('fails at open if even the header cannot be written', () => {
    const p = join(dir, 'nohdr.wav')
    expect(() => new WavWriter(p, { sampleRate: 16000, ops: fullDiskOps(10) })).toThrow(WavWriteError)
  })
})
