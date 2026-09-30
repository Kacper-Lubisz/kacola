import { type ChildProcess, execFile, spawn } from 'node:child_process'
import type { Theme } from '../shared/bridge.ts'

// Colour scheme, accent and contrast, the way a libadwaita app gets them: from the desktop portal's
// org.freedesktop.appearance namespace (org.freedesktop.portal.Settings), read with gdbus and followed
// live with `gdbus monitor`. Main applies the scheme to nativeTheme.themeSource — so the renderer's
// `prefers-color-scheme` follows GNOME's dark style — and pushes the whole Theme to the renderer for
// accent and high contrast. macOS (and a Linux session without the portal) falls back to nativeTheme.
//
// GNOMEOLA_COLOR_SCHEME=light|dark, GNOMEOLA_CONTRAST=high and GNOMEOLA_ACCENT=#rrggbb override, for
// tests and screenshots.

const DEST = [
  '--session',
  '--dest',
  'org.freedesktop.portal.Desktop',
  '--object-path',
  '/org/freedesktop/portal/desktop',
]

/** `(<uint32 1>,)` → 1 */
export function parseUint(out: string): number | null {
  const m = /uint32 (\d+)/.exec(out)
  return m ? Number(m[1]) : null
}

/** `(<(0.2078, 0.5176, 0.8941)>,)` → "#3584e4"; out-of-range components (the portal's "unset") → null. */
export function parseAccent(out: string): string | null {
  const m = /\(\s*([\d.eE+-]+),\s*([\d.eE+-]+),\s*([\d.eE+-]+)\s*\)/.exec(out)
  if (!m) return null
  const rgb = [m[1], m[2], m[3]].map(Number)
  if (rgb.some((c) => !Number.isFinite(c) || c < 0 || c > 1)) return null
  return `#${rgb
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** One `gdbus monitor` line → the appearance key it changed, if any. */
export function parseSettingChanged(line: string): { key: string; value: string } | null {
  const m = /SettingChanged \('org\.freedesktop\.appearance', '([\w-]+)', (.*)\)\s*$/.exec(line)
  return m ? { key: m[1]!, value: m[2]! } : null
}

/** color-scheme: 0 no preference, 1 prefer dark, 2 prefer light. contrast: 0 normal, 1 high. */
export function themeFrom(
  raw: { colorScheme: number | null; contrast: number | null; accent: string | null },
  fallbackDark: boolean,
  env: Record<string, string | undefined>,
): Theme {
  const scheme =
    env.GNOMEOLA_COLOR_SCHEME === 'dark' || env.GNOMEOLA_COLOR_SCHEME === 'light'
      ? env.GNOMEOLA_COLOR_SCHEME
      : raw.colorScheme === 1
        ? 'dark'
        : raw.colorScheme === 2
          ? 'light'
          : fallbackDark
            ? 'dark'
            : 'light'
  const contrast = env.GNOMEOLA_CONTRAST === 'high' || raw.contrast === 1 ? 'high' : 'normal'
  const accent = /^#[0-9a-f]{6}$/i.test(env.GNOMEOLA_ACCENT ?? '') ? env.GNOMEOLA_ACCENT! : raw.accent
  return { scheme, contrast, accent }
}

function readOne(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'gdbus',
      [
        'call',
        ...DEST,
        '--method',
        'org.freedesktop.portal.Settings.ReadOne',
        'org.freedesktop.appearance',
        key,
      ],
      { timeout: 1500 },
      (err, stdout) => resolve(err ? null : stdout),
    )
  })
}

export async function readPortal(): Promise<{
  colorScheme: number | null
  contrast: number | null
  accent: string | null
}> {
  if (process.platform !== 'linux') return { colorScheme: null, contrast: null, accent: null }
  const [cs, ct, ac] = await Promise.all([
    readOne('color-scheme'),
    readOne('contrast'),
    readOne('accent-color'),
  ])
  return {
    colorScheme: cs === null ? null : parseUint(cs),
    contrast: ct === null ? null : parseUint(ct),
    accent: ac === null ? null : parseAccent(ac),
  }
}

/** Follow portal changes. Returns a stop function. */
export function watchPortal(onChange: () => void): () => void {
  if (process.platform !== 'linux') return () => {}
  let child: ChildProcess | null = null
  try {
    child = spawn('gdbus', ['monitor', ...DEST], { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return () => {}
  }
  child.on('error', () => {})
  let buf = ''
  child.stdout?.on('data', (d: Buffer) => {
    buf += d.toString()
    for (let i = buf.indexOf('\n'); i !== -1; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (parseSettingChanged(line)) onChange()
    }
  })
  return () => child?.kill()
}
