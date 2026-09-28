import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { type AccessibleNode, AtspiDriver, type FindQuery, refOf } from './driver.ts'
import { MARKER_VAR, type Spawned, spawnGuarded, stopProcess, sweepMarked } from './processes.ts'

export type { AccessibleNode, FindQuery } from './driver.ts'
export { markedPids } from './processes.ts'

// V-9a infrastructure: a throwaway GNOME session that a GTK app can be launched into and driven
// through its accessibility tree, without touching the desktop of whoever runs the tests.
//
// What gets started, all under a private temp dir and all killed by close():
//
//   dbus-daemon  × 3   private session bus, private *system* bus (so the Shell never reaches the
//                      real logind / GDM / NetworkManager), and the AT-SPI accessibility bus
//   at-spi2-registryd  the AT-SPI registry, on that accessibility bus
//   gnome-shell        --headless --virtual-monitor WxH --wayland --no-x11, in a custom session mode
//                      with no overview, so the app window is what a screenshot shows
//
// Isolation: XDG_RUNTIME_DIR, HOME and every XDG_*_HOME point into the temp dir, and
// GSETTINGS_BACKEND=keyfile keeps settings in a file there — nothing writes to the user's dconf,
// sockets, or config. No service activation is configured on any bus, so nothing is spawned behind
// our back.
//
// Why gnome-shell and not bare mutter: the Shell exports org.gnome.Shell.Screenshot, which gives
// pixel-exact screenshots of the virtual monitor with no PipeWire / ScreenCast pipeline. It also
// exports mutter's RemoteDesktop API (real keyboard input), same as mutter would.

export type HeadlessOptions = {
  /** Virtual monitor size, "WIDTHxHEIGHT". Default 1280x800. */
  size?: string
  /** Seconds to wait for the compositor and buses to come up. Default 30. */
  startupTimeoutS?: number
  /** Keep the temp dir (logs, settings) after close(), for debugging. */
  keepTempDir?: boolean
}

export type LaunchOptions = {
  command: string
  args?: string[]
  cwd?: string
  /** Extra environment for the app; merged over the display's private environment. */
  env?: Record<string, string | undefined>
}

export type AppHandle = {
  pid: number
  /** Captured stdout + stderr. */
  log: () => string
  hasExited: () => boolean
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  stop: () => Promise<void>
}

export type HeadlessDisplay = {
  /** The private environment: pass it (or a superset) to anything that must talk to this display. */
  env: Record<string, string>
  tempDir: string
  launchApp: (opts: LaunchOptions) => AppHandle
  /** Full-screen PNG of the virtual monitor (`kind: 'window'` captures the focused window with its frame). */
  screenshot: (path: string, opts?: { kind?: 'screen' | 'window' }) => Promise<string>
  /** Names of the applications currently registered on the accessibility bus. */
  applications: () => Promise<string[]>
  accessibleTree: (opts?: {
    app?: string
    within?: AccessibleNode
    maxDepth?: number
  }) => Promise<AccessibleNode[]>
  find: (q: FindQuery) => Promise<AccessibleNode[]>
  /** Polls `find` until at least one match, and returns the first. */
  findOne: (q: FindQuery, timeoutMs?: number) => Promise<AccessibleNode>
  describe: (node: AccessibleNode | number, withChildren?: boolean) => Promise<AccessibleNode>
  parent: (node: AccessibleNode | number) => Promise<AccessibleNode | null>
  waitFor: <T>(
    probe: () => Promise<T | null | undefined | false> | T | null | undefined | false,
    timeoutMs?: number,
    what?: string,
  ) => Promise<T>
  /** Activate a node: its click/activate action, or selection through its container. Returns how. */
  click: (node: AccessibleNode | number) => Promise<string>
  action: (node: AccessibleNode | number, name: string) => Promise<void>
  focus: (node: AccessibleNode | number) => Promise<void>
  /**
   * Move keyboard focus into a container (e.g. a GtkListView, whose rows are recycled and cannot be
   * targeted one by one) with real Tab presses (Shift+Tab with `reverse`: useful when forward
   * tabbing would cross a GtkListBox whose selection follows focus). Resolves with the focused node.
   */
  focusInto: (
    within: AccessibleNode | number,
    opts?: { maxTabs?: number; reverse?: boolean },
  ) => Promise<AccessibleNode>
  /** Real keyboard input through mutter's RemoteDesktop API, into whatever has focus. */
  typeText: (text: string, opts?: { delayMs?: number }) => Promise<void>
  /** Press a chord of named keys ("Return", "Escape", "Control_L", "a", …). */
  pressKeys: (...keys: string[]) => Promise<void>
  /** Replace the contents of an editable text node through AT-SPI EditableText. */
  setText: (node: AccessibleNode | number, text: string) => Promise<void>
  /** Position and size of a node, relative to its window. */
  extents: (node: AccessibleNode | number) => Promise<{ x: number; y: number; width: number; height: number }>
  /** Diagnostics: the logs of every process this display started. */
  logs: () => Record<string, string>
  close: () => Promise<{ killedStragglers: number[] }>
}

const BUS_DOCTYPE =
  '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
  '"http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">'

function busConfig(type: string, socket: string): string {
  return [
    BUS_DOCTYPE,
    '<busconfig>',
    `  <type>${type}</type>`,
    `  <listen>unix:path=${socket}</listen>`,
    '  <auth>EXTERNAL</auth>',
    '  <policy context="default">',
    '    <allow send_destination="*" eavesdrop="true"/>',
    '    <allow eavesdrop="true"/>',
    '    <allow own="*"/>',
    '  </policy>',
    '</busconfig>',
    '',
  ].join('\n')
}

// Settings the headless session starts with (GSETTINGS_BACKEND=keyfile reads this file).
const KEYFILE = [
  '[org/gnome/shell]',
  // suppress the "Welcome to GNOME" tour dialog on a fresh profile
  "welcome-dialog-last-shown-version='999'",
  '[org/gnome/desktop/interface]',
  'enable-animations=false',
  'toolkit-accessibility=true',
  // no GDM here, so the Shell would pop a "Screen Lock disabled" banner over the app
  '[org/gnome/desktop/screensaver]',
  'lock-enabled=false',
  '[org/gnome/desktop/notifications]',
  'show-banners=false',
  '',
].join('\n')

// A session mode layered on "user" without the overview, so the Shell starts on the desktop
// instead of the activities overview (which would sit on top of every app window).
const SESSION_MODE = 'gnomeola-headless'
const SESSION_MODE_JSON = JSON.stringify({ parentMode: 'user', hasOverview: false })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForPath(path: string, timeoutMs: number, watch: Spawned[]): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!existsSync(path)) {
    for (const p of watch) {
      if (p.hasExited()) throw new Error(`${p.name} exited before ${path} appeared:\n${p.log()}`)
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`)
    await sleep(50)
  }
}

// Every live display, so a process exit handler can tear them down synchronously as a last resort.
const live = new Set<{ id: string; tempDir: string; keep: boolean }>()
let exitHookInstalled = false
function installExitHook() {
  if (exitHookInstalled) return
  exitHookInstalled = true
  process.on('exit', () => {
    for (const d of live) {
      sweepMarked(d.id)
      if (!d.keep) rmSync(d.tempDir, { recursive: true, force: true })
    }
  })
}

export async function startHeadlessDisplay(opts: HeadlessOptions = {}): Promise<HeadlessDisplay> {
  const size = opts.size ?? '1280x800'
  if (!/^\d+x\d+$/.test(size)) throw new Error(`bad size ${size}`)
  const timeoutMs = (opts.startupTimeoutS ?? 30) * 1000
  const id = randomBytes(8).toString('hex')
  // Unix socket paths are limited to 108 bytes, so this lives directly under the OS temp dir.
  const tempDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-'))
  chmodSync(tempDir, 0o700)
  const record = { id, tempDir, keep: opts.keepTempDir ?? false }
  live.add(record)
  installExitHook()

  const run = join(tempDir, 'run')
  const dirs = {
    run,
    home: join(tempDir, 'home'),
    config: join(tempDir, 'config'),
    data: join(tempDir, 'data'),
    cache: join(tempDir, 'cache'),
    state: join(tempDir, 'state'),
    shellData: join(tempDir, 'shell-data'),
  }
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true, mode: 0o700 })
  mkdirSync(join(dirs.config, 'glib-2.0', 'settings'), { recursive: true })
  writeFileSync(join(dirs.config, 'glib-2.0', 'settings', 'keyfile'), KEYFILE)
  mkdirSync(join(dirs.shellData, 'gnome-shell', 'modes'), { recursive: true })
  writeFileSync(join(dirs.shellData, 'gnome-shell', 'modes', `${SESSION_MODE}.json`), SESSION_MODE_JSON)

  const sockets = {
    session: join(run, 'bus'),
    system: join(run, 'system_bus'),
    a11y: join(run, 'a11y_bus'),
    wayland: join(run, 'wayland-gnomeola'),
  }
  writeFileSync(join(tempDir, 'session.conf'), busConfig('session', sockets.session))
  writeFileSync(join(tempDir, 'system.conf'), busConfig('system', sockets.system))
  writeFileSync(join(tempDir, 'a11y.conf'), busConfig('accessibility', sockets.a11y))

  // Built from scratch rather than inherited: nothing from the caller's session (DISPLAY,
  // WAYLAND_DISPLAY, DBUS_SESSION_BUS_ADDRESS, AT_SPI_BUS_ADDRESS, …) may leak through.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    LANGUAGE: 'en',
    HOME: dirs.home,
    XDG_RUNTIME_DIR: run,
    XDG_CONFIG_HOME: dirs.config,
    XDG_DATA_HOME: dirs.data,
    XDG_CACHE_HOME: dirs.cache,
    XDG_STATE_HOME: dirs.state,
    XDG_DATA_DIRS: process.env.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share',
    XDG_SESSION_TYPE: 'wayland',
    XDG_CURRENT_DESKTOP: 'GNOME',
    GSETTINGS_BACKEND: 'keyfile',
    DBUS_SESSION_BUS_ADDRESS: `unix:path=${sockets.session}`,
    DBUS_SYSTEM_BUS_ADDRESS: `unix:path=${sockets.system}`,
    AT_SPI_BUS_ADDRESS: `unix:path=${sockets.a11y}`,
    WAYLAND_DISPLAY: 'wayland-gnomeola',
    GDK_BACKEND: 'wayland',
    GTK_A11Y: 'atspi',
    // libadwaita would otherwise wait on the settings portal, which does not exist here
    ADW_DISABLE_PORTAL: '1',
    GTK_USE_PORTAL: '0',
    NO_AT_BRIDGE: '0',
    [MARKER_VAR]: id,
  }

  const procs: Spawned[] = []
  const all = new Map<string, Spawned>()
  const track = (p: Spawned) => {
    procs.push(p)
    all.set(p.name, p)
    return p
  }
  let driver: AtspiDriver | null = null
  const apps: Spawned[] = []

  let closed = false
  async function close(): Promise<{ killedStragglers: number[] }> {
    if (closed) return { killedStragglers: [] }
    closed = true
    if (driver) await driver.close().catch(() => {})
    for (const a of apps) await stopProcess(a, 3000)
    // reverse start order: shell before registry before buses
    for (const p of [...procs].reverse()) await stopProcess(p, 3000)
    await sleep(100)
    const killedStragglers = sweepMarked(id)
    if (killedStragglers.length) await sleep(200)
    live.delete(record)
    if (!record.keep) rmSync(tempDir, { recursive: true, force: true })
    return { killedStragglers }
  }

  try {
    const bus = (name: string, conf: string) =>
      track(spawnGuarded(name, 'dbus-daemon', [`--config-file=${join(tempDir, conf)}`, '--nofork'], { env }))
    const buses = [
      bus('session-bus', 'session.conf'),
      bus('system-bus', 'system.conf'),
      bus('a11y-bus', 'a11y.conf'),
    ]
    await Promise.all(
      Object.values(sockets)
        .slice(0, 3)
        .map((s) => waitForPath(s, timeoutMs, buses)),
    )

    const registry = track(spawnGuarded('at-spi2-registryd', '/usr/libexec/at-spi2-registryd', [], { env }))
    // the registry has no socket of its own; the driver's ping below proves it answers
    const shell = track(
      spawnGuarded(
        'gnome-shell',
        'gnome-shell',
        [
          '--headless',
          '--virtual-monitor',
          size,
          '--wayland',
          '--no-x11',
          '--wayland-display',
          'wayland-gnomeola',
          `--mode=${SESSION_MODE}`,
        ],
        // session modes are only read from the *system* data dirs, so prepend ours for the Shell
        { env: { ...env, XDG_DATA_DIRS: `${dirs.shellData}:${env.XDG_DATA_DIRS}` } },
      ),
    )
    await waitForPath(sockets.wayland, timeoutMs, [shell, registry, ...buses])

    driver = new AtspiDriver(env)
    await driver.request('ping', {}, timeoutMs)
    // The Shell exports its D-Bus API a little after the Wayland socket appears.
    const d = driver
    await waitUntil(
      async () => (await d.request<string[]>('apps')).includes('gnome-shell'),
      timeoutMs,
      'gnome-shell to register on the accessibility bus',
    )
  } catch (err) {
    const logs = procs.map((p) => `--- ${p.name}\n${p.log().slice(-4000)}`).join('\n')
    await close()
    throw new Error(`headless display failed to start: ${(err as Error).message}\n${logs}`)
  }
  const drv = driver!

  function launchApp(o: LaunchOptions): AppHandle {
    if (closed) throw new Error('display is closed')
    const appEnv: NodeJS.ProcessEnv = { ...env }
    for (const [k, v] of Object.entries(o.env ?? {})) {
      if (v === undefined) delete appEnv[k]
      else appEnv[k] = v
    }
    appEnv[MARKER_VAR] = id
    const p = spawnGuarded(`app:${o.command}`, o.command, o.args ?? [], {
      env: appEnv,
      cwd: o.cwd,
      maxLog: 1024 * 1024,
    })
    apps.push(p)
    all.set(`app${apps.length}`, p)
    return {
      pid: p.child.pid ?? -1,
      log: p.log,
      hasExited: p.hasExited,
      exited: p.exited,
      stop: () => stopProcess(p, 3000),
    }
  }

  async function waitUntil<T>(
    probe: () => Promise<T | null | undefined | false> | T | null | undefined | false,
    ms = 10_000,
    what = 'condition',
  ): Promise<T> {
    const deadline = Date.now() + ms
    let lastErr: unknown = null
    for (;;) {
      try {
        const v = await probe()
        if (v !== null && v !== undefined && v !== false) return v as T
      } catch (e) {
        lastErr = e
      }
      if (Date.now() > deadline) {
        const tail = lastErr ? ` (last error: ${(lastErr as Error).message})` : ''
        throw new Error(`timed out after ${ms}ms waiting for ${what}${tail}`)
      }
      await sleep(100)
    }
  }

  const findArgs = (q: FindQuery) => ({ ...q, within: q.within === undefined ? undefined : refOf(q.within) })

  return {
    env,
    tempDir,
    launchApp,
    async screenshot(path, o = {}) {
      mkdirSync(dirname(path), { recursive: true })
      const r = await drv.request<{ path: string }>('screenshot', { path, kind: o.kind ?? 'screen' })
      return r.path
    },
    applications: () => drv.request<string[]>('apps'),
    accessibleTree: (o = {}) =>
      drv.request<AccessibleNode[]>('tree', {
        app: o.app,
        ref: o.within ? refOf(o.within) : undefined,
        maxDepth: o.maxDepth,
      }),
    find: (q) => drv.request<AccessibleNode[]>('find', findArgs(q)),
    findOne: (q, ms = 10_000) =>
      waitUntil(
        async () => (await drv.request<AccessibleNode[]>('find', { ...findArgs(q), limit: 1 }))[0],
        ms,
        `accessible ${JSON.stringify({ ...q, within: q.within === undefined ? undefined : refOf(q.within) })}`,
      ),
    describe: (n, withChildren = false) =>
      drv.request<AccessibleNode>('describe', { ref: refOf(n), children: withChildren }),
    parent: (n) => drv.request<AccessibleNode | null>('parent', { ref: refOf(n) }),
    waitFor: waitUntil,
    async click(n) {
      const r = await drv.request<{ via: string }>('click', { ref: refOf(n) })
      return r.via
    },
    async action(n, name) {
      await drv.request('action', { ref: refOf(n), name })
    },
    async focus(n) {
      const focused = async () =>
        (await drv.request<AccessibleNode>('describe', { ref: refOf(n) })).states.includes('focused')
      if (await focused()) return
      try {
        await drv.request('focus', { ref: refOf(n) })
        if (await waitUntil(focused, 1000, 'focus').catch(() => false)) return
      } catch {
        // GTK 4 does not implement Component.GrabFocus; fall through to the keyboard
      }
      // Walk focus with real Tab presses, as a keyboard user would, until the node has it.
      for (let i = 0; i < 40; i++) {
        await drv.request('key', { keys: ['Tab'] })
        if (await focused()) return
      }
      throw new Error(`could not move keyboard focus to node ${refOf(n)}`)
    },
    async focusInto(within, o = {}) {
      const focusedInside = async () =>
        (
          await drv.request<AccessibleNode[]>('find', {
            within: refOf(within),
            states: ['focused'],
            limit: 1,
          })
        )[0]
      const already = await focusedInside()
      if (already) return already
      for (let i = 0; i < (o.maxTabs ?? 60); i++) {
        await drv.request('key', { keys: o.reverse ? ['Shift_L', 'Tab'] : ['Tab'] })
        const f = await focusedInside()
        if (f) return f
      }
      throw new Error(`could not move keyboard focus into node ${refOf(within)}`)
    },
    async typeText(text, o = {}) {
      await drv.request('typeText', { text, delayMs: o.delayMs ?? 15 }, 60_000)
    },
    async pressKeys(...keys) {
      await drv.request('key', { keys })
    },
    async setText(n, text) {
      await drv.request('setText', { ref: refOf(n), text })
    },
    extents: (n) => drv.request('extents', { ref: refOf(n) }),
    logs: () => Object.fromEntries([...all].map(([k, p]) => [k, p.log()])),
    close,
  }
}

/** Flatten an accessible tree depth-first. */
export function flatten(nodes: AccessibleNode[]): AccessibleNode[] {
  const out: AccessibleNode[] = []
  const visit = (n: AccessibleNode) => {
    out.push(n)
    for (const c of n.children ?? []) visit(c)
  }
  for (const n of nodes) visit(n)
  return out
}

/** Render a tree as indented text — handy in assertion messages and when writing new tests. */
export function formatTree(nodes: AccessibleNode[], indent = ''): string {
  return nodes
    .map((n) => {
      const self = `${indent}[${n.role}] ${JSON.stringify(n.name)}${n.states.includes('selected') ? ' (selected)' : ''}`
      const kids = n.children?.length ? `\n${formatTree(n.children, `${indent}  `)}` : ''
      return self + kids
    })
    .join('\n')
}

export { type PngInfo, pngInfo } from './png.ts'
