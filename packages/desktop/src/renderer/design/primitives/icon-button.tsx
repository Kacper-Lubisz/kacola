import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components'
import { Icon, type IconName } from '../icon.tsx'
import { Tooltip } from './tooltip.tsx'

// Icon button (brand spec): 32×32 at md, radius sm, ghost by default. `label` is required — it is the
// accessible name AND the tooltip (a bare icon means nothing to a screen reader or a new user).

export type IconButtonProps = Omit<AriaButtonProps, 'className' | 'children' | 'style' | 'aria-label'> & {
  icon: IconName
  label: string
  /** Tooltip text if it should say more than the label (a shortcut, say); null for none. */
  tooltip?: string | null
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary' | 'primary'
  className?: string
}

const SIZE = { sm: 'size-7', md: 'size-8', lg: 'size-10' } as const
const ICON = { sm: 16, md: 18, lg: 20 } as const
const VARIANT = {
  ghost: 'text-text-primary data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  secondary:
    'bg-bg-surface text-text-primary border border-border-default data-[hovered]:border-border-strong data-[pressed]:bg-bg-selected',
  primary: 'bg-ink-primary text-text-on-ink data-[hovered]:opacity-90',
} as const

export function IconButton({
  icon,
  label,
  tooltip,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...rest
}: IconButtonProps) {
  const button = (
    <AriaButton
      {...rest}
      aria-label={label}
      className={`app-no-drag inline-flex shrink-0 cursor-default items-center justify-center rounded-sm focus-ring transition-colors duration-(--k-duration-fast) data-[pressed]:translate-y-[0.5px] data-[disabled]:opacity-45 ${SIZE[size]} ${VARIANT[variant]} ${className}`}
    >
      <Icon name={icon} size={ICON[size]} />
    </AriaButton>
  )
  if (tooltip === null) return button
  return <Tooltip content={tooltip ?? label}>{button}</Tooltip>
}
