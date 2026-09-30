import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  type MessagePortMain,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
  type WebContents,
} from 'electron'
import {
  type AppInfo,
  type DaemonStatus,
  IPC,
  type Theme,
  type TunnelControl,
  type TunnelRequest,
  type WindowControl,
} from '../shared/bridge.ts'
import { readDesktopConfig } from './config.ts'
import { checkClipboardText, checkSaveRequest, type SaveDialogOptions, saveText } from './files.ts'
import { loadCatalogue, preferredLanguages, readNotices, readUiState, writeUiState } from './resources.ts'
import {
  APP_ORIGIN,
  APP_SCHEME,
  CSP,
  devCsp,
  isAllowedNavigation,
  isExternalUrl,
  permissionAllowed,
  resolveAppPath,
  windowOptions,
} from './security.ts'
import { DaemonSupervisor } from './supervisor.ts'
import { readPortal, themeFrom, watchPortal } from './theme.ts'
import { serveTunnel, type TunnelPort } from './tunnel.ts'

// The Electron main process: one instance, daemon supervision, the app:// origin, the fetch tunnel and
// the window. See docs/desktop-app.md for the process model and the security baseline.

const DEV_SERVER = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
const HERE = import.meta.dirname
const RENDERER_DIR = join(HERE, '..', 'renderer')
const PRELOAD = join(HERE, '..', 'preload', 'index.cjs')
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// ---- single instance --------------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  // another instance owns the window and the daemon; it was told about us via 'second-instance'
  app.exit(0)
}

let mainWindow: BrowserWindow | null = null
let theme: Theme = { scheme: 'light', contrast: 'normal', accent: null }
let buttonLayout = 'appmenu:close'
/** webContents ids allowed to capture audio (macOS in-app capture, later). The main window never is. */
const captureWindows = new Set<number>()

const config = readDesktopConfig(process.env, process.argv, {
  resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  appDir: HERE,
})

const broadcast = (channel: string, value: unknown) => {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, value)
}

const supervisor = new DaemonSupervisor({
  baseUrl: config.baseUrl,
  loopback: config.loopback,
  entry: config.daemonEntry,
  args: config.daemonArgs,
  execPath: process.execPath,
  env: process.env,
  onStatus: (s: DaemonStatus) => {
    process.stdout.write(`${JSON.stringify({ event: 'daemon', ...s })}\n`)
    broadcast(IPC.daemonStatusChanged, s)
  },
})

app.on('second-instance', (_e, argv) => {
  if (!argv.includes('--background')) showWindow()
})

// ---- security: every webContents, every request -----------------------------------------------------

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (ev, url) => {
    if (!isAllowedNavigation(url, DEV_SERVER)) ev.preventDefault()
  })
  contents.on('will-redirect', (ev, url) => {
    if (!isAllowedNavigation(url, DEV_SERVER)) ev.preventDefault()
  })
  contents.on('will-attach-webview', (ev) => ev.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
})

/** IPC is accepted only from our own renderer (app:// or the dev server), never from anything else. */
function trusted(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url
  return url !== undefined && isAllowedNavigation(url, DEV_SERVER)
}

function wireSession(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((wc: WebContents, permission, cb, details) =>
    cb(permissionAllowed(permission, details as { mediaTypes?: string[] }, captureWindows.has(wc.id))),
  )
  ses.setPermissionCheckHandler(
    (wc, permission) => wc !== null && captureWindows.has(wc.id) && permission === 'media',
  )
  if (DEV_SERVER) {
    const csp = devCsp(DEV_SERVER)
    ses.webRequest.onHeadersReceived({ urls: [`${new URL(DEV_SERVER).origin}/*`] }, (d, cb) =>
      cb({ responseHeaders: { ...d.responseHeaders, 'Content-Security-Policy': [csp] } }),
    )
  }
  protocol.handle(APP_SCHEME, async (req) => {
    const path = resolveAppPath(req.url, RENDERER_DIR, sep)
    if (!path) return new Response('not found', { status: 404 })
    const res = await net.fetch(pathToFileURL(path).href).catch(() => null)
    if (!res?.ok) return new Response('not found', { status: 404 })
    const headers = new Headers(res.headers)
    headers.set('Content-Security-Policy', CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(res.body, { status: 200, headers })
  })
}

// ---- IPC ---------------------------------------------------------------------------------------------

function portOf(p: MessagePortMain): TunnelPort {
  const closeCbs: (() => void)[] = []
  let closed = false
  p.on('close', () => {
    closed = true
    for (const cb of closeCbs) cb()
  })
  const port: TunnelPort = {
    post: (f) => {
      if (!closed) p.postMessage(f)
    },
    onControl: (cb) => p.on('message', (e) => cb(e.data as TunnelControl)),
    onClose: (cb) => closeCbs.push(cb),
    close: () => {
      closed = true
      p.close()
    },
  }
  p.start()
  return port
}

function wireIpc(): void {
  ipcMain.on(IPC.tunnel, (e, req: TunnelRequest) => {
    const p = e.ports[0]
    if (!p) return
    if (!trusted(e)) {
      p.close()
      return
    }
    void serveTunnel(req, portOf(p), {
      baseUrl: config.baseUrl,
      ...(config.token ? { token: config.token } : {}),
    })
  })
  const handle = <T>(channel: string, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => T | Promise<T>) =>
    ipcMain.handle(channel, (e, ...args) => {
      if (!trusted(e)) throw new Error('untrusted sender')
      return fn(e, ...args)
    })
  handle(
    IPC.appInfo,
    (): AppInfo => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      platform: process.platform,
      daemonUrl: config.baseUrl,
      buttonLayout,
    }),
  )
  handle(IPC.theme, () => theme)
  handle(IPC.daemonStatus, () => supervisor.status)
  handle(IPC.uiStateGet, () => readUiState(config.uiStatePath))
  handle(IPC.uiStateSet, (_e, s) => writeUiState(config.uiStatePath, s as never))
  handle(IPC.notices, () =>
    readNotices([
      join(process.resourcesPath ?? '', 'THIRD_PARTY_NOTICES.md'),
      join(REPO_ROOT, 'THIRD_PARTY_NOTICES.md'),
    ]),
  )
  handle(IPC.i18n, () =>
    loadCatalogue(
      app.isPackaged ? join(process.resourcesPath, 'locale') : join(HERE, '..', 'locale'),
      preferredLanguages(process.env, app.getPreferredSystemLanguages()),
    ),
  )
  handle(IPC.openExternal, async (_e, url) => {
    if (typeof url !== 'string' || !isExternalUrl(url)) return false
    await shell.openExternal(url)
    return true
  })
  // ---- notes: copy as markdown, export (files.ts)
  handle(IPC.clipboardWrite, (_e, text) => {
    clipboard.writeText(checkClipboardText(text))
  })
  handle(IPC.saveText, (e, req) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    // `dialog.showSaveDialog` is looked up per call, so an e2e can stand in for the native dialog
    const show = (o: SaveDialogOptions) => (w ? dialog.showSaveDialog(w, o) : dialog.showSaveDialog(o))
    let documentsDir: string
    try {
      documentsDir = app.getPath('documents')
    } catch {
      documentsDir = app.getPath('home')
    }
    return saveText(checkSaveRequest(req), {
      showSaveDialog: show,
      writeFile: (path, text) => writeFile(path, text, 'utf8'),
      documentsDir,
      join,
    })
  })
  ipcMain.on(IPC.windowControl, (e, c: WindowControl) => {
    if (!trusted(e)) return
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (c === 'minimize') w.minimize()
    else if (c === 'maximize') w.isMaximized() ? w.unmaximize() : w.maximize()
    else if (c === 'close') w.close()
  })
}

// ---- theme -------------------------------------------------------------------------------------------

async function refreshTheme(): Promise<void> {
  const raw = await readPortal()
  // nativeTheme reflects the system until we override it; read it before applying our own choice
  const systemDark =
    nativeTheme.themeSource === 'system' ? nativeTheme.shouldUseDarkColors : theme.scheme === 'dark'
  theme = themeFrom(
    { ...raw, contrast: raw.contrast ?? (nativeTheme.shouldUseHighContrastColors ? 1 : null) },
    systemDark,
    process.env,
  )
  // macOS: nativeTheme already follows the system (and 'updated' drives us); overriding it there would
  // make every later 'updated' our own echo
  if (process.platform !== 'darwin' || process.env.GNOMEOLA_COLOR_SCHEME)
    nativeTheme.themeSource = theme.scheme
  broadcast(IPC.themeChanged, theme)
}

function readButtonLayout(): void {
  if (process.platform !== 'linux') return
  execFile('gsettings', ['get', 'org.gnome.desktop.wm.preferences', 'button-layout'], (err, out) => {
    if (!err) buttonLayout = out.trim().replace(/^'|'$/g, '') || buttonLayout
  })
}

// ---- window ------------------------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const w = new BrowserWindow(
    windowOptions({ preload: PRELOAD, platform: process.platform, dark: theme.scheme === 'dark' }),
  )
  w.once('ready-to-show', () => {
    process.stdout.write(`${JSON.stringify({ event: 'window-ready' })}\n`)
    w.show()
  })
  w.on('closed', () => {
    if (mainWindow === w) mainWindow = null
  })
  w.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && (input.control || input.meta) && input.key.toLowerCase() === 'q') {
      ev.preventDefault()
      app.quit()
    }
  })
  void w.loadURL(DEV_SERVER ?? `${APP_ORIGIN}/index.html`)
  return w
}

function showWindow(): void {
  if (!app.isReady()) return
  if (!mainWindow) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Closing the window keeps main (and the daemon) running; only an explicit quit stops them.
app.on('window-all-closed', () => {})

let quitting = false
let stopWatchingPortal: () => void = () => {}
app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  stopWatchingPortal()
  void supervisor.stop().finally(() => app.exit(0))
})
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => app.quit())

void app.whenReady().then(async () => {
  wireSession()
  wireIpc()
  readButtonLayout()
  await refreshTheme()
  stopWatchingPortal = watchPortal(() => void refreshTheme())
  nativeTheme.on('updated', () => {
    if (process.platform === 'darwin') void refreshTheme()
  })
  void supervisor.start()
  if (!config.background) showWindow()
})
