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
import { HeaderBar, StatusPage } from '../design/primitives/index.ts'
import { SessionPage } from '../features/sessions/session-page.tsx'
import { Gallery } from './gallery.tsx'
import { MainLayout, NoSessionSelected } from './main-layout.tsx'

// The route tree (hash history: the app is served from app://, there is no server to rewrite paths).
// To add a screen: create a route below with getParentRoute, give it a loader that ensureQueryData()s
// what it shows (so navigation waits for data instead of flashing empty), and add it to routeTree.
//
//   /                       main layout, nothing selected
//   /sessions/$sessionId    main layout, one session
//   /gallery                every primitive in every state (design in code, with HMR)

const rootRoute = createRootRouteWithContext<Services>()({ component: Outlet })

const mainRoute = createRoute({ getParentRoute: () => rootRoute, id: 'main', component: MainLayout })

const indexRoute = createRoute({ getParentRoute: () => mainRoute, path: '/', component: NoSessionSelected })

const sessionRoute = createRoute({
  getParentRoute: () => mainRoute,
  path: '/sessions/$sessionId',
  loader: async ({ context: { queryClient, queries }, params }) => {
    // seed from the list the sidebar already holds, so selecting a row costs no round trip
    const listed = queryClient.getQueryData<SessionsState>(keys.sessions())?.byId.get(params.sessionId)
    if (listed && !queryClient.getQueryData(keys.session(params.sessionId)))
      queryClient.setQueryData(keys.session(params.sessionId), listed)
    await queryClient.ensureQueryData(queries.session(params.sessionId))
  },
  component: function SessionRoute() {
    const { sessionId } = sessionRoute.useParams()
    return <SessionPage sessionId={sessionId} />
  },
  errorComponent: () => (
    <div className="flex h-full flex-col">
      <HeaderBar controls="end" />
      <StatusPage
        icon="warning"
        title={_('Session Not Found')}
        description={_('It may have been deleted.')}
      />
    </div>
  ),
})

const galleryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gallery', component: Gallery })

const routeTree = rootRoute.addChildren([mainRoute.addChildren([indexRoute, sessionRoute]), galleryRoute])

export function createAppRouter(services: Services, history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree, history, context: services, defaultPendingMinMs: 0 })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
