import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components'
import { Icon } from '../icon.tsx'

// A list the user reorders (agenda items): a React Aria GridList with drag and drop — the mouse drags
// a row by its grip, the keyboard picks a row up with Enter on the grip and moves it with the arrows
// (React Aria's accessible drag and drop, announced to screen readers). Rows are one Tab stop; the
// arrows move between rows, Left/Right into a row's own buttons. `onReorder` gets the full new order.

export type SortableItem = { id: string; textValue: string; content: ReactNode }

export function SortableList({
  label,
  items,
  onReorder,
  dragLabel,
  empty,
  className = '',
}: {
  label: string
  items: readonly SortableItem[]
  /** The full order after a drop. */
  onReorder: (ids: string[]) => void
  /** Accessible name of each row's grip ("Drag to reorder"). */
  dragLabel: string
  empty?: ReactNode
  className?: string
}) {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((k) => ({ 'text/plain': items.find((i) => i.id === k)?.textValue ?? '' })),
    onReorder: (e) => {
      const moving = [...e.keys].map(String)
      const rest = items.map((i) => i.id).filter((id) => !moving.includes(id))
      let at = rest.indexOf(String(e.target.key))
      if (at < 0) at = rest.length
      else if (e.target.dropPosition === 'after') at += 1
      rest.splice(at, 0, ...moving)
      onReorder(rest)
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="mx-2 h-0.5 rounded-pill bg-transparent data-[drop-target]:bg-accent-record"
      />
    ),
  })
  return (
    <GridList
      aria-label={label}
      items={items}
      dragAndDropHooks={dragAndDropHooks}
      renderEmptyState={() => empty ?? null}
      className={`flex flex-col gap-1 outline-none ${className}`}
    >
      {(item) => (
        <GridListItem
          id={item.id}
          textValue={item.textValue}
          className="group flex items-start gap-1 rounded-md border border-transparent bg-bg-surface px-1 py-1.5 text-text-primary outline-none data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-bg-surface),var(--k-color-text-primary)_3%)] data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color) data-[focus-visible]:-outline-offset-2 data-[dragging]:opacity-50"
        >
          <AriaButton
            slot="drag"
            aria-label={dragLabel}
            className="mt-1 inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-text-tertiary outline-none data-[hovered]:bg-bg-hover data-[hovered]:text-text-secondary data-[focus-visible]:outline-(length:--focus-ring-width) data-[focus-visible]:outline-solid data-[focus-visible]:outline-(--focus-ring-color)"
          >
            <Icon name="grip" size={16} />
          </AriaButton>
          <div className="min-w-0 flex-1">{item.content}</div>
        </GridListItem>
      )}
    </GridList>
  )
}
