---
description: "Creates groups of windows that behave like separate applications."
---

# GtkWindowGroup

Creates groups of windows that behave like separate applications.

It achieves this by limiting the effect of GTK grabs and modality
to windows in the same group.

A window can be a member in at most one window group at a time.
Windows that have not been explicitly assigned to a group are
implicitly treated like windows of the default window group.

`GtkWindowGroup` objects are referenced by each window in the group,
so once you have added all windows to a `GtkWindowGroup`, you can drop
the initial reference to the window group with `g_object_unref()`. If the
windows in the window group are subsequently destroyed, then they will
be removed from the window group and drop their references on the window
group; when all window have been removed, the window group will be
freed.

```tsx
import { GtkWindowGroup } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkWindowGroup**

## Props

`ref` receives the `Gtk.WindowGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.WindowGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addWindow`

```ts
addWindow(window: Gtk.Window): void
```

Adds a window to a `GtkWindowGroup`.

**Parameters**

- `window`: the `GtkWindow` to add

### `listWindows`

```ts
listWindows(): Gtk.Window[]
```

Returns a list of the `GtkWindows` that belong to `window_group`.

**Returns** A
  newly-allocated list of windows inside the group.

### `removeWindow`

```ts
removeWindow(window: Gtk.Window): void
```

Removes a window from a `GtkWindowGroup`.

**Parameters**

- `window`: the `GtkWindow` to remove
