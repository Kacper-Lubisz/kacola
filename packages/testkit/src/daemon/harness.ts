import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'

// Runs the REAL daemon (packages/daemon/src/main.ts) as a child process: its own temp data dir, a
// random loopback port, fakes for capture/STT/devices/models and an in-memory keyring unless told
// otherwise. Every child is killed and every temp dir removed when the test process exits, even if a
// test forgot to call stop().

export type StartDaemonOptions = {
  /** Reuse a data dir (it is then NOT deleted on stop). Default: a fresh temp dir, deleted on stop. */
  dataDir?: string
  /** Extra environment. `undefined` values remove a variable. */
  env?: Record<string, string | undefined>
  /** Extra CLI args. */
  args?: string[]
  /** Fake capture/STT, devices and models (GNOMEOLA_FAKES=1). Default true. */
  fake?: boolean
  startTimeoutMs?: number
  /** Override the entry point (default: the daemon's main.ts in this repo). */
  entry?: string
  /**
   * The runtime that runs `entry` (default: this Node). The packaging tests pass Electron's binary with
   * ELECTRON_RUN_AS_NODE=1 in `env` to run the bundled daemon exactly as the desktop app does.
   */
  execPath?: string
}

export type DaemonHandle = {
  readonly baseUrl: string
  readonly client: GnomeolaClient
  readonly dataDir: string
  readonly pid: number
  /** Everything the process wrote to stdout and stderr, across restarts. */
  output(): string
  /** SIGTERM and wait for a clean exit; removes an owned temp dir. Resolves with the exit code. */
  stop(): Promise<number | null>
  /** Send a signal and wait for the process to exit. The data dir is kept. */
  kill(signal?: NodeJS.Signals): Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  /** Start again on the same data dir (after stop/kill, or stopping it first). New port. */
  restart(): Promise<void>
}

const DEFAULT_ENTRY = resolve(import.meta.dirname, '../../../daemon/src/main.ts')

const live = new Set<ChildProcess>()
const ownedDirs = new Set<string>()
let hooked = false
function hookExit(): void {
  if (hooked) return
  hooked = true
  process.on('exit', () => {
    for (const c of live) c.kill('SIGKILL')
    for (const d of ownedDirs) rmSync(d, { recursive: true, force: true })
  })
}

export async function startDaemon(opts: StartDaemonOptions = {}): Promise<DaemonHandle> {
  hookExit()
  const owned = opts.dataDir === undefined
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'gnomeola-daemon-'))
  if (owned) ownedDirs.add(dataDir)
  let out = ''
  let child: ChildProcess | null = null
  let baseUrl = ''
  let client: GnomeolaClient = createClient()

  async function spawnOnce(): Promise<void> {
    const env: Record<string, string | undefined> = {
      ...process.env,
      GNOMEOLA_DATA_DIR: undefined,
      ANTHROPIC_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: undefined,
      GNOMEOLA_KEYRING: 'memory',
      GNOMEOLA_FAKES: opts.fake === false ? undefined : '1',
      // M4 desktop integrations (EDS, the session bus, the PipeWire graph) stay off unless a test opts in:
      // a test daemon must never read the user's calendars or claim a name on their session bus.
      GNOMEOLA_CALENDAR: 'off',
      GNOMEOLA_DBUS: 'off',
      GNOMEOLA_MIC_ACTIVITY: 'off',
      ...opts.env,
    }
    for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k]
    const c = spawn(
      opts.execPath ?? process.execPath,
      [
        opts.entry ?? DEFAULT_ENTRY,
        '--port',
        '0',
        '--host',
        '127.0.0.1',
        '--data-dir',
        dataDir,
        ...(opts.args ?? []),
      ],
      { env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    child = c
    live.add(c)
    c.once('exit', () => live.delete(c))
    const url = await new Promise<string>((resolveUrl, reject) => {
      let buf = ''
      const timer = setTimeout(() => {
        c.kill('SIGKILL')
        reject(new Error(`daemon did not start within ${opts.startTimeoutMs ?? 20_000} ms\n${out}`))
      }, opts.startTimeoutMs ?? 20_000)
      c.stdout!.on('data', (d: Buffer) => {
        const s = d.toString()
        out += s
        buf += s
        for (let i = buf.indexOf('\n'); i !== -1; i = buf.indexOf('\n')) {
          const line = buf.slice(0, i)
          buf = buf.slice(i + 1)
          try {
            const msg = JSON.parse(line) as { event?: string; url?: string }
            if (msg.event === 'listening' && msg.url) {
              clearTimeout(timer)
              resolveUrl(msg.url)
            }
          } catch {}
        }
      })
      c.stderr!.on('data', (d: Buffer) => {
        out += d.toString()
      })
      c.once('exit', (code, signal) => {
        clearTimeout(timer)
        reject(new Error(`daemon exited during startup (code ${code}, signal ${signal})\n${out}`))
      })
    })
    baseUrl = url
    client = createClient({ baseUrl, timeoutMs: 10_000 })
    // listening is printed after the server is bound; confirm it answers
    const deadline = Date.now() + 5_000
    for (;;) {
      try {
        await client.call('health')
        return
      } catch (err) {
        if (Date.now() > deadline) throw err
        await new Promise((r) => setTimeout(r, 50))
      }
    }
  }

  function waitExit(c: ChildProcess): Promise<number | null> {
    if (c.exitCode !== null || c.signalCode !== null) return Promise.resolve(c.exitCode)
    return new Promise((r) => c.once('exit', (code) => r(code)))
  }

  async function kill(
    signal: NodeJS.Signals = 'SIGKILL',
  ): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    const c = child
    if (!c) return { code: null, signal: null }
    c.kill(signal)
    await waitExit(c)
    child = null
    return { code: c.exitCode, signal: c.signalCode }
  }

  async function stopProcess(): Promise<number | null> {
    const c = child
    if (!c) return null
    c.kill('SIGTERM')
    const timer = setTimeout(() => c.kill('SIGKILL'), 15_000)
    const code = await waitExit(c)
    clearTimeout(timer)
    child = null
    return code
  }

  await spawnOnce()

  return {
    get baseUrl() {
      return baseUrl
    },
    get client() {
      return client
    },
    dataDir,
    get pid() {
      return child?.pid ?? -1
    },
    output: () => out,
    async stop() {
      const code = await stopProcess()
      if (owned) {
        rmSync(dataDir, { recursive: true, force: true })
        ownedDirs.delete(dataDir)
      }
      return code
    },
    kill,
    async restart() {
      if (child) await stopProcess()
      await spawnOnce()
    },
  }
}

/** Poll until `fn` returns a truthy value (which is returned), or throw after `timeoutMs`. */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  timeoutMs = 10_000,
  what = 'condition',
): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs
  let last: unknown
  for (;;) {
    try {
      const v = await fn()
      if (v) return v as NonNullable<T>
    } catch (err) {
      last = err
    }
    if (Date.now() > deadline)
      throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}${last ? `: ${String(last)}` : ''}`)
    await new Promise((r) => setTimeout(r, 25))
  }
}
