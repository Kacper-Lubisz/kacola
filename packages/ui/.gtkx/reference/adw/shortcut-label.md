---
description: "A widget that displays a keyboard shortcut."
---

# AdwShortcutLabel

A widget that displays a keyboard shortcut.



The shown shortcut can be set using the `ShortcutLabel.accelerator`
property.

Optionally, if no shortcut is set, `AdwShortcutLabel` will display a
placeholder set with the `ShortcutLabel.disabledText` property.

The following types of shortcuts can be displayed:

- A single shortcut in `Gtk.acceleratorParse()` format, e.g. `<Control>C`:

    

- Multiple alternative shortcuts, separated with spaces, e.g. `<Shift>A Home`:

    

- A range of shortcuts, separated with `...`, e.g. `<Alt>1...9`:

    

- Multiple keys pressed at once, separated with `&`, e.g. `Control_L&Control_R`:

    

- Multiple shortcuts or keys, pressed sequentially, separated with `+`, e.g. `<Control>C+<Control>X`:

    

::: note
    `<`, `>` and `&` need to be escaped as `&lt;`, `&gt;` and `&amp;` when used in UI files.

### CSS nodes

`AdwShortcutLabel` has a single CSS node with name `shortcut-label`. The
individual keycap labels each have the `.keycap` style class, while the
labels separating them have the `.dimmed` style class.

### Accessibility

`AdwShortcutLabel` uses the `Gtk.AccessibleRole.label` role.

See also: `ShortcutsDialog`.

_Available since 1.8._

```tsx
import { AdwShortcutLabel } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwShortcutLabel**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ShortcutLabel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelerator`

`string`

The displayed accelerator.

_Available since 1.8._

### `disabledText`

`string`

The text displayed when no accelerator is set.

_Available since 1.8._

## Methods

Methods are called on the `Adw.ShortcutLabel` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAccelerator`

```ts
getAccelerator(): string
```

Gets the accelerator displayed by `self`.

**Returns** the displayed accelerator

_Available since 1.8._

### `getDisabledText`

```ts
getDisabledText(): string
```

Gets the text displayed by `self` when no accelerator is set.

**Returns** the text displayed when no accelerator is set

_Available since 1.8._

### `setAccelerator`

```ts
setAccelerator(accelerator: string): void
```

Sets the accelerator to be displayed by `self`.

**Parameters**

- `accelerator`: the accelerator to be displayed

_Available since 1.8._

### `setDisabledText`

```ts
setDisabledText(disabledText: string): void
```

Sets the text to be displayed by `self` when no accelerator is set.

**Parameters**

- `disabledText`: the text displayed when no accelerator is set

_Available since 1.8._
