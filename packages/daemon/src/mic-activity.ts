import { execFile } from 'node:child_process'

// C-8: "another application opened the microphone". Watches the PipeWire graph for capture streams
// that are not ours: nodes of media.class Stream/Input/Audio in the running state, excluding
//
//   * our own capture streams (node.name gnomeola-capture-*),
//   * streams recording a sink's monitor (stream.capture.sink — screen recorders, not calls),
//   * level meters (stream.monitor — Settings' input level bar, pavucontrol's peak detectors).
//
// Polled with pw-dump: this only runs while the auto-record rule is enabled, and a two-second
// resolution is plenty for "a call started".

export type MicUser = { id: number; app: string; pid: number | null }

export interface MicActivitySource {
  start(onChange: (users: MicUser[]) => void): void
  stop(): void
}

type PwObject = {
  id?: number
  type?: string
  info?: { state?: string; props?: Record<string, unknown> }
}

const truthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1'

/** The capture streams of other applications that are live right now, in a pw-dump snapshot. */
export function otherMicUsers(dump: unknown): MicUser[] {
  if (!Array.isArray(dump)) return []
  const out: MicUser[] = []
  for (const o of dump as PwObject[]) {
    if (o?.type !== 'PipeWire:Interface:Node' || typeof o.id !== 'number') continue
    const p = o.info?.props ?? {}
    if (p['media.class'] !== 'Stream/Input/Audio') continue
    if (o.info?.state !== 'running') continue
    const nodeName = typeof p['node.name'] === 'string' ? p['node.name'] : ''
    if (nodeName.startsWith('gnomeola-')) continue
    if (truthy(p['stream.capture.sink']) || truthy(p['stream.monitor'])) continue
    const app =
      [p['application.name'], p['application.process.binary'], nodeName].find(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ) ?? `node ${o.id}`
    const pid = Number(p['application.process.id'])
    out.push({ id: o.id, app, pid: Number.isInteger(pid) ? pid : null })
  }
  return out.sort((a, b) => a.id - b.id)
}

export class PwDumpMicActivity implements MicActivitySource {
  private timer: NodeJS.Timeout | null = null
  private last = ''
  private readonly pollMs: number
  private busy = false

  constructor(opts: { pollMs?: number } = {}) {
    this.pollMs = opts.pollMs ?? 2000
  }

  start(onChange: (users: MicUser[]) => void): void {
    this.stop()
    const poll = () => {
      if (this.busy) return
      this.busy = true
      execFile('pw-dump', [], { maxBuffer: 64 * 1024 * 1024, timeout: 10_000 }, (err, stdout) => {
        this.busy = false
        if (err || this.timer === null) return
        let users: MicUser[]
        try {
          users = otherMicUsers(JSON.parse(stdout))
        } catch {
          return
        }
        const key = JSON.stringify(users.map((u) => u.id))
        if (key === this.last) return
        this.last = key
        onChange(users)
      })
    }
    this.timer = setInterval(poll, this.pollMs)
    this.timer.unref()
    poll()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.last = ''
  }
}

/** Scripted source for tests. */
export class ManualMicActivity implements MicActivitySource {
  private fn: ((u: MicUser[]) => void) | null = null
  starts = 0
  start(onChange: (users: MicUser[]) => void): void {
    this.fn = onChange
    this.starts++
  }
  stop(): void {
    this.fn = null
  }
  get running(): boolean {
    return this.fn !== null
  }
  set(users: MicUser[]): void {
    this.fn?.(users)
  }
}
