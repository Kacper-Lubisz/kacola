import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@gnomeola/protocol'
import { startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'
import { DaemonSupervisor } from '../../desktop/src/main/supervisor.ts'
import type { DaemonStatus } from '../../desktop/src/shared/bridge.ts'

// The Electron main process's daemon supervision against the REAL daemon, run the way the app runs it:
// Electron's own binary with ELECTRON_RUN_AS_NODE=1 executing packages/daemon/src/main.ts (the bundled
// daemon.mjs once packaging produces it).

const ELECTRON = join(
  import.meta.dirname,
  '..',
  '..',
  'desktop',
  'node_modules',
  'electron',
  'dist',
  'electron',
)
const ENTRY = join(import.meta.dirname, '..', '..', 'daemon', 'src', 'main.ts')

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })

const cleanup: (() => unknown)[] = []
afterEach(async () => {
  for (const c of cleanup.splice(0).reverse()) await c()
})

const testEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GNOMEOLA_FAKES: '1',
    GNOMEOLA_KEYRING: 'memory',
    GNOMEOLA_CALENDAR: 'off',
    GNOMEOLA_DBUS: 'off',
    GNOMEOLA_MIC_ACTIVITY: 'off',
  }
  delete env.GNOMEOLA_DATA_DIR
  delete env.ANTHROPIC_API_KEY
  return env
}

async function supervised(o: { baseUrl?: string } = {}) {
  const port = await freePort()
  const dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-supervised-'))
  const statuses: DaemonStatus[] = []
  const baseUrl = o.baseUrl ?? `http://127.0.0.1:${port}`
  const sup = new DaemonSupervisor({
    baseUrl,
    loopback: true,
    entry: ENTRY,
    args: ['--data-dir', dataDir],
    execPath: ELECTRON,
    env: testEnv(),
    initialBackoffMs: 200,
    watchMs: 200,
    onStatus: (s) => statuses.push(s),
  })
  cleanup.push(() => rmSync(dataDir, { recursive: true, force: true }))
  cleanup.push(() => sup.stop(5000))
  return { sup, statuses, baseUrl, client: createClient({ baseUrl, timeoutMs: 5000 }) }
}

describe.skipIf(!existsSync(ELECTRON))('desktop daemon supervision (real daemon on Electron’s Node)', () => {
  it('spawns the daemon on Electron’s runtime when nothing answers, and it serves', async () => {
    const t = await supervised()
    const s = await t.sup.start()
    expect(s.kind).toBe('spawned')
    const h = await t.client.call('health')
    expect(h.lastSeq).toBeGreaterThanOrEqual(0)
    await t.client.call('createSession', { body: { title: 'from the supervised daemon' } })
  }, 60_000)

  it('restarts it after a crash, on the same data', async () => {
    const t = await supervised()
    const first = await t.sup.start()
    if (first.kind !== 'spawned') throw new Error(`expected spawned, got ${first.kind}`)
    await t.client.call('createSession', { body: { title: 'survives a crash' } })
    process.kill(first.pid, 'SIGKILL')
    await waitFor(() => t.statuses.some((s) => s.kind === 'restarting'), 10_000, 'a restart to be scheduled')
    await waitFor(
      () => t.sup.status.kind === 'spawned' && (t.sup.status as { pid: number }).pid !== first.pid,
      30_000,
      'the daemon to be running again',
    )
    const { sessions } = await t.client.call('listSessions', {})
    expect(sessions.map((x) => x.title)).toContain('survives a crash')
  }, 60_000)

  it('attaches to a daemon that is already running, and leaves it running on stop', async () => {
    const d = await startDaemon()
    cleanup.push(() => d.stop())
    const t = await supervised({ baseUrl: d.baseUrl })
    expect(await t.sup.start()).toEqual({ kind: 'attached' })
    await t.sup.stop()
    expect((await d.client.call('health')).lastSeq).toBeGreaterThanOrEqual(0)
  }, 60_000)

  it('quitting while the spawned daemon records leaves it recording; it exits once the meeting ends', async () => {
    const t = await supervised()
    const s = await t.sup.start()
    if (s.kind !== 'spawned') throw new Error(`expected spawned, got ${s.kind}`)
    const rec = await t.client.call('createSession', { body: { title: 'still in the meeting' } })
    await t.client.call('startSession', { params: { id: rec.id } })
    await t.sup.stop()
    expect(t.sup.left).toEqual({ pid: s.pid, asked: true })
    // the window is gone; the meeting is not
    expect((await t.client.call('getSession', { params: { id: rec.id } })).status).toBe('recording')
    expect((await t.client.call('daemonInfo')).restart).toMatchObject({
      mode: 'when-idle',
      by: 'desktop quit',
    })
    await t.client.call('stopSession', { params: { id: rec.id } })
    await waitFor(
      async () => {
        try {
          await t.client.call('health')
          return false
        } catch {
          return true
        }
      },
      15_000,
      'the daemon to exit after the meeting',
    )
    await waitFor(
      () => {
        try {
          process.kill(s.pid, 0)
          return false
        } catch {
          return true
        }
      },
      15_000,
      'the daemon process to be gone',
    )
  }, 60_000)

  it('stop() (explicit quit) shuts the spawned daemon down cleanly', async () => {
    const t = await supervised()
    const s = await t.sup.start()
    if (s.kind !== 'spawned') throw new Error(`expected spawned, got ${s.kind}`)
    await t.sup.stop()
    await expect(t.client.call('health')).rejects.toMatchObject({ name: 'DaemonUnreachableError' })
    expect(t.sup.log()).toContain('"stopped"')
  }, 60_000)
})
