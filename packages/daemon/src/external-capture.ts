import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ExternalCaptureHub, ExternalConnection } from '@gnomeola/capture'
import { type IngestResult, PcmFrameDecoder, PcmFrameError, TrackKind } from '@gnomeola/protocol'
import type { Handlers } from './daemon.ts'
import { DaemonError } from './errors.ts'

// P-3: the ingest side of external capture (protocol capture.ts). The route is loopback-only whatever the
// auth mode: it is how the app on the same machine hands the daemon its microphone and system audio, not
// a remote upload path (that is M8's chunked audio upload).

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function externalCaptureHandlers(
  hub: ExternalCaptureHub | null,
): Pick<Handlers, 'externalCaptureStatus' | 'ingestExternalCapture'> {
  return {
    externalCaptureStatus: () => ({
      captures: (hub?.list() ?? []).map(({ sessionId, source }) => ({
        sessionId,
        state: source.state === 'paused' ? ('paused' as const) : ('recording' as const),
        tracks: source.status(),
      })),
    }),
    ingestExternalCapture: async ({ params, req, res }) => {
      if (!LOOPBACK.has(req.socket.remoteAddress ?? ''))
        throw new DaemonError('unauthorized', 'external capture is accepted from this machine only', 403)
      const track = TrackKind.safeParse(params.track)
      if (!track.success) throw new DaemonError('bad_request', `unknown track ${params.track}`)
      if (!hub)
        throw new DaemonError('unavailable', 'this daemon records with PipeWire, not external capture')
      const source = hub.get(params.sessionId)
      if (!source)
        throw new DaemonError('not_found', `session ${params.sessionId} is not waiting for external audio`)
      let conn: ExternalConnection
      try {
        conn = source.attach(track.data)
      } catch (err) {
        throw new DaemonError('conflict', (err as Error).message)
      }
      try {
        return await pump(req, res, conn)
      } finally {
        conn.detach()
      }
    },
  }
}

/** Feed the request body into the connection until the client ends it or the daemon ends the stream. */
async function pump(
  req: IncomingMessage,
  res: ServerResponse,
  conn: ExternalConnection,
): Promise<IngestResult> {
  const decoder = new PcmFrameDecoder()
  const result: IngestResult = { frames: 0, samples: 0, discarded: 0, ended: 'client' }
  const it = (req as AsyncIterable<Buffer>)[Symbol.asyncIterator]()
  const ended = conn.ended.then((why) => ({ why }))
  for (;;) {
    const next = await Promise.race([it.next().catch((error: unknown) => ({ error })), ended])
    if ('error' in next) {
      // the client went away mid-stream (app quit, crash): that is a disconnect, not a daemon error
      if (req.destroyed) return result
      throw next.error
    }
    if ('why' in next) {
      result.ended = next.why
      // Answer now; the client stops sending when it reads this. Close the connection afterwards so any
      // body still in flight is discarded with it (not destroyed before the answer, as it.return() would).
      res.setHeader('connection', 'close')
      return result
    }
    if (next.done) break
    let frames: ReturnType<PcmFrameDecoder['push']>
    try {
      frames = decoder.push(new Uint8Array(next.value.buffer, next.value.byteOffset, next.value.length))
    } catch (err) {
      if (err instanceof PcmFrameError)
        throw new DaemonError('bad_request', `bad PCM frame stream: ${err.message}`)
      throw err
    }
    for (const f of frames) {
      const r = conn.push(f)
      result.frames++
      result.samples += r.written
      result.discarded += r.discarded
    }
  }
  if (decoder.pending)
    throw new DaemonError('bad_request', `stream ended inside a frame (${decoder.pending} bytes)`)
  return result
}
