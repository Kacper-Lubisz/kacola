import type { ReactNode } from 'react'
import { Switch as AriaSwitch } from 'react-aria-components'

/**
 * Switch (brand spec): a 36×20 pill track — off: border.strong, on: ink — with a raised thumb. The
 * children are the label (and the accessible name). Controlled: `isSelected` + `onChange`.
 */
export function Switch({
  children,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  className = '',
}: {
  children?: ReactNode
  isSelected?: boolean
  defaultSelected?: boolean
  onChange?: (v: boolean) => void
  isDisabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  className?: string
}) {
  return (
    <AriaSwitch
      isSelected={isSelected}
      defaultSelected={defaultSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={`group app-no-drag inline-flex cursor-default items-center gap-3 text-text-primary outline-none data-[disabled]:opacity-45 ${className}`}
    >
      {children}
      <span className="flex h-5 w-9 shrink-0 items-center rounded-pill bg-border-strong p-0.5 transition-colors duration-(--k-duration-base) ease-out group-data-[selected]:bg-ink-primary group-data-[focus-visible]:outline-(length:--focus-ring-width) group-data-[focus-visible]:outline-solid group-data-[focus-visible]:outline-(--focus-ring-color) group-data-[focus-visible]:outline-offset-(--focus-ring-offset)">
        <span className="size-4 rounded-full bg-bg-raised shadow-e1 transition-transform duration-(--k-duration-base) ease-out group-data-[selected]:translate-x-4" />
      </span>
    </AriaSwitch>
  )
}
