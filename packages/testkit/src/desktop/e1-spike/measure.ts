// E-1 footprint measurement: idle RSS/PSS (whole process tree) + cold start, GTK vs Electron,
// inside the headless GNOME Shell (Wayland).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { startDaemon } from '../../daemon/index.ts'
import { type AppHandle, type HeadlessDisplay, startHeadlessDisplay } from '../../ui/index.ts'

const ROOT = join(import.meta.dirname, '../../../../..')
const ELECTRON = join(ROOT, 'packages/desktop/node_modules/electron/dist/electron')
const OUT = process.env.OUT ?? join(import.meta.dirname, '__artifacts__')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function tree(root: number): number[] {
  const kids = new Map<number, number[]>()
  for (const e of readdirSync('/proc')) {
    if (!/^\d+$/.test(e)) continue
    try {
      const stat = readFileSync(`/proc/${e}/stat`, 'utf8')
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      kids.set(ppid, [...(kids.get(ppid) ?? []), Number(e)])
    } catch {}
  }
  const out: number[] = []
  const walk = (p: number) => {
    out.push(p)
    for (const k of kids.get(p) ?? []) walk(k)
  }
  walk(root)
  return out
}

function mem(pids: number[]) {
  let rss = 0
  let pss = 0
  let uss = 0
  const per: { pid: number; cmd: string; rssKb: number }[] = []
  for (const pid of pids) {
    try {
      const roll = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8')
      const r = Number(/^Rss:\s+(\d+)/m.exec(roll)?.[1] ?? 0)
      const p = Number(/^Pss:\s+(\d+)/m.exec(roll)?.[1] ?? 0)
      rss += r
      uss +=
        Number(/^Private_Clean:\s+(\d+)/m.exec(roll)?.[1] ?? 0) +
        Number(/^Private_Dirty:\s+(\d+)/m.exec(roll)?.[1] ?? 0)
      pss += p
      const cl = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')
      const cmd =
        (cl.find((a) => a.startsWith('--type=')) ?? cl[0]!.split('/').pop()!) +
        (cl.find((a) => a.startsWith('--utility-sub-type=')) ?? '')
      per.push({ pid, cmd, rssKb: r })
    } catch {}
  }
  return { rssMb: Math.round(rss / 1024), pssMb: Math.round(pss / 1024), ussMb: Math.round(uss / 1024), per }
}

async function firstChange(d: HeadlessDisplay, baseline: number, t0: number, tag: string): Promise<number> {
  for (let i = 0; ; i++) {
    const p = await d.screenshot(join(OUT, `shots/${tag}-${i}.png`))
    const size = statSync(p).size
    if (Math.abs(size - baseline) > baseline * 0.05 + 2000) return Date.now() - t0
    if (Date.now() - t0 > 30_000) throw new Error(`${tag}: nothing painted in 30 s`)
  }
}

type Result = { name: string; firstPixelsMs: number; readyMs: number; idle: ReturnType<typeof mem> }

async function run(
  name: string,
  launch: (d: HeadlessDisplay, t0: number) => AppHandle,
  ready: (d: HeadlessDisplay, app: AppHandle) => Promise<unknown>,
): Promise<Result> {
  const d = await startHeadlessDisplay({ size: '1280x800' })
  try {
    await sleep(1500)
    const base = statSync(await d.screenshot(join(OUT, `shots/${name}-base.png`))).size
    const t0 = Date.now()
    const app = launch(d, t0)
    const [firstPixelsMs, readyMs] = await Promise.all([
      firstChange(d, base, t0, name),
      ready(d, app).then(() => Date.now() - t0),
    ])
    await sleep(15_000) // settle to idle
    const idle = mem(tree(app.pid))
    await d.screenshot(join(OUT, `shots/${name}-idle.png`))
    if (app.hasExited()) throw new Error(`${name} exited:\n${app.log()}`)
    await app.stop()
    return { name, firstPixelsMs, readyMs, idle }
  } finally {
    await d.close()
  }
}

const RUNS = Number(process.env.RUNS ?? 3)
const daemon = await startDaemon()
const results: Result[] = []
for (let i = 0; i < RUNS; i++) {
  if (!process.env.ONLY)
    results.push(
      await run(
        `gtk${i}`,
        (d) =>
          d.launchApp({
            command: process.execPath,
            args: [join(ROOT, 'packages/ui/dist/bundle.mjs')],
            cwd: join(ROOT, 'packages/ui'),
            env: { GNOMEOLA_URL: daemon.baseUrl },
          }),
        (d) => d.findOne({ app: 'gnomeola', role: 'label', name: 'No Session Selected' }, 30_000),
      ),
    )
  results.push(
    await run(
      `electron${i}`,
      (d, t0) =>
        d.launchApp({
          command: ELECTRON,
          args: [
            join(import.meta.dirname, 'main.mjs'),
            ...(process.env.EXTRA?.split(' ').filter(Boolean) ?? []),
          ],
          env: { SPIKE_T0: String(t0), ELECTRON_OZONE_PLATFORM_HINT: 'wayland' },
        }),
      async (_d, app) => {
        for (;;) {
          if (app.log().includes('"ready-to-show"')) return
          if (app.hasExited()) throw new Error(app.log())
          await sleep(20)
        }
      },
    ),
  )
}
for (const r of results) {
  console.log(
    JSON.stringify({
      name: r.name,
      firstPixelsMs: r.firstPixelsMs,
      readyMs: r.readyMs,
      rssMb: r.idle.rssMb,
      pssMb: r.idle.pssMb,
      ussMb: r.idle.ussMb,
      procs: r.idle.per.length,
    }),
  )
}
await daemon.stop()
for (const r of results)
  console.log(r.name, r.idle.per.map((p) => `${p.cmd}=${Math.round(p.rssKb / 1024)}`).join(' '))
