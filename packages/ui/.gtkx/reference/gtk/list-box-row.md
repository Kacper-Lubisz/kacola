---
description: "The kind of widget that can be added to a GtkListBox."
---

# GtkListBoxRow

The kind of widget that can be added to a `GtkListBox`.

`Gtk.ListBox` will automatically wrap its children in a `GtkListboxRow`
when necessary.

```tsx
import { GtkListBoxRow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkListBoxRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ListBoxRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `activatable`

`boolean` · default `true`

Determines whether the ::row-activated
signal will be emitted for this row.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `selectable`

`boolean` · default `true`

Determines whether this row can be selected.

## Signals

### `onActivate`

```ts
(self: Gtk.ListBoxRow) => void
```

This is a keybinding signal, which will cause this row to be activated.

If you want to be notified when the user activates a row (by key or not),
use the `Gtk.ListBox.row-activated` signal on the row’s parent
`GtkListBox`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ListBoxRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(): void
```

Marks `row` as changed, causing any state that depends on this
to be updated.

This affects sorting, filtering and headers.

Note that calls to this method must be in sync with the data
used for the row functions. For instance, if the list is
mirroring some external data set, and *two* rows changed in the
external data set then when you call `gtk_list_box_row_changed()`
on the first row the sort function must only read the new data
for the first of the two changed rows, otherwise the resorting
of the rows will be wrong.

This generally means that if you don’t fully control the data
model you have to duplicate the data that affects the listbox
row functions into the row widgets themselves. Another alternative
is to call `Gtk.ListBox.invalidateSort()` on any model change,
but that is more expensive.

### `getActivatable`

```ts
getActivatable(): boolean
```

Gets whether the row is activatable.

**Returns** `true` if the row is activatable

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `row`.

**Returns** the child widget of `row`

### `getHeader`

```ts
getHeader(): Gtk.Widget | null
```

Returns the current header of the `row`.

This can be used
in a `Gtk.ListBoxUpdateHeaderFunc` to see if
there is a header set already, and if so to update
the state of it.

**Returns** the current header

### `getIndex`

```ts
getIndex(): number
```

Gets the current index of the `row` in its `GtkListBox` container.

**Returns** the index of the `row`, or -1 if the `row` is not in a listbox

### `getSelectable`

```ts
getSelectable(): boolean
```

Gets whether the row can be selected.

**Returns** `true` if the row is selectable

### `isSelected`

```ts
isSelected(): boolean
```

Returns whether the child is currently selected in its
`GtkListBox` container.

**Returns** `true` if `row` is selected

### `setActivatable`

```ts
setActivatable(activatable: boolean): void
```

Set whether the row is activatable.

**Parameters**

- `activatable`: `true` to mark the row as activatable

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

### `setHeader`

```ts
setHeader(header: Gtk.Widget | null): void
```

Sets the current header of the `row`.

This is only allowed to be called
from a `Gtk.ListBoxUpdateHeaderFunc`.
It will replace any existing header in the row,
and be shown in front of the row in the listbox.

**Parameters**

- `header`: the header

### `setSelectable`

```ts
setSelectable(selectable: boolean): void
```

Set whether the row can be selected.

**Parameters**

- `selectable`: `true` to mark the row as selectable
