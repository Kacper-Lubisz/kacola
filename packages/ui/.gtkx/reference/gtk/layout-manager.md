---
description: "Handles the preferred size and allocation for children of a widget."
---

# GtkLayoutManager

Handles the preferred size and allocation for children of a widget.

You typically subclass `GtkLayoutManager` if you want to implement a
layout policy for the children of a widget, or if you want to determine
the size of a widget depending on its contents.

Each `GtkWidget` can only have a `GtkLayoutManager` instance associated
to it at any given time; it is possible, though, to replace the layout
manager instance using `Gtk.Widget.setLayoutManager()`.

### Layout properties

A layout manager can expose properties for controlling the layout of
each child, by creating an object type derived from `Gtk.LayoutChild`
and installing the properties on it as normal `GObject` properties.

Each `GtkLayoutChild` instance storing the layout properties for a
specific child is created through the `Gtk.LayoutManager.getLayoutChild()`
method; a `GtkLayoutManager` controls the creation of its `GtkLayoutChild`
instances by overriding the GtkLayoutManagerClass.`create_layout_child()`
virtual function. The typical implementation should look like:

```c
static GtkLayoutChild *
create_layout_child (GtkLayoutManager *manager,
                     GtkWidget        *container,
                     GtkWidget        *child)
{
  return g_object_new (your_layout_child_get_type (),
                       "layout-manager", manager,
                       "child-widget", child,
                       NULL);
}
```

The `Gtk.LayoutChild.layoutManager` and
`Gtk.LayoutChild.childWidget` properties
on the newly created `GtkLayoutChild` instance are mandatory. The
`GtkLayoutManager` will cache the newly created `GtkLayoutChild` instance
until the widget is removed from its parent, or the parent removes the
layout manager.

Each `GtkLayoutManager` instance creating a `GtkLayoutChild` should use
`Gtk.LayoutManager.getLayoutChild()` every time it needs to query
the layout properties; each `GtkLayoutChild` instance should call
`Gtk.LayoutManager.layoutChanged()` every time a property is
updated, in order to queue a new size measuring and allocation.

```tsx
import { GtkLayoutManager } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkLayoutManager**

## Props

`ref` receives the `Gtk.LayoutManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.LayoutManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `allocate`

```ts
allocate(widget: Gtk.Widget, width: number, height: number, baseline: number): void
```

Assigns the given `width`, `height`, and `baseline` to
a `widget`, and computes the position and sizes of the children of
the `widget` using the layout management policy of `manager`.

**Parameters**

- `widget`: the `GtkWidget` using `manager`
- `width`: the new width of the `widget`
- `height`: the new height of the `widget`
- `baseline`: the baseline position of the `widget`, or -1

### `getLayoutChild`

```ts
getLayoutChild(child: Gtk.Widget): Gtk.LayoutChild
```

Retrieves a `GtkLayoutChild` instance for the `GtkLayoutManager`,
creating one if necessary.

The `child` widget must be a child of the widget using `manager`.

The `GtkLayoutChild` instance is owned by the `GtkLayoutManager`,
and is guaranteed to exist as long as `child` is a child of the
`GtkWidget` using the given `GtkLayoutManager`.

**Parameters**

- `child`: a `GtkWidget`

**Returns** a `GtkLayoutChild`

### `getRequestMode`

```ts
getRequestMode(): Gtk.SizeRequestMode
```

Retrieves the request mode of `manager`.

**Returns** a `GtkSizeRequestMode`

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Retrieves the `GtkWidget` using the given `GtkLayoutManager`.

**Returns** a `GtkWidget`

### `layoutChanged`

```ts
layoutChanged(): void
```

Queues a resize on the `GtkWidget` using `manager`, if any.

This function should be called by subclasses of `GtkLayoutManager`
in response to changes to their layout management policies.

### `measure`

```ts
measure(widget: Gtk.Widget, orientation: Gtk.Orientation, forSize: number): [number, number, number, number]
```

Measures the size of the `widget` using `manager`, for the
given `orientation` and size.

See the `Gtk.Widget` documentation on layout management for
more details.

**Parameters**

- `widget`: the `GtkWidget` using `manager`
- `orientation`: the orientation to measure
- `forSize`: Size for the opposite of `orientation`; for instance, if the `orientation` is `GTK_ORIENTATION_HORIZONTAL`, this is the height of the widget; if the `orientation` is `GTK_ORIENTATION_VERTICAL`, this is the width of the widget. This allows to measure the height for the given width, and the width for the given height. Use -1 if the size is not known

**Returns** Tuple of:

- `minimum`: the minimum size for the given size and orientation
- `natural`: the natural, or preferred size for the given size and orientation
- `minimumBaseline`: the baseline position for the minimum size
- `naturalBaseline`: the baseline position for the natural size
