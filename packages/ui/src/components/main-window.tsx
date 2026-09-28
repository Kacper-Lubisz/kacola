import * as Adw from '@gtkx/gi/adw'
import { AdwApplicationWindow, AdwBreakpoint, AdwNavigationPage, AdwNavigationSplitView } from '@gtkx/jsx/adw'
import { quit } from '@gtkx/react'
import { type ReactNode, useState } from 'react'
import { displayTitle } from '../data/format.ts'
import { useConnection, useSession, useStore } from '../data/hooks.ts'
import { NothingSelected, SessionDetail } from './session-detail.tsx'
import { Sidebar } from './sidebar.tsx'
import { Connecting, Unreachable } from './status-pages.tsx'
import { ToastHost } from './toasts.tsx'

function SplitView({ collapsed, subtitle }: { collapsed: boolean; subtitle: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Which pane is visible when collapsed. The split view also changes this itself (back button,
  // swipe, Escape), so it is mirrored back through onNotifyShowContent.
  const [showContent, setShowContent] = useState(false)
  const selected = useSession(selectedId)

  const select = (id: string) => {
    setSelectedId(id)
    setShowContent(true)
  }

  return (
    <AdwNavigationSplitView
      collapsed={collapsed}
      showContent={showContent}
      onNotifyShowContent={(v) => setShowContent(Boolean(v))}
      minSidebarWidth={260}
      maxSidebarWidth={360}
      sidebarWidthFraction={0.32}
      sidebar={
        <AdwNavigationPage title="Sessions" tag="sidebar">
          <Sidebar selectedId={selected ? selectedId : null} onSelect={select} subtitle={subtitle} />
        </AdwNavigationPage>
      }
    >
      {/* children fill the split view's `content` slot */}
      <AdwNavigationPage title={selected ? displayTitle(selected) : 'gnomeola'} tag="content">
        {selected ? <SessionDetail session={selected} /> : <NothingSelected />}
      </AdwNavigationPage>
    </AdwNavigationSplitView>
  )
}

export function MainWindow({ subtitle }: { subtitle: string | null }) {
  const store = useStore()
  const connection = useConnection()
  const [collapsed, setCollapsed] = useState(false)

  let body: ReactNode
  if (connection.kind === 'connecting') {
    body = <Connecting origin={store.origin} />
  } else if (connection.kind === 'unreachable') {
    body = (
      <Unreachable
        origin={connection.origin}
        error={connection.error}
        retryInMs={connection.retryInMs}
        onRetry={() => store.retry()}
      />
    )
  } else {
    body = <SplitView collapsed={collapsed} subtitle={subtitle} />
  }

  return (
    <AdwApplicationWindow
      title="gnomeola"
      defaultWidth={1024}
      defaultHeight={700}
      widthRequest={360}
      heightRequest={294}
      onCloseRequest={quit}
      breakpoints={
        <AdwBreakpoint
          condition={Adw.BreakpointCondition.parse('max-width: 560sp')}
          onApply={() => setCollapsed(true)}
          onUnapply={() => setCollapsed(false)}
        />
      }
    >
      <ToastHost>{body}</ToastHost>
    </AdwApplicationWindow>
  )
}
