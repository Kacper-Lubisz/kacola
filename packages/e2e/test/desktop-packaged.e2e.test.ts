import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses'
import { createClient } from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { type CdpWindow, connectCdp } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildLinuxApp } from '../../../scripts/build-desktop.ts'
import { REPO } from '../src/runtime.ts'

// P-7: the PACKAGED Linux app (scripts/build-desktop.ts: electron-builder `dir`, executable gnomeola,
// fuses flipped, the runtime in resources/runtime) — what the Flatpak ships — run for real inside the
// headless GNOME Shell. The fuses switch off --inspect, so Playwright drives the window over the
// DevTools protocol, which the build allows only with GNOMEOLA_ALLOW_REMOTE_DEBUGGING=1.
//
// First run: onboarding installs the CLI (+ skill) whose shim starts this binary with --background;
// Preferences installs the top-bar extension (never enabling it) and the autostart entry; closing the
// window keeps main and the daemon; a second launch re-opens the window; quitting stops the daemon; and
// the shim brings the app up in the background when the daemon is down.
//
// GNOMEOLA_DESKTOP_APP_DIR=dir skips the build and tests that linux-unpacked directory.

const EXT = 'gnomeola@gnomeola.org'
/** @electron/fuses' FuseState: the sentinel bytes '1' / '0'. */
const FuseState = { ENABLE: 49, DISABLE: 48 } as const

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })

let appDir = ''
let exe = ''
let display: HeadlessDisplay
let markerId = ''
let url = ''
const children = new Set<ChildProcess>()

/** The app's environment: the headless session, a private loopback daemon with fakes. */
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  ...display.env,
  GNOMEOLA_URL: url,
  GNOMEOLA_FAKES: '1',
  GNOMEOLA_KEYRING: 'memory',
  GNOMEOLA_CALENDAR: 'off',
  GNOMEOLA_DBUS: 'off',
  GNOMEOLA_MIC_ACTIVITY: 'off',
  ...extra,
})

function launch(
  args: string[],
  extra: Record<string, string> = {},
): { proc: ChildProcess; out: () => string } {
  let out = ''
  const proc = spawn(exe, args, { env: env(extra), stdio: ['ignore', 'pipe', 'pipe'] })
  proc.stdout!.on('data', (d: Buffer) => {
    out += d.toString()
  })
  proc.stderr!.on('data', (d: Buffer) => {
    out += d.toString()
  })
  children.add(proc)
  proc.once('exit', () => children.delete(proc))
  return { proc, out: () => out }
}

const healthy = () =>
  fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })
    .then((r) => r.ok)
    .catch(() => false)

const exited = (p: ChildProcess, ms = 20_000) =>
  new Promise<number | null>((resolve, reject) => {
    if (p.exitCode !== null) return resolve(p.exitCode)
    const t = setTimeout(() => reject(new Error('did not exit')), ms)
    p.once('exit', (code) => {
      clearTimeout(t)
      resolve(code)
    })
  })

beforeAll(async () => {
  appDir = process.env.GNOMEOLA_DESKTOP_APP_DIR ?? ''
  if (!appDir) {
    const r = await buildLinuxApp({ outDir: join(REPO, 'dist', 'desktop') })
    appDir = r.appDir
    console.log(`[desktop] linux-unpacked ${(r.bytes / 1024 / 1024).toFixed(1)} MiB`)
  }
  exe = join(appDir, 'gnomeola')
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
  url = `http://127.0.0.1:${await freePort()}`
}, 600_000)

afterAll(async () => {
  for (const c of children) c.kill('SIGKILL')
  if (display) {
    await display.close()
    expect(markedPids(markerId)).toEqual([])
  }
}, 60_000)

describe('the packaged Linux app (linux-unpacked)', () => {
  it('is the real app: asar + runtime + extension + brand icon, fuses per fuses.config.ts', async () => {
    const res = join(appDir, 'resources')
    expect(readdirSync(res).sort()).toEqual([
      'THIRD_PARTY_NOTICES.md',
      'app.asar',
      'extension',
      'icon.png',
      'runtime',
    ])
    for (const f of [
      'daemon.mjs',
      'cli.mjs',
      'diarize-worker.mjs',
      'node_modules/better-sqlite3/prebuilds/linux-x64.node',
    ])
      expect(existsSync(join(res, 'runtime', f)), f).toBe(true)
    expect(existsSync(join(res, 'extension', EXT, 'schemas', 'gschemas.compiled'))).toBe(true)
    expect(existsSync(join(appDir, 'LICENSES.chromium.html'))).toBe(true)
    const wire = await getCurrentFuseWire(exe)
    expect(wire[FuseV1Options.RunAsNode]).toBe(FuseState.ENABLE)
    expect(wire[FuseV1Options.EnableNodeCliInspectArguments]).toBe(FuseState.DISABLE)
    expect(wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(FuseState.DISABLE)
    expect(wire[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(FuseState.DISABLE)
    // RunAsNode: the same binary runs the bundled CLI
    const v = execFileSync(exe, [join(res, 'runtime', 'cli.mjs'), '--version'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
    })
    expect(v).toMatch(/^gnomeola 0\.1\.0/)
  })

  it('refuses a remote-debugging port unless the test switch is set', async () => {
    const { proc, out } = launch(['--remote-debugging-port=0', '--background'])
    expect(await exited(proc)).toBe(1)
    expect(out()).toMatch(/remote debugging is disabled in this build/)
  })

  describe('windowed, driven over CDP', () => {
    let app: ReturnType<typeof launch>
    let cdp: CdpWindow
    let port = 0
    const home = () => display.env.HOME!

    beforeAll(async () => {
      port = await freePort()
      app = launch([`--remote-debugging-port=${port}`], { GNOMEOLA_ALLOW_REMOTE_DEBUGGING: '1' })
      cdp = await connectCdp(port)
    }, 90_000)
    afterAll(async () => {
      await cdp?.disconnect().catch(() => {})
    })

    it('maps a window in the Shell and spawns the bundled daemon from resources/runtime', async () => {
      await cdp.window.getByRole('dialog', { name: 'Welcome to gnomeola' }).waitFor({ timeout: 30_000 })
      const shot = await display.screenshot(join(display.env.HOME!, 'packaged.png'))
      expect(readFileSync(shot).length).toBeGreaterThan(20_000) // a window, not an empty desktop
      await waitFor(healthy, 30_000, 'the daemon the app spawned')
      const spawned = /"event":"daemon","kind":"spawned","pid":(\d+)/.exec(app.out())
      expect(spawned, app.out()).not.toBeNull()
      const cmdline = readFileSync(`/proc/${spawned![1]}/cmdline`, 'utf8').split('\0')
      expect(cmdline[0]).toBe(exe)
      expect(cmdline[1]).toBe(join(appDir, 'resources', 'runtime', 'daemon.mjs'))
      await createClient({ baseUrl: url }).call('createSession', { body: { title: 'Packaged standup' } })
    })

    it('onboarding installs the CLI + skill; the shim starts this binary in the background', async () => {
      const welcome = cdp.window.getByRole('dialog', { name: 'Welcome to gnomeola' })
      expect(
        await welcome.getByRole('switch', { name: 'Install command-line tool and Claude skill' }).isChecked(),
      ).toBe(true)
      await welcome.getByRole('button', { name: 'Skip for Now' }).click()
      const shim = join(home(), '.local', 'bin', 'gnomeola')
      await waitFor(() => existsSync(shim), 30_000, 'the CLI shim from onboarding')
      const text = readFileSync(shim, 'utf8')
      expect(text).toContain('# gnomeola-cli-shim v1 (dev)')
      expect(text).toContain(
        `ELECTRON_RUN_AS_NODE='1' '${exe}' '${join(appDir, 'resources', 'runtime', 'cli.mjs')}'`,
      )
      expect(text).toContain(`'${exe}' --background`)
      expect(existsSync(join(home(), '.claude', 'skills', 'meeting-context', 'SKILL.md'))).toBe(true)
      await cdp.window
        .getByRole('listbox', { name: 'Sessions' })
        .getByRole('option', { name: /Packaged standup/ })
        .waitFor({ timeout: 20_000 })
    })

    it('Preferences installs the top-bar extension (never enabled) and the autostart entry', async () => {
      await cdp.window.keyboard.press('Control+,')
      const prefs = cdp.window.getByRole('dialog', { name: 'Preferences' })
      await prefs.getByRole('tab', { name: 'Integration' }).click()
      const row = prefs.getByText('Top-bar extension').locator('../..')
      await row.getByRole('button', { name: 'Install' }).click()
      await row.getByText(/^Installed\./).waitFor({ timeout: 20_000 })
      const dest = join(display.env.XDG_DATA_HOME!, 'gnome-shell', 'extensions', EXT)
      for (const f of ['metadata.json', 'extension.js', 'model.js', 'schemas/gschemas.compiled'])
        expect(existsSync(join(dest, f)), f).toBe(true)
      const enabled = execFileSync('gsettings', ['get', 'org.gnome.shell', 'enabled-extensions'], {
        env: display.env,
        encoding: 'utf8',
      })
      expect(enabled).not.toContain(EXT)

      const sw = prefs.getByRole('switch', { name: 'Start in the background at login' })
      await sw.focus()
      await cdp.window.keyboard.press('Space')
      const entry = join(display.env.XDG_CONFIG_HOME!, 'autostart', 'org.gnome.Gnomeola.desktop')
      await waitFor(() => existsSync(entry), 10_000, 'the autostart entry')
      expect(readFileSync(entry, 'utf8')).toContain(`Exec=${exe} --background`)
      await expect.poll(() => sw.isChecked()).toBe(true)
      await sw.focus()
      await cdp.window.keyboard.press('Space')
      await waitFor(() => !existsSync(entry), 10_000, 'the autostart entry to go')
      await cdp.window.keyboard.press('Escape')
      expect(cdp.problems()).toEqual([])
    })

    it('closing the window keeps main and the daemon; a second launch re-opens it', async () => {
      await cdp.window.evaluate('window.gnomeola.windowControl("close")')
      await waitFor(
        async () =>
          !cdp.browser.contexts().some((c) => c.pages().some((p) => p.url().includes('index.html'))),
        10_000,
        'the window to close',
      )
      await new Promise((r) => setTimeout(r, 2000))
      expect(app.proc.exitCode).toBeNull()
      expect(await healthy()).toBe(true)
      const second = launch([])
      expect(await exited(second.proc)).toBe(0) // handed over to the first instance
      await cdp.disconnect()
      cdp = await connectCdp(port)
      await cdp.window.getByRole('option', { name: /Packaged standup/ }).waitFor({ timeout: 20_000 })
    })

    it('quitting stops the daemon it spawned', async () => {
      app.proc.kill('SIGTERM')
      expect(await exited(app.proc)).toBe(0)
      await waitFor(async () => !(await healthy()), 15_000, 'the daemon to stop with the app')
    })
  })

  it('the CLI shim starts the packaged app with --background when the daemon is down', async () => {
    expect(await healthy()).toBe(false)
    const shim = join(display.env.HOME!, '.local', 'bin', 'gnomeola')
    const client = createClient({ baseUrl: url })
    const r = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const c = spawn('sh', [shim, 'sessions', 'list'], {
        env: env({ GNOMEOLA_START_TIMEOUT: '40' }),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      c.stdout.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      c.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      c.on('close', (code) => resolve({ code, stdout, stderr }))
    })
    expect(r.code, r.stderr).toBe(0)
    expect(r.stderr).toMatch(/starting the gnomeola app in the background/)
    expect(JSON.parse(r.stdout)).toHaveProperty('sessions')
    expect((await client.call('health')).ok).toBe(true)
    // the app it started runs without a window; find it by its binary and quit it
    const pids = execFileSync('pgrep', ['-f', '-x', `${exe} --background`], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
    expect(pids.length).toBe(1)
    process.kill(Number(pids[0]), 'SIGTERM')
    await waitFor(async () => !(await healthy()), 15_000, 'the background app to quit')
  }, 90_000)
})
