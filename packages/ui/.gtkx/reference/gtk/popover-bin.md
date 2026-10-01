---
description: "A single child container with a popover."
---

# GtkPopoverBin

A single child container with a popover.

You should use `GtkPopoverBin` whenever you need to present a `Gtk.Popover`
to the user.

### Actions

`GtkPopoverBin` defines the `menu.popup` action, which can be activated
to present the popover to the user.

### CSS nodes

`GtkPopoverBin` has a single CSS node with the name `popoverbin`.

_Available since 4.22._

```tsx
import { GtkPopoverBin } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPopoverBin**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.PopoverBin` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `handleInput`

`boolean` · default `false`

Whether the popover bin will handle input
to trigger the popup.

_Available since 4.22._

### `menuModel`

`Gio.MenuModel | ReactElement`

The `GMenuModel` from which the popup will be created.

See `Gtk.PopoverBin.setMenuModel()` for the interaction
with the `Gtk.PopoverBin.popover` property.

_Available since 4.22._

### `popover`

`Gtk.Popover | ReactElement`

The `GtkPopover` that will be popped up when calling
`Gtk.PopoverBin.popup()`.

_Available since 4.22._

## Methods

Methods are called on the `Gtk.PopoverBin` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Retrieves the child widget of the popover bin.

**Returns** the child widget

_Available since 4.22._

### `getHandleInput`

```ts
getHandleInput(): boolean
```

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Retrieves the menu model set using `Gtk.PopoverBin.setMenuModel()`.

**Returns** the menu model for the popover

_Available since 4.22._

### `getPopover`

```ts
getPopover(): Gtk.Popover | null
```

Retrieves the `GtkPopover` set using `Gtk.PopoverBin.setPopover()`.

**Returns** a popover widget

_Available since 4.22._

### `popdown`

```ts
popdown(): void
```

Hides the popover from the user.

See: `Gtk.PopoverBin.popup()`

_Available since 4.22._

### `popup`

```ts
popup(): void
```

Presents the popover to the user.

Use `Gtk.PopoverBin.setPopover()` or
`Gtk.PopoverBin.setMenuModel()` to define the popover.

See: `Gtk.PopoverBin.popdown()`

_Available since 4.22._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child of the popover bin.

**Parameters**

- `child`: the child of the popover bin

_Available since 4.22._

### `setHandleInput`

```ts
setHandleInput(handleInput: boolean): void
```

Enables or disables input handling.

If enabled, the popover bin will pop up the
popover on right-click or long press, as expected
for a context menu.

**Parameters**

- `handleInput`: whether to handle input

_Available since 4.22._

### `setMenuModel`

```ts
setMenuModel(model: Gio.MenuModel | null): void
```

Sets the menu model used to create the popover that will be
presented when calling `Gtk.PopoverBin.popup()`.

If `model` is `NULL`, the popover will be unset.

A `Gtk.Popover` will be created from the menu model with
`Gtk.PopoverMenu.newFromModel()`. Actions will be connected
as documented for this function.

If `Gtk.PopoverBin.popover` is already set, it will be
dissociated from the popover bin, and the property is set to `NULL`.

See: `Gtk.PopoverBin.setPopover()`

**Parameters**

- `model`: a menu model

_Available since 4.22._

### `setPopover`

```ts
setPopover(popover: Gtk.Popover | null): void
```

Sets the `GtkPopover` that will be presented when calling
`Gtk.PopoverBin.popup()`.

If `popover` is `NULL`, the popover will be unset.

If `Gtk.PopoverBin.menuModel` is set before calling
this function, then the menu model property will be unset.

See: `Gtk.PopoverBin.setMenuModel()`

**Parameters**

- `popover`: a `GtkPopover`

_Available since 4.22._
