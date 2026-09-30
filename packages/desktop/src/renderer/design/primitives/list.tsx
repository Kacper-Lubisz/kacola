import type { ReactNode } from 'react'
import { ListBox, ListBoxItem, type Selection } from 'react-aria-components'

// Lists.
//
//   NavigationList  a single-selection listbox (the sidebar's sessions): arrows, Home/End, typeahead,
//                   selection follows the route. Rows are ListRow content.
//   ListRow         the 56px row layout: title (headline), meta (caption, secondary), a live red dot,
//                   optional leading / trailing. Hover bg.hover, selected bg.selected — no left-border
//                   accents (brand spec).

export type NavItem = { id: string; textValue: string; content: ReactNode }

export function NavigationList({
  label,
  items,
  selected,
  onSelect,
  empty,
  className = '',
}: {
  label: string
  items: readonly NavItem[]
  selected: string | null
  onSelect: (id: string) => void
  empty?: ReactNode
  className?: string
}) {
  return (
    <ListBox
      aria-label={label}
      items={items}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection={false}
      selectedKeys={selected ? [selected] : []}
      onSelectionChange={(keys: Selection) => {
        if (keys === 'all') return
        const [first] = [...keys]
        if (first !== undefined) onSelect(String(first))
      }}
      renderEmptyState={() => empty ?? null}
      className={`flex flex-col gap-0.5 px-2 py-1 outline-none ${className}`}
    >
      {(item) => (
        <ListBoxItem
          id={item.id}
          textValue={item.textValue}
          className="cursor-default rounded-md outline-none transition-colors duration-(--k-duration-fast) data-[hovered]:bg-bg-hover data-[selected]:bg-bg-selected data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color) data-[focus-visible]:-outline-offset-2"
        >
          {item.content}
        </ListBoxItem>
      )}
    </ListBox>
  )
}

/** The contents of one list row. Put it inside a NavigationList item, or any container. */
export function ListRow({
  title,
  meta,
  live,
  liveLabel,
  leading,
  trailing,
}: {
  title: ReactNode
  meta?: ReactNode
  /** Show the red live dot (a recording). */
  live?: boolean
  /** Accessible text for the dot ("Recording"); read with the row. */
  liveLabel?: string
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex min-h-14 min-w-0 items-center gap-3 px-3 py-2">
      {leading}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-sans text-[16px] leading-[22px] font-semibold text-text-primary">
            {title}
          </span>
          {live ? (
            <span role="img" aria-label={liveLabel} className="relative flex size-2 shrink-0">
              <span className="record-pulse absolute inset-0 rounded-full bg-accent-record" />
              <span className="relative size-2 rounded-full bg-accent-record" />
            </span>
          ) : null}
        </span>
        {meta ? <span className="truncate type-caption text-text-secondary">{meta}</span> : null}
      </div>
      {trailing}
    </div>
  )
}
