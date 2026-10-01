---
description: "A combined button and dropdown widget."
---

# AdwSplitButton

A combined button and dropdown widget.



`AdwSplitButton` is typically used to present a set of actions in a menu,
but allow access to one of them with a single click.

The API is very similar to `Gtk.Button` and `Gtk.MenuButton`, see
their documentation for details.

### CSS nodes

```
splitbutton[.image-button][.text-button]
├── button
│   ╰── <content>
├── separator
╰── menubutton
    ╰── button.toggle
        ╰── arrow
```

`AdwSplitButton`'s CSS node is called `splitbutton`. It contains the css
nodes: `button`, `separator`, `menubutton`. See `Gtk.MenuButton`
documentation for the `menubutton` contents.

The main CSS node will contain the `.image-button` or `.text-button` style
classes matching the button contents. The nested button nodes will never
contain them.

### Style classes

`AdwSplitButton` can use some of the same style classes as `Gtk.Button`:

- [`.suggested-action`](style-classes.html#suggested-action)
- [`.destructive-action`](style-classes.html#destructive-action)
- [`.flat`](style-classes.html#flat)
- [`.raised`](style-classes.html#raised)

Other style classes, like `.pill`, cannot be used.

### Accessibility

`AdwSplitButton` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwSplitButton } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwSplitButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.SplitButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `canShrink`

`boolean` · default `false`

Whether the button can be smaller than the natural size of its contents.

If set to `TRUE`, the label will ellipsize.

See `Gtk.Button.canShrink` and
`Gtk.MenuButton.canShrink`.

_Available since 1.4._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `direction`

`Gtk.ArrowType` · default `GTK_ARROW_DOWN`

The direction in which the popup will be popped up.

The dropdown arrow icon will point at the same direction.

If the does not fit in the available space in the given direction, GTK will
try its best to keep it inside the screen and fully visible.

`Gtk.ArrowType.none` behaves same as `Gtk.ArrowType.down`.

### `dropdownTooltip`

`string`

The tooltip of the dropdown button.

The tooltip can be marked up with the Pango text markup language.

_Available since 1.2._

### `iconName`

`string` · default `null`

The name of the icon used to automatically populate the button.

Setting the icon name will set `SplitButton.label` and
`SplitButton.child` to `NULL`.

### `label`

`string` · default `null`

The label for the button.

Setting the label will set `SplitButton.iconName` and
`SplitButton.child` to `NULL`.

### `menuModel`

`Gio.MenuModel | ReactElement`

The `GMenuModel` from which the popup will be created.

If the menu model is `NULL`, the dropdown is disabled.

A `Gtk.Popover` will be created from the menu model with
`Gtk.PopoverMenu.newFromModel()`. Actions will be connected as
documented for this function.

If `SplitButton.popover` is already set, it will be dissociated
from the button, and the property is set to `NULL`.

### `popover`

`Gtk.Popover | ReactElement`

The `GtkPopover` that will be popped up when the dropdown is clicked.

If the popover is `NULL`, the dropdown is disabled.

If `SplitButton.menuModel` is set, the menu model is dissociated
from the button, and the property is set to `NULL`.

### `useUnderline`

`boolean` · default `false`

Whether an underline in the text indicates a mnemonic.

See `SplitButton.label`.

## Signals

### `onActivate`

```ts
(self: Adw.SplitButton) => void
```

Emitted to animate press then release.

This is an action signal. Applications should never connect to this signal,
but use the `SplitButton.clicked` signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onClicked`

```ts
(self: Adw.SplitButton) => void
```

Emitted when the button has been activated (pressed and released).

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.SplitButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCanShrink`

```ts
getCanShrink(): boolean
```

gets whether the button can be smaller than the natural size of its contents.

**Returns** whether the button can shrink

_Available since 1.4._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget.

**Returns** the child widget

### `getDropdownTooltip`

```ts
getDropdownTooltip(): string
```

Gets the tooltip of the dropdown button of `self`.

**Returns** the dropdown tooltip of `self`

_Available since 1.2._

### `getIconName`

```ts
getIconName(): string | null
```

Gets the name of the icon used to automatically populate the button.

**Returns** the icon name

### `getLabel`

```ts
getLabel(): string | null
```

Gets the label for `self`.

**Returns** the label for `self`

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Gets the menu model from which the popup will be created.

**Returns** the menu model

### `getPopover`

```ts
getPopover(): Gtk.Popover | null
```

Gets the popover that will be popped up when the dropdown is clicked.

**Returns** the popover

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Gets whether an underline in the text indicates a mnemonic.

**Returns** whether an underline in the text indicates a mnemonic

### `popdown`

```ts
popdown(): void
```

Dismisses the menu.

### `popup`

```ts
popup(): void
```

Pops up the menu.

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

Sets whether the button can be smaller than the natural size of its contents.

If set to `TRUE`, the label will ellipsize.

See `Gtk.Button.setCanShrink()` and
`Gtk.MenuButton.setCanShrink()`.

**Parameters**

- `canShrink`: whether the button can shrink

_Available since 1.4._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget.

Setting the child widget will set `SplitButton.label` and
`SplitButton.iconName` to `NULL`.

**Parameters**

- `child`: the new child widget

### `setDropdownTooltip`

```ts
setDropdownTooltip(tooltip: string): void
```

Sets the tooltip of the dropdown button of `self`.

The tooltip can be marked up with the Pango text markup language.

**Parameters**

- `tooltip`: the dropdown tooltip of `self`

_Available since 1.2._

### `setIconName`

```ts
setIconName(iconName: string): void
```

Sets the name of the icon used to automatically populate the button.

Setting the icon name will set `SplitButton.label` and
`SplitButton.child` to `NULL`.

**Parameters**

- `iconName`: the icon name to set

### `setLabel`

```ts
setLabel(label: string): void
```

Sets the label for `self`.

Setting the label will set `SplitButton.iconName` and
`SplitButton.child` to `NULL`.

**Parameters**

- `label`: the label to set

### `setMenuModel`

```ts
setMenuModel(menuModel: Gio.MenuModel | null): void
```

Sets the menu model from which the popup will be created.

If the menu model is `NULL`, the dropdown is disabled.

A `Gtk.Popover` will be created from the menu model with
`Gtk.PopoverMenu.newFromModel()`. Actions will be connected as
documented for this function.

If `SplitButton.popover` is already set, it will be dissociated from
the button, and the property is set to `NULL`.

**Parameters**

- `menuModel`: the menu model

### `setPopover`

```ts
setPopover(popover: Gtk.Popover | null): void
```

Sets the popover that will be popped up when the dropdown is clicked.

If the popover is `NULL`, the dropdown is disabled.

If `SplitButton.menuModel` is set, the menu model is dissociated
from the button, and the property is set to `NULL`.

**Parameters**

- `popover`: the popover

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

Sets whether an underline in the text indicates a mnemonic.

See `SplitButton.label`.

**Parameters**

- `useUnderline`: whether an underline in the text indicates a mnemonic

### `splitButtonGetDirection`

```ts
splitButtonGetDirection(): Gtk.ArrowType
```

Gets the direction in which the popup will be popped up.

**Returns** the direction

### `splitButtonSetDirection`

```ts
splitButtonSetDirection(direction: Gtk.ArrowType): void
```

Sets the direction in which the popup will be popped up.

The dropdown arrow icon will point at the same direction.

If the does not fit in the available space in the given direction, GTK will
try its best to keep it inside the screen and fully visible.

`Gtk.ArrowType.none` behaves same as `Gtk.ArrowType.down`.

**Parameters**

- `direction`: the direction
