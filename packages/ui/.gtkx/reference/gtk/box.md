---
description: "Arranges child widgets into a single row or column."
---

# GtkBox

Arranges child widgets into a single row or column.



Whether it is a row or column depends on the value of its
`Gtk.Orientable.orientation` property. Within the other
dimension, all children are allocated the same size. The
`Gtk.Widget.halign` and `Gtk.Widget.valign`
properties can be used on the children to influence their allocation.

Use repeated calls to `Gtk.Box.append()` to pack widgets into a
`GtkBox` from start to end. Use `Gtk.Box.remove()` to remove widgets
from the `GtkBox`. `Gtk.Box.insertChildAfter()` can be used to add
a child at a particular position.

Use `Gtk.Box.setHomogeneous()` to specify whether or not all children
of the `GtkBox` are forced to get the same amount of space.

Use `Gtk.Box.setSpacing()` to determine how much space will be minimally
placed between all children in the `GtkBox`. Note that spacing is added
*between* the children.

Use `Gtk.Box.reorderChildAfter()` to move a child to a different
place in the box.

## CSS nodes

`GtkBox` uses a single CSS node with name box.

## Accessibility

Until GTK 4.10, `GtkBox` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkBox` uses the `Gtk.AccessibleRole.generic` role.

```tsx
import { GtkBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkBox**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Box` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baselineChild`

`number` · default `-1`

The position of the child that determines the baseline.

This is only relevant if the box is in vertical orientation.

_Available since 4.12._

### `baselinePosition`

`Gtk.BaselinePosition` · default `GTK_BASELINE_POSITION_CENTER`

How to position baseline-aligned widgets if extra space is available.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `homogeneous`

`boolean` · default `false`

Whether the children should all be the same size.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `spacing`

`number` · default `0`

The amount of space between children.

## Methods

Methods are called on the `Gtk.Box` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): void
```

Adds a child at the end.

**Parameters**

- `child`: the widget to append

### `getBaselineChild`

```ts
getBaselineChild(): number
```

Gets the value set by `Gtk.Box.setBaselineChild()`.

**Returns** the baseline child

_Available since 4.12._

### `getBaselinePosition`

```ts
getBaselinePosition(): Gtk.BaselinePosition
```

Gets the value set by `Gtk.Box.setBaselinePosition()`.

**Returns** the baseline position

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Returns whether the box is homogeneous.

In a homogeneous box all children are the same size.

**Returns** true if the box is homogeneous

### `getSpacing`

```ts
getSpacing(): number
```

Gets the value set by `Gtk.Box.setSpacing()`.

**Returns** spacing between children

### `insertChildAfter`

```ts
insertChildAfter(child: Gtk.Widget, sibling: Gtk.Widget | null): void
```

Inserts a child at a specific position.

The child is added after `sibling` in the list of `box` children.

If `sibling` is `NULL`, the `child` is placed at the beginning.

**Parameters**

- `child`: the widget to insert
- `sibling`: the sibling after which to insert `child`

### `prepend`

```ts
prepend(child: Gtk.Widget): void
```

Adds a child at the beginning.

**Parameters**

- `child`: the widget to prepend

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from the box.

The child must have been added before with
`Gtk.Box.append()`, `Gtk.Box.prepend()`, or
`Gtk.Box.insertChildAfter()`.

**Parameters**

- `child`: the child to remove

### `reorderChildAfter`

```ts
reorderChildAfter(child: Gtk.Widget, sibling: Gtk.Widget | null): void
```

Moves a child to a different position.

The child is moved to the position after `sibling` in the list
of `box` children.

If `sibling` is `NULL`, the child is placed at the beginning.

**Parameters**

- `child`: the widget to move, must be a child of `box`
- `sibling`: the sibling to move `child` after

### `setBaselineChild`

```ts
setBaselineChild(child: number): void
```

Sets the baseline child of a box.

This affects only vertical boxes.

**Parameters**

- `child`: a child position, or -1

_Available since 4.12._

### `setBaselinePosition`

```ts
setBaselinePosition(position: Gtk.BaselinePosition): void
```

Sets the baseline position of a box.

This affects only horizontal boxes with at least one baseline
aligned child. If there is more vertical space available than
requested, and the baseline is not allocated by the parent then
`position` is used to allocate the baseline with respect to the
extra space available.

**Parameters**

- `position`: the baseline position

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether or not all children are given equal space
in the box.

**Parameters**

- `homogeneous`: true to create equal allotments, false for variable allotments

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets the number of pixels to place between children.

**Parameters**

- `spacing`: the number of pixels to put between children
