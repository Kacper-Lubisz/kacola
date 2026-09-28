import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { type Spawned, spawnGuarded, stopProcess } from './processes.ts'

// Node side of atspi-driver.py: a request/response channel over the helper's stdio.

export type AccessibleNode = {
  /** Handle to the live object inside the driver; pass it back to click/describe/etc. */
  ref: number
  /** AT-SPI role name, e.g. "push button", "list item", "frame", "label". */
  role: string
  name: string
  description: string
  /** AT-SPI state nicks, e.g. "focused", "selected", "showing", "sensitive". */
  states: string[]
  actions: string[]
  interfaces: string[]
  /** Text contents, for nodes implementing the Text interface. */
  text?: string
  children?: AccessibleNode[]
}

export type FindQuery = {
  /** Restrict to one application (its AT-SPI name — for a GApplication, g_get_application_name / prgname). */
  app?: string
  /** Search under this node instead of whole applications. */
  within?: AccessibleNode | number
  role?: string
  name?: string
  nameContains?: string
  /** Every listed state must be present. */
  states?: string[]
  limit?: number
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; cmd: string }

export class AtspiDriver {
  private proc: Spawned
  private pending = new Map<number, Pending>()
  private nextId = 1
  private closed = false

  constructor(env: NodeJS.ProcessEnv) {
    this.proc = spawnGuarded('atspi-driver', 'python3', [join(import.meta.dirname, 'atspi-driver.py')], {
      env,
      stdin: 'pipe',
    })
    const rl = createInterface({ input: this.proc.child.stdout! })
    rl.on('line', (line) => {
      let msg: { id: number; ok: boolean; result?: unknown; error?: string }
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(`atspi-driver ${p.cmd}: ${msg.error}`))
    })
    void this.proc.exited.then(({ code, signal }) => {
      for (const p of this.pending.values()) {
        p.reject(
          new Error(
            `atspi-driver exited (code ${code}, signal ${signal}) during ${p.cmd}\n${this.proc.log()}`,
          ),
        )
      }
      this.pending.clear()
    })
  }

  request<T>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
    if (this.closed || this.proc.hasExited()) {
      return Promise.reject(new Error(`atspi-driver is not running\n${this.proc.log()}`))
    }
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`atspi-driver ${cmd} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.pending.set(id, {
        cmd,
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      this.proc.child.stdin!.write(`${JSON.stringify({ id, cmd, args })}\n`)
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.proc.child.stdin?.end()
    await stopProcess(this.proc, 2000)
  }
}

export const refOf = (n: AccessibleNode | number): number => (typeof n === 'number' ? n : n.ref)
