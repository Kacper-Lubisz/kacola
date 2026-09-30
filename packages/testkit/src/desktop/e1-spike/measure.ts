// E-1 footprint spike (docs/desktop-app.md): idle memory of the whole process tree + cold start, the GTK
// window (`node packages/ui/dist/bundle.mjs`, build it first) vs a minimal sandboxed Electron window
// (./main.mjs), inside the headless GNOME Shell on Wayland.
//
//   node packages/testkit/src/desktop/e1-spike/measure.ts        RUNS=n  ONLY=1 (Electron only)  EXTRA="--flags"
import { join } from 'node:path'
import { startDaemon } from '../../daemon/index.ts'
import { type AppHandle, type HeadlessDisplay, startHeadlessDisplay } from '../../ui/index.ts'
import { type Footprint, firstPixelsProbe, footprint, processTree } from '../footprint.ts'
import { ELECTRON_BIN } from '../index.ts'

const ROOT = join(import.meta.dirname, '../../../../..')
const OUT = process.env.OUT ?? join(import.meta.dirname, '__artifacts__')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Result = { name: string; firstPixelsMs: number; readyMs: number; idle: Footprint }

async function run(
  name: string,
  launch: (d: HeadlessDisplay, t0: number) => AppHandle,
  ready: (d: HeadlessDisplay, app: AppHandle) => Promise<unknown>,
): Promise<Result> {
  const d = await startHeadlessDisplay({ size: '1280x800' })
  try {
    await sleep(1500)
    const probe = await firstPixelsProbe(d, join(OUT, name))
    const t0 = Date.now()
    const app = launch(d, t0)
    const [firstPixelsMs, readyMs] = await Promise.all([probe(t0), ready(d, app).then(() => Date.now() - t0)])
    await sleep(15_000) // settle to idle
    const idle = footprint(processTree(app.pid))
    if (app.hasExited()) throw new Error(`${name} exited:\n${app.log()}`)
    await app.stop()
    return { name, firstPixelsMs, readyMs, idle }
  } finally {
    await d.close()
  }
}

const daemon = await startDaemon()
const results: Result[] = []
for (let i = 0; i < Number(process.env.RUNS ?? 3); i++) {
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
          command: ELECTRON_BIN,
          args: [
            join(import.meta.dirname, 'main.mjs'),
            ...(process.env.EXTRA?.split(' ').filter(Boolean) ?? []),
          ],
          env: { SPIKE_T0: String(t0) },
        }),
      async (_d, app) => {
        while (!app.log().includes('"ready-to-show"')) {
          if (app.hasExited()) throw new Error(app.log())
          await sleep(20)
        }
      },
    ),
  )
}
await daemon.stop()
for (const r of results) {
  const { rssMb, pssMb, ussMb, processes } = r.idle
  console.log(
    JSON.stringify({
      name: r.name,
      firstPixelsMs: r.firstPixelsMs,
      readyMs: r.readyMs,
      rssMb,
      pssMb,
      ussMb,
      procs: processes.length,
    }),
  )
}
for (const r of results) console.log(r.name, r.idle.processes.map((p) => `${p.kind}=${p.rssMb}`).join(' '))
