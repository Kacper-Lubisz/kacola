import { closeSync, fdatasyncSync, ftruncateSync, openSync, writeSync } from 'node:fs'
import { encodeWavHeader, WAV_HEADER_BYTES, WAVE_FORMAT_PCM } from './wav.ts'

// Crash-safe incremental WAV writer.
//
// Audio bytes are written with positional writes straight to the kernel as they arrive, so a SIGKILLed
// process loses nothing that reached `write()` — the page cache survives the process. Every
// `flushIntervalMs` the header's size fields are rewritten and the file is fdatasync'd, so after a power
// loss the file is intact up to the last flush, and after a process kill it is intact up to the last
// write (recoverWav() fixes the stale header in both cases).
//
// On a write error (ENOSPC, EIO, …) the writer truncates to the last whole sample, finalises the header —
// both of which need no new blocks — and becomes `failed`; the caller decides what to do next.

/** The file operations the writer needs; injectable so tests can simulate a full disk. */
export type FileOps = {
  open(path: string): number
  pwrite(fd: number, buf: Uint8Array, offset: number, length: number, position: number): number
  datasync(fd: number): void
  truncate(fd: number, length: number): void
  close(fd: number): void
}

export const nodeFileOps: FileOps = {
  open: (p) => openSync(p, 'w'),
  pwrite: (fd, buf, off, len, pos) => writeSync(fd, buf, off, len, pos),
  datasync: (fd) => fdatasyncSync(fd),
  truncate: (fd, len) => ftruncateSync(fd, len),
  close: (fd) => closeSync(fd),
}

export type WavWriterOptions = {
  sampleRate: number
  /** Header rewrite + fdatasync cadence. Default 1000 ms. */
  flushIntervalMs?: number
  ops?: FileOps
  /** Monotonic clock in ms (injectable for tests). */
  now?: () => number
}

export class WavWriteError extends Error {
  readonly code: string
  constructor(code: string, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'WavWriteError'
    this.code = code
  }
}

export class WavWriter {
  readonly path: string
  readonly sampleRate: number
  private readonly ops: FileOps
  private readonly now: () => number
  private readonly flushIntervalMs: number
  private fd: number | null
  private dataBytes = 0
  private lastFlush: number
  private failure: WavWriteError | null = null
  /** Data bytes described by the on-disk header as of the last flush. */
  flushedBytes = 0

  constructor(path: string, opts: WavWriterOptions) {
    this.path = path
    this.sampleRate = opts.sampleRate
    this.ops = opts.ops ?? nodeFileOps
    this.now = opts.now ?? (() => performance.now())
    this.flushIntervalMs = opts.flushIntervalMs ?? 1000
    this.fd = this.ops.open(path)
    this.lastFlush = this.now()
    const header = this.header()
    try {
      this.writeAll(header, 0)
      this.ops.datasync(this.fd)
    } catch (e) {
      this.ops.close(this.fd)
      this.fd = null
      throw toWriteError(e)
    }
  }

  get samplesWritten(): number {
    return this.dataBytes / 2
  }

  get failed(): WavWriteError | null {
    return this.failure
  }

  /** Append samples. Throws WavWriteError (and leaves a finalised, readable file) if the write fails. */
  write(samples: Int16Array): void {
    if (this.failure) throw this.failure
    if (this.fd === null) throw new WavWriteError('closed', `${this.path}: writer is closed`)
    if (!samples.length) return
    const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
    try {
      this.writeAll(bytes, WAV_HEADER_BYTES + this.dataBytes)
    } catch (e) {
      this.fail(toWriteError(e))
      throw this.failure
    }
    if (this.now() - this.lastFlush >= this.flushIntervalMs) this.flush()
  }

  /** Rewrite the header to describe everything written so far and fdatasync. */
  flush(): void {
    if (this.fd === null || this.failure) return
    try {
      this.writeAll(this.header(), 0)
      this.ops.datasync(this.fd)
      this.flushedBytes = this.dataBytes
      this.lastFlush = this.now()
    } catch (e) {
      this.fail(toWriteError(e))
      throw this.failure
    }
  }

  /** Finalise and close. Safe to call more than once and after a failure. */
  close(): { dataBytes: number; durationMs: number } {
    if (this.fd !== null) {
      if (!this.failure) {
        try {
          this.flush()
        } catch {
          // fail() already finalised what it could
        }
      }
      if (this.fd !== null) this.ops.close(this.fd)
      this.fd = null
    }
    return {
      dataBytes: this.dataBytes,
      durationMs: Math.round((this.samplesWritten / this.sampleRate) * 1000),
    }
  }

  private header(): Buffer {
    return encodeWavHeader(
      { audioFormat: WAVE_FORMAT_PCM, channels: 1, sampleRate: this.sampleRate, bitsPerSample: 16 },
      this.dataBytes,
    )
  }

  /** Write all of `buf` at `position`, tracking partial progress so a mid-write failure is accounted for. */
  private writeAll(buf: Uint8Array, position: number): void {
    let done = 0
    const isData = position >= WAV_HEADER_BYTES
    while (done < buf.length) {
      const n = this.ops.pwrite(this.fd!, buf, done, buf.length - done, position + done)
      if (n <= 0) throw Object.assign(new Error('short write'), { code: 'EIO' })
      done += n
      if (isData) this.dataBytes += n
    }
  }

  private fail(err: WavWriteError): void {
    this.failure = err
    if (this.fd === null) return
    // Keep only whole samples, then describe them. Neither step allocates new blocks.
    this.dataBytes -= this.dataBytes % 2
    try {
      this.ops.truncate(this.fd, WAV_HEADER_BYTES + this.dataBytes)
    } catch {
      // best effort — recoverWav() handles a trailing odd byte anyway
    }
    try {
      const h = this.header()
      let done = 0
      while (done < h.length) done += this.ops.pwrite(this.fd, h, done, h.length - done, done)
      this.flushedBytes = this.dataBytes
    } catch {
      // best effort — the header is from the last successful flush, recoverWav() fixes it
    }
    try {
      this.ops.close(this.fd)
    } catch {
      // ignore
    }
    this.fd = null
  }
}

function toWriteError(e: unknown): WavWriteError {
  if (e instanceof WavWriteError) return e
  const code = (e as NodeJS.ErrnoException)?.code ?? 'EIO'
  return new WavWriteError(code, `audio write failed: ${(e as Error)?.message ?? String(e)}`, e)
}
