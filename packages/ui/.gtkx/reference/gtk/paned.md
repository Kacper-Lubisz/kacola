---
description: "Arranges its children in two panes, horizontally or vertically."
---

# GtkPaned

Arranges its children in two panes, horizontally or vertically.



The division between the two panes is adjustable by the user
by dragging a handle.

Child widgets are added to the panes of the widget with
`Gtk.Paned.setStartChild()` and `Gtk.Paned.setEndChild()`.
The division between the two children is set by default from the size
requests of the children, but it can be adjusted by the user.

A paned widget draws a separator between the two child widgets and a
small handle that the user can drag to adjust the division. It does not
draw any relief around the children or around the separator. (The space
in which the separator is called the gutter.) Often, it is useful to put
each child inside a `Gtk.Frame` so that the gutter appears as a
ridge. No separator is drawn if one of the children is missing.

Each child has two options that can be set, "resize" and "shrink". If
"resize" is true then, when the `GtkPaned` is resized, that child will
expand or shrink along with the paned widget. If "shrink" is true, then
that child can be made smaller than its requisition by the user.
Setting "shrink" to false allows the application to set a minimum size.
If "resize" is false for both children, then this is treated as if
"resize" is true for both children.

The application can set the position of the slider as if it were set
by the user, by calling `Gtk.Paned.setPosition()`.

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.Paned.accept-position`
- `Gtk.Paned.cancel-position`
- `Gtk.Paned.cycle-child-focus`
- `Gtk.Paned.cycle-handle-focus`
- `Gtk.Paned.move-handle`
- `Gtk.Paned.toggle-handle-focus`

## CSS nodes

```
paned
├── <child>
├── separator[.wide]
╰── <child>
```

`GtkPaned` has a main CSS node with name paned, and a subnode for
the separator with name separator. The subnode gets a .wide style
class when the paned is supposed to be wide.

In horizontal orientation, the nodes are arranged based on the text
direction, so in left-to-right mode, :first-child will select the
leftmost child, while it will select the rightmost child in
RTL layouts.

### Creating a paned widget with minimum sizes.

```c
GtkWidget *hpaned = gtk_paned_new (GTK_ORIENTATION_HORIZONTAL);
GtkWidget *frame1 = gtk_frame_new (NULL);
GtkWidget *frame2 = gtk_frame_new (NULL);

gtk_widget_set_size_request (hpaned, 200, -1);

gtk_paned_set_start_child (GTK_PANED (hpaned), frame1);
gtk_paned_set_resize_start_child (GTK_PANED (hpaned), TRUE);
gtk_paned_set_shrink_start_child (GTK_PANED (hpaned), FALSE);
gtk_widget_set_size_request (frame1, 50, -1);

gtk_paned_set_end_child (GTK_PANED (hpaned), frame2);
gtk_paned_set_resize_end_child (GTK_PANED (hpaned), FALSE);
gtk_paned_set_shrink_end_child (GTK_PANED (hpaned), FALSE);
gtk_widget_set_size_request (frame2, 50, -1);
```

```tsx
import { GtkPaned } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkPaned**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Paned` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `endChild`

`Gtk.Widget | ReactElement`

The second child.

### `maxPosition`

`number` · default `2147483647` · read-only, observe with `onNotifyMaxPosition`

The largest possible value for the `Gtk.Paned.position`
property.

This property is derived from the size and shrinkability
of the widget's children.

### `minPosition`

`number` · default `0` · read-only, observe with `onNotifyMinPosition`

The smallest possible value for the `Gtk.Paned.position`
property.

This property is derived from the size and shrinkability
of the widget's children.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `position`

`number` · default `0`

Position of the separator in pixels, from the left/top.

### `positionSet`

`boolean` · default `false`

Whether the `Gtk.Paned.position` property has been set.

### `resizeEndChild`

`boolean` · default `true`

Determines whether the second child expands and shrinks
along with the paned widget.

### `resizeStartChild`

`boolean` · default `true`

Determines whether the first child expands and shrinks
along with the paned widget.

### `shrinkEndChild`

`boolean` · default `true`

Determines whether the second child can be made smaller
than its requisition.

### `shrinkStartChild`

`boolean` · default `true`

Determines whether the first child can be made smaller
than its requisition.

### `startChild`

`Gtk.Widget | ReactElement`

The first child.

### `wideHandle`

`boolean` · default `false`

Whether the `GtkPaned` should provide a stronger visual separation.

For example, this could be set when a paned contains two
`Gtk.Notebook`s, whose tab rows would otherwise merge visually.

## Signals

### `onAcceptPosition`

```ts
(self: Gtk.Paned) => boolean | undefined
```

Emitted to accept the current position of the handle when
moving it using key bindings.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Return</kbd> or
<kbd>Space</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** whether the position was accepted

### `onCancelPosition`

```ts
(self: Gtk.Paned) => boolean | undefined
```

Emitted to cancel moving the position of the handle using key
bindings.

The position of the handle will be reset to the value prior to
moving it.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Escape</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** whether the position was canceled

### `onCycleChildFocus`

```ts
(reversed: boolean, self: Gtk.Paned) => boolean | undefined
```

Emitted to cycle the focus between the children of the paned.

This is a [keybinding signal](class.SignalAction.html).

The default binding is <kbd>F6</kbd>.

**Parameters**

- `reversed`: whether cycling backward or forward
- `self`: The instance the signal was emitted on.

**Returns** whether the behavior was cycled

### `onCycleHandleFocus`

```ts
(reversed: boolean, self: Gtk.Paned) => boolean | undefined
```

Emitted to cycle whether the paned should grab focus to allow
the user to change position of the handle by using key bindings.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>F8</kbd>.

**Parameters**

- `reversed`: whether cycling backward or forward
- `self`: The instance the signal was emitted on.

**Returns** whether the behavior was cycled

### `onMoveHandle`

```ts
(scrollType: Gtk.ScrollType, self: Gtk.Paned) => boolean | undefined
```

Emitted to move the handle with key bindings.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>←</kbd>, <kbd>←</kbd>,
<kbd>Ctrl</kbd>+<kbd>→</kbd>, <kbd>→</kbd>,
<kbd>Ctrl</kbd>+<kbd>↑</kbd>, <kbd>↑</kbd>,
<kbd>Ctrl</kbd>+<kbd>↓</kbd>, <kbd>↓</kbd>,
<kbd>PgUp</kbd>, <kbd>PgDn</kbd>, <kbd>Home</kbd>, <kbd>End</kbd>.

**Parameters**

- `scrollType`: a `GtkScrollType`
- `self`: The instance the signal was emitted on.

**Returns** whether the handle was moved

### `onToggleHandleFocus`

```ts
(self: Gtk.Paned) => boolean | undefined
```

Emitted to accept the current position of the handle and then
move focus to the next widget in the focus chain.

This is a [keybinding signal](class.SignalAction.html).

The default binding is <kbd>Tab</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** whether handle focus was toggled

## Methods

Methods are called on the `Gtk.Paned` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEndChild`

```ts
getEndChild(): Gtk.Widget | null
```

Retrieves the end child of the given `GtkPaned`.

**Returns** the end child widget

### `getPosition`

```ts
getPosition(): number
```

Obtains the position of the divider between the two panes.

**Returns** the position of the divider, in pixels

### `getResizeEndChild`

```ts
getResizeEndChild(): boolean
```

Returns whether the `Gtk.Paned.endChild` can be resized.

**Returns** true if the end child is resizable

### `getResizeStartChild`

```ts
getResizeStartChild(): boolean
```

Returns whether the `Gtk.Paned.startChild` can be resized.

**Returns** true if the start child is resizable

### `getShrinkEndChild`

```ts
getShrinkEndChild(): boolean
```

Returns whether the `Gtk.Paned.endChild` can shrink.

**Returns** true if the end child is shrinkable

### `getShrinkStartChild`

```ts
getShrinkStartChild(): boolean
```

Returns whether the `Gtk.Paned.startChild` can shrink.

**Returns** true if the start child is shrinkable

### `getStartChild`

```ts
getStartChild(): Gtk.Widget | null
```

Retrieves the start child of the given `GtkPaned`.

**Returns** the start child widget

### `getWideHandle`

```ts
getWideHandle(): boolean
```

Gets whether the separator should be wide.

**Returns** `true` if the paned should have a wide handle

### `setEndChild`

```ts
setEndChild(child: Gtk.Widget | null): void
```

Sets the end child of `paned` to `child`.

If `child` is `NULL`, the existing child will be removed.

**Parameters**

- `child`: the widget to add

### `setPosition`

```ts
setPosition(position: number): void
```

Sets the position of the divider between the two panes.

**Parameters**

- `position`: pixel position of divider, a negative value means that the position is unset

### `setResizeEndChild`

```ts
setResizeEndChild(resize: boolean): void
```

Sets whether the `Gtk.Paned.endChild` can be resized.

**Parameters**

- `resize`: true to let the end child be resized

### `setResizeStartChild`

```ts
setResizeStartChild(resize: boolean): void
```

Sets whether the `Gtk.Paned.startChild` can be resized.

**Parameters**

- `resize`: true to let the start child be resized

### `setShrinkEndChild`

```ts
setShrinkEndChild(resize: boolean): void
```

Sets whether the `Gtk.Paned.endChild` can shrink.

**Parameters**

- `resize`: true to let the end child be shrunk

### `setShrinkStartChild`

```ts
setShrinkStartChild(resize: boolean): void
```

Sets whether the `Gtk.Paned.startChild` can shrink.

**Parameters**

- `resize`: true to let the start child be shrunk

### `setStartChild`

```ts
setStartChild(child: Gtk.Widget | null): void
```

Sets the start child of `paned` to `child`.

If `child` is `NULL`, the existing child will be removed.

**Parameters**

- `child`: the widget to add

### `setWideHandle`

```ts
setWideHandle(wide: boolean): void
```

Sets whether the separator should be wide.

**Parameters**

- `wide`: the new value for the `Gtk.Paned.wideHandle` property
