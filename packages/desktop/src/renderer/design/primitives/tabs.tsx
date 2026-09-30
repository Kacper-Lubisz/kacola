import type { ReactNode } from 'react'
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components'
import { Icon, type IconName } from '../icon.tsx'

// Segmented control and tabs share one look (brand spec): a pill container in bg.sidebar, the active
// segment on bg.surface with e1, Bricolage 600 14. Tabs switch panels (role=tablist/tab/tabpanel,
// arrow keys); the segmented control picks a value (a radio-like toggle group).

const CONTAINER = 'inline-flex items-center gap-0.5 rounded-pill bg-bg-sidebar p-[3px]'
const SEGMENT =
  'app-no-drag inline-flex h-7 cursor-default select-none items-center gap-1.5 rounded-pill px-3 font-display text-[14px] font-semibold text-text-secondary outline-none transition-colors duration-(--k-duration-fast) data-[hovered]:text-text-primary data-[selected]:bg-bg-surface data-[selected]:text-text-primary data-[selected]:shadow-e1 data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color) data-[focus-visible]:outline-offset-(--focus-ring-offset) data-[disabled]:opacity-45'

export type Segment<T extends string> = { id: T; label: string; icon?: IconName }

export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  className = '',
}: {
  /** Accessible name of the group. */
  label: string
  segments: readonly Segment<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [k] = [...keys]
        if (k !== undefined && k !== value) onChange(String(k) as T)
      }}
      className={`${CONTAINER} ${className}`}
    >
      {segments.map((s) => (
        <ToggleButton key={s.id} id={s.id} className={SEGMENT}>
          {s.icon ? <Icon name={s.icon} size={16} /> : null}
          {s.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

/** Tabs: `<Tabs selectedKey onSelectionChange><TabList label tabs/>…<TabPanel id>…</TabPanel></Tabs>`. */
export function Tabs<T extends string>({
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  children,
  className = '',
}: {
  selectedKey?: T
  defaultSelectedKey?: T
  onSelectionChange?: (k: T) => void
  children: ReactNode
  className?: string
}) {
  return (
    <AriaTabs
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={(k) => onSelectionChange?.(String(k) as T)}
      className={`flex min-h-0 flex-col ${className}`}
    >
      {children}
    </AriaTabs>
  )
}

export function TabList<T extends string>({
  label,
  tabs,
  className = '',
}: {
  label: string
  tabs: readonly Segment<T>[]
  className?: string
}) {
  return (
    <AriaTabList aria-label={label} className={`${CONTAINER} self-start ${className}`}>
      {tabs.map((t) => (
        <AriaTab key={t.id} id={t.id} className={SEGMENT}>
          {t.icon ? <Icon name={t.icon} size={16} /> : null}
          {t.label}
        </AriaTab>
      ))}
    </AriaTabList>
  )
}

export function TabPanel({
  id,
  children,
  className = '',
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <AriaTabPanel id={id} className={`min-h-0 flex-1 outline-none ${className}`}>
      {children}
    </AriaTabPanel>
  )
}
