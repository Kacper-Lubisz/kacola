---
description: "GtkLayoutChild subclass for children in a GtkFixedLayout."
---

# GtkFixedLayoutChild

`GtkLayoutChild` subclass for children in a `GtkFixedLayout`.

```tsx
import { GtkFixedLayoutChild } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutChild](.gtkx/reference/gtk/layout-child.md) → **GtkFixedLayoutChild**

## Props

`ref` receives the `Gtk.FixedLayoutChild` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `transform`

`Gsk.Transform`

The transform of the child.

## Methods

Methods are called on the `Gtk.FixedLayoutChild` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getTransform`

```ts
getTransform(): Gsk.Transform | null
```

Retrieves the transformation of the child.

**Returns** a `GskTransform`

### `setTransform`

```ts
setTransform(transform: Gsk.Transform | null): void
```

Sets the transformation of the child of a `GtkFixedLayout`.

**Parameters**

- `transform`: a `GskTransform`
