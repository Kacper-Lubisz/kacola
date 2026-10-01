---
description: "Renders a keyboard accelerator in a cell GtkCellRendererAccel displays a keyboard accelerator (i.e."
---

# GtkCellRendererAccel

Renders a keyboard accelerator in a cell

`GtkCellRendererAccel` displays a keyboard accelerator (i.e. a key
combination like `Control + a`). If the cell renderer is editable,
the accelerator can be changed by simply typing the new combination.

> **Deprecated since 4.10.** Applications editing keyboard accelerators should provide their own implementation according to platform design guidelines

```tsx
import { GtkCellRendererAccel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → [GtkCellRendererText](.gtkx/reference/gtk/cell-renderer-text.md) → **GtkCellRendererAccel**

## Props

`ref` receives the `Gtk.CellRendererAccel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelKey`

`number` · default `0`

The keyval of the accelerator.

### `accelMode`

`Gtk.CellRendererAccelMode` · default `GTK_CELL_RENDERER_ACCEL_MODE_GTK`

Determines if the edited accelerators are GTK accelerators. If
they are, consumed modifiers are suppressed, only accelerators
accepted by GTK are allowed, and the accelerators are rendered
in the same way as they are in menus.

### `accelMods`

`Gdk.ModifierType` · default `GDK_NO_MODIFIER_MASK`

The modifier mask of the accelerator.

### `keycode`

`number` · default `0`

The hardware keycode of the accelerator. Note that the hardware keycode is
only relevant if the key does not have a keyval. Normally, the keyboard
configuration should assign keyvals to all keys.

## Signals

### `onAccelCleared`

```ts
(pathString: string, self: Gtk.CellRendererAccel) => void
```

Gets emitted when the user has removed the accelerator.

**Parameters**

- `pathString`: the path identifying the row of the edited cell
- `self`: The instance the signal was emitted on.

### `onAccelEdited`

```ts
(pathString: string, accelKey: number, accelMods: Gdk.ModifierType, hardwareKeycode: number, self: Gtk.CellRendererAccel) => void
```

Gets emitted when the user has selected a new accelerator.

**Parameters**

- `pathString`: the path identifying the row of the edited cell
- `accelKey`: the new accelerator keyval
- `accelMods`: the new accelerator modifier mask
- `hardwareKeycode`: the keycode of the new accelerator
- `self`: The instance the signal was emitted on.
