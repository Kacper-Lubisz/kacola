import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../data/services.tsx'
import {
  Button,
  EmptyState,
  HeaderBar,
  Spinner,
  SplitView,
  useSplitView,
} from '../design/primitives/index.ts'
import { AboutDialog } from '../features/about/about-dialog.tsx'
import { DeepLinkHandler } from '../features/agendas/deep-links.tsx'
import { FollowDialogHost } from '../features/agendas/follow.tsx'
import { OnboardingDialog } from '../features/onboarding/onboarding-dialog.tsx'
import { useOnboarding } from '../features/onboarding/onboarding-state.ts'
import { PreferencesDialog } from '../features/preferences/preferences-dialog.tsx'
import { useRecorder } from '../features/sessions/recorder.ts'
import { SessionSidebar } from '../features/sessions/session-sidebar.tsx'
import { DialogsProvider, useDialogs } from '../features/shell/dialogs.tsx'
import { ShortcutsDialog, useShortcuts } from '../features/shell/shortcuts.tsx'

// The main window: the session list beside the selected session (SplitView; below 560px one pane at a
// time with a Back button). Before the first snapshot it is a whole-window status page (connecting /
// can't reach the daemon), as in the GTK app. The window's dialogs, keyboard shortcuts and first-run
// onboarding live here.

export function MainLayout() {
  return (
    <DialogsProvider>
      <Window />
    </DialogsProvider>
  )
}

function Window() {
  const { store, events, appInfo, queries } = useServices()
  const connection = useStore(store, (s) => s.connection)
  // observe the list without fetching it: the EventBridge's snapshot is what fills it
  const everLive = useQuery({ ...queries.sessions(), enabled: false }).data !== undefined
  const live = everLive && connection.kind !== 'unreachable'
  const onboarding = useOnboarding(everLive)
  const dialogs = useDialogs()

  // opens by itself once each time it becomes due — not again whenever another dialog closes
  const dialogsRef = useRef(dialogs)
  dialogsRef.current = dialogs
  useEffect(() => {
    if (onboarding.due && dialogsRef.current.current === null) dialogsRef.current.open('onboarding')
  }, [onboarding.due])

  if (!everLive && connection.kind !== 'unreachable') {
    return (
      <Page>
        <EmptyState
          title={_('Connecting…')}
          description={fmt(_('Reaching gnomeola at {origin}'), { origin: appInfo.daemonUrl })}
        >
          <Spinner label={_('Connecting…')} />
        </EmptyState>
      </Page>
    )
  }
  if (!everLive && connection.kind === 'unreachable') {
    return (
      <Page>
        <EmptyState
          icon="offline"
          title={_('Can’t Reach gnomeola')}
          description={fmt(_('The gnomeola daemon is not answering at {origin}.'), {
            origin: appInfo.daemonUrl,
          })}
        >
          <Button variant="primary" size="lg" onPress={() => events.start()}>
            {_('Try Again')}
          </Button>
          <p className="m-0 max-w-[50ch] type-caption text-text-secondary select-text">{connection.error}</p>
        </EmptyState>
      </Page>
    )
  }
  return (
    <>
      <Split missing={onboarding.missing.length} />
      {live ? <DialogHost onOnboardingDone={onboarding.done} /> : null}
      {everLive ? <DeepLinkHandler /> : null}
      {live ? <FollowDialogHost /> : null}
      <Shortcuts />
    </>
  )
}

function Split({ missing }: { missing: number }) {
  const params = useParams({ strict: false }) as { sessionId?: string; agendaId?: string }
  const navigate = useNavigate()
  return (
    <SplitView
      sidebarLabel={_('Sessions')}
      contentLabel={_('Session')}
      showContent={params.sessionId !== undefined || params.agendaId !== undefined}
      onShowContentChange={(show) => {
        if (!show) void navigate({ to: '/' })
      }}
      sidebar={<SessionSidebar missingModels={missing} />}
      content={<Outlet />}
    />
  )
}

function DialogHost({ onOnboardingDone }: { onOnboardingDone: (skipped: string[] | null) => void }) {
  const { current, close } = useDialogs()
  const { appInfo } = useServices()
  if (current === 'preferences') return <PreferencesDialog onClose={close} />
  if (current === 'about') return <AboutDialog onClose={close} />
  if (current === 'shortcuts') return <ShortcutsDialog onClose={close} mac={appInfo.platform === 'darwin'} />
  if (current === 'onboarding')
    return (
      <OnboardingDialog
        onFinished={(skipped) => {
          onOnboardingDone(skipped)
          close()
        }}
      />
    )
  return null
}

function Shortcuts() {
  const { appInfo, bridge } = useServices()
  const dialogs = useDialogs()
  const recorder = useRecorder()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { sessionId?: string }
  useShortcuts((a) => {
    switch (a) {
      case 'preferences':
      case 'shortcuts':
        dialogs.open(a)
        return
      case 'close-window':
        bridge.windowControl('close')
        return
      case 'search':
        document.querySelector<HTMLInputElement>('[data-shortcut="search"] input')?.focus()
        return
      case 'menu':
        document.querySelector<HTMLButtonElement>('[data-shortcut="menu"]')?.click()
        return
      case 'record':
        if (recorder.state === 'recording' || recorder.state === 'paused') recorder.stop()
        else if (recorder.state === 'idle') recorder.record()
        return
      case 'pause':
        if (recorder.state === 'recording') recorder.pause()
        else if (recorder.state === 'paused') recorder.resume()
        return
      case 'tab-transcript':
      case 'tab-ask':
      case 'tab-notes':
      case 'tab-details':
        if (params.sessionId)
          void navigate({
            to: '/sessions/$sessionId',
            params: { sessionId: params.sessionId },
            search: { tab: a.slice(4) as 'transcript' },
          })
        return
      case 'quit':
        return // main handles Ctrl+Q before the page sees it
    }
  }, appInfo.platform === 'darwin')
  return null
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
  const { collapsed } = useSplitView()
  if (collapsed) return null
  return (
    <div className="flex h-full flex-col">
      <HeaderBar controls="end" />
      <div className="min-h-0 flex-1">
        <EmptyState
          icon="mic"
          title={_('No Session Selected')}
          description={_('Pick a session in the sidebar, or press Record to start one.')}
        />
      </div>
    </div>
  )
}
