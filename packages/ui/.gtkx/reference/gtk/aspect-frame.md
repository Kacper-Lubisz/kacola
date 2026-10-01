---
description: "Preserves the aspect ratio of its child."
---

# GtkAspectFrame

Preserves the aspect ratio of its child.

The frame can respect the aspect ratio of the child widget,
or use its own aspect ratio.

## CSS nodes

`GtkAspectFrame` uses a CSS node with name `aspectframe`.

## Accessibility

Until GTK 4.10, `GtkAspectFrame` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkAspectFrame` uses the `Gtk.AccessibleRole.generic` role.

```tsx
import { GtkAspectFrame } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkAspectFrame**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.AspectFrame` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `obeyChild`

`boolean` · default `true`

Whether the `GtkAspectFrame` should use the aspect ratio of its child.

### `ratio`

`number` · default `1.000000`

The aspect ratio to be used by the `GtkAspectFrame`.

This property is only used if
`Gtk.AspectFrame.obeyChild` is set to `false`.

### `xalign`

`number` · default `0.500000`

The horizontal alignment of the child.

### `yalign`

`number` · default `0.500000`

The vertical alignment of the child.

## Methods

Methods are called on the `Gtk.AspectFrame` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `getObeyChild`

```ts
getObeyChild(): boolean
```

Returns whether the child's size request should override
the set aspect ratio of the `GtkAspectFrame`.

**Returns** whether to obey the child's size request

### `getRatio`

```ts
getRatio(): number
```

Returns the desired aspect ratio of the child.

**Returns** the desired aspect ratio

### `getXalign`

```ts
getXalign(): number
```

Returns the horizontal alignment of the child within the
allocation of the `GtkAspectFrame`.

**Returns** the horizontal alignment

### `getYalign`

```ts
getYalign(): number
```

Returns the vertical alignment of the child within the
allocation of the `GtkAspectFrame`.

**Returns** the vertical alignment

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

### `setObeyChild`

```ts
setObeyChild(obeyChild: boolean): void
```

Sets whether the aspect ratio of the child's size
request should override the set aspect ratio of
the `GtkAspectFrame`.

**Parameters**

- `obeyChild`: If `true`, `ratio` is ignored, and the aspect ratio is taken from the requisition of the child.

### `setRatio`

```ts
setRatio(ratio: number): void
```

Sets the desired aspect ratio of the child.

**Parameters**

- `ratio`: aspect ratio of the child

### `setXalign`

```ts
setXalign(xalign: number): void
```

Sets the horizontal alignment of the child within the allocation
of the `GtkAspectFrame`.

**Parameters**

- `xalign`: horizontal alignment, from 0.0 (left aligned) to 1.0 (right aligned)

### `setYalign`

```ts
setYalign(yalign: number): void
```

Sets the vertical alignment of the child within the allocation
of the `GtkAspectFrame`.

**Parameters**

- `yalign`: horizontal alignment, from 0.0 (top aligned) to 1.0 (bottom aligned)
