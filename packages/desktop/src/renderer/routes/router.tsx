import { _ } from '@gnomeola/ui-core/i18n'
import type { SessionsState } from '@gnomeola/ui-core/sessions'
import {
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router'
import { keys } from '../data/keys.ts'
import type { Services } from '../data/services.tsx'
import { EmptyState, HeaderBar } from '../design/primitives/index.ts'
import { AGENDA_TABS, AgendaPage, type AgendaTab } from '../features/agendas/agenda-page.tsx'
import { SESSION_TABS, type SessionTab } from '../features/sessions/pane.ts'
import { SessionPage } from '../features/sessions/session-page.tsx'
import { parseTime } from '../features/transcript/search-params.ts'
import { Gallery } from './gallery.tsx'
import { MainLayout, NoSessionSelected } from './main-layout.tsx'

// The route tree (hash history: the app is served from app://, there is no server to rewrite paths).
// To add a screen: create a route below with getParentRoute, give it a loader that ensureQueryData()s
// what it shows (so navigation waits for data instead of flashing empty), and add it to routeTree.
//
//   /                       main layout, nothing selected
//   /sessions/$sessionId    main layout, one session; ?tab=transcript|ask|notes|details, ?segment=<id>
//                           or ?t=<seconds> (a citation: the transcript pane scrolls to that line)
//   /agendas/$agendaId      main layout, one agenda (a calendar meeting's, or a recording's); ?tab=items|context
//   /gallery                every primitive in every state (design in code, with HMR)

const rootRoute = createRootRouteWithContext<Services>()({ component: Outlet })

const mainRoute = createRoute({ getParentRoute: () => rootRoute, id: 'main', component: MainLayout })

const indexRoute = createRoute({ getParentRoute: () => mainRoute, path: '/', component: NoSessionSelected })

const sessionRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/sessions/$sessionId',
  validateSearch: (s: Record<string, unknown>): { tab?: SessionTab; segment?: string; t?: number } => ({
    ...(SESSION_TABS.includes(s.tab as SessionTab) ? { tab: s.tab as SessionTab } : {}),
    ...(typeof s.segment === 'string' ? { segment: s.segment } : {}),
    // a time in seconds: the transcript shows the line playing then (features/transcript/search-params.ts)
    ...parseTime(s.t),
  }),
  loader: async ({ context: { queryClient, queries }, params }) => {
    // seed from the list the sidebar already holds, so selecting a row costs no round trip
    const listed = queryClient.getQueryData<SessionsState>(keys.sessions())?.byId.get(params.sessionId)
    if (listed && !queryClient.getQueryData(keys.session(params.sessionId)))
      queryClient.setQueryData(keys.session(params.sessionId), listed)
    await queryClient.ensureQueryData(queries.session(params.sessionId))
  },
  component: function SessionRoute() {
    const { sessionId } = sessionRoute.useParams()
    const { tab } = sessionRoute.useSearch()
    return <SessionPage key={sessionId} sessionId={sessionId} tab={tab} />
  },
  errorComponent: () => (
    <div className="flex h-full flex-col">
      <HeaderBar controls="end" />
      <EmptyState
        icon="warning"
        title={_('Session Not Found')}
        description={_('It may have been deleted.')}
      />
    </div>
  ),
})

const agendaRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/agendas/$agendaId',
  validateSearch: (s: Record<string, unknown>): { tab?: AgendaTab } =>
    AGENDA_TABS.includes(s.tab as AgendaTab) ? { tab: s.tab as AgendaTab } : {},
  loader: async ({ context: { queryClient, queries }, params }) => {
    await queryClient.ensureQueryData(queries.agenda(params.agendaId))
  },
  component: function AgendaRoute() {
    const { agendaId } = agendaRoute.useParams()
    const { tab } = agendaRoute.useSearch()
    return <AgendaPage key={agendaId} agendaId={agendaId} tab={tab} />
  },
  errorComponent: () => (
    <div className="flex h-full flex-col">
      <HeaderBar controls="end" />
      <EmptyState
        icon="warning"
        title={_('Agenda Not Found')}
        description={_('It may have been deleted, or the link is for another computer.')}
      />
    </div>
  ),
})

const galleryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gallery', component: Gallery })

const routeTree = rootRoute.addChildren([
  mainRoute.addChildren([indexRoute, sessionRoute, agendaRoute]),
  galleryRoute,
])

export function createAppRouter(services: Services, history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree, history, context: services, defaultPendingMinMs: 0 })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
