---
description: "The GtkColorButton allows to open a color chooser dialog to change the color."
---

# GtkColorButton

The `GtkColorButton` allows to open a color chooser dialog to change
the color.



It is suitable widget for selecting a color in a preference dialog.

## CSS nodes

```
colorbutton
╰── button.color
    ╰── [content]
```

`GtkColorButton` has a single CSS node with name colorbutton which
contains a button node. To differentiate it from a plain `GtkButton`,
it gets the .color style class.

> **Deprecated since 4.10.** Use `Gtk.ColorDialogButton` instead

```tsx
import { GtkColorButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkColorButton**

Implements `GtkAccessible`, `GtkBuildable`, `GtkColorChooser`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ColorButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `modal`

`boolean` · default `true`

Whether the color chooser dialog should be modal.

### `rgba`

`Gdk.RGBA` · deprecated since 4.10 · from `GtkColorChooser`

The currently selected color, as a `GdkRGBA` struct.

The property can be set to change the current selection
programmatically.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

### `showEditor`

`boolean` · default `false`

Whether the color chooser should open in editor mode.

This property should be used in cases where the palette
in the editor would be redundant, such as when the color
button is already part of a palette.

### `title`

`string` · default `Pick a Color`

The title of the color chooser dialog

### `useAlpha`

`boolean` · default `true` · deprecated since 4.10 · from `GtkColorChooser`

Whether colors may have alpha (translucency).

When ::use-alpha is `false`, the `GdkRGBA` struct obtained
via the `Gtk.ColorChooser.rgba` property will be
forced to have alpha == 1.

Implementations are expected to show alpha by rendering the color
over a non-uniform background (like a checkerboard pattern).

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

## Signals

### `onActivate`

```ts
(self: Gtk.ColorButton) => void
```

Emitted to when the color button is activated.

The `::activate` signal on `GtkMenuButton` is an action signal and
emitting it causes the button to pop up its dialog.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.4._

### `onColorActivated`

```ts
(color: Gdk.RGBA, self: Gtk.ColorButton) => void
```

From `GtkColorChooser`.

Emitted when a color is activated from the color chooser.

This usually happens when the user clicks a color swatch,
or a color is selected and the user presses one of the keys
Space, Shift+Space, Return or Enter.

**Parameters**

- `color`: the color
- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.ColorDialog` and `Gtk.ColorDialogButton` instead of widgets implementing `GtkColorChooser`

### `onColorSet`

```ts
(self: Gtk.ColorButton) => void
```

Emitted when the user selects a color.

When handling this signal, use `Gtk.ColorChooser.getRgba()`
to find out which color was just selected.

Note that this signal is only emitted when the user changes the color.
If you need to react to programmatic color changes as well, use
the notify::rgba signal.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ColorButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getModal`

```ts
getModal(): boolean
```

Gets whether the dialog is modal.

**Returns** `true` if the dialog is modal

> **Deprecated since 4.10.** Use `Gtk.ColorDialogButton` instead

### `getTitle`

```ts
getTitle(): string
```

Gets the title of the color chooser dialog.

**Returns** An internal string, do not free the return value

> **Deprecated since 4.10.** Use `Gtk.ColorDialogButton` instead

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the dialog should be modal.

**Parameters**

- `modal`: `true` to make the dialog modal

> **Deprecated since 4.10.** Use `Gtk.ColorDialogButton` instead

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title for the color chooser dialog.

**Parameters**

- `title`: String containing new window title

> **Deprecated since 4.10.** Use `Gtk.ColorDialogButton` instead
