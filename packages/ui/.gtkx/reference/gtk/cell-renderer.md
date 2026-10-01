---
description: "An object for rendering a single cell The GtkCellRenderer is a base class of a set of objects used for rendering a cell to a cairo_t."
---

# GtkCellRenderer

An object for rendering a single cell

The `GtkCellRenderer` is a base class of a set of objects used for
rendering a cell to a `cairo_t`.  These objects are used primarily by
the `GtkTreeView` widget, though they aren’t tied to them in any
specific way.  It is worth noting that `GtkCellRenderer` is not a
`GtkWidget` and cannot be treated as such.

The primary use of a `GtkCellRenderer` is for drawing a certain graphical
elements on a `cairo_t`. Typically, one cell renderer is used to
draw many cells on the screen.  To this extent, it isn’t expected that a
CellRenderer keep any permanent state around.  Instead, any state is set
just prior to use using `GObject`s property system.  Then, the
cell is measured using `gtk_cell_renderer_get_preferred_size()`. Finally, the cell
is rendered in the correct location using `gtk_cell_renderer_snapshot()`.

There are a number of rules that must be followed when writing a new
`GtkCellRenderer`.  First and foremost, it’s important that a certain set
of properties will always yield a cell renderer of the same size,
barring a style change. The `GtkCellRenderer` also has a number of
generic properties that are expected to be honored by all children.

Beyond merely rendering a cell, cell renderers can optionally
provide active user interface elements. A cell renderer can be
“activatable” like `GtkCellRenderer`Toggle,
which toggles when it gets activated by a mouse click, or it can be
“editable” like `GtkCellRenderer`Text, which
allows the user to edit the text using a widget implementing the
`GtkCellEditable` interface, e.g. `GtkEntry`.
To make a cell renderer activatable or editable, you have to
implement the `GtkCellRenderer`Class.activate or
`GtkCellRenderer`Class.start_editing virtual functions, respectively.

Many properties of `GtkCellRenderer` and its subclasses have a
corresponding “set” property, e.g. “cell-background-set” corresponds
to “cell-background”. These “set” properties reflect whether a property
has been set or not. You should not set them independently.

> **Deprecated since 4.10.** List views use widgets for displaying their contents

```tsx
import { GtkCellRenderer } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkCellRenderer**

## Props

`ref` receives the `Gtk.CellRenderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cellBackground`

`string` · default `null`

### `cellBackgroundRgba`

`Gdk.RGBA`

Cell background as a `GdkRGBA`

### `cellBackgroundSet`

`boolean` · default `false`

### `editing`

`boolean` · default `false` · read-only, observe with `onNotifyEditing`

### `height`

`number` · default `-1`

### `isExpanded`

`boolean` · default `false`

### `isExpander`

`boolean` · default `false`

### `mode`

`Gtk.CellRendererMode` · default `GTK_CELL_RENDERER_MODE_INERT`

### `sensitive`

`boolean` · default `true`

### `visible`

`boolean` · default `true`

### `width`

`number` · default `-1`

### `xalign`

`number` · default `0.500000`

### `xpad`

`number` · default `0`

### `yalign`

`number` · default `0.500000`

### `ypad`

`number` · default `0`

## Signals

### `onEditingCanceled`

```ts
(self: Gtk.CellRenderer) => void
```

This signal gets emitted when the user cancels the process of editing a
cell.  For example, an editable cell renderer could be written to cancel
editing when the user presses Escape.

See also: `gtk_cell_renderer_stop_editing()`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onEditingStarted`

```ts
(editable: Gtk.CellEditable, path: string, self: Gtk.CellRenderer) => void
```

This signal gets emitted when a cell starts to be edited.
The intended use of this signal is to do special setup
on `editable`, e.g. adding a `GtkEntryCompletion` or setting
up additional columns in a `GtkComboBox`.

See `gtk_cell_editable_start_editing()` for information on the lifecycle of
the `editable` and a way to do setup that doesn’t depend on the `renderer`.

Note that GTK doesn't guarantee that cell renderers will
continue to use the same kind of widget for editing in future
releases, therefore you should check the type of `editable`
before doing any specific setup, as in the following example:

```c
static void
text_editing_started (GtkCellRenderer *cell,
                      GtkCellEditable *editable,
                      const char      *path,
                      gpointer         data)
{
  if (GTK_IS_ENTRY (editable))
    {
      GtkEntry *entry = GTK_ENTRY (editable);

      // ... create a GtkEntryCompletion

      gtk_entry_set_completion (entry, completion);
    }
}
```

**Parameters**

- `editable`: the `GtkCellEditable`
- `path`: the path identifying the edited cell
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CellRenderer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `activate`

```ts
activate(event: Gdk.Event, widget: Gtk.Widget, path: string, backgroundArea: Gdk.Rectangle, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState): boolean
```

Passes an activate event to the cell renderer for possible processing.
Some cell renderers may use events; for example, `GtkCellRendererToggle`
toggles when it gets a mouse click.

**Parameters**

- `event`: a `GdkEvent`
- `widget`: widget that received the event
- `path`: widget-dependent string representation of the event location; e.g. for `GtkTreeView`, a string representation of `GtkTreePath`
- `backgroundArea`: background area as passed to `gtk_cell_renderer_render()`
- `cellArea`: cell area as passed to `gtk_cell_renderer_render()`
- `flags`: render flags

**Returns** `true` if the event was consumed/handled

> **Deprecated since 4.10.**

### `getAlignedArea`

```ts
getAlignedArea(widget: Gtk.Widget, flags: Gtk.CellRendererState, cellArea: Gdk.Rectangle): Gdk.Rectangle
```

Gets the aligned area used by `cell` inside `cell_area`. Used for finding
the appropriate edit and focus rectangle.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to
- `flags`: render flags
- `cellArea`: cell area which would be passed to `gtk_cell_renderer_render()`

**Returns** the return location for the space inside `cell_area`
               that would actually be used to render.

> **Deprecated since 4.10.**

### `getAlignment`

```ts
getAlignment(): [number, number]
```

Fills in `xalign` and `yalign` with the appropriate values of `cell`.

**Returns** Tuple of:

- `xalign`: location to fill in with the x alignment of the cell
- `yalign`: location to fill in with the y alignment of the cell

> **Deprecated since 4.10.**

### `getFixedSize`

```ts
getFixedSize(): [number, number]
```

Fills in `width` and `height` with the appropriate size of `cell`.

**Returns** Tuple of:

- `width`: location to fill in with the fixed width of the cell
- `height`: location to fill in with the fixed height of the cell

> **Deprecated since 4.10.**

### `getIsExpanded`

```ts
getIsExpanded(): boolean
```

Checks whether the given `GtkCellRenderer` is expanded.

**Returns** `true` if the cell renderer is expanded

> **Deprecated since 4.10.**

### `getIsExpander`

```ts
getIsExpander(): boolean
```

Checks whether the given `GtkCellRenderer` is an expander.

**Returns** `true` if `cell` is an expander, and `false` otherwise

> **Deprecated since 4.10.**

### `getPadding`

```ts
getPadding(): [number, number]
```

Fills in `xpad` and `ypad` with the appropriate values of `cell`.

**Returns** Tuple of:

- `xpad`: location to fill in with the x padding of the cell
- `ypad`: location to fill in with the y padding of the cell

> **Deprecated since 4.10.**

### `getPreferredHeight`

```ts
getPreferredHeight(widget: Gtk.Widget): [number, number]
```

Retrieves a renderer’s natural size when rendered to `widget`.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to

**Returns** Tuple of:

- `minimumSize`: location to store the minimum size
- `naturalSize`: location to store the natural size

> **Deprecated since 4.10.**

### `getPreferredHeightForWidth`

```ts
getPreferredHeightForWidth(widget: Gtk.Widget, width: number): [number, number]
```

Retrieves a cell renderers’s minimum and natural height if it were rendered to
`widget` with the specified `width`.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to
- `width`: the size which is available for allocation

**Returns** Tuple of:

- `minimumHeight`: location for storing the minimum size
- `naturalHeight`: location for storing the preferred size

> **Deprecated since 4.10.**

### `getPreferredSize`

```ts
getPreferredSize(widget: Gtk.Widget): [Gtk.Requisition, Gtk.Requisition]
```

Retrieves the minimum and natural size of a cell taking
into account the widget’s preference for height-for-width management.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to

**Returns** Tuple of:

- `minimumSize`: location for storing the minimum size
- `naturalSize`: location for storing the natural size

> **Deprecated since 4.10.**

### `getPreferredWidth`

```ts
getPreferredWidth(widget: Gtk.Widget): [number, number]
```

Retrieves a renderer’s natural size when rendered to `widget`.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to

**Returns** Tuple of:

- `minimumSize`: location to store the minimum size
- `naturalSize`: location to store the natural size

> **Deprecated since 4.10.**

### `getPreferredWidthForHeight`

```ts
getPreferredWidthForHeight(widget: Gtk.Widget, height: number): [number, number]
```

Retrieves a cell renderers’s minimum and natural width if it were rendered to
`widget` with the specified `height`.

**Parameters**

- `widget`: the `GtkWidget` this cell will be rendering to
- `height`: the size which is available for allocation

**Returns** Tuple of:

- `minimumWidth`: location for storing the minimum size
- `naturalWidth`: location for storing the preferred size

> **Deprecated since 4.10.**

### `getRequestMode`

```ts
getRequestMode(): Gtk.SizeRequestMode
```

Gets whether the cell renderer prefers a height-for-width layout
or a width-for-height layout.

**Returns** The `GtkSizeRequestMode` preferred by this renderer.

> **Deprecated since 4.10.**

### `getSensitive`

```ts
getSensitive(): boolean
```

Returns the cell renderer’s sensitivity.

**Returns** `true` if the cell renderer is sensitive

> **Deprecated since 4.10.**

### `getState`

```ts
getState(widget: Gtk.Widget | null, cellState: Gtk.CellRendererState): Gtk.StateFlags
```

Translates the cell renderer state to `GtkStateFlags`,
based on the cell renderer and widget sensitivity, and
the given `GtkCellRenderer`State.

**Parameters**

- `widget`: a `GtkWidget`
- `cellState`: cell renderer state

**Returns** the widget state flags applying to `cell`

> **Deprecated since 4.10.**

### `getVisible`

```ts
getVisible(): boolean
```

Returns the cell renderer’s visibility.

**Returns** `true` if the cell renderer is visible

> **Deprecated since 4.10.**

### `isActivatable`

```ts
isActivatable(): boolean
```

Checks whether the cell renderer can do something when activated.

**Returns** `true` if the cell renderer can do anything when activated

> **Deprecated since 4.10.**

### `setAlignment`

```ts
setAlignment(xalign: number, yalign: number): void
```

Sets the renderer’s alignment within its available space.

**Parameters**

- `xalign`: the x alignment of the cell renderer
- `yalign`: the y alignment of the cell renderer

> **Deprecated since 4.10.**

### `setFixedSize`

```ts
setFixedSize(width: number, height: number): void
```

Sets the renderer size to be explicit, independent of the properties set.

**Parameters**

- `width`: the width of the cell renderer, or -1
- `height`: the height of the cell renderer, or -1

> **Deprecated since 4.10.**

### `setIsExpanded`

```ts
setIsExpanded(isExpanded: boolean): void
```

Sets whether the given `GtkCellRenderer` is expanded.

**Parameters**

- `isExpanded`: whether `cell` should be expanded

> **Deprecated since 4.10.**

### `setIsExpander`

```ts
setIsExpander(isExpander: boolean): void
```

Sets whether the given `GtkCellRenderer` is an expander.

**Parameters**

- `isExpander`: whether `cell` is an expander

> **Deprecated since 4.10.**

### `setPadding`

```ts
setPadding(xpad: number, ypad: number): void
```

Sets the renderer’s padding.

**Parameters**

- `xpad`: the x padding of the cell renderer
- `ypad`: the y padding of the cell renderer

> **Deprecated since 4.10.**

### `setSensitive`

```ts
setSensitive(sensitive: boolean): void
```

Sets the cell renderer’s sensitivity.

**Parameters**

- `sensitive`: the sensitivity of the cell

> **Deprecated since 4.10.**

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets the cell renderer’s visibility.

**Parameters**

- `visible`: the visibility of the cell

> **Deprecated since 4.10.**

### `snapshot`

```ts
snapshot(snapshot: Gtk.Snapshot, widget: Gtk.Widget, backgroundArea: Gdk.Rectangle, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState): void
```

Invokes the virtual render function of the `GtkCellRenderer`. The three
passed-in rectangles are areas in `cr`. Most renderers will draw within
`cell_area`; the xalign, yalign, xpad, and ypad fields of the `GtkCellRenderer`
should be honored with respect to `cell_area`. `background_area` includes the
blank space around the cell, and also the area containing the tree expander;
so the `background_area` rectangles for all cells tile to cover the entire
`window`.

**Parameters**

- `snapshot`: a `GtkSnapshot` to draw to
- `widget`: the widget owning `window`
- `backgroundArea`: entire cell area (including tree expanders and maybe padding on the sides)
- `cellArea`: area normally rendered by a cell renderer
- `flags`: flags that affect rendering

> **Deprecated since 4.10.**

### `startEditing`

```ts
startEditing(event: Gdk.Event | null, widget: Gtk.Widget, path: string, backgroundArea: Gdk.Rectangle, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState): Gtk.CellEditable | null
```

Starts editing the contents of this `cell`, through a new `GtkCellEditable`
widget created by the `GtkCellRenderer`Class.start_editing virtual function.

**Parameters**

- `event`: a `GdkEvent`
- `widget`: widget that received the event
- `path`: widget-dependent string representation of the event location; e.g. for `GtkTreeView`, a string representation of `GtkTreePath`
- `backgroundArea`: background area as passed to `gtk_cell_renderer_render()`
- `cellArea`: cell area as passed to `gtk_cell_renderer_render()`
- `flags`: render flags

**Returns** A new `GtkCellEditable` for editing this
  `cell`, or `null` if editing is not possible

> **Deprecated since 4.10.**

### `stopEditing`

```ts
stopEditing(canceled: boolean): void
```

Informs the cell renderer that the editing is stopped.
If `canceled` is `true`, the cell renderer will emit the
`GtkCellRenderer`::editing-canceled signal.

This function should be called by cell renderer implementations
in response to the `GtkCellEditable::editing-done` signal of
`GtkCellEditable`.

**Parameters**

- `canceled`: `true` if the editing has been canceled

> **Deprecated since 4.10.**
