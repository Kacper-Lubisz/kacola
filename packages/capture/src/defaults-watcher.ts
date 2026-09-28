import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { trackChild } from './children.ts'
import { type Defaults, parseMetadataLine, snapshotGraph } from './devices.ts'

// Watches PipeWire's `default` metadata so tracks that follow "the default device" can move when the
// user plugs in headphones or a Bluetooth headset connects. Primary mechanism: a long-lived
// `pw-metadata -m -n default`, which prints one `update:` line per change (event-driven, no polling).
// If pw-metadata is unavailable it degrades to polling pw-dump.

export interface DefaultsWatcher {
  start(initial: Defaults): Promise<void>
  current(): Defaults
  onChange(fn: (d: Defaults) => void): () => void
  stop(): void
}

const KEYS: Record<string, keyof Defaults> = {
  'default.audio.sink': 'sink',
  'default.audio.source': 'source',
  'default.configured.audio.sink': 'configuredSink',
  'default.configured.audio.source': 'configuredSource',
}

/**
 * Shared state + change detection; subclasses feed it. Also usable directly as a scripted watcher: a
 * `preset` overrides what the graph reports at start (tests use it to make rig devices "the default"
 * without touching the user's real defaults), and set() simulates a change.
 */
export class ManualDefaultsWatcher implements DefaultsWatcher {
  protected state: Defaults = { sink: null, source: null, configuredSink: null, configuredSource: null }
  private readonly listeners = new Set<(d: Defaults) => void>()
  private readonly preset: Partial<Defaults>

  constructor(preset: Partial<Defaults> = {}) {
    this.preset = preset
  }

  async start(initial: Defaults): Promise<void> {
    this.state = { ...initial, ...this.preset }
  }

  current(): Defaults {
    return { ...this.state }
  }

  onChange(fn: (d: Defaults) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  stop(): void {}

  /** Apply a partial update; listeners fire only if something actually changed. */
  set(patch: Partial<Defaults>): void {
    const next = { ...this.state, ...patch }
    const changed = (Object.keys(next) as (keyof Defaults)[]).some((k) => next[k] !== this.state[k])
    this.state = next
    if (changed) for (const fn of [...this.listeners]) fn(this.current())
  }
}

export class PwMetadataWatcher extends ManualDefaultsWatcher {
  private child: ChildProcess | null = null
  private stopped = false
  private restartTimer: NodeJS.Timeout | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private failures = 0
  private readonly pollMs: number

  constructor(opts: { pollMs?: number } = {}) {
    super({})
    this.pollMs = opts.pollMs ?? 2000
  }

  override async start(initial: Defaults): Promise<void> {
    await super.start(initial)
    this.stopped = false
    this.spawnMonitor()
  }

  override stop(): void {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.restartTimer = null
    this.pollTimer = null
    this.child?.kill('SIGTERM')
    this.child = null
  }

  private spawnMonitor(): void {
    if (this.stopped) return
    const child = spawn('pw-metadata', ['-m', '-n', 'default'], { stdio: ['ignore', 'pipe', 'ignore'] })
    this.child = child
    trackChild(child)
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      const u = parseMetadataLine(line)
      if (u?.subject !== 0) return
      const key = KEYS[u.key]
      if (key) this.set({ [key]: u.value })
      this.failures = 0
    })
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') this.startPolling()
    })
    child.on('exit', () => {
      if (this.child !== child) return
      this.child = null
      if (this.stopped || this.pollTimer) return
      this.failures++
      this.restartTimer = setTimeout(() => this.spawnMonitor(), Math.min(5000, 250 * 2 ** this.failures))
    })
  }

  private startPolling(): void {
    if (this.stopped || this.pollTimer) return
    this.pollTimer = setInterval(() => {
      snapshotGraph().then(
        (g) => this.set(g.defaults),
        () => {},
      )
    }, this.pollMs)
  }
}
