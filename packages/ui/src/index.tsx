import { fileURLToPath } from 'node:url'
import { createDaemonSource } from '@gnomeola/ui-core/daemon-source'
import { createDemoSource } from '@gnomeola/ui-core/demo-source'
import { _ } from '@gnomeola/ui-core/i18n'
import { SessionStore } from '@gnomeola/ui-core/store'
import * as GLib from '@gtkx/gi/glib'
import { createRoot } from '@gtkx/react'
import { App } from './app.tsx'
import { readConfig } from './data/config.ts'
import { Gallery } from './gallery.tsx'
import { installGettext } from './i18n/gettext.ts'

// Entry point. GNOMEOLA_UI_DEMO=1 runs against an in-process fake; otherwise the daemon at
// GNOMEOLA_URL (default http://127.0.0.1:8787).

// The name AT-SPI, the Shell and the about dialog know us by (otherwise it would be "node").
GLib.setApplicationName('gnomeola')
GLib.setPrgname('gnomeola')
// Before any `_()` runs: bind the text domain so translated catalogs (if any) are used.
installGettext(process.env, fileURLToPath(import.meta.url))

if (process.env.GNOMEOLA_UI_GALLERY === '1') {
  // A widget gallery for docs/gtkx.md and its e2e test, not a product screen.
  createRoot().render(<Gallery />)
} else {
  const config = readConfig(process.env)
  const source =
    config.mode === 'demo'
      ? createDemoSource({ intervalMs: config.intervalMs, maxSessions: config.maxSessions })
      : createDaemonSource({ baseUrl: config.baseUrl, timeoutMs: config.timeoutMs, token: config.token })
  const store = new SessionStore(source)
  store.start()
  createRoot().render(
    <App
      store={store}
      subtitle={config.mode === 'demo' ? _('Demo data') : null}
      uiStatePath={config.uiStatePath}
      autoOnboarding={config.autoOnboarding}
    />,
  )
}
