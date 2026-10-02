import type { ReactNode } from 'react'
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components'
import { Icon, type IconName } from '../icon.tsx'

// The brand button (brand spec, "Components"): five variants × three sizes. Behaviour (press, keyboard,
// focus-visible, disabled) from React Aria; looks from tokens only.
//
//   primary      ink fill (inverts in dark), text.onInk — the one main action of a screen
//   secondary    surface + default border
//   ghost        transparent, hover tint — toolbars, rows
//   destructive  danger text + border; `confirm` fills it record red (the "yes, delete" step)
//   link         record-red text, underline on hover
//   record       record-red fill, white text — only for the actions that start recording
//
// Phase-1 names are accepted as aliases (suggested → primary, default → secondary, flat → ghost), so
// screens written against the Adwaita primitives keep compiling; new code uses the brand names.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link' | 'record'
type LegacyVariant = 'suggested' | 'default' | 'flat'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = Omit<AriaButtonProps, 'className' | 'children' | 'style'> & {
  variant?: ButtonVariant | LegacyVariant
  size?: ButtonSize
  /** Leading icon. An icon-only button is an IconButton (it needs a tooltip). */
  icon?: IconName
  /** Trailing icon (a chevron on a menu button, say). */
  iconEnd?: IconName
  /** Destructive only: the filled, confirming form. */
  confirm?: boolean
  /** Pill shape (full radius), for the few brand moments that want it. */
  pill?: boolean
  children?: ReactNode
  className?: string
}

const ALIAS: Record<LegacyVariant, ButtonVariant> = {
  suggested: 'primary',
  default: 'secondary',
  flat: 'ghost',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 gap-1.5 text-[14px]',
  md: 'h-9 px-3.5 gap-2 text-[15px]',
  lg: 'h-11 px-4.5 gap-2 text-[16px]',
}
const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 }

// Ink can't get darker, so hover / pressed mix it toward the window colour (brand/README.md).
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-ink-primary text-text-on-ink data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_86%,var(--k-color-bg-window))] data-[pressed]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_76%,var(--k-color-bg-window))]',
  secondary:
    'bg-bg-surface text-text-primary border border-border-default data-[hovered]:border-border-strong data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-bg-surface),var(--k-color-text-primary)_4%)] data-[pressed]:bg-bg-selected',
  ghost: 'bg-transparent text-text-primary data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  destructive:
    'bg-bg-surface text-status-danger-text border border-status-danger data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-bg-surface),var(--k-color-status-danger)_8%)] data-[pressed]:bg-[color-mix(in_srgb,var(--k-color-bg-surface),var(--k-color-status-danger)_14%)]',
  link: 'bg-transparent text-accent-record-text !h-auto !px-0 underline-offset-2 data-[hovered]:underline',
  record:
    'bg-record-fill text-text-on-accent data-[hovered]:bg-record-fill-hover data-[pressed]:bg-record-fill-hover',
}
const CONFIRM =
  'bg-record-fill text-text-on-accent border border-record-fill data-[hovered]:bg-record-fill-hover data-[pressed]:bg-record-fill-hover'

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  confirm,
  pill,
}: Pick<ButtonProps, 'variant' | 'size' | 'confirm' | 'pill'>): string {
  const v = (ALIAS as Record<string, ButtonVariant>)[variant] ?? (variant as ButtonVariant)
  return [
    'app-no-drag inline-flex shrink-0 cursor-default select-none items-center justify-center whitespace-nowrap',
    'font-display font-semibold leading-none focus-ring',
    'transition-[background-color,border-color,color,transform] duration-(--k-duration-fast) ease-out',
    'data-[pressed]:translate-y-[0.5px] data-[disabled]:opacity-45 data-[disabled]:pointer-events-none',
    pill ? 'rounded-pill' : 'rounded-md',
    SIZE[size],
    v === 'destructive' && confirm ? CONFIRM : VARIANT[v],
  ].join(' ')
}

export function Button({
  variant,
  size = 'md',
  icon,
  iconEnd,
  confirm,
  pill,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <AriaButton {...rest} className={`${buttonClass({ variant, size, confirm, pill })} ${className}`}>
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={ICON_SIZE[size]} /> : null}
    </AriaButton>
  )
}
