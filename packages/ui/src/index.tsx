import * as GLib from '@gtkx/gi/glib'
import { createRoot } from '@gtkx/react'
import { App } from './app.tsx'
import { readConfig } from './data/config.ts'
import { createDaemonSource } from './data/daemon-source.ts'
import { createDemoSource } from './data/demo-source.ts'
import { SessionStore } from './data/store.ts'
import { Gallery } from './gallery.tsx'

// Entry point. GNOMEOLA_UI_DEMO=1 runs against an in-process fake; otherwise the daemon at
// GNOMEOLA_URL (default http://127.0.0.1:8787).

// The name AT-SPI, the Shell and the about dialog know us by (otherwise it would be "node").
GLib.setApplicationName('gnomeola')
GLib.setPrgname('gnomeola')

if (process.env.GNOMEOLA_UI_GALLERY === '1') {
  // A widget gallery for docs/gtkx.md and its e2e test, not a product screen.
  createRoot().render(<Gallery />)
} else {
  const config = readConfig(process.env)
  const source =
    config.mode === 'demo'
      ? createDemoSource({ intervalMs: config.intervalMs, maxSessions: config.maxSessions })
      : createDaemonSource({ baseUrl: config.baseUrl, timeoutMs: config.timeoutMs })
  const store = new SessionStore(source)
  store.start()
  createRoot().render(<App store={store} subtitle={config.mode === 'demo' ? 'Demo data' : null} />)
}
