import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CliInstallState, ExtensionState } from '../shared/bridge.ts'

// Desktop integration from Preferences and onboarding: "Install command-line tool and Claude skill"
// and "Install top-bar extension".
//
// The CLI install is the bundled CLI's own `gnomeola install-cli --json` (packages/cli/src/install.ts —
// the logic lives there once), run on this same Electron binary as Node. Its status is the same command
// with --dry-run: "unchanged" means our shim is there and current. A `gnomeola` we did not write makes
// the CLI refuse (exit 5); that is reported as `foreign`, and only an explicit "Replace" passes --force.
//
// Packaged Linux (outside Flatpak) passes `--launch '<this binary>' --background`, so the shim starts
// this app when the daemon is down; the Flatpak and macOS modes have their own launch commands. On macOS
// /usr/local/bin needs an administrator: one osascript prompt copies the shim there (declined: the
// ~/.local/bin fallback stays).
//
// The top-bar extension install is extension.ts (a copy into the user's extensions dir, never enabled).

/** Which CLI entry to run: GNOMEOLA_CLI_ENTRY, the packaged runtime, the built runtime, the dev source. */
export function cliEntry(
  env: Record<string, string | undefined>,
  o: { resourcesPath?: string; appDir: string },
): string | null {
  if (env.GNOMEOLA_CLI_ENTRY) return env.GNOMEOLA_CLI_ENTRY
  const repo = join(o.appDir, '..', '..', '..', '..') // out/main → packages/desktop → repo
  const candidates = [
    ...(o.resourcesPath ? [join(o.resourcesPath, 'runtime', 'cli.mjs')] : []),
    join(repo, 'dist', 'runtime', 'cli.mjs'),
    join(repo, 'packages', 'cli', 'src', 'main.ts'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

type CliReport = {
  mode: string
  shim: { path: string; action: 'installed' | 'updated' | 'unchanged' | 'replaced' }
  skill: { path: string; action: string } | null
  onPath: boolean
  shadowedBy: string | null
  needsAdmin: string | null
  warnings: string[]
}

type Run = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>

export function runCli(execPath: string, entry: string, env: NodeJS.ProcessEnv): Run {
  return (args) =>
    new Promise((resolve) => {
      execFile(
        execPath,
        [entry, ...args],
        { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 30_000 },
        (err, stdout, stderr) => {
          const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0
          resolve({ code, stdout: String(stdout), stderr: String(stderr) })
        },
      )
    })
}

const firstLine = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l) ?? ''

/** The CLI's error text: its JSON error message if it printed one, else the first stderr line. */
function errorText(stderr: string): string {
  try {
    const j = JSON.parse(stderr) as { error?: { message?: string } | string }
    if (typeof j.error === 'string') return j.error
    if (j.error?.message) return j.error.message
  } catch {}
  return firstLine(stderr).replace(/^gnomeola:\s*/, '') || 'the command-line tool could not be installed'
}

/** One install-cli run → the state Preferences shows. `dryRun`: only look. */
export function cliStateFrom(
  r: { code: number; stdout: string; stderr: string },
  dryRun: boolean,
): CliInstallState {
  if (r.code === 5) {
    const msg = errorText(r.stderr)
    const at = /already installed at ([^;]+)/.exec(msg)?.[1] ?? null
    return { state: 'foreign', path: at, detail: msg }
  }
  if (r.code !== 0) return { state: 'error', detail: errorText(r.stderr) }
  let rep: CliReport
  try {
    rep = JSON.parse(r.stdout) as CliReport
  } catch {
    return { state: 'error', detail: 'unexpected output from install-cli' }
  }
  const installed = !dryRun || rep.shim.action === 'unchanged'
  return {
    state: installed ? 'installed' : rep.shim.action === 'updated' ? 'outdated' : 'not-installed',
    path: rep.shim.path,
    skillPath: rep.skill?.path ?? null,
    onPath: rep.onPath,
    shadowedBy: rep.shadowedBy,
    needsAdmin: rep.needsAdmin,
  }
}

/** Single-quote a word for sh (as install.ts writes shims). */
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** An AppleScript string literal. */
export const appleString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * macOS: the one administrator prompt that puts the shim in /usr/local/bin (install-cli could only
 * write the ~/.local/bin fallback without admin rights). The shim's content does not depend on where
 * it lives, so the fallback copy is installed as is.
 */
export function adminInstallCommand(shim: string, dir: string): string[] {
  const sh = `/bin/mkdir -p ${shq(dir)} && /usr/bin/install -m 0755 ${shq(shim)} ${shq(`${dir}/gnomeola`)}`
  return ['/usr/bin/osascript', '-e', `do shell script ${appleString(sh)} with administrator privileges`]
}

/** macOS: remove our shims from directories that need admin rights (uninstall-cli reports them). */
export function adminRemoveCommand(paths: string[]): string[] {
  const sh = `/bin/rm -f ${paths.map(shq).join(' ')}`
  return ['/usr/bin/osascript', '-e', `do shell script ${appleString(sh)} with administrator privileges`]
}

export type Exec = (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>

export type IntegrationOptions = {
  platform?: NodeJS.Platform
  /** install-cli --launch: how the shim starts the app when the daemon is down (null: the mode's default). */
  launch?: string | null
  /** Runs osascript (the macOS admin prompt); tests replace it. */
  exec?: Exec
  extensionStatus?: () => ExtensionState
  installExtension?: () => ExtensionState
}

const execDefault: Exec = (argv) =>
  new Promise((resolve) =>
    execFile(argv[0]!, argv.slice(1), { timeout: 120_000 }, (err, stdout, stderr) =>
      resolve({
        code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: String(stdout),
        stderr: String(stderr),
      }),
    ),
  )

const NO_EXTENSION: ExtensionState = {
  state: 'unavailable',
  detail: 'This build does not include the top-bar extension.',
}

export class Integration {
  private readonly run: Run | null
  private readonly o: IntegrationOptions
  constructor(run: Run | null, o: IntegrationOptions = {}) {
    this.run = run
    this.o = o
  }

  private get platform(): NodeJS.Platform {
    return this.o.platform ?? process.platform
  }

  private installArgs(extra: string[]): string[] {
    return ['install-cli', '--json', ...(this.o.launch ? ['--launch', this.o.launch] : []), ...extra]
  }

  async cliStatus(): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    return cliStateFrom(await this.run(this.installArgs(['--dry-run'])), true)
  }

  async installCli(force: boolean): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    const st = cliStateFrom(await this.run(this.installArgs(force ? ['--force'] : [])), false)
    if (st.state === 'installed' && st.needsAdmin && this.platform === 'darwin') {
      const r = await (this.o.exec ?? execDefault)(adminInstallCommand(st.path, st.needsAdmin))
      if (r.code !== 0) return st // declined: the fallback stays, and the row says why
      const fallbackDir = st.path.slice(0, st.path.lastIndexOf('/'))
      await this.run(['uninstall-cli', '--json', '--keep-skill', '--bin-dir', fallbackDir])
      return this.cliStatus()
    }
    return st
  }

  async uninstallCli(): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    const r = await this.run(['uninstall-cli', '--json'])
    if (r.code !== 0) return { state: 'error', detail: errorText(r.stderr) }
    let needsAdmin: string[] = []
    try {
      needsAdmin = (JSON.parse(r.stdout) as { needsAdmin?: string[] }).needsAdmin ?? []
    } catch {}
    if (needsAdmin.length && this.platform === 'darwin')
      await (this.o.exec ?? execDefault)(adminRemoveCommand(needsAdmin))
    return this.cliStatus()
  }

  async extensionStatus(): Promise<ExtensionState> {
    return this.o.extensionStatus?.() ?? NO_EXTENSION
  }

  async installExtension(): Promise<ExtensionState> {
    return this.o.installExtension?.() ?? NO_EXTENSION
  }
}
