import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop, waitForDaemon } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DESKTOP_ARTIFACTS, markOnboarded } from '../src/desktop.ts'
import { pathsFor, windowEnv } from '../src/sandbox/cli.ts'

// The sandbox window (`pnpm sandbox start` opens it with GNOMEOLA_PROFILE=sandbox) beside an everyday
// window on the same desktop, in the headless Shell: both run (the profile has its own user-data dir, so
// its own single-instance lock), the sandbox one says so in its title and a badge, and each shows its
// own daemon's day.

const REPO = resolve(import.meta.dirname, '..', '..', '..')
const freePort = () =>
  new Promise<number>((res) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => res(p))
    })
  })

let display: HeadlessDisplay
let root = ''
let dir = ''
let real: DaemonHandle
let everyday: DesktopApp | undefined
let sandboxWin: DesktopApp | undefined
const run = (env: Record<string, string | undefined>, args: string[]) =>
  spawnSync(process.execPath, [join(REPO, 'scripts', 'sandbox.ts'), '--dir', dir, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', TYPESAFE_API_KEY: '' },
  })
const sandbox = (...args: string[]) => run(process.env, args)

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markOnboarded(display)
  root = mkdtempSync(join(tmpdir(), 'kacola-sandbox-window-'))
  dir = join(root, 'kacola-sandbox')
  real = await startDaemon({ dataDir: join(root, 'real-data') })
  await real.client.call('createSession', { body: { title: 'Everyday meeting' } })
}, 240_000)

afterAll(async () => {
  await sandboxWin?.close()
  await everyday?.close()
  if (dir) sandbox('stop')
  await real?.stop()
  if (display) {
    const id = display.env.GNOMEOLA_HEADLESS_ID!
    await display.close()
    expect(markedPids(id)).toEqual([])
  }
  if (root) rmSync(root, { recursive: true, force: true })
}, 120_000)

describe('the sandbox window', () => {
  it('runs beside the everyday window, says it is the sandbox, and shows the mock day', async () => {
    const port = await freePort()
    const r = sandbox(
      'start',
      '--no-window',
      '--port',
      String(port),
      '--share-port',
      String(await freePort()),
    )
    expect(r.status, r.stdout + r.stderr).toBe(0)
    const url = `http://127.0.0.1:${port}`

    everyday = await launchDesktop({ display, env: { GNOMEOLA_URL: real.baseUrl } })
    await waitForDaemon(everyday, 'attached')
    const p = pathsFor(dir)
    sandboxWin = await launchDesktop({ display, env: windowEnv(p, url) })
    await waitForDaemon(sandboxWin, 'attached')

    // its own Electron profile (so its own single-instance lock): the everyday window is still there
    expect(await sandboxWin.evaluateMain(({ app }) => app.getPath('userData'))).toBe(p.electron)
    expect(await everyday.evaluateMain(({ app }) => app.getPath('userData'))).not.toBe(p.electron)
    expect(everyday.app.process().exitCode).toBeNull()

    // which is which
    await sandboxWin.window.getByRole('status', { name: 'This is the sandbox window' }).waitFor()
    expect(
      await sandboxWin.evaluateMain(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle()),
    ).toBe('kacola · sandbox')
    expect(await sandboxWin.window.title()).toBe('kacola · sandbox')
    expect(await everyday.window.title()).toBe('kacola')
    expect(await everyday.window.locator('[data-profile-badge]').count()).toBe(0)

    // each window shows its own daemon's day
    const today = sandboxWin.window.getByRole('list', { name: 'Today’s meetings' })
    await today.getByText('Intro call with Sam').first().waitFor({ timeout: 20_000 })
    await today.getByText('Prototype feedback with the PM').first().waitFor()
    await everyday.window.getByText('Everyday meeting').first().waitFor({ timeout: 20_000 })
    expect(await everyday.window.getByText('Intro call with Sam').count()).toBe(0)

    await sandboxWin.window.emulateMedia({ reducedMotion: 'reduce' })
    await sandboxWin.screenshot(join(DESKTOP_ARTIFACTS, 'sandbox-window.png'))
    expect(sandboxWin.problems()).toEqual([])
    expect(everyday.problems()).toEqual([])
  }, 180_000)

  it('start opens it by itself (here: in the headless Shell), and stop closes it', async () => {
    await sandboxWin?.close()
    sandboxWin = undefined
    expect(sandbox('stop').status).toBe(0)
    // as the user runs it, on this display: the build, the separate profile, the detached window
    const r = run(display.env, [
      'start',
      '--port',
      String(await freePort()),
      '--share-port',
      String(await freePort()),
    ])
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain('"kacola · sandbox" (a separate window; your everyday one is untouched)')
    const st = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as { pids: { window?: number } }
    expect(st.pids.window).toBeGreaterThan(0)
    const log = join(dir, 'logs', 'window.log')
    const end = Date.now() + 30_000
    while (!(existsSync(log) && readFileSync(log, 'utf8').includes('"event":"window-ready"'))) {
      if (Date.now() > end)
        throw new Error(`the sandbox window never got ready:\n${readFileSync(log, 'utf8')}`)
      await new Promise((res) => setTimeout(res, 200))
    }
    expect(readFileSync(log, 'utf8')).toMatch(/"event":"daemon","kind":"attached"/)
    // the everyday window is still the one it was
    expect(everyday!.app.process().exitCode).toBeNull()
    expect(await everyday!.window.title()).toBe('kacola')

    const stop = sandbox('stop')
    expect(stop.status, stop.stdout + stop.stderr).toBe(0)
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }
    expect(alive(st.pids.window!)).toBe(false)
    expect(everyday!.app.process().exitCode).toBeNull()
  }, 180_000)
})
