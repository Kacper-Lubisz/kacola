import type { Theme } from '../../shared/bridge.ts'

/**
 * Apply main's Theme to the document. The brand tokens switch on `data-theme` (always set explicitly, so
 * an explicit light theme beats a dark prefers-color-scheme, which Chromium on Linux does not reliably
 * map from nativeTheme anyway) and `data-contrast`. `data-scheme` mirrors the scheme for tests and
 * for anything that keyed off it in phase 1. The portal's accent colour is ignored: the brand accent
 * (record red) is fixed.
 */
export function applyTheme(t: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = t.scheme
  root.dataset.scheme = t.scheme
  root.dataset.contrast = t.contrast
}
