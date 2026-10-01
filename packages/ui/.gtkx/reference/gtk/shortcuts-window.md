---
description: "A GtkShortcutsWindow shows information about the keyboard shortcuts and gestures of an application."
---

# GtkShortcutsWindow

A `GtkShortcutsWindow` shows information about the keyboard shortcuts
and gestures of an application.

The shortcuts can be grouped, and you can have multiple sections in this
window, corresponding to the major modes of your application.

Additionally, the shortcuts can be filtered by the current view, to avoid
showing information that is not relevant in the current application context.

The recommended way to construct a `GtkShortcutsWindow` is with
`Gtk.Builder`, by using the `<child>` tag to populate a
`GtkShortcutsWindow` with one or more `Gtk.ShortcutsSection` objects,
which contain one or more `Gtk.ShortcutsGroup` instances, which, in turn,
contain `Gtk.ShortcutsShortcut` instances.

If you need to add a section programmatically, use `Gtk.ShortcutsWindow.addSection()`
instead of `Gtk.Window.setChild()`, as the shortcuts window manages
its children directly.

## A simple example:



This example has as single section. As you can see, the shortcut groups
are arranged in columns, and spread across several pages if there are too
many to find on a single page.

The .ui file for this example can be found [here](https://gitlab.gnome.org/GNOME/gtk/tree/main/demos/gtk-demo/shortcuts-gedit.ui).

## An example with multiple views:



This example shows a `GtkShortcutsWindow` that has been configured to show only
the shortcuts relevant to the “Stopwatch” view.

The .ui file for this example can be found [here](https://gitlab.gnome.org/GNOME/gtk/tree/main/demos/gtk-demo/shortcuts-clocks.ui).

## An example with multiple sections:



This example shows a `GtkShortcutsWindow` with two sections, “Editor Shortcuts”
and “Terminal Shortcuts”.

The .ui file for this example can be found [here](https://gitlab.gnome.org/GNOME/gtk/tree/main/demos/gtk-demo/shortcuts-builder.ui).

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.ShortcutsWindow.close`
- `Gtk.ShortcutsWindow.search`

## CSS nodes

`GtkShortcutsWindow` has a single CSS node with the name `window` and style
class `.shortcuts`.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

```tsx
import { GtkShortcutsWindow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **GtkShortcutsWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.ShortcutsWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `sectionName`

`string` · default `internal-search` · deprecated since 4.18

The name of the section to show.

This should be the section-name of one of the `GtkShortcutsSection`
objects that are in this shortcuts window.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `viewName`

`string` · default `null` · deprecated since 4.18

The view name by which to filter the contents.

This should correspond to the `Gtk.ShortcutsGroup.view`
property of some of the `Gtk.ShortcutsGroup` objects that
are inside this shortcuts window.

Set this to `null` to show all groups.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Signals

### `onClose`

```ts
(self: Gtk.ShortcutsWindow) => void
```

Emitted when the user uses a keybinding to close the window.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is the <kbd>Escape</kbd> key.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

### `onSearch`

```ts
(self: Gtk.ShortcutsWindow) => void
```

Emitted when the user uses a keybinding to start a search.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Control</kbd>+<kbd>F</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.18.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.ShortcutsWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addSection`

```ts
addSection(section: Gtk.ShortcutsSection): void
```

Adds a section to the shortcuts window.

This is the programmatic equivalent to using `Gtk.Builder` and a
`<child>` tag to add the child.

Using `Gtk.Window.setChild()` is not appropriate as the shortcuts
window manages its children internally.

**Parameters**

- `section`: the `GtkShortcutsSection` to add

> **Deprecated since 4.18.** This widget will be removed in GTK 5

_Available since 4.14._
