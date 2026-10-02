import type { ReactNode } from 'react'

// Card (brand spec): bg.surface, border.subtle, radius lg, e1.
//
// RowGroup / Row: the settings-list pattern built on it (a titled card of rows, each a title, an
// optional subtitle, and a control at the end) — Preferences, Details, onboarding. The group is a
// named region with a heading; a row's title labels its control through `id` → aria-labelledby when
// the control asks for it (`labelId`).

export function Card({
  children,
  className = '',
  as: As = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <As {...rest} className={`rounded-lg border border-border-subtle bg-bg-surface shadow-e1 ${className}`}>
      {children}
    </As>
  )
}

export function RowGroup({
  title,
  description,
  children,
  headerEnd,
  className = '',
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  /** A control beside the heading (an "Add" button, say). */
  headerEnd?: ReactNode
  className?: string
}) {
  return (
    <section aria-label={title} className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 type-overline text-text-secondary">{title}</h2>
          {description ? <p className="m-0 type-callout text-text-secondary">{description}</p> : null}
        </div>
        {headerEnd}
      </div>
      <Card className="flex flex-col divide-y divide-border-subtle overflow-hidden">{children}</Card>
    </section>
  )
}

export function Row({
  title,
  subtitle,
  children,
  labelId,
  descriptionId,
  stacked = false,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** The control. */
  children?: ReactNode
  /** Give the title this id (so a control can use aria-labelledby). */
  labelId?: string
  descriptionId?: string
  /** Control below the text instead of beside it (wide fields). */
  stacked?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex min-h-14 gap-3 px-4 py-3 ${stacked ? 'flex-col' : 'flex-wrap items-center justify-between gap-y-2'} ${className}`}
    >
      {/* beside the control while there is room; in a narrow window the control wraps below */}
      <div className={`flex min-w-0 flex-col gap-0.5 ${stacked ? '' : 'flex-[1_1_14rem]'}`}>
        <span id={labelId} className="font-sans text-[15px] leading-[22px] font-medium text-text-primary">
          {title}
        </span>
        {subtitle ? (
          <span
            id={descriptionId}
            className="type-callout [overflow-wrap:anywhere] text-text-secondary select-text"
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      {children ? <div className={stacked ? '' : 'flex shrink-0 items-center gap-2'}>{children}</div> : null}
    </div>
  )
}
