import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components'
import { Icon } from '../icon.tsx'
import type { IconName } from '../icon-paths.ts'

// Adwaita's button family: default (raised), flat, suggested-action, destructive-action, pill, circular.
// Behaviour (press, keyboard, focus-visible) from React Aria; looks from tokens only.

export type ButtonVariant = 'default' | 'flat' | 'suggested' | 'destructive'

export type ButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  variant?: ButtonVariant
  pill?: boolean
  circular?: boolean
  icon?: IconName
  children?: React.ReactNode
  /** Required for icon-only buttons (it becomes the accessible name). */
  'aria-label'?: string
  className?: string
}

const VARIANT: Record<ButtonVariant, string> = {
  default: 'bg-hover text-fg data-[hovered]:bg-active data-[pressed]:bg-active',
  flat: 'bg-transparent text-fg data-[hovered]:bg-hover data-[pressed]:bg-active',
  suggested: 'bg-accent text-on-accent data-[hovered]:brightness-110 data-[pressed]:brightness-90',
  destructive:
    'bg-destructive text-on-destructive data-[hovered]:brightness-110 data-[pressed]:brightness-90',
}

export function Button({
  variant = 'default',
  pill,
  circular,
  icon,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const shape = circular
    ? 'rounded-full size-[34px] justify-center p-0'
    : pill
      ? 'rounded-full px-8 py-2.5'
      : icon && !children
        ? 'rounded-button min-w-[34px] h-[34px] justify-center px-2'
        : 'rounded-button h-[34px] px-3'
  return (
    <AriaButton
      {...rest}
      className={`app-no-drag inline-flex cursor-default items-center gap-2 font-bold outline-none transition-[background,filter] duration-100 data-[disabled]:opacity-50 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-[var(--focus-ring-color)] ${VARIANT[variant]} ${shape} ${className}`}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </AriaButton>
  )
}
