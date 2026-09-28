import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type AccessibleNode, type AppHandle, flatten, type HeadlessDisplay } from '@gnomeola/testkit/ui'

// Helpers for driving the real gnomeola window (packages/ui, built bundle) in the testkit's headless
// GNOME Shell, against a real daemon. Used by packages/e2e/test/*.e2e.test.ts.

export const UI_DIR = resolve(import.meta.dirname, '..', '..', 'ui')
export const BUNDLE = join(UI_DIR, 'dist', 'bundle.mjs')
export const APP = 'gnomeola'

let built = false
/**
 * Build the UI bundle once per test process. Always from source: an e2e run against a stale bundle
 * proves nothing. NODE_ENV must be production (vitest sets "test"; see docs/gtkx.md §2).
 */
export function buildUi(): void {
  if (built) return
  execFileSync('pnpm', ['run', 'build'], {
    cwd: UI_DIR,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  if (!existsSync(BUNDLE)) throw new Error(`build did not produce ${BUNDLE}`)
  built = true
}

/** The tail of an app's log, with minified-bundle lines cut short so failures stay readable. */
export const logTail = (app: AppHandle, n = 6000): string =>
  app
    .log()
    .slice(-n)
    .split('\n')
    .map((l) => (l.length > 300 ? `${l.slice(0, 300)}…` : l))
    .join('\n')

/**
 * Mark onboarding as done in the display's private XDG_STATE_HOME, so it does not open by itself.
 * `skipped`: model ids that were missing when it was skipped (the fake daemon's final model is).
 */
export function markOnboarded(d: HeadlessDisplay, skipped: string[] = ['whisper-small.en']): void {
  const dir = join(d.env.XDG_STATE_HOME!, 'gnomeola')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'ui-state.json'),
    JSON.stringify({ version: 1, onboardingDone: true, skippedMissing: skipped }),
  )
}

export function launchUi(d: HeadlessDisplay, env: Record<string, string>): AppHandle {
  return d.launchApp({ command: process.execPath, args: [BUNDLE], cwd: UI_DIR, env })
}

/** Wait for the main window, with the app's log in the failure message. */
export async function waitForWindow(d: HeadlessDisplay, app: AppHandle, timeoutMs = 30_000): Promise<void> {
  await d.findOne({ app: APP, role: 'frame', name: 'gnomeola' }, timeoutMs).catch((e: Error) => {
    throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
  })
}

const INTERACTIVE = new Set([
  'button',
  'toggle button',
  'check box',
  'entry',
  'text',
  'password text',
  'list item',
  'list',
  'combo box',
  'slider',
  'spin button',
  'switch',
  'level bar',
  'progress bar',
  'menu item',
  'link',
])

/**
 * A11y audit: every showing interactive widget must have a name, or AT-SPI tests (and screen reader
 * users) cannot tell what it is. Descendants of a named `combo box` are skipped: AdwComboRow exposes
 * its current-value display as an unnamed list/list item (libadwaita's, see docs/gtkx.md §5).
 */
export async function unnamedInteractive(d: HeadlessDisplay): Promise<string[]> {
  const out: string[] = []
  const visit = (n: AccessibleNode, inCombo: boolean) => {
    const combo = inCombo || n.role === 'combo box'
    if (!inCombo && INTERACTIVE.has(n.role) && n.states.includes('showing') && n.name.trim() === '') {
      out.push(`${n.role} (ref ${n.ref})`)
    }
    for (const c of n.children ?? []) visit(c, combo)
  }
  for (const root of await d.accessibleTree({ app: APP })) visit(root, false)
  return out
}

/** Every name and text in the app's accessible tree, for "this secret never appears" checks. */
export async function allAccessibleText(d: HeadlessDisplay): Promise<string> {
  const nodes = flatten(await d.accessibleTree({ app: APP }))
  return nodes.map((n) => `${n.name}\n${n.description}\n${n.text ?? ''}`).join('\n')
}

/** Lines the app printed with GNOMEOLA_UI_PERF=1. */
export function perfLines(app: AppHandle): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of app.log().split('\n')) {
    if (!line.startsWith('{"perf"')) continue
    try {
      out.push(JSON.parse(line) as Record<string, unknown>)
    } catch {}
  }
  return out
}
