import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
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
const sandbox = (...args: string[]) =>
  spawnSync(process.execPath, [join(REPO, 'scripts', 'sandbox.ts'), '--dir', dir, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', TYPESAFE_API_KEY: '' },
  })

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
})
