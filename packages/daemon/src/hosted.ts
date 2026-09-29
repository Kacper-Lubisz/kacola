import { DaemonError } from './errors.ts'

// The M8 routes as the LOCAL daemon answers them. Sync ingest and audio upload are hosted-server
// features (packages/server); a local daemon is the thing that pushes, not a target.
const hostedOnly = (what: string) => () => {
  throw new DaemonError(
    'unavailable',
    `${what} is served by a hosted gnomeola server, not the local daemon`,
    501,
  )
}

export const hostedHandlers = {
  syncPush: hostedOnly('sync'),
  syncCursor: hostedOnly('sync'),
  pairStart: hostedOnly('pairing'),
  pairApprove: hostedOnly('pairing'),
  pairToken: hostedOnly('pairing'),
  putAudioChunk: hostedOnly('audio upload'),
  getAudioStatus: hostedOnly('audio upload'),
  finalizeAudio: hostedOnly('audio upload'),
}
