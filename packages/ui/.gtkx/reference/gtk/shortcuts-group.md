---
description: "A GtkShortcutsGroup represents a group of related keyboard shortcuts or gestures."
---

# GtkShortcutsGroup

A `GtkShortcutsGroup` represents a group of related keyboard shortcuts
or gestures.

The group has a title. It may optionally be associated with a view
of the application, which can be used to show only relevant shortcuts
depending on the application context.

This widget is only meant to be used with `Gtk.ShortcutsWindow`.

The recommended way to construct a `GtkShortcutsGroup` is with
`Gtk.Builder`, by using the `<child>` tag to populate a
`GtkShortcutsGroup` with one or more `Gtk.ShortcutsShortcut`
instances.

If you need to add a shortcut programmatically, use
`Gtk.ShortcutsGroup.addShortcut()`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

```tsx
import { GtkShortcutsGroup } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkBox](.gtkx/reference/gtk/box.md) → **GtkShortcutsGroup**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.ShortcutsGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accelSizeGroup`

`Gtk.SizeGroup | ReactElement` · deprecated since 4.18

The size group for the accelerator portion of shortcuts in this group.

This is used internally by GTK, and must not be modified by applications.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `height`

`number` · default `1` · read-only, observe with `onNotifyHeight` · deprecated since 4.18

A rough measure for the number of lines in this group.

This is used internally by GTK, and is not useful for applications.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `title`

`string` · deprecated since 4.18

The title for this group of shortcuts.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `titleSizeGroup`

`Gtk.SizeGroup | ReactElement` · deprecated since 4.18

The size group for the textual portion of shortcuts in this group.

This is used internally by GTK, and must not be modified by applications.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `view`

`string` · default `null` · deprecated since 4.18

An optional view that the shortcuts in this group are relevant for.

The group will be hidden if the `Gtk.ShortcutsWindow.viewName`
property does not match the view of this group.

Set this to `null` to make the group always visible.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.ShortcutsGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addShortcut`

```ts
addShortcut(shortcut: Gtk.ShortcutsShortcut): void
```

Adds a shortcut to the shortcuts group.

This is the programmatic equivalent to using `Gtk.Builder` and a
`<child>` tag to add the child. Adding children with other API is not
appropriate as `GtkShortcutsGroup` manages its children internally.

**Parameters**

- `shortcut`: the `GtkShortcutsShortcut` to add

> **Deprecated since 4.18.** This widget will be removed in GTK 5

_Available since 4.14._
