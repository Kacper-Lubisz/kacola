import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WAV_HEADER_BYTES } from '@kacola/capture'
import {
  AUDIO_CHUNK_BYTES,
  chunkSeqFor,
  KacolaApiError,
  type KacolaClient,
  type Session,
  type TrackKind,
} from '@kacola/protocol'

// H-3 — chunked, idempotent, resumable audio upload (full-offload mode). Chunk k of a track is the k-th
// AUDIO_CHUNK_BYTES of that track's PCM — exactly the bytes of its local WAV after the header — so the
// chunking of a live recording and of a WAV re-read after a crash are identical, and the upload keyed by
// (sessionId, chunkSeq) can always be completed later: ask the server what arrived, send the rest.
//
// Every PUT is idempotent (same bytes → `stored: false`), retried with backoff on network errors and
// 5xx, and never retried on 4xx other than 409-for-a-race.

export type UploaderOptions = {
  client: KacolaClient
  sessionId: string
  retryMinMs?: number
  retryMaxMs?: number
  /** Give up on a chunk after this many consecutive failures (default: never). */
  maxAttempts?: number
  log?: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

export type UploadStats = { sent: number; duplicates: number; bytes: number; retries: number }

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Splits one track's PCM stream into fixed-size chunks as bytes arrive. */
export class TrackChunker {
  readonly track: TrackKind
  private buf = new Uint8Array(AUDIO_CHUNK_BYTES)
  private fill = 0
  /** Index of the chunk being filled. */
  index = 0
  constructor(track: TrackKind) {
    this.track = track
  }

  /** Feed PCM bytes; returns the chunks completed by them. */
  push(bytes: Uint8Array): { seq: number; data: Uint8Array }[] {
    const out: { seq: number; data: Uint8Array }[] = []
    let at = 0
    while (at < bytes.length) {
      const n = Math.min(bytes.length - at, AUDIO_CHUNK_BYTES - this.fill)
      this.buf.set(bytes.subarray(at, at + n), this.fill)
      this.fill += n
      at += n
      if (this.fill === AUDIO_CHUNK_BYTES) {
        out.push({ seq: chunkSeqFor(this.track, this.index++), data: this.buf.slice() })
        this.fill = 0
      }
    }
    return out
  }

  /** The final, short chunk (if any). After this the chunker is done. */
  end(): { seq: number; data: Uint8Array } | null {
    if (!this.fill) return null
    const c = { seq: chunkSeqFor(this.track, this.index++), data: this.buf.slice(0, this.fill) }
    this.fill = 0
    return c
  }

  /** Chunks produced so far (the count to finalize with, once ended). */
  get count(): number {
    return this.index
  }
}

/** The chunks of a local WAV as the capture package writes it (canonical header, s16le mono). */
export function chunksOfWav(path: string, track: TrackKind): { seq: number; data: Uint8Array }[] {
  if (!existsSync(path)) return []
  const pcm = new Uint8Array(readFileSync(path)).subarray(WAV_HEADER_BYTES)
  const c = new TrackChunker(track)
  const out = c.push(pcm.subarray(0, pcm.length - (pcm.length % 2)))
  const last = c.end()
  return last ? [...out, last] : out
}

/**
 * Retry an idempotent call (finalize, status) on network errors, 5xx, 408 and 429, with backoff. Other
 * errors — a 4xx the server means — are thrown at once.
 */
export async function retrying<T>(
  fn: () => Promise<T>,
  opts: { minMs?: number; maxMs?: number; attempts?: number } = {},
): Promise<T> {
  let delay = opts.minMs ?? 100
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err instanceof KacolaApiError ? err.status : null
      const permanent = status !== null && status < 500 && status !== 408 && status !== 429
      if (permanent || attempt >= (opts.attempts ?? 12)) throw err
      await sleep(delay)
      delay = Math.min(delay * 2, opts.maxMs ?? 15_000)
    }
  }
}

export class ChunkUploader {
  private readonly o: Required<Omit<UploaderOptions, 'log' | 'maxAttempts'>> &
    Pick<UploaderOptions, 'log' | 'maxAttempts'>
  private queue: Promise<void> = Promise.resolve()
  private failed: Error | null = null
  readonly stats: UploadStats = { sent: 0, duplicates: 0, bytes: 0, retries: 0 }

  constructor(opts: UploaderOptions) {
    this.o = { retryMinMs: 100, retryMaxMs: 15_000, ...opts }
  }

  /** Queue a chunk; uploads run one at a time, in order. */
  enqueue(track: TrackKind, seq: number, data: Uint8Array): void {
    this.queue = this.queue.then(() => (this.failed ? undefined : this.send(track, seq, data)))
  }

  /** Resolves when everything queued so far has been accepted by the server (or throws the failure). */
  async drain(): Promise<void> {
    await this.queue
    if (this.failed) throw this.failed
  }

  private async send(track: TrackKind, seq: number, data: Uint8Array): Promise<void> {
    const body = {
      track,
      sampleRate: 16_000,
      format: 's16le' as const,
      data: Buffer.from(data).toString('base64'),
      sha256: sha256(data),
    }
    let delay = this.o.retryMinMs
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await this.o.client.call('putAudioChunk', {
          params: { id: this.o.sessionId, chunkSeq: String(seq) },
          body,
        })
        if (r.stored) this.stats.sent++
        else this.stats.duplicates++
        this.stats.bytes += data.length
        return
      } catch (err) {
        const status = err instanceof KacolaApiError ? err.status : null
        const permanent = status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429
        if (permanent || (this.o.maxAttempts && attempt >= this.o.maxAttempts)) {
          this.failed = err as Error
          this.o.log?.('error', 'chunk upload failed', { seq, err: (err as Error).message })
          return
        }
        this.stats.retries++
        this.o.log?.('warn', 'chunk upload failed; retrying', {
          seq,
          err: (err as Error).message,
          inMs: delay,
        })
        await sleep(delay)
        delay = Math.min(delay * 2, this.o.retryMaxMs)
      }
    }
  }
}

/**
 * Complete an interrupted upload from the WAVs on disk: ask the server which chunks it has, send only
 * the missing ones, then finalize. Safe to run any number of times.
 */
export async function resumeUpload(opts: {
  client: KacolaClient
  sessionId: string
  sessionDir: string
  durationMs: number
  log?: UploaderOptions['log']
}): Promise<{ session: Session; uploaded: number; alreadyThere: number }> {
  const { client, sessionId, sessionDir } = opts
  const status = await retrying(() => client.call('getAudioStatus', { params: { id: sessionId } }))
  const have = new Map(status.chunks.map((c) => [c.chunkSeq, c.sha256]))
  const up = new ChunkUploader({ client, sessionId, log: opts.log })
  const counts = { mic: 0, system: 0 }
  let uploaded = 0
  let alreadyThere = 0
  for (const track of ['mic', 'system'] as const) {
    const chunks = chunksOfWav(join(sessionDir, `${track}.wav`), track)
    counts[track] = chunks.length
    for (const c of chunks) {
      if (have.get(c.seq) === sha256(c.data)) {
        alreadyThere++
        continue
      }
      up.enqueue(track, c.seq, c.data)
      uploaded++
    }
  }
  await up.drain()
  const session = await retrying(() =>
    client.call('finalizeAudio', {
      params: { id: sessionId },
      body: { chunks: counts, durationMs: opts.durationMs },
    }),
  )
  return { session, uploaded, alreadyThere }
}
