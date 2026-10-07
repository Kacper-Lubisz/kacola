import { z } from 'zod'
import { TrackKind } from './schemas.ts'

// P-3: external capture — a client (the desktop app on macOS, where the daemon cannot reach the sound
// server) supplies each track's audio to the daemon, which records and transcribes it exactly as it
// would PipeWire's.
//
// Transport: one long-lived streaming POST per track, `POST /capture/external/:sessionId/:track` with
// `content-type: application/vnd.kacola.pcm-frames`, whose body is a sequence of frames:
//
//   offset  size  field
//        0     4  magic "GPCM"
//        4     1  version (1)
//        5     1  flags (reserved, 0)
//        6     2  reserved (0)
//        8     4  epoch   u32 LE — chosen by the client each time it (re)starts capturing the track
//       12     8  sample  u64 LE — index of the payload's first sample within the epoch
//       20     4  bytes   u32 LE — payload length: even, at most MAX_FRAME_BYTES
//       24     …  payload — 16 kHz mono signed 16-bit little-endian PCM
//
// Why this shape: the (epoch, sample) pair makes delivery idempotent and lets the daemon place audio
// exactly. A client that reconnects (or rotates its request) resends from any sample in the same epoch
// and nothing is duplicated or lost; a client that drops audio says so by jumping ahead, which the daemon
// records as a gap; a new epoch (capture restarted, device changed, resume) is anchored to the daemon's
// wall clock like a fresh PipeWire stream. A streaming POST rather than a WebSocket: it goes through the
// same route table, Origin/Host guards and bearer auth as every other request, needs no upgrade path or
// extra dependency, and Node's fetch streams request bodies (`duplex: 'half'`). The response (JSON,
// IngestResult) is sent when the request body ends, or early when the recording stops or another stream
// supersedes this one.

export const PCM_FRAME_CONTENT_TYPE = 'application/vnd.kacola.pcm-frames'
export const PCM_FRAME_MAGIC = 0x4d435047 // "GPCM" read as u32 LE
export const PCM_FRAME_VERSION = 1
export const PCM_FRAME_HEADER_BYTES = 24
/** One second of audio. Clients typically send 20–100 ms. */
export const MAX_FRAME_BYTES = 32_000
export const INGEST_SAMPLE_RATE = 16_000

export type PcmFrame = { epoch: number; sample: number; samples: Int16Array }

export class PcmFrameError extends Error {
  override name = 'PcmFrameError'
}

export function encodePcmFrame(f: PcmFrame): Uint8Array {
  const bytes = f.samples.length * 2
  if (bytes > MAX_FRAME_BYTES) throw new PcmFrameError(`frame of ${bytes} bytes exceeds ${MAX_FRAME_BYTES}`)
  if (!Number.isSafeInteger(f.sample) || f.sample < 0) throw new PcmFrameError('sample must be a safe uint')
  if (!Number.isInteger(f.epoch) || f.epoch < 0 || f.epoch > 0xffffffff)
    throw new PcmFrameError('epoch must be a u32')
  const out = new Uint8Array(PCM_FRAME_HEADER_BYTES + bytes)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, PCM_FRAME_MAGIC, true)
  dv.setUint8(4, PCM_FRAME_VERSION)
  dv.setUint32(8, f.epoch, true)
  dv.setBigUint64(12, BigInt(f.sample), true)
  dv.setUint32(20, bytes, true)
  for (let i = 0; i < f.samples.length; i++) dv.setInt16(PCM_FRAME_HEADER_BYTES + i * 2, f.samples[i]!, true)
  return out
}

/** Incremental decoder: push arbitrary chunks, get whole frames. Throws PcmFrameError on bad input. */
export class PcmFrameDecoder {
  private buf: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

  push(chunk: Uint8Array): PcmFrame[] {
    if (this.buf.length) {
      const joined = new Uint8Array(this.buf.length + chunk.length)
      joined.set(this.buf)
      joined.set(chunk, this.buf.length)
      this.buf = joined
    } else this.buf = chunk
    const frames: PcmFrame[] = []
    let off = 0
    while (this.buf.length - off >= PCM_FRAME_HEADER_BYTES) {
      const dv = new DataView(this.buf.buffer, this.buf.byteOffset + off)
      if (dv.getUint32(0, true) !== PCM_FRAME_MAGIC) throw new PcmFrameError('bad frame magic')
      if (dv.getUint8(4) !== PCM_FRAME_VERSION)
        throw new PcmFrameError(`unsupported frame version ${dv.getUint8(4)}`)
      const bytes = dv.getUint32(20, true)
      if (bytes > MAX_FRAME_BYTES || bytes % 2) throw new PcmFrameError(`bad frame length ${bytes}`)
      if (this.buf.length - off < PCM_FRAME_HEADER_BYTES + bytes) break
      const sample = dv.getBigUint64(12, true)
      if (sample > BigInt(Number.MAX_SAFE_INTEGER)) throw new PcmFrameError('sample index out of range')
      const samples = new Int16Array(bytes / 2)
      for (let i = 0; i < samples.length; i++) samples[i] = dv.getInt16(PCM_FRAME_HEADER_BYTES + i * 2, true)
      frames.push({ epoch: dv.getUint32(8, true), sample: Number(sample), samples })
      off += PCM_FRAME_HEADER_BYTES + bytes
    }
    // copy the remainder so the caller's chunk is not retained
    this.buf = off ? this.buf.slice(off) : this.buf === chunk ? chunk.slice() : this.buf
    return frames
  }

  /** Bytes of an incomplete frame still buffered. */
  get pending(): number {
    return this.buf.length
  }
}

/** Web Audio float samples (−1..1) to s16. */
export function floatToPcm16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length)
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]!))
    out[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767)
  }
  return out
}

export const ExternalTrackStatus = z.object({
  kind: TrackKind,
  /** A client stream is attached right now. */
  connected: z.boolean(),
  positionMs: z.int().nonnegative(),
  gaps: z.int().nonnegative(),
})
export const ExternalCaptureStatus = z.object({
  /** Recordings waiting for (or receiving) audio from a client: the tracks it should stream. */
  captures: z.array(
    z.object({
      sessionId: z.string(),
      state: z.enum(['recording', 'paused']),
      tracks: z.array(ExternalTrackStatus),
    }),
  ),
})
export type ExternalCaptureStatus = z.infer<typeof ExternalCaptureStatus>

export const IngestResult = z.object({
  frames: z.int().nonnegative(),
  /** Samples written to the recording (duplicates and paused-time audio excluded). */
  samples: z.int().nonnegative(),
  /** Samples discarded: resent duplicates, audio sent while paused or after stop. */
  discarded: z.int().nonnegative(),
  /** Why the daemon ended the stream: the client finished, the recording stopped, or a newer stream took over. */
  ended: z.enum(['client', 'stopped', 'superseded']),
})
export type IngestResult = z.infer<typeof IngestResult>

export const externalCaptureRoutes = {
  externalCaptureStatus: {
    method: 'GET',
    path: '/capture/external',
    response: ExternalCaptureStatus,
  },
  /** The body is a PCM frame stream (see above), not JSON; loopback only. */
  ingestExternalCapture: {
    method: 'POST',
    path: '/capture/external/:sessionId/:track',
    rawBody: PCM_FRAME_CONTENT_TYPE,
    response: IngestResult,
  },
} as const

export type IngestOptions = {
  baseUrl: string
  sessionId: string
  track: z.infer<typeof TrackKind>
  frames: AsyncIterable<PcmFrame>
  token?: string
  fetch?: typeof fetch
  signal?: AbortSignal
  /**
   * End the request and continue in a new one this often (default 60 s). Delivery is by (epoch, sample),
   * so rotation is lossless; it keeps each request well inside HTTP servers' request timeouts (Node's
   * default is 300 s) for meetings of any length, and exercises the reconnect path all the time.
   */
  rotateMs?: number
}

/**
 * Stream frames to the daemon until they run out or the daemon ends the stream (the recording stopped);
 * resolves with the summed results. For Node and the desktop app's main process (Electron's Node).
 */
export async function ingestPcm(o: IngestOptions): Promise<IngestResult> {
  const f = o.fetch ?? fetch
  const url = `${o.baseUrl.replace(/\/+$/, '')}/capture/external/${encodeURIComponent(o.sessionId)}/${o.track}`
  const rotateMs = o.rotateMs ?? 60_000
  const it = o.frames[Symbol.asyncIterator]()
  const total: IngestResult = { frames: 0, samples: 0, discarded: 0, ended: 'client' }
  let exhausted = false
  while (!exhausted) {
    if (o.signal?.aborted) throw o.signal.reason
    const deadline = Date.now() + rotateMs
    const ac = new AbortController()
    const onAbort = () => ac.abort(o.signal?.reason)
    o.signal?.addEventListener('abort', onAbort, { once: true })
    let answered = false
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (answered || Date.now() >= deadline) return controller.close()
        const n = await it.next()
        if (n.done) {
          exhausted = true
          return controller.close()
        }
        if (!answered) controller.enqueue(encodePcmFrame(n.value))
      },
    })
    try {
      const res = await f(url, {
        method: 'POST',
        headers: {
          'content-type': PCM_FRAME_CONTENT_TYPE,
          ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
        },
        body,
        signal: ac.signal,
        // Node's fetch needs this to stream a request body
        duplex: 'half',
      } as RequestInit)
      const json = (await res.json()) as unknown
      answered = true
      if (!res.ok) {
        const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
        throw new Error(`ingest ${o.track}: ${msg}`)
      }
      const r = IngestResult.parse(json)
      total.frames += r.frames
      total.samples += r.samples
      total.discarded += r.discarded
      if (r.ended !== 'client') {
        total.ended = r.ended
        ac.abort() // the daemon is done with this track: stop uploading whatever is in flight
        return total
      }
    } finally {
      answered = true
      o.signal?.removeEventListener('abort', onAbort)
    }
  }
  return total
}
