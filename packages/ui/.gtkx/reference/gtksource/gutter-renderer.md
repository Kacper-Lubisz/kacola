---
description: "Gutter cell renderer."
---

# GtkSourceGutterRenderer

Gutter cell renderer.

A `GtkSourceGutterRenderer` represents a column in a `Gutter`. The
column contains one cell for each visible line of the `Gtk.TextBuffer`. Due to
text wrapping, a cell can thus span multiple lines of the `Gtk.TextView`. In
this case, `GutterRendererAlignmentMode` controls the alignment of
the cell.

The gutter renderer is a `Gtk.Widget` and is measured using the normal widget
measurement facilities. The width of the gutter will be determined by the
measurements of the gutter renderers.

The width of a gutter renderer generally takes into account the entire text
buffer. For instance, to display the line numbers, if the buffer contains 100
lines, the gutter renderer will always set its width such as three digits can
be printed, even if only the first 20 lines are shown. Another strategy is to
take into account only the visible lines.  In this case, only two digits are
necessary to display the line numbers of the first 20 lines. To take another
example, the gutter renderer for `Mark`s doesn't need to take
into account the text buffer to announce its width. It only depends on the
icons size displayed in the gutter column.

When the available size to render a cell is greater than the required size to
render the cell contents, the cell contents can be aligned horizontally and
vertically with `GutterRenderer.setAlignmentMode()`.

The cells rendering occurs using `Gtk.Widget.snapshot()`. Implementations
should use `gtk_source_gutter_renderer_get_lines()` to retrieve information
about the lines to be rendered. To help with aligning content which takes
into account the padding and alignment of a cell, implementations may call
`GutterRenderer.alignCell()` for a given line number with the
width and height measurement of the content they width to render.

```tsx
import { GtkSourceGutterRenderer } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceGutterRenderer**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.GutterRenderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alignmentMode`

`GtkSource.GutterRendererAlignmentMode` · default `GTK_SOURCE_GUTTER_RENDERER_ALIGNMENT_MODE_CELL`

The alignment mode of the renderer.

This can be used to indicate that in the case a cell spans multiple lines (due to text wrapping)
the alignment should work on either the full cell, the first line or the last line.

### `lines`

`GtkSource.GutterLines` · read-only, observe with `onNotifyLines`

Contains information about the lines to be rendered.

It should be used by `GtkSourceGutterRenderer` implementations from `Gtk.Widget.snapshot()`.

### `view`

`Gtk.TextView` · read-only, observe with `onNotifyView`

The view on which the renderer is placed.

### `xalign`

`number` · default `0.000000`

The horizontal alignment of the renderer.

Set to 0 for a left alignment. 1 for a right alignment. And 0.5 for centering the cells.
A value lower than 0 doesn't modify the alignment.

### `xpad`

`number` · default `0`

The left and right padding of the renderer.

### `yalign`

`number` · default `0.000000`

The vertical alignment of the renderer.

Set to 0 for a top alignment. 1 for a bottom alignment. And 0.5 for centering the cells.
A value lower than 0 doesn't modify the alignment.

### `ypad`

`number` · default `0`

The top and bottom padding of the renderer.

## Signals

### `onActivate`

```ts
(iter: Gtk.TextIter, area: Gdk.Rectangle, button: number, state: Gdk.ModifierType, nPresses: number, self: GtkSource.GutterRenderer) => void
```

The signal is emitted when the renderer is activated.

**Parameters**

- `iter`: a `GtkTextIter`
- `area`: a `GdkRectangle`
- `button`: the button that was pressed
- `state`: a `GdkModifierType` of state
- `nPresses`: the number of button presses
- `self`: The instance the signal was emitted on.

### `onQueryActivatable`

```ts
(iter: Gtk.TextIter, area: Gdk.Rectangle, self: GtkSource.GutterRenderer) => boolean | undefined
```

The signal is emitted when the renderer can possibly be activated.

**Parameters**

- `iter`: a `GtkTextIter`
- `area`: a `GdkRectangle`
- `self`: The instance the signal was emitted on.

### `onQueryData`

```ts
(object: GObject.Object, p0: number, self: GtkSource.GutterRenderer) => void
```

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.GutterRenderer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `alignCell`

```ts
alignCell(line: number, width: number, height: number): [number, number]
```

Locates where to render content that is `width` x `height` based on
the renderers alignment and padding.

The location will be placed into `x` and `y` and is relative to the
renderer's coordinates.

It is encouraged that renderers use this function when snappshotting
to ensure consistent placement of their contents.

**Parameters**

- `line`: the line number for content
- `width`: the width of the content to draw
- `height`: the height of the content to draw

**Returns** Tuple of:

- `x`: the X position to render the content
- `y`: the Y position to render the content

### `getAlignmentMode`

```ts
getAlignmentMode(): GtkSource.GutterRendererAlignmentMode
```

Get the alignment mode.

The alignment mode describes the manner in which the
renderer is aligned (see `GutterRenderer.xalign` and
`GutterRenderer.yalign`).

**Returns** a `GtkSourceGutterRendererAlignmentMode`

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer | null
```

Gets the `Buffer` for which the gutter renderer is drawing.

**Returns** a `GtkTextBuffer` or `null`

### `getView`

```ts
getView(): GtkSource.View
```

Get the view associated to the gutter renderer

**Returns** a `GtkSourceView`

### `getXalign`

```ts
getXalign(): number
```

Gets the `xalign` property.

This may be used to adjust where within the cell rectangle the renderer will draw.

### `getXpad`

```ts
getXpad(): number
```

Gets the `xpad` property.

This may be used to adjust the cell rectangle that the renderer will use to draw.

### `getYalign`

```ts
getYalign(): number
```

Gets the `yalign` property.

This may be used to adjust where within the cell rectangle the renderer will draw.

### `getYpad`

```ts
getYpad(): number
```

Gets the `ypad` property.

This may be used to adjust the cell rectangle that the renderer will use to draw.

### `gutterRendererActivate`

```ts
gutterRendererActivate(iter: Gtk.TextIter, area: Gdk.Rectangle, button: number, state: Gdk.ModifierType, nPresses: number): void
```

Emits the `GutterRenderer.activate` signal of the renderer. This is
called from `Gutter` and should never have to be called manually.

**Parameters**

- `iter`: a `GtkTextIter` at the start of the line where the renderer is activated
- `area`: a `GdkRectangle` of the cell area where the renderer is activated
- `button`: the button that was pressed
- `state`: a `GdkModifierType`
- `nPresses`: the number of button presses

### `queryActivatable`

```ts
queryActivatable(iter: Gtk.TextIter, area: Gdk.Rectangle): boolean
```

Get whether the renderer is activatable at the location provided. This is
called from `Gutter` to determine whether a renderer is activatable
using the mouse pointer.

**Parameters**

- `iter`: a `GtkTextIter` at the start of the line to be activated
- `area`: a `GdkRectangle` of the cell area to be activated

**Returns** `true` if the renderer can be activated, `false` otherwise

### `setAlignmentMode`

```ts
setAlignmentMode(mode: GtkSource.GutterRendererAlignmentMode): void
```

Set the alignment mode. The alignment mode describes the manner in which the
renderer is aligned (see `GutterRenderer.xalign` and
`GutterRenderer.yalign`).

**Parameters**

- `mode`: a `GtkSourceGutterRendererAlignmentMode`

### `setXalign`

```ts
setXalign(xalign: number): void
```

Adjusts the `xalign` property.

This may be used to adjust where within the cell rectangle the renderer will draw.

**Parameters**

- `xalign`: the Y padding for the drawing cell

### `setXpad`

```ts
setXpad(xpad: number): void
```

Adjusts the `xpad` property.

This may be used to adjust the cell rectangle that the renderer will use to draw.

**Parameters**

- `xpad`: the Y padding for the drawing cell

### `setYalign`

```ts
setYalign(yalign: number): void
```

Adjusts the `yalign` property.

This may be used to adjust where within the cell rectangle the renderer will draw.

**Parameters**

- `yalign`: the Y padding for the drawing cell

### `setYpad`

```ts
setYpad(ypad: number): void
```

Adjusts the `ypad` property.

This may be used to adjust the cell rectangle that the renderer will use to draw.

**Parameters**

- `ypad`: the Y padding for the drawing cell
