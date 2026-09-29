import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

// A supervised helper process that speaks JSON lines on stdin/stdout — cal-agent and the D-Bus bridge
// (both GJS). The daemon owns their lifetime: they are started with it, restarted with exponential
// backoff when they die, and stopped (stdin closed, then SIGTERM, then SIGKILL) when it shuts down.
// A helper that stays up for `healthyAfterMs` resets the backoff.

export type LineChildOptions = {
  name: string
  command: string
  args: string[]
  env?: NodeJS.ProcessEnv
  /** Called for every stdout line that parses as JSON. */
  onMessage: (msg: unknown) => void
  /** Called once per spawned process, as soon as it is running (send initial messages here). */
  onStart?: () => void
  /** Called when a process exits; `willRestart` says whether another one is coming. */
  onExit?: (info: {
    code: number | null
    signal: NodeJS.Signals | null
    error: string | null
    stderr: string
    willRestart: boolean
  }) => void
  log?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    fields?: Record<string, unknown>,
  ) => void
  minBackoffMs?: number
  maxBackoffMs?: number
  healthyAfterMs?: number
  /** Give up after this many consecutive failures to launch at all (ENOENT etc.). Default 3. */
  maxLaunchFailures?: number
}

export class LineChild {
  private readonly o: LineChildOptions
  private child: ChildProcess | null = null
  private stopped = false
  private backoff: number
  private restartTimer: NodeJS.Timeout | null = null
  private launchFailures = 0
  private startedAt = 0
  /** Processes started so far (restarts included) — for tests and diagnostics. */
  spawns = 0

  constructor(o: LineChildOptions) {
    this.o = o
    this.backoff = o.minBackoffMs ?? 500
  }

  get running(): boolean {
    return this.child !== null
  }

  get pid(): number | null {
    return this.child?.pid ?? null
  }

  start(): void {
    this.stopped = false
    this.spawnOnce()
  }

  /** Write one message; dropped (false) while no process is running. */
  send(msg: unknown): boolean {
    const stdin = this.child?.stdin
    if (!stdin || stdin.destroyed || !stdin.writable) return false
    stdin.write(`${JSON.stringify(msg)}\n`)
    return true
  }

  private spawnOnce(): void {
    if (this.stopped) return
    const log = this.o.log ?? (() => {})
    let stderr = ''
    let launchError: string | null = null
    const child = spawn(this.o.command, this.o.args, {
      env: this.o.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    this.spawns++
    this.startedAt = Date.now()
    child.stdin!.on('error', () => {}) // EPIPE when it dies mid-write; the exit handler deals with it
    child.stderr!.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString('utf8')).slice(-8192)
    })
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      if (!line.trim()) return
      let msg: unknown
      try {
        msg = JSON.parse(line)
      } catch {
        log('warn', `${this.o.name}: non-JSON output`, { line: line.slice(0, 200) })
        return
      }
      try {
        this.o.onMessage(msg)
      } catch (err) {
        log('error', `${this.o.name}: message handler failed`, { err: String(err) })
      }
    })
    child.once('spawn', () => {
      this.launchFailures = 0
      this.o.onStart?.()
    })
    child.once('error', (err) => {
      launchError = err.message
    })
    child.once('close', (code, signal) => {
      if (this.child === child) this.child = null
      if (launchError) this.launchFailures++
      const giveUp = this.launchFailures >= (this.o.maxLaunchFailures ?? 3)
      const willRestart = !this.stopped && !giveUp
      this.o.onExit?.({ code, signal, error: launchError, stderr: stderr.trim(), willRestart })
      if (!willRestart) return
      if (Date.now() - this.startedAt >= (this.o.healthyAfterMs ?? 30_000))
        this.backoff = this.o.minBackoffMs ?? 500
      const delay = this.backoff
      this.backoff = Math.min(this.backoff * 2, this.o.maxBackoffMs ?? 30_000)
      log('warn', `${this.o.name} exited; restarting`, {
        code,
        signal,
        delayMs: delay,
        stderr: stderr.slice(-500),
      })
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null
        this.spawnOnce()
      }, delay)
      this.restartTimer.unref()
    })
  }

  async stop(graceMs = 2000): Promise<void> {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    const c = this.child
    if (!c) return
    const exited = new Promise<void>((r) => c.once('close', () => r()))
    c.stdin?.end()
    const term = setTimeout(() => c.kill('SIGTERM'), graceMs / 2)
    const kill = setTimeout(() => c.kill('SIGKILL'), graceMs)
    await exited
    clearTimeout(term)
    clearTimeout(kill)
  }
}
