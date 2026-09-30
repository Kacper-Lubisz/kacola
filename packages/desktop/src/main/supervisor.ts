import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process'
import type { DaemonStatus } from '../shared/bridge.ts'

// Main supervises the daemon (docs/desktop-app.md, "Process model"):
//
//   attach    the configured URL already answers /health (a systemd install, a remote host, another
//             app instance's daemon) → use it, and keep watching it;
//   spawn     otherwise, for a loopback URL only, start the daemon entry on this same runtime
//             (ELECTRON_RUN_AS_NODE=1 <electron> daemon.mjs --host … --port …) and wait for /health;
//   restart   if our child exits, start it again with exponential backoff (reset once it has stayed up);
//             if meanwhile something else answers the URL, attach to that instead;
//   remote    a non-loopback URL that does not answer is reported unreachable and polled — we never
//             start a local daemon in place of a remote one.
//
// Closing the window does not stop any of this; only an explicit quit calls stop().

export type ChildLike = Pick<ChildProcess, 'pid' | 'kill' | 'once' | 'stdout' | 'stderr' | 'exitCode'>

export type SupervisorOptions = {
  baseUrl: string
  loopback: boolean
  entry: string | null
  args?: string[]
  /** The runtime that runs the entry: Electron's own binary in the app (process.execPath). */
  execPath: string
  env: NodeJS.ProcessEnv
  onStatus?: (s: DaemonStatus) => void
  health?: (baseUrl: string, signal: AbortSignal) => Promise<boolean>
  spawn?: (cmd: string, args: string[], env: NodeJS.ProcessEnv) => ChildLike
  /** Delay before the first restart; doubles per failed attempt up to maxBackoffMs. */
  initialBackoffMs?: number
  maxBackoffMs?: number
  /** A child that stayed healthy this long resets the backoff. */
  stableAfterMs?: number
  /** How often an attached (or unreachable) daemon is re-checked. */
  watchMs?: number
  /** How long a freshly spawned daemon has to answer /health. */
  startTimeoutMs?: number
}

export async function probeHealth(baseUrl: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
    })
    await res.body?.cancel()
    return res.ok
  } catch {
    return false
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true },
    )
  })

export class DaemonSupervisor {
  private readonly o: Required<Omit<SupervisorOptions, 'onStatus' | 'entry'>> &
    Pick<SupervisorOptions, 'onStatus' | 'entry'>
  private current: DaemonStatus = { kind: 'stopped' }
  private child: ChildLike | null = null
  private readonly ac = new AbortController()
  private logBuf = ''
  private attempt = 0
  private loop: Promise<void> | null = null

  constructor(opts: SupervisorOptions) {
    this.o = {
      args: [],
      health: probeHealth,
      spawn: (cmd, args, env) => nodeSpawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }),
      initialBackoffMs: 1000,
      maxBackoffMs: 30_000,
      stableAfterMs: 60_000,
      watchMs: 5000,
      startTimeoutMs: 20_000,
      ...opts,
    }
  }

  get status(): DaemonStatus {
    return this.current
  }

  /** The spawned daemon's stdout + stderr (last 256 KiB), for diagnostics. */
  log(): string {
    return this.logBuf
  }

  private set(s: DaemonStatus) {
    this.current = s
    this.o.onStatus?.(s)
  }

  /** Resolves once the first decision is made: attached, spawned, or unreachable. */
  start(): Promise<DaemonStatus> {
    let first: (s: DaemonStatus) => void = () => {}
    const decided = new Promise<DaemonStatus>((r) => {
      first = r
    })
    this.loop = this.run((s) => first(s))
    return decided
  }

  private async run(decided: (s: DaemonStatus) => void): Promise<void> {
    const signal = this.ac.signal
    let announced = false
    const announce = (s: DaemonStatus) => {
      this.set(s)
      if (!announced) {
        announced = true
        decided(s)
      }
    }
    while (!signal.aborted) {
      if (await this.o.health(this.o.baseUrl, signal)) {
        if (this.current.kind !== 'attached') announce({ kind: 'attached' })
        await this.watchWhileHealthy(signal)
        continue
      }
      if (signal.aborted) break
      if (!this.o.loopback || !this.o.entry) {
        const error = !this.o.loopback
          ? `no gnomeola answers at ${this.o.baseUrl}`
          : `no gnomeola answers at ${this.o.baseUrl}, and there is no daemon to start`
        if (this.current.kind !== 'unreachable') announce({ kind: 'unreachable', error })
        await sleep(this.o.watchMs, signal)
        continue
      }
      // ours to run
      const lastError = await this.runChild(signal, announce)
      if (signal.aborted) break
      this.attempt++
      const inMs = Math.min(this.o.initialBackoffMs * 2 ** (this.attempt - 1), this.o.maxBackoffMs)
      this.set({ kind: 'restarting', attempt: this.attempt, inMs, lastError })
      await sleep(inMs, signal)
    }
  }

  /** Poll an attached daemon until it stops answering (two misses in a row). */
  private async watchWhileHealthy(signal: AbortSignal): Promise<void> {
    let misses = 0
    while (!signal.aborted) {
      await sleep(this.o.watchMs, signal)
      if (signal.aborted) return
      if (await this.o.health(this.o.baseUrl, signal)) misses = 0
      else if (++misses >= 2) return
    }
  }

  /** Spawn, wait for health, then wait for the child to exit. Resolves with why it ended. */
  private async runChild(signal: AbortSignal, announce: (s: DaemonStatus) => void): Promise<string> {
    const url = new URL(this.o.baseUrl)
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    this.set({ kind: 'starting' })
    const child = this.o.spawn(
      this.o.execPath,
      [this.o.entry!, '--host', host, '--port', port, ...this.o.args],
      { ...this.o.env, ELECTRON_RUN_AS_NODE: '1' },
    )
    this.child = child
    const append = (d: Buffer) => {
      this.logBuf += d.toString('utf8')
      if (this.logBuf.length > 256 * 1024) this.logBuf = this.logBuf.slice(-256 * 1024)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    const exited = new Promise<string>((resolve) => {
      child.once('exit', (code, sig) => resolve(`daemon exited (code ${code}, signal ${sig})`))
      child.once('error', (err) => resolve(`daemon failed to start: ${err.message}`))
    })
    let gone: string | null = null
    void exited.then((why) => {
      gone = why
    })

    // wait for /health (or an early exit)
    const deadline = Date.now() + this.o.startTimeoutMs
    let healthy = false
    while (!signal.aborted && gone === null && Date.now() < deadline) {
      if (await this.o.health(this.o.baseUrl, signal)) {
        healthy = true
        break
      }
      await sleep(100, signal)
    }
    if (signal.aborted) return 'stopped'
    if (!healthy) {
      if (gone === null) child.kill('SIGKILL')
      const why = await exited
      this.child = null
      return gone ?? `daemon did not answer /health within ${this.o.startTimeoutMs} ms (${why})`
    }
    announce({ kind: 'spawned', pid: child.pid ?? -1 })
    const stable = setTimeout(() => {
      this.attempt = 0
    }, this.o.stableAfterMs)
    const why = await exited
    clearTimeout(stable)
    this.child = null
    return why
  }

  /** Explicit quit: stop watching and stop the daemon we started (SIGTERM, then SIGKILL). */
  async stop(graceMs = 10_000): Promise<void> {
    this.ac.abort()
    const c = this.child
    if (c && c.exitCode === null) {
      const done = new Promise<void>((r) => c.once('exit', () => r()))
      c.kill('SIGTERM')
      const t = setTimeout(() => c.kill('SIGKILL'), graceMs)
      await done
      clearTimeout(t)
    }
    await this.loop?.catch(() => {})
    this.set({ kind: 'stopped' })
  }
}
