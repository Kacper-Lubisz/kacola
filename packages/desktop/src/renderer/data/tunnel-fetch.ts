import {
  type GnomeolaBridge,
  TUNNEL_ORIGIN,
  type TunnelFrame,
  type TunnelRequest,
} from '../../shared/bridge.ts'

// The renderer half of the fetch tunnel: a `fetch` for the protocol client that goes through the
// preload bridge instead of the network. It returns a real Response whose body is a ReadableStream fed
// by tunnel frames, so the client's SSE decoder, `ask` and `enhanceEvents` work unchanged.

/** Build a fetch over `bridge.fetchStream`. Only URLs under TUNNEL_ORIGIN are accepted. */
export function createTunnelFetch(bridge: Pick<GnomeolaBridge, 'fetchStream'>): typeof fetch {
  return (input, init = {}) =>
    new Promise<Response>((resolve, reject) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.startsWith(`${TUNNEL_ORIGIN}/`)) {
        reject(new TypeError(`the tunnel only carries daemon requests, not ${url}`))
        return
      }
      const headers: Record<string, string> = {}
      new Headers(init.headers).forEach((v, k) => {
        headers[k] = v
      })
      if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') {
        reject(new TypeError('the tunnel carries string (JSON) bodies only'))
        return
      }
      const req: TunnelRequest = {
        method: (init.method ?? 'GET').toUpperCase(),
        path: url.slice(TUNNEL_ORIGIN.length),
        headers,
        ...(typeof init.body === 'string' ? { body: init.body } : {}),
      }
      const signal = init.signal ?? undefined
      if (signal?.aborted) {
        reject(signal.reason ?? new DOMException('aborted', 'AbortError'))
        return
      }

      let controller: ReadableStreamDefaultController<Uint8Array> | null = null
      let settled = false
      let done = false
      const abortError = () => signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
      const onAbort = () => {
        cancel()
        if (!settled) {
          settled = true
          reject(abortError())
        } else if (!done) {
          done = true
          controller?.error(abortError())
        }
      }
      const cleanup = () => signal?.removeEventListener('abort', onAbort)

      const onFrame = (f: TunnelFrame) => {
        if (done) return
        switch (f.type) {
          case 'head': {
            const nullBody = f.status === 204 || f.status === 304 || f.status === 205
            const body = nullBody
              ? null
              : new ReadableStream<Uint8Array>({
                  start(c) {
                    controller = c
                  },
                  cancel() {
                    done = true
                    cleanup()
                    cancelStream()
                  },
                })
            settled = true
            resolve(new Response(body, { status: f.status, statusText: f.statusText, headers: f.headers }))
            return
          }
          case 'chunk':
            // copy: a chunk that crossed the context bridge may be backed by a buffer we do not own
            controller?.enqueue(new Uint8Array(f.data))
            return
          case 'end':
            done = true
            cleanup()
            controller?.close()
            return
          case 'error': {
            done = true
            cleanup()
            const err = new TypeError(`fetch failed: ${f.message}`)
            if (!settled) {
              settled = true
              reject(err)
            } else controller?.error(err)
            return
          }
        }
      }
      const cancelStream = bridge.fetchStream(req, onFrame)
      const cancel = () => {
        cleanup()
        cancelStream()
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
}
