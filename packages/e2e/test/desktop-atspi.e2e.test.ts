import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import {
  type AccessibleNode,
  flatten,
  formatTree,
  type HeadlessDisplay,
  markedPids,
  startHeadlessDisplay,
} from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DESKTOP_ARTIFACTS, markOnboarded } from '../src/desktop.ts'
import { seedMeetings } from '../src/seed.ts'

// One AT-SPI smoke test: what Orca would see. Playwright and axe read Chromium's DOM accessibility
// tree; this reads the platform one — Chromium's AT-SPI bridge on the headless session's private
// accessibility bus — through the same driver the GTK suites used (packages/testkit/src/ui), to show the
// window's controls reach a screen reader named, with their roles and states, and follow the window.
// (Role names are at-spi2-core's: "button", "entry", "list box", "page tab", …)

const INTERACTIVE = new Set([
  'button',
  'push button',
  'toggle button',
  'check box',
  'radio button',
  'entry',
  'combo box',
  'list item',
  'menu item',
  'page tab',
  'slider',
  'spin button',
  'link',
  'switch',
])

describe('desktop window on the accessibility bus (AT-SPI)', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string
  let markerId = ''
  let appName = ''

  const find = (role: string, name: string, within?: AccessibleNode) =>
    display.findOne({ app: appName, role, name, within }, 15_000)
  const unnamed = async () => {
    const out: string[] = []
    const visit = (n: AccessibleNode) => {
      if (INTERACTIVE.has(n.role) && n.states.includes('showing') && n.name.trim() === '')
        out.push(`${n.role} (ref ${n.ref})`)
      for (const c of n.children ?? []) visit(c)
    }
    const tree = await display.accessibleTree({ app: appName })
    for (const root of tree) visit(root)
    return { out, tree }
  }

  beforeAll(async () => {
    buildDesktop()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-atspi-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
    await app.window.getByRole('listbox', { name: 'Sessions' }).waitFor({ timeout: 20_000 })
  }, 240_000)

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('registers on the accessibility bus when a screen reader asks for it', async () => {
    // what starting Orca does on a real desktop: Chromium builds its platform accessibility tree once
    // assistive technology is present; Electron exposes the same switch
    await app.evaluateMain(({ app: a }) => a.setAccessibilitySupportEnabled(true))
    appName = await display.waitFor(
      async () => (await display.applications()).find((n) => /electron|gnomeola|kacola/i.test(n)),
      20_000,
      'the window on the accessibility bus',
    )
  })

  it('exposes the main window’s controls named, with their roles', async () => {
    await find('frame', 'Gnomeola')
    await find('button', 'Record')
    await find('button', 'Main menu')
    await find('entry', 'Search sessions')
    const list = await find('list box', 'Sessions')
    const rows = await display.find({ app: appName, within: list, role: 'list item' })
    expect(rows.map((r) => r.name)).toEqual([
      expect.stringMatching(/^HR 1:1 .* Private$/),
      expect.stringMatching(/^Quarterly planning /),
      expect.stringMatching(/^Platform standup /),
      expect.stringMatching(/^Sprint retro /),
    ])
    await find('heading', 'No Session Selected')
    const { out, tree } = await unnamed()
    writeFileSync(join(DESKTOP_ARTIFACTS, 'atspi-main.txt'), formatTree(tree))
    expect(out).toEqual([])
  })

  it('follows the window: a selected session, its tabs, and the pane Orca lands in', async () => {
    await app.window
      .getByRole('listbox', { name: 'Sessions' })
      .getByRole('option', { name: /Platform standup/ })
      .click()
    await app.window.getByRole('heading', { level: 1, name: 'Platform standup' }).waitFor()
    const row = await display.findOne(
      { app: appName, role: 'list item', nameContains: 'Platform standup', states: ['selected'] },
      15_000,
    )
    expect(row.states).toContain('selected')
    await find('heading', 'Platform standup')
    for (const t of ['Transcript', 'Ask', 'Notes', 'Details']) await find('page tab', t)
    const transcript = await find('page tab', 'Transcript')
    expect(transcript.states).toContain('selected')
    // the transcript lines are a list box of named options, as in the DOM
    const lines = await find('list box', 'Transcript')
    const first = await display.find({ app: appName, within: lines, role: 'list item', limit: 3 })
    expect(first.map((l) => l.name)).toContain('Me at 0:05: Morning. Quick round, then the retry question.')
    // the search field is an editable, focusable single-line entry (what Orca announces as "edit")
    const search = await find('entry', 'Search sessions')
    expect(search.states).toEqual(expect.arrayContaining(['editable', 'focusable', 'single-line', 'showing']))
    // (the platform "focused" state is not asserted: in the headless Shell neither CDP key events nor
    // RemoteDesktop keys give the window a platform focus Chromium reports — see docs/desktop-app.md)
    const { out, tree } = await unnamed()
    writeFileSync(join(DESKTOP_ARTIFACTS, 'atspi-session.txt'), formatTree(tree))
    expect(out).toEqual([])
    expect(flatten(tree).length).toBeGreaterThan(40)
    expect(app.problems()).toEqual([])
  })
})
