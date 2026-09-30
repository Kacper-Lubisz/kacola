import { _ } from '@gnomeola/ui-core/i18n'
import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Dialog,
  Heading,
  Input,
  type Key,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Radio,
  RadioGroup,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from 'react-aria-components'
import { LIcon, type LocalIconName } from './local-icons.tsx'

// LOCAL (phase 2B) brand primitives, minimal, for the Transcript / Ask / Speakers features until the
// design-system primitives (design/primitives: Button, IconButton, TextField, Dialog, Menu, Toast,
// EmptyState, Tabs) land — then these files go and the features import from design/primitives/index.ts.
// Behaviour from React Aria, looks strictly from the kacola tokens (brand/tokens, Tailwind utilities).

const FOCUS =
  'outline-none data-[focus-visible]:outline-[3px] data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent-focus'

export type KButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'record'

const VARIANT: Record<KButtonVariant, string> = {
  primary:
    'bg-ink-primary text-text-on-ink data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_86%,var(--k-color-bg-window))] data-[pressed]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_76%,var(--k-color-bg-window))]',
  secondary:
    'bg-bg-surface text-text-primary border border-border-default data-[hovered]:border-border-strong data-[pressed]:bg-bg-selected',
  ghost: 'bg-transparent text-text-primary data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  destructive:
    'bg-bg-surface text-status-danger border border-status-danger data-[hovered]:bg-bg-hover data-[pressed]:bg-bg-selected',
  record: 'bg-accent-record text-text-on-accent data-[hovered]:bg-accent-record-hover',
}

const SIZE = {
  sm: 'h-7 px-2.5 text-[14px] gap-1.5',
  md: 'h-9 px-3.5 text-[15px] gap-2',
  lg: 'h-11 px-4.5 text-[16px] gap-2',
} as const

export type KButtonProps = Omit<AriaButtonProps, 'className' | 'children'> & {
  variant?: KButtonVariant
  size?: keyof typeof SIZE
  icon?: LocalIconName
  pill?: boolean
  children?: ReactNode
  className?: string
}

export function KButton({
  variant = 'secondary',
  size = 'md',
  icon,
  pill,
  children,
  className = '',
  ...rest
}: KButtonProps) {
  return (
    <AriaButton
      {...rest}
      className={`app-no-drag inline-flex shrink-0 cursor-default select-none items-center justify-center font-display font-semibold transition-[background-color,border-color] duration-[var(--k-duration-fast)] ease-out data-[pressed]:translate-y-[0.5px] data-[disabled]:opacity-45 ${pill ? 'rounded-pill' : 'rounded-md'} ${SIZE[size]} ${VARIANT[variant]} ${FOCUS} ${className}`}
    >
      {icon ? <LIcon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </AriaButton>
  )
}

/** Icon-only button: 32×32, ghost; the label is the accessible name and the tooltip. */
export function KIconButton({
  icon,
  label,
  className = '',
  ...rest
}: Omit<AriaButtonProps, 'className' | 'children' | 'aria-label'> & {
  icon: LocalIconName
  label: string
  className?: string
}) {
  return (
    <AriaButton
      {...rest}
      aria-label={label}
      className={`app-no-drag inline-flex size-8 shrink-0 cursor-default items-center justify-center rounded-sm text-text-secondary data-[hovered]:bg-bg-hover data-[hovered]:text-text-primary data-[pressed]:bg-bg-selected data-[disabled]:opacity-45 ${FOCUS} ${className}`}
    >
      <span title={label} className="inline-flex">
        <LIcon name={icon} size={18} />
      </span>
    </AriaButton>
  )
}

export function KSpinner({ label, size = 16 }: { label: string; size?: number }) {
  return (
    <span role="status" aria-label={label} className="inline-flex text-text-secondary">
      <LIcon name="loader" size={size} className="k-spin" />
    </span>
  )
}

/** A text input with an accessible name (visually labelled or not). */
export function KTextField({
  label,
  value,
  onChange,
  onEnter,
  onEscape,
  placeholder,
  autoFocus,
  className = '',
  inputClassName = '',
  leadingIcon,
  inputRef,
  isInvalid,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onEnter?: (shift: boolean) => void
  onEscape?: () => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  leadingIcon?: LocalIconName
  inputRef?: React.Ref<HTMLInputElement>
  isInvalid?: boolean
}) {
  return (
    <TextField
      aria-label={label}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      isInvalid={isInvalid}
      className={`relative flex items-center ${className}`}
    >
      {leadingIcon ? (
        <span className="pointer-events-none absolute left-2.5 text-text-tertiary">
          <LIcon name={leadingIcon} size={16} />
        </span>
      ) : null}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter(e.shiftKey)
          } else if (e.key === 'Escape' && onEscape) {
            e.preventDefault()
            e.stopPropagation()
            onEscape()
          }
        }}
        className={`h-9 w-full min-w-0 rounded-md border border-border-default bg-bg-surface text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-[var(--k-duration-fast)] data-[hovered]:border-border-strong data-[focused]:border-border-strong data-[focused]:shadow-[0_0_0_3px_var(--k-color-accent-focus)] data-[invalid]:border-status-danger ${leadingIcon ? 'pl-8' : 'pl-3'} pr-3 ${inputClassName}`}
      />
    </TextField>
  )
}

/** Segmented control (a radio group that looks like pill tabs). */
export function KSegmented<T extends string>({
  label,
  value,
  onChange,
  options,
  isDisabled,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; description?: string }[]
  isDisabled?: boolean
}) {
  return (
    <RadioGroup
      aria-label={label}
      orientation="horizontal"
      value={value}
      onChange={(v) => onChange(v as T)}
      isDisabled={isDisabled}
      className="inline-flex rounded-pill bg-bg-sidebar p-0.5"
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          value={o.value}
          aria-description={o.description}
          className={`cursor-default rounded-pill px-2.5 py-0.5 font-display text-[13px] font-semibold text-text-secondary data-[hovered]:text-text-primary data-[selected]:bg-bg-surface data-[selected]:text-text-primary data-[selected]:shadow-e1 data-[disabled]:opacity-45 ${FOCUS}`}
        >
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  )
}

export function KTabs({
  label,
  selected,
  onSelect,
  tabs,
}: {
  label: string
  selected: string
  onSelect: (k: string) => void
  tabs: { id: string; label: string; content: ReactNode }[]
}) {
  return (
    <Tabs
      selectedKey={selected}
      onSelectionChange={(k: Key) => onSelect(String(k))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 justify-center px-4 pb-2">
        <TabList aria-label={label} className="inline-flex rounded-pill bg-bg-sidebar p-0.5">
          {tabs.map((t) => (
            <Tab
              key={t.id}
              id={t.id}
              className={`cursor-default rounded-pill px-4 py-1 font-display text-[14px] font-semibold text-text-secondary data-[hovered]:text-text-primary data-[selected]:bg-bg-surface data-[selected]:text-text-primary data-[selected]:shadow-e1 ${FOCUS}`}
            >
              {t.label}
            </Tab>
          ))}
        </TabList>
      </div>
      {tabs.map((t) => (
        <TabPanel
          key={t.id}
          id={t.id}
          shouldForceMount
          className="flex min-h-0 flex-1 flex-col outline-none data-[inert]:hidden"
        >
          {t.content}
        </TabPanel>
      ))}
    </Tabs>
  )
}

/** A modal dialog: bg.raised, radius xl, e3, title2 heading. */
export function KDialog({
  title,
  isOpen,
  onClose,
  children,
}: {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      isDismissable
      className="fixed inset-0 z-40 flex items-center justify-center bg-[color-mix(in_srgb,var(--k-color-text-primary)_28%,transparent)] p-6"
    >
      <Modal className="flex max-h-full w-[520px] max-w-full flex-col overflow-hidden rounded-xl bg-bg-raised text-text-primary shadow-e3 outline-none">
        <Dialog className="flex min-h-0 flex-col outline-none">
          {({ close }) => (
            <>
              <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                <Heading slot="title" className="type-title2 m-0 flex-1">
                  {title}
                </Heading>
                <KIconButton icon="x" label={_('Close')} onPress={close} />
              </div>
              <div className="min-h-0 overflow-y-auto px-6 pb-6">{children}</div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

/** A menu button: the trigger's label names it, each item is a menuitem. */
export function KMenu({
  label,
  icon,
  heading,
  items,
  onAction,
}: {
  label: string
  icon: LocalIconName
  heading?: string
  items: { id: string; label: string; name: string }[]
  onAction: (id: string) => void
}) {
  return (
    <MenuTrigger>
      <KIconButton icon={icon} label={label} />
      <Popover
        placement="bottom end"
        className="min-w-[200px] rounded-md border border-border-subtle bg-bg-raised p-1 shadow-e2 outline-none"
      >
        {heading ? (
          <div className="type-overline px-2.5 pt-1.5 pb-1 text-text-secondary">{heading}</div>
        ) : null}
        <Menu aria-label={label} onAction={(k) => onAction(String(k))} className="outline-none">
          {items.map((i) => (
            <MenuItem
              key={i.id}
              id={i.id}
              aria-label={i.name}
              textValue={i.label}
              className="cursor-default rounded-sm px-2.5 py-1.5 text-[14px] text-text-primary outline-none data-[focused]:bg-bg-hover"
            >
              {i.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

/** An inline notice (banner): surface + border + status icon. */
export function KNotice({
  tone,
  title,
  children,
  role,
}: {
  tone: 'info' | 'warning' | 'danger' | 'neutral'
  title?: string
  children?: ReactNode
  role?: 'alert' | 'status'
}) {
  const icon: LocalIconName = tone === 'info' ? 'info' : tone === 'neutral' ? 'ban' : 'alert'
  const colour =
    tone === 'info'
      ? 'text-status-info'
      : tone === 'warning'
        ? 'text-status-warning'
        : tone === 'danger'
          ? 'text-status-danger'
          : 'text-text-secondary'
  return (
    <div role={role} className="flex gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3">
      <span className={`mt-0.5 ${colour}`}>
        <LIcon name={icon} size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="type-body-strong m-0 text-text-primary">{title}</p> : null}
        {children ? <div className="type-callout text-text-secondary">{children}</div> : null}
      </div>
    </div>
  )
}

/** Empty state: Fraunces italic headline, body, optional action. */
export function KEmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: LocalIconName
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-10 text-center">
      {icon ? (
        <span className="text-text-tertiary">
          <LIcon name={icon} size={32} />
        </span>
      ) : null}
      <h2 className="type-empty-state m-0 text-text-primary">{title}</h2>
      {description ? <p className="type-body m-0 max-w-[44ch] text-text-secondary">{description}</p> : null}
      {children}
    </div>
  )
}
