import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { HeadlessDisplay } from '../ui/index.ts'

// Memory and cold-start probes for the E-1 gate (docs/desktop-app.md): the app's whole process tree
// from /proc (Linux only), and "first pixels" as the first compositor screenshot that differs from the
// empty desktop — the same probe for the GTK and the Electron window.

/** `root` and every descendant pid. */
export function processTree(root: number): number[] {
  const kids = new Map<number, number[]>()
  for (const e of readdirSync('/proc')) {
    if (!/^\d+$/.test(e)) continue
    try {
      const stat = readFileSync(`/proc/${e}/stat`, 'utf8')
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      kids.set(ppid, [...(kids.get(ppid) ?? []), Number(e)])
    } catch {
      // gone
    }
  }
  const out: number[] = []
  const walk = (p: number) => {
    out.push(p)
    for (const k of kids.get(p) ?? []) walk(k)
  }
  walk(root)
  return out
}

export type Footprint = {
  /** Summed RSS: double-counts pages the processes share (Chromium maps its libraries into all). */
  rssMb: number
  /** Summed PSS: shared pages divided among their sharers — the gate's figure. */
  pssMb: number
  /** Summed USS (private pages): what quitting would free. */
  ussMb: number
  processes: { pid: number; kind: string; rssMb: number; pssMb: number }[]
}

export function footprint(pids: number[]): Footprint {
  let rss = 0
  let pss = 0
  let uss = 0
  const processes: Footprint['processes'] = []
  for (const pid of pids) {
    try {
      const roll = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8')
      const field = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(roll)?.[1] ?? 0)
      const r = field('Rss')
      const p = field('Pss')
      rss += r
      pss += p
      uss += field('Private_Clean') + field('Private_Dirty')
      // Chromium rewrites its children's argv into one space-separated string
      const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split(/[\0 ]/)
      const kind =
        (argv.find((a) => a.startsWith('--type='))?.slice(7) ?? argv[0]!.split('/').pop()!) +
        (argv.find((a) => a.startsWith('--utility-sub-type='))?.replace('--utility-sub-type=', ':') ?? '')
      processes.push({ pid, kind, rssMb: Math.round(r / 1024), pssMb: Math.round(p / 1024) })
    } catch {
      // exited between listing and reading
    }
  }
  return {
    rssMb: Math.round(rss / 1024),
    pssMb: Math.round(pss / 1024),
    ussMb: Math.round(uss / 1024),
    processes,
  }
}

/** Screenshot the (empty) display now; returns a probe that resolves ms-since-t0 at the first change. */
export async function firstPixelsProbe(
  display: HeadlessDisplay,
  dir: string,
): Promise<(t0: number, timeoutMs?: number) => Promise<number>> {
  const base = statSync(await display.screenshot(join(dir, 'base.png'))).size
  return async (t0, timeoutMs = 30_000) => {
    for (let i = 0; ; i++) {
      const size = statSync(await display.screenshot(join(dir, `probe-${i % 4}.png`))).size
      if (Math.abs(size - base) > base * 0.05 + 2000) return Date.now() - t0
      if (Date.now() - t0 > timeoutMs) throw new Error(`nothing painted within ${timeoutMs} ms`)
    }
  }
}
