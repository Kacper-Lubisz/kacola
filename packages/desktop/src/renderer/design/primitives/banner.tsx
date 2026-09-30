import type { ReactNode } from 'react'

/** AdwBanner: a strip under the header bar for a persistent state (offline, models missing…). */
export function Banner({
  title,
  action,
  tone = 'accent',
}: {
  title: string
  action?: ReactNode
  tone?: 'accent' | 'warning'
}) {
  const colours = tone === 'warning' ? 'bg-warning text-on-warning' : 'bg-accent text-on-accent'
  return (
    <div
      role="status"
      className={`flex min-h-[38px] items-center justify-center gap-3 px-3 py-1 text-center ${colours}`}
    >
      <span>{title}</span>
      {action}
    </div>
  )
}
