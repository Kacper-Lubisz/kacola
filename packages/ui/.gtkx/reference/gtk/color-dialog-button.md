---
description: "Opens a color chooser dialog to select a color."
---

# GtkColorDialogButton

Opens a color chooser dialog to select a color.



It is suitable widget for selecting a color in a preference dialog.

## CSS nodes

```
colorbutton
╰── button.color
    ╰── [content]
```

`GtkColorDialogButton` has a single CSS node with name colorbutton which
contains a button node. To differentiate it from a plain `GtkButton`,
it gets the .color style class.

_Available since 4.10._

```tsx
import { GtkColorDialogButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkColorDialogButton**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ColorDialogButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `dialog`

`Gtk.ColorDialog | ReactElement`

The `GtkColorDialog` that contains parameters for
the color chooser dialog.

_Available since 4.10._

### `rgba`

`Gdk.RGBA`

The selected color.

This property can be set to give the button its initial
color, and it will be updated to reflect the users choice
in the color chooser dialog.

Listen to `notify::rgba` to get informed about changes
to the buttons color.

_Available since 4.10._

## Signals

### `onActivate`

```ts
(self: Gtk.ColorDialogButton) => void
```

Emitted when the color dialog button is activated.

The `::activate` signal on `GtkColorDialogButton` is an action signal
and emitting it causes the button to pop up its dialog.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.14._

## Methods

Methods are called on the `Gtk.ColorDialogButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDialog`

```ts
getDialog(): Gtk.ColorDialog | null
```

Returns the `GtkColorDialog` of `self`.

**Returns** the `GtkColorDialog`

_Available since 4.10._

### `getRgba`

```ts
getRgba(): Gdk.RGBA
```

Returns the color of the button.

This function is what should be used to obtain
the color that was chosen by the user. To get
informed about changes, listen to "notify::rgba".

**Returns** the color

_Available since 4.10._

### `setDialog`

```ts
setDialog(dialog: Gtk.ColorDialog): void
```

Sets a `GtkColorDialog` object to use for
creating the color chooser dialog that is
presented when the user clicks the button.

**Parameters**

- `dialog`: the new `GtkColorDialog`

_Available since 4.10._

### `setRgba`

```ts
setRgba(color: Gdk.RGBA): void
```

Sets the color of the button.

**Parameters**

- `color`: the new color

_Available since 4.10._
