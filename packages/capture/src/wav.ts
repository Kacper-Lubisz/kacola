import { closeSync, fstatSync, ftruncateSync, openSync, readSync, writeSync } from 'node:fs'

// WAV (RIFF, PCM) header maths, plus crash-safe repair.
//
// Every WAV this package writes has the canonical 44-byte layout: RIFF header, a 16-byte `fmt ` chunk,
// then one `data` chunk that runs to the end of the file. While recording, the size fields describe the
// audio as of the last flush (see WavWriter); after a crash `recoverWav` rewrites them from the actual
// file length. The reader is more lenient than the writer: it walks chunks, so it also reads files with
// extra chunks (LIST, fact, …) such as those ffmpeg produces.

export const WAV_HEADER_BYTES = 44
export const WAVE_FORMAT_PCM = 1
export const WAVE_FORMAT_IEEE_FLOAT = 3
const WAVE_FORMAT_EXTENSIBLE = 0xfffe

export type WavFormat = {
  /** 1 = integer PCM, 3 = IEEE float. EXTENSIBLE files report their sub-format here. */
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
}

export type WavInfo = WavFormat & {
  /** Byte offset of the first audio byte. */
  dataOffset: number
  /** Audio byte count according to the header (may be stale on an unfinalised file). */
  dataBytes: number
  /** RIFF size field according to the header. */
  riffSize: number
  blockAlign: number
}

export function encodeWavHeader(fmt: WavFormat, dataBytes: number): Buffer {
  const blockAlign = (fmt.channels * fmt.bitsPerSample) / 8
  const b = Buffer.alloc(WAV_HEADER_BYTES)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(Math.min(0xffffffff, 36 + dataBytes), 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(fmt.audioFormat, 20)
  b.writeUInt16LE(fmt.channels, 22)
  b.writeUInt32LE(fmt.sampleRate, 24)
  b.writeUInt32LE(fmt.sampleRate * blockAlign, 28)
  b.writeUInt16LE(blockAlign, 32)
  b.writeUInt16LE(fmt.bitsPerSample, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(Math.min(0xffffffff, dataBytes), 40)
  return b
}

export class WavParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WavParseError'
  }
}

/**
 * Parse a WAV header from the start of a file. `buf` must contain at least the bytes up to and including
 * the `data` chunk header. Throws WavParseError when it does not.
 */
export function parseWavHeader(buf: Buffer): WavInfo {
  if (buf.length < 12) throw new WavParseError('file shorter than a RIFF header')
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    throw new WavParseError('not a RIFF/WAVE file')
  const riffSize = buf.readUInt32LE(4)
  let off = 12
  let fmt: WavFormat | null = null
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      if (body + 16 > buf.length) throw new WavParseError('truncated fmt chunk')
      let audioFormat = buf.readUInt16LE(body)
      const channels = buf.readUInt16LE(body + 2)
      const sampleRate = buf.readUInt32LE(body + 4)
      const bitsPerSample = buf.readUInt16LE(body + 14)
      if (audioFormat === WAVE_FORMAT_EXTENSIBLE) {
        if (body + 26 > buf.length) throw new WavParseError('truncated extensible fmt chunk')
        audioFormat = buf.readUInt16LE(body + 24)
      }
      if (!channels || !sampleRate || !bitsPerSample || bitsPerSample % 8)
        throw new WavParseError(`implausible fmt: ${channels}ch ${sampleRate}Hz ${bitsPerSample}bit`)
      fmt = { audioFormat, channels, sampleRate, bitsPerSample }
    } else if (id === 'data') {
      if (!fmt) throw new WavParseError('data chunk before fmt chunk')
      return {
        ...fmt,
        dataOffset: body,
        dataBytes: size,
        riffSize,
        blockAlign: (fmt.channels * fmt.bitsPerSample) / 8,
      }
    }
    off = body + size + (size & 1)
  }
  throw new WavParseError(fmt ? 'no data chunk' : 'no fmt chunk')
}

/** Read the header of a WAV on disk (reads the first 64 KiB, enough for any sane chunk preamble). */
export function readWavInfo(path: string): WavInfo {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(65536)
    const n = readSync(fd, buf, 0, buf.length, 0)
    return parseWavHeader(buf.subarray(0, n))
  } finally {
    closeSync(fd)
  }
}

export type RecoverResult =
  | {
      status: 'ok' | 'repaired'
      format: WavFormat
      /** Audio bytes now described by the header (whole sample frames only). */
      dataBytes: number
      durationMs: number
      /** Bytes of a trailing partial sample frame that were cut off. */
      truncatedBytes: number
      /** What the header claimed before repair. */
      headerDataBytes: number
    }
  | { status: 'unrecoverable'; reason: string }

/**
 * Repair a WAV whose header was never finalised (the writer was SIGKILLed, the disk filled, the machine
 * lost power after the page cache was written back). Everything on disk after the header is audio: the
 * size fields are rewritten to match the file, and a trailing partial sample frame is truncated.
 *
 * Idempotent, and a no-op (`status: 'ok'`) on a healthy file. Files whose header itself is incomplete
 * are reported as `unrecoverable` rather than guessed at — the format is unknown, so the bytes cannot be
 * interpreted honestly.
 */
export function recoverWav(path: string): RecoverResult {
  const fd = openSync(path, 'r+')
  try {
    const size = fstatSync(fd).size
    const head = Buffer.alloc(Math.min(size, 65536))
    readSync(fd, head, 0, head.length, 0)
    let info: WavInfo
    try {
      info = parseWavHeader(head)
    } catch (e) {
      return { status: 'unrecoverable', reason: (e as Error).message }
    }
    const available = Math.max(0, size - info.dataOffset)
    const aligned = available - (available % info.blockAlign)
    const dataBytes = Math.min(aligned, 0xffffffff - info.dataOffset)
    const truncatedBytes = size - (info.dataOffset + dataBytes)
    const format: WavFormat = {
      audioFormat: info.audioFormat,
      channels: info.channels,
      sampleRate: info.sampleRate,
      bitsPerSample: info.bitsPerSample,
    }
    const riffSize = info.dataOffset - 8 + dataBytes
    const durationMs = Math.round((dataBytes / info.blockAlign / info.sampleRate) * 1000)
    if (info.dataBytes === dataBytes && info.riffSize === riffSize && truncatedBytes === 0)
      return { status: 'ok', format, dataBytes, durationMs, truncatedBytes, headerDataBytes: info.dataBytes }
    if (truncatedBytes) ftruncateSync(fd, info.dataOffset + dataBytes)
    const u32 = Buffer.alloc(4)
    u32.writeUInt32LE(riffSize, 0)
    writeSync(fd, u32, 0, 4, 4)
    u32.writeUInt32LE(dataBytes, 0)
    writeSync(fd, u32, 0, 4, info.dataOffset - 4)
    return {
      status: 'repaired',
      format,
      dataBytes,
      durationMs,
      truncatedBytes,
      headerDataBytes: info.dataBytes,
    }
  } finally {
    closeSync(fd)
  }
}

/** Decode a whole WAV into mono Float32 samples in [-1, 1] at its native rate. PCM 8/16/24/32 and float32/64. */
export function decodeWav(buf: Buffer): { sampleRate: number; samples: Float32Array; channels: number } {
  const info = parseWavHeader(buf)
  const end = Math.min(buf.length, info.dataOffset + info.dataBytes)
  const frames = Math.floor((end - info.dataOffset) / info.blockAlign)
  const out = new Float32Array(frames)
  const bps = info.bitsPerSample / 8
  const read = sampleReader(info, buf)
  for (let f = 0; f < frames; f++) {
    let acc = 0
    const base = info.dataOffset + f * info.blockAlign
    for (let c = 0; c < info.channels; c++) acc += read(base + c * bps)
    out[f] = acc / info.channels
  }
  return { sampleRate: info.sampleRate, samples: out, channels: info.channels }
}

function sampleReader(info: WavInfo, buf: Buffer): (off: number) => number {
  if (info.audioFormat === WAVE_FORMAT_IEEE_FLOAT) {
    if (info.bitsPerSample === 32) return (o) => buf.readFloatLE(o)
    if (info.bitsPerSample === 64) return (o) => buf.readDoubleLE(o)
  } else if (info.audioFormat === WAVE_FORMAT_PCM) {
    switch (info.bitsPerSample) {
      case 8:
        return (o) => (buf.readUInt8(o) - 128) / 128
      case 16:
        return (o) => buf.readInt16LE(o) / 32768
      case 24:
        return (o) => buf.readIntLE(o, 3) / 8388608
      case 32:
        return (o) => buf.readInt32LE(o) / 2147483648
    }
  }
  throw new WavParseError(`unsupported sample format ${info.audioFormat}/${info.bitsPerSample}bit`)
}

/** Encode Int16 mono PCM as a complete in-memory WAV. */
export function encodeWav(samples: Int16Array, sampleRate: number): Buffer {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  const header = encodeWavHeader(
    { audioFormat: WAVE_FORMAT_PCM, channels: 1, sampleRate, bitsPerSample: 16 },
    data.length,
  )
  return Buffer.concat([header, data])
}

/** View the audio of a 16-bit mono WAV buffer as Int16 samples (copying, so alignment is never an issue). */
export function wavToInt16(buf: Buffer): { sampleRate: number; samples: Int16Array } {
  const info = parseWavHeader(buf)
  if (info.audioFormat !== WAVE_FORMAT_PCM || info.bitsPerSample !== 16 || info.channels !== 1)
    throw new WavParseError(
      `expected 16-bit mono PCM, got fmt ${info.audioFormat} ${info.bitsPerSample}bit ${info.channels}ch`,
    )
  const end = Math.min(buf.length, info.dataOffset + info.dataBytes)
  const n = Math.floor((end - info.dataOffset) / 2)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(info.dataOffset + i * 2)
  return { sampleRate: info.sampleRate, samples: out }
}
