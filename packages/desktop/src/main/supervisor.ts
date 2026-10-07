import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process'
import { DAEMON_EXIT } from '@kacola/protocol'
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
//
// A daemon is never killed or replaced while it records (2026-10-01: this fallback started a second
// daemon on the live data dir because the real one answered /health slowly under load):
//   - a /health that times out means something IS listening, just busy: that is never a reason to spawn
//     (only a refused connection is), and the daemon's data-dir lock refuses a second one anyway (it
//     exits DAEMON_EXIT.LOCKED, reported, not counted as a crash);
//   - our child exiting with DAEMON_EXIT.RESTART (a restart it was asked for, e.g. once the recording
//     ended) is started again at once;
//   - quitting while our child records does not stop it: it is asked to exit once the recording ends.

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
  /** true: answers; 'busy': something is listening but did not answer in time; false: nothing there. */
  health?: (baseUrl: string, signal: AbortSignal) => Promise<boolean | 'busy'>
  /** Whether the daemon at the URL is recording right now (GET /daemon). Default: asks it. */
  recording?: (baseUrl: string) => Promise<boolean>
  /** Ask the daemon to exit once nothing is recording (POST /daemon/restart, when-idle). */
  exitWhenIdle?: (baseUrl: string) => Promise<boolean>
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

export async function probeHealth(baseUrl: string, signal: AbortSignal): Promise<boolean | 'busy'> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
    })
    await res.body?.cancel()
    return res.ok
  } catch (err) {
    // our 2 s ran out: the port is taken by something that is slow to answer (a busy daemon), which is
    // not the same as nothing answering
    if (!signal.aborted && (err as Error)?.name === 'TimeoutError') return 'busy'
    return false
  }
}

export async function probeRecording(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/daemon`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) {
      await res.body?.cancel()
      return false
    }
    const info = (await res.json()) as { recording?: unknown[] }
    return Array.isArray(info.recording) && info.recording.length > 0
  } catch {
    // cannot tell: assume it may be recording, and do not kill it
    return true
  }
}

export async function requestExitWhenIdle(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/daemon/restart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'when-idle', by: 'desktop quit' }),
      signal: AbortSignal.timeout(3000),
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
  /** Set by stop() when our daemon was recording and so was left running (asked to exit when idle). */
  left: { pid: number; asked: boolean } | null = null

  constructor(opts: SupervisorOptions) {
    this.o = {
      args: [],
      health: probeHealth,
      recording: probeRecording,
      exitWhenIdle: requestExitWhenIdle,
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
          ? `no kacola answers at ${this.o.baseUrl}`
          : `no kacola answers at ${this.o.baseUrl}, and there is no daemon to start`
        if (this.current.kind !== 'unreachable') announce({ kind: 'unreachable', error })
        await sleep(this.o.watchMs, signal)
        continue
      }
      // ours to run
      const { why: lastError, code } = await this.runChild(signal, announce)
      if (signal.aborted) break
      if (code === DAEMON_EXIT.RESTART) {
        // a restart it was asked for (e.g. once a recording ended): straight back up, not a crash
        this.attempt = 0
        this.set({ kind: 'restarting', attempt: 0, inMs: 0, lastError: 'restart requested' })
        continue
      }
      this.attempt++
      const inMs = Math.min(this.o.initialBackoffMs * 2 ** (this.attempt - 1), this.o.maxBackoffMs)
      this.set({ kind: 'restarting', attempt: this.attempt, inMs, lastError })
      await sleep(inMs, signal)
    }
  }

  /** Poll an attached daemon until it stops answering (two refused probes in a row; slow ones count as up). */
  private async watchWhileHealthy(signal: AbortSignal): Promise<void> {
    let misses = 0
    while (!signal.aborted) {
      await sleep(this.o.watchMs, signal)
      if (signal.aborted) return
      if ((await this.o.health(this.o.baseUrl, signal)) !== false) misses = 0
      else if (++misses >= 2) return
    }
  }

  /** Spawn, wait for health, then wait for the child to exit. Resolves with why it ended (and its code). */
  private async runChild(
    signal: AbortSignal,
    announce: (s: DaemonStatus) => void,
  ): Promise<{ why: string; code: number | null }> {
    const url = new URL(this.o.baseUrl)
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    this.set({ kind: 'starting' })
    const child = this.o.spawn(
      this.o.execPath,
      [this.o.entry!, '--host', host, '--port', port, ...this.o.args],
      // KACOLA_SUPERVISED: we start it again after it exits for a restart (it says so on /daemon)
      { ...this.o.env, ELECTRON_RUN_AS_NODE: '1', KACOLA_SUPERVISED: '1' },
    )
    this.child = child
    const append = (d: Buffer) => {
      this.logBuf += d.toString('utf8')
      if (this.logBuf.length > 256 * 1024) this.logBuf = this.logBuf.slice(-256 * 1024)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    let exitCode: number | null = null
    const exited = new Promise<string>((resolve) => {
      child.once('exit', (code, sig) => {
        exitCode = code
        resolve(
          code === DAEMON_EXIT.LOCKED
            ? 'another kacola daemon owns the data dir (it did not answer here yet)'
            : `daemon exited (code ${code}, signal ${sig})`,
        )
      })
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
      if ((await this.o.health(this.o.baseUrl, signal)) === true) {
        healthy = true
        break
      }
      await sleep(100, signal)
    }
    if (signal.aborted) return { why: 'stopped', code: null }
    if (!healthy) {
      // it never answered: SIGTERM first (a daemon that got as far as recording suspends it), then KILL
      if (gone === null) {
        child.kill('SIGTERM')
        const t = setTimeout(() => child.kill('SIGKILL'), 10_000)
        await exited
        clearTimeout(t)
      }
      const why = await exited
      this.child = null
      return {
        why: gone ?? `daemon did not answer /health within ${this.o.startTimeoutMs} ms (${why})`,
        code: exitCode,
      }
    }
    announce({ kind: 'spawned', pid: child.pid ?? -1 })
    const stable = setTimeout(() => {
      this.attempt = 0
    }, this.o.stableAfterMs)
    // until it exits — or we stop watching (a quit that leaves a recording daemon running)
    const why = await Promise.race([
      exited,
      new Promise<string>((r) => {
        if (signal.aborted) r('stopped')
        signal.addEventListener('abort', () => r('stopped'), { once: true })
      }),
    ])
    clearTimeout(stable)
    this.child = null
    return { why, code: exitCode }
  }

  /**
   * Explicit quit: stop watching and stop the daemon we started (SIGTERM, then SIGKILL) — unless it is
   * recording: then it is left running and asked to exit once the recording ends.
   */
  async stop(graceMs = 10_000): Promise<void> {
    this.ac.abort()
    const c = this.child
    if (c && c.exitCode === null && (await this.o.recording(this.o.baseUrl))) {
      const asked = await this.o.exitWhenIdle(this.o.baseUrl)
      this.left = { pid: c.pid ?? -1, asked }
      await this.loop?.catch(() => {})
      this.set({ kind: 'stopped' })
      return
    }
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
