import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DESKTOP_ARTIFACTS, uiStatePath } from '../src/desktop.ts'
import {
  type FakeShellState,
  initialFakeShell,
  installFakeShellTools,
  readFakeShell,
  writeFakeShell,
} from '../src/fake-shell-extensions.ts'

// The one-click top-bar extension, end to end in the Electron window.
//
// Part 1, a real GNOME Shell 50 (the private headless one — never the user's): the sidebar card offers
// Install & Enable; pressing it copies the extension into the session's XDG_DATA_HOME, asks the Shell to
// enable it (it does not know it yet: the Shell reads extensions at start-up) and queues it in
// enabled-extensions, and the card says to log out and back in. Then a NEW Shell is started on the same
// files and settings — the next login — and the extension is running; Disable, Enable, every user
// extension switched off (the question first, then all back on) and Remove go through the real Shell.
//
// Part 2, the states a real Shell will not produce on demand, from fake gdbus / gsettings /
// gnome-extensions on PATH (fake-shell-extensions.ts): an older copy (Update), a crashed extension
// (Try Again), X11's copy, the Flatpak's command, and no GNOME at all (nothing shown).

const EXT = 'gnomeola@gnomeola.org'
const REPO_EXT = join(import.meta.dirname, '..', '..', '..', 'extensions', EXT)
const BUNDLED = JSON.parse(readFileSync(join(REPO_EXT, 'metadata.json'), 'utf8'))['version-name'] as string

const gsettings = (d: HeadlessDisplay, ...args: string[]) =>
  execFileSync('gsettings', args, { env: d.env, encoding: 'utf8' }).trim()
const shellInfo = (d: HeadlessDisplay) =>
  execFileSync(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      'org.gnome.Shell',
      '--object-path',
      '/org/gnome/Shell',
      '--method',
      'org.gnome.Shell.Extensions.GetExtensionInfo',
      EXT,
    ],
    { env: d.env, encoding: 'utf8' },
  ).trim()

/** ui-state.json: onboarded, the card not dismissed (unless asked). */
function onboarded(d: HeadlessDisplay, extra: Record<string, unknown> = {}) {
  mkdirSync(join(d.env.XDG_STATE_HOME!, 'gnomeola'), { recursive: true })
  writeFileSync(
    uiStatePath(d),
    JSON.stringify({ version: 1, onboardingDone: true, skippedMissing: ['whisper-small.en'], ...extra }),
  )
}

const card = (app: DesktopApp) => app.window.getByRole('region', { name: 'Top-bar extension' })
const prefs = (app: DesktopApp) => app.window.getByRole('dialog', { name: 'Preferences' })
async function openIntegration(app: DesktopApp) {
  await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
  await app.window.keyboard.press('Control+,')
  await prefs(app).getByRole('tab', { name: 'Integration' }).click()
  const row = prefs(app).getByText('Top-bar extension', { exact: true }).locator('../..')
  await row.waitFor()
  return row
}
async function closePrefs(app: DesktopApp) {
  await prefs(app).getByRole('button', { name: 'Close' }).click()
  await prefs(app).waitFor({ state: 'detached' })
}
/** The window regains focus (as after logging back in or using GNOME Extensions). */
const refocus = (app: DesktopApp) => app.window.evaluate(`window.dispatchEvent(new Event('focus'))`)

let daemon: DaemonHandle
let dataDir = ''

beforeAll(async () => {
  buildDesktop()
  dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-ext-'))
  daemon = await startDaemon({ dataDir })
}, 240_000)

afterAll(async () => {
  await daemon?.stop()
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

describe('against a real GNOME Shell (private, headless)', () => {
  let first: HeadlessDisplay
  let second: HeadlessDisplay | undefined
  afterAll(async () => {
    for (const d of [first, second]) {
      if (!d) continue
      const id = d.env.GNOMEOLA_HEADLESS_ID!
      await d.close()
      expect(markedPids(id)).toEqual([])
    }
  })

  it('Install & Enable from the sidebar card: installed, queued, and the card says to log in again', async () => {
    first = await startHeadlessDisplay({ size: '1280x800' })
    onboarded(first)
    expect(shellInfo(first)).toBe('(@a{sv} {},)')
    const app = await launchDesktop({ display: first, env: { GNOMEOLA_URL: daemon.baseUrl } })
    try {
      await card(app).waitFor({ timeout: 20_000 })
      await card(app)
        .getByText('Shows the recording state and the next meeting in the GNOME top bar')
        .waitFor()
      expect(await app.axe()).toEqual([])
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-card-install.png'))
      await card(app).getByRole('button', { name: 'Install & Enable' }).click()
      await card(app).getByText('Installed — log out and back in to turn it on').waitFor({ timeout: 20_000 })
      expect(
        await card(app)
          .getByRole('button', { name: /Install|Enable/ })
          .count(),
      ).toBe(0)
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-card-relogin.png'))
      const dest = join(first.env.XDG_DATA_HOME!, 'gnome-shell', 'extensions', EXT)
      for (const f of ['metadata.json', 'extension.js', 'model.js', 'schemas/gschemas.compiled'])
        expect(existsSync(join(dest, f)), f).toBe(true)
      // the running Shell still does not know it; the next login will start it
      expect(shellInfo(first)).toBe('(@a{sv} {},)')
      expect(gsettings(first, 'get', 'org.gnome.shell', 'enabled-extensions')).toContain(`'${EXT}'`)
      // Preferences says the same
      const row = await openIntegration(app)
      await row.getByText('Installed — log out and back in to turn it on').waitFor()
      await closePrefs(app)
      // dismissed, for good
      await card(app).getByRole('button', { name: 'Dismiss' }).click()
      await card(app).waitFor({ state: 'detached' })
      await waitFor(
        () => JSON.parse(readFileSync(uiStatePath(first), 'utf8')).extensionCardDismissed === true,
        5000,
        'the dismissal in ui-state.json',
      )
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('after logging in again it runs; Disable, Enable, extensions off in GNOME, and Remove through the Shell', async () => {
    // the next login: a new Shell on the same extensions directory, settings and app state
    second = await startHeadlessDisplay({
      size: '1280x800',
      prepare: (dirs) => {
        cpSync(join(first.dirs.data, 'gnome-shell'), join(dirs.data, 'gnome-shell'), { recursive: true })
        cpSync(join(first.dirs.config, 'glib-2.0'), join(dirs.config, 'glib-2.0'), { recursive: true })
        cpSync(join(first.dirs.state, 'gnomeola'), join(dirs.state, 'gnomeola'), { recursive: true })
      },
    })
    const d = second
    await waitFor(() => /'state': <1\.0>/.test(shellInfo(d)), 20_000, 'the Shell to start the extension')
    await d.screenshot(join(DESKTOP_ARTIFACTS, 'extension-running-topbar.png'))
    const app = await launchDesktop({ display: d, env: { GNOMEOLA_URL: daemon.baseUrl } })
    try {
      await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
      // on, and the card was dismissed anyway
      expect(await card(app).count()).toBe(0)
      const row = await openIntegration(app)
      await row.getByText('On — showing in the GNOME top bar').waitFor({ timeout: 20_000 })
      await row.getByText('On', { exact: true }).waitFor()
      expect(await app.axe()).toEqual([])
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-row-on.png'))

      await row.getByRole('button', { name: 'Disable' }).click()
      await row.getByText('Installed, but turned off').waitFor({ timeout: 10_000 })
      expect(shellInfo(d)).toContain("'enabled': <false>")
      await row.getByRole('button', { name: 'Enable' }).click()
      await row.getByText('On — showing in the GNOME top bar').waitFor({ timeout: 10_000 })
      await waitFor(() => /'state': <1\.0>/.test(shellInfo(d)), 10_000, 'running again')

      // every user extension switched off in GNOME (GNOME Extensions' main switch); the window re-checks
      gsettings(d, 'set', 'org.gnome.shell', 'disable-user-extensions', 'true')
      await refocus(app)
      await row.getByText('Installed, but extensions are turned off in GNOME').waitFor({ timeout: 10_000 })
      await row.getByRole('button', { name: 'Enable' }).click()
      const ask = app.window.getByRole('alertdialog', { name: 'Turn On GNOME Extensions?' })
      await ask.getByText(/turns extensions back on, including any others you have enabled/).waitFor()
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-ask-user-extensions.png'))
      await ask.getByRole('button', { name: 'Turn On Extensions' }).click()
      await row.getByText('On — showing in the GNOME top bar').waitFor({ timeout: 10_000 })
      expect(gsettings(d, 'get', 'org.gnome.shell', 'disable-user-extensions')).toBe('false')
      await waitFor(() => /'state': <1\.0>/.test(shellInfo(d)), 10_000, 'running after extensions came back')

      await row.getByRole('button', { name: 'Remove' }).click()
      const confirm = app.window.getByRole('alertdialog', { name: 'Remove the Top-Bar Extension?' })
      await confirm.getByRole('button', { name: 'Remove' }).click()
      await row.getByRole('button', { name: 'Install & Enable' }).waitFor({ timeout: 10_000 })
      expect(existsSync(join(d.env.XDG_DATA_HOME!, 'gnome-shell', 'extensions', EXT))).toBe(false)
      expect(shellInfo(d)).toBe('(@a{sv} {},)')
      expect(gsettings(d, 'get', 'org.gnome.shell', 'enabled-extensions')).not.toContain(EXT)
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })
})

describe('the states a real Shell will not show on demand (fake gdbus / gsettings / gnome-extensions)', () => {
  let display: HeadlessDisplay
  let tools = ''
  let statePath = ''
  let path = ''
  beforeAll(async () => {
    display = await startHeadlessDisplay({ size: '1280x800' })
    tools = mkdtempSync(join(tmpdir(), 'gnomeola-fake-shell-'))
    statePath = join(tools, 'state.json')
  }, 120_000)
  afterAll(async () => {
    if (display) {
      const id = display.env.GNOMEOLA_HEADLESS_ID!
      await display.close()
      expect(markedPids(id)).toEqual([])
    }
    if (tools) rmSync(tools, { recursive: true, force: true })
  })

  const extDir = () => join(display.env.XDG_DATA_HOME!, 'gnome-shell', 'extensions')
  /** A copy on disk with this version name and these files changed; the fake Shell loaded it. */
  function installed(version: string, o: Partial<FakeShellState> = {}) {
    const dest = join(extDir(), EXT)
    rmSync(dest, { recursive: true, force: true })
    cpSync(REPO_EXT, dest, { recursive: true })
    const meta = readFileSync(join(dest, 'metadata.json'), 'utf8')
    writeFileSync(
      join(dest, 'metadata.json'),
      meta.replace(`"version-name": "${BUNDLED}"`, `"version-name": "${version}"`),
    )
    path = installFakeShellTools(
      join(tools, 'bin'),
      statePath,
      initialFakeShell({
        extensionsDir: extDir(),
        enabledExtensions: [EXT],
        loaded: { [EXT]: { version, type: 2 } },
        ...o,
      }),
    )
  }
  const launch = (env: Record<string, string> = {}) =>
    // the window stays on this Wayland display even when the session is said to be X11
    launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, PATH: path, ...env },
      args: ['--ozone-platform=wayland'],
    })

  it('an older copy: Update copies the new one; the running Shell keeps the old code until the next login', async () => {
    installed('0.0.9')
    onboarded(display)
    const app = await launch()
    try {
      await card(app)
        .getByText(`Version 0.0.9 is installed; this app comes with ${BUNDLED}`)
        .waitFor({ timeout: 20_000 })
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-card-update.png'))
      await card(app).getByRole('button', { name: 'Update' }).click()
      await card(app)
        .getByText('Updated — log out and back in to use the new version')
        .waitFor({ timeout: 20_000 })
      expect(readFileSync(join(extDir(), EXT, 'metadata.json'), 'utf8')).toContain(
        `"version-name": "${BUNDLED}"`,
      )
      // the next login (the fake Shell restarts with the new copy): on, and the card goes
      const s = readFakeShell(statePath)
      writeFakeShell(statePath, { ...s, owner: ':1.999', loaded: { [EXT]: { version: BUNDLED, type: 2 } } })
      await refocus(app)
      await card(app).waitFor({ state: 'detached', timeout: 10_000 })
      expect(readFakeShell(statePath).calls).toContain(`gdbus EnableExtension ${EXT}`)
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('a crashed extension says why; Try Again reinstalls and re-enables it', async () => {
    installed(BUNDLED, {
      loaded: { [EXT]: { version: BUNDLED, type: 2, state: 3, error: 'TypeError: this._x is undefined' } },
    })
    onboarded(display)
    const app = await launch()
    try {
      const row = await openIntegration(app)
      await row
        .getByText('It stopped with an error: TypeError: this._x is undefined')
        .waitFor({ timeout: 20_000 })
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-row-error.png'))
      await row.getByRole('button', { name: 'Try Again' }).click()
      await waitFor(
        () => readFakeShell(statePath).calls.includes(`gdbus EnableExtension ${EXT}`),
        10_000,
        'enable',
      )
      await closePrefs(app)
    } finally {
      await app.close()
    }
  })

  it('X11: a Shell restart works too, and the copy says so', async () => {
    rmSync(join(extDir(), EXT), { recursive: true, force: true })
    path = installFakeShellTools(join(tools, 'bin'), statePath, initialFakeShell({ extensionsDir: extDir() }))
    onboarded(display)
    const app = await launch({ XDG_SESSION_TYPE: 'x11' })
    try {
      await card(app).getByRole('button', { name: 'Install & Enable' }).click()
      await card(app)
        .getByText('Installed — log out and back in (or restart GNOME Shell with Alt+F2, r) to turn it on')
        .waitFor({ timeout: 20_000 })
      expect(readFakeShell(statePath).enabledExtensions).toEqual([EXT])
    } finally {
      await app.close()
    }
  })

  it('the Flatpak (no way to the Shell): copies the files and shows the command to run, with Copy', async () => {
    rmSync(join(extDir(), EXT), { recursive: true, force: true })
    path = installFakeShellTools(join(tools, 'bin'), statePath, initialFakeShell({ reachable: false }))
    onboarded(display)
    const app = await launch({
      FLATPAK_ID: 'org.gnome.Gnomeola',
      HOST_XDG_DATA_HOME: display.env.XDG_DATA_HOME!,
    })
    try {
      await card(app).getByRole('button', { name: 'Install & Enable' }).click({ timeout: 20_000 })
      await card(app)
        .getByText('Installed. To turn it on, run this in a terminal:')
        .waitFor({ timeout: 20_000 })
      await card(app).getByText(`gnome-extensions enable ${EXT}`, { exact: true }).waitFor()
      expect(existsSync(join(extDir(), EXT, 'extension.js'))).toBe(true)
      // the sandbox's own gsettings are never written
      expect(readFakeShell(statePath).calls.filter((c) => !c.startsWith('gdbus'))).toEqual([])
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'extension-card-flatpak.png'))
      await card(app).getByRole('button', { name: 'Copy command' }).click()
      await app.window.getByText('Copied the command').waitFor()
    } finally {
      await app.close()
    }
  })

  it('no GNOME: no card, no row', async () => {
    path = installFakeShellTools(join(tools, 'bin'), statePath, initialFakeShell({ reachable: false }))
    onboarded(display)
    const app = await launch({ XDG_CURRENT_DESKTOP: 'KDE' })
    try {
      await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
      await app.window.keyboard.press('Control+,')
      await prefs(app).getByRole('tab', { name: 'Integration' }).click()
      await prefs(app).getByText('Command-line tool and Claude skill').waitFor()
      await new Promise((r) => setTimeout(r, 1000))
      expect(await prefs(app).getByText('Top-bar extension').count()).toBe(0)
      expect(await card(app).count()).toBe(0)
    } finally {
      await app.close()
    }
  })
})
