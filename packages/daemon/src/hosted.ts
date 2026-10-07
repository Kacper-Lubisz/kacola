import type { IncomingMessage } from 'node:http'
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
// Sync ingest and audio upload are hosted-server features (packages/server): a local daemon is the thing
// that pushes, not a target, so those routes answer a typed 501.

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

export function hostedHandlers(access: RemoteAccess) {
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
    syncPush: hostedOnly('sync'),
    syncCursor: hostedOnly('sync'),
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
