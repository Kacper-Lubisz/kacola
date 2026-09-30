import type { ReactNode } from 'react'
import { useServices } from '../../data/services.tsx'
import { WindowControls } from './window-controls.tsx'

// Header bar (brand spec): 48px, bg.window, title in Bricolage 600 15. It is the frameless window's drag
// region; interactive children opt out (every primitive carries app-no-drag). Window chrome stays
// platform-appropriate: on Linux our own window buttons on the side(s) button-layout puts them; on
// macOS the native traffic lights sit over the top-left, so a header bar that owns the start edge
// leaves them room. Each pane of a split view has its own header bar, so `controls` says which of the
// window's edges this one owns.

export function HeaderBar({
  title,
  start,
  end,
  controls = 'both',
  className = '',
}: {
  title?: ReactNode
  start?: ReactNode
  end?: ReactNode
  /** Which of the window's edges (and so window-button groups) this header bar carries. */
  controls?: 'start' | 'end' | 'both' | 'none'
  className?: string
}) {
  const { appInfo } = useServices()
  const ownsStart = controls === 'start' || controls === 'both'
  const ownsEnd = controls === 'end' || controls === 'both'
  const mac = appInfo.platform === 'darwin'
  return (
    <header
      className={`app-drag grid h-(--headerbar-height) shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-headerbar px-2 text-text-primary ${mac && ownsStart ? 'pl-[78px]' : ''} ${className}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
        {ownsStart ? <WindowControls side="start" /> : null}
        {start}
      </div>
      <div className="min-w-0 truncate text-center font-display text-[15px] font-semibold">{title}</div>
      <div className="flex min-w-0 items-center gap-1.5 justify-self-end">
        {end}
        {ownsEnd ? <WindowControls side="end" /> : null}
      </div>
    </header>
  )
}
