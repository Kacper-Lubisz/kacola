import { mkdtempSync, readFileSync, statSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decodeWav,
  encodeWav,
  encodeWavHeader,
  parseWavHeader,
  readWavInfo,
  recoverWav,
  WAV_HEADER_BYTES,
  WavParseError,
  wavToInt16,
} from '../src/index.ts'

const dir = mkdtempSync(join(tmpdir(), 'kacola-wav-'))

function ramp(n: number): Int16Array {
  const s = new Int16Array(n)
  for (let i = 0; i < n; i++) s[i] = ((i * 7919) % 65536) - 32768
  return s
}

describe('WAV header', () => {
  it('round-trips format and sizes', () => {
    const h = encodeWavHeader({ audioFormat: 1, channels: 1, sampleRate: 16000, bitsPerSample: 16 }, 3200)
    expect(h.length).toBe(WAV_HEADER_BYTES)
    const info = parseWavHeader(h)
    expect(info).toEqual({
      audioFormat: 1,
      channels: 1,
      sampleRate: 16000,
      bitsPerSample: 16,
      dataOffset: 44,
      dataBytes: 3200,
      riffSize: 3236,
      blockAlign: 2,
    })
    expect(h.readUInt32LE(28)).toBe(32000) // byte rate
  })

  it('walks extra chunks (LIST before data), as ffmpeg writes them', () => {
    const base = encodeWav(ramp(10), 16000)
    const list = Buffer.alloc(8 + 5 + 1) // odd-sized chunk + pad byte
    list.write('LIST', 0, 'ascii')
    list.writeUInt32LE(5, 4)
    const withList = Buffer.concat([base.subarray(0, 36), list, base.subarray(36)])
    withList.writeUInt32LE(withList.length - 8, 4)
    const info = parseWavHeader(withList)
    expect(info.dataOffset).toBe(44 + list.length)
    expect(wavToInt16(withList).samples).toEqual(ramp(10))
  })

  it('reads EXTENSIBLE fmt as its sub-format', () => {
    const b = encodeWav(ramp(4), 16000)
    b.writeUInt16LE(0xfffe, 20)
    // extensible needs a 40-byte fmt; build one by hand
    const fmt = Buffer.alloc(8 + 40)
    fmt.write('fmt ', 0, 'ascii')
    fmt.writeUInt32LE(40, 4)
    b.copy(fmt, 8, 20, 36)
    fmt.writeUInt16LE(22, 24)
    fmt.writeUInt16LE(16, 26)
    fmt.writeUInt16LE(1, 32) // sub-format GUID starts with the format code
    const file = Buffer.concat([b.subarray(0, 12), fmt, b.subarray(36)])
    expect(parseWavHeader(file).audioFormat).toBe(1)
  })

  it('rejects garbage with WavParseError', () => {
    expect(() => parseWavHeader(Buffer.from('hello'))).toThrow(WavParseError)
    expect(() => parseWavHeader(Buffer.from('RIFF\0\0\0\0AVI LIST'))).toThrow(WavParseError)
    const noData = encodeWav(ramp(2), 16000).subarray(0, 36)
    expect(() => parseWavHeader(noData)).toThrow(/no data chunk/)
  })

  it('decodes 16-bit stereo, 24-bit and float32 to mono float', () => {
    // stereo 16-bit: L = 16384, R = -16384 → mono 0; L = R = 8192 → 0.25
    const st = encodeWavHeader({ audioFormat: 1, channels: 2, sampleRate: 8000, bitsPerSample: 16 }, 8)
    const d = Buffer.alloc(8)
    d.writeInt16LE(16384, 0)
    d.writeInt16LE(-16384, 2)
    d.writeInt16LE(8192, 4)
    d.writeInt16LE(8192, 6)
    const s = decodeWav(Buffer.concat([st, d]))
    expect(s.sampleRate).toBe(8000)
    expect(Array.from(s.samples)).toEqual([0, 0.25])
    const f = encodeWavHeader({ audioFormat: 3, channels: 1, sampleRate: 16000, bitsPerSample: 32 }, 8)
    const fd = Buffer.alloc(8)
    fd.writeFloatLE(0.5, 0)
    fd.writeFloatLE(-0.25, 4)
    expect(Array.from(decodeWav(Buffer.concat([f, fd])).samples)).toEqual([0.5, -0.25])
    const p24 = encodeWavHeader({ audioFormat: 1, channels: 1, sampleRate: 16000, bitsPerSample: 24 }, 3)
    const d24 = Buffer.alloc(3)
    d24.writeIntLE(-4194304, 0, 3)
    expect(Array.from(decodeWav(Buffer.concat([p24, d24])).samples)).toEqual([-0.5])
  })
})

describe('recoverWav', () => {
  it('is a no-op on a healthy file', () => {
    const p = join(dir, 'healthy.wav')
    writeFileSync(p, encodeWav(ramp(1000), 16000))
    const r = recoverWav(p)
    expect(r).toMatchObject({ status: 'ok', dataBytes: 2000, durationMs: 63, truncatedBytes: 0 })
  })

  it('repairs a header that was never finalised (sizes 0) and keeps every sample', () => {
    const p = join(dir, 'stale.wav')
    const good = encodeWav(ramp(16000), 16000)
    const stale = Buffer.from(good)
    stale.writeUInt32LE(36, 4)
    stale.writeUInt32LE(0, 40)
    writeFileSync(p, stale)
    const r = recoverWav(p)
    expect(r).toMatchObject({ status: 'repaired', dataBytes: 32000, durationMs: 1000, headerDataBytes: 0 })
    expect(readFileSync(p).equals(good)).toBe(true)
    expect(recoverWav(p).status).toBe('ok') // idempotent
  })

  it('repairs a header that claims more than the file holds', () => {
    const p = join(dir, 'over.wav')
    const b = encodeWav(ramp(100), 16000)
    b.writeUInt32LE(0xffffffff, 40)
    writeFileSync(p, b)
    expect(recoverWav(p)).toMatchObject({ status: 'repaired', dataBytes: 200 })
    expect(readWavInfo(p).dataBytes).toBe(200)
  })

  // Fuzz: cut a stale-header file at every byte offset (the crash can land anywhere) and check the repair
  // is exact — header describes the whole, sample-aligned file and the samples are an untouched prefix.
  it('recovers a file truncated at any byte, with any stale header value', () => {
    const samples = ramp(301)
    const full = encodeWav(samples, 16000)
    const p = join(dir, 'fuzz.wav')
    const staleValues = [0, 17, 602, 0xffffffff]
    let checked = 0
    for (let cut = 0; cut <= full.length; cut++) {
      for (const stale of staleValues) {
        const b = Buffer.from(full.subarray(0, cut))
        if (cut >= 44) b.writeUInt32LE(stale, 40)
        writeFileSync(p, b)
        const r = recoverWav(p)
        if (cut < 44) {
          expect(r.status).toBe('unrecoverable')
          continue
        }
        const expectBytes = (cut - 44) & ~1
        if (r.status === 'unrecoverable') throw new Error(`cut ${cut} unrecoverable`)
        expect(r.dataBytes).toBe(expectBytes)
        expect(r.truncatedBytes).toBe((cut - 44) & 1)
        expect(statSync(p).size).toBe(44 + expectBytes)
        const back = wavToInt16(readFileSync(p)).samples
        expect(back).toEqual(samples.subarray(0, expectBytes / 2))
        expect(readWavInfo(p).riffSize).toBe(36 + expectBytes)
        checked++
      }
    }
    expect(checked).toBe((full.length - 44 + 1) * staleValues.length)
  })

  it('reports an unrecoverable file instead of guessing', () => {
    const p = join(dir, 'junk.wav')
    writeFileSync(p, Buffer.from('not audio at all, just text'))
    expect(recoverWav(p)).toEqual({ status: 'unrecoverable', reason: 'not a RIFF/WAVE file' })
    writeFileSync(p, Buffer.alloc(0))
    expect(recoverWav(p).status).toBe('unrecoverable')
  })

  it('handles a file cut inside a trailing sample of a larger recording', () => {
    const p = join(dir, 'odd.wav')
    writeFileSync(p, encodeWav(ramp(48000), 16000))
    truncateSync(p, 44 + 12345)
    const r = recoverWav(p)
    expect(r).toMatchObject({ status: 'repaired', dataBytes: 12344, truncatedBytes: 1 })
  })
})
