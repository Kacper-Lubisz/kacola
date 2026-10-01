import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

// Main's garbage, collected when it is known to be garbage (docs/desktop-app.md, Footprint).
//
// Main allocates in bursts — the app:// protocol handler streams the renderer's bundle and fonts through
// JS Response bodies at start-up, the fetch tunnel streams every response and the event stream — and then
// sits idle. V8 collects on allocation pressure, not on idleness, and the main isolate gets no idle-time
// GC from Chromium, so after start-up ~10 MB of dead buffers and objects stayed resident indefinitely
// (measured: main 123 → 113 MB PSS after one full GC). A full collection of main's ~10 MB heap takes a
// few milliseconds, so main runs one when a burst is over: shortly after the window's first paint, after
// the window closes (background mode), and every few minutes while running.

let gc: (() => void) | null | undefined

/** V8's gc(), exposed once (--expose-gc set at runtime, then read from a fresh context); null if refused. */
function resolveGc(): (() => void) | null {
  if (gc !== undefined) return gc
  try {
    setFlagsFromString('--expose-gc')
    const fn = runInNewContext('gc') as unknown
    gc = typeof fn === 'function' ? (fn as () => void) : null
  } catch {
    gc = null
  }
  return gc
}

/** A full, synchronous garbage collection of this isolate. False if the runtime does not allow it. */
export function collectGarbage(): boolean {
  const fn = resolveGc()
  if (!fn) return false
  fn()
  return true
}

export type IdleCollectorOptions = {
  /** How long after a burst (settle()) to collect. */
  settleMs: number
  /** Collect this often regardless (0: never). */
  periodMs: number
  collect?: () => unknown
  setTimer?: (fn: () => void, ms: number) => { unref?: () => unknown }
  clearTimer?: (t: unknown) => void
}

/** Collects `settleMs` after the last settle() (bursts coalesce), and every `periodMs`. Timers never hold the process. */
export class IdleCollector {
  private pending: unknown = null
  private readonly o: Required<IdleCollectorOptions>

  constructor(o: IdleCollectorOptions) {
    this.o = {
      collect: collectGarbage,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (t) => clearTimeout(t as NodeJS.Timeout),
      ...o,
    }
  }

  start(): this {
    if (this.o.periodMs > 0) {
      const tick = () => {
        this.o.collect()
        this.o.setTimer(tick, this.o.periodMs).unref?.()
      }
      this.o.setTimer(tick, this.o.periodMs).unref?.()
    }
    return this
  }

  /** A burst of allocation just ended (or is about to): collect once things are quiet. */
  settle(): void {
    if (this.pending !== null) this.o.clearTimer(this.pending)
    const t = this.o.setTimer(() => {
      this.pending = null
      this.o.collect()
    }, this.o.settleMs)
    t.unref?.()
    this.pending = t
  }
}
