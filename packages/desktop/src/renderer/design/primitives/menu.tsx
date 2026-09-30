import type { ReactElement, ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Popover as AriaPopover,
  DialogTrigger,
  Header,
  MenuSection,
  MenuTrigger,
  Separator,
} from 'react-aria-components'
import { Icon, type IconName } from '../icon.tsx'
import { Kbd } from './kbd.tsx'

// Popovers and menus (brand: bg.raised, radius lg, e2). React Aria handles placement, focus, arrow-key
// navigation, typeahead, Escape and returning focus to the trigger.
//
//   <Menu trigger={<IconButton icon="menu" label="Main menu" />} label="Main menu">
//     <MenuItem onAction={…} shortcut="Ctrl+,">Preferences</MenuItem>
//     <MenuSeparator />
//   </Menu>
//
//   <Popover trigger={<Button>Filters</Button>} label="Filters">…any content…</Popover>

const SURFACE =
  'min-w-[200px] overflow-auto rounded-lg border border-border-subtle bg-bg-raised p-1 text-text-primary shadow-e2 outline-none'

export function Menu({
  trigger,
  label,
  children,
  placement = 'bottom end',
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  placement?: 'bottom start' | 'bottom end' | 'top start' | 'top end'
}) {
  return (
    <MenuTrigger>
      {trigger}
      <AriaPopover placement={placement} offset={6} className={SURFACE}>
        <AriaMenu aria-label={label} className="outline-none">
          {children}
        </AriaMenu>
      </AriaPopover>
    </MenuTrigger>
  )
}

export function MenuItem({
  children,
  onAction,
  icon,
  shortcut,
  destructive,
  isDisabled,
  textValue,
}: {
  children: ReactNode
  onAction?: () => void
  icon?: IconName
  /** Shown at the end, e.g. "Ctrl+,". */
  shortcut?: string
  destructive?: boolean
  isDisabled?: boolean
  textValue?: string
}) {
  return (
    <AriaMenuItem
      onAction={onAction}
      isDisabled={isDisabled}
      textValue={textValue ?? (typeof children === 'string' ? children : undefined)}
      className={`flex cursor-default items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[15px] outline-none data-[focused]:bg-bg-hover data-[disabled]:opacity-45 ${destructive ? 'text-status-danger-text' : ''}`}
    >
      {icon ? <Icon name={icon} size={16} className="text-text-secondary" /> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </AriaMenuItem>
  )
}

export function MenuSeparator() {
  return <Separator className="mx-1 my-1 border-t border-border-subtle" />
}

export function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <MenuSection>
      {title ? (
        <Header className="px-2.5 pt-1.5 pb-1 type-overline text-text-tertiary">{title}</Header>
      ) : null}
      {children}
    </MenuSection>
  )
}

export function Popover({
  trigger,
  label,
  children,
  placement = 'bottom',
  className = '',
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  placement?: 'bottom' | 'top' | 'bottom start' | 'bottom end'
  className?: string
}) {
  return (
    <DialogTrigger>
      {trigger}
      <AriaPopover placement={placement} offset={6} className={`${SURFACE} p-3 ${className}`}>
        <AriaDialog aria-label={label} className="outline-none">
          {children}
        </AriaDialog>
      </AriaPopover>
    </DialogTrigger>
  )
}
