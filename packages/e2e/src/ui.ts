import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HeadlessDisplay } from '@kacola/testkit/ui'

// Window state shared by the desktop suites (packages/e2e/test/desktop-*.e2e.test.ts, install.e2e).

/**
 * Mark onboarding as done in the display's private XDG_STATE_HOME, so it does not open by itself.
 * `skipped`: model ids that were missing when it was skipped (the fake daemon's final model is).
 */
export function markOnboarded(d: HeadlessDisplay, skipped: string[] = ['whisper-small.en']): void {
  const dir = join(d.env.XDG_STATE_HOME!, 'kacola')
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
