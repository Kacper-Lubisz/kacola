---
description: "GtkLayoutChild subclass for children in a GtkOverlayLayout."
---

# GtkOverlayLayoutChild

`GtkLayoutChild` subclass for children in a `GtkOverlayLayout`.

```tsx
import { GtkOverlayLayoutChild } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutChild](.gtkx/reference/gtk/layout-child.md) → **GtkOverlayLayoutChild**

## Props

`ref` receives the `Gtk.OverlayLayoutChild` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `clipOverlay`

`boolean` · default `false`

Whether the child should be clipped to fit the parent's size.

### `measure`

`boolean` · default `false`

Whether the child size should contribute to the `GtkOverlayLayout`'s
measurement.

## Methods

Methods are called on the `Gtk.OverlayLayoutChild` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getClipOverlay`

```ts
getClipOverlay(): boolean
```

Retrieves whether the child is clipped.

**Returns** whether the child is clipped

### `getMeasure`

```ts
getMeasure(): boolean
```

Retrieves whether the child is measured.

**Returns** whether the child is measured

### `setClipOverlay`

```ts
setClipOverlay(clipOverlay: boolean): void
```

Sets whether to clip this child.

**Parameters**

- `clipOverlay`: whether to clip this child

### `setMeasure`

```ts
setMeasure(measure: boolean): void
```

Sets whether to measure this child.

**Parameters**

- `measure`: whether to measure this child
