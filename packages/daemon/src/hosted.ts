import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { join } from 'node:path'
import type { SyncPushBody } from '@kacola/protocol'
import { Auth, type AuthConfig, isLoopbackRequest, OPEN_ROUTES, type Principal } from '@kacola/server/auth'
import { SqliteStoreApi, type Store } from '@kacola/store'
import { DaemonError } from './errors.ts'

// M8 on the LOCAL daemon.
//
// H-6: the daemon may listen beyond loopback only with pairing auth configured (DaemonOptions.auth).
// Then a request is anonymous only if it is loopback in every sense — loopback socket, loopback Host,
// no proxy headers — and everything else needs a token issued by the device-code flow; the two pairing
// entry points are the only routes an unpaired remote device can reach. Without auth the daemon stays
// exactly as before: loopback bind, loopback Host header, no tokens.
//
// Audio upload is a hosted-server feature (packages/server), so those routes answer a typed 501. Sync
// ingest answers here for this machine's own sync agent only (two-way sync, capture-agent/sync.ts): it
// pulls the other devices' changes from the hosted server and applies them through the same ingest the
// server uses, under the device id `PULL_DEVICE` (its cursor is the server's seq), never as this device.

const hostedOnly = (what: string) => () => {
  throw new DaemonError(
    'unavailable',
    `${what} is served by a hosted kacola server, not the local daemon`,
    501,
  )
}

export type RemoteAccess = {
  /** Who is calling; throws 401 (with the Bearer challenge) for an unauthenticated remote request. */
  authenticate(req: IncomingMessage, route: string): Promise<Principal>
  readonly auth: Auth | null
}

const unauthorized = (message: string) => new DaemonError('unauthorized', message, 401)

export function remoteAccess(store: Store, config: AuthConfig | null, trustLoopback = true): RemoteAccess {
  const auth = config ? new Auth(new SqliteStoreApi(store), config) : null
  return {
    auth,
    async authenticate(req, route) {
      if (!auth) return { kind: 'loopback' } // the Host check in dispatch already refused anything else
      const loopback = isLoopbackRequest({
        remoteAddress: req.socket.remoteAddress,
        host: req.headers.host,
        forwarded: req.headers['x-forwarded-for'] !== undefined || req.headers.forwarded !== undefined,
      })
      const authorization = req.headers.authorization
      if (authorization !== undefined) {
        try {
          return await auth.authenticate(authorization)
        } catch (err) {
          throw unauthorized((err as Error).message)
        }
      }
      if (loopback && trustLoopback) return { kind: 'loopback' }
      if (OPEN_ROUTES.has(route)) return { kind: 'anonymous' }
      throw unauthorized('a bearer token is required (pair this device: kacola pair)')
    },
  }
}

/** The local cursor for what has been pulled from the hosted server. */
export const PULL_DEVICE = 'hosted-server'

export function requireLocal(req: IncomingMessage) {
  const local = isLoopbackRequest({
    remoteAddress: req.socket.remoteAddress,
    host: req.headers.host,
    forwarded: req.headers['x-forwarded-for'] !== undefined || req.headers.forwarded !== undefined,
  })
  if (!local) throw new DaemonError('unauthorized', 'this is for this machine only', 403)
}

export function hostedHandlers(access: RemoteAccess, store: Store, deviceId: string) {
  const api = new SqliteStoreApi(store)
  const pairing = () => {
    if (!access.auth)
      throw new DaemonError(
        'unavailable',
        'pairing is off: start kacolad with --remote (or KACOLA_AUTH_SECRET) to accept remote devices',
        501,
      )
    return access.auth
  }
  return {
    syncPush: ({ body, req }: { body: SyncPushBody; req: IncomingMessage }) => {
      requireLocal(req)
      return api.ingest(body.deviceId ?? PULL_DEVICE, body.items, {
        ...(body.partial ? { partial: true } : {}),
        self: deviceId,
      })
    },
    syncCursor: async ({ query, req }: { query: { deviceId?: string }; req: IncomingMessage }) => {
      requireLocal(req)
      const id = query.deviceId ?? PULL_DEVICE
      return { deviceId: id, cursor: await api.syncCursor(id) }
    },
    pairStart: ({ body }: { body: { name: string } }) => pairing().start(body.name),
    // Not an open route: reaching it means loopback (the owner at this machine) or a paired device.
    pairApprove: ({ body }: { body: { userCode: string } }) => pairing().approve(body.userCode),
    pairToken: ({ body }: { body: { deviceCode: string } }) => pairing().poll(body.deviceCode),
    pairRevoke: async ({ body }: { body: { deviceId: string } }) => ({
      revoked: await pairing().revoke(body.deviceId),
    }),
    putAudioChunk: hostedOnly('audio upload'),
    getAudioStatus: hostedOnly('audio upload'),
    finalizeAudio: hostedOnly('audio upload'),
  }
}

/**
 * This install's device id: who its changes are from, on the hosted server and to the other devices.
 * Made once and kept in the data dir, so a reinstall over the same data stays the same device.
 */
export function installDeviceId(dataDir: string): string {
  const file = join(dataDir, 'device-id')
  if (existsSync(file)) {
    const id = readFileSync(file, 'utf8').trim()
    if (/^dev_[A-Za-z0-9_-]{8,64}$/.test(id)) return id
  }
  const id = `dev_${randomBytes(12).toString('base64url')}`
  writeFileSync(file, `${id}\n`, { mode: 0o600 })
  return id
}
