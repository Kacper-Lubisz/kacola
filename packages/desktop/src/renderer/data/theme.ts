import type { Theme } from '../../shared/bridge.ts'

/**
 * Apply main's Theme to the document: tokens.css keys off data-scheme / data-contrast (Chromium on Linux
 * does not reliably map nativeTheme.themeSource onto prefers-color-scheme, so we do not depend on it).
 */
export function applyTheme(t: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.scheme = t.scheme
  root.dataset.contrast = t.contrast
  if (t.accent) {
    root.style.setProperty('--accent-bg-color', readableAccent(t.accent))
  } else {
    root.style.removeProperty('--accent-bg-color')
  }
}

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (r: number, g: number, b: number) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/**
 * The portal's accent as a fill under white text (--accent-fg-color): darkened just enough to reach WCAG
 * AA 4.5:1 — libadwaita's own blue #3584e4 is 3.7:1, yellow far less. Hue is kept.
 */
export function readableAccent(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  for (let i = 0; i < 40 && 1.05 / (luminance(r, g, b) + 0.05) < 4.5; i++) {
    r = Math.floor(r * 0.95)
    g = Math.floor(g * 0.95)
    b = Math.floor(b * 0.95)
  }
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
