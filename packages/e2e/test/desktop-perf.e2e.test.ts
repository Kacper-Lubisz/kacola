import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import {
  buildDesktop,
  ELECTRON_BIN,
  firstPixelsProbe,
  footprint,
  MAIN_ENTRY,
  processTree,
} from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The E-1 footprint gate, kept on the record for the real app (docs/desktop-app.md). NON-BLOCKING:
// it records idle PSS / USS / RSS and cold start to __artifacts__/desktop-perf.json and warns when idle
// PSS is over the 350 MB gate — a regression shows up in the output without failing the suite on a
// machine with a different GPU stack. It fails only if the app does not come up at all.
//
// Launched through the display directly (not Playwright), so no inspector / CDP overhead is counted.

const GATE_PSS_MB = 350
const ARTIFACTS = join(import.meta.dirname, '__artifacts__')

let display: HeadlessDisplay
let daemon: DaemonHandle

beforeAll(async () => {
  buildDesktop()
  daemon = await startDaemon()
  for (const title of ['Weekly product sync', 'Design review', '1:1 with Sam'])
    await daemon.client.call('createSession', { body: { title } })
  display = await startHeadlessDisplay({ size: '1280x800' })
}, 240_000)

afterAll(async () => {
  await display?.close()
  await daemon?.stop()
})

describe('desktop footprint (non-blocking)', () => {
  it('records idle memory and cold start of the real window', async () => {
    await new Promise((r) => setTimeout(r, 1500))
    const probe = await firstPixelsProbe(display, join(ARTIFACTS, 'desktop-perf'))
    const t0 = Date.now()
    const app = display.launchApp({
      command: ELECTRON_BIN,
      args: [MAIN_ENTRY],
      env: { GNOMEOLA_URL: daemon.baseUrl },
    })
    const firstPixelsMs = await probe(t0)
    let windowReadyMs = -1
    for (const deadline = Date.now() + 30_000; Date.now() < deadline; ) {
      if (app.log().includes('"window-ready"')) {
        windowReadyMs = Date.now() - t0
        break
      }
      await new Promise((r) => setTimeout(r, 20))
    }
    await new Promise((r) => setTimeout(r, 15_000)) // settle to idle
    expect(app.hasExited(), app.log().slice(-2000)).toBe(false)
    const idle = footprint(processTree(app.pid))
    await app.stop()

    const record = {
      at: new Date().toISOString(),
      firstPixelsMs,
      windowReadyMs,
      ...idle,
      gatePssMb: GATE_PSS_MB,
    }
    mkdirSync(ARTIFACTS, { recursive: true })
    writeFileSync(join(ARTIFACTS, 'desktop-perf.json'), `${JSON.stringify(record, null, 2)}\n`)
    console.log(
      `desktop footprint: idle PSS ${idle.pssMb} MB, USS ${idle.ussMb} MB, RSS(sum) ${idle.rssMb} MB, ` +
        `${idle.processes.length} processes; first pixels ${firstPixelsMs} ms, window ready ${windowReadyMs} ms`,
    )
    if (idle.pssMb > GATE_PSS_MB)
      console.warn(
        `⚠ desktop idle PSS ${idle.pssMb} MB is over the ${GATE_PSS_MB} MB gate (docs/desktop-app.md)`,
      )
    expect(windowReadyMs).toBeGreaterThan(0)
  }, 120_000)
})
