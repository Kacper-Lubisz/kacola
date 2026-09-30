import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { _electron, type ElectronApplication, type Page } from 'playwright-core'
import type { HeadlessDisplay } from '../ui/index.ts'
import { MARKER_VAR } from '../ui/processes.ts'

// @gnomeola/testkit/desktop — the Electron window under Playwright, inside the headless GNOME Shell.
//
//   const display = await startHeadlessDisplay()
//   buildDesktop()                                   // once per file: an e2e against a stale build proves nothing
//   const app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
//   await app.window.getByRole('listbox', { name: 'Sessions' }).waitFor()
//   expect(await app.axe()).toEqual([])
//   await app.close()
//
// Locators are role + name (getByRole), the same contract the AT-SPI suite used, so assertions port
// one to one. Every launch collects console errors, page errors and CSP violations; `problems()`
// returns them and a test should end with `expect(app.problems()).toEqual([])`.

export const DESKTOP_DIR = join(import.meta.dirname, '..', '..', '..', 'desktop')
export const ELECTRON_BIN = join(DESKTOP_DIR, 'node_modules', 'electron', 'dist', 'electron')
export const MAIN_ENTRY = join(DESKTOP_DIR, 'out', 'main', 'index.js')

/** `pnpm --filter @gnomeola/desktop build` (electron-vite: main, preload, renderer). */
export function buildDesktop(): void {
  execFileSync('pnpm', ['run', 'build'], {
    cwd: DESKTOP_DIR,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  if (!existsSync(MAIN_ENTRY)) throw new Error(`desktop build produced no ${MAIN_ENTRY}`)
}

export type LaunchDesktopOptions = {
  display: HeadlessDisplay
  /** Extra environment (GNOMEOLA_URL, GNOMEOLA_COLOR_SCHEME, GNOMEOLA_DAEMON_ARGS …). */
  env?: Record<string, string | undefined>
  /** Extra argv (e.g. --background). */
  args?: string[]
  /** Wait for a window (default true; false for --background). */
  window?: boolean
  timeoutMs?: number
}

export type DesktopApp = {
  app: ElectronApplication
  /** The main window's page (undefined with `window: false`). */
  window: Page
  /** Everything main wrote to stdout/stderr (JSON lines: {"event":"daemon",…}, {"event":"window-ready"}). */
  log: () => string
  /** Console errors, page errors and CSP violations seen so far. */
  problems: () => string[]
  /** axe-core over the current page: violations as "rule-id: target" strings (empty = clean). */
  axe: (opts?: { disableRules?: string[] }) => Promise<string[]>
  /** PNG of the page as Chromium renders it. */
  screenshot: (path: string) => Promise<string>
  /** Evaluate in the main process (Playwright passes the electron module). */
  evaluateMain: ElectronApplication['evaluate']
  pid: number
  close: () => Promise<void>
}

export async function launchDesktop(o: LaunchDesktopOptions): Promise<DesktopApp> {
  if (!existsSync(ELECTRON_BIN)) throw new Error(`no Electron binary at ${ELECTRON_BIN} (pnpm install)`)
  const env: Record<string, string> = { ...o.display.env }
  for (const [k, v] of Object.entries(o.env ?? {})) {
    if (v === undefined) delete env[k]
    else env[k] = v
  }
  env[MARKER_VAR] = o.display.env[MARKER_VAR] ?? ''
  // never the user's daemon or data: a test must pass GNOMEOLA_URL (or get a daemon spawned on a temp dir)
  env.GNOMEOLA_URL ??= 'http://127.0.0.1:9'
  let out = ''
  const app = await _electron.launch({
    executablePath: ELECTRON_BIN,
    args: [MAIN_ENTRY, ...(o.args ?? [])],
    env,
    cwd: DESKTOP_DIR,
    timeout: o.timeoutMs ?? 30_000,
  })
  const proc = app.process()
  proc.stdout?.on('data', (d: Buffer) => {
    out += d.toString()
  })
  proc.stderr?.on('data', (d: Buffer) => {
    out += d.toString()
  })
  const problems: string[] = []
  const watch = (p: Page) => {
    p.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy/i.test(m.text()))
        problems.push(`console: ${m.text()}`)
    })
    p.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  }
  app.on('window', watch)
  let window = undefined as unknown as Page
  if (o.window !== false) {
    window = await app.firstWindow({ timeout: o.timeoutMs ?? 30_000 })
    watch(window)
    await window.waitForLoadState('domcontentloaded')
  }
  let closed = false
  return {
    app,
    window,
    log: () => out,
    problems: () => [...problems],
    async axe(opts = {}) {
      // legacy mode: the default opens a helper page, which Electron's CDP target does not support
      const r = await new AxeBuilder({ page: window })
        .setLegacyMode(true)
        .disableRules(opts.disableRules ?? [])
        .analyze()
      return r.violations.flatMap((v) =>
        v.nodes.map(
          (n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 120)} — ${n.failureSummary ?? v.help}`,
        ),
      )
    },
    async screenshot(path) {
      mkdirSync(dirname(path), { recursive: true })
      // caret: 'initial' — hiding the caret injects an inline <style>, which our CSP rightly refuses
      await window.screenshot({ path, caret: 'initial' })
      return path
    },
    evaluateMain: app.evaluate.bind(app) as ElectronApplication['evaluate'],
    pid: proc.pid ?? -1,
    async close() {
      if (closed) return
      closed = true
      // explicit quit: main stops the daemon it spawned, then exits. Playwright's close() can linger on
      // its CDP pipe after the process is gone, so the process exit is what we wait for.
      const exited = new Promise<void>((r) => {
        if (proc.exitCode !== null || proc.signalCode !== null) r()
        else proc.once('exit', () => r())
      })
      void app.close().catch(() => {})
      const timer = setTimeout(() => proc.kill('SIGKILL'), 20_000)
      await exited
      clearTimeout(timer)
    },
  }
}

/** The daemon supervisor's state, asked through the bridge (main's early log lines predate Playwright). */
export async function daemonStatus(app: DesktopApp): Promise<{ kind: string }> {
  return app.window.evaluate(() =>
    (
      globalThis as unknown as { gnomeola: { daemonStatus(): Promise<{ kind: string }> } }
    ).gnomeola.daemonStatus(),
  )
}

/** Poll the supervisor until it reports `kind` (attached, spawned, unreachable …). */
export async function waitForDaemon(app: DesktopApp, kind: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last = ''
  for (;;) {
    last = (await daemonStatus(app).catch((e: Error) => ({ kind: `error: ${e.message}` }))).kind
    if (last === kind) return
    if (Date.now() > deadline)
      throw new Error(`daemon status stayed ${last}, wanted ${kind}\n${app.log().slice(-3000)}`)
    await new Promise((r) => setTimeout(r, 100))
  }
}

/** Resolve when main has logged a line matching `re` (e.g. /"event":"daemon","kind":"spawned"/). */
export async function waitForLog(app: DesktopApp, re: RegExp, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const m = app
      .log()
      .split('\n')
      .find((l) => re.test(l))
    if (m) return m
    if (Date.now() > deadline)
      throw new Error(`timed out waiting for ${re} in main's log:\n${app.log().slice(-3000)}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}
export * from './baseline.ts'
export * from './footprint.ts'
