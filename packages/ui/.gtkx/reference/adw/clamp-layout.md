---
description: "A layout manager constraining its children to a given size."
---

# AdwClampLayout

A layout manager constraining its children to a given size.




`AdwClampLayout` constraints the size of the widgets it contains to a given
maximum size. It will constrain the width if it is horizontal, or the height
if it is vertical. The expansion of the children from their minimum to their
maximum size is eased out for a smooth transition.

If a child requires more than the requested maximum size, it will be
allocated the minimum size it can fit in instead.

`AdwClampLayout` can scale with the text scale factor, use the
`ClampLayout.unit` property to enable that behavior.

See also: `Clamp`, `ClampScrollable`.

```tsx
import { AdwClampLayout } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **AdwClampLayout**

Implements `GtkOrientable`.

## Props

`ref` receives the `Adw.ClampLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `maximumSize`

`number` · default `600`

The maximum size to allocate to the children.

It is the width if the layout is horizontal, or the height if it is
vertical.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `tighteningThreshold`

`number` · default `400`

The size above which the children are clamped.

Starting from this size, the layout will tighten its grip on the children,
slowly allocating less and less of the available size up to the maximum
allocated size. Below that threshold and below the maximum size, the
children will be allocated all the available size.

If the threshold is greater than the maximum size to allocate to the
children, they will be allocated the whole size up to the maximum. If the
threshold is lower than the minimum size to allocate to the children, that
size will be used as the tightening threshold.

Effectively, tightening the grip on a child before it reaches its maximum
size makes transitions to and from the maximum size smoother when resizing.

### `unit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_SP`

The length unit for maximum size and tightening threshold.

Allows the sizes to vary depending on the text scale factor.

_Available since 1.4._

## Methods

Methods are called on the `Adw.ClampLayout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getMaximumSize`

```ts
getMaximumSize(): number
```

Gets the maximum size allocated to the children.

**Returns** the maximum size to allocate to the children

### `getTighteningThreshold`

```ts
getTighteningThreshold(): number
```

Gets the size above which the children are clamped.

**Returns** the size above which the children are clamped

### `getUnit`

```ts
getUnit(): Adw.LengthUnit
```

Gets the length unit for maximum size and tightening threshold.

**Returns** the length unit

_Available since 1.4._

### `setMaximumSize`

```ts
setMaximumSize(maximumSize: number): void
```

Sets the maximum size allocated to the children.

It is the width if the layout is horizontal, or the height if it is vertical.

**Parameters**

- `maximumSize`: the maximum size

### `setTighteningThreshold`

```ts
setTighteningThreshold(tighteningThreshold: number): void
```

Sets the size above which the children are clamped.

Starting from this size, the layout will tighten its grip on the children,
slowly allocating less and less of the available size up to the maximum
allocated size. Below that threshold and below the maximum size, the children
will be allocated all the available size.

If the threshold is greater than the maximum size to allocate to the
children, they will be allocated the whole size up to the maximum. If the
threshold is lower than the minimum size to allocate to the children, that
size will be used as the tightening threshold.

Effectively, tightening the grip on a child before it reaches its maximum
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
