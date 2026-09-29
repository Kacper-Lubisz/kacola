import { type ChildProcess, spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

// V-4a infrastructure: a PRIVATE session bus (never the user's) and a D-Bus client that sees a service
// the way the Shell extension does — through a Gio.DBusProxy (./probe.js).

export type PrivateBus = {
  /** Put this in DBUS_SESSION_BUS_ADDRESS of anything that must use the bus. */
  address: string
  dir: string
  close: () => Promise<void>
}

const live = new Set<ChildProcess>()
let hooked = false
function hook() {
  if (hooked) return
  hooked = true
  process.on('exit', () => {
    for (const c of live) c.kill('SIGKILL')
  })
}

export async function startPrivateBus(): Promise<PrivateBus> {
  hook()
  const dir = mkdtempSync(join(tmpdir(), 'gnomeola-bus-'))
  chmodSync(dir, 0o700)
  const socket = join(dir, 'bus')
  const conf = join(dir, 'session.conf')
  // No <servicedir>: nothing is ever activated behind the test's back.
  writeFileSync(
    conf,
    `<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=${socket}</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
`,
  )
  const child = spawn(
    'setpriv',
    ['--pdeathsig', 'SIGKILL', '--', 'dbus-daemon', `--config-file=${conf}`, '--nofork'],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  )
  live.add(child)
  let err = ''
  child.stderr!.on('data', (d: Buffer) => {
    err += d.toString()
  })
  const deadline = Date.now() + 10_000
  while (!existsSync(socket)) {
    if (child.exitCode !== null) throw new Error(`dbus-daemon exited: ${err}`)
    if (Date.now() > deadline) throw new Error('timed out waiting for the private bus')
    await new Promise((r) => setTimeout(r, 20))
  }
  return {
    address: `unix:path=${socket}`,
    dir,
    close: async () => {
      if (child.exitCode === null) {
        const done = new Promise((r) => child.once('exit', r))
        child.kill('SIGTERM')
        await done
      }
      live.delete(child)
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type ProbeMessage =
  | { type: 'owner'; owner: string | null }
  | { type: 'props'; props: Record<string, unknown> }
  | { type: 'changed'; changed: Record<string, unknown>; invalidated: string[] }
  | { type: 'signal'; name: string; args: unknown[] }
  | { type: 'reply'; id: number; result?: unknown[]; error?: { name: string; message: string } }
  | { type: 'xml'; id: number; xml: string }

export class DbusCallError extends Error {
  readonly dbusName: string
  constructor(name: string, message: string) {
    super(`${name}: ${message}`)
    this.dbusName = name
  }
}

const PROBE = resolve(import.meta.dirname, 'probe.js')

/** A live view of one D-Bus object: its property cache, every signal, and method calls. */
export class DbusProbe {
  readonly messages: ProbeMessage[] = []
  props: Record<string, unknown> = {}
  owner: string | null = null
  private readonly child: ChildProcess
  private nextId = 0
  private readonly waiters = new Set<() => void>()
  private stderr = ''

  constructor(o: { address: string; name: string; path: string; iface: string; gjs?: string }) {
    hook()
    this.child = spawn(o.gjs ?? 'gjs', ['-m', PROBE, o.name, o.path, o.iface], {
      env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: o.address },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    live.add(this.child)
    this.child.stderr!.on('data', (d: Buffer) => {
      this.stderr += d.toString()
    })
    createInterface({ input: this.child.stdout! }).on('line', (line) => {
      const m = JSON.parse(line) as ProbeMessage
      this.messages.push(m)
      if (m.type === 'owner') this.owner = m.owner
      if (m.type === 'props') this.props = m.props
      if (m.type === 'changed') this.props = { ...this.props, ...m.changed }
      for (const w of [...this.waiters]) w()
    })
  }

  /** A position in the message log, for `waitFor(…, from)`: "only what arrives after this point". */
  mark(): number {
    return this.messages.length
  }

  /** Resolve with the first message at or after index `from` (default: all, received or future) matching `pred`. */
  waitFor(
    pred: (m: ProbeMessage) => boolean,
    timeoutMs = 10_000,
    what = 'probe message',
    from = 0,
  ): Promise<ProbeMessage> {
    return new Promise((resolveP, reject) => {
      const check = () => {
        const hit = this.messages.slice(from).find(pred)
        if (!hit) return false
        cleanup()
        resolveP(hit)
        return true
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `timed out waiting for ${what}; got ${JSON.stringify(this.messages.slice(-5))}\n${this.stderr}`,
          ),
        )
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.waiters.delete(w)
      }
      const w = () => void check()
      if (!check()) this.waiters.add(w)
    })
  }

  /** Wait until the property cache satisfies `pred`. */
  async until(
    pred: (props: Record<string, unknown>) => boolean,
    timeoutMs = 10_000,
    what = 'properties',
  ): Promise<Record<string, unknown>> {
    if (pred(this.props)) return this.props
    await this.waitFor(() => pred(this.props), timeoutMs, what)
    return this.props
  }

  /** Signals received so far with this name. */
  signals(name: string): unknown[][] {
    return this.messages.flatMap((m) => (m.type === 'signal' && m.name === name ? [m.args] : []))
  }

  async call(method: string, signature: string | null = null, args: unknown[] = []): Promise<unknown[]> {
    const id = ++this.nextId
    this.child.stdin!.write(`${JSON.stringify({ type: 'call', id, method, signature, args })}\n`)
    const r = (await this.waitFor(
      (m) => m.type === 'reply' && m.id === id,
      15_000,
      `reply to ${method}`,
    )) as Extract<ProbeMessage, { type: 'reply' }>
    if (r.error) throw new DbusCallError(r.error.name, r.error.message)
    return r.result ?? []
  }

  async introspect(): Promise<string> {
    const id = ++this.nextId
    this.child.stdin!.write(`${JSON.stringify({ type: 'introspect', id })}\n`)
    const r = (await this.waitFor((m) => m.type === 'xml' && m.id === id)) as Extract<
      ProbeMessage,
      { type: 'xml' }
    >
    return r.xml
  }

  async close(): Promise<void> {
    if (this.child.exitCode === null) {
      const done = new Promise((r) => this.child.once('exit', r))
      this.child.stdin!.end()
      setTimeout(() => this.child.kill('SIGKILL'), 2000).unref()
      await done
    }
    live.delete(this.child)
  }
}
