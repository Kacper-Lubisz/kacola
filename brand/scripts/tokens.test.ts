import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flatten, type Mode, resolve, type Tree, tailwindCss, tokensCss } from './tokens.ts'

const BRAND = join(import.meta.dirname, '..')
const tree = JSON.parse(readFileSync(join(BRAND, 'tokens', 'tokens.json'), 'utf8')) as Tree

/** A mode's resolved colours, with the high-contrast overrides layered over their base theme. */
function palette(mode: Mode): Record<string, string> {
  const base = mode.startsWith('dark') ? 'dark' : 'light'
  const out: Record<string, string> = {}
  for (const m of [base, mode])
    for (const f of flatten(tree))
      if (f.mode === m && f.token.$type === 'color')
        out[f.name.slice(1).join('.')] = String(resolve(tree, f.token.$value))
  return out
}

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) throw new Error(`not an opaque hex colour: ${hex}`)
  return [m[1], m[2], m[3]].map((h) => Number.parseInt(h!, 16) / 255) as [number, number, number]
}
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as number[]
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
/** WCAG 2.x contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
/** `fg` at `alpha` over the opaque `bg`, as hex (for tints). */
const mix = (fg: string, alpha: number, bg: string) =>
  `#${rgb(fg)
    .map((v, i) => Math.round((v * alpha + rgb(bg)[i]! * (1 - alpha)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['text.primary', 'bg.window', 4.5],
  ['text.primary', 'bg.surface', 4.5],
  ['text.primary', 'bg.sidebar', 4.5],
  ['text.primary', 'bg.raised', 4.5],
  ['text.secondary', 'bg.window', 4.5],
  ['text.secondary', 'bg.surface', 4.5],
  ['text.secondary', 'bg.sidebar', 4.5],
  ['text.secondary', 'bg.raised', 4.5],
  ['accent.recordText', 'bg.surface', 4.5],
  ['accent.recordText', 'bg.window', 4.5],
  ['status.danger', 'bg.surface', 4.5],
  ['text.onInk', 'ink.primary', 4.5],
  // large/bold button labels on red (WCAG AA large text / UI components)
  ['text.onAccent', 'accent.record', 3],
  ['text.onAccent', 'accent.recordHover', 3],
  // hint text (13px and up only) and non-text status marks: 3:1
  ['text.tertiary', 'bg.surface', 3],
  ['text.tertiary', 'bg.window', 3],
  ['accent.record', 'bg.surface', 3],
]

const MODES: Mode[] = ['light', 'dark', 'light-high-contrast', 'dark-high-contrast']

describe('brand tokens: WCAG contrast', () => {
  for (const mode of MODES) {
    const p = palette(mode)
    it.each(PAIRS)(`${mode}: %s on %s >= %d:1`, (fg, bg, min) => {
      expect(contrast(p[fg]!, p[bg]!)).toBeGreaterThanOrEqual(min)
    })
    it(`${mode}: speaker colours pass 3:1 as chip edges and keep text.primary legible on their 14% tint`, () => {
      for (let i = 1; i <= 6; i++) {
        const s = p[`speaker.${i}`]!
        expect(contrast(s, p['bg.surface']!), `speaker.${i} edge`).toBeGreaterThanOrEqual(3)
        expect(contrast(s, p['bg.window']!), `speaker.${i} edge on window`).toBeGreaterThanOrEqual(3)
        const tint = mix(s, 0.14, p['bg.surface']!)
        expect(contrast(p['text.primary']!, tint), `text on speaker.${i} tint`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('high contrast borders are at least 3:1 against every surface', () => {
    for (const mode of ['light-high-contrast', 'dark-high-contrast'] as const) {
      const p = palette(mode)
      for (const bg of ['bg.window', 'bg.surface', 'bg.sidebar', 'bg.raised'])
        expect(contrast(p['border.default']!, p[bg]!), `${mode} border on ${bg}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('matches the spec values that the design language is built on', () => {
    const l = palette('light')
    const d = palette('dark')
    expect([l['bg.window'], l['text.primary'], l['accent.record']]).toEqual(['#F6F1E7', '#1F1B16', '#E0482B'])
    expect([d['bg.window'], d['text.primary'], d['accent.record']]).toEqual(['#171411', '#F3ECE0', '#F0603F'])
  })
})

describe('brand tokens: generated files', () => {
  it('tokens.css and tailwind.css are up to date with tokens.json', () => {
    expect(readFileSync(join(BRAND, 'tokens', 'tokens.css'), 'utf8')).toBe(tokensCss(tree))
    expect(readFileSync(join(BRAND, 'tokens', 'tailwind.css'), 'utf8')).toBe(tailwindCss(tree))
  })

  it('every mode defines the same colour names as light (high contrast only overrides)', () => {
    const names = (m: Mode) =>
      flatten(tree)
        .filter((f) => f.mode === m && f.token.$type === 'color')
        .map((f) => f.name.join('.'))
    const light = names('light')
    expect(names('dark')).toEqual(light)
    for (const hc of ['light-high-contrast', 'dark-high-contrast'] as const)
      for (const n of names(hc)) expect(light).toContain(n)
  })

  it('fonts.css points at bundled woff2 files that exist, each family with its OFL', () => {
    const css = readFileSync(join(BRAND, 'tokens', 'fonts.css'), 'utf8')
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!)
    expect(urls.length).toBe(5)
    for (const u of urls) expect(existsSync(join(BRAND, 'tokens', u)), u).toBe(true)
    for (const fam of ['BricolageGrotesque', 'InstrumentSans', 'Fraunces', 'JetBrainsMono'])
      expect(existsSync(join(BRAND, 'fonts', `${fam}-OFL.txt`)), fam).toBe(true)
  })
})
