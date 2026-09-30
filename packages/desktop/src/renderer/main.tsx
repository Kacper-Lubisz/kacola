import './zod-config.ts'
import './styles.css'
import { setTranslator } from '@gnomeola/ui-core/i18n'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { RouterProvider as AriaRouterProvider } from 'react-aria-components'
import { createRoot } from 'react-dom/client'
import type { GnomeolaBridge } from '../shared/bridge.ts'
import { createDaemonApi } from './data/client.ts'
import { createEphemeralStore } from './data/ephemeral.ts'
import { EventBridge } from './data/event-bridge.ts'
import { catalogueTranslator } from './data/i18n.ts'
import { createQueries, createQueryClient } from './data/queries.ts'
import { type Services, ServicesProvider } from './data/services.tsx'
import { applyTheme } from './data/theme.ts'
import { ToastProvider } from './design/primitives/index.ts'
import { createAppRouter } from './routes/router.tsx'

// Renderer bootstrap: theme and translations from main first (so the first paint is already right),
// then the tunnelled client, the query cache, the one EventBridge, the router.

declare global {
  interface Window {
    gnomeola: GnomeolaBridge
  }
}

async function boot(): Promise<void> {
  const bridge = window.gnomeola
  const [theme, catalogue, appInfo] = await Promise.all([
    bridge.theme(),
    bridge.catalogue(),
    bridge.appInfo(),
  ])
  applyTheme(theme)
  bridge.onTheme(applyTheme)
  setTranslator(catalogueTranslator(catalogue))
  document.documentElement.lang = catalogue.locale

  const api = createDaemonApi(bridge)
  const queryClient = createQueryClient()
  const store = createEphemeralStore()
  const events = new EventBridge(api, queryClient, store)
  const services: Services = { bridge, api, queries: createQueries(api), queryClient, store, events, appInfo }
  const router = createAppRouter(services)
  events.start()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <AriaRouterProvider
            navigate={(to) => void router.navigate({ to })}
            useHref={(to) => router.buildLocation({ to }).href}
          >
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </AriaRouterProvider>
        </QueryClientProvider>
      </ServicesProvider>
    </StrictMode>,
  )
}

void boot()
