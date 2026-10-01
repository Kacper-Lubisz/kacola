import type { ReactNode } from 'react'
import { Checkbox as AriaCheckbox } from 'react-aria-components'
import { Icon } from '../icon.tsx'

// Checkbox (brand spec: the switch's colours in a square): off = border.strong outline on surface,
// on = ink fill with a check in text.onInk. The children are the label (and the accessible name).

export function Checkbox({
  children,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  'aria-label': ariaLabel,
  className = '',
}: {
  children?: ReactNode
  isSelected?: boolean
  defaultSelected?: boolean
  onChange?: (v: boolean) => void
  isDisabled?: boolean
  'aria-label'?: string
  className?: string
}) {
  return (
    <AriaCheckbox
      isSelected={isSelected}
      defaultSelected={defaultSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
      className={`group app-no-drag inline-flex cursor-default items-start gap-2.5 text-text-primary outline-none data-[disabled]:opacity-45 ${className}`}
    >
      <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs border border-border-strong bg-bg-surface text-text-on-ink transition-colors duration-(--k-duration-fast) group-data-[selected]:border-ink-primary group-data-[selected]:bg-ink-primary group-data-[focus-visible]:outline-(length:--focus-ring-width) group-data-[focus-visible]:outline-solid group-data-[focus-visible]:outline-(--focus-ring-color) group-data-[focus-visible]:outline-offset-(--focus-ring-offset)">
        <Icon name="check" size={14} className="opacity-0 group-data-[selected]:opacity-100" />
      </span>
      {children}
    </AriaCheckbox>
  )
}
