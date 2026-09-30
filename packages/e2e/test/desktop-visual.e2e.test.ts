import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { makeSession, type StubDaemon, startStubDaemon } from '@gnomeola/testkit/stub-daemon'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseline, markOnboarded, setTheme, uiStatePath } from '../src/desktop.ts'

// Screenshot baselines (light / dark at 360 / 800 / 1280 px) and the axe gate in light, dark and high
// contrast, for the main window, the primitives gallery, Preferences and onboarding. Baselines live in
// test/__screenshots__/desktop/ (GNOMEOLA_UPDATE_SCREENSHOTS=1 re-records them after a deliberate
// design change; a missing one is recorded). Data is fixed so the pictures are: the protocol stub
// with sessions dated long ago (no "5 min ago"), a daemon with no sessions for the dialogs.

const WIDTHS = [360, 800, 1280] as const
const SCHEMES = ['light', 'dark'] as const
const HEIGHT = 760

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

/** axe in light, dark and high contrast (both schemes) on whatever is on screen. */
async function axeAllModes(app: DesktopApp): Promise<string[]> {
  const out: string[] = []
  for (const [scheme, contrast] of [
    ['light', 'normal'],
    ['dark', 'normal'],
    ['light', 'high'],
    ['dark', 'high'],
  ] as const) {
    await setTheme(app, scheme, contrast)
    out.push(...(await app.axe()).map((v) => `[${scheme}/${contrast}] ${v}`))
  }
  await setTheme(app, 'light')
  return out
}

async function matrix(app: DesktopApp, name: string, widths: readonly number[] = WIDTHS): Promise<string[]> {
  const failures: string[] = []
  for (const w of widths) {
    await app.window.setViewportSize({ width: w, height: HEIGHT })
    for (const s of SCHEMES) {
      await setTheme(app, s)
      const f = await baseline(app, `${name}-${s}-${w}`)
      if (f) failures.push(f)
    }
  }
  await setTheme(app, 'light')
  await app.window.setViewportSize({ width: 1280, height: HEIGHT })
  return failures
}

describe('main window and gallery (protocol stub, fixed data)', () => {
  let stub: StubDaemon
  let app: DesktopApp

  beforeAll(async () => {
    const at = (d: string, min: number) => ({
      createdAt: d,
      startedAt: d,
      endedAt: d,
      durationMs: min * 60_000,
    })
    stub = await startStubDaemon([
      makeSession('Sprint retro', at('2025-03-04T15:00:00.000Z', 20)),
      makeSession('Platform standup', at('2025-03-11T09:30:00.000Z', 12)),
      makeSession('Design review: onboarding flow', at('2025-03-12T13:00:00.000Z', 30)),
      makeSession('HR 1:1', { ...at('2025-03-13T10:00:00.000Z', 25), private: true }),
    ])
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: stub.url, GNOMEOLA_COLOR_SCHEME: 'light' } })
    await app.window.getByRole('listbox', { name: 'Sessions' }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await stub?.close()
  })

  it('main window, nothing selected', async () => {
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'main')).toEqual([])
  })

  it('main window, a session’s Details', async () => {
    await app.window.getByRole('option', { name: /Design review/ }).click()
    await app.window.getByRole('tab', { name: 'Details' }).click()
    await app.window.getByRole('region', { name: 'Details' }).waitFor()
    // leave the tab's focus ring out of the picture
    await app.window.evaluate('document.activeElement?.blur()')
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'session-details', [800, 1280])).toEqual([])
    expect(app.problems()).toEqual([])
  })

  it('the primitives gallery', async () => {
    await app.window.evaluate(`location.hash = '#/gallery'`)
    await app.window.getByRole('region', { name: 'Buttons', exact: true }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'gallery')).toEqual([])
    // the whole page, not just the first screen: one tall capture per scheme
    await app.window.setViewportSize({ width: 1280, height: 4200 })
    for (const s of SCHEMES) {
      await setTheme(app, s)
      expect(await baseline(app, `gallery-full-${s}`)).toBeNull()
    }
    await setTheme(app, 'light')
    await app.window.setViewportSize({ width: 1280, height: HEIGHT })
    // open states: a dialog and a menu are part of the gallery too
    await app.window.getByRole('button', { name: 'Open dialog' }).click()
    await app.window.getByRole('dialog', { name: 'Speakers' }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    await app.window.keyboard.press('Escape')
    await app.window.getByRole('dialog', { name: 'Speakers' }).waitFor({ state: 'detached' })
    await app.window.getByRole('button', { name: 'Open menu' }).click()
    await app.window.getByRole('menuitem', { name: 'Rename' }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    await app.window.keyboard.press('Escape')
    expect(app.problems()).toEqual([])
  })
})

describe('Preferences and onboarding (real daemon, no sessions)', () => {
  let daemon: DaemonHandle

  beforeAll(async () => {
    daemon = await startDaemon({ entry: join(import.meta.dirname, '..', 'src', 'slow-models-daemon.ts') })
  })

  afterAll(async () => {
    await daemon?.stop()
  })

  it('Preferences, each page', async () => {
    markOnboarded(display)
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    try {
      await app.window.getByText('No Sessions Yet').waitFor({ timeout: 20_000 })
      await app.window.keyboard.press('Control+,')
      const prefs = app.window.getByRole('dialog', { name: 'Preferences' })
      await prefs.getByRole('region', { name: 'Questions and Answers' }).waitFor()
      await app.window.evaluate('document.activeElement?.blur()')
      expect(await axeAllModes(app)).toEqual([])
      expect(await matrix(app, 'preferences')).toEqual([])
      await prefs.getByRole('tab', { name: 'Storage' }).click()
      await prefs.getByRole('region', { name: 'Recorded Audio' }).waitFor()
      expect(await axeAllModes(app)).toEqual([])
      await prefs.getByRole('tab', { name: 'Integration' }).click()
      await prefs.getByText(/Lets agents like Claude Code|Installed at/).waitFor({ timeout: 20_000 })
      expect(await axeAllModes(app)).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('onboarding', async () => {
    const { rmSync } = await import('node:fs')
    rmSync(uiStatePath(display), { force: true })
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    try {
      const welcome = app.window.getByRole('dialog', { name: 'Welcome to gnomeola' })
      await welcome.getByText('Available (fake)').waitFor({ timeout: 20_000 })
      await welcome.getByText(/Lets agents like Claude Code/).waitFor({ timeout: 20_000 })
      await app.window.evaluate('document.activeElement?.blur()')
      expect(await axeAllModes(app)).toEqual([])
      expect(await matrix(app, 'onboarding')).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      markOnboarded(display)
    }
  })
})
