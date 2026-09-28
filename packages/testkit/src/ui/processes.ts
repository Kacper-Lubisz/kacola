import { type ChildProcess, spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

// Process plumbing for the headless display. Two rules, because the display runs on a real user's
// desktop machine and must never outlive the test that started it:
//
//   1. every child is spawned under `setpriv --pdeathsig SIGKILL`, so if the test runner dies
//      (crash, SIGKILL, ctrl-C) the kernel kills the child with it;
//   2. every child carries a marker variable in its environment, and teardown sweeps /proc for
//      anything still holding the marker — which catches grandchildren the Shell spawned itself
//      (ibus, glycin loaders) that no pid we hold points at.

export const MARKER_VAR = 'GNOMEOLA_HEADLESS_ID'

export type Spawned = {
  name: string
  child: ChildProcess
  /** Everything the process wrote to stdout + stderr, for diagnostics. */
  log: () => string
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  hasExited: () => boolean
}

export function spawnGuarded(
  name: string,
  command: string,
  args: string[],
  opts: { env: NodeJS.ProcessEnv; cwd?: string; stdin?: 'pipe' | 'ignore'; maxLog?: number },
): Spawned {
  const child = spawn('setpriv', ['--pdeathsig', 'SIGKILL', '--', command, ...args], {
    env: opts.env,
    cwd: opts.cwd,
    stdio: [opts.stdin ?? 'ignore', 'pipe', 'pipe'],
  })
  const max = opts.maxLog ?? 256 * 1024
  let buf = ''
  const append = (chunk: Buffer) => {
    buf += chunk.toString('utf8')
    if (buf.length > max) buf = buf.slice(buf.length - max)
  }
  // stdout is left to whoever wants it when stdin is piped (the driver speaks JSON on it).
  if (opts.stdin !== 'pipe') child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  let done = false
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => {
      done = true
      resolve({ code, signal })
    })
    child.once('error', (err) => {
      done = true
      buf += `\n[spawn error] ${err.message}`
      resolve({ code: null, signal: null })
    })
  })
  return { name, child, log: () => buf, exited, hasExited: () => done }
}

export async function stopProcess(p: Spawned, graceMs = 3000): Promise<void> {
  if (p.hasExited()) return
  p.child.kill('SIGTERM')
  const timedOut = await Promise.race([
    p.exited.then(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(true), graceMs).unref()),
  ])
  if (timedOut && !p.hasExited()) {
    p.child.kill('SIGKILL')
    await p.exited
  }
}

/** Pids of every live process whose environment carries MARKER_VAR=id. Linux only. */
export function markedPids(id: string): number[] {
  const needle = `${MARKER_VAR}=${id}`
  const out: number[] = []
  let entries: string[]
  try {
    entries = readdirSync('/proc')
  } catch {
    return out
  }
  for (const e of entries) {
    if (!/^\d+$/.test(e)) continue
    const pid = Number(e)
    if (pid === process.pid) continue
    try {
      const env = readFileSync(`/proc/${e}/environ`, 'latin1')
      if (env.split('\0').includes(needle)) out.push(pid)
    } catch {
      // not ours to read, or already gone
    }
  }
  return out
}

/** SIGKILL every straggler holding the marker. Returns the pids it had to kill. */
export function sweepMarked(id: string): number[] {
  const pids = markedPids(id)
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // raced with its own exit
    }
  }
  return pids
}
