---
description: "Gutter object for View."
---

# GtkSourceGutter

Gutter object for `View`.

The `GtkSourceGutter` object represents the left or right gutter of the text
view. It is used by `View` to draw the line numbers and
`Mark`s that might be present on a line. By packing
additional `GutterRenderer` objects in the gutter, you can extend the
gutter with your own custom drawings.

To get a `GtkSourceGutter`, use the `View.getGutter()` function.

The gutter works very much the same way as cells rendered in a `Gtk.TreeView`.
The concept is similar, with the exception that the gutter does not have an
underlying `Gtk.TreeModel`. The builtin line number renderer is at position
`GTK_SOURCE_VIEW_GUTTER_POSITION_LINES` (-30) and the marks renderer is at
`GTK_SOURCE_VIEW_GUTTER_POSITION_MARKS` (-20). The gutter sorts the renderers
in ascending order, from left to right. So the marks are displayed on the
right of the line numbers.

```tsx
import { GtkSourceGutter } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceGutter**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.Gutter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `view`

`GtkSource.View` · construct-only

The `GtkSourceView` of the gutter.

### `windowType`

`Gtk.TextWindowType` · default `GTK_TEXT_WINDOW_LEFT` · construct-only

The text window type on which the window is placed.

## Methods

Methods are called on the `GtkSource.Gutter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getView`

```ts
getView(): GtkSource.View
```

**Returns** the associated `GtkSourceView`.

### `insert`

```ts
insert(renderer: GtkSource.GutterRenderer, position: number): boolean
```

Insert `renderer` into the gutter. If `renderer` is yet unowned then gutter
claims its ownership. Otherwise just increases renderer's reference count.
`renderer` cannot be already inserted to another gutter.

**Parameters**

- `renderer`: a gutter renderer (must inherit from `GtkSourceGutterRenderer`).
- `position`: the renderer position.

**Returns** `true` if operation succeeded. Otherwise `false`.

### `remove`

```ts
remove(renderer: GtkSource.GutterRenderer): void
```

### `reorder`

```ts
reorder(renderer: GtkSource.GutterRenderer, position: number): void
```

Reorders `renderer` in `gutter` to new `position`.

**Parameters**

- `renderer`: a `GtkCellRenderer`.
- `position`: the new renderer position.
