import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

// Sidebar layout (AdwNavigationSplitView's behaviour, brand look): a bg.sidebar column beside the
// content. Below the breakpoint (560px, the GTK app's) it collapses to ONE pane at a time: the sidebar,
// or the content with a Back button (`useSplitView().collapsed` → the content's header shows it and
// calls `showSidebar()`). Which pane shows when collapsed is the screen's state (`showContent`), so
// selecting a session can move to it.

export const NARROW_QUERY = '(max-width: 560px)'

/** True while the window is narrower than the breakpoint. */
export function useNarrow(query: string = NARROW_QUERY): boolean {
  const mq = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null),
    [query],
  )
  const [narrow, setNarrow] = useState(() => mq?.matches ?? false)
  useEffect(() => {
    if (!mq) return
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [mq])
  return narrow
}

type SplitCtx = { collapsed: boolean; showSidebar: () => void }
const Ctx = createContext<SplitCtx>({ collapsed: false, showSidebar: () => {} })
export const useSplitView = (): SplitCtx => useContext(Ctx)

export function SplitView({
  sidebarLabel,
  sidebar,
  content,
  contentLabel,
  showContent,
  onShowContentChange,
  collapsed: forced,
  landmarks = true,
}: {
  /** Accessible name of the sidebar region. */
  sidebarLabel: string
  sidebar: ReactNode
  content: ReactNode
  contentLabel?: string
  /** Collapsed only: whether the content (true) or the sidebar (false) is on screen. */
  showContent: boolean
  onShowContentChange: (v: boolean) => void
  /** Override the breakpoint (tests, the gallery). */
  collapsed?: boolean
  /** aside/main landmarks (default). Off for a demo nested inside another page's main. */
  landmarks?: boolean
}) {
  const narrow = useNarrow()
  const collapsed = forced ?? narrow
  const ctx: SplitCtx = { collapsed, showSidebar: () => onShowContentChange(false) }
  const sidebarShown = !collapsed || !showContent
  const contentShown = !collapsed || showContent
  const Aside = landmarks ? 'aside' : 'div'
  const Main = landmarks ? 'main' : 'div'
  return (
    <Ctx.Provider value={ctx}>
      <div className="flex h-full min-h-0 w-full">
        {sidebarShown ? (
          <Aside
            aria-label={landmarks ? sidebarLabel : undefined}
            className={`flex min-h-0 flex-col bg-sidebar text-sidebar-fg ${collapsed ? 'w-full' : 'w-(--sidebar-width) shrink-0 border-r border-(--sidebar-border-color)'}`}
          >
            {sidebar}
          </Aside>
        ) : null}
        {contentShown ? (
          <Main aria-label={landmarks ? contentLabel : undefined} className="flex min-h-0 min-w-0 flex-1 flex-col bg-view text-view-fg">
            {content}
          </Main>
        ) : null}
      </div>
    </Ctx.Provider>
  )
}
