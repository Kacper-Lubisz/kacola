---
description: "Display for interactive tooltips."
---

# GtkSourceHoverDisplay

Display for interactive tooltips.

`GtkSourceHoverDisplay` is a `Gtk.Widget` that may be populated with widgets
to be displayed to the user in interactive tooltips. The children widgets
are packed vertically using a `Gtk.Box`.

Implement the `HoverProvider` interface to be notified of when
to populate a `GtkSourceHoverDisplay` on behalf of the user.

```tsx
import { GtkSourceHoverDisplay } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceHoverDisplay**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.HoverDisplay` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GtkSource.HoverDisplay` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): void
```

### `insertAfter`

```ts
insertAfter(child: Gtk.Widget, sibling: Gtk.Widget): void
```

### `prepend`

```ts
prepend(child: Gtk.Widget): void
```

### `remove`

```ts
remove(child: Gtk.Widget): void
```
