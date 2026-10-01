import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { DbusProbe, startPrivateBus } from '@gnomeola/testkit/dbus'
import { type CdpWindow, connectCdp } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildFlatpak } from '../../../scripts/build-flatpak.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { REPO } from '../src/runtime.ts'

// P-5/P-7: the Flatpak of the real desktop app, installed and driven for real. The bundle
// (scripts/build-flatpak.ts, from scripts/build-desktop.ts' linux-unpacked) is installed into a throwaway `--user` installation (FLATPAK_USER_DIR) with
// a throwaway HOME, so nothing touches the user's own Flatpaks, data or ~/.local/bin. Inside the sandbox:
// the natives load on the app's Electron, pw-record reaches PipeWire, the data lands in ~/.var/app; the
// app starts the daemon in the background; the CLI — inside the sandbox, and through the host shim that
// `install-cli` writes — lists, searches and asks; and the shim starts the app when the daemon is down.
//
// GNOMEOLA_FLATPAK_BUNDLE=path skips the build and tests that bundle.

const APP = 'org.gnome.Gnomeola'
const CASSETTES = join(REPO, 'packages', 'llm', 'test', 'fixtures', 'cassettes')

let bundle = ''
let userDir = ''
let home = ''
let port = 0
let url = ''
let api: FakeAnthropic
const children = new Set<ChildProcess>()

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
}

/** Environment for every flatpak call: the throwaway installation and home, a private daemon config. */
function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    FLATPAK_USER_DIR: userDir,
    HOME: home,
    // the daemon inside the sandbox: our port, no session-bus name, no keyring, fake capture for content
    GNOMEOLA_URL: url,
    GNOMEOLA_DBUS: 'off',
    GNOMEOLA_CALENDAR: 'off',
    GNOMEOLA_MIC_ACTIVITY: 'off',
    GNOMEOLA_KEYRING: 'memory',
    GNOMEOLA_FAKES: '1',
    GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
      speed: 20,
      segmentEveryMs: 4000,
      finalizeAfterMs: 30,
      tickMs: 20,
    }),
    ANTHROPIC_API_KEY: 'sk-ant-flatpak-0123456789',
    ANTHROPIC_BASE_URL: api.url,
    ...extra,
  }
}

function run(
  cmd: string,
  args: string[],
  extra: Record<string, string> = {},
  timeoutMs = 60_000,
  fullEnv?: NodeJS.ProcessEnv,
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const c = spawn(cmd, args, { env: fullEnv ?? env(extra), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    c.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    c.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    const t = setTimeout(() => {
      c.kill('SIGKILL')
      reject(new Error(`${cmd} ${args.join(' ')} timed out\n${stderr}`))
    }, timeoutMs)
    c.on('error', reject)
    c.on('close', (code) => {
      clearTimeout(t)
      resolve({ code, stdout, stderr })
    })
  })
}

const flatpakCli = (args: string[], extra: Record<string, string> = {}) =>
  run('flatpak', ['run', '--user', `--command=gnomeola`, APP, ...args], extra)

/** The app in the background, headless (no display needed for --background). */
const LAUNCH = `flatpak run --user ${APP} --background --ozone-platform=headless --disable-gpu`

function startApp(extra: Record<string, string> = {}): ChildProcess {
  const c = spawn('sh', ['-c', `exec ${LAUNCH}`], { env: env(extra), stdio: ['ignore', 'ignore', 'pipe'] })
  children.add(c)
  c.once('exit', () => children.delete(c))
  return c
}

async function stopApp(): Promise<void> {
  await run('flatpak', ['kill', APP]).catch(() => {})
  for (const c of children) c.kill('SIGKILL')
  await waitFor(async () => !(await healthy()), 15_000, 'the sandboxed daemon to go away')
}

async function healthy(): Promise<boolean> {
  try {
    return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })).ok
  } catch {
    return false
  }
}

let client: GnomeolaClient

beforeAll(async () => {
  api = await startFakeAnthropic()
  port = await freePort()
  url = `http://127.0.0.1:${port}`
  client = createClient({ baseUrl: url, timeoutMs: 10_000 })
  bundle = process.env.GNOMEOLA_FLATPAK_BUNDLE ?? ''
  if (!bundle) {
    const r = await buildFlatpak({ outDir: join(REPO, 'dist', 'flatpak') })
    bundle = r.bundle!
    console.log(
      `[flatpak] bundle ${(r.bundleBytes! / 1024 / 1024).toFixed(1)} MiB, /app ${(r.appBytes / 1024 / 1024).toFixed(1)} MiB`,
    )
  }
  userDir = mkdtempSync(join(tmpdir(), 'gnomeola-flatpak-user-'))
  home = mkdtempSync(join(tmpdir(), 'gnomeola-flatpak-home-'))
  const inst = await run(
    'flatpak',
    ['install', '--user', '-y', '--noninteractive', '--bundle', bundle],
    {},
    300_000,
  )
  expect(inst.code, inst.stderr).toBe(0)
}, 1_200_000)

afterAll(async () => {
  await run('flatpak', ['kill', APP]).catch(() => {})
  for (const c of children) c.kill('SIGKILL')
  await api?.close()
  for (const d of [userDir, home]) if (d) rmSync(d, { recursive: true, force: true })
}, 60_000)

describe('the org.gnome.Gnomeola Flatpak', () => {
  it('is installed in the throwaway installation only, with the declared permissions', async () => {
    const info = await run('flatpak', ['info', '--user', '--show-permissions', APP])
    expect(info.code, info.stderr).toBe(0)
    for (const p of [
      'xdg-run/pipewire-0',
      '~/.local/bin:create',
      '~/.claude/skills:create',
      'xdg-data/gnome-shell/extensions:create',
      'org.gnome.evolution.dataserver.*=talk',
      'org.freedesktop.secrets=talk',
      'org.gnome.Gnomeola=own',
      'network',
    ])
      expect(info.stdout, p).toContain(p)
    expect(existsSync(join(userDir, 'app', APP))).toBe(true)
    // the exported desktop file makes the app the kacola:// handler and passes the link on (%U)
    const entry = readFileSync(join(userDir, 'exports', 'share', 'applications', `${APP}.desktop`), 'utf8')
    expect(entry).toContain('MimeType=x-scheme-handler/kacola;')
    expect(entry).toMatch(/^Exec=.*gnomeola-app.*%U/m)
  })

  it('inside the sandbox: natives load on Electron’s Node, PipeWire answers, the data dirs are writable', async () => {
    const r = await run('flatpak', ['run', '--user', '--command=gnomeola-selftest', APP])
    expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0)
    const t = JSON.parse(r.stdout)
    expect(t.flatpakId).toBe(APP)
    expect(t.node).toBe('24.21.0')
    expect(t.electron).toMatch(/^44\./)
    expect(t.sqlite).toMatchObject({ ok: true, version: expect.stringMatching(/^3\./) })
    expect(t.sherpa).toEqual({ ok: true, exports: ['OnlineRecognizer', 'OfflineRecognizer', 'Vad'] })
    expect(t.pwRecord.ok).toBe(true)
    expect(t.pwDump.ok, JSON.stringify(t.pwDump)).toBe(true)
    expect(t.pwDump.nodes).toBeGreaterThan(0)
    expect(t.ffmpeg.ok).toBe(true)
    expect(t.secretTool.ok).toBe(true)
    // gjs is not in the runtime: the Flatpak builds it (mozjs 140 + gjs 1.88 on its own GLib 2.86)
    expect(t.gjs, JSON.stringify(t.gjs)).toMatchObject({
      ok: true,
      version: expect.stringMatching(/^gjs 1\.88/),
    })
    expect(t.gjs.glib).toBe('glib>=2.86 function')
    expect(t.dirs).toEqual({
      ok: true,
      dataDir: join(home, '.var', 'app', APP, 'data', 'gnomeola'),
      modelsDir: join(home, '.var', 'app', APP, 'data', 'gnomeola', 'models'),
      writable: true,
    })
  })

  it('the app starts the bundled daemon in the background; its data lands in ~/.var/app', async () => {
    startApp()
    await waitFor(healthy, 30_000, 'the sandboxed daemon to answer')
    const h = await client.call('health')
    expect(h.ok).toBe(true)
    expect(existsSync(join(home, '.var', 'app', APP, 'data', 'gnomeola', 'gnomeola.db'))).toBe(true)
  }, 60_000)

  it('the CLI inside the sandbox lists, searches and asks', async () => {
    const s = await client.call('createSession', { body: { title: 'Flatpak standup' } })
    await client.call('startSession', { params: { id: s.id } })
    await waitFor(
      async () => (await client.call('getTranscript', { params: { id: s.id } })).segments.length >= 8,
      20_000,
      'segments',
    )
    await client.call('stopSession', { params: { id: s.id } })
    const ls = await flatpakCli(['sessions', 'list'])
    expect(ls.code, ls.stderr).toBe(0)
    expect(JSON.parse(ls.stdout).sessions.map((x: { id: string }) => x.id)).toContain(s.id)
    const first = (await client.call('getTranscript', { params: { id: s.id } })).segments[0]!
    const word = first.text
      .split(/\s+/)
      .find((w) => w.length > 4)!
      .replace(/\W/g, '')
    const se = await flatpakCli(['search', word])
    expect(se.code, se.stderr).toBe(0)
    expect(JSON.parse(se.stdout).hits.length).toBeGreaterThan(0)
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const a = await flatpakCli(['ask', 'what is the retry budget?', '--session', s.id])
    expect(a.code, a.stderr).toBe(0)
    expect(JSON.parse(a.stdout).answer).toMatch(/three attempts/)
  }, 60_000)

  it('install-cli from inside the sandbox writes the host shim + skill; the shim drives the sandboxed daemon', async () => {
    const r = await flatpakCli(['install-cli'], { PATH: '/usr/bin:/bin' })
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    const shim = join(home, '.local', 'bin', 'gnomeola')
    expect(out).toMatchObject({
      mode: 'flatpak',
      shim: { path: shim, action: 'installed' },
      skill: { action: 'installed' },
    })
    expect(readFileSync(shim, 'utf8')).toContain(`'flatpak' 'run' '--command=gnomeola' '${APP}'`)
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'))).toBe(true)
    const st = await run('sh', [shim, 'status'])
    expect(st.code, st.stderr).toBe(0)
    expect(JSON.parse(st.stdout)).toMatchObject({ ok: true })
  }, 60_000)

  it('the shim starts the app when the daemon is down, waits for it, and runs the command', async () => {
    await stopApp()
    const shim = join(home, '.local', 'bin', 'gnomeola')
    const r = await run(
      'sh',
      [shim, 'sessions', 'list'],
      { GNOMEOLA_APP_LAUNCH: LAUNCH, GNOMEOLA_START_TIMEOUT: '40' },
      90_000,
    )
    expect(r.code, r.stderr).toBe(0)
    expect(r.stderr).toMatch(/starting the gnomeola app in the background/)
    expect(JSON.parse(r.stdout).sessions.length).toBeGreaterThan(0)
    expect(await healthy()).toBe(true)
  }, 120_000)

  it('the D-Bus bridge (bundled gjs) owns org.gnome.Gnomeola from inside the sandbox — on a private bus', async () => {
    await stopApp()
    const bus = await startPrivateBus()
    try {
      startApp({ DBUS_SESSION_BUS_ADDRESS: bus.address, GNOMEOLA_DBUS: 'session' })
      await waitFor(healthy, 30_000, 'the sandboxed daemon to answer')
      const probe = new DbusProbe({
        address: bus.address,
        name: 'org.gnome.Gnomeola',
        path: '/org/gnome/Gnomeola',
        iface: 'org.gnome.Gnomeola',
      })
      try {
        await probe.until((p) => p.DaemonUrl === url, 30_000, 'the bridge to own the name and publish')
        // the owner arrives as its own message from the probe, possibly after the properties
        await waitFor(() => probe.owner !== null, 10_000, 'the name owner')
        expect(probe.owner).toMatch(/^:1\./)
        expect(probe.props.State).toBe('idle')
      } finally {
        await probe.close()
      }
    } finally {
      await stopApp()
      await bus.close()
    }
  }, 120_000)

  it('uninstall-cli removes the shim and the skill again', async () => {
    const r = await flatpakCli(['uninstall-cli'])
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(home, '.local', 'bin', 'gnomeola'))).toBe(false)
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context'))).toBe(false)
  })
})

describe('the windowed app inside the sandbox (zypak), in the headless GNOME Shell', () => {
  // The real window: Chromium's sandbox through zypak inside Flatpak's, Wayland from the headless Shell,
  // the daemon it spawns inside the sandbox. Driven over the DevTools protocol (the packaged build
  // allows it only with GNOMEOLA_ALLOW_REMOTE_DEBUGGING=1); the port is reachable because the sandbox
  // shares the network namespace (--share=network).
  let display: HeadlessDisplay
  let cdp: CdpWindow
  let windowed: ChildProcess
  let portal: ChildProcess | undefined
  let cdpPort = 0

  /** The display's session (Wayland, private buses) with this suite's HOME and installation. */
  const windowEnv = (): NodeJS.ProcessEnv => {
    const e: NodeJS.ProcessEnv = { ...env(), ...display.env, HOME: home, FLATPAK_USER_DIR: userDir }
    // XDG_*_HOME point into the display's temp dirs; the sandbox uses this suite's HOME instead. Nothing
    // of the caller's own session may leak in (an X11 DISPLAY would be a way out of the headless Shell).
    for (const k of ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'DISPLAY'])
      delete e[k]
    return { ...e, GNOMEOLA_ALLOW_REMOTE_DEBUGGING: '1' }
  }
  /** flatpak ps / kill see instances by XDG_RUNTIME_DIR: the display's, for this one. */
  const inDisplay = (args: string[]) => run('flatpak', args, {}, 30_000, windowEnv())
  const stopWindowed = async () => {
    await inDisplay(['kill', APP]).catch(() => {})
    windowed?.kill('SIGKILL')
    await waitFor(async () => !(await healthy()), 15_000, 'the windowed app’s daemon to go away')
  }

  beforeAll(async () => {
    await stopApp()
    display = await startHeadlessDisplay({ size: '1280x800' })
    // zypak starts Chromium's renderer / GPU processes through the Flatpak portal's Spawn (sub-sandboxes);
    // a real session D-Bus-activates it, the headless one's private bus has no service files: start it
    portal = spawn('/usr/libexec/flatpak-portal', ['--replace'], { env: windowEnv(), stdio: 'ignore' })
    children.add(portal)
    await waitFor(
      async () =>
        (
          await run(
            'gdbus',
            [
              'call',
              '--session',
              '--dest',
              'org.freedesktop.DBus',
              '--object-path',
              '/org/freedesktop/DBus',
              '--method',
              'org.freedesktop.DBus.NameHasOwner',
              'org.freedesktop.portal.Flatpak',
            ],
            {},
            5_000,
            windowEnv(),
          )
        ).stdout.includes('true'),
      10_000,
      'the Flatpak portal on the headless session bus',
    )
    const empty = readFileSync(await display.screenshot(join(home, 'empty.png')))
    cdpPort = await freePort()
    windowed = spawn('flatpak', ['run', '--user', APP, `--remote-debugging-port=${cdpPort}`], {
      env: windowEnv(),
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    children.add(windowed)
    cdp = await connectCdp(cdpPort, 90_000)
    await cdp.window.getByRole('dialog', { name: 'Welcome to gnomeola' }).waitFor({ timeout: 30_000 })
    // the renderer is up; the compositor maps the window on ready-to-show, a frame or two later
    await waitFor(
      async () => !readFileSync(await display.screenshot(join(home, 'windowed.png'))).equals(empty),
      15_000,
      'the Shell to show the window',
    )
  }, 180_000)

  afterAll(async () => {
    await cdp?.disconnect().catch(() => {})
    await stopWindowed().catch(() => {})
    portal?.kill()
    await display?.close()
  }, 60_000)

  it('the window maps in the Shell and runs sandboxed (app:// origin, the sandbox’s daemon)', async () => {
    expect(await cdp.window.title()).toBe('Gnomeola')
    expect(await cdp.window.evaluate('location.href')).toBe('app://gnomeola/index.html')
    await waitFor(healthy, 30_000, 'the daemon the windowed app spawned inside the sandbox')
    const ps = await inDisplay(['ps', '--columns=application'])
    expect(ps.stdout).toContain(APP)
  })

  it('onboarding installs the CLI through the host shim (flatpak run --command=gnomeola)', async () => {
    const welcome = cdp.window.getByRole('dialog', { name: 'Welcome to gnomeola' })
    expect(
      await welcome.getByRole('switch', { name: 'Install command-line tool and Claude skill' }).isChecked(),
    ).toBe(true)
    await welcome.getByRole('button', { name: 'Skip for Now' }).click()
    const shim = join(home, '.local', 'bin', 'gnomeola')
    await waitFor(() => existsSync(shim), 30_000, 'the host shim from onboarding')
    expect(readFileSync(shim, 'utf8')).toContain(`'flatpak' 'run' '--command=gnomeola' '${APP}'`)
    expect(readFileSync(shim, 'utf8')).toContain(`flatpak run ${APP} --background`)
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'))).toBe(true)
    const st = await run('sh', [shim, 'sessions', 'list'])
    expect(st.code, st.stderr).toBe(0)
    expect(JSON.parse(st.stdout).sessions.map((s: { title: string }) => s.title)).toContain('Flatpak standup')
  })

  it('the renderer shows the session list from the sandboxed daemon', async () => {
    const list = cdp.window.getByRole('listbox', { name: 'Sessions' })
    const row = list.getByRole('option', { name: /Flatpak standup/ })
    await row.waitFor({ timeout: 20_000 })
    await row.click()
    await cdp.window.getByRole('heading', { level: 1, name: 'Flatpak standup' }).waitFor({ timeout: 10_000 })
    expect(await cdp.window.getByRole('heading', { name: 'No Session Selected' }).count()).toBe(0)
    expect(await row.getAttribute('aria-selected')).toBe('true')
    await new Promise((r) => setTimeout(r, 500)) // the compositor's next frame
    await display.screenshot(join(REPO, 'packages', 'e2e', 'test', '__artifacts__', 'flatpak-window.png'))
  })

  it('Preferences installs the top-bar extension into the host’s extensions dir, and says how to switch it on', async () => {
    await cdp.window.keyboard.press('Control+,')
    const prefs = cdp.window.getByRole('dialog', { name: 'Preferences' })
    await prefs.getByRole('tab', { name: 'Integration' }).click()
    const row = prefs.getByText('Top-bar extension', { exact: true }).locator('../..')
    await row.getByRole('button', { name: 'Install & Enable' }).click()
    // the sandbox cannot reach the Shell (no --talk-name=org.gnome.Shell), so: the command to run
    await row.getByText('Installed. To turn it on, run this in a terminal:').waitFor({ timeout: 20_000 })
    await row.getByText('gnome-extensions enable gnomeola@gnomeola.org', { exact: true }).waitFor()
    const dest = join(home, '.local', 'share', 'gnome-shell', 'extensions', 'gnomeola@gnomeola.org')
    for (const f of ['metadata.json', 'extension.js', 'schemas/gschemas.compiled'])
      expect(existsSync(join(dest, f)), f).toBe(true)
    await cdp.window.keyboard.press('Escape')
    expect(cdp.problems()).toEqual([])
  })

  it('closing the window keeps the app and its daemon running in the sandbox', async () => {
    await cdp.window.evaluate('window.gnomeola.windowControl("close")')
    await new Promise((r) => setTimeout(r, 3000))
    expect(windowed.exitCode).toBeNull()
    expect(await healthy()).toBe(true)
  })
})
