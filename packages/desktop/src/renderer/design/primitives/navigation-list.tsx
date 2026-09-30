import type { ReactNode } from 'react'
import { ListBox, ListBoxItem, type Selection } from 'react-aria-components'

// The sidebar's navigation list (AdwNavigationSplitView sidebar + .navigation-sidebar list): single
// selection that follows the current route, full keyboard support (arrows, Home/End, typeahead) from
// React Aria. Rows render whatever the feature gives them.

export type NavItem = { id: string; textValue: string; content: ReactNode }

export function NavigationList({
  label,
  items,
  selected,
  onSelect,
  empty,
}: {
  label: string
  items: readonly NavItem[]
  selected: string | null
  onSelect: (id: string) => void
  empty?: ReactNode
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
      className="flex flex-col gap-0.5 p-1.5 outline-none"
    >
      {(item) => (
        <ListBoxItem
          id={item.id}
          textValue={item.textValue}
          className="cursor-default rounded-[6px] px-3 py-2 outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-[var(--focus-ring-color)] data-[hovered]:bg-hover data-[selected]:bg-selected"
        >
          {item.content}
        </ListBoxItem>
      )}
    </ListBox>
  )
}
