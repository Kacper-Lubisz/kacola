import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient, ingestPcm, MAX_FRAME_BYTES, type Session } from '@gnomeola/protocol'
import {
  webContents as allWebContents,
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  type MessagePortMain,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
  Tray,
  type WebContents,
} from 'electron'
import pkg from '../../package.json' with { type: 'json' }
import {
  type AppInfo,
  type AutostartState,
  type DaemonStatus,
  IPC,
  type Theme,
  type TunnelControl,
  type TunnelRequest,
  type WindowControl,
} from '../shared/bridge.ts'
import { CAPTURE_IPC, type CaptureState, type CaptureTrack } from '../shared/capture.ts'
import { autostartStatus, requestBackground, setAutostart } from './autostart.ts'
import { CaptureController, type CaptureWindowLike, captureTracks } from './capture.ts'
import { readDesktopConfig } from './config.ts'
import { DeepLinkQueue, deepLinkFromArgv, normalizeDeepLink, schemeRegistration } from './deep-link.ts'
import { ExtensionManager, extensionSource, runCommand } from './extension.ts'
import { checkClipboardText, checkSaveRequest, type SaveDialogOptions, saveText } from './files.ts'
import { cliEntry, Integration, runCli, shq } from './integration.ts'
import { IdleCollector } from './memory.ts'
import { loadCatalogue, preferredLanguages, readNotices, readUiState, writeUiState } from './resources.ts'
import {
  APP_ORIGIN,
  APP_SCHEME,
  CSP,
  captureWindowOptions,
  devCsp,
  isAllowedNavigation,
  isExternalUrl,
  permissionAllowed,
  resolveAppPath,
  windowOptions,
} from './security.ts'
import { DaemonSupervisor } from './supervisor.ts'
import { readPortal, themeFrom, watchPortal } from './theme.ts'
import { type TrayAction, trayMenuModel, trayTooltip } from './tray.ts'
import { serveTunnel, type TunnelPort } from './tunnel.ts'

// The Electron main process: one instance, daemon supervision, the app:// origin, the fetch tunnel and
// the window; in-app capture, background mode (Background portal / login item, macOS Tray) and the
// desktop integration installs. See docs/desktop-app.md for the process model and the security baseline.

const DEV_SERVER = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
const HERE = import.meta.dirname
const RENDERER_DIR = join(HERE, '..', 'renderer')
const PRELOAD = join(HERE, '..', 'preload', 'index.cjs')
const CAPTURE_PRELOAD = join(HERE, '..', 'preload', 'capture.cjs')
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const FLATPAK = Boolean(process.env.FLATPAK_ID)

// A packaged build refuses Chromium's remote debugging (DevTools protocol on a port or pipe: full
// control of the window) unless a test asks for it explicitly. The flatpak e2e drives the sandboxed
// window through it (GNOMEOLA_ALLOW_REMOTE_DEBUGGING=1 + --remote-debugging-port).
if (
  app.isPackaged &&
  process.argv.some((a) => /^--remote-debugging-(port|pipe)/.test(a)) &&
  process.env.GNOMEOLA_ALLOW_REMOTE_DEBUGGING !== '1'
) {
  process.stderr.write('gnomeola: remote debugging is disabled in this build\n')
  app.exit(1)
}

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// ---- single instance --------------------------------------------------------------------------------

const config = readDesktopConfig(process.env, process.argv, {
  resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  appDir: HERE,
})
// A separate profile (the sandbox) has its own user-data dir, so its own single-instance lock: it starts
// beside the everyday window instead of handing its arguments to it.
if (config.profile)
  app.setPath('userData', config.userDataDir ?? `${app.getPath('userData')}-${config.profile}`)
const windowTitle = config.profile ? `kacola · ${config.profile}` : 'kacola'

if (!app.requestSingleInstanceLock()) {
  // another instance owns the window and the daemon; it was told about us via 'second-instance'
  app.exit(0)
}

let mainWindow: BrowserWindow | null = null
let theme: Theme = { scheme: 'light', contrast: 'normal', accent: null }
let buttonLayout = 'appmenu:close'
/** webContents ids allowed to capture audio (macOS in-app capture, later). The main window never is. */
const captureWindows = new Set<number>()
/** Main's own garbage, collected after start-up and window bursts (memory.ts). */
const idleGc = new IdleCollector({ settleMs: 10_000, periodMs: 5 * 60_000 })

const cli = cliEntry(process.env, {
  resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  appDir: HERE,
})
const extension = new ExtensionManager({
  platform: process.platform,
  env: process.env,
  source: extensionSource({
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
    appDir: HERE,
  }),
  run: runCommand(process.env),
})
const integration = new Integration(cli ? runCli(process.execPath, cli, process.env) : null, {
  // packaged Linux outside Flatpak: the shim starts this very binary in the background when the daemon
  // is down (the Flatpak and macOS modes have their own launch commands)
  launch:
    app.isPackaged && process.platform === 'linux' && !FLATPAK
      ? `${shq(process.execPath)} --background`
      : null,
  extension,
})

/** What a login starts (Linux outside Flatpak): this binary (+ the main script when unpackaged). */
const autostartDeps = {
  env: process.env,
  exec: app.isPackaged
    ? [process.execPath, '--background']
    : [process.execPath, process.argv[1] ?? join(HERE, 'index.js'), '--background'],
}

const client = createClient({
  baseUrl: config.baseUrl,
  ...(config.token ? { token: config.token } : {}),
  timeoutMs: 10_000,
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
    if (s.kind === 'attached' || s.kind === 'spawned') void daemonUp()
    refreshTray()
  },
})

// ---- the daemon, watched from main: in-app capture + the Tray -----------------------------------------

const logLine = (o: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(o)}\n`)
let capture: CaptureController | null = null
let captureWin: BrowserWindow | null = null
let captureReady: Promise<void> | null = null
let watching = false
let active: Session | null = null

/** The hidden capture window (created on first use; audio permission for it alone). */
function captureWindow(): CaptureWindowLike {
  if (!captureWin || captureWin.isDestroyed()) {
    const w = new BrowserWindow(captureWindowOptions({ preload: CAPTURE_PRELOAD }))
    captureWin = w
    captureWindows.add(w.webContents.id)
    const id = w.webContents.id
    w.on('closed', () => {
      captureWindows.delete(id)
      if (captureWin === w) captureWin = null
    })
    captureReady = w.loadURL(DEV_SERVER ? `${DEV_SERVER}/capture.html` : `${APP_ORIGIN}/capture.html`)
  }
  const w = captureWin
  const ready = captureReady
  return {
    send: (c) =>
      void ready?.then(() => {
        if (!w.isDestroyed()) w.webContents.send(CAPTURE_IPC.command, c)
      }),
  }
}

/** The daemon answered: if it records with the external backend, this app supplies the audio. */
async function daemonUp(): Promise<void> {
  const h = await client.call('health').catch(() => null)
  if (h?.capture.backend === 'external' && !capture) {
    capture = new CaptureController({
      status: () => client.call('externalCaptureStatus'),
      ingest: (o) =>
        ingestPcm({ ...o, baseUrl: config.baseUrl, ...(config.token ? { token: config.token } : {}) }),
      window: captureWindow,
      tracks: captureTracks(process.platform, process.env),
      log: logLine,
    })
    logLine({ event: 'capture', kind: 'enabled', tracks: captureTracks(process.platform, process.env) })
  }
  void capture?.reconcile()
  refreshActive()
  // nothing to watch for: no in-app capture (PipeWire daemon) and no Tray (Linux)
  if (watching || (!capture && !tray)) return
  watching = true
  // a session event is when a recording may have started or stopped; the tick catches anything missed
  void client.subscribe({
    ephemeral: false,
    onEvent: (e) => {
      if (e.data.type === 'session.upserted' || e.data.type === 'session.deleted') {
        void capture?.reconcile()
        refreshActive()
      }
    },
  })
  setInterval(() => {
    void capture?.reconcile()
    refreshActive()
  }, 2000).unref()
}

function refreshActive(): void {
  if (!tray) return
  void client
    .call('listSessions', { query: { limit: 5, includePrivate: true } })
    .then(({ sessions }) => {
      active = sessions.find((s) => s.status === 'recording' || s.status === 'paused') ?? null
      refreshTray()
    })
    .catch(() => {})
}

// macOS: the menu-bar Tray (background mode there). Linux has none (the top-bar extension is that surface).
let tray: Tray | null = null

function refreshTray(): void {
  if (!tray) return
  const input = { daemon: supervisor.status, active }
  tray.setToolTip(trayTooltip(input))
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuModel(input).map((i) =>
        i.type === 'separator'
          ? { type: 'separator' as const }
          : i.type === 'status'
            ? { label: i.label, enabled: false }
            : { label: i.label, enabled: i.enabled, click: () => void trayAction(i.id) },
      ),
    ),
  )
}

async function trayAction(a: TrayAction): Promise<void> {
  try {
    if (a === 'open') return showWindow()
    if (a === 'quit') return app.quit()
    if (a === 'record') {
      const s = await client.call('createSession', { body: {} })
      await client.call('startSession', { params: { id: s.id } })
    } else if (active) {
      const params = { id: active.id }
      if (a === 'stop') await client.call('stopSession', { params })
      else if (a === 'pause') await client.call('pauseSession', { params })
      else if (a === 'resume') await client.call('resumeSession', { params })
    }
  } catch (err) {
    logLine({ event: 'tray', kind: 'error', action: a, error: String(err) })
  }
  refreshActive()
}

function createTray(): void {
  const icon = [
    join(process.resourcesPath ?? '', 'tray.png'),
    join(REPO_ROOT, 'brand', 'icons', 'png', '16.png'),
  ].find((p) => existsSync(p))
  tray = new Tray(icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty())
  refreshTray()
  refreshActive()
}

// ---- kacola:// deep links (deep-link.ts): argv, a second launch, macOS open-url → the window ------------

const deepLinks = new DeepLinkQueue()
/** The link this process was started with; received once the app is ready. */
const coldDeepLink = deepLinkFromArgv(process.argv)

/** A link wants the window: show it, and push the link if its renderer is listening (else it waits). */
function receiveDeepLink(url: string): void {
  if (!deepLinks.push(url)) return
  logLine({ event: 'deep-link', url })
  showWindow()
  deliverDeepLink()
}

function deliverDeepLink(): void {
  const w = mainWindow
  if (!w || w.isDestroyed()) return
  const url = deepLinks.deliverTo(w.webContents.id)
  if (!url) return
  w.webContents.send(IPC.deepLink, url)
  logLine({ event: 'deep-link-delivered', url })
}

app.on('second-instance', (_e, argv) => {
  const url = deepLinkFromArgv(argv)
  // a link means the user wants the window, --background or not
  if (url) receiveDeepLink(url)
  else if (!argv.includes('--background')) showWindow()
})

// macOS hands links over as an event, possibly before ready (showWindow waits for ready; the link queues)
app.on('open-url', (e, raw) => {
  e.preventDefault()
  const url = normalizeDeepLink(raw)
  if (url) receiveDeepLink(url)
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
  // getDisplayMedia from the capture window: system audio as loopback (macOS 13+); the screen source is
  // required by the API and its video track is stopped by the page at once. Anyone else: refused.
  ses.setDisplayMediaRequestHandler((req, cb) => {
    const wc = req.frame ? allWebContents.fromFrame(req.frame) : undefined
    if (process.platform !== 'darwin' || !wc || !captureWindows.has(wc.id)) return cb({})
    void desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => (sources[0] ? cb({ video: sources[0], audio: 'loopback' }) : cb({})))
      .catch(() => cb({}))
  })
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
      // the app's own version (app.getVersion() is Electron's when run unpackaged from out/main)
      version: pkg.version,
      electron: process.versions.electron,
      platform: process.platform,
      daemonUrl: config.baseUrl,
      buttonLayout,
      profile: config.profile,
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
      // GNOMEOLA_LOCALE_DIR: a directory of <lang>.json catalogues (tests)
      process.env.GNOMEOLA_LOCALE_DIR ||
        (app.isPackaged ? join(process.resourcesPath, 'locale') : join(HERE, '..', 'locale')),
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
  handle(IPC.cliStatus, () => integration.cliStatus())
  handle(IPC.cliInstall, (_e, force) => integration.installCli(force === true))
  handle(IPC.cliUninstall, () => integration.uninstallCli())
  handle(IPC.extensionStatus, () => integration.extensionStatus())
  handle(IPC.extensionInstall, () => integration.installExtension())
  handle(IPC.extensionDisable, () => integration.disableExtension())
  handle(IPC.extensionRemove, () => integration.removeExtension())
  handle(IPC.deepLinkTake, (e) => {
    const url = deepLinks.take(e.sender.id)
    if (url) logLine({ event: 'deep-link-delivered', url })
    return url
  })
  handle(IPC.autostartGet, (): AutostartState => {
    if (process.platform === 'darwin') return { enabled: app.getLoginItemSettings().openAtLogin }
    return autostartStatus(autostartDeps)
  })
  handle(IPC.autostartSet, async (_e, enabled): Promise<AutostartState> => {
    const on = enabled === true
    if (process.platform === 'darwin') {
      app.setLoginItemSettings({ openAtLogin: on, args: ['--background'] })
      return { enabled: app.getLoginItemSettings().openAtLogin }
    }
    try {
      return await setAutostart(autostartDeps, on)
    } catch (err) {
      return { ...autostartStatus(autostartDeps), detail: String((err as Error).message ?? err) }
    }
  })
  // ---- in-app capture: frames and state from the capture window only
  const isTrack = (t: unknown): t is CaptureTrack => t === 'mic' || t === 'system'
  ipcMain.on(CAPTURE_IPC.frame, (e, track: unknown, data: unknown) => {
    if (!captureWindows.has(e.sender.id) || !isTrack(track)) return
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : null
    if (!bytes || bytes.byteLength % 2 || bytes.byteLength > MAX_FRAME_BYTES) return
    capture?.onFrame(track, new Int16Array(bytes.slice().buffer))
  })
  ipcMain.on(CAPTURE_IPC.state, (e, s: CaptureState) => {
    if (!captureWindows.has(e.sender.id) || !isTrack(s?.track)) return
    capture?.onState(s)
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
    windowOptions({
      preload: PRELOAD,
      platform: process.platform,
      dark: theme.scheme === 'dark',
      icon: appIcon(),
      title: windowTitle,
    }),
  )
  // a profile's title says which window it is, whatever the page calls itself
  if (config.profile) w.on('page-title-updated', (e) => e.preventDefault())
  w.once('ready-to-show', () => {
    process.stdout.write(`${JSON.stringify({ event: 'window-ready' })}\n`)
    w.show()
    idleGc.settle()
  })
  const id = w.webContents.id
  w.on('closed', () => {
    deepLinks.reset(id)
    if (mainWindow === w) mainWindow = null
    idleGc.settle()
    mainWindowClosed()
  })
  // a reload is a new renderer: it takes again before links are pushed to it
  w.webContents.on('did-start-navigation', (d) => {
    if (d.isMainFrame && !d.isSameDocument) deepLinks.reset(id)
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

/** The brand app icon: shipped in resources/ when packaged, brand/icons in a checkout. */
function appIcon(): string | undefined {
  const candidates = [
    ...(app.isPackaged ? [join(process.resourcesPath, 'icon.png')] : []),
    join(REPO_ROOT, 'brand', 'icons', 'png', '512.png'),
  ]
  return candidates.find((p) => existsSync(p))
}

function showWindow(): void {
  if (!app.isReady()) return
  if (!mainWindow) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Closing the window keeps main (and the daemon) running; only an explicit quit stops them. In the
// Flatpak, the first close asks the Background portal (GNOME then lists us under Background Apps rather
// than treating a windowless app as stuck); the autostart choice is re-sent with it.
let askedBackground = false
app.on('window-all-closed', () => {})
function mainWindowClosed(): void {
  if (!FLATPAK || askedBackground || quitting) return
  askedBackground = true
  void requestBackground(autostartDeps, autostartStatus(autostartDeps).enabled).catch((err: unknown) =>
    logLine({ event: 'background-portal', kind: 'error', error: String(err) }),
  )
}
// macOS: clicking the Dock icon with no window open brings the window back
app.on('activate', () => showWindow())

let quitting = false
let stopWatchingPortal: () => void = () => {}
app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  stopWatchingPortal()
  void Promise.resolve(capture?.stop())
    .catch(() => {})
    .then(() => supervisor.stop())
    .then(() => {
      // our daemon was recording: it keeps going, and exits by itself once the recording ends
      if (supervisor.left) logLine({ event: 'daemon', kind: 'left-recording', ...supervisor.left })
    })
    .finally(() => app.exit(0))
})
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => app.quit())

void app.whenReady().then(async () => {
  // Linux: no application menu, so Electron's default accelerators (Ctrl+R reload, Ctrl+Shift+I
  // devtools) are gone; the window's own shortcuts live in the renderer (features/shell/shortcuts.tsx).
  // macOS keeps the default menu (Cmd+Q, the Edit menu's copy / paste).
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
  wireSession()
  wireIpc()
  readButtonLayout()
  await refreshTheme()
  stopWatchingPortal = watchPortal(() => void refreshTheme())
  nativeTheme.on('updated', () => {
    if (process.platform === 'darwin') void refreshTheme()
  })
  if (process.platform === 'darwin') createTray()
  void supervisor.start()
  // a separate profile never takes the kacola:// links from the everyday window
  const reg = config.profile
    ? null
    : schemeRegistration({
        packaged: app.isPackaged,
        platform: process.platform,
        env: process.env,
        execPath: process.execPath,
        argv: process.argv,
      })
  if (reg) {
    const ok = reg.path
      ? app.setAsDefaultProtocolClient(reg.scheme, reg.path, reg.args ?? [])
      : app.setAsDefaultProtocolClient(reg.scheme)
    if (!ok) logLine({ event: 'deep-link-scheme', kind: 'error', scheme: reg.scheme })
  }
  idleGc.start().settle()
  if (coldDeepLink) receiveDeepLink(coldDeepLink)
  if (!config.background || deepLinks.hasPending) showWindow()
})
