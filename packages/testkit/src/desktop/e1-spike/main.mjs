// E-1 spike: the smallest honest Electron window (security baseline on, a real HTML page).
import { app, BrowserWindow } from 'electron'

const t0 = Number(process.env.SPIKE_T0 ?? Date.now())
const log = (what) => process.stdout.write(`${JSON.stringify({ spike: what, ms: Date.now() - t0 })}\n`)

app.whenReady().then(() => {
  log('ready')
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    title: 'Kacola spike',
    backgroundColor: '#fafafb',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  win.once('ready-to-show', () => {
    log('ready-to-show')
    win.show()
  })
  win.webContents.once('did-finish-load', () => log('did-finish-load'))
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kacola spike</title>
  <style>body{font-family:system-ui;background:#fafafb;margin:0}aside{position:fixed;inset:0 auto 0 0;width:280px;background:#ebebed}
  main{margin-left:280px;padding:48px}h1{font-weight:800}</style></head>
  <body><aside><ul>${Array.from({ length: 12 }, (_, i) => `<li>Session ${i + 1}</li>`).join('')}</ul></aside>
  <main><h1>No Session Selected</h1><p>Pick a session from the sidebar.</p></main></body></html>`
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
})
app.on('window-all-closed', () => app.quit())
