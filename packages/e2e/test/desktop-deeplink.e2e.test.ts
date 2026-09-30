import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatAgendaLink } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import {
  buildDesktop,
  type DesktopApp,
  launchDesktop,
  launchSecondInstance,
  waitForLog,
} from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/desktop.ts'

// kacola:// deep links into the Electron app, main's half (docs/desktop-app.md, "Deep links"): the link
// the app is started with, one a second launch hands over (the desktop file's %U, a clicked link), and
// arguments that are not ours. Main logs {"event":"deep-link"} when it accepts a link and
// {"event":"deep-link-delivered"} when the renderer has it (takeDeepLink(), or the onDeepLink push).

let display: HeadlessDisplay
let markerId = ''

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
  markOnboarded(display)
}, 240_000)

afterAll(async () => {
  if (!display) return
  await display.close()
  expect(markedPids(markerId)).toEqual([])
})

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const received = (url: string) => new RegExp(`"event":"deep-link","url":"${esc(url)}"`)
const delivered = (url: string) => new RegExp(`"event":"deep-link-delivered","url":"${esc(url)}"`)
const lines = (app: DesktopApp, re: RegExp) =>
  app
    .log()
    .split('\n')
    .filter((l) => re.test(l))
const deepLinkLines = (app: DesktopApp) => lines(app, /"event":"deep-link/)

/** What the page's onDeepLink subscription (installed by the test) has seen. */
const pushed = (app: DesktopApp) => app.window.evaluate('globalThis.__links ?? []') as Promise<string[]>

describe('kacola:// links against the real daemon', () => {
  let daemon: DaemonHandle
  let app: DesktopApp
  let agendaUrl = ''
  const env = () => ({ GNOMEOLA_URL: daemon.baseUrl })

  beforeAll(async () => {
    daemon = await startDaemon()
    const v = await daemon.client.call('createAgenda', { body: { title: 'Deep link sync' } })
    agendaUrl = formatAgendaLink(v.agenda.id)
    // COLD: the app is started with the link (the desktop file's Exec=… %U)
    app = await launchDesktop({ display, env: env(), args: [agendaUrl] })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
  })

  it('cold start: main accepts the link from argv and hands it to the renderer once', async () => {
    // the page takes the link it was opened with. Until the renderer does that on boot, the test does it;
    // once it does, the link is already taken here (null) and the delivered line below is the proof.
    const taken = (await app.window.evaluate('window.gnomeola.takeDeepLink()')) as string | null
    if (taken !== null) expect(taken).toBe(agendaUrl)
    await waitForLog(app, delivered(agendaUrl))
    // the renderer resolved it (resolveAgendaLink) and shows the agenda
    await app.window.getByRole('heading', { level: 1, name: 'Deep link sync' }).waitFor({ timeout: 15_000 })
    expect(await app.window.evaluate('location.hash')).toMatch(/^#\/agendas\/agd_/)
    // (main's {"event":"deep-link"} line for the argv link is written right after ready, before
    // launchDesktop's stdout listener exists — like the first daemon lines — so the delivered line and
    // the taken URL are what this start can prove; the warm cases below see both lines)
    expect(lines(app, delivered(agendaUrl))).toHaveLength(1)
    // taken once: a second take has nothing
    expect(await app.window.evaluate('window.gnomeola.takeDeepLink()')).toBeNull()
    // dev on Linux never registers the scheme with xdg-settings (GNOMEOLA_REGISTER_SCHEME unset)
    const mimeapps = join(display.env.XDG_CONFIG_HOME!, 'mimeapps.list')
    expect(existsSync(mimeapps) ? readFileSync(mimeapps, 'utf8') : '').not.toContain('kacola')
  })

  it('warm: a second launch with a link hands it to the running window and exits', async () => {
    await app.window.evaluate(
      'window.gnomeola.onDeepLink((u) => { globalThis.__links = [...(globalThis.__links ?? []), u] })',
    )
    const v = await daemon.client.call('createAgenda', { body: { title: 'Warm sync' } })
    const url = formatAgendaLink(v.agenda.id)
    const t0 = Date.now()
    const second = await launchSecondInstance({ display, env: env(), args: [url] })
    expect(second.exitCode, second.output).toBe(0)
    expect(Date.now() - t0).toBeLessThan(10_000)
    await waitForLog(app, delivered(url))
    expect(lines(app, received(url))).toHaveLength(1)
    await expect.poll(() => pushed(app)).toEqual([url])
    await app.window.getByRole('heading', { level: 1, name: 'Warm sync' }).waitFor({ timeout: 15_000 })
    // pushed, so nothing is left to take
    expect(await app.window.evaluate('window.gnomeola.takeDeepLink()')).toBeNull()
  })

  it('arguments that are not agenda / meeting links are ignored', async () => {
    const before = deepLinkLines(app).length
    for (const bad of [
      'kacola://evil/../x',
      'https://example.com/kacola://agenda/x',
      'kacola://agenda/../x',
    ]) {
      const second = await launchSecondInstance({ display, env: env(), args: [bad] })
      expect(second.exitCode, second.output).toBe(0)
    }
    // the last launch's (window-only) handling is done once the window is there and focused again
    await new Promise((r) => setTimeout(r, 1000))
    expect(deepLinkLines(app).slice(before)).toEqual([])
    expect(await pushed(app)).toHaveLength(1)
    expect(await app.window.evaluate('window.gnomeola.takeDeepLink()')).toBeNull()
  })

  it('a link re-opens a closed window, even with --background; the new page takes it', async () => {
    await app.window.close()
    await waitFor(
      async () => (await app.evaluateMain(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 0,
      10_000,
      'the window to close',
    )
    const v = await daemon.client.call('createAgenda', { body: { title: 'Reopened sync' } })
    const url = formatAgendaLink(v.agenda.id)
    const opened = app.app.waitForEvent('window', { timeout: 20_000 })
    const second = await launchSecondInstance({ display, env: env(), args: ['--background', url] })
    expect(second.exitCode, second.output).toBe(0)
    const page = await opened
    await page.waitForLoadState('domcontentloaded')
    await waitForLog(app, received(url))
    // the new renderer has not taken yet: the link waits for it (never pushed into the void)
    const taken = (await page.evaluate('window.gnomeola.takeDeepLink()')) as string | null
    if (taken !== null) expect(taken).toBe(url)
    await waitForLog(app, delivered(url))
    await page.getByRole('heading', { level: 1, name: 'Reopened sync' }).waitFor({ timeout: 15_000 })
    expect(lines(app, delivered(url))).toHaveLength(1)
    expect(app.problems()).toEqual([])
  })
})
