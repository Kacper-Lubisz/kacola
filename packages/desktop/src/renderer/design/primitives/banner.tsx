import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icon.tsx'

// Banner (brand spec): bg.surface + border, a status icon, a line of text, an optional action — for a
// persistent state (offline, models missing). It is a named status region, so a screen reader hears it
// when it appears and a test finds it by name.

export type BannerTone = 'info' | 'warning' | 'danger' | 'success'

const TONE: Record<BannerTone, { icon: IconName; color: string }> = {
  info: { icon: 'info', color: 'text-status-info' },
  warning: { icon: 'warning', color: 'text-status-warning' },
  danger: { icon: 'alert', color: 'text-status-danger' },
  success: { icon: 'success', color: 'text-status-success' },
}

export function Banner({
  title,
  action,
  tone = 'info',
  className = '',
}: {
  title: string
  action?: ReactNode
  /** 'accent' is the phase-1 name for info. */
  tone?: BannerTone | 'accent'
  className?: string
}) {
  const t = TONE[tone === 'accent' ? 'info' : tone]
  return (
    <div
      role="status"
      aria-label={title}
      className={`flex min-h-11 items-center gap-3 rounded-md border border-border-default bg-bg-surface px-3 py-2 ${className}`}
    >
      <Icon name={t.icon} size={18} className={`shrink-0 ${t.color}`} />
      <span className="min-w-0 flex-1 type-callout text-text-primary">{title}</span>
      {action}
    </div>
  )
}
