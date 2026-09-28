import { AdwApplication } from '@gtkx/jsx/adw'
import { MainWindow } from './components/main-window.tsx'
import { StoreProvider } from './data/hooks.ts'
import type { SessionStore } from './data/store.ts'

export function App({ store, subtitle }: { store: SessionStore; subtitle: string | null }) {
  return (
    <AdwApplication>
      <StoreProvider store={store}>
        <MainWindow subtitle={subtitle} />
      </StoreProvider>
    </AdwApplication>
  )
}
