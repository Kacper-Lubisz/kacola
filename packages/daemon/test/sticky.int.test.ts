import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { waitFor } from '@gnomeola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'
import { createDaemon, type Daemon, type DaemonOptions } from '../src/daemon.ts'
import { acquireDataDirLock, DataDirLockedError, LOCK_FILE } from '../src/data-lock.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'

// The sticky daemon in process: one owner per data dir (createDaemon takes the lock before the store,
// the log or recovery), recover() only under that lock, and the suspend → resume handshake through
// close({ suspend }) and the next createDaemon on the same dir.

const dirs: string[] = []
const open: Daemon[] = []
afterEach(async () => {
  for (const d of open.splice(0)) await d.close().catch(() => {})
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'gnomeola-sticky-'))
  dirs.push(d)
  return d
}

async function daemon(dataDir: string, o: Partial<DaemonOptions> = {}): Promise<Daemon> {
  const d = await createDaemon({
    dataDir,
    port: 0,
    keyring: new MemoryKeyring(),
    env: {},
    pipeline: new FakePipeline({ segmentEveryMs: 100, finalizeAfterMs: 50, partialEveryMs: 30 }),
    ...o,
  })
  open.push(d)
  return d
}

async function recordOne(d: Daemon) {
  const s = d.store.createSession({ title: 'In-process meeting' })
  await d.sessions.start(s.id)
  await waitFor(() => d.store.segments(s.id).length >= 3, 10_000, 'segments')
  return s
}

describe('one owner per data dir (in process)', () => {
  it('a second createDaemon on a live dir is refused before it opens anything, and A keeps recording', async () => {
    const dir = tmp()
    const a = await daemon(dir)
    const s = await recordOne(a)
    await expect(daemon(dir)).rejects.toBeInstanceOf(DataDirLockedError)
    expect(a.lock.held).toBe(true)
    expect(a.store.getSession(s.id)!.status).toBe('recording')
    const n = a.store.segments(s.id).length
    await waitFor(() => a.store.segments(s.id).length > n, 5_000, 'more segments')
    // closing releases the dir for the next owner
    await a.close()
    open.splice(open.indexOf(a), 1)
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false)
    const b = await daemon(dir, { resumeWindowMs: 0 })
    expect(b.store.getSession(s.id)!.status).toBe('stopped')
  })

  it('recover() refuses to run without the lock on its own dir', async () => {
    const a = await daemon(tmp())
    const other = acquireDataDirLock(tmp())
    expect(() => a.sessions.recover(other)).toThrow(/needs the lock/)
    other.release()
    expect(() => a.sessions.recover(a.lock)).not.toThrow()
  })
})

describe('suspend and resume across daemons (in process)', () => {
  it('close({ suspend }) leaves the session resumable; the next daemon continues it', async () => {
    const dir = tmp()
    const a = await daemon(dir)
    const s = await recordOne(a)
    await a.close({ suspend: true, reason: 'test' })
    open.splice(open.indexOf(a), 1)
    const b = await daemon(dir, { resumeWindowMs: 60_000 })
    await b.resuming
    expect(b.store.getSession(s.id)).toMatchObject({ status: 'recording', error: null })
    expect(b.restart.info().resumed).toEqual([{ id: s.id, gapMs: expect.any(Number) }])
  })

  it('a session that was ending (logout, shutdown) is closed out, not turned back on', async () => {
    const dir = tmp()
    const a = await daemon(dir)
    const s = await recordOne(a)
    await a.close({ suspend: true, resume: false, reason: 'SIGTERM (session ending)' })
    open.splice(open.indexOf(a), 1)
    const b = await daemon(dir, { resumeWindowMs: 60_000 })
    await b.resuming
    expect(b.store.getSession(s.id)).toMatchObject({
      status: 'stopped',
      error: 'the recording stopped when the session ended (logout or shutdown)',
    })
    expect(b.sessions.activeCount).toBe(0)
  })

  it('a restart request without a restart hook is refused', async () => {
    const a = await daemon(tmp())
    expect(() => a.restart.request({ mode: 'when-idle', force: false, by: 'test' })).toThrow(/not started/)
  })
})
