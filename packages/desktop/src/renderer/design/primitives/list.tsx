import type { ReactNode } from 'react'
import { ListBox, ListBoxItem, type Selection } from 'react-aria-components'

// Lists.
//
//   NavigationList  a single-selection listbox (version history): arrows, Home/End, typeahead.
//                   Hover bg.hover, selected bg.selected — no left-border accents (brand spec).

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
