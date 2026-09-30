import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Dialog as AriaDialog,
  Switch as AriaSwitch,
  Heading,
  Input,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Menu,
  MenuItem,
  type MenuItemProps,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Separator,
  Text,
  TextArea,
  TextField,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components'

// LOCAL brand primitives for the notes pane (phase 2C), built strictly from the kacola tokens
// (brand/tokens, brand-spec "Components"). They stand in until the shared primitives land in
// design/primitives/ (phase 2A) — consolidate then: same props, same looks, so the swap is an import
// change. Behaviour from React Aria; every interactive element has an accessible name.

const focusRing =
  'outline-none data-[focus-visible]:outline-[3px] data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent-focus data-[focus-visible]:outline-offset-2'

export type KButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type KButtonSize = 'sm' | 'md'

const VARIANT: Record<KButtonVariant, string> = {
  primary:
    'bg-ink-primary text-text-on-ink data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_86%,var(--k-color-bg-window))] data-[pressed]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_76%,var(--k-color-bg-window))]',
  secondary:
    'bg-bg-surface text-text-primary border border-border-default data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  ghost: 'bg-transparent text-text-primary data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  destructive:
    'bg-bg-surface text-status-danger border border-status-danger data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
}

const SIZE: Record<KButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[14px] gap-1.5',
  md: 'h-9 px-3.5 text-[15px] gap-2',
}

export type KButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  variant?: KButtonVariant
  size?: KButtonSize
  icon?: LucideIcon
  children?: ReactNode
  className?: string
}

/** Brand button: Bricolage 600 label, radius md, ink / surface / ghost / destructive. */
export function KButton({
  variant = 'secondary',
  size = 'md',
  icon: I,
  children,
  className = '',
  ...rest
}: KButtonProps) {
  return (
    <AriaButton
      {...rest}
      className={`app-no-drag inline-flex shrink-0 cursor-default select-none items-center justify-center whitespace-nowrap rounded-md font-display font-semibold transition-[background-color,transform] duration-(--k-duration-fast) ease-out data-[pressed]:translate-y-[0.5px] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 ${focusRing} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {I ? <I size={size === 'sm' ? 16 : 18} strokeWidth={1.75} aria-hidden="true" /> : null}
      {children}
    </AriaButton>
  )
}

/** 32×32 ghost icon button with a tooltip; `label` is its accessible name. */
export function KIconButton({
  icon: I,
  label,
  tooltip,
  className = '',
  ...rest
}: Omit<AriaButtonProps, 'className' | 'children' | 'aria-label'> & {
  icon: LucideIcon
  label: string
  tooltip?: string
  className?: string
}) {
  return (
    <TooltipTrigger delay={600}>
      <AriaButton
        {...rest}
        aria-label={label}
        className={`app-no-drag inline-flex size-8 shrink-0 cursor-default items-center justify-center rounded-sm text-text-primary data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected data-[disabled]:pointer-events-none data-[disabled]:opacity-45 ${focusRing} ${className}`}
      >
        <I size={18} strokeWidth={1.75} aria-hidden="true" />
      </AriaButton>
      <Tooltip
        offset={6}
        className="rounded-sm bg-ink-primary px-2 py-1 text-caption text-text-on-ink shadow-e2"
      >
        {tooltip ?? label}
      </Tooltip>
    </TooltipTrigger>
  )
}

/** Brand switch: 36×20 pill, off border.strong, on ink.primary. */
export function KSwitch({
  isSelected,
  onChange,
  label,
  children,
}: {
  isSelected: boolean
  onChange: (v: boolean) => void
  /** Accessible name (the visible text may be shorter). */
  label: string
  children?: ReactNode
}) {
  return (
    <AriaSwitch
      isSelected={isSelected}
      onChange={onChange}
      aria-label={label}
      className="group inline-flex cursor-default items-center gap-2 text-callout text-text-secondary outline-none"
    >
      {children}
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill bg-border-strong transition-colors duration-(--k-duration-fast) group-data-[selected]:bg-ink-primary group-data-[focus-visible]:outline-[3px] group-data-[focus-visible]:outline-solid group-data-[focus-visible]:outline-accent-focus group-data-[focus-visible]:outline-offset-2">
        <span className="ml-0.5 size-4 rounded-pill bg-bg-raised shadow-e1 transition-transform duration-(--k-duration-fast) ease-out group-data-[selected]:translate-x-4" />
      </span>
    </AriaSwitch>
  )
}

/** A menu button: the trigger (any KButton / KIconButton look) + a popover menu. */
export function KMenu({
  trigger,
  children,
  onAction,
  label,
}: {
  trigger: ReactNode
  children: ReactNode
  onAction: (key: string) => void
  label: string
}) {
  return (
    <MenuTrigger>
      {trigger}
      <Popover
        placement="bottom start"
        offset={6}
        className="min-w-60 rounded-md border border-border-default bg-bg-raised p-1 shadow-e2 outline-none"
      >
        <Menu aria-label={label} onAction={(k) => onAction(String(k))} className="outline-none">
          {children}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

export function KMenuItem({ children, ...rest }: Omit<MenuItemProps, 'className'> & { children: ReactNode }) {
  return (
    <MenuItem
      {...rest}
      className="flex cursor-default items-center gap-2 rounded-sm px-2.5 py-1.5 text-callout text-text-primary outline-none data-[focused]:bg-bg-hover data-[disabled]:opacity-45"
    >
      {children}
    </MenuItem>
  )
}

export function KMenuSeparator() {
  return <Separator className="my-1 border-t border-border-subtle" />
}

/** Brand dialog: bg.raised, radius xl, e3, title in title2. Controlled (`isOpen` / `onOpenChange`). */
export function KDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  wide,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(31_27_22/0.32)] p-6"
    >
      <Modal
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-bg-raised text-text-primary shadow-e3 outline-none ${wide ? 'max-w-[960px]' : 'max-w-[560px]'}`}
      >
        <AriaDialog className="flex min-h-0 flex-1 flex-col outline-none">
          <Heading slot="title" className="m-0 px-6 pt-5 pb-3 type-title2">
            {title}
          </Heading>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

/** Inline strip for a state that needs attention (brand Banner: surface + border + status icon). */
export function KBanner({
  tone,
  icon: I,
  children,
  actions,
}: {
  tone: 'info' | 'warning' | 'danger'
  icon: LucideIcon
  children: ReactNode
  actions?: ReactNode
}) {
  const colour =
    tone === 'info' ? 'text-status-info' : tone === 'warning' ? 'text-status-warning' : 'text-status-danger'
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3 text-callout text-text-primary"
    >
      <I size={20} strokeWidth={1.75} aria-hidden="true" className={`mt-px shrink-0 ${colour}`} />
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Indeterminate spinner in the current colour, announced by its label. */
export function KSpinner({ label, size = 18 }: { label: string; size?: number }) {
  return (
    <span role="progressbar" aria-label={label} aria-busy="true" className="inline-flex text-text-secondary">
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className="motion-safe:animate-spin"
        aria-hidden="true"
      >
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <path
          d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

/** Brand toast: ink fill, bottom centre, announced politely. One at a time. */
export function KToast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      {message ? (
        <span className="rounded-lg bg-ink-primary px-4 py-2.5 text-callout text-text-on-ink shadow-e2">
          {message}
        </span>
      ) : null}
    </div>
  )
}

/** Single-selection list (version history, templates): rows radius md, selected = bg.selected only. */
export function KListBox<T extends object>({
  label,
  items,
  selected,
  onSelect,
  children,
}: {
  label: string
  items: Iterable<T>
  selected: Key | null
  onSelect: (key: Key) => void
  children: (item: T) => ReactNode
}) {
  return (
    <ListBox
      aria-label={label}
      items={items}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selected === null ? [] : [selected]}
      onSelectionChange={(keys) => {
        if (keys === 'all') return
        const k = [...keys][0]
        if (k !== undefined) onSelect(k)
      }}
      className="flex flex-col gap-0.5 outline-none"
    >
      {children}
    </ListBox>
  )
}

export function KListItem({
  children,
  ...rest
}: Omit<ListBoxItemProps, 'className'> & { children: ReactNode }) {
  return (
    <ListBoxItem
      {...rest}
      className="flex cursor-default flex-col gap-0.5 rounded-md px-3 py-2 text-text-primary outline-none data-[hovered]:bg-bg-hover data-[selected]:bg-bg-selected data-[focus-visible]:outline-[3px] data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent-focus data-[focus-visible]:-outline-offset-2"
    >
      {children}
    </ListBoxItem>
  )
}

const fieldCls =
  'w-full rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary outline-none hover:border-border-strong focus:outline-[3px] focus:outline-solid focus:outline-accent-focus focus:outline-offset-1 disabled:opacity-45'

/** Brand input / textarea with a visible label (caption, secondary). */
export function KTextField({
  label,
  value,
  onChange,
  multiline,
  rows = 8,
  description,
  isDisabled,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  description?: string
  isDisabled?: boolean
  placeholder?: string
  mono?: boolean
}) {
  return (
    <TextField value={value} onChange={onChange} isDisabled={isDisabled} className="flex flex-col gap-1.5">
      <Label className="text-caption text-text-secondary">{label}</Label>
      {multiline ? (
        <TextArea
          rows={rows}
          placeholder={placeholder}
          className={`${fieldCls} resize-none py-2 ${mono ? 'font-mono text-mono' : 'font-sans'}`}
        />
      ) : (
        <Input placeholder={placeholder} className={`${fieldCls} h-9 font-sans`} />
      )}
      {description ? (
        <Text slot="description" className="text-caption text-text-secondary">
          {description}
        </Text>
      ) : null}
    </TextField>
  )
}
