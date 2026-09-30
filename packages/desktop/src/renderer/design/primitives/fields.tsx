import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  NumberField as AriaNumberField,
  SearchField as AriaSearchField,
  TextField as AriaTextField,
  FieldError,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
  Text,
  TextArea as AriaTextArea,
} from 'react-aria-components'
import { Icon } from '../icon.tsx'

// Inputs (brand spec): 36px high, radius md, surface fill, default border → strong on hover → the focus
// ring; placeholder text.tertiary. Every field has a label — visible, or `labelHidden` (still the
// accessible name). Behaviour, validation plumbing and keyboard from React Aria.

export const INPUT =
  'h-9 w-full min-w-0 rounded-md border border-border-default bg-bg-surface px-3 font-sans text-[15px] text-text-primary outline-none transition-[border-color] duration-(--k-duration-fast) data-[hovered]:border-border-strong data-[focused]:border-border-strong data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color) data-[focus-visible]:outline-offset-(--focus-ring-offset) data-[disabled]:opacity-45 data-[invalid]:border-status-danger select-text'

const LABEL = 'type-caption text-text-secondary'

type FieldBase = {
  label: string
  /** Keep the label as the accessible name but don't draw it (search boxes, inline rows). */
  labelHidden?: boolean
  description?: ReactNode
  errorMessage?: string
  className?: string
}

function FieldLabel({ label, hidden }: { label: string; hidden?: boolean }) {
  return <Label className={hidden ? 'sr-only' : LABEL}>{label}</Label>
}

function Help({ description, errorMessage }: Pick<FieldBase, 'description' | 'errorMessage'>) {
  return (
    <>
      {description ? (
        <Text slot="description" className="type-caption text-text-secondary">
          {description}
        </Text>
      ) : null}
      <FieldError className="type-caption text-status-danger">{errorMessage}</FieldError>
    </>
  )
}

export function TextField({
  label,
  labelHidden,
  description,
  errorMessage,
  className = '',
  placeholder,
  type = 'text',
  inputClassName = '',
  ...rest
}: FieldBase & {
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onBlur?: () => void
  placeholder?: string
  type?: 'text' | 'password' | 'url' | 'email'
  isDisabled?: boolean
  isReadOnly?: boolean
  isInvalid?: boolean
  autoFocus?: boolean
  autoComplete?: string
  inputClassName?: string
}) {
  return (
    <AriaTextField
      {...rest}
      type={type}
      isInvalid={rest.isInvalid ?? (errorMessage ? true : undefined)}
      className={`flex flex-col gap-1.5 ${className}`}
    >
      <FieldLabel label={label} hidden={labelHidden} />
      <Input placeholder={placeholder} spellCheck={type === 'text'} className={`${INPUT} ${inputClassName}`} />
      <Help description={description} errorMessage={errorMessage} />
    </AriaTextField>
  )
}

export function TextArea({
  label,
  labelHidden,
  description,
  errorMessage,
  className = '',
  placeholder,
  rows = 3,
  ...rest
}: FieldBase & {
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  placeholder?: string
  rows?: number
  isDisabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <AriaTextField {...rest} className={`flex flex-col gap-1.5 ${className}`}>
      <FieldLabel label={label} hidden={labelHidden} />
      <AriaTextArea
        rows={rows}
        placeholder={placeholder}
        className={`${INPUT} h-auto resize-none py-2 leading-[22px]`}
      />
      <Help description={description} errorMessage={errorMessage} />
    </AriaTextField>
  )
}

/** Search box with a leading icon and a clear button (Escape clears too). Its label is hidden. */
export function SearchField({
  label,
  placeholder,
  className = '',
  ...rest
}: {
  label: string
  placeholder?: string
  value?: string
  onChange?: (v: string) => void
  onSubmit?: (v: string) => void
  autoFocus?: boolean
  className?: string
}) {
  return (
    <AriaSearchField {...rest} aria-label={label} className={`group relative flex items-center ${className}`}>
      <span className="pointer-events-none absolute left-2.5 text-text-tertiary">
        <Icon name="search" size={16} />
      </span>
      <Input
        placeholder={placeholder ?? label}
        className={`${INPUT} pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden`}
      />
      <AriaButton
        aria-label="Clear"
        className="absolute right-1.5 flex size-6 cursor-default items-center justify-center rounded-sm text-text-secondary focus-ring data-[hovered]:bg-bg-hover group-data-[empty]:hidden"
      >
        <Icon name="close" size={14} />
      </AriaButton>
    </AriaSearchField>
  )
}

/** A number with − / + steppers; arrow keys step too. */
export function NumberField({
  label,
  labelHidden,
  description,
  className = '',
  ...rest
}: FieldBase & {
  value?: number
  defaultValue?: number
  onChange?: (v: number) => void
  minValue?: number
  maxValue?: number
  step?: number
  isDisabled?: boolean
}) {
  return (
    <AriaNumberField {...rest} className={`flex flex-col gap-1.5 ${className}`}>
      <FieldLabel label={label} hidden={labelHidden} />
      <Group className="flex h-9 w-36 items-stretch overflow-hidden rounded-md border border-border-default bg-bg-surface data-[hovered]:border-border-strong data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color) data-[focus-visible]:outline-offset-(--focus-ring-offset)">
        <AriaButton
          slot="decrement"
          className="flex w-8 cursor-default items-center justify-center text-text-secondary outline-none data-[hovered]:bg-bg-hover"
        >
          <Icon name="chevronDown" size={16} />
        </AriaButton>
        <Input className="w-full min-w-0 bg-transparent text-center font-mono text-[14px] text-text-primary outline-none select-text" />
        <AriaButton
          slot="increment"
          className="flex w-8 cursor-default items-center justify-center text-text-secondary outline-none data-[hovered]:bg-bg-hover"
        >
          <Icon name="chevronUp" size={16} />
        </AriaButton>
      </Group>
      <Help description={description} />
    </AriaNumberField>
  )
}

export type SelectOption<T extends string> = { value: T; label: string }

/**
 * A dropdown of options (a combo row in GTK terms). Controlled by value: it never reports the value it
 * was given, only a user's choice — so opening a screen of these can never write anything back.
 */
export function Select<T extends string>({
  label,
  labelHidden,
  description,
  options,
  value,
  onChange,
  isDisabled,
  className = '',
}: FieldBase & {
  options: readonly SelectOption<T>[]
  value: T
  onChange: (v: T) => void
  isDisabled?: boolean
}) {
  return (
    <AriaSelect
      selectedKey={value}
      onSelectionChange={(k) => {
        if (k !== null && k !== value) onChange(String(k) as T)
      }}
      isDisabled={isDisabled}
      className={`flex flex-col gap-1.5 ${className}`}
    >
      <FieldLabel label={label} hidden={labelHidden} />
      <AriaButton
        className={`${INPUT} flex cursor-default items-center justify-between gap-2 text-left data-[pressed]:border-border-strong`}
      >
        <SelectValue className="truncate" />
        <Icon name="chevronDown" size={16} className="shrink-0 text-text-secondary" />
      </AriaButton>
      <Help description={description} />
      <Popover
        offset={4}
        className="min-w-(--trigger-width) overflow-auto rounded-lg border border-border-subtle bg-bg-raised p-1 shadow-e2 outline-none"
      >
        <ListBox className="outline-none" items={options.map((o) => ({ id: o.value, ...o }))}>
          {(o) => (
            <ListBoxItem
              id={o.id}
              textValue={o.label}
              className="flex cursor-default items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-[15px] text-text-primary outline-none data-[focused]:bg-bg-hover data-[selected]:font-semibold"
            >
              {({ isSelected }) => (
                <>
                  <span>{o.label}</span>
                  {isSelected ? <Icon name="check" size={16} /> : null}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}
