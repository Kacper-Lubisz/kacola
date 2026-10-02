import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop, waitForDaemon } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, pngInfo, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/desktop.ts'

// E-V1 smoke: the Electron window (built app, Playwright `_electron`) inside the headless GNOME Shell,
// against the real daemon. Role + name locators throughout — the contract the ported AT-SPI suites
// will keep.

const ARTIFACTS = join(import.meta.dirname, '__artifacts__', 'desktop')

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })

let display: HeadlessDisplay
let markerId = ''

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
  // first-run onboarding (the fake daemon lacks a model) is desktop-dialogs' subject, not this file's
  markOnboarded(display)
}, 240_000)

afterAll(async () => {
  if (!display) return
  await display.close()
  expect(markedPids(markerId)).toEqual([])
})

describe('desktop window against a running daemon', () => {
  let daemon: DaemonHandle
  let app: DesktopApp

  beforeAll(async () => {
    daemon = await startDaemon()
    await daemon.client.call('createSession', { body: { title: 'Weekly product sync' } })
    await daemon.client.call('createSession', { body: { title: 'Design review: onboarding flow' } })
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
  })

  it('opens a window that attaches to the daemon and renders its meetings on home', async () => {
    await waitForDaemon(app, 'attached')
    const today = app.window.getByRole('list', { name: 'Today’s meetings' })
    await today.waitFor({ timeout: 20_000 })
    // latest first: the one created last is on top
    const names = await today
      .getByRole('button')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
    expect(names).toEqual([
      expect.stringContaining('Design review: onboarding flow'),
      expect.stringContaining('Weekly product sync'),
    ])
    await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor()
    expect(await app.window.title()).toBe('kacola')
    expect(await app.axe()).toEqual([]) // home: search box + the day
  })

  it('shows a session started over HTTP live, through the EventBridge', async () => {
    const today = app.window.getByRole('list', { name: 'Today’s meetings' })
    const s = await daemon.client.call('createSession', { body: { title: 'Started from the CLI' } })
    await daemon.client.call('startSession', { params: { id: s.id } })
    // under way: in its place on the day, highlighted, with its clock
    const pinned = today.getByRole('region', { name: 'Recording now: Started from the CLI' })
    await pinned.getByRole('timer', { name: /^Recording/ }).waitFor({ timeout: 10_000 })
    // opening it routes to its live page
    await pinned.getByRole('button', { name: 'Open Started from the CLI' }).click()
    await app.window.getByRole('heading', { level: 1, name: 'Started from the CLI' }).waitFor()
    await app.window.getByRole('timer', { name: /^Recording/ }).waitFor()
    await daemon.client.call('stopSession', { params: { id: s.id } })
    // the page moves on to its outcome by itself
    await app.window.getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 10_000 })
  })

  it('has no axe violations on the outcome screen', async () => {
    expect(await app.axe()).toEqual([])
  })

  it('captures a screenshot (Chromium render and the compositor)', async () => {
    const page = await app.screenshot(join(ARTIFACTS, 'main-light.png'))
    const info = pngInfo(page)
    expect(info.width).toBeGreaterThan(600)
    expect(info.bytes).toBeGreaterThan(10_000) // more than a flat colour
    const screen = await display.screenshot(join(ARTIFACTS, 'screen-light.png'))
    expect(pngInfo(screen)).toMatchObject({ width: 1280, height: 800 })
  })

  it('keeps the renderer sandboxed: no Node, no network, only the bridge', async () => {
    // page-side code as a string: this package compiles without the DOM lib
    const r = (await app.window.evaluate(`(async () => {
      let fetched = 'blocked'
      try { await fetch(${JSON.stringify(`${daemon.baseUrl}/health`)}); fetched = 'reached' } catch {}
      return {
        require: typeof window.require,
        process: typeof window.process,
        bridge: Object.keys(window.gnomeola).sort(),
        fetched,
        origin: location.origin,
      }
    })()`)) as { require: string; process: string; bridge: string[]; fetched: string; origin: string }
    expect(r).toMatchObject({ require: 'undefined', process: 'undefined', fetched: 'blocked' })
    expect(r.bridge).toContain('fetchStream')
    expect(r.bridge).not.toContain('ipcRenderer')
    expect(r.origin).toBe('app://gnomeola')
  })

  it('logged no console errors, page errors or CSP violations (except the probe above)', () => {
    const probe = `${daemon.baseUrl}/health`
    const unexpected = app.problems().filter((p) => !p.includes(probe))
    expect(unexpected).toEqual([])
    // the blocked fetch above was blocked by our CSP, not by luck
    expect(app.problems().some((p) => p.includes('Content Security Policy'))).toBe(true)
  })
})

describe('desktop window with no daemon running', () => {
  it('spawns one on Electron’s runtime, keeps it when the window closes, and stops it on quit', async () => {
    const port = await freePort()
    const dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-spawn-'))
    const url = `http://127.0.0.1:${port}`
    const app = await launchDesktop({
      display,
      env: {
        GNOMEOLA_URL: url,
        GNOMEOLA_DAEMON_ARGS: JSON.stringify(['--data-dir', dataDir]),
        GNOMEOLA_FAKES: '1',
        GNOMEOLA_KEYRING: 'memory',
        GNOMEOLA_CALENDAR: 'off',
        GNOMEOLA_DBUS: 'off',
        GNOMEOLA_MIC_ACTIVITY: 'off',
      },
    })
    try {
      await waitForDaemon(app, 'spawned')
      await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
      const health = await fetch(`${url}/health`)
      expect(health.ok).toBe(true)

      // closing the window leaves main and the daemon running
      await app.window.close()
      await new Promise((r) => setTimeout(r, 500))
      expect(await app.evaluateMain(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0)
      expect((await fetch(`${url}/health`)).ok).toBe(true)

      // a second launch (the desktop icon, the top-bar extension) re-opens the window in this instance
      const second = await launchDesktop({ display, env: { GNOMEOLA_URL: url }, window: false }).catch(
        (e: Error) => e,
      )
      if (!(second instanceof Error)) await second.close().catch(() => {})
      await waitFor(
        async () =>
          (await app.evaluateMain(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 1,
        10_000,
        'the first instance to re-open its window',
      )
    } finally {
      await app.close()
      rmSync(dataDir, { recursive: true, force: true })
    }
    // explicit quit stopped the daemon it had spawned
    await waitFor(
      async () => {
        try {
          await fetch(`${url}/health`)
          return false
        } catch {
          return true
        }
      },
      15_000,
      'the spawned daemon to stop',
    )
  }, 120_000)
})

describe('dark style', () => {
  it('follows the scheme main pushes (data-scheme + tokens)', async () => {
    const daemon = await startDaemon()
    await daemon.client.call('createSession', { body: { title: 'Night shift' } })
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'dark' },
    })
    try {
      await app.window.getByRole('list', { name: 'Today’s meetings' }).waitFor({ timeout: 20_000 })
      const r = await app.window.evaluate(`({
        scheme: document.documentElement.dataset.scheme,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        bg: getComputedStyle(document.body).backgroundColor,
      })`)
      expect(r).toEqual({ scheme: 'dark', colorScheme: 'dark', bg: 'rgb(23, 20, 17)' })
      expect(app.problems()).toEqual([])
      expect(await app.axe()).toEqual([])
      await app.screenshot(join(ARTIFACTS, 'main-dark.png'))
      // the primitives gallery, in dark: every primitive on the real tokens, accessible
      await app.window.evaluate(`location.hash = '#/gallery'`)
      await app.window.getByRole('region', { name: 'Buttons', exact: true }).waitFor()
      expect(await app.axe()).toEqual([])
      await app.screenshot(join(ARTIFACTS, 'gallery-dark.png'))
    } finally {
      await app.close()
      await daemon.stop()
    }
  }, 120_000)
})
