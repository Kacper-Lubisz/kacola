---
description: "Presents a bubble-like popup."
---

# GtkPopover

Presents a bubble-like popup.



It is primarily meant to provide context-dependent information
or options. Popovers are attached to a parent widget. The parent widget
must support popover children, as `Gtk.MenuButton` and
`Gtk.PopoverMenuBar` do. If you want to make a custom widget that
has an attached popover, you need to call `Gtk.Popover.present()`
in your `Gtk.Widget.sizeAllocate()` vfunc, in order to update the
positioning of the popover.

The position of a popover relative to the widget it is attached to
can also be changed with `Gtk.Popover.setPosition()`. By default,
it points to the whole widget area, but it can be made to point to
a specific area using `Gtk.Popover.setPointingTo()`.

By default, `GtkPopover` performs a grab, in order to ensure input
events get redirected to it while it is shown, and also so the popover
is dismissed in the expected situations (clicks outside the popover,
or the Escape key being pressed). If no such modal behavior is desired
on a popover, `Gtk.Popover.setAutohide()` may be called on it to
tweak its behavior.

### GtkPopover as menu replacement

`GtkPopover` is often used to replace menus. The best way to do this
is to use the `Gtk.PopoverMenu` subclass which supports being
populated from a `GMenuModel` with `Gtk.PopoverMenu.newFromModel()`.

```xml
<section>
  <attribute name="display-hint">horizontal-buttons</attribute>
  <item>
    <attribute name="label">Cut</attribute>
    <attribute name="action">app.cut</attribute>
    <attribute name="verb-icon">edit-cut-symbolic</attribute>
  </item>
  <item>
    <attribute name="label">Copy</attribute>
    <attribute name="action">app.copy</attribute>
    <attribute name="verb-icon">edit-copy-symbolic</attribute>
  </item>
  <item>
    <attribute name="label">Paste</attribute>
    <attribute name="action">app.paste</attribute>
    <attribute name="verb-icon">edit-paste-symbolic</attribute>
  </item>
</section>
```

## Shortcuts and Gestures

`GtkPopover` supports the following keyboard shortcuts:

- <kbd>Escape</kbd> closes the popover.
- <kbd>Alt</kbd> makes the mnemonics visible.

The following signals have default keybindings:

- `Gtk.Popover.activate-default`

## CSS nodes

```
popover.background[.menu]
├── arrow
╰── contents
    ╰── <child>
```

`GtkPopover` has a main node with name `popover`, an arrow with name `arrow`,
and another node for the content named `contents`. The `popover` node always
gets the `.background` style class. It also gets the `.menu` style class
if the popover is menu-like, e.g. is a `Gtk.PopoverMenu`.

Particular uses of `GtkPopover`, such as touch selection popups or
magnifiers in `GtkEntry` or `GtkTextView` get style classes like
`.touch-selection` or `.magnifier` to differentiate from plain popovers.

When styling a popover directly, the `popover` node should usually
not have any background. The visible part of the popover can have
a shadow. To specify it in CSS, set the box-shadow of the `contents` node.

Note that, in order to accomplish appropriate arrow visuals, `GtkPopover`
uses custom drawing for the `arrow` node. This makes it possible for the
arrow to change its shape dynamically, but it also limits the possibilities
of styling it using CSS. In particular, the `arrow` gets drawn over the
`content` node's border and shadow, so they look like one shape, which
means that the border width of the `content` node and the `arrow` node should
be the same. The arrow also does not support any border shape other than
solid, no border-radius, only one border width (border-bottom-width is
used) and no box-shadow.

```tsx
import { GtkPopover } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPopover**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.Popover` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `autohide`

`boolean` · default `true`

Whether to dismiss the popover on outside clicks.

### `cascadePopdown`

`boolean` · default `false`

Whether the popover pops down after a child popover.

This is used to implement the expected behavior of submenus.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `defaultWidget`

`Gtk.Widget | ReactElement`

The default widget inside the popover.

### `hasArrow`

`boolean` · default `true`

Whether to draw an arrow.

### `mnemonicsVisible`

`boolean` · default `false`

Whether mnemonics are currently visible in this popover.

### `pointingTo`

`Gdk.Rectangle`

Rectangle in the parent widget that the popover points to.

### `position`

`Gtk.PositionType` · default `GTK_POS_BOTTOM`

How to place the popover, relative to its parent.

## Signals

### `onActivateDefault`

```ts
(self: Gtk.Popover) => void
```

Emitted whend the user activates the default widget.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Enter</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onClosed`

```ts
(self: Gtk.Popover) => void
```

Emitted when the popover is closed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Popover` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAutohide`

```ts
getAutohide(): boolean
```

Returns whether the popover is modal.

See `Gtk.Popover.setAutohide()` for the
implications of this.

**Returns** `true` if `popover` is modal

### `getCascadePopdown`

```ts
getCascadePopdown(): boolean
```

Returns whether the popover will close after a modal child is closed.

**Returns** `true` if `popover` will close after a modal child.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `popover`.

**Returns** the child widget of `popover`

### `getHasArrow`

```ts
getHasArrow(): boolean
```

Gets whether this popover is showing an arrow
pointing at the widget that it is relative to.

**Returns** whether the popover has an arrow

### `getMnemonicsVisible`

```ts
getMnemonicsVisible(): boolean
```

Gets whether mnemonics are visible.

**Returns** `true` if mnemonics are supposed to be visible
  in this popover

### `getOffset`

```ts
getOffset(): [number, number]
```

Gets the offset previous set with `Gtk.Popover.setOffset()`.

**Returns** Tuple of:

- `xOffset`: a location for the x_offset
- `yOffset`: a location for the y_offset

### `getPointingTo`

```ts
getPointingTo(): [boolean, Gdk.Rectangle]
```

Gets the rectangle that the popover points to.

If a rectangle to point to has been set, this function will
return `true` and fill in `rect` with such rectangle, otherwise
it will return `false` and fill in `rect` with the parent
widget coordinates.

**Returns** Tuple of:

- `result`: `true` if a rectangle to point to was set.
- `rect`: location to store the rectangle

### `getPosition`

```ts
getPosition(): Gtk.PositionType
```

Returns the preferred position of `popover`.

**Returns** The preferred position.

### `popdown`

```ts
popdown(): void
```

Pops `popover` down.

This may have the side-effect of closing a parent popover
as well. See `Gtk.Popover.cascadePopdown`.

### `popup`

```ts
popup(): void
```

Pops `popover` up.

### `present`

```ts
present(): void
```

Allocate a size for the `GtkPopover`.

This function needs to be called in size-allocate by widgets
who have a `GtkPopover` as child. When using a layout manager,
this is happening automatically.

To make a popover appear on screen, use `Gtk.Popover.popup()`.

### `setAutohide`

```ts
setAutohide(autohide: boolean): void
```

Sets whether `popover` is modal.

A modal popover will grab the keyboard focus on it when being
displayed. Focus will wrap around within the popover. Clicking
outside the popover area or pressing Esc will dismiss the popover.

Called this function on an already showing popup with a new
autohide value different from the current one, will cause the
popup to be hidden.

**Parameters**

- `autohide`: `true` to dismiss the popover on outside clicks

### `setCascadePopdown`

```ts
setCascadePopdown(cascadePopdown: boolean): void
```

If `cascade_popdown` is `true`, the popover will be
closed when a child modal popover is closed.

If `false`, `popover` will stay visible.

**Parameters**

- `cascadePopdown`: `true` if the popover should follow a child closing

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `popover`.

**Parameters**

- `child`: the child widget

### `setDefaultWidget`

```ts
setDefaultWidget(widget: Gtk.Widget | null): void
```

Sets the default widget of a `GtkPopover`.

The default widget is the widget that’s activated when the user
presses Enter in a dialog (for example). This function sets or
unsets the default widget for a `GtkPopover`.

**Parameters**

- `widget`: a child widget of `popover` to set as the default, or `null` to unset the default widget for the popover

### `setHasArrow`

```ts
setHasArrow(hasArrow: boolean): void
```

Sets whether this popover should draw an arrow
pointing at the widget it is relative to.

**Parameters**

- `hasArrow`: `true` to draw an arrow

### `setMnemonicsVisible`

```ts
setMnemonicsVisible(mnemonicsVisible: boolean): void
```

Sets whether mnemonics should be visible.

**Parameters**

- `mnemonicsVisible`: the new value

### `setOffset`

```ts
setOffset(xOffset: number, yOffset: number): void
```

Sets the offset to use when calculating the position
of the popover.

These values are used when preparing the `Gdk.PopupLayout`
for positioning the popover.

**Parameters**

- `xOffset`: the x offset to adjust the position by
- `yOffset`: the y offset to adjust the position by

### `setPointingTo`

```ts
setPointingTo(rect: Gdk.Rectangle | null): void
```

Sets the rectangle that `popover` points to.

This is in the coordinate space of the `popover` parent.

**Parameters**

- `rect`: rectangle to point to

### `setPosition`

```ts
setPosition(position: Gtk.PositionType): void
```

Sets the preferred position for `popover` to appear.

If the `popover` is currently visible, it will be immediately
updated.

This preference will be respected where possible, although
on lack of space (eg. if close to the window edges), the
`GtkPopover` may choose to appear on the opposite side.

**Parameters**

- `position`: preferred popover position
