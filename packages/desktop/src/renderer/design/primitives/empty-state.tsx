import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icon.tsx'

// Empty state (brand spec): an editorial Fraunces italic headline, a line of body text, one primary
// action. Also the whole-window status pages (connecting, can't reach the daemon, not found) — it is a
// named region with an h1, which is what screen readers and the e2e tests look for.

export function EmptyState({
  icon,
  title,
  description,
  children,
  compact = false,
  headingLevel = 1,
}: {
  icon?: IconName
  title: string
  description?: ReactNode
  /** Actions (one primary button, ideally) or a spinner. */
  children?: ReactNode
  /** Tighter spacing and a smaller headline, for a sidebar or a pane. */
  compact?: boolean
  headingLevel?: 1 | 2
}) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section
      aria-label={title}
      className={`flex h-full flex-col items-center justify-center overflow-auto text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-10'}`}
    >
      {icon ? (
        <div
          className={`flex items-center justify-center rounded-lg bg-bg-sidebar text-text-secondary ${compact ? 'mb-1 size-11' : 'mb-3 size-16'}`}
        >
          <Icon name={icon} size={compact ? 22 : 30} />
        </div>
      ) : null}
      <H
        className={`m-0 text-balance font-editorial font-semibold text-text-primary italic ${compact ? 'text-[20px] leading-[26px]' : 'type-empty-state'}`}
      >
        {title}
      </H>
      {description ? (
        <p
          className={`m-0 max-w-[42ch] text-balance text-text-secondary ${compact ? 'type-callout' : 'type-body'}`}
        >
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-3 flex flex-col items-center gap-3">{children}</div> : null}
    </section>
  )
}

/** Phase-1 name. */
export const StatusPage = EmptyState
