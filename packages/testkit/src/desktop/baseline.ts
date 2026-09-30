import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'

// Screenshot baselines for the Electron window (Playwright's toHaveScreenshot, without its test runner):
// compare a fresh PNG with a committed baseline using Playwright's own image comparator (the same
// pixelmatch-based one toHaveScreenshot uses). A missing baseline — or UPDATE_BASELINES=1 — writes it
// and passes; a mismatch copies the actual image and a diff next to the artifacts and throws.

type Comparator = (
  actual: Buffer,
  expected: Buffer,
  options?: { maxDiffPixels?: number; maxDiffPixelRatio?: number; threshold?: number },
) => { errorMessage: string; diff?: Buffer } | null

const require = createRequire(import.meta.url)
let comparator: Comparator | null = null
function png(): Comparator {
  if (!comparator) {
    // playwright-core's bundled utils (what @playwright/test's toHaveScreenshot calls)
    const core = require('playwright-core/lib/coreBundle') as {
      utils: { getComparator: (mime: string) => Comparator }
    }
    comparator = core.utils.getComparator('image/png')
  }
  return comparator
}

export type BaselineOptions = {
  /** Per-pixel colour distance tolerated (0…1, default 0.2 as in Playwright). */
  threshold?: number
  /** Share of pixels allowed to differ (default 0.002: anti-aliasing noise, not a layout change). */
  maxDiffPixelRatio?: number
  /** Where the actual image and the diff go on a mismatch. */
  artifactsDir: string
}

export type BaselineResult = 'matched' | 'written'

export function matchBaseline(actualPath: string, baselinePath: string, o: BaselineOptions): BaselineResult {
  const actual = readFileSync(actualPath)
  if (process.env.UPDATE_BASELINES === '1' || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true })
    copyFileSync(actualPath, baselinePath)
    return 'written'
  }
  const r = png()(actual, readFileSync(baselinePath), {
    threshold: o.threshold ?? 0.2,
    maxDiffPixelRatio: o.maxDiffPixelRatio ?? 0.002,
  })
  if (!r) return 'matched'
  mkdirSync(o.artifactsDir, { recursive: true })
  const stem = basename(baselinePath, '.png')
  const diffPath = join(o.artifactsDir, `${stem}-diff.png`)
  if (r.diff) writeFileSync(diffPath, r.diff)
  copyFileSync(actualPath, join(o.artifactsDir, `${stem}-actual.png`))
  throw new Error(
    `screenshot ${stem} differs from its baseline (${baselinePath}): ${r.errorMessage}\n` +
      `actual + diff in ${o.artifactsDir}; if the change is intended, re-run with UPDATE_BASELINES=1`,
  )
}
