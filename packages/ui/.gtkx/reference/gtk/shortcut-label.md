---
description: "GtkShortcutLabel displays a single keyboard shortcut or gesture."
---

# GtkShortcutLabel

`GtkShortcutLabel` displays a single keyboard shortcut or gesture.

The main use case for `GtkShortcutLabel` is inside a `Gtk.ShortcutsWindow`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

```tsx
import { GtkShortcutLabel } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkShortcutLabel**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ShortcutLabel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelerator`

`string` · default `null` · deprecated since 4.18

The accelerator that `self` displays.

See `Gtk.ShortcutsShortcut.accelerator`
for the accepted syntax.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `disabledText`

`string` · default `null` · deprecated since 4.18

The text that is displayed when no accelerator is set.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.ShortcutLabel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAccelerator`

```ts
getAccelerator(): string | null
```

Retrieves the current accelerator of `self`.

**Returns** the current accelerator.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `getDisabledText`

```ts
getDisabledText(): string | null
```

Retrieves the text that is displayed when no accelerator is set.

**Returns** the current text displayed when no
accelerator is set.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `setAccelerator`

```ts
setAccelerator(accelerator: string): void
```

Sets the accelerator to be displayed by `self`.

**Parameters**

- `accelerator`: the new accelerator

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `setDisabledText`

```ts
setDisabledText(disabledText: string): void
```

Sets the text to be displayed by `self` when no accelerator is set.

**Parameters**

- `disabledText`: the text to be displayed when no accelerator is set

> **Deprecated since 4.18.** This widget will be removed in GTK 5
