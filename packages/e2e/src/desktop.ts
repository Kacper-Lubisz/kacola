import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type DesktopApp, matchBaseline } from '@gnomeola/testkit/desktop'
import type { HeadlessDisplay } from '@gnomeola/testkit/ui'

// Helpers for the Electron window e2e (packages/e2e/test/desktop-*.e2e.test.ts).

export const DESKTOP_ARTIFACTS = join(import.meta.dirname, '..', 'test', '__artifacts__', 'desktop')
export const BASELINES = join(import.meta.dirname, '..', 'test', '__screenshots__', 'desktop')

/** Mark onboarding done in the display's private XDG_STATE_HOME (the file both window apps read). */
export function markOnboarded(d: HeadlessDisplay, skipped: string[] = ['whisper-small.en']): void {
  const dir = join(d.env.XDG_STATE_HOME!, 'gnomeola')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'ui-state.json'),
    // the top-bar extension card dismissed too: the headless Shell never has it, and the suites'
    // screens are not about it (desktop-extension.e2e is)
    JSON.stringify({
      version: 1,
      onboardingDone: true,
      skippedMissing: skipped,
      extensionCardDismissed: true,
    }),
  )
}

export const uiStatePath = (d: HeadlessDisplay) => join(d.env.XDG_STATE_HOME!, 'gnomeola', 'ui-state.json')

/** Every text the page shows or holds (text content + input values), for "this secret never appears". */
export async function pageText(app: DesktopApp): Promise<string> {
  return (await app.window.evaluate(`(() => {
    const vals = [...document.querySelectorAll('input, textarea')].map((e) => e.value)
    const attrs = [...document.querySelectorAll('*')].flatMap((e) =>
      [...e.attributes].filter((a) => a.name.startsWith('aria-') || a.name === 'title').map((a) => a.value))
    return [document.body.innerText, ...vals, ...attrs].join('\\n')
  })()`)) as string
}

/** Screenshot the page and compare it with its baseline; returns the failure text or null. */
export async function baseline(app: DesktopApp, name: string): Promise<string | null> {
  // let fonts, transitions and the caret settle
  await app.window.evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))')
  const shot = await app.screenshot(join(DESKTOP_ARTIFACTS, `${name}.png`))
  return matchBaseline(shot, join(BASELINES, `${name}.png`))
}

/** Set the renderer's theme the way main pushes it (for screenshots / axe in each mode, one launch). */
export async function setTheme(
  app: DesktopApp,
  scheme: 'light' | 'dark',
  contrast: 'normal' | 'high' = 'normal',
) {
  await app.window.evaluate(
    `(() => { const r = document.documentElement; r.dataset.theme = ${JSON.stringify(scheme)}; r.dataset.scheme = ${JSON.stringify(scheme)}; r.dataset.contrast = ${JSON.stringify(contrast)} })()`,
  )
}
