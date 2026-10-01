---
description: "Arranges children in a single row or column."
---

# GtkBoxLayout

Arranges children in a single row or column.

Whether it is a row or column depends on the value of its
`Gtk.Orientable.orientation` property. Within the other dimension
all children all allocated the same size. The `GtkBoxLayout` will respect
the `Gtk.Widget.halign` and `Gtk.Widget.valign`
properties of each child widget.

If you want all children to be assigned the same size, you can use
the `Gtk.BoxLayout.homogeneous` property.

If you want to specify the amount of space placed between each child,
you can use the `Gtk.BoxLayout.spacing` property.

```tsx
import { GtkBoxLayout } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **GtkBoxLayout**

Implements `GtkOrientable`.

## Props

`ref` receives the `Gtk.BoxLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baselineChild`

`number` · default `-1`

The child that determines the baseline of the box
in vertical layout.

If the child does baseline positioning, then its baseline
is lined up with the baseline of the box. If it doesn't, then
the bottom edge of the child is used.

_Available since 4.12._

### `baselinePosition`

`Gtk.BaselinePosition` · default `GTK_BASELINE_POSITION_CENTER`

The position of the allocated baseline within the extra space
allocated to each child.

This property is only relevant for horizontal layouts containing
at least one child with a baseline alignment.

### `homogeneous`

`boolean` · default `false`

Whether the box layout should distribute the available space
equally among the children.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `spacing`

`number` · default `0`

The space to put between the children.

## Methods

Methods are called on the `Gtk.BoxLayout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBaselineChild`

```ts
getBaselineChild(): number
```

Gets the value set by `gtk_box_layout_set_baseline_child()`.

**Returns** the index of the child that determines the baseline
    in vertical layout, or -1

_Available since 4.12._

### `getBaselinePosition`

```ts
getBaselinePosition(): Gtk.BaselinePosition
```

Gets the value set by `gtk_box_layout_set_baseline_position()`.

**Returns** the baseline position

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Returns whether the layout is set to be homogeneous.

**Returns** `true` if the layout is homogeneous

### `getSpacing`

```ts
getSpacing(): number
```

Returns the space that `box_layout` puts between children.

**Returns** the spacing of the layout

### `setBaselineChild`

```ts
setBaselineChild(child: number): void
```

Sets the index of the child that determines the baseline
in vertical layout.

**Parameters**

- `child`: the child position, or -1

_Available since 4.12._

### `setBaselinePosition`

```ts
setBaselinePosition(position: Gtk.BaselinePosition): void
```

Sets the baseline position of a box layout.

The baseline position affects only horizontal boxes with at least one
baseline aligned child. If there is more vertical space available than
requested, and the baseline is not allocated by the parent then the
given `position` is used to allocate the baseline within the extra
space available.

**Parameters**

- `position`: a `GtkBaselinePosition`

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether the box layout will allocate the same
size to all children.

**Parameters**

- `homogeneous`: `true` to set the box layout as homogeneous

### `setSpacing`

```ts
setSpacing(spacing: number): void
```

Sets how much spacing to put between children.

**Parameters**

- `spacing`: the spacing to apply between children
