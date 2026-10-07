import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MARKER_VAR, type Spawned, spawnGuarded, stopProcess, sweepMarked } from '../ui/processes.ts'
import { CALENDARS, FIXTURE_TZ, type FixtureCalendar, ME, toIcs } from './fixtures.ts'

export * from './fixtures.ts'

// V-4c infrastructure: a throwaway Evolution Data Server with seeded calendars, for cal-agent and the
// daemon to read — without ever touching the user's own calendars or session bus.
//
//   dbus-daemon                    a private session bus (socket in the temp dir); no service activation
//   evolution-source-registry      reads the .source files we seeded under $XDG_CONFIG_HOME/evolution/sources
//   evolution-calendar-factory     serves the local-backend calendars from $XDG_DATA_HOME/evolution/calendar
//
// The factory is started only once the registry owns its name (it exits immediately otherwise), and the
// harness waits for the factory's own name before returning. Every process runs under
// `setpriv --pdeathsig SIGKILL` and carries a marker variable, so nothing outlives the test runner.
// The environment is built from scratch — HOME, every XDG dir, the session AND system bus addresses —
// and checked to point into the temp dir before anything starts.

export type EdsOptions = {
  calendars?: FixtureCalendar[]
  /** The user's addresses: each becomes a Mail Identity source (how EDS knows which attendee is "me"). */
  identities?: string[]
  /** TZ for everything started in the environment (floating times, all-day dates). */
  tz?: string
  startupTimeoutS?: number
  keepTempDir?: boolean
}

export type EdsEventComponent = {
  recurrenceId: string | null
  summary: string
  description: string
  /** How many DESCRIPTION properties the VEVENT has (RFC 5545: at most one). */
  descriptions: number
  location: string
  organizer: string | null
  ical: string
}

export type EdsHandle = {
  /** The isolated environment: pass it (or a superset) to anything that must see these calendars. */
  env: Record<string, string>
  tempDir: string
  /** Create / modify (by UID) an event through ECal, as a real client would. `vevent` is one VEVENT block. */
  createEvent: (sourceUid: string, vevent: string) => Promise<void>
  modifyEvent: (sourceUid: string, vevent: string) => Promise<void>
  removeEvent: (sourceUid: string, uid: string) => Promise<void>
  /** Read an event back through ECal, independently of cal-agent: every VEVENT of the UID (a series'
   *  master and its detached instances). */
  getEvent: (sourceUid: string, uid: string) => Promise<EdsEventComponent[]>
  /** Enable or disable a calendar source through the registry. */
  setEnabled: (sourceUid: string, enabled: boolean) => Promise<void>
  logs: () => Record<string, string>
  close: () => Promise<{ killedStragglers: number[] }>
}

const CTL = join(import.meta.dirname, 'eds-ctl.js')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function busConfig(socket: string): string {
  return [
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
      '"http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">',
    '<busconfig>',
    '  <type>session</type>',
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

const calendarSource = (c: FixtureCalendar) =>
  [
    '[Data Source]',
    `DisplayName=${c.name}`,
    `Enabled=${c.enabled}`,
    'Parent=local-stub',
    '',
    '[Calendar]',
    'BackendName=local',
    'Color=#62a0ea',
    'Selected=true',
    '',
  ].join('\n')

const identitySource = (address: string) =>
  [
    '[Data Source]',
    `DisplayName=${address}`,
    'Enabled=true',
    'Parent=',
    '',
    '[Mail Identity]',
    `Address=${address}`,
    'Name=Me',
    '',
  ].join('\n')

function run(
  cmd: string,
  args: string[],
  env: Record<string, string>,
  opts: { input?: string; timeoutMs?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'setpriv',
      ['--pdeathsig', 'SIGKILL', '--', cmd, ...args],
      { env, timeout: opts.timeoutMs ?? 20_000, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) reject(new Error(`${cmd} ${args.join(' ')} failed: ${err.message}\n${stderr}`))
        else resolve(stdout)
      },
    )
    child.stdin?.end(opts.input ?? '')
  })
}

async function waitForPath(path: string, timeoutMs: number, watch: Spawned[]): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!existsSync(path)) {
    for (const p of watch) if (p.hasExited()) throw new Error(`${p.name} exited early:\n${p.log()}`)
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`)
    await sleep(25)
  }
}

const live = new Set<{ id: string; tempDir: string; keep: boolean }>()
let hooked = false
function hookExit() {
  if (hooked) return
  hooked = true
  process.on('exit', () => {
    for (const d of live) {
      sweepMarked(d.id)
      if (!d.keep) rmSync(d.tempDir, { recursive: true, force: true })
    }
  })
}

export async function startEds(opts: EdsOptions = {}): Promise<EdsHandle> {
  const calendars = opts.calendars ?? CALENDARS
  const identities = opts.identities ?? [ME]
  const timeoutMs = (opts.startupTimeoutS ?? 30) * 1000
  const id = randomBytes(8).toString('hex')
  // Unix socket paths are limited to 108 bytes, so this lives directly under the OS temp dir.
  const tempDir = mkdtempSync(join(tmpdir(), 'kacola-eds-'))
  chmodSync(tempDir, 0o700)
  const record = { id, tempDir, keep: opts.keepTempDir ?? false }
  live.add(record)
  hookExit()

  const dirs = {
    run: join(tempDir, 'run'),
    home: join(tempDir, 'home'),
    config: join(tempDir, 'config'),
    data: join(tempDir, 'data'),
    cache: join(tempDir, 'cache'),
    state: join(tempDir, 'state'),
  }
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true, mode: 0o700 })
  const sources = join(dirs.config, 'evolution', 'sources')
  mkdirSync(sources, { recursive: true })
  for (const c of calendars) {
    writeFileSync(join(sources, `${c.uid}.source`), calendarSource(c))
    const dir = join(dirs.data, 'evolution', 'calendar', c.uid)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'calendar.ics'), toIcs(c.components))
  }
  identities.forEach((a, i) => {
    writeFileSync(join(sources, `kacola-identity-${i}.source`), identitySource(a))
  })
  const socket = join(dirs.run, 'bus')
  writeFileSync(join(tempDir, 'session.conf'), busConfig(socket))

  // Built from scratch: nothing from the caller's session (its bus, display, runtime dir) may leak in.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    TZ: opts.tz ?? FIXTURE_TZ,
    HOME: dirs.home,
    XDG_RUNTIME_DIR: dirs.run,
    XDG_CONFIG_HOME: dirs.config,
    XDG_DATA_HOME: dirs.data,
    XDG_CACHE_HOME: dirs.cache,
    XDG_STATE_HOME: dirs.state,
    XDG_DATA_DIRS: process.env.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share',
    GSETTINGS_BACKEND: 'memory',
    GIO_USE_VFS: 'local',
    GIO_USE_VOLUME_MONITOR: 'unix',
    DBUS_SESSION_BUS_ADDRESS: `unix:path=${socket}`,
    // no system bus at all: EDS must not reach the real NetworkManager / logind
    DBUS_SYSTEM_BUS_ADDRESS: `unix:path=${join(dirs.run, 'no-system-bus')}`,
    [MARKER_VAR]: id,
  }
  for (const k of [
    'DBUS_SESSION_BUS_ADDRESS',
    'DBUS_SYSTEM_BUS_ADDRESS',
    'XDG_RUNTIME_DIR',
    'HOME',
  ] as const) {
    if (!env[k]!.replace(/^unix:path=/, '').startsWith(`${tempDir}/`))
      throw new Error(`eds harness: ${k} escapes the temp dir: ${env[k]}`)
  }

  const procs: Spawned[] = []
  let closed = false
  async function close(): Promise<{ killedStragglers: number[] }> {
    if (closed) return { killedStragglers: [] }
    closed = true
    for (const p of [...procs].reverse()) await stopProcess(p, 3000)
    await sleep(100)
    const killedStragglers = sweepMarked(id)
    live.delete(record)
    if (!record.keep) rmSync(tempDir, { recursive: true, force: true })
    return { killedStragglers }
  }
  const start = (name: string, cmd: string, args: string[] = []) => {
    const p = spawnGuarded(name, cmd, args, { env })
    procs.push(p)
    return p
  }
  const waitName = (name: string) =>
    run('gdbus', ['wait', '--session', '--timeout', String(Math.ceil(timeoutMs / 1000)), name], env, {
      timeoutMs: timeoutMs + 5000,
    })

  try {
    const bus = start('session-bus', 'dbus-daemon', [
      `--config-file=${join(tempDir, 'session.conf')}`,
      '--nofork',
    ])
    await waitForPath(socket, timeoutMs, [bus])
    const registry = start('source-registry', '/usr/libexec/evolution-source-registry')
    await waitName('org.gnome.evolution.dataserver.Sources5')
    start('calendar-factory', '/usr/libexec/evolution-calendar-factory')
    await waitName('org.gnome.evolution.dataserver.Calendar8')
    if (registry.hasExited()) throw new Error(`source registry exited:\n${registry.log()}`)
  } catch (err) {
    const logs = procs.map((p) => `--- ${p.name}\n${p.log().slice(-4000)}`).join('\n')
    await close()
    throw new Error(`EDS failed to start: ${(err as Error).message}\n${logs}`)
  }

  const ctl = (args: string[], input?: string) =>
    run('gjs', ['-m', CTL, ...args], env, { input }).then(() => {})
  const wrap = (vevent: string) => toIcs([vevent]).match(/BEGIN:VEVENT[\s\S]*END:VEVENT/)![0]

  return {
    env,
    tempDir,
    createEvent: (s, v) => ctl(['create', s], wrap(v)),
    modifyEvent: (s, v) => ctl(['modify', s], wrap(v)),
    removeEvent: (s, uid) => ctl(['remove', s, uid]),
    getEvent: async (s, uid) =>
      JSON.parse(await run('gjs', ['-m', CTL, 'get', s, uid], env)) as EdsEventComponent[],
    setEnabled: (s, enabled) => ctl(['enable', s, String(enabled)]),
    logs: () => Object.fromEntries(procs.map((p) => [p.name, p.log()])),
    close,
  }
}
