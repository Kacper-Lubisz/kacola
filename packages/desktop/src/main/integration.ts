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
// The top-bar extension install is a stub until the packaging work implements it.

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

export class Integration {
  private readonly run: Run | null
  constructor(run: Run | null) {
    this.run = run
  }

  async cliStatus(): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    return cliStateFrom(await this.run(['install-cli', '--json', '--dry-run']), true)
  }

  async installCli(force: boolean): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    return cliStateFrom(await this.run(['install-cli', '--json', ...(force ? ['--force'] : [])]), false)
  }

  async uninstallCli(): Promise<CliInstallState> {
    if (!this.run) return { state: 'unavailable', detail: 'this build has no command-line tool' }
    const r = await this.run(['uninstall-cli', '--json'])
    if (r.code !== 0) return { state: 'error', detail: errorText(r.stderr) }
    return this.cliStatus()
  }

  /** Stub: the packaging work implements the extension install (xdg-data/gnome-shell/extensions). */
  async extensionStatus(): Promise<ExtensionState> {
    return { state: process.platform === 'linux' ? 'not-installed' : 'unsupported' }
  }

  async installExtension(): Promise<ExtensionState> {
    return {
      state: 'unavailable',
      detail: 'Installing the top-bar extension from the app is not available yet.',
    }
  }
}
