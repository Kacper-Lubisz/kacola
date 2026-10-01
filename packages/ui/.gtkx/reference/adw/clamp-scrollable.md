---
description: "A scrollable Clamp."
---

# AdwClampScrollable

A scrollable `Clamp`.

`AdwClampScrollable` is a variant of `Clamp` that implements the
`Gtk.Scrollable` interface.

The primary use case for `AdwClampScrollable` is clamping
`Gtk.ListView`.

See also: `ClampLayout`.

```tsx
import { AdwClampScrollable } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwClampScrollable**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`, `GtkScrollable`.

## Props

`ref` receives the `Adw.ClampScrollable` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Horizontal `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `hscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when horizontal scrolling should start.

### `maximumSize`

`number` · default `600`

The maximum size allocated to the child.

It is the width if the clamp is horizontal, or the height if it is vertical.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `tighteningThreshold`

`number` · default `400`

The size above which the child is clamped.

Starting from this size, the clamp will tighten its grip on the child,
slowly allocating less and less of the available size up to the maximum
allocated size. Below that threshold and below the maximum width, the child
will be allocated all the available size.

If the threshold is greater than the maximum size to allocate to the child,
the child will be allocated all the width up to the maximum.
If the threshold is lower than the minimum size to allocate to the child,
that size will be used as the tightening threshold.

Effectively, tightening the grip on the child before it reaches its maximum
size makes transitions to and from the maximum size smoother when resizing.

### `unit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_SP`

The length unit for maximum size and tightening threshold.

Allows the sizes to vary depending on the text scale factor.

_Available since 1.4._

### `vadjustment`

`Gtk.Adjustment | ReactElement` · from `GtkScrollable`

Vertical `GtkAdjustment` of the scrollable widget.

This adjustment is shared between the scrollable widget and its parent.

### `vscrollPolicy`

`Gtk.ScrollablePolicy` · default `GTK_SCROLL_MINIMUM` · from `GtkScrollable`

Determines when vertical scrolling should start.

## Methods

Methods are called on the `Adw.ClampScrollable` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `getMaximumSize`

```ts
getMaximumSize(): number
```

Gets the maximum size allocated to the child.

**Returns** the maximum size to allocate to the child

### `getTighteningThreshold`

```ts
getTighteningThreshold(): number
```

Gets the size above which the child is clamped.

**Returns** the size above which the child is clamped

### `getUnit`

```ts
getUnit(): Adw.LengthUnit
```

Gets the length unit for maximum size and tightening threshold.

**Returns** the length unit

_Available since 1.4._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

### `setMaximumSize`

```ts
setMaximumSize(maximumSize: number): void
```

Sets the maximum size allocated to the child.

It is the width if the clamp is horizontal, or the height if it is vertical.

**Parameters**

- `maximumSize`: the maximum size

### `setTighteningThreshold`

```ts
setTighteningThreshold(tighteningThreshold: number): void
```

Sets the size above which the child is clamped.

Starting from this size, the clamp will tighten its grip on the child, slowly
allocating less and less of the available size up to the maximum allocated
size. Below that threshold and below the maximum width, the child will be
allocated all the available size.

If the threshold is greater than the maximum size to allocate to the child,
the child will be allocated all the width up to the maximum. If the threshold
is lower than the minimum size to allocate to the child, that size will be
used as the tightening threshold.

Effectively, tightening the grip on the child before it reaches its maximum
size makes transitions to and from the maximum size smoother when resizing.

**Parameters**

- `tighteningThreshold`: the tightening threshold

### `setUnit`

```ts
setUnit(unit: Adw.LengthUnit): void
```

Sets the length unit for maximum size and tightening threshold.

Allows the sizes to vary depending on the text scale factor.

**Parameters**

- `unit`: the length unit

_Available since 1.4._
