import type { BrowserWindowConstructorOptions } from 'electron'

// The security baseline (Electron's checklist), as plain data and pure decisions so a unit test can hold
// every item to it (test/security.test.ts). index.ts wires these into the real objects.

export const APP_SCHEME = 'app'
export const APP_HOST = 'gnomeola'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/**
 * Production CSP. The renderer has no network at all (connect-src 'none': daemon traffic goes through
 * the preload tunnel), runs only its own bundled scripts (no inline, no eval), and loads styles, fonts
 * and images only from itself. data: images are for inline SVG icons.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/**
 * Dev CSP (electron-vite dev server with HMR): React Refresh injects an inline preamble and Vite
 * injects <style> tags and talks to its server over a websocket. Still no eval. Never used in a build.
 */
export function devCsp(devServer: string): string {
  const u = new URL(devServer)
  const ws = `ws://${u.host}`
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${u.origin}`,
    `style-src 'self' 'unsafe-inline' ${u.origin}`,
    `img-src 'self' data: ${u.origin}`,
    `font-src 'self' ${u.origin}`,
    `connect-src ${u.origin} ${ws}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function windowOptions(o: {
  preload: string
  platform: NodeJS.Platform
  dark: boolean
  /** The app icon (Linux/Windows window icon; macOS takes the bundle's). */
  icon?: string
}): BrowserWindowConstructorOptions {
  return {
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 400,
    show: false,
    title: 'Gnomeola',
    // paint the window background before the first frame so there is no white flash in dark mode
    backgroundColor: o.dark ? '#171411' : '#f6f1e7', // brand bg.window
    ...(o.icon && o.platform !== 'darwin' ? { icon: o.icon } : {}),
    // Linux: our own header bar (CSD); macOS: native traffic lights over our header bar
    ...(o.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { frame: false, titleBarStyle: 'hidden' as const }),
    webPreferences: {
      preload: o.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      safeDialogs: true,
    },
  }
}

/** Only http(s) URLs leave the app, and only to the system browser. */
export function isExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname !== ''
  } catch {
    return false
  }
}

/** Where the window may navigate to: its own app:// origin (or the dev server in dev), nothing else. */
export function isAllowedNavigation(raw: string, devServer?: string): boolean {
  try {
    const u = new URL(raw)
    // WHATWG `origin` is "null" for a scheme Node does not know, so compare scheme + host
    if (u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST) return true
    return devServer !== undefined && u.origin === new URL(devServer).origin
  } catch {
    return false
  }
}

/**
 * Permission requests: everything is denied, except microphone / loopback capture for a window that
 * was registered as the capture window (macOS in-app capture, later). The main window never qualifies.
 */
export function permissionAllowed(
  permission: string,
  details: { mediaTypes?: string[] },
  isCaptureWindow: boolean,
): boolean {
  if (!isCaptureWindow) return false
  if (permission !== 'media') return false
  const types = details.mediaTypes ?? []
  return types.length > 0 && types.every((t) => t === 'audio')
}

/** Resolve an app:// request to a file under the renderer dir, or null (traversal, other hosts). */
export function resolveAppPath(rawUrl: string, root: string, sep = '/'): string | null {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  if (u.protocol !== `${APP_SCHEME}:` || u.host !== APP_HOST) return null
  let path: string
  try {
    path = decodeURIComponent(u.pathname)
  } catch {
    return null
  }
  if (path.includes('\0') || path.split('/').some((seg) => seg === '..')) return null
  const rel = path === '/' || path === '' ? 'index.html' : path.replace(/^\/+/, '')
  return `${root.replace(/[/\\]+$/, '')}${sep}${rel.split('/').join(sep)}`
}
