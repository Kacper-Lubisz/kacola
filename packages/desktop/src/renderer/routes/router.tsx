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
import { EmptyState } from '../design/primitives/index.ts'
import { HomePage } from '../features/home/home-page.tsx'
import { BackHeader, MeetingPage } from '../features/meeting/meeting-page.tsx'
import { type MeetingSearch, parseMeetingSearch } from '../features/meeting/search-params.ts'
import { Gallery } from './gallery.tsx'
import { MainLayout } from './main-layout.tsx'

// The route tree (hash history: the app is served from app://, there is no server to rewrite paths).
// Two levels and no sidebar: home is your day, and a meeting is one page that changes with its phase
// (Prep → Live → Outcome). To add a screen: create a route below with getParentRoute, give it a loader
// that ensureQueryData()s what it shows (so navigation waits for data instead of flashing empty), and
// add it to routeTree.
//
//   /                       home: search-and-ask (?q=), today's meetings, earlier days
//   /sessions/$sessionId    a recorded meeting (live, or its outcome); ?panel=transcript opens the
//                           transcript beside it, ?segment=<id> / ?t=<seconds> at a cited line
//   /agendas/$agendaId      a meeting by its agenda (prep before it starts; the same page as its
//                           recording once there is one)
//   /gallery                every primitive in every state (design in code, with HMR)

const rootRoute = createRootRouteWithContext<Services>()({ component: Outlet })

const mainRoute = createRoute({ getParentRoute: () => rootRoute, id: 'main', component: MainLayout })

const indexRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === 'string' && s.q ? { q: s.q } : {},
  component: HomePage,
})

const notFound = (title: string, description: string) => () => (
  <div className="flex h-full flex-col">
    <BackHeader />
    <EmptyState icon="warning" title={title} description={description} />
  </div>
)

const sessionRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/sessions/$sessionId',
  validateSearch: (s: Record<string, unknown>): MeetingSearch => parseMeetingSearch(s),
  loader: async ({ context: { queryClient, queries }, params }) => {
    // seed from the list home already holds, so opening a meeting costs no round trip
    const listed = queryClient.getQueryData<SessionsState>(keys.sessions())?.byId.get(params.sessionId)
    if (listed && !queryClient.getQueryData(keys.session(params.sessionId)))
      queryClient.setQueryData(keys.session(params.sessionId), listed)
    await queryClient.ensureQueryData(queries.session(params.sessionId))
  },
  component: function SessionRoute() {
    const { sessionId } = sessionRoute.useParams()
    return <MeetingPage key={sessionId} sessionId={sessionId} />
  },
  errorComponent: notFound(_('Meeting Not Found'), _('It may have been deleted.')),
})

const agendaRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/agendas/$agendaId',
  validateSearch: (s: Record<string, unknown>): MeetingSearch => parseMeetingSearch(s),
  loader: async ({ context: { queryClient, queries }, params }) => {
    await queryClient.ensureQueryData(queries.agenda(params.agendaId))
  },
  component: function AgendaRoute() {
    const { agendaId } = agendaRoute.useParams()
    return <MeetingPage key={agendaId} agendaId={agendaId} />
  },
  errorComponent: notFound(
    _('Agenda Not Found'),
    _('It may have been deleted, or the link is for another computer.'),
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
