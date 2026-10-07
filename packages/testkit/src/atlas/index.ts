import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright-core'
import { comparePng, decodePng, encodePng, type Rgba } from '../desktop/screenshot.ts'
import { ATLAS, type AtlasEntry, type Surface, WIDTHS_MAIN, WIDTHS_ONE } from './manifest.ts'

// The screen atlas (docs/user-stories.md): every state a user story touches, captured from the real
// window / top-bar extension / web viewer into one directory that scripts/build-atlas.ts turns into the
// design-iteration page. Each capture first asserts that its state really rendered (a role + name
// locator), then shoots it in light and dark at each width the manifest gives it:
//
//   <ATLAS_DIR>/shots/<story>__<step>__<state>__<theme>__<width>.png
//   <ATLAS_DIR>/captured-<surface>.json      what this run captured, and whether each image matched the
//                                             previous run's byte-for-pixel (the determinism check)
//
// A run moves the last run's shots to <ATLAS_DIR>/previous/ first, so running the suite twice compares
// the two runs. Content is frozen for that: fixed data, a fixed renderer clock, reduced motion, no focus
// ring, the pointer parked, and anything that still shows wall-clock time covered by an opaque mask
// (declared per shot, listed on the page).

export const ATLAS_DIR =
  process.env.KACOLA_ATLAS_DIR ?? join(import.meta.dirname, '..', '..', '..', '..', 'dist', 'atlas')
export const SHOTS = join(ATLAS_DIR, 'shots')
const PREVIOUS = join(ATLAS_DIR, 'previous')

/** The window's fixed "now" (renderer Date only): seeded sessions are dated just before it. */
export const ATLAS_NOW = '2026-03-12T15:30:00.000Z'
/** Opaque, theme-neutral: what a masked (wall-clock) region shows. */
const MASK_COLOR = '#A89A84'
export const HEIGHT = 760

export type Theme = 'light' | 'dark'
export type CapturedFile = { file: string; theme: Theme; width: number; stable: boolean | null; diff: number }
export type Captured = { id: string; files: CapturedFile[]; masked: number; text?: string; stable?: boolean }

const byId = new Map(ATLAS.map((e) => [e.id, e]))

export function entry(id: string): AtlasEntry {
  const e = byId.get(id)
  if (!e) throw new Error(`atlas: ${id} is not in the manifest (packages/e2e/src/atlas-manifest.ts)`)
  if (e.status !== 'built') throw new Error(`atlas: ${id} is planned; mark it built in the manifest first`)
  return e
}

/** Move the previous run's shots of these files aside (called by each surface before it captures). */
function rotate(prefixes: Set<string>): void {
  mkdirSync(SHOTS, { recursive: true })
  mkdirSync(PREVIOUS, { recursive: true })
  for (const f of readdirSync(SHOTS)) {
    if (!prefixes.has(f.split('__').slice(0, 3).join('__'))) continue
    renameSync(join(SHOTS, f), join(PREVIOUS, f))
  }
}

function compareWithPrevious(file: string): { stable: boolean | null; diff: number } {
  const prev = join(PREVIOUS, file)
  if (!existsSync(prev)) return { stable: null, diff: 0 }
  const a = decodePng(readFileSync(join(SHOTS, file)))
  const b = decodePng(readFileSync(prev))
  const c = comparePng(a, b, 0)
  return { stable: !c.sizeMismatch && c.diffPixels === 0, diff: c.sizeMismatch ? 1 : c.ratio }
}

export type ShootOptions = {
  /** The state really rendered: this locator must be visible before anything is captured. */
  expect: Locator | Locator[]
  /** Regions showing wall-clock time (a live timer, a start time): covered by an opaque box. */
  masks?: Locator[]
  /** Keep keyboard focus where it is (default: blur it, so no focus ring is in frame). */
  keepFocus?: boolean
  /** Override the manifest's widths for this shot. */
  widths?: readonly number[]
}

/**
 * One surface's recorder. `themes` switches the page's colour scheme; `shoot` asserts, settles and
 * captures each theme × width; `finish` writes captured-<surface>.json and returns the built entries of
 * this surface that were never captured (a test asserts that list is empty).
 */
export class Atlas {
  readonly captured: Captured[] = []
  readonly surface: Surface
  private readonly setTheme: (page: Page, theme: Theme) => Promise<void>
  private readonly opts: { height?: number; fullPage?: boolean }
  constructor(
    surface: Surface,
    setTheme: (page: Page, theme: Theme) => Promise<void>,
    opts: { height?: number; fullPage?: boolean } = {},
  ) {
    this.surface = surface
    this.setTheme = setTheme
    this.opts = opts
    rotate(new Set(ATLAS.filter((e) => e.surface === surface).map((e) => e.id)))
  }

  async shoot(page: Page, id: string, o: ShootOptions): Promise<void> {
    const e = entry(id)
    if (e.surface !== this.surface) throw new Error(`atlas: ${id} belongs to the ${e.surface} surface`)
    for (const l of [o.expect].flat()) await l.waitFor({ state: 'visible', timeout: 20_000 })
    // KACOLA_ATLAS_WIDTHS=all (or KACOLA_ATLAS_ALL_WIDTHS=1): every window / web shot at every
    // main width, for a design review pass; shell shots keep their one size
    const all =
      (process.env.KACOLA_ATLAS_WIDTHS === 'all' || process.env.KACOLA_ATLAS_ALL_WIDTHS === '1') &&
      e.surface !== 'shell'
    const widths = o.widths ?? (e.responsive || all ? WIDTHS_MAIN : WIDTHS_ONE)
    const files: CapturedFile[] = []
    const original = page.viewportSize() ?? { width: 1280, height: this.opts.height ?? HEIGHT }
    for (const width of widths) {
      if (page.viewportSize()?.width !== width)
        await page.setViewportSize({ width, height: this.opts.height ?? HEIGHT })
      for (const theme of ['light', 'dark'] as const) {
        await this.setTheme(page, theme)
        await settle(page, o.keepFocus)
        // still that state after the theme switch (at the main width; a narrow layout may fold it away)
        if (width === widths[0])
          for (const l of [o.expect].flat()) await l.waitFor({ state: 'visible', timeout: 5000 })
        const file = `${id}__${theme}__${width}.png`
        await page.screenshot({
          path: join(SHOTS, file),
          caret: 'initial', // hiding the caret injects an inline <style>, which the window's CSP refuses
          animations: 'allow',
          fullPage: this.opts.fullPage ?? false,
          mask: o.masks ?? [],
          maskColor: MASK_COLOR,
        })
        files.push({ file, theme, width, ...compareWithPrevious(file) })
      }
    }
    await this.setTheme(page, 'light')
    if (page.viewportSize()?.width !== original.width) await page.setViewportSize(original)
    this.captured.push({ id, files, masked: o.masks?.length ?? 0 })
  }

  /** Record PNGs made some other way (the Shell's own screenshots) for an entry. */
  record(id: string, files: { file: string; theme: Theme; width: number }[]): void {
    entry(id)
    this.captured.push({ id, files: files.map((f) => ({ ...f, ...compareWithPrevious(f.file) })), masked: 0 })
  }

  /** A terminal frame (a `cli` entry): what the real command printed, saved as <id>.txt. */
  text(id: string, content: string): void {
    const e = entry(id)
    if (e.surface !== 'cli') throw new Error(`atlas: ${id} is not a cli entry`)
    mkdirSync(SHOTS, { recursive: true })
    const file = `${id}.txt`
    const prev = existsSync(join(PREVIOUS, file)) ? readFileSync(join(PREVIOUS, file), 'utf8') : null
    writeFileSync(join(SHOTS, file), content)
    this.captured.push({
      id,
      files: [],
      masked: 0,
      text: file,
      ...(prev === null ? {} : { stable: prev === content }),
    })
  }

  finish(): string[] {
    mkdirSync(ATLAS_DIR, { recursive: true })
    writeFileSync(
      join(ATLAS_DIR, `captured-${this.surface}.json`),
      `${JSON.stringify({ surface: this.surface, captured: this.captured }, null, 2)}\n`,
    )
    const got = new Set(this.captured.map((c) => c.id))
    return ATLAS.filter((e) => e.surface === this.surface && e.status === 'built' && !got.has(e.id)).map(
      (e) => e.id,
    )
  }

  /** Shots whose image differs from the previous run's (empty on a first run). */
  unstable(): string[] {
    return this.captured.flatMap((c) => [
      ...c.files.filter((f) => f.stable === false).map((f) => `${f.file} (${(f.diff * 100).toFixed(3)}%)`),
      ...(c.stable === false ? [`${c.text} (text)`] : []),
    ])
  }
}

/** Fonts loaded, two frames painted, no focus ring, the pointer parked off every control. */
export async function settle(page: Page, keepFocus = false): Promise<void> {
  if (!keepFocus)
    await page.evaluate(
      'document.activeElement && document.activeElement.blur && document.activeElement.blur()',
    )
  // a focused field's caret blinks on its own clock: hidden through the CSSOM (a CSP-safe inline style)
  else
    await page.evaluate(
      'document.activeElement && document.activeElement.style && (document.activeElement.style.caretColor = "transparent")',
    )
  await page.mouse.move(1, 1)
  await page.evaluate(
    'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))))',
  )
}

/** Crop an RGBA image (the Shell's full-screen screenshots → the top-bar menu). */
export function crop(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = new Uint8Array(w * h * 4)
  for (let row = 0; row < h; row++)
    out.set(
      img.data.subarray(((y + row) * img.width + x) * 4, ((y + row) * img.width + x + w) * 4),
      row * w * 4,
    )
  return { width: w, height: h, data: out }
}

export function writeCropped(src: string, file: string, box: [number, number, number, number]): void {
  const img = decodePng(readFileSync(src))
  writeFileSync(join(SHOTS, file), encodePng(crop(img, ...box)))
  rmSync(src, { force: true })
}
