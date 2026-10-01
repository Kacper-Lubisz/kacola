---
description: "Renders a toggle button in a cell GtkCellRendererToggle renders a toggle button in a cell."
---

# GtkCellRendererToggle

Renders a toggle button in a cell

`GtkCellRendererToggle` renders a toggle button in a cell. The
button is drawn as a radio or a checkbutton, depending on the
`GtkCellRendererToggle:radio` property.
When activated, it emits the `GtkCellRendererToggle::toggled` signal.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.ToggleButton` instead

```tsx
import { GtkCellRendererToggle } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → **GtkCellRendererToggle**

## Props

`ref` receives the `Gtk.CellRendererToggle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatable`

`boolean` · default `true`

### `active`

`boolean` · default `false`

### `inconsistent`

`boolean` · default `false`

### `radio`

`boolean` · default `false`

## Signals

### `onToggled`

```ts
(path: string, self: Gtk.CellRendererToggle) => void
```

The ::toggled signal is emitted when the cell is toggled.

It is the responsibility of the application to update the model
with the correct value to store at `path`.  Often this is simply the
opposite of the value currently stored at `path`.

**Parameters**

- `path`: string representation of `GtkTreePath` describing the event location
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CellRendererToggle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActivatable`

```ts
getActivatable(): boolean
```

Returns whether the cell renderer is activatable. See
`gtk_cell_renderer_toggle_set_activatable()`.

**Returns** `true` if the cell renderer is activatable.

> **Deprecated since 4.10.**

### `getActive`

```ts
getActive(): boolean
```

Returns whether the cell renderer is active. See
`gtk_cell_renderer_toggle_set_active()`.

**Returns** `true` if the cell renderer is active.

> **Deprecated since 4.10.**

### `getRadio`

```ts
getRadio(): boolean
```

Returns whether we’re rendering radio toggles rather than checkboxes.

**Returns** `true` if we’re rendering radio toggles rather than checkboxes

> **Deprecated since 4.10.**

### `setActivatable`

```ts
setActivatable(setting: boolean): void
```

Makes the cell renderer activatable.

**Parameters**

- `setting`: the value to set.

> **Deprecated since 4.10.**

### `setActive`

```ts
setActive(setting: boolean): void
```

Activates or deactivates a cell renderer.

**Parameters**

- `setting`: the value to set.

> **Deprecated since 4.10.**

### `setRadio`

```ts
setRadio(radio: boolean): void
```

If `radio` is `true`, the cell renderer renders a radio toggle
(i.e. a toggle in a group of mutually-exclusive toggles).
If `false`, it renders a check toggle (a standalone boolean option).
This can be set globally for the cell renderer, or changed just
before rendering each cell in the model (for `GtkTreeView`, you set
up a per-row setting using `GtkTreeViewColumn` to associate model
columns with cell renderer properties).

**Parameters**

- `radio`: `true` to make the toggle look like a radio button

> **Deprecated since 4.10.**
