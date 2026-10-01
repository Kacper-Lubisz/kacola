---
description: "Uses a sidebar to switch between GtkStack pages."
---

# GtkStackSidebar

Uses a sidebar to switch between `GtkStack` pages.



In order to use a `GtkStackSidebar`, you simply use a `GtkStack` to
organize your UI flow, and add the sidebar to your sidebar area. You
can use `Gtk.StackSidebar.setStack()` to connect the `GtkStackSidebar`
to the `GtkStack`.

## CSS nodes

`GtkStackSidebar` has a single CSS node with name stacksidebar and
style class .sidebar.

When circumstances require it, `GtkStackSidebar` adds the
.needs-attention style class to the widgets representing the stack
pages.

```tsx
import { GtkStackSidebar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkStackSidebar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.StackSidebar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `stack`

`Gtk.Stack | ReactElement`

The stack.

## Methods

Methods are called on the `Gtk.StackSidebar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getStack`

```ts
getStack(): Gtk.Stack | null
```

Retrieves the stack.

**Returns** the associated `GtkStack` or
  `null` if none has been set explicitly

### `setStack`

```ts
setStack(stack: Gtk.Stack): void
```

Set the `GtkStack` associated with this `GtkStackSidebar`.

The sidebar widget will automatically update according to
the order and items within the given `GtkStack`.

**Parameters**

- `stack`: a `GtkStack`
