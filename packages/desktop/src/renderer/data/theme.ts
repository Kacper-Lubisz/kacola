import type { Theme } from '../../shared/bridge.ts'

/**
 * Apply main's Theme to the document. The scheme itself reaches CSS through prefers-color-scheme (main
 * sets nativeTheme.themeSource); data-scheme mirrors it for tests and screenshots.
 */
export function applyTheme(t: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.scheme = t.scheme
  root.dataset.contrast = t.contrast
  if (t.accent) root.style.setProperty('--accent-bg-color', t.accent)
  else root.style.removeProperty('--accent-bg-color')
}
