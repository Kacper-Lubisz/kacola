---
description: "The type of item used by GtkTreeListModel."
---

# GtkTreeListRow

The type of item used by `GtkTreeListModel`.

It allows navigating the model as a tree and modify the state of rows.

`GtkTreeListRow` instances are created by a `GtkTreeListModel` only
when the `Gtk.TreeListModel.passthrough` property is not set.

There are various support objects that can make use of `GtkTreeListRow`
objects, such as the `Gtk.TreeExpander` widget that allows displaying
an icon to expand or collapse a row or `Gtk.TreeListRowSorter` that
makes it possible to sort trees properly.

```tsx
import { GtkTreeListRow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTreeListRow**

## Props

`ref` receives the `Gtk.TreeListRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`Gio.ListModel` · read-only, observe with `onNotifyChildren`

The model holding the row's children.

### `depth`

`number` · default `0` · read-only, observe with `onNotifyDepth`

The depth in the tree of this row.

### `expandable`

`boolean` · default `false` · read-only, observe with `onNotifyExpandable`

If this row can ever be expanded.

### `expanded`

`boolean` · default `false`

If this row is currently expanded.

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

The item held in this row.

## Methods

Methods are called on the `Gtk.TreeListRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChildren`

```ts
getChildren(): Gio.ListModel | null
```

If the row is expanded, gets the model holding the children of `self`.

This model is the model created by the
`Gtk.TreeListModelCreateModelFunc`
and contains the original items, no matter what value
`Gtk.TreeListModel.passthrough` is set to.

**Returns** The model containing the children

### `getChildRow`

```ts
getChildRow(position: number): Gtk.TreeListRow | null
```

If `self` is not expanded or `position` is greater than the
number of children, `null` is returned.

**Parameters**

- `position`: position of the child to get

**Returns** the child in `position`

### `getDepth`

```ts
getDepth(): number
```

Gets the depth of this row.

Rows that correspond to items in the root model have a depth
of zero, rows corresponding to items of models of direct children
of the root model have a depth of 1 and so on.

The depth of a row never changes until the row is removed from its model
at which point it will forever return 0.

**Returns** The depth of this row

### `getExpanded`

```ts
getExpanded(): boolean
```

Gets if a row is currently expanded.

**Returns** `true` if the row is expanded

### `getItem`

```ts
getItem(): GObject.Object | null
```

Gets the item corresponding to this row,

**Returns** The item
  of this row. This function is only marked as nullable for backwards
  compatibility reasons.

### `getParent`

```ts
getParent(): Gtk.TreeListRow | null
```

Gets the row representing the parent for `self`.

That is the row that would need to be collapsed
to make this row disappear.

If `self` is a row corresponding to the root model,
`null` is returned.

The value returned by this function never changes
until the row is removed from its model at which point
it will forever return `null`.

**Returns** The parent of `self`

### `getPosition`

```ts
getPosition(): number
```

Returns the position in the `GtkTreeListModel` that `self` occupies
at the moment.

**Returns** The position in the model

### `isExpandable`

```ts
isExpandable(): boolean
```

Checks if a row can be expanded.

This does not mean that the row is actually expanded,
this can be checked with `Gtk.TreeListRow.getExpanded()`.

If a row is expandable never changes until the row is removed
from its model at which point it will forever return `false`.

**Returns** `true` if the row is expandable

### `setExpanded`

```ts
setExpanded(expanded: boolean): void
```

Expands or collapses a row.

If a row is expanded, the model of calling the
`Gtk.TreeListModelCreateModelFunc` for the row's
item will be inserted after this row. If a row is collapsed,
those items will be removed from the model.

If the row is not expandable, this function does nothing.

**Parameters**

- `expanded`: `true` if the row should be expanded
