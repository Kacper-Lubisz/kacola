import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../data/services.tsx'
import { Button, EmptyState, HeaderBar, Spinner } from '../design/primitives/index.ts'
import { AboutDialog } from '../features/about/about-dialog.tsx'
import { DeepLinkHandler } from '../features/agendas/deep-links.tsx'
import { FollowDialogHost } from '../features/agendas/follow.tsx'
import { useMeetingUi } from '../features/meeting/meeting-ui.ts'
import { OnboardingDialog } from '../features/onboarding/onboarding-dialog.tsx'
import { MissingModelsContext, useOnboarding } from '../features/onboarding/onboarding-state.ts'
import { PreferencesDialog } from '../features/preferences/preferences-dialog.tsx'
import { useRecorder } from '../features/sessions/recorder.ts'
import { DialogsProvider, useDialogs } from '../features/shell/dialogs.tsx'
import { ShortcutsDialog, useShortcuts } from '../features/shell/shortcuts.tsx'

// The main window: one page at a time — home (your day) or a meeting — with no sidebar; every meeting
// page has Back to Today. Before the first snapshot it is a whole-window status page (connecting /
// can't reach the daemon). The window's dialogs, keyboard shortcuts and first-run onboarding live here.

export function MainLayout() {
  return (
    <DialogsProvider>
      <Window />
      <ProfileBadge />
    </DialogsProvider>
  )
}

/**
 * A separate profile of the window (`pnpm sandbox start`) says so in a corner, all the time, so it is
 * never mistaken for the everyday window (the title says it too: `kacola · sandbox`).
 */
function ProfileBadge() {
  const { appInfo } = useServices()
  useEffect(() => {
    if (appInfo.profile) document.title = `kacola · ${appInfo.profile}`
  }, [appInfo.profile])
  if (!appInfo.profile) return null
  return (
    <div
      role="status"
      aria-label={fmt(_('This is the {profile} window'), { profile: appInfo.profile })}
      data-profile-badge={appInfo.profile}
      className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-full bg-accent-record px-2.5 py-0.5 type-caption font-semibold text-text-on-accent capitalize shadow-sm"
    >
      {appInfo.profile}
    </div>
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
          description={fmt(_('Reaching kacola at {origin}'), { origin: appInfo.daemonUrl })}
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
          title={_('Can’t Reach kacola')}
          description={fmt(
            _('kacola records and transcribes in a background service, and it is not answering at {origin}.'),
            { origin: appInfo.daemonUrl },
          )}
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
      <main className="flex h-full min-h-0 flex-col bg-bg-window">
        <MissingModelsContext.Provider value={onboarding.missing.length}>
          <Outlet />
        </MissingModelsContext.Provider>
      </main>
      {live ? <DialogHost onOnboardingDone={onboarding.done} /> : null}
      {everLive ? <DeepLinkHandler /> : null}
      {live ? <FollowDialogHost /> : null}
      <Shortcuts />
    </>
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
  const location = useLocation()
  const params = useParams({ strict: false }) as { sessionId?: string; agendaId?: string }
  const inMeeting = params.sessionId !== undefined || params.agendaId !== undefined
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
        // home's search box; a meeting's transcript panel has its own Ctrl+F
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
      case 'ask':
        if (inMeeting) useMeetingUi.getState().toggleAsk()
        else document.querySelector<HTMLInputElement>('[data-shortcut="search"] input')?.focus()
        return
      case 'transcript':
        // either form of the meeting's URL (by recording or by agenda); before a recording there is
        // no transcript, and the page ignores the panel
        if (inMeeting) {
          const open = (location.search as { panel?: string }).panel === 'transcript'
          void navigate({ to: '.', search: open ? {} : { panel: 'transcript' }, replace: true })
        }
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
