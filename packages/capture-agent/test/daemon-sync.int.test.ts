import { createClient } from '@gnomeola/protocol'
import { createHostedApp, serve } from '@gnomeola/server'
import { SqliteStoreApi } from '@gnomeola/store'
import { MemoryBlobStore } from '@gnomeola/store/blob'
import { startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { expect, it } from 'vitest'

// H-7 as shipped: `gnomeolad` itself, started with GNOMEOLA_SYNC_URL + GNOMEOLA_SYNC_TOKEN, keeps a
// hosted server in step — including across a daemon restart — with no agent process of its own.

it('gnomeolad with GNOMEOLA_SYNC_URL pushes its meetings to the hosted server, and resumes after a restart', async () => {
  const store = SqliteStoreApi.open(':memory:')
  const admin = 'daemon-sync-admin-token-0123'
  const app = createHostedApp({
    store,
    blobs: new MemoryBlobStore(),
    auth: { secret: 'x'.repeat(40), adminToken: admin },
  })
  const served = await serve(app)
  const anon = createClient({ baseUrl: served.url })
  const start = await anon.call('pairStart', { body: { name: 'laptop' } })
  await createClient({ baseUrl: served.url, token: admin }).call('pairApprove', {
    body: { userCode: start.userCode },
  })
  const tok = await anon.call('pairToken', { body: { deviceCode: start.deviceCode } })
  if (tok.status !== 'approved') throw new Error('pairing failed')

  const d = await startDaemon({
    env: {
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 30, finalizeAfterMs: 20 }),
      GNOMEOLA_SYNC_URL: served.url,
      GNOMEOLA_SYNC_TOKEN: tok.token,
    },
  })
  try {
    const s = await d.client.call('createSession', { body: { title: 'synced by the daemon' } })
    await d.client.call('startSession', { params: { id: s.id } })
    await new Promise((r) => setTimeout(r, 200))
    await d.client.call('stopSession', { params: { id: s.id } })
    const caughtUp = async () =>
      (await store.syncCursor(tok.deviceId)) >= (await d.client.call('health')).lastSeq
    await waitFor(caughtUp, 15_000, 'the remote cursor to catch up')
    expect((await store.getSession(s.id))?.title).toBe('synced by the daemon')
    const local = await d.client.call('getTranscript', { params: { id: s.id } })
    expect((await store.transcript(s.id)).segments).toEqual(local.segments)

    await d.kill('SIGTERM')
    await d.restart()
    await d.client.call('updateSession', { params: { id: s.id }, body: { title: 'renamed after restart' } })
    await waitFor(caughtUp, 15_000, 'the remote cursor to catch up after restart')
    expect((await store.getSession(s.id))?.title).toBe('renamed after restart')
  } finally {
    await d.stop()
    await served.close()
    await store.close()
  }
})
