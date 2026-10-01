---
description: "Presents a horizontal bar of items that pop up menus when clicked."
---

# GtkPopoverMenuBar

Presents a horizontal bar of items that pop up menus when clicked.



The only way to create instances of `GtkPopoverMenuBar` is
from a `GMenuModel`.

## CSS nodes

```
menubar
├── item[.active]
┊   ╰── popover
╰── item
    ╰── popover
```

`GtkPopoverMenuBar` has a single CSS node with name menubar, below which
each item has its CSS node, and below that the corresponding popover.

The item whose popover is currently open gets the .active
style class.

## Accessibility

`GtkPopoverMenuBar` uses the `Gtk.AccessibleRole.menu_bar` role,
the menu items use the `Gtk.AccessibleRole.menu_item` role and
the menus use the `Gtk.AccessibleRole.menu` role.

```tsx
import { GtkPopoverMenuBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPopoverMenuBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.PopoverMenuBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `menuModel`

`Gio.MenuModel | ReactElement`

The `GMenuModel` from which the menu bar is created.

The model should only contain submenus as toplevel elements.

## Methods

Methods are called on the `Gtk.PopoverMenuBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addChild`

```ts
addChild(child: Gtk.Widget, id: string): boolean
```

Adds a custom widget to a generated menubar.

For this to work, the menu model of `bar` must have an
item with a `custom` attribute that matches `id`.

**Parameters**

- `child`: the `GtkWidget` to add
- `id`: the ID to insert `child` at

**Returns** `true` if `id` was found and the widget added

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Returns the model from which the contents of `bar` are taken.

**Returns** a `GMenuModel`

### `removeChild`

```ts
removeChild(child: Gtk.Widget): boolean
```

Removes a widget that has previously been added with
`gtk_popover_menu_bar_add_child()`.

**Parameters**

- `child`: the `GtkWidget` to remove

**Returns** `true` if the widget was removed

### `setMenuModel`

```ts
setMenuModel(model: Gio.MenuModel | null): void
```

Sets a menu model from which `bar` should take
its contents.

**Parameters**

- `model`: a `GMenuModel`
