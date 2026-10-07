import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { formatOffset, type Segment } from '@kacola/protocol'
import { type DesktopApp, matchBaseline } from '@kacola/testkit/desktop'

type Page = DesktopApp['window']
type Locator = ReturnType<Page['getByRole']>

// Helpers for the Electron window's feature e2e (transcript, ask, speakers): the ported GTK suites'
// vocabulary over Playwright. Page-side code is passed as strings (this package has no DOM lib).

export const speakerName = (s: string) => (s === 'me' ? 'Me' : s === 'them' ? 'Them' : s)
/** A transcript line's accessible name — the GTK app's, so the assertions port one to one. */
export const rowName = (s: Pick<Segment, 'speaker' | 'startMs' | 'text'>) =>
  `${speakerName(s.speaker)} at ${formatOffset(s.startMs)}: ${s.text}`

export const transcriptList = (w: Page): Locator => w.getByRole('listbox', { name: 'Transcript' })

/** Names of the transcript rows that exist in the DOM (the virtualiser's window), in order. */
export async function rowNames(w: Page): Promise<string[]> {
  return (await w.evaluate(`(() => {
    const list = document.querySelector('[role=listbox][aria-label="Transcript"]')
    if (!list) return []
    return [...list.querySelectorAll('[role=option]')]
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      .map((o) => o.getAttribute('aria-label'))
  })()`)) as string[]
}

/** Names of the rows actually on screen (intersecting the scroller's viewport), in order. */
export async function visibleRowNames(w: Page): Promise<string[]> {
  return (await w.evaluate(`(() => {
    const list = document.querySelector('[role=listbox][aria-label="Transcript"]')
    if (!list || list.closest('[inert]')) return []
    const box = list.getBoundingClientRect()
    return [...list.querySelectorAll('[role=option]')]
      .filter((o) => { const r = o.getBoundingClientRect(); return r.bottom > box.top + 2 && r.top < box.bottom - 2 })
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      .map((o) => o.getAttribute('aria-label'))
  })()`)) as string[]
}

/** Names of the selected (highlighted) transcript rows. */
export async function selectedRowNames(w: Page): Promise<string[]> {
  return (await w.evaluate(`(() => [...document.querySelectorAll(
    '[role=listbox][aria-label="Transcript"] [role=option][aria-selected=true]')].map((o) => o.getAttribute('aria-label')))()`)) as string[]
}

/** Total rows the list holds (aria-setsize), not just the rendered window. */
export async function rowCount(w: Page): Promise<number> {
  return (await w.evaluate(`(() => {
    const o = document.querySelector('[role=listbox][aria-label="Transcript"] [role=option]')
    return o ? Number(o.getAttribute('aria-setsize')) : 0
  })()`)) as number
}

/** Poll `probe` until it returns a truthy value (fast: 10 ms), or throw after `ms`. */
export async function poll<T>(
  probe: () => Promise<T | null | undefined | false>,
  ms: number,
  what: string,
): Promise<T> {
  const until = Date.now() + ms
  let last: unknown
  for (;;) {
    try {
      const v = await probe()
      if (v) return v
    } catch (e) {
      last = e
    }
    if (Date.now() > until)
      throw new Error(`timed out after ${ms} ms waiting for ${what}${last ? `: ${String(last)}` : ''}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

/** Switch the window between light and dark at runtime (the attributes main's theme push sets). */
export async function setScheme(w: Page, scheme: 'light' | 'dark'): Promise<void> {
  await w.evaluate(`(() => {
    const r = document.documentElement
    r.dataset.scheme = ${JSON.stringify(scheme)}
    r.dataset.theme = ${JSON.stringify(scheme)}
  })()`)
  await w.waitForTimeout(80)
}

const BASELINES = join(import.meta.dirname, '..', 'test', '__screenshots__', 'desktop')
const ARTIFACTS = join(import.meta.dirname, '..', 'test', '__artifacts__', 'desktop')

/**
 * Screenshot baseline check: the page (or one element, `region` — a pane, a dialog — so a baseline does
 * not move with the rest of the window) is captured to __artifacts__ and compared with
 * test/__screenshots__/desktop/<name>.png by the testkit's comparator (matchBaseline: a missing baseline
 * is written; KACOLA_UPDATE_SCREENSHOTS=1 rewrites them). `maxDiff` is the tolerated share of
 * differing pixels — live screens (streaming text, a growing transcript) need more than static ones.
 */
export async function expectScreenshot(
  app: DesktopApp,
  name: string,
  opts: { maxDiff?: number; threshold?: number; region?: Locator } = {},
): Promise<string> {
  const out = join(ARTIFACTS, `${name}.png`)
  mkdirSync(ARTIFACTS, { recursive: true })
  // caret: 'initial' — hiding the caret injects an inline <style>, which our CSP rightly refuses
  if (opts.region) await opts.region.screenshot({ path: out, caret: 'initial', animations: 'allow' })
  const shot = opts.region ? out : await app.screenshot(out)
  const failure = matchBaseline(shot, join(BASELINES, `${name}.png`), {
    maxDiffRatio: opts.maxDiff ?? 0.01,
    threshold: opts.threshold ?? 0.06,
  })
  if (failure) throw new Error(`screenshot ${name}: ${failure}`)
  return shot
}
