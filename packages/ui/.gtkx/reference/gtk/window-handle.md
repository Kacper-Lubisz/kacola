---
description: "Implements titlebar functionality for a window."
---

# GtkWindowHandle

Implements titlebar functionality for a window.

When added into a window, it can be dragged to move the window,
and it implements the right click, double click and middle click
behaviors that are expected of a titlebar.

## CSS nodes

`GtkWindowHandle` has a single CSS node with the name `windowhandle`.

## Accessibility

Until GTK 4.10, `GtkWindowHandle` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkWindowHandle` uses the `Gtk.AccessibleRole.generic`
role.

```tsx
import { GtkWindowHandle } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkWindowHandle**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.WindowHandle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Methods

Methods are called on the `Gtk.WindowHandle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget
