import type { ModelInfo } from '@gnomeola/protocol'
import { displayTitle } from '@gnomeola/ui-core/format'
import { useConnection, useSession, useSettings, useStore } from '@gnomeola/ui-core/hooks'
import { _ } from '@gnomeola/ui-core/i18n'
import { missingModels } from '@gnomeola/ui-core/settings'
import * as Adw from '@gtkx/gi/adw'
import { AdwApplicationWindow, AdwBreakpoint, AdwNavigationPage, AdwNavigationSplitView } from '@gtkx/jsx/adw'
import { GSimpleAction } from '@gtkx/jsx/gio'
import { quit } from '@gtkx/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { readUiState, shouldOnboard, type UiState, writeUiState } from '../data/ui-state.ts'
import { DialogHost, useDialogs } from './dialogs.tsx'
import { NothingSelected, SessionDetail } from './session-detail.tsx'
import { Sidebar } from './sidebar.tsx'
import { Connecting, Unreachable } from './status-pages.tsx'
import { ToastHost } from './toasts.tsx'

export type WindowOptions = {
  subtitle: string | null
  /** Where onboarding completion is remembered (see data/ui-state.ts). */
  uiStatePath: string
  /** Open onboarding by itself when it is due (off in demo mode unless asked for). */
  autoOnboarding: boolean
}

function SplitView({
  collapsed,
  subtitle,
  missing,
}: {
  collapsed: boolean
  subtitle: string | null
  missing: readonly ModelInfo[]
}) {
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
      sidebarWidthFraction={0.3}
      sidebar={
        <AdwNavigationPage title={_('Sessions')} tag="sidebar">
          <Sidebar
            selectedId={selected ? selectedId : null}
            onSelect={select}
            subtitle={subtitle}
            missingModels={missing}
          />
        </AdwNavigationPage>
      }
    >
      {/* children fill the split view's `content` slot */}
      <AdwNavigationPage title={selected ? displayTitle(selected) : 'gnomeola'} tag="content">
        {selected ? (
          <SessionDetail key={selected.id} session={selected} narrow={collapsed} />
        ) : (
          <NothingSelected />
        )}
      </AdwNavigationPage>
    </AdwNavigationSplitView>
  )
}

/**
 * Onboarding: once connected, ask the daemon which models exist, compare with what the UI state file
 * remembers, and open the flow when it is due. Returns the missing required models (for the banner).
 */
function useOnboarding(opts: WindowOptions, live: boolean) {
  const store = useStore()
  const settings = useSettings()
  const dialogs = useDialogs()
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [uiState, setUiState] = useState<UiState>(() => readUiState(opts.uiStatePath))

  useEffect(() => {
    if (!live) return
    const ac = new AbortController()
    store.api
      .listModels(ac.signal)
      .then((m) => {
        if (!ac.signal.aborted) setModels(m)
      })
      .catch(() => {
        // an older daemon without /models: nothing to set up
      })
    return () => ac.abort()
  }, [store, live])

  const missing = models ? missingModels(models, settings) : null
  const due = live && shouldOnboard(uiState, missing)
  const autoOpen = opts.autoOnboarding && due && models !== null
  // Opens once each time it becomes due — not again whenever another dialog closes, which is why
  // `dialogs` is read through a ref rather than being a dependency.
  const dialogsRef = useRef(dialogs)
  dialogsRef.current = dialogs
  useEffect(() => {
    if (autoOpen && dialogsRef.current.current === null) dialogsRef.current.open('onboarding')
  }, [autoOpen])

  const done = (skippedMissing: string[] | null) => {
    const next: UiState = { version: 1, onboardingDone: true, skippedMissing: skippedMissing ?? [] }
    setUiState(next)
    try {
      writeUiState(opts.uiStatePath, next)
    } catch {
      // not fatal: onboarding simply shows again next time
    }
    // pick up what was downloaded meanwhile, for the banner
    store.api.listModels().then(setModels, () => {})
  }
  return { missing: missing ?? [], done }
}

export function MainWindow(opts: WindowOptions) {
  const store = useStore()
  const connection = useConnection()
  const dialogs = useDialogs()
  const [collapsed, setCollapsed] = useState(false)
  const live = connection.kind === 'live' || connection.kind === 'reconnecting'
  const onboarding = useOnboarding(opts, live)

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
    body = <SplitView collapsed={collapsed} subtitle={opts.subtitle} missing={onboarding.missing} />
  }

  return (
    <AdwApplicationWindow
      title="gnomeola"
      defaultWidth={1100}
      defaultHeight={740}
      widthRequest={360}
      heightRequest={294}
      onCloseRequest={quit}
      // win.* actions: the primary menu and the keyboard shortcuts (app.tsx) activate these
      actions={
        <>
          <GSimpleAction name="preferences" onActivate={() => dialogs.open('preferences')} />
          <GSimpleAction name="about" onActivate={() => dialogs.open('about')} />
          <GSimpleAction name="onboarding" onActivate={() => dialogs.open('onboarding')} />
        </>
      }
      breakpoints={
        <AdwBreakpoint
          condition={Adw.BreakpointCondition.parse('max-width: 560sp')}
          onApply={() => setCollapsed(true)}
          onUnapply={() => setCollapsed(false)}
        />
      }
    >
      <ToastHost>
        {body}
        {live ? <DialogHost onOnboardingDone={onboarding.done} /> : null}
      </ToastHost>
    </AdwApplicationWindow>
  )
}
