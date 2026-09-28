import { AdwApplication } from '@gtkx/jsx/adw'
import { DialogsProvider } from './components/dialogs.tsx'
import { MainWindow, type WindowOptions } from './components/main-window.tsx'
import { installStyles } from './components/styles.ts'
import { StoreProvider } from './data/hooks.ts'
import type { SessionStore } from './data/store.ts'

// Keyboard shortcuts for the window actions (GNOME conventions: Ctrl+, for Preferences).
const ACCELS = [
  { detailedActionName: 'win.preferences', accels: ['<Control>comma'] },
  { detailedActionName: 'window.close', accels: ['<Control>w'] },
]

export function App({ store, ...opts }: { store: SessionStore } & WindowOptions) {
  installStyles()
  return (
    <AdwApplication actionAccels={ACCELS}>
      <StoreProvider store={store}>
        <DialogsProvider initial={null}>
          <MainWindow {...opts} />
        </DialogsProvider>
      </StoreProvider>
    </AdwApplication>
  )
}
