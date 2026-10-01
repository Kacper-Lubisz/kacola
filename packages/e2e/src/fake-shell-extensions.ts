import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'

// A stand-in for GNOME Shell's extension API, for the top-bar extension's states that a real Shell will
// not produce on demand (a crashed extension, an older copy loaded, no Shell at all, X11, the Flatpak).
// The app reaches the Shell only through commands — `gdbus call --dest org.gnome.Shell …`, `gsettings
// … org.gnome.shell …`, `gnome-extensions info` — so `installFakeShellTools` writes executables of those
// names into a directory to put first on PATH. They answer from a JSON state file in the shape the real
// ones print (GVariant text, `gnome-extensions info` lines) and hand every other call (the Settings
// portal, other schemas) to the real tool. The same model runs in-process for the unit tests.
//
// Run as a script: `node fake-shell-extensions.ts <gdbus|gsettings|gnome-extensions> args…` with
// FAKE_SHELL_STATE=<state.json>.

export type FakeLoaded = {
  version: string
  /** 1 system-wide, 2 per user. */
  type?: 1 | 2
  /** Force an ExtensionState (3 error, 4 out of date); otherwise 1 when enabled, 2 when not. */
  state?: number
  error?: string
}

export type FakeShellState = {
  /** false: no Shell on the bus (gdbus fails, gnome-extensions cannot connect). */
  reachable: boolean
  /** The Shell's unique bus name (changes when it restarts). */
  owner: string
  enabledExtensions: string[]
  disabledExtensions: string[]
  disableUserExtensions: boolean
  /** What the running Shell has loaded, by UUID (only at its start-up, as the real one). */
  loaded: Record<string, FakeLoaded>
  /** The user's extensions directory (UninstallExtension deletes from it). */
  extensionsDir?: string
  /** Every faked call, for assertions. */
  calls: string[]
}

export const initialFakeShell = (o: Partial<FakeShellState> = {}): FakeShellState => ({
  reachable: true,
  owner: ':1.42',
  enabledExtensions: [],
  disabledExtensions: [],
  disableUserExtensions: false,
  loaded: {},
  calls: [],
  ...o,
})

export type RunResult = { code: number; stdout: string; stderr: string }
const ok = (stdout = ''): RunResult => ({ code: 0, stdout: `${stdout}\n`, stderr: '' })
const fail = (code: number, stderr: string): RunResult => ({ code, stdout: '', stderr: `${stderr}\n` })
const NO_SHELL = 'Error: GDBus.Error:org.freedesktop.DBus.Error.ServiceUnknown: The name is not activatable'

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const strv = (xs: string[]) => (xs.length ? `[${xs.map(q).join(', ')}]` : '@as []')
const parseStrv = (s: string) =>
  [...s.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]!.replace(/\\(.)/g, '$1'))

function enabled(s: FakeShellState, uuid: string): boolean {
  return (
    !s.disableUserExtensions && s.enabledExtensions.includes(uuid) && !s.disabledExtensions.includes(uuid)
  )
}

function stateOf(s: FakeShellState, uuid: string): number {
  const l = s.loaded[uuid]!
  return l.state ?? (enabled(s, uuid) ? 1 : 2)
}

function info(s: FakeShellState, uuid: string): string {
  const l = s.loaded[uuid]
  if (!l) return '(@a{sv} {},)'
  const path = join(s.extensionsDir ?? '/nowhere', uuid)
  return `({'uuid': <${q(uuid)}>, 'name': <'gnomeola'>, 'version-name': <${q(l.version)}>, 'type': <${(l.type ?? 2).toFixed(1)}>, 'state': <${stateOf(s, uuid).toFixed(1)}>, 'enabled': <${enabled(s, uuid)}>, 'path': <${q(path)}>, 'error': <${q(l.error ?? '')}>, 'canChange': <${!s.disableUserExtensions}>},)`
}

/** One faked command. null: not ours — the real tool should answer it. */
export function fakeShellRun(s: FakeShellState, argv: string[]): RunResult | null {
  const [tool, ...args] = argv
  if (tool === 'gdbus') {
    const dest = args[args.indexOf('--dest') + 1]
    const method = args[args.indexOf('--method') + 1] ?? ''
    const rest = args.slice(args.indexOf('--method') + 2)
    if (dest === 'org.freedesktop.DBus' && method.endsWith('GetNameOwner') && rest[0] === 'org.gnome.Shell') {
      s.calls.push(`gdbus GetNameOwner`)
      return s.reachable ? ok(`(${q(s.owner)},)`) : fail(1, 'Error: GDBus.Error:NameHasNoOwner')
    }
    if (dest !== 'org.gnome.Shell') return null
    s.calls.push(`gdbus ${method.split('.').pop()} ${rest.join(' ')}`.trim())
    if (!s.reachable) return fail(1, NO_SHELL)
    const uuid = rest[0] ?? ''
    switch (method) {
      case 'org.gnome.Shell.Extensions.GetExtensionInfo':
        return ok(info(s, uuid))
      case 'org.gnome.Shell.Extensions.ListExtensions':
        return ok(
          `({${Object.keys(s.loaded)
            .map((u) => `${q(u)}: ${info(s, u).slice(1, -2)}`)
            .join(', ')}},)`,
        )
      case 'org.gnome.Shell.Extensions.EnableExtension':
        if (!s.loaded[uuid]) return ok('(false,)')
        s.disabledExtensions = s.disabledExtensions.filter((u) => u !== uuid)
        if (!s.enabledExtensions.includes(uuid)) s.enabledExtensions.push(uuid)
        return ok('(true,)')
      case 'org.gnome.Shell.Extensions.DisableExtension':
        if (!s.loaded[uuid]) return ok('(false,)')
        s.enabledExtensions = s.enabledExtensions.filter((u) => u !== uuid)
        if (!s.disabledExtensions.includes(uuid)) s.disabledExtensions.push(uuid)
        return ok('(true,)')
      case 'org.gnome.Shell.Extensions.UninstallExtension':
        if (!s.loaded[uuid] || s.loaded[uuid]!.type === 1) return ok('(false,)')
        delete s.loaded[uuid]
        if (s.extensionsDir) rmSync(join(s.extensionsDir, uuid), { recursive: true, force: true })
        return ok('(true,)')
      case 'org.freedesktop.DBus.Properties.Get':
        return ok(`(<${!s.disableUserExtensions}>,)`)
      case 'org.freedesktop.DBus.Properties.Set':
        s.disableUserExtensions = rest[2] !== '<true>'
        return ok('()')
      default:
        return fail(1, `Error: GDBus.Error:org.freedesktop.DBus.Error.UnknownMethod: ${method}`)
    }
  }
  if (tool === 'gsettings') {
    const [op, schema, key, value] = args
    if (schema !== 'org.gnome.shell') return null
    s.calls.push(`gsettings ${args.join(' ')}`)
    const keys = {
      'enabled-extensions': 'enabledExtensions',
      'disabled-extensions': 'disabledExtensions',
    } as const
    if (key === 'disable-user-extensions') {
      if (op === 'get') return ok(String(s.disableUserExtensions))
      s.disableUserExtensions = value === 'true'
      return ok()
    }
    const k = keys[key as keyof typeof keys]
    if (!k) return fail(1, `No such key “${key}”`)
    if (op === 'get') return ok(strv(s[k]))
    s[k] = parseStrv(value ?? '')
    return ok()
  }
  if (tool === 'gnome-extensions') {
    s.calls.push(`gnome-extensions ${args.join(' ')}`)
    if (!s.reachable) return fail(2, 'Failed to connect to GNOME Shell')
    const uuid = args[1] ?? ''
    if (args[0] === 'info') {
      const l = s.loaded[uuid]
      if (!l) return fail(2, `Extension “${uuid}” doesn’t exist`)
      const names: Record<number, string> = {
        1: 'ACTIVE',
        2: 'INACTIVE',
        3: 'ERROR',
        4: 'OUT OF DATE',
        6: 'INITIALIZED',
      }
      return ok(
        [
          uuid,
          '  Name: gnomeola',
          `  Path: ${join(s.extensionsDir ?? '/nowhere', uuid)}`,
          `  Version: ${l.version}`,
          `  Enabled: ${enabled(s, uuid) ? 'Yes' : 'No'}`,
          `  State: ${names[stateOf(s, uuid)] ?? 'UNKNOWN'}`,
        ].join('\n'),
      )
    }
    return fail(1, `fake gnome-extensions: ${args[0]} is not faked`)
  }
  return null
}

/** The fake as a stateful runner over a state object (unit tests); `real` answers what it does not fake. */
export function fakeShellRunner(
  s: FakeShellState,
  real: (argv: string[]) => Promise<RunResult> = async (argv) => fail(127, `${argv[0]}: not found`),
): (argv: string[]) => Promise<RunResult> {
  return async (argv) => fakeShellRun(s, argv) ?? real(argv)
}

export const readFakeShell = (path: string): FakeShellState => JSON.parse(readFileSync(path, 'utf8'))
export const writeFakeShell = (path: string, s: FakeShellState) =>
  writeFileSync(path, JSON.stringify(s, null, 2))

/** Where a command is on PATH, skipping `skip`. */
function which(cmd: string, path: string, skip: string): string | null {
  for (const dir of path.split(delimiter)) {
    if (!dir || dir === skip) continue
    const p = join(dir, cmd)
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Write `gdbus`, `gsettings` and `gnome-extensions` into `dir`, answering from `statePath` (seeded with
 * `state`). Returns the PATH to give the app: `dir` first.
 */
export function installFakeShellTools(dir: string, statePath: string, state: FakeShellState): string {
  mkdirSync(dir, { recursive: true })
  writeFakeShell(statePath, state)
  const path = process.env.PATH ?? '/usr/bin:/bin'
  // which calls are the Shell's: anything else (the Settings portal, `gdbus monitor`, other schemas) is
  // exec'd straight into the real tool, so nothing of ours lingers around a long-running one
  const ours: Record<string, string | null> = {
    gdbus: '*" org.gnome.Shell "*',
    gsettings: '*" org.gnome.shell "*',
    'gnome-extensions': null,
  }
  for (const [tool, pattern] of Object.entries(ours)) {
    const real = which(tool, path, dir) ?? `/usr/bin/${tool}`
    const fake = `FAKE_SHELL_REAL=${JSON.stringify(real)} FAKE_SHELL_STATE=${JSON.stringify(statePath)} exec ${JSON.stringify(process.execPath)} ${JSON.stringify(import.meta.filename)} ${tool} "$@"`
    const p = join(dir, tool)
    writeFileSync(
      p,
      pattern
        ? `#!/bin/sh\ncase " $* " in ${pattern}) ${fake} ;; esac\nexec ${JSON.stringify(real)} "$@"\n`
        : `#!/bin/sh\n${fake}\n`,
    )
    chmodSync(p, 0o755)
  }
  return `${dir}${delimiter}${path}`
}

if (import.meta.main) {
  const statePath = process.env.FAKE_SHELL_STATE!
  const argv = process.argv.slice(2)
  const s = readFakeShell(statePath)
  const r = fakeShellRun(s, argv)
  if (r === null) {
    const real = spawnSync(process.env.FAKE_SHELL_REAL!, argv.slice(1), { stdio: 'inherit' })
    process.exit(real.status ?? 1)
  }
  writeFakeShell(statePath, s)
  process.stdout.write(r.stdout)
  process.stderr.write(r.stderr)
  process.exit(r.code)
}
