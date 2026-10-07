import type { QueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext } from 'react'
import type { AppInfo, KacolaBridge } from '../../shared/bridge.ts'
import type { EphemeralStore } from './ephemeral.ts'
import type { EventBridge } from './event-bridge.ts'
import type { Api, Queries } from './queries.ts'

// Everything a screen may need, built once in main.tsx and handed down by context (and to the router as
// its context, for loaders). Tests build their own with fakes.

export type Services = {
  bridge: KacolaBridge
  api: Api
  queries: Queries
  queryClient: QueryClient
  store: EphemeralStore
  events: EventBridge
  appInfo: AppInfo
}

const Ctx = createContext<Services | null>(null)

export function ServicesProvider({ services, children }: { services: Services; children?: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>
}

export function useServices(): Services {
  const s = useContext(Ctx)
  if (!s) throw new Error('useServices outside ServicesProvider')
  return s
}
