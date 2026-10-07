import { execFile } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { LEGACY_EXTENSION_UUID } from '@kacola/protocol'
import type { ExtensionState } from '../shared/bridge.ts'
import { formatStrv, type GValue, parseGVariant } from './gvariant.ts'

// The top-bar extension from Preferences › Integration, the sidebar card and onboarding: one button that
// does the right thing — Install & Enable, Update, or Enable — and only ever when the user presses it.
//
// Install: copy the GNOME Shell extension (extensions/kacola@kacperlubisz.com, shipped as
// resources/extension/ in packaged builds) into ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions.
// Inside the Flatpak, XDG_DATA_HOME is the app's own ~/.var/app/… directory, so the host's is used instead
// (HOST_XDG_DATA_HOME, else ~/.local/share) — the manifest grants exactly
// xdg-data/gnome-shell/extensions:create for this.
//
// Enable: the Shell's own API, org.gnome.Shell.Extensions on /org/gnome/Shell (bus name org.gnome.Shell),
// through `gdbus`: GetExtensionInfo, EnableExtension / DisableExtension / UninstallExtension and the
// UserExtensionsEnabled property (= org.gnome.shell disable-user-extensions). The Shell reads its
// extensions directory only at start-up, so right after a first install it does not know the UUID and
// EnableExtension answers false: then the UUID goes into org.gnome.shell enabled-extensions with
// `gsettings`, and the Shell starts it at the next login (on Wayland a login is the only way; on X11 a
// Shell restart also works). Without gdbus, `gnome-extensions info` / `gsettings` stand in.
//
// The Flatpak cannot reach the Shell (talking to org.gnome.Shell would mean `--talk-name=org.gnome.Shell`,
// the whole Shell interface) and its gsettings would only write the sandbox's own settings, so there it
// copies the files and shows the exact command to run instead.

export const EXTENSION_UUID = 'kacola@kacperlubisz.com'
export const ENABLE_COMMAND = `gnome-extensions enable ${EXTENSION_UUID}`

/** The extension to install: packaged resources/extension/<uuid>, else the repo's extensions/<uuid>. */
export function extensionSource(o: { resourcesPath?: string; appDir: string }): string | null {
  const candidates = [
    ...(o.resourcesPath ? [join(o.resourcesPath, 'extension', EXTENSION_UUID)] : []),
    // out/main → packages/desktop → repo
    join(o.appDir, '..', '..', '..', '..', 'extensions', EXTENSION_UUID),
  ]
  return candidates.find((p) => existsSync(join(p, 'metadata.json'))) ?? null
}

export function extensionsDir(env: Record<string, string | undefined>): string {
  const home = env.HOME || homedir()
  const data = env.FLATPAK_ID
    ? env.HOST_XDG_DATA_HOME || join(home, '.local', 'share')
    : env.XDG_DATA_HOME || join(home, '.local', 'share')
  return join(data, 'gnome-shell', 'extensions')
}

/** metadata.json's version-name ('' when it has none), or null when there is no extension there. */
export function versionAt(dir: string): string | null {
  try {
    const m = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8')) as { 'version-name'?: string }
    return m['version-name'] ?? ''
  } catch {
    return null
  }
}

/** -1 / 0 / 1, comparing dotted version names numerically part by part ("0.10.0" > "0.9.1"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/)
  const pb = b.split(/[.-]/)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0'
    const y = pb[i] ?? '0'
    const nx = Number(x)
    const ny = Number(y)
    const c = Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny
    if (c) return c < 0 ? -1 : 1
  }
  return 0
}

function files(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return files(p, root)
    // compiled at install time when missing, so it may differ without the extension differing
    return name === 'gschemas.compiled' ? [] : [relative(root, p)]
  })
}

/**
 * Is the installed copy behind the bundled one? A lower version name, or (same version name, as in
 * development) any shipped file that differs. A newer installed copy is left alone.
 */
export function isOutdated(installed: string, bundled: string): boolean {
  const vi = versionAt(installed) ?? ''
  const vb = versionAt(bundled) ?? ''
  const c = compareVersions(vi, vb)
  if (c !== 0) return c < 0
  try {
    return files(bundled).some((f) => {
      const there = join(installed, f)
      return !existsSync(there) || !readFileSync(there).equals(readFileSync(join(bundled, f)))
    })
  } catch {
    return true
  }
}

export type RunResult = { code: number; stdout: string; stderr: string }
/** Runs one command (gdbus, gsettings, gnome-extensions, glib-compile-schemas); tests replace it. */
export type Run = (argv: string[]) => Promise<RunResult>

export function runCommand(env: Record<string, string | undefined>): Run {
  return (argv) =>
    new Promise((resolve) =>
      execFile(argv[0]!, argv.slice(1), { env, timeout: 15_000 }, (err, stdout, stderr) =>
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : 127) : 0,
          stdout: String(stdout),
          stderr: String(stderr || (err && typeof err.code !== 'number' ? err.message : '')),
        }),
      ),
    )
}

/** What the running Shell says about the extension. */
export type ShellInfo =
  | { known: false }
  | {
      known: true
      enabled: boolean
      /** ExtensionState: 1 active, 2 inactive, 3 error, 4 out of date, 6 initialized, … (absent: never run). */
      state: number | null
      /** version-name of the copy the Shell loaded. */
      version: string | null
      error: string
      /** 1 system-wide, 2 per user. */
      type: number | null
    }

const STATE = { active: 1, error: 3, outOfDate: 4 } as const
const STATE_NAMES: Record<string, number> = {
  ACTIVE: 1,
  ENABLED: 1,
  INACTIVE: 2,
  DISABLED: 2,
  ERROR: 3,
  OUT_OF_DATE: 4,
  DOWNLOADING: 5,
  INITIALIZED: 6,
  DEACTIVATING: 7,
  ACTIVATING: 8,
}

const SHELL = ['--session', '--dest', 'org.gnome.Shell', '--object-path', '/org/gnome/Shell']
const IFACE = 'org.gnome.Shell.Extensions'

export function infoFromDict(d: GValue): ShellInfo {
  const o = (d && typeof d === 'object' && !Array.isArray(d) ? d : {}) as Record<string, GValue>
  if (typeof o.uuid !== 'string') return { known: false }
  return {
    known: true,
    enabled: o.enabled === true,
    state: typeof o.state === 'number' ? o.state : null,
    version: typeof o['version-name'] === 'string' ? o['version-name'] : null,
    error: typeof o.error === 'string' ? o.error : '',
    type: typeof o.type === 'number' ? o.type : null,
  }
}

/** `gnome-extensions info <uuid>` → ShellInfo (exit 2 "doesn't exist" → unknown; can't connect → null). */
export function infoFromCli(r: RunResult): ShellInfo | null {
  if (r.code !== 0) return /doesn.t exist/i.test(r.stderr + r.stdout) ? { known: false } : null
  const field = (k: string) => new RegExp(`^\\s*${k}:\\s*(.*)$`, 'm').exec(r.stdout)?.[1]?.trim() ?? null
  const stateName = field('State')
  return {
    known: true,
    enabled: field('Enabled') === 'Yes',
    state: stateName ? (STATE_NAMES[stateName] ?? null) : null,
    version: field('Version'),
    error: '',
    type: field('Path')?.startsWith('/usr/') ? 1 : 2,
  }
}

/** The Shell's extension API over D-Bus, with the gnome-extensions / gsettings fallbacks. */
export class ShellExtensions {
  private readonly run: Run
  private readonly flatpak: boolean
  constructor(run: Run, flatpak: boolean) {
    this.run = run
    this.flatpak = flatpak
  }

  private async call(method: string, ...args: string[]): Promise<GValue[] | null> {
    const r = await this.run(['gdbus', 'call', ...SHELL, '--timeout', '5', '--method', method, ...args])
    if (r.code !== 0) return null
    try {
      const v = parseGVariant(r.stdout)
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }

  /** null: the Shell cannot be reached (not GNOME, no gdbus, the Flatpak sandbox). */
  async info(uuid: string): Promise<ShellInfo | null> {
    const v = await this.call(`${IFACE}.GetExtensionInfo`, uuid)
    if (v) return infoFromDict(v[0] ?? null)
    if (this.flatpak) return null
    return infoFromCli(await this.run(['gnome-extensions', 'info', uuid]))
  }

  /** The Shell's UserExtensionsEnabled; null when it cannot be told. */
  async userExtensionsEnabled(): Promise<boolean | null> {
    const v = await this.call('org.freedesktop.DBus.Properties.Get', IFACE, 'UserExtensionsEnabled')
    if (v && typeof v[0] === 'boolean') return v[0]
    const g = await this.gsettings('get', 'disable-user-extensions')
    return g === null ? null : g.trim() !== 'true'
  }

  async enableUserExtensions(): Promise<boolean> {
    const v = await this.call('org.freedesktop.DBus.Properties.Set', IFACE, 'UserExtensionsEnabled', '<true>')
    if (v) return true
    return (await this.gsettings('set', 'disable-user-extensions', 'false')) !== null
  }

  /** true: done; false: the Shell does not know this UUID (not loaded yet); null: unreachable. */
  async enable(uuid: string): Promise<boolean | null> {
    const v = await this.call(`${IFACE}.EnableExtension`, uuid)
    return v ? v[0] === true : null
  }

  async disable(uuid: string): Promise<boolean | null> {
    const v = await this.call(`${IFACE}.DisableExtension`, uuid)
    return v ? v[0] === true : null
  }

  /** Unloads and deletes a per-user extension the Shell has loaded. */
  async uninstall(uuid: string): Promise<boolean | null> {
    const v = await this.call(`${IFACE}.UninstallExtension`, uuid)
    return v ? v[0] === true : null
  }

  private async gsettings(op: 'get' | 'set', key: string, value?: string): Promise<string | null> {
    // the sandbox's gsettings would only change the Flatpak's own copy of the settings
    if (this.flatpak) return null
    const r = await this.run([
      'gsettings',
      op,
      'org.gnome.shell',
      key,
      ...(value === undefined ? [] : [value]),
    ])
    return r.code === 0 ? r.stdout : null
  }

  private async strv(key: string): Promise<string[] | null> {
    const out = await this.gsettings('get', key)
    if (out === null) return null
    try {
      const v = parseGVariant(out)
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null
    } catch {
      return null
    }
  }

  /** Is the UUID in enabled-extensions (and not in disabled-extensions)? null: cannot tell. */
  async queued(uuid: string): Promise<boolean | null> {
    const on = await this.strv('enabled-extensions')
    if (on === null) return null
    const off = (await this.strv('disabled-extensions')) ?? []
    return on.includes(uuid) && !off.includes(uuid)
  }

  /**
   * Put the UUID in (or take it out of) enabled-extensions, so the Shell starts (or does not start) it
   * at the next login — what EnableExtension itself writes, for an extension the Shell has not loaded.
   */
  async queue(uuid: string, on: boolean): Promise<boolean> {
    const enabled = await this.strv('enabled-extensions')
    const disabled = await this.strv('disabled-extensions')
    if (enabled === null || disabled === null) return false
    const nextOn = on ? [...enabled.filter((u) => u !== uuid), uuid] : enabled.filter((u) => u !== uuid)
    const nextOff = disabled.filter((u) => u !== uuid)
    if (nextOff.length !== disabled.length)
      if ((await this.gsettings('set', 'disabled-extensions', formatStrv(nextOff))) === null) return false
    if (nextOn.length === enabled.length && nextOn.every((u, i) => u === enabled[i])) return true
    return (await this.gsettings('set', 'enabled-extensions', formatStrv(nextOn))) !== null
  }

  /** The Shell's unique bus name: a new one means the Shell has restarted (a new login). */
  async owner(): Promise<string | null> {
    const r = await this.run([
      'gdbus',
      'call',
      '--session',
      '--dest',
      'org.freedesktop.DBus',
      '--object-path',
      '/org/freedesktop/DBus',
      '--timeout',
      '5',
      '--method',
      'org.freedesktop.DBus.GetNameOwner',
      'org.gnome.Shell',
    ])
    if (r.code !== 0) return null
    try {
      const v = parseGVariant(r.stdout)
      return Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null
    } catch {
      return null
    }
  }
}

export type ExtensionDeps = {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  source: string | null
  run: Run
}

const isGnome = (env: Record<string, string | undefined>) =>
  (env.XDG_CURRENT_DESKTOP ?? '').split(':').some((d) => /gnome/i.test(d))

/**
 * Everything the status needs to remember between calls in this process: the Shell (by its bus name)
 * that was running when the extension was updated under it — it keeps running the old code until the
 * next login, even when the version name did not change.
 */
export class ExtensionManager {
  private readonly d: ExtensionDeps
  private readonly shell: ShellExtensions
  private updatedUnder: string | null = null
  constructor(d: ExtensionDeps) {
    this.d = d
    this.shell = new ShellExtensions(d.run, Boolean(d.env.FLATPAK_ID))
  }

  private get dest(): string {
    return join(extensionsDir(this.d.env), EXTENSION_UUID)
  }

  async status(): Promise<ExtensionState> {
    const d = this.d
    if (d.platform !== 'linux') return { state: 'unsupported' }
    const info = await this.shell.info(EXTENSION_UUID)
    if (!isGnome(d.env) && info === null) return { state: 'unsupported' }
    if (!d.source)
      return { state: 'unavailable', detail: 'This build does not include the top-bar extension.' }
    const installed = versionAt(this.dest)
    const userExtensionsOff = info !== null && (await this.shell.userExtensionsEnabled()) === false
    const systemWide = info?.known === true && info.type === 1
    if (installed === null && !systemWide) return { state: 'not-installed', userExtensionsOff }
    if (installed !== null && isOutdated(this.dest, d.source))
      return {
        state: 'outdated',
        installed,
        bundled: versionAt(d.source) ?? '',
        userExtensionsOff,
      }
    if (info === null) return { state: 'manual', command: ENABLE_COMMAND }
    const session = d.env.XDG_SESSION_TYPE === 'x11' ? 'x11' : 'wayland'
    if (!info.known) {
      const queued = await this.shell.queued(EXTENSION_UUID)
      return {
        state: 'needs-login',
        reason: 'new',
        queued: queued === true,
        session,
        command: queued === null ? ENABLE_COMMAND : null,
        userExtensionsOff,
      }
    }
    if (this.updatedUnder !== null && this.updatedUnder !== (await this.shell.owner()))
      this.updatedUnder = null
    const stale =
      this.updatedUnder !== null ||
      (installed !== null && info.version !== null && info.version !== installed)
    if (stale && info.enabled)
      return {
        state: 'needs-login',
        reason: 'updated',
        queued: true,
        session,
        command: null,
        userExtensionsOff,
      }
    if (info.state === STATE.error)
      return { state: 'error', reason: 'crashed', detail: info.error || 'unknown error' }
    if (info.state === STATE.outOfDate)
      return {
        state: 'error',
        reason: 'shell-version',
        detail: 'The installed top-bar extension does not support this version of GNOME Shell.',
      }
    if (!info.enabled || userExtensionsOff) return { state: 'disabled', userExtensionsOff }
    return { state: 'enabled' }
  }

  /**
   * Copy the extension into place (a temp copy renamed over the old one, so the Shell never sees half an
   * extension) and compile its GSettings schema if the copy has none compiled.
   */
  private async copy(): Promise<string | null> {
    const dest = this.dest
    const tmp = `${dest}.tmp-${process.pid}`
    try {
      mkdirSync(dirname(dest), { recursive: true })
      rmSync(tmp, { recursive: true, force: true })
      cpSync(this.d.source!, tmp, { recursive: true, dereference: true })
      const schemas = join(tmp, 'schemas')
      if (existsSync(schemas) && !existsSync(join(schemas, 'gschemas.compiled'))) {
        const r = await this.d.run(['glib-compile-schemas', '--strict', schemas])
        if (r.code !== 0) throw new Error(`could not compile its settings schema: ${r.stderr.trim()}`)
      }
      rmSync(dest, { recursive: true, force: true })
      renameSync(tmp, dest)
      return null
    } catch (err) {
      rmSync(tmp, { recursive: true, force: true })
      return `Could not install the top-bar extension: ${(err as Error).message}`
    }
  }

  /** The one button: install or update if needed, user extensions back on, then switch it on. */
  async turnOn(): Promise<ExtensionState> {
    const before = await this.status()
    if (before.state === 'unsupported' || before.state === 'unavailable' || before.state === 'enabled')
      return before
    // an extension that failed in the Shell gets a fresh copy too ("Try again")
    if (before.state === 'not-installed' || before.state === 'outdated' || before.state === 'error') {
      // the Shell that has the old copy loaded keeps running it until the next login
      const loaded = await this.shell.info(EXTENSION_UUID)
      const failed = await this.copy()
      if (failed) return { state: 'error', reason: 'failed', detail: failed }
      if (loaded?.known && loaded.type === 2) this.updatedUnder = await this.shell.owner()
    }
    if ((await this.shell.userExtensionsEnabled()) === false && !(await this.shell.enableUserExtensions()))
      return { state: 'error', reason: 'failed', detail: 'Could not turn GNOME extensions back on.' }
    const on = await this.shell.enable(EXTENSION_UUID)
    // the Shell has not loaded it yet: it starts at the next login (the Flatpak can only say how)
    if (on !== true) await this.shell.queue(EXTENSION_UUID, true)
    await this.retireLegacy(on === true)
    return this.status()
  }

  /**
   * The top-bar extension from before the rename (gnomeola@gnomeola.org; the daemon still answers it on
   * the old D-Bus name for one release) gives way once ours is switched on: it is taken out of
   * enabled-extensions so it does not start at the next login, and its files are removed. When ours is
   * running already it is also unloaded now; when ours waits for the next login, the old one keeps the
   * top bar until then. Nothing happens when there is no old copy.
   */
  private async retireLegacy(oursRunning: boolean): Promise<void> {
    const dir = join(extensionsDir(this.d.env), LEGACY_EXTENSION_UUID)
    if (!existsSync(dir)) return
    if (oursRunning) {
      const info = await this.shell.info(LEGACY_EXTENSION_UUID)
      if (info?.known && info.type === 2) await this.shell.uninstall(LEGACY_EXTENSION_UUID)
    }
    await this.shell.queue(LEGACY_EXTENSION_UUID, false)
    rmSync(dir, { recursive: true, force: true })
  }

  async disable(): Promise<ExtensionState> {
    if ((await this.shell.disable(EXTENSION_UUID)) !== true) await this.shell.queue(EXTENSION_UUID, false)
    return this.status()
  }

  async remove(): Promise<ExtensionState> {
    const info = await this.shell.info(EXTENSION_UUID)
    if (info?.known && info.type === 2) await this.shell.uninstall(EXTENSION_UUID)
    try {
      rmSync(this.dest, { recursive: true, force: true })
    } catch (err) {
      return { state: 'error', reason: 'failed', detail: `Could not remove it: ${(err as Error).message}` }
    }
    await this.shell.queue(EXTENSION_UUID, false)
    await this.retireLegacy(true)
    this.updatedUnder = null
    return this.status()
  }
}
