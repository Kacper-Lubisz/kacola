import type { TunnelControl, TunnelFrame, TunnelRequest } from './bridge.ts'

// The preload half of the fetch tunnel, runtime-free so tests can drive it with Node's MessageChannel:
// open a channel, hand one end to main with the request, and relay frames from the other end.

export type LocalPort = {
  postMessage(m: TunnelControl): void
  listen(cb: (data: unknown) => void): void
  close(): void
}

export type Channel<Remote> = { local: LocalPort; remote: Remote }

/** Adapt a DOM (or Node) MessageChannel: port1 stays here, port2 goes to main. */
export function channelOf<P extends { postMessage(m: unknown): void; close(): void }>(c: {
  port1: P
  port2: P
}): Channel<P> {
  // DOM and Node ports both deliver through an `onmessage` setter, typed differently

  const p = c.port1 as unknown as { onmessage: ((e: { data: unknown }) => void) | null }
  return {
    local: {
      postMessage: (m) => c.port1.postMessage(m),
      listen: (cb) => {
        p.onmessage = (e) => cb(e.data)
      },
      close: () => c.port1.close(),
    },
    remote: c.port2,
  }
}

export function openTunnel<Remote>(
  req: TunnelRequest,
  onFrame: (f: TunnelFrame) => void,
  channel: () => Channel<Remote>,
  send: (req: TunnelRequest, remote: Remote) => void,
): () => void {
  const { local, remote } = channel()
  let open = true
  local.listen((data) => {
    if (!open) return
    const f = data as TunnelFrame
    if (f.type === 'end' || f.type === 'error') {
      open = false
      local.close()
    }
    onFrame(f)
  })
  send(req, remote)
  return () => {
    if (!open) return
    open = false
    local.postMessage({ type: 'cancel' })
    local.close()
  }
}
