---
description: "A GtkShortcutsSection collects all the keyboard shortcuts and gestures for a major application mode."
---

# GtkShortcutsSection

A `GtkShortcutsSection` collects all the keyboard shortcuts and gestures
for a major application mode.

If your application needs multiple sections, you should give each
section a unique `Gtk.ShortcutsSection.sectionName` and
a `Gtk.ShortcutsSection.title` that can be shown in the
section selector of the `Gtk.ShortcutsWindow`.

The `Gtk.ShortcutsSection.maxHeight` property can be used
to influence how the groups in the section are distributed over pages
and columns.

This widget is only meant to be used with `Gtk.ShortcutsWindow`.

The recommended way to construct a `GtkShortcutsSection` is with
`Gtk.Builder`, by using the `<child>` tag to populate a
`GtkShortcutsSection` with one or more `Gtk.ShortcutsGroup`
instances, which in turn contain one or more `Gtk.ShortcutsShortcut`
objects.

If you need to add a group programmatically, use
`Gtk.ShortcutsSection.addGroup()`.

## Shortcuts and Gestures

Pan gestures allow to navigate between sections.

The following signals have default keybindings:

- `Gtk.ShortcutsSection.change-current-page`

> **Deprecated since 4.18.** This widget will be removed in GTK 5

```tsx
import { GtkShortcutsSection } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkBox](.gtkx/reference/gtk/box.md) → **GtkShortcutsSection**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.ShortcutsSection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `maxHeight`

`number` · default `15` · deprecated since 4.18

The maximum number of lines to allow per column.

This property can be used to influence how the groups in this
section are distributed across pages and columns. The default
value of 15 should work in most cases.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `sectionName`

`string` · default `null` · deprecated since 4.18

A unique name to identify this section among the sections
added to the `GtkShortcutsWindow`.

Setting the `Gtk.ShortcutsWindow.sectionName` property
to this string will make this section shown in the `GtkShortcutsWindow`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `title`

`string` · default `null` · deprecated since 4.18

The string to show in the section selector of the `GtkShortcutsWindow`
for this section.

If there is only one section, you don't need to set a title,
since the section selector will not be shown in this case.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `viewName`

`string` · default `null` · deprecated since 4.18

A view name to filter the groups in this section by.

See `Gtk.ShortcutsGroup.view`.

Applications are expected to use the
`Gtk.ShortcutsWindow.viewName` property
for this purpose.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Signals

### `onChangeCurrentPage`

```ts
(offset: number, self: Gtk.ShortcutsSection) => boolean | undefined
```

Emitted when we change the current page.

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>PgUp</kbd>, <kbd>PgUp</kbd>,
<kbd>Ctrl</kbd>+<kbd>PgDn</kbd>, <kbd>PgDn</kbd>.

**Parameters**

- `offset`: the offset
- `self`: The instance the signal was emitted on.

**Returns** whether the page was changed

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.ShortcutsSection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addGroup`

```ts
addGroup(group: Gtk.ShortcutsGroup): void
```

Adds a group to the shortcuts section.

This is the programmatic equivalent to using `Gtk.Builder` and a
`<child>` tag to add the child.

Adding children with the `GtkBox` API is not appropriate, as
`GtkShortcutsSection` manages its children internally.

**Parameters**

- `group`: the `GtkShortcutsGroup` to add

> **Deprecated since 4.18.** This widget will be removed in GTK 5

_Available since 4.14._
