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
// (Role names are at-spi2-core's: "button", "entry", "list", "list box", …)

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
      // a plain <li> is a "list item" too, but only a selectable one (a listbox option) is a control
      const control =
        INTERACTIVE.has(n.role) &&
        (n.role !== 'list item' || n.states.includes('selectable') || n.states.includes('focusable'))
      if (control && n.states.includes('showing') && n.name.trim() === '')
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
    await app.window.getByRole('list', { name: 'Today’s meetings' }).waitFor({ timeout: 20_000 })
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

  it('exposes home’s controls named, with their roles', async () => {
    await find('frame', 'kacola')
    await find('heading', 'Your day')
    await find('button', 'Record now')
    await find('button', 'Main menu')
    await find('entry', 'Search or ask')
    const list = await find('list', 'Today’s meetings')
    const rows = await display.find({ app: appName, within: list, role: 'button' })
    // each meeting is one named button: "<title>, <time>"
    expect(rows.map((r) => r.name.replace(/, \d\d:\d\d$/, '')).sort()).toEqual([
      'HR 1:1',
      'Platform standup',
      'Quarterly planning',
      'Sprint retro',
    ])
    const { out, tree } = await unnamed()
    writeFileSync(join(DESKTOP_ARTIFACTS, 'atspi-main.txt'), formatTree(tree))
    expect(out).toEqual([])
  })

  it('follows the window: a meeting’s outcome page, its transcript panel, and Back to Today', async () => {
    await app.window
      .getByRole('list', { name: 'Today’s meetings' })
      .getByRole('button', { name: /^Platform standup, / })
      .click()
    await app.window.getByRole('heading', { level: 1, name: 'Platform standup' }).waitFor()
    await find('heading', 'Platform standup')
    await find('button', 'Back to Today')
    await find('button', 'Share summary')
    await find('button', 'Meeting actions')
    // the notes are an editable entry (CodeMirror's content element)
    const notes = await find('entry', 'Notes')
    expect(notes.states).toEqual(expect.arrayContaining(['editable', 'focusable', 'showing']))
    // the transcript, on demand: a list box of named options beside the page, as in the DOM
    await app.window.keyboard.press('Control+t')
    await app.window.getByRole('listbox', { name: 'Transcript' }).waitFor()
    const lines = await find('list box', 'Transcript')
    const first = await display.find({ app: appName, within: lines, role: 'list item', limit: 3 })
    expect(first.map((l) => l.name)).toContain('Me at 0:05: Morning. Quick round, then the retry question.')
    // (the platform "focused" state is not asserted: in the headless Shell neither CDP key events nor
    // RemoteDesktop keys give the window a platform focus Chromium reports — see docs/desktop-app.md)
    const { out, tree } = await unnamed()
    writeFileSync(join(DESKTOP_ARTIFACTS, 'atspi-session.txt'), formatTree(tree))
    expect(out).toEqual([])
    expect(flatten(tree).length).toBeGreaterThan(40)
    await app.window.getByRole('button', { name: 'Back to Today' }).click()
    // home again: the search field is an editable, focusable single-line entry (Orca's "edit")
    const search = await find('entry', 'Search or ask')
    expect(search.states).toEqual(expect.arrayContaining(['editable', 'focusable', 'single-line', 'showing']))
    expect(app.problems()).toEqual([])
  })
})
