import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useStore } from 'zustand'
import { useServices } from '../data/services.tsx'
import { Banner, Button, HeaderBar, Spinner, StatusPage } from '../design/primitives/index.ts'
import { SessionSidebar } from '../features/sessions/session-sidebar.tsx'

// The main window: AdwNavigationSplitView — sidebar (session list) beside the content page. Before the
// first snapshot it is a status page (connecting / can't reach), exactly like the GTK app.

export function MainLayout() {
  const { store, events, appInfo, queries } = useServices()
  const connection = useStore(store, (s) => s.connection)
  // observe the list without fetching it: the EventBridge's snapshot is what fills it
  const everLive = useQuery({ ...queries.sessions(), enabled: false }).data !== undefined

  if (!everLive && connection.kind === 'connecting') {
    return (
      <Page>
        <StatusPage
          title={_('Connecting…')}
          description={fmt(_('Reaching gnomeola at {origin}'), { origin: appInfo.daemonUrl })}
        >
          <Spinner label={_('Connecting…')} />
        </StatusPage>
      </Page>
    )
  }
  if (!everLive && connection.kind === 'unreachable') {
    return (
      <Page>
        <StatusPage
          icon="offline"
          title={_('Can’t Reach gnomeola')}
          description={fmt(_('The gnomeola daemon is not answering at {origin}.'), {
            origin: appInfo.daemonUrl,
          })}
        >
          <Button variant="suggested" pill onPress={() => events.start()}>
            {_('Try Again')}
          </Button>
          <p className="m-0 max-w-[50ch] text-[9pt] text-dim select-text">{connection.error}</p>
        </StatusPage>
      </Page>
    )
  }
  return (
    <div className="flex h-full">
      <aside
        aria-label={_('Sessions')}
        className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--sidebar-border-color)] bg-sidebar text-sidebar-fg"
      >
        <HeaderBar controls="start" title={_('Sessions')} />
        {connection.kind === 'reconnecting' ? (
          <Banner title={_('Lost the connection to the daemon. Reconnecting…')} />
        ) : null}
        <SessionSidebar />
      </aside>
      <main className="min-w-0 flex-1 bg-view text-view-fg">
        <Outlet />
      </main>
    </div>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <HeaderBar />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}

export function NoSessionSelected() {
  return (
    <div className="flex h-full flex-col">
      <HeaderBar controls="end" />
      <div className="min-h-0 flex-1">
        <StatusPage
          icon="record"
          title={_('No Session Selected')}
          description={_('Pick a session in the sidebar, or press Record to start one.')}
        />
      </div>
    </div>
  )
}
