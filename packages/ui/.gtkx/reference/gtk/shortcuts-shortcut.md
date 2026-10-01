---
description: "A GtkShortcutsShortcut represents a single keyboard shortcut or gesture with a short text."
---

# GtkShortcutsShortcut

A `GtkShortcutsShortcut` represents a single keyboard shortcut or gesture
with a short text.

This widget is only meant to be used with `GtkShortcutsWindow`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

```tsx
import { GtkShortcutsShortcut } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkShortcutsShortcut**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ShortcutsShortcut` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelerator`

`string` · default `null` · deprecated since 4.18

The accelerator(s) represented by this object.

This property is used if `Gtk.ShortcutsShortcut.shortcutType`
is set to `GTK_SHORTCUT_ACCELERATOR`.

The syntax of this property is (an extension of) the syntax understood
by `Gtk.acceleratorParse()`. Multiple accelerators can be specified
by separating them with a space, but keep in mind that the available width
is limited.

It is also possible to specify ranges of shortcuts, using `...` between
the keys. Sequences of keys can be specified using a `+` or `&` between
the keys.

Examples:

- A single shortcut: `<ctl><alt>delete`
- Two alternative shortcuts: `<shift>a Home`
- A range of shortcuts: `<alt>1...<alt>9`
- Several keys pressed together: `Control_L&Control_R`
- A sequence of shortcuts or keys: `<ctl>c+<ctl>x`

Use "+" instead of "&" when the keys may (or have to be) pressed
sequentially (e.g use "t+t" for 'press the t key twice').

Note that `<`, `>` and `&` need to be escaped as `&lt;`, `&gt`; and `&amp`; when used
in .ui files.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `accelSizeGroup`

`Gtk.SizeGroup | ReactElement` · deprecated since 4.18

The size group for the accelerator portion of this shortcut.

This is used internally by GTK, and must not be modified by applications.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `actionName`

`string` · default `null` · deprecated since 4.18

A detailed action name.

If this is set for a shortcut of type `GTK_SHORTCUT_ACCELERATOR`,
then GTK will use the accelerators that are associated with the
action via `Gtk.Application.setAccelsForAction()`, and
setting `Gtk.ShortcutsShortcut.accelerator` is not necessary.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `direction`

`Gtk.TextDirection` · default `GTK_TEXT_DIR_NONE` · deprecated since 4.18

The text direction for which this shortcut is active.

If the shortcut is used regardless of the text direction,
set this property to `GTK_TEXT_DIR_NONE`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `icon`

`Gio.Icon | ReactElement` · deprecated since 4.18

An icon to represent the shortcut or gesture.

This property is used if `Gtk.ShortcutsShortcut.shortcutType`
is set to `GTK_SHORTCUT_GESTURE`.

For the other predefined gesture types, GTK provides an icon on its own.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `iconSet`

`boolean` · default `false` · deprecated since 4.18

`true` if an icon has been set.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `shortcutType`

`Gtk.ShortcutType` · default `GTK_SHORTCUT_ACCELERATOR` · deprecated since 4.18

The type of shortcut that is represented.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `subtitle`

`string` · deprecated since 4.18

The subtitle for the shortcut or gesture.

This is typically used for gestures and should be a short, one-line
text that describes the gesture itself. For the predefined gesture
types, GTK provides a subtitle on its own.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `subtitleSet`

`boolean` · default `false` · deprecated since 4.18

`true` if a subtitle has been set.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `title`

`string` · deprecated since 4.18

The textual description for the shortcut or gesture represented by
this object.

This should be a short string that can fit in a single line.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `titleSizeGroup`

`Gtk.SizeGroup | ReactElement` · deprecated since 4.18

The size group for the textual portion of this shortcut.

This is used internally by GTK, and must not be modified by applications.

> **Deprecated since 4.18.** This widget will be removed in GTK 5
