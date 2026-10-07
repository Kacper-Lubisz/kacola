import { MessageChannel, type MessagePort } from 'node:worker_threads'
import { serveTunnel, type TunnelPort } from '../src/main/tunnel.ts'
import { createTunnelFetch } from '../src/renderer/data/tunnel-fetch.ts'
import type { KacolaBridge, TunnelControl, TunnelFrame, TunnelRequest } from '../src/shared/bridge.ts'
import { channelOf, openTunnel } from '../src/shared/tunnel-port.ts'

// The fetch tunnel without Electron: the renderer's fetch → the preload's port relay → main's
// serveTunnel, joined by Node MessageChannels exactly as ipcRenderer.postMessage joins them in the app.
// Used by the unit tests (fake network) and packages/e2e's int test (the real daemon).

/** Main's side of a Node MessagePort, as index.ts adapts Electron's MessagePortMain. */
export function nodePort(p: MessagePort): TunnelPort {
  const close: (() => void)[] = []
  p.on('close', () => {
    for (const c of close) c()
  })
  return {
    post: (f) => p.postMessage(f),
    onControl: (cb) => p.on('message', (m) => cb(m as TunnelControl)),
    onClose: (cb) => close.push(cb),
    close: () => p.close(),
  }
}

/** A whole tunnel: renderer fetch → bridge → main, against `fetchImpl` standing in for the network. */
export function tunnel(deps: { baseUrl: string; token?: string; fetch?: typeof fetch }) {
  const seen: TunnelFrame[] = []
  const requests: TunnelRequest[] = []
  const bridge: Pick<KacolaBridge, 'fetchStream'> = {
    fetchStream: (req, onFrame) =>
      openTunnel(
        req,
        (f) => {
          seen.push(f)
          onFrame(f)
        },
        () => channelOf(new MessageChannel()),
        (r, remote: MessagePort) => {
          requests.push(r)
          void serveTunnel(structuredClone(r), nodePort(remote), deps)
        },
      ),
  }
  return { fetch: createTunnelFetch(bridge), seen, requests }
}
