import { createClient } from '@gnomeola/protocol'
import { type GnomeolaBridge, TUNNEL_ORIGIN } from '../../shared/bridge.ts'
import type { Api } from './queries.ts'
import { createTunnelFetch } from './tunnel-fetch.ts'

/** The protocol client every screen uses: the real typed client, over the preload tunnel. */
export function createDaemonApi(bridge: Pick<GnomeolaBridge, 'fetchStream'>): Api {
  return createClient({ baseUrl: TUNNEL_ORIGIN, fetch: createTunnelFetch(bridge), timeoutMs: 10_000 })
}
