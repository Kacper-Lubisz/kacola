import type { ReactElement, ReactNode } from 'react'
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components'

/**
 * A tooltip on hover (after a short delay) and on keyboard focus, from React Aria. The trigger must be
 * a React Aria focusable (Button, IconButton …). Tooltips are supplementary: the trigger still needs its
 * own accessible name.
 */
export function Tooltip({
  content,
  children,
  placement = 'bottom',
  delay = 600,
}: {
  content: ReactNode
  children: ReactElement
  placement?: 'top' | 'bottom' | 'start' | 'end'
  delay?: number
}) {
  return (
    <TooltipTrigger delay={delay} closeDelay={100}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={6}
        className="max-w-[260px] rounded-sm bg-ink-primary px-2 py-1 font-sans text-[13px] leading-[18px] font-medium text-text-on-ink shadow-e2"
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  )
}
