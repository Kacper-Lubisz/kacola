// Placeholder Electron main process for the packaging pipelines (Flatpak, macOS zips) until
// packages/desktop lands. It does exactly the daemon half of the real main process's job, so the
// packages can be built and tested end to end now:
//
//   - single instance (app.requestSingleInstanceLock)
//   - attach if the configured daemon URL already answers /health, else spawn the bundled daemon
//     (resources/runtime/daemon.mjs) on this same binary with ELECTRON_RUN_AS_NODE=1, restarting it with
//     backoff if it dies
//   - `--background`: no window (the CLI shim starts the app this way); without it, a minimal window
//   - quits (and stops the daemon it started) on SIGTERM / app.quit()
//
// GNOMEOLA_URL chooses the daemon URL (default http://127.0.0.1:8787); its port is the one the daemon is
// started on. The real main (packages/desktop/src/main) replaces this file (build-flatpak.ts / build-macos.ts --app-dir).
'use strict'
const { app, BrowserWindow } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')

const background = process.argv.includes('--background')
const url = process.env.GNOMEOLA_URL || 'http://127.0.0.1:8787'
const port = new URL(url).port || '8787'
let daemon = null
let quitting = false
let backoff = 500

const log = (msg) => process.stderr.write(`gnomeola-app: ${msg}\n`)

async function healthy() {
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })
    return r.ok
  } catch {
    return false
  }
}

function runtimeDir() {
  // packaged: <resources>/runtime; GNOMEOLA_RUNTIME_DIR overrides (tests)
  return process.env.GNOMEOLA_RUNTIME_DIR || path.join(process.resourcesPath, 'runtime')
}

function startDaemon() {
  const entry = path.join(runtimeDir(), 'daemon.mjs')
  log(`starting daemon ${entry} on port ${port}`)
  const child = spawn(process.execPath, [entry, '--port', port], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  daemon = child
  child.on('exit', (code, signal) => {
    if (daemon === child) daemon = null
    if (quitting) return
    log(`daemon exited (${signal ?? code}); restarting in ${backoff} ms`)
    setTimeout(() => {
      if (!quitting) startDaemon()
    }, backoff)
    backoff = Math.min(backoff * 2, 30_000)
  })
}

if (!app.requestSingleInstanceLock()) {
  log('already running')
  app.quit()
} else {
  // closing the window keeps the app (and its daemon) running; Quit is explicit
  app.on('window-all-closed', () => {})
  app.on('before-quit', () => {
    quitting = true
    daemon?.kill('SIGTERM')
  })
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => app.quit())
  app.whenReady().then(async () => {
    if (await healthy()) log(`attached to the daemon at ${url}`)
    else startDaemon()
    if (!background) {
      const win = new BrowserWindow({
        width: 480,
        height: 240,
        title: 'gnomeola',
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
      })
      win.loadURL(
        `data:text/html,${encodeURIComponent('<!doctype html><title>gnomeola</title><body style="font:15px system-ui;padding:2em">gnomeola placeholder: the daemon is running. The real window lands with packages/desktop.</body>')}`,
      )
    }
  })
}
