import type { ReactNode } from 'react'
import { WindowControls } from './window-controls.tsx'

// AdwHeaderBar: start / title / end, a drag region for the frameless window, and the window buttons on
// the side(s) the user's button-layout puts them. Each pane of a split view has its own header bar,
// so window controls can be asked for per side (`controls`).

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
  /** Which of the window's button groups this header bar carries. */
  controls?: 'start' | 'end' | 'both' | 'none'
  className?: string
}) {
  return (
    <header
      className={`app-drag grid h-[var(--headerbar-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-1.5 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
        {controls === 'start' || controls === 'both' ? <WindowControls side="start" /> : null}
        {start}
      </div>
      <div className="min-w-0 truncate text-center font-bold">{title}</div>
      <div className="flex min-w-0 items-center gap-1.5 justify-self-end">
        {end}
        {controls === 'end' || controls === 'both' ? <WindowControls side="end" /> : null}
      </div>
    </header>
  )
}
