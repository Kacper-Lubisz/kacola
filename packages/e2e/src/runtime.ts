import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildRuntime, type RuntimeInfo } from '../../../scripts/build-runtime.ts'

// The packaged runtime under test: the esbuild bundles (scripts/build-runtime.ts) run on Electron's own
// Node (ELECTRON_RUN_AS_NODE=1), which is what the desktop app, the Flatpak and the macOS .app ship.

export const REPO = resolve(import.meta.dirname, '..', '..', '..')

/** The Electron binary installed by the root devDependency (pinned 44.x). */
export function electronBinary(): string {
  const bin =
    process.platform === 'darwin'
      ? join(REPO, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
      : join(REPO, 'node_modules', 'electron', 'dist', 'electron')
  if (!existsSync(bin)) throw new Error(`Electron is not installed at ${bin} (pnpm install)`)
  return bin
}

/** Environment that makes the Electron binary behave as plain Node. */
export const AS_NODE = { ELECTRON_RUN_AS_NODE: '1' }

let built: Promise<RuntimeInfo> | null = null
/** Build the runtime once per test process into a temp dir (removed at exit). */
export function testRuntime(): Promise<RuntimeInfo> {
  built ??= (async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kacola-runtime-'))
    process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
    return buildRuntime({ outDir: dir })
  })()
  return built
}

export type Run = { code: number | null; stdout: string; stderr: string }

/** Run the bundled CLI under Electron-as-Node, as an agent would (no TTY). */
export function bundledCli(
  runtimeDir: string,
  argv: string[],
  env: Record<string, string | undefined> = {},
  timeoutMs = 30_000,
): Promise<Run> {
  return new Promise((resolveRun, reject) => {
    const merged: Record<string, string | undefined> = { ...process.env, ...AS_NODE, ...env }
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k]
    const c = spawn(electronBinary(), [join(runtimeDir, 'cli.mjs'), ...argv], {
      env: merged as NodeJS.ProcessEnv,
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
    const timer = setTimeout(() => {
      c.kill('SIGKILL')
      reject(new Error(`bundled cli ${argv.join(' ')} timed out\n${stderr}`))
    }, timeoutMs)
    c.on('error', reject)
    c.on('close', (code) => {
      clearTimeout(timer)
      resolveRun({ code, stdout, stderr })
    })
  })
}
