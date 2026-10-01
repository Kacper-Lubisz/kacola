---
description: "Shows a row of buttons to switch between GtkStack pages."
---

# GtkStackSwitcher

Shows a row of buttons to switch between `GtkStack` pages.



It acts as a controller for the associated `GtkStack`.

All the content for the buttons comes from the properties of the stacks
`Gtk.StackPage` objects; the button visibility in a `GtkStackSwitcher`
widget is controlled by the visibility of the child in the `GtkStack`.

It is possible to associate multiple `GtkStackSwitcher` widgets
with the same `GtkStack` widget.

## CSS nodes

`GtkStackSwitcher` has a single CSS node named stackswitcher and
style class .stack-switcher.

When circumstances require it, `GtkStackSwitcher` adds the
.needs-attention style class to the widgets representing the
stack pages.

## Accessibility

`GtkStackSwitcher` uses the `Gtk.AccessibleRole.tab_list` role
and uses the `Gtk.AccessibleRole.tab` role for its buttons.

## Orientable

Since GTK 4.4, `GtkStackSwitcher` implements `GtkOrientable` allowing
the stack switcher to be made vertical with
`gtk_orientable_set_orientation()`.

```tsx
import { GtkStackSwitcher } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkStackSwitcher**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.StackSwitcher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `stack`

`Gtk.Stack | ReactElement`

The stack.

## Methods

Methods are called on the `Gtk.StackSwitcher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getStack`

```ts
getStack(): Gtk.Stack | null
```

Retrieves the stack.

**Returns** the stack

### `setStack`

```ts
setStack(stack: Gtk.Stack | null): void
```

Sets the stack to control.

**Parameters**

- `stack`: a `GtkStack`
