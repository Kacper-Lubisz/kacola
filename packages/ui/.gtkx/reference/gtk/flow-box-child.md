---
description: "The kind of widget that can be added to a GtkFlowBox."
---

# GtkFlowBoxChild

The kind of widget that can be added to a `GtkFlowBox`.

`Gtk.FlowBox` will automatically wrap its children in a `GtkFlowBoxChild`
when necessary.

```tsx
import { GtkFlowBoxChild } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFlowBoxChild**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.FlowBoxChild` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Signals

### `onActivate`

```ts
(self: Gtk.FlowBoxChild) => void
```

Emitted when the user activates a child widget in a `GtkFlowBox`.

This can happen either by clicking or double-clicking,
or via a keybinding.

This is a [keybinding signal](class.SignalAction.html),
but it can be used by applications for their own purposes.

The default bindings are <kbd>Space</kbd> and <kbd>Enter</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.FlowBoxChild` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(): void
```

Marks `child` as changed, causing any state that depends on this
to be updated.

This affects sorting and filtering.

Note that calls to this method must be in sync with the data
used for the sorting and filtering functions. For instance, if
the list is mirroring some external data set, and *two* children
changed in the external data set when you call
`gtk_flow_box_child_changed()` on the first child, the sort function
must only read the new data for the first of the two changed
children, otherwise the resorting of the children will be wrong.

This generally means that if you don’t fully control the data
model, you have to duplicate the data that affects the sorting
and filtering functions into the widgets themselves.

Another alternative is to call `Gtk.FlowBox.invalidateSort()`
on any model change, but that is more expensive.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `getIndex`

```ts
getIndex(): number
```

Gets the current index of the `child` in its `GtkFlowBox` container.

**Returns** the index of the `child`, or -1 if the `child` is not
  in a flow box

### `isSelected`

```ts
isSelected(): boolean
```

Returns whether the `child` is currently selected in its
`GtkFlowBox` container.

**Returns** `true` if `child` is selected

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget
