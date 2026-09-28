import type * as GObject from '@gtkx/gi/gobject'
import * as Gtk from '@gtkx/gi/gtk'
import { GtkListView, GtkSignalListItemFactory } from '@gtkx/jsx/gtk'
import { createPortal, useProperty } from '@gtkx/react'
import { memo, type ReactNode, type Ref, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { diffKeys } from '../data/list-diff.ts'

// A virtualised list: a real GtkListView over a GtkStringList of row keys, with each visible
// GtkListItem's content rendered by React through a portal. Only rows on screen exist as widgets.
//
// Why not @gtkx/components' ListView: it gives no access to the GtkListItem, and the list item is
// what AT-SPI exposes as the "list item" — without `accessible-label` on it every row is announced
// (and found by tests) as an anonymous item. Here each row names its list item, and the whole thing
// is ~100 lines over documented GTK API.
//
// Updates: the key list is diffed against the model (common prefix/suffix, one splice), so appending
// a line or revising one in place touches one model position, not the whole list.

export type VirtualListProps<T> = {
  rows: readonly T[]
  keyOf: (row: T) => string
  render: (row: T) => ReactNode
  /** The accessible name of the row's list item (what a screen reader reads). */
  labelOf: (row: T) => string
  /** The selected (highlighted) row, controlled. */
  selectedKey: string | null
  onSelectedKey?: (key: string | null) => void
  listRef?: Ref<Gtk.ListView>
  accessibleLabel: string
  cssClasses?: string[]
  /** Height of a row before its content renders, so scroll estimates stay steady. */
  estimatedRowHeight?: number
}

type Cell = { host: Gtk.ListItem; key: number }

/**
 * GtkListView sizes its viewport from the rows it has measured. A list item whose React content has
 * not been committed yet has no child and measures 0 px, and the view then stops creating rows (seen:
 * one row for a 1,350-line transcript). A placeholder of the estimated height stands in until the
 * portal replaces it.
 */
function prepare(host: Gtk.ListItem, height: number) {
  if (host.getChild() === null) host.setChild(new Gtk.Box({ heightRequest: height }))
}

function CellView<T>({
  host,
  byKey,
  render,
  labelOf,
}: {
  host: Gtk.ListItem
  byKey: ReadonlyMap<string, T>
  render: (row: T) => ReactNode
  labelOf: (row: T) => string
}) {
  const item = useProperty(host, 'item') as GObject.Object | null | undefined
  const key = item instanceof Gtk.StringObject ? item.getString() : null
  const row = key === null ? undefined : byKey.get(key)
  const label = row === undefined ? '' : labelOf(row)
  useLayoutEffect(() => {
    host.setAccessibleLabel(label)
  }, [host, label])
  return createPortal(row === undefined ? null : <Row row={row} render={render} />, host)
}

const Row = memo(function Row<T>({ row, render }: { row: T; render: (row: T) => ReactNode }) {
  return <>{render(row)}</>
}) as <T>(p: { row: T; render: (row: T) => ReactNode }) => ReactNode

export function VirtualList<T>({
  rows,
  keyOf,
  render,
  labelOf,
  selectedKey,
  onSelectedKey,
  listRef,
  accessibleLabel,
  cssClasses,
  estimatedRowHeight = 40,
}: VirtualListProps<T>) {
  const model = useMemo(() => Gtk.StringList.new([]), [])
  const selection = useMemo(() => {
    const s = Gtk.SingleSelection.new(model)
    s.setAutoselect(false)
    s.setCanUnselect(true)
    s.setSelected(Gtk.INVALID_LIST_POSITION)
    return s
  }, [model])
  const keys = useRef<string[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const serial = useRef(0)

  // One factory for the list's lifetime: a new factory element would make the view tear down and
  // rebuild every row (and every row's accessible object) on each render.
  const height = useRef(estimatedRowHeight)
  height.current = estimatedRowHeight
  const factory = useMemo(
    () => (
      <GtkSignalListItemFactory
        onSetup={(obj) => {
          if (!(obj instanceof Gtk.ListItem)) return
          const host = obj
          prepare(host, height.current)
          setCells((c) => [...c, { host, key: ++serial.current }])
        }}
        onBind={(obj) => {
          if (obj instanceof Gtk.ListItem) prepare(obj, height.current)
        }}
        onTeardown={(obj) => {
          setCells((c) => c.filter((x) => x.host !== obj))
        }}
      />
    ),
    [],
  )

  const nextKeys = useMemo(() => rows.map(keyOf), [rows, keyOf])
  const byKey = useMemo(() => new Map(rows.map((r, i) => [nextKeys[i]!, r])), [rows, nextKeys])

  // Sync the model before GTK lays out: one splice per change.
  useLayoutEffect(() => {
    const d = diffKeys(keys.current, nextKeys)
    if (d) model.splice(d.position, d.removed, d.added)
    keys.current = nextKeys
  }, [model, nextKeys])

  // Controlled selection.
  useLayoutEffect(() => {
    const want = selectedKey === null ? -1 : nextKeys.indexOf(selectedKey)
    const pos = want === -1 ? Gtk.INVALID_LIST_POSITION : want
    if (selection.getSelected() !== pos) selection.setSelected(pos)
  }, [selection, selectedKey, nextKeys])

  return (
    <>
      <GtkListView
        ref={listRef}
        model={selection}
        accessibleLabel={accessibleLabel}
        cssClasses={cssClasses}
        factory={factory}
      />
      {cells.map((c) => (
        <CellView<T> key={c.key} host={c.host} byKey={byKey} render={render} labelOf={labelOf} />
      ))}
      <SelectionWatcher selection={selection} keys={keys} onSelectedKey={onSelectedKey} />
    </>
  )
}

/** Mirrors a user's selection (click, keyboard) back to the owner. */
function SelectionWatcher({
  selection,
  keys,
  onSelectedKey,
}: {
  selection: Gtk.SingleSelection
  keys: { current: string[] }
  onSelectedKey: ((key: string | null) => void) | undefined
}) {
  const selected = useProperty(selection, 'selected')
  const last = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (selected === undefined || selected === last.current) return
    last.current = selected
    const key = selected === Gtk.INVALID_LIST_POSITION ? null : (keys.current[selected] ?? null)
    onSelectedKey?.(key)
  }, [selected, keys, onSelectedKey])
  return null
}
