---
description: "The base class for objects that are meant to hold layout properties."
---

# GtkLayoutChild

The base class for objects that are meant to hold layout properties.

If a `GtkLayoutManager` has per-child properties, like their packing type,
or the horizontal and vertical span, or the icon name, then the layout
manager should use a `GtkLayoutChild` implementation to store those properties.

A `GtkLayoutChild` instance is only ever valid while a widget is part
of a layout.

```tsx
import { GtkLayoutChild } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkLayoutChild**

## Props

`ref` receives the `Gtk.LayoutChild` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `childWidget`

`Gtk.Widget` · construct-only

The widget that is associated to the `GtkLayoutChild` instance.

### `layoutManager`

`Gtk.LayoutManager` · construct-only

The layout manager that created the `GtkLayoutChild` instance.

## Methods

Methods are called on the `Gtk.LayoutChild` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChildWidget`

```ts
getChildWidget(): Gtk.Widget
```

Retrieves the `GtkWidget` associated to the given `layout_child`.

**Returns** a `GtkWidget`

### `getLayoutManager`

```ts
getLayoutManager(): Gtk.LayoutManager
```

Retrieves the `GtkLayoutManager` instance that created the
given `layout_child`.

**Returns** a `GtkLayoutManager`
