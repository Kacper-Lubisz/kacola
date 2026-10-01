---
description: "Displays a popup when clicked."
---

# GtkMenuButton

Displays a popup when clicked.



This popup can be provided either as a `GtkPopover` or as an abstract
`GMenuModel`.

The `GtkMenuButton` widget can show either an icon (set with the
`Gtk.MenuButton.iconName` property) or a label (set with the
`Gtk.MenuButton.label` property). If neither is explicitly set,
a `Gtk.Image` is automatically created, using an arrow image oriented
according to `Gtk.MenuButton.direction` or the generic
“open-menu-symbolic” icon if the direction is not set.

The positioning of the popup is determined by the
`Gtk.MenuButton.direction` property of the menu button.

For menus, the `Gtk.Widget.halign` and `Gtk.Widget.valign`
properties of the menu are also taken into account. For example, when the
direction is `GTK_ARROW_DOWN` and the horizontal alignment is `GTK_ALIGN_START`,
the menu will be positioned below the button, with the starting edge
(depending on the text direction) of the menu aligned with the starting
edge of the button. If there is not enough space below the button, the
menu is popped up above the button instead. If the alignment would move
part of the menu offscreen, it is “pushed in”.

|           | start                | center                | end                |
| -         | ---                  | ---                   | ---                |
| **down**  | ![](down-start.png)  | ![](down-center.png)  | ![](down-end.png)  |
| **up**    | ![](up-start.png)    | ![](up-center.png)    | ![](up-end.png)    |
| **left**  | ![](left-start.png)  | ![](left-center.png)  | ![](left-end.png)  |
| **right** | ![](right-start.png) | ![](right-center.png) | ![](right-end.png) |

## CSS nodes

```
menubutton
╰── button.toggle
    ╰── <content>
         ╰── [arrow]
```

`GtkMenuButton` has a single CSS node with name `menubutton`
which contains a `button` node with a `.toggle` style class.

If the button contains an icon, it will have the `.image-button` style class,
if it contains text, it will have `.text-button` style class. If an arrow is
visible in addition to an icon, text or a custom child, it will also have
`.arrow-button` style class.

Inside the toggle button content, there is an `arrow` node for
the indicator, which will carry one of the `.none`, `.up`, `.down`,
`.left` or `.right` style classes to indicate the direction that
the menu will appear in. The CSS is expected to provide a suitable
image for each of these cases using the `-gtk-icon-source` property.

Optionally, the `menubutton` node can carry the `.circular` style class
to request a round appearance.

## Accessibility

`GtkMenuButton` uses the `Gtk.AccessibleRole.button` role.

```tsx
import { GtkMenuButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkMenuButton**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.MenuButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false`

Whether the menu button is active.

_Available since 4.10._

### `alwaysShowArrow`

`boolean` · default `false`

Whether to show a dropdown arrow even when using an icon or a custom child.

_Available since 4.4._

### `canShrink`

`boolean` · default `false`

Whether the size of the button can be made smaller than the natural
size of its contents.

_Available since 4.12._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `direction`

`Gtk.ArrowType` · default `GTK_ARROW_DOWN`

The `GtkArrowType` representing the direction in which the
menu or popover will be popped out.

### `hasFrame`

`boolean` · default `true`

Whether the button has a frame.

### `iconName`

`string` · default `null`

The name of the icon used to automatically populate the button.

### `label`

`string` · default `null`

The label for the button.

### `menuModel`

`Gio.MenuModel | ReactElement`

The `GMenuModel` from which the popup will be created.

See `Gtk.MenuButton.setMenuModel()` for the interaction
with the `Gtk.MenuButton.popover` property.

### `popover`

`Gtk.Popover | ReactElement`

The `GtkPopover` that will be popped up when the button is clicked.

### `primary`

`boolean` · default `false`

Whether the menu button acts as a primary menu.

Primary menus can be opened using the <kbd>F10</kbd> key

_Available since 4.4._

### `useUnderline`

`boolean` · default `false`

If set an underscore in the text indicates a mnemonic.

## Signals

### `onActivate`

```ts
(self: Gtk.MenuButton) => void
```

Emitted to when the menu button is activated.

The `::activate` signal on `GtkMenuButton` is an action signal and
emitting it causes the button to pop up its menu.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.4._

## Methods

Methods are called on the `Gtk.MenuButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Returns whether the menu button is active.

**Returns** TRUE if the button is active

_Available since 4.10._

### `getAlwaysShowArrow`

```ts
getAlwaysShowArrow(): boolean
```

Gets whether to show a dropdown arrow even when using an icon or a custom
child.

**Returns** whether to show a dropdown arrow even when using an icon or a custom
child.

_Available since 4.4._

### `getCanShrink`

```ts
getCanShrink(): boolean
```

Retrieves whether the button can be smaller than the natural
size of its contents.

**Returns** true if the button can shrink, and false otherwise

_Available since 4.12._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `menu_button`.

**Returns** the child widget of `menu_button`

_Available since 4.6._

### `getHasFrame`

```ts
getHasFrame(): boolean
```

Returns whether the button has a frame.

**Returns** `true` if the button has a frame

### `getIconName`

```ts
getIconName(): string | null
```

Gets the name of the icon shown in the button.

**Returns** the name of the icon shown in the button

### `getLabel`

```ts
getLabel(): string | null
```

Gets the label shown in the button

**Returns** the label shown in the button

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Returns the `GMenuModel` used to generate the popup.

**Returns** a `GMenuModel`

### `getPopover`

```ts
getPopover(): Gtk.Popover | null
```

Returns the `GtkPopover` that pops out of the button.

If the button is not using a `GtkPopover`, this function
returns `null`.

**Returns** a `GtkPopover` or `null`

### `getPrimary`

```ts
getPrimary(): boolean
```

Returns whether the menu button acts as a primary menu.

**Returns** `true` if the button is a primary menu

_Available since 4.4._

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Returns whether an embedded underline in the text indicates a
mnemonic.

**Returns** `true` whether an embedded underline in the text indicates
  the mnemonic accelerator keys.

### `menuButtonGetDirection`

```ts
menuButtonGetDirection(): Gtk.ArrowType
```

Returns the direction the popup will be pointing at when popped up.

**Returns** a `GtkArrowType` value

### `menuButtonSetDirection`

```ts
menuButtonSetDirection(direction: Gtk.ArrowType): void
```

Sets the direction in which the popup will be popped up.

If the button is automatically populated with an arrow icon,
its direction will be changed to match.

If the does not fit in the available space in the given direction,
GTK will its best to keep it inside the screen and fully visible.

If you pass `GTK_ARROW_NONE` for a `direction`, the popup will behave
as if you passed `GTK_ARROW_DOWN` (although you won’t see any arrows).

**Parameters**

- `direction`: a `GtkArrowType`

### `popdown`

```ts
popdown(): void
```

Dismiss the menu.

### `popup`

```ts
popup(): void
```

Pop up the menu.

### `setActive`

```ts
setActive(active: boolean): void
```

Sets whether the menu button is active.

**Parameters**

- `active`: whether the menu button is active

_Available since 4.10._

### `setAlwaysShowArrow`

```ts
setAlwaysShowArrow(alwaysShowArrow: boolean): void
```

Sets whether to show a dropdown arrow even when using an icon or a custom
child.

**Parameters**

- `alwaysShowArrow`: whether to show a dropdown arrow even when using an icon or a custom child

_Available since 4.4._

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

Sets whether the button size can be smaller than the natural size of
its contents.

For text buttons, setting `can_shrink` to true will ellipsize the label.

For icon buttons, this function has no effect.

**Parameters**

- `canShrink`: whether the button can shrink

_Available since 4.12._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `menu_button`.

Setting a child resets `Gtk.MenuButton.label` and
`Gtk.MenuButton.iconName`.

If `Gtk.MenuButton.alwaysShowArrow` is set to `TRUE` and
`Gtk.MenuButton.direction` is not `GTK_ARROW_NONE`, a dropdown arrow
will be shown next to the child.

**Parameters**

- `child`: the child widget

_Available since 4.6._

### `setCreatePopupFunc`

```ts
setCreatePopupFunc(func: Gtk.MenuButtonCreatePopupFunc | null): void
```

Sets `func` to be called when a popup is about to be shown.

`func` should use one of

 - `Gtk.MenuButton.setPopover()`
 - `Gtk.MenuButton.setMenuModel()`

to set a popup for `menu_button`.
If `func` is non-`null`, `menu_button` will always be sensitive.

Using this function will not reset the menu widget attached to
`menu_button`. Instead, this can be done manually in `func`.

**Parameters**

- `func`: function to call when a popup is about to be shown, but none has been provided via other means, or `null` to reset to default behavior

### `setHasFrame`

```ts
setHasFrame(hasFrame: boolean): void
```

Sets the style of the button.

**Parameters**

- `hasFrame`: whether the button should have a visible frame

### `setIconName`

```ts
setIconName(iconName: string): void
```

Sets the name of an icon to show inside the menu button.

Setting icon name resets `Gtk.MenuButton.label` and
`Gtk.MenuButton.child`.

If `Gtk.MenuButton.alwaysShowArrow` is set to `TRUE` and
`Gtk.MenuButton.direction` is not `GTK_ARROW_NONE`, a dropdown arrow
will be shown next to the icon.

**Parameters**

- `iconName`: the icon name

### `setLabel`

```ts
setLabel(label: string): void
```

Sets the label to show inside the menu button.

Setting a label resets `Gtk.MenuButton.iconName` and
`Gtk.MenuButton.child`.

If `Gtk.MenuButton.direction` is not `GTK_ARROW_NONE`, a dropdown
arrow will be shown next to the label.

**Parameters**

- `label`: the label

### `setMenuModel`

```ts
setMenuModel(menuModel: Gio.MenuModel | null): void
```

Sets the `GMenuModel` from which the popup will be constructed.

If `menu_model` is `null`, the button is disabled.

A `Gtk.Popover` will be created from the menu model with
`Gtk.PopoverMenu.newFromModel()`. Actions will be connected
as documented for this function.

If `Gtk.MenuButton.popover` is already set, it will be
dissociated from the `menu_button`, and the property is set to `null`.

**Parameters**

- `menuModel`: a `GMenuModel`, or `null` to unset and disable the button

### `setPopover`

```ts
setPopover(popover: Gtk.Popover | null): void
```

Sets the `GtkPopover` that will be popped up when the `menu_button` is clicked.

If `popover` is `null`, the button is disabled.

If `Gtk.MenuButton.menuModel` is set, the menu model is dissociated
from the `menu_button`, and the property is set to `null`.

**Parameters**

- `popover`: a `GtkPopover`, or `null` to unset and disable the button

### `setPrimary`

```ts
setPrimary(primary: boolean): void
```

Sets whether menu button acts as a primary menu.

Primary menus can be opened with the <kbd>F10</kbd> key.

**Parameters**

- `primary`: whether the menubutton should act as a primary menu

_Available since 4.4._

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

If true, an underline in the text indicates a mnemonic.

**Parameters**

- `useUnderline`: `true` if underlines in the text indicate mnemonics
