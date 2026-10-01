import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Icon, type IconName } from '../icon.tsx'

// Chips (brand spec: the citation chip's 20–24px pill): a status or attribution label ("Covered",
// "auto", "checked by Claude"), or — pressable — an evidence chip that jumps to the transcript line.
// Tone colours the icon and a 14% tint behind text.primary (text contrast stays that of body text).

export type ChipTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'record'

const TINT: Record<ChipTone, string> = {
  neutral: 'bg-bg-sidebar',
  success: 'bg-[color-mix(in_srgb,var(--k-color-status-success)_14%,var(--k-color-bg-surface))]',
  info: 'bg-[color-mix(in_srgb,var(--k-color-status-info)_14%,var(--k-color-bg-surface))]',
  warning: 'bg-[color-mix(in_srgb,var(--k-color-status-warning)_14%,var(--k-color-bg-surface))]',
  danger: 'bg-[color-mix(in_srgb,var(--k-color-status-danger)_14%,var(--k-color-bg-surface))]',
  record: 'bg-[color-mix(in_srgb,var(--k-color-accent-record)_14%,var(--k-color-bg-surface))]',
}
const ICON_TONE: Record<ChipTone, string> = {
  neutral: 'text-text-secondary',
  success: 'text-status-success-text',
  info: 'text-status-info-text',
  warning: 'text-status-warning-text',
  danger: 'text-status-danger-text',
  record: 'text-accent-record-text',
}

const BASE =
  'inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-pill px-2 font-sans text-[13px] leading-[18px] font-medium text-text-primary'

export function Chip({
  children,
  tone = 'neutral',
  icon,
  label,
  className = '',
}: {
  children: ReactNode
  tone?: ChipTone
  icon?: IconName
  /** An accessible name when the visible text alone says too little. */
  label?: string
  className?: string
}) {
  return (
    <span className={`${BASE} ${TINT[tone]} ${className}`}>
      {icon ? <Icon name={icon} size={14} className={`shrink-0 ${ICON_TONE[tone]}`} /> : null}
      <span className="truncate" aria-hidden={label ? true : undefined}>
        {children}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

/** A chip you press (an evidence quote → its transcript line). */
export function ChipButton({
  children,
  tone = 'neutral',
  icon,
  label,
  onPress,
  className = '',
}: {
  children: ReactNode
  tone?: ChipTone
  icon?: IconName
  label: string
  onPress: () => void
  className?: string
}) {
  return (
    <AriaButton
      aria-label={label}
      onPress={onPress}
      className={`${BASE} ${TINT[tone]} cursor-default focus-ring data-[hovered]:text-accent-record-text ${className}`}
    >
      {icon ? <Icon name={icon} size={14} className={`shrink-0 ${ICON_TONE[tone]}`} /> : null}
      <span className="truncate">{children}</span>
    </AriaButton>
  )
}
