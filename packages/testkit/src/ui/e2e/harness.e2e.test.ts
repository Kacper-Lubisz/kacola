import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type HeadlessDisplay, markedPids, pngInfo, startHeadlessDisplay } from '../index.ts'

// The harness tested on its own, against a 60-line PyGObject app, so a failure here is the
// harness's fault and never GTKX's.

const ARTIFACTS = join(import.meta.dirname, '__artifacts__')
const APP = 'harness-fixture'

describe('headless display harness', () => {
  let d: HeadlessDisplay
  let id: string

  beforeAll(async () => {
    d = await startHeadlessDisplay({ size: '1024x768' })
    id = d.env.KACOLA_HEADLESS_ID!
    d.launchApp({ command: 'python3', args: [join(import.meta.dirname, 'fixture-app.py')] })
    await d.findOne({ app: APP, role: 'frame', name: 'Harness fixture' }, 20_000)
  })

  afterAll(async () => {
    await d?.close()
  })

  it('runs everything in a private session that cannot reach the real desktop', () => {
    const env = d.env
    for (const key of ['DBUS_SESSION_BUS_ADDRESS', 'DBUS_SYSTEM_BUS_ADDRESS', 'AT_SPI_BUS_ADDRESS']) {
      expect(env[key]).toMatch(new RegExp(`^unix:path=${d.tempDir}/`))
    }
    expect(env.XDG_RUNTIME_DIR!.startsWith(d.tempDir)).toBe(true)
    expect(env.HOME!.startsWith(d.tempDir)).toBe(true)
    expect(env.DISPLAY).toBeUndefined()
    expect(env.WAYLAND_DISPLAY).toBe('wayland-kacola')
    expect(env.GSETTINGS_BACKEND).toBe('keyfile')
    // and the processes really run with it: read the Shell's own environment back from /proc
    const pids = markedPids(id)
    expect(pids.length).toBeGreaterThanOrEqual(6) // 3 buses, registry, shell, driver, app
    const shellPid = pids.find((p) => readFileSync(`/proc/${p}/comm`, 'utf8').trim() === 'gnome-shell')
    expect(shellPid).toBeDefined()
    const shellEnv = readFileSync(`/proc/${shellPid}/environ`, 'latin1').split('\0')
    expect(shellEnv).toContain(`DBUS_SESSION_BUS_ADDRESS=unix:path=${d.tempDir}/run/bus`)
    expect(shellEnv).toContain(`DBUS_SYSTEM_BUS_ADDRESS=unix:path=${d.tempDir}/run/system_bus`)
    expect(shellEnv.some((e) => e.startsWith('DISPLAY='))).toBe(false)
  })

  it('lists the app on the accessibility bus next to the Shell', async () => {
    const apps = await d.applications()
    expect(apps).toContain('gnome-shell')
    expect(apps).toContain(APP)
  })

  it('finds widgets by role and accessible name, and clicks buttons through their action', async () => {
    const entry = await d.findOne({ app: APP, role: 'text', name: 'Name' })
    expect(entry.states).toContain('editable')
    await d.setText(entry, 'AT-SPI')
    const button = await d.findOne({ app: APP, role: 'button', name: 'Greet' })
    expect(await d.click(button)).toBe('action:click')
    await d.findOne({ app: APP, role: 'label', name: 'Hello, AT-SPI' })
  })

  it('types real keystrokes through the compositor into the focused widget', async () => {
    const entry = await d.findOne({ app: APP, role: 'text', name: 'Name' })
    await d.setText(entry, '')
    await d.focus(entry)
    await d.waitFor(async () => (await d.describe(entry)).states.includes('focused'), 5000, 'entry focus')
    await d.typeText('Keyboard 42!')
    await d.waitFor(async () => (await d.describe(entry)).text === 'Keyboard 42!', 5000, 'typed text')
    await d.pressKeys('Tab') // move focus to the button …
    await d.pressKeys('space') // … and press it with the keyboard
    await d.findOne({ app: APP, role: 'label', name: 'Hello, Keyboard 42!' })
  })

  it('selects list rows through the container', async () => {
    const row = await d.findOne({ app: APP, role: 'list item', name: 'Banana' })
    const via = await d.click(row)
    expect(via === 'selection' || via.startsWith('action:')).toBe(true)
    await d.findOne({ app: APP, role: 'label', name: 'Picked: Banana' })
    expect((await d.describe(row)).states).toContain('selected')
  })

  it('captures the virtual monitor as a PNG', async () => {
    const path = await d.screenshot(join(ARTIFACTS, 'harness-screen.png'))
    const info = pngInfo(path)
    expect(info).toMatchObject({ width: 1024, height: 768 })
    expect(info.bytes).toBeGreaterThan(20_000) // a wallpaper + window, not a flat fill
    const win = await d.screenshot(join(ARTIFACTS, 'harness-window.png'), { kind: 'window' })
    const w = pngInfo(win)
    expect(w.width).toBeLessThan(1024)
    expect(w.width).toBeGreaterThan(300)
  })

  it('close() kills every process it started and removes its temp dir', async () => {
    const tempDir = d.tempDir
    expect(markedPids(id).length).toBeGreaterThan(0)
    const { killedStragglers } = await d.close()
    expect(markedPids(id)).toEqual([])
    expect(existsSync(tempDir)).toBe(false)
    // stragglers are allowed only if the sweep caught them; report them so a regression is visible
    expect(Array.isArray(killedStragglers)).toBe(true)
  })
})
