import type { IncomingMessage, ServerResponse } from 'node:http'
import { encodeSse, encodeSseComment, type SseMessage } from '@gnomeola/protocol'
import { DaemonError } from './errors.ts'

export const MAX_BODY_BYTES = 1024 * 1024

export async function readJsonBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    // Over the limit: keep draining (discarding) so the client can read our 413 instead of seeing a
    // reset — but only up to a bound, after which the socket is dropped.
    if (size > limit * 8) break
    if (size <= limit) chunks.push(chunk)
  }
  if (size > limit) throw new DaemonError('bad_request', `request body exceeds ${limit} bytes`, 413)
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new DaemonError('bad_request', 'request body is not valid JSON')
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(text)
}

export type SseWriterOptions = {
  /** If the socket buffers more than this, the client is too slow: drop it (it resumes by cursor). */
  maxBufferedBytes?: number
}

/**
 * One SSE response. Writes never throw; once the connection is gone every write is a no-op and
 * `closed` is true. `onClose` callbacks run exactly once, however the stream ends.
 */
export class SseWriter {
  private readonly res: ServerResponse
  private readonly maxBuffered: number
  private readonly closers: (() => void)[] = []
  private isClosed = false
  private dropReason: string | null = null

  constructor(res: ServerResponse, opts: SseWriterOptions = {}) {
    this.res = res
    this.maxBuffered = opts.maxBufferedBytes ?? 8 * 1024 * 1024
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.flushHeaders()
    res.on('close', () => this.markClosed())
    res.on('error', () => this.markClosed())
  }

  private markClosed(): void {
    if (this.isClosed) return
    this.isClosed = true
    for (const fn of this.closers.splice(0)) {
      try {
        fn()
      } catch {}
    }
  }

  get closed(): boolean {
    return this.isClosed
  }

  /** Why the server dropped this client, if it did. */
  get dropped(): string | null {
    return this.dropReason
  }

  onClose(fn: () => void): void {
    if (this.isClosed) fn()
    else this.closers.push(fn)
  }

  private write(text: string): boolean {
    if (this.isClosed) return false
    if (this.res.writableLength > this.maxBuffered) {
      this.dropReason = `client too slow (${this.res.writableLength} bytes buffered)`
      this.res.destroy()
      this.markClosed()
      return false
    }
    this.res.write(text)
    return true
  }

  send(msg: SseMessage): boolean {
    return this.write(encodeSse(msg))
  }

  comment(text: string): boolean {
    return this.write(encodeSseComment(text))
  }

  /** Resolves when the socket buffer has drained (or the connection is gone). */
  drained(): Promise<void> {
    if (this.isClosed || !this.res.writableNeedDrain) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        this.res.off('drain', done)
        resolve()
      }
      this.res.once('drain', done)
      this.onClose(done)
    })
  }

  /** Resolves when the connection closes, for whatever reason. */
  whenClosed(): Promise<void> {
    return new Promise((resolve) => this.onClose(resolve))
  }

  end(): void {
    if (this.isClosed) return
    this.res.end()
    this.markClosed()
  }
}
