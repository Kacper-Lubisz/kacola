---
description: "An abstract class for laying out GtkCellRenderers The GtkCellArea is an abstract class for Gtk.CellLayout widgets (also referred to as \"layouting widgets\") to interface with an arbitrary number of Gtk.CellRenderers an..."
---

# GtkCellArea

An abstract class for laying out `GtkCellRenderer`s

The `GtkCellArea` is an abstract class for `Gtk.CellLayout`
widgets (also referred to as "layouting widgets") to interface with
an arbitrary number of `Gtk.CellRenderer`s and interact with the user
for a given `Gtk.TreeModel` row.

The cell area handles events, focus navigation, drawing and
size requests and allocations for a given row of data.

Usually users dont have to interact with the `GtkCellArea` directly
unless they are implementing a cell-layouting widget themselves.

### Requesting area sizes

As outlined in
[GtkWidget’s geometry management section](class.Widget.html#height-for-width-geometry-management),
GTK uses a height-for-width
geometry management system to compute the sizes of widgets and user
interfaces. `GtkCellArea` uses the same semantics to calculate the
size of an area for an arbitrary number of `GtkTreeModel` rows.

When requesting the size of a cell area one needs to calculate
the size for a handful of rows, and this will be done differently by
different layouting widgets. For instance a `Gtk.TreeViewColumn`
always lines up the areas from top to bottom while a `Gtk.IconView`
on the other hand might enforce that all areas received the same
width and wrap the areas around, requesting height for more cell
areas when allocated less width.

It’s also important for areas to maintain some cell
alignments with areas rendered for adjacent rows (cells can
appear “columnized” inside an area even when the size of
cells are different in each row). For this reason the `GtkCellArea`
uses a `Gtk.CellAreaContext` object to store the alignments
and sizes along the way (as well as the overall largest minimum
and natural size for all the rows which have been calculated
with the said context).

The `Gtk.CellAreaContext` is an opaque object specific to the
`GtkCellArea` which created it (see `Gtk.CellArea.createContext()`).

The owning cell-layouting widget can create as many contexts as
it wishes to calculate sizes of rows which should receive the
same size in at least one orientation (horizontally or vertically),
However, it’s important that the same `Gtk.CellAreaContext` which
was used to request the sizes for a given `GtkTreeModel` row be
used when rendering or processing events for that row.

In order to request the width of all the rows at the root level
of a `GtkTreeModel` one would do the following:

```c
GtkTreeIter iter;
int minimum_width;
int natural_width;

valid = gtk_tree_model_get_iter_first (model, &iter);
while (valid)
  {
    gtk_cell_area_apply_attributes (area, model, &iter, FALSE, FALSE);
    gtk_cell_area_get_preferred_width (area, context, widget, NULL, NULL);

    valid = gtk_tree_model_iter_next (model, &iter);
  }

gtk_cell_area_context_get_preferred_width (context, &minimum_width, &natural_width);
```

Note that in this example it’s not important to observe the
returned minimum and natural width of the area for each row
unless the cell-layouting object is actually interested in the
widths of individual rows. The overall width is however stored
in the accompanying `GtkCellAreaContext` object and can be consulted
at any time.

This can be useful since `GtkCellLayout` widgets usually have to
support requesting and rendering rows in treemodels with an
exceedingly large amount of rows. The `GtkCellLayout` widget in
that case would calculate the required width of the rows in an
idle or timeout source (see `GLib.timeoutAdd()`) and when the widget
is requested its actual width in `Gtk.Widget.measure()`
it can simply consult the width accumulated so far in the
`GtkCellAreaContext` object.

A simple example where rows are rendered from top to bottom and
take up the full width of the layouting widget would look like:

```c
static void
foo_get_preferred_width (GtkWidget *widget,
                         int       *minimum_size,
                         int       *natural_size)
{
  Foo *self = FOO (widget);
  FooPrivate *priv = foo_get_instance_private (self);

  foo_ensure_at_least_one_handfull_of_rows_have_been_requested (self);

  gtk_cell_area_context_get_preferred_width (priv->context, minimum_size, natural_size);
}
```

In the above example the `Foo` widget has to make sure that some
row sizes have been calculated (the amount of rows that `Foo` judged
was appropriate to request space for in a single timeout iteration)
before simply returning the amount of space required by the area via
the `GtkCellAreaContext`.

Requesting the height for width (or width for height) of an area is
a similar task except in this case the `GtkCellAreaContext` does not
store the data (actually, it does not know how much space the layouting
widget plans to allocate it for every row. It’s up to the layouting
widget to render each row of data with the appropriate height and
width which was requested by the `GtkCellArea`).

In order to request the height for width of all the rows at the
root level of a `GtkTreeModel` one would do the following:

```c
GtkTreeIter iter;
int minimum_height;
int natural_height;
int full_minimum_height = 0;
int full_natural_height = 0;

valid = gtk_tree_model_get_iter_first (model, &iter);
while (valid)
  {
    gtk_cell_area_apply_attributes (area, model, &iter, FALSE, FALSE);
    gtk_cell_area_get_preferred_height_for_width (area, context, widget,
                                                  width, &minimum_height, &natural_height);

    if (width_is_for_allocation)
       cache_row_height (&iter, minimum_height, natural_height);

    full_minimum_height += minimum_height;
    full_natural_height += natural_height;

    valid = gtk_tree_model_iter_next (model, &iter);
  }
```

Note that in the above example we would need to cache the heights
returned for each row so that we would know what sizes to render the
areas for each row. However we would only want to really cache the
heights if the request is intended for the layouting widgets real
allocation.

In some cases the layouting widget is requested the height for an
arbitrary for_width, this is a special case for layouting widgets
who need to request size for tens of thousands  of rows. For this
case it’s only important that the layouting widget calculate
one reasonably sized chunk of rows and return that height
synchronously. The reasoning here is that any layouting widget is
at least capable of synchronously calculating enough height to fill
the screen height (or scrolled window height) in response to a single
call to `Gtk.Widget.measure()`. Returning
a perfect height for width that is larger than the screen area is
inconsequential since after the layouting receives an allocation
from a scrolled window it simply continues to drive the scrollbar
values while more and more height is required for the row heights
that are calculated in the background.

### Rendering Areas

Once area sizes have been acquired at least for the rows in the
visible area of the layouting widget they can be rendered at
`Gtk.Widget.snapshot()` time.

A crude example of how to render all the rows at the root level
runs as follows:

```c
GtkAllocation allocation;
GdkRectangle cell_area = { 0, };
GtkTreeIter iter;
int minimum_width;
int natural_width;

gtk_widget_get_allocation (widget, &allocation);
cell_area.width = allocation.width;

valid = gtk_tree_model_get_iter_first (model, &iter);
while (valid)
  {
    cell_area.height = get_cached_height_for_row (&iter);

    gtk_cell_area_apply_attributes (area, model, &iter, FALSE, FALSE);
    gtk_cell_area_render (area, context, widget, cr,
                          &cell_area, &cell_area, state_flags, FALSE);

    cell_area.y += cell_area.height;

    valid = gtk_tree_model_iter_next (model, &iter);
  }
```

Note that the cached height in this example really depends on how
the layouting widget works. The layouting widget might decide to
give every row its minimum or natural height or, if the model content
is expected to fit inside the layouting widget without scrolling, it
would make sense to calculate the allocation for each row at
the time the widget is allocated using `Gtk.distributeNaturalAllocation()`.

### Handling Events and Driving Keyboard Focus

Passing events to the area is as simple as handling events on any
normal widget and then passing them to the `Gtk.CellArea.event()`
API as they come in. Usually `GtkCellArea` is only interested in
button events, however some customized derived areas can be implemented
who are interested in handling other events. Handling an event can
trigger the `Gtk.CellArea.focus-changed` signal to fire; as well
as `Gtk.CellArea.add-editable` in the case that an editable cell
was clicked and needs to start editing. You can call
`Gtk.CellArea.stopEditing()` at any time to cancel any cell editing
that is currently in progress.

The `GtkCellArea` drives keyboard focus from cell to cell in a way
similar to `GtkWidget`. For layouting widgets that support giving
focus to cells it’s important to remember to pass `GTK_CELL_RENDERER_FOCUSED`
to the area functions for the row that has focus and to tell the
area to paint the focus at render time.

Layouting widgets that accept focus on cells should implement the
`Gtk.Widget.focus()` virtual method. The layouting widget is always
responsible for knowing where `GtkTreeModel` rows are rendered inside
the widget, so at `Gtk.Widget.focus()` time the layouting widget
should use the `GtkCellArea` methods to navigate focus inside the area
and then observe the `Gtk.DirectionType` to pass the focus to adjacent
rows and areas.

A basic example of how the `Gtk.Widget.focus()` virtual method
should be implemented:

```
static gboolean
foo_focus (GtkWidget       *widget,
           GtkDirectionType direction)
{
  Foo *self = FOO (widget);
  FooPrivate *priv = foo_get_instance_private (self);
  int focus_row = priv->focus_row;
  gboolean have_focus = FALSE;

  if (!gtk_widget_has_focus (widget))
    gtk_widget_grab_focus (widget);

  valid = gtk_tree_model_iter_nth_child (priv->model, &iter, NULL, priv->focus_row);
  while (valid)
    {
      gtk_cell_area_apply_attributes (priv->area, priv->model, &iter, FALSE, FALSE);

      if (gtk_cell_area_focus (priv->area, direction))
        {
           priv->focus_row = focus_row;
           have_focus = TRUE;
           break;
        }
      else
        {
          if (direction == GTK_DIR_RIGHT ||
              direction == GTK_DIR_LEFT)
            break;
          else if (direction == GTK_DIR_UP ||
                   direction == GTK_DIR_TAB_BACKWARD)
           {
              if (focus_row == 0)
                break;
              else
               {
                  focus_row--;
                  valid = gtk_tree_model_iter_nth_child (priv->model, &iter, NULL, focus_row);
               }
            }
          else
            {
              if (focus_row == last_row)
                break;
              else
                {
                  focus_row++;
                  valid = gtk_tree_model_iter_next (priv->model, &iter);
                }
            }
        }
    }
    return have_focus;
}
```

Note that the layouting widget is responsible for matching the
`GtkDirectionType` values to the way it lays out its cells.

### Cell Properties

The `GtkCellArea` introduces cell properties for `GtkCellRenderer`s.
This provides some general interfaces for defining the relationship
cell areas have with their cells. For instance in a `Gtk.CellAreaBox`
a cell might “expand” and receive extra space when the area is allocated
more than its full natural request, or a cell might be configured to “align”
with adjacent rows which were requested and rendered with the same
`GtkCellAreaContext`.

Use `Gtk.CellAreaClass.installCellProperty()` to install cell
properties for a cell area class and `Gtk.CellAreaClass.findCellProperty()`
or `Gtk.CellAreaClass.listCellProperties()` to get information about
existing cell properties.

To set the value of a cell property, use `Gtk.CellArea.cellSetProperty()`,
`Gtk.CellArea.cellSet()` or `Gtk.CellArea.cellSetValist()`. To obtain
the value of a cell property, use `Gtk.CellArea.cellGetProperty()`
`Gtk.CellArea.cellGet()` or `Gtk.CellArea.cellGetValist()`.

> **Deprecated since 4.10.** List views use widgets for displaying their contents

```tsx
import { GtkCellArea } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkCellArea**

Implements `GtkBuildable`, `GtkCellLayout`.

## Props

`ref` receives the `Gtk.CellArea` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `editedCell`

`Gtk.CellRenderer` · read-only, observe with `onNotifyEditedCell`

The cell in the area that is currently edited

This property is read-only and only changes as
a result of a call `gtk_cell_area_activate_cell()`.

### `editWidget`

`Gtk.CellEditable` · read-only, observe with `onNotifyEditWidget`

The widget currently editing the edited cell

This property is read-only and only changes as
a result of a call `gtk_cell_area_activate_cell()`.

### `focusCell`

`Gtk.CellRenderer | ReactElement`

The cell in the area that currently has focus

## Signals

### `onAddEditable`

```ts
(renderer: Gtk.CellRenderer, editable: Gtk.CellEditable, cellArea: Gdk.Rectangle, path: string, self: Gtk.CellArea) => void
```

Indicates that editing has started on `renderer` and that `editable`
should be added to the owning cell-layouting widget at `cell_area`.

**Parameters**

- `renderer`: the `GtkCellRenderer` that started the edited
- `editable`: the `GtkCellEditable` widget to add
- `cellArea`: the `GtkWidget` relative `GdkRectangle` coordinates where `editable` should be added
- `path`: the `GtkTreePath` string this edit was initiated for
- `self`: The instance the signal was emitted on.

### `onApplyAttributes`

```ts
(model: Gtk.TreeModel, iter: Gtk.TreeIter, isExpander: boolean, isExpanded: boolean, self: Gtk.CellArea) => void
```

This signal is emitted whenever applying attributes to `area` from `model`

**Parameters**

- `model`: the `GtkTreeModel` to apply the attributes from
- `iter`: the `GtkTreeIter` indicating which row to apply the attributes of
- `isExpander`: whether the view shows children for this row
- `isExpanded`: whether the view is currently showing the children of this row
- `self`: The instance the signal was emitted on.

### `onFocusChanged`

```ts
(renderer: Gtk.CellRenderer, path: string, self: Gtk.CellArea) => void
```

Indicates that focus changed on this `area`. This signal
is emitted either as a result of focus handling or event
handling.

It's possible that the signal is emitted even if the
currently focused renderer did not change, this is
because focus may change to the same renderer in the
same cell area for a different row of data.

**Parameters**

- `renderer`: the `GtkCellRenderer` that has focus
- `path`: the current `GtkTreePath` string set for `area`
- `self`: The instance the signal was emitted on.

### `onRemoveEditable`

```ts
(renderer: Gtk.CellRenderer, editable: Gtk.CellEditable, self: Gtk.CellArea) => void
```

Indicates that editing finished on `renderer` and that `editable`
should be removed from the owning cell-layouting widget.

**Parameters**

- `renderer`: the `GtkCellRenderer` that finished editeding
- `editable`: the `GtkCellEditable` widget to remove
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CellArea` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `activate`

```ts
activate(context: Gtk.CellAreaContext, widget: Gtk.Widget, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState, editOnly: boolean): boolean
```

Activates `area`, usually by activating the currently focused
cell, however some subclasses which embed widgets in the area
can also activate a widget if it currently has the focus.

**Parameters**

- `context`: the `GtkCellArea`Context in context with the current row data
- `widget`: the `GtkWidget` that `area` is rendering on
- `cellArea`: the size and location of `area` relative to `widget`’s allocation
- `flags`: the `GtkCellRenderer`State flags for `area` for this row of data.
- `editOnly`: if `true` then only cell renderers that are `GTK_CELL_RENDERER_MODE_EDITABLE` will be activated.

**Returns** Whether `area` was successfully activated.

> **Deprecated since 4.10.**

### `activateCell`

```ts
activateCell(widget: Gtk.Widget, renderer: Gtk.CellRenderer, event: Gdk.Event, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState): boolean
```

This is used by `GtkCellArea` subclasses when handling events
to activate cells, the base `GtkCellArea` class activates cells
for keyboard events for free in its own GtkCellArea->`activate()`
implementation.

**Parameters**

- `widget`: the `GtkWidget` that `area` is rendering onto
- `renderer`: the `GtkCellRenderer` in `area` to activate
- `event`: the `GdkEvent` for which cell activation should occur
- `cellArea`: the `GdkRectangle` in `widget` relative coordinates of `renderer` for the current row.
- `flags`: the `GtkCellRenderer`State for `renderer`

**Returns** whether cell activation was successful

> **Deprecated since 4.10.**

### `add`

```ts
add(renderer: Gtk.CellRenderer): void
```

Adds `renderer` to `area` with the default child cell properties.

**Parameters**

- `renderer`: the `GtkCellRenderer` to add to `area`

> **Deprecated since 4.10.**

### `addFocusSibling`

```ts
addFocusSibling(renderer: Gtk.CellRenderer, sibling: Gtk.CellRenderer): void
```

Adds `sibling` to `renderer`’s focusable area, focus will be drawn
around `renderer` and all of its siblings if `renderer` can
focus for a given row.

Events handled by focus siblings can also activate the given
focusable `renderer`.

**Parameters**

- `renderer`: the `GtkCellRenderer` expected to have focus
- `sibling`: the `GtkCellRenderer` to add to `renderer`’s focus area

> **Deprecated since 4.10.**

### `applyAttributes`

```ts
applyAttributes(treeModel: Gtk.TreeModel, iter: Gtk.TreeIter, isExpander: boolean, isExpanded: boolean): void
```

Applies any connected attributes to the renderers in
`area` by pulling the values from `tree_model`.

**Parameters**

- `treeModel`: the `GtkTreeModel` to pull values from
- `iter`: the `GtkTreeIter` in `tree_model` to apply values for
- `isExpander`: whether `iter` has children
- `isExpanded`: whether `iter` is expanded in the view and children are visible

> **Deprecated since 4.10.**

### `attributeConnect`

```ts
attributeConnect(renderer: Gtk.CellRenderer, attribute: string, column: number): void
```

Connects an `attribute` to apply values from `column` for the
`GtkTreeModel` in use.

**Parameters**

- `renderer`: the `GtkCellRenderer` to connect an attribute for
- `attribute`: the attribute name
- `column`: the `GtkTreeModel` column to fetch attribute values from

> **Deprecated since 4.10.**

### `attributeDisconnect`

```ts
attributeDisconnect(renderer: Gtk.CellRenderer, attribute: string): void
```

Disconnects `attribute` for the `renderer` in `area` so that
attribute will no longer be updated with values from the
model.

**Parameters**

- `renderer`: the `GtkCellRenderer` to disconnect an attribute for
- `attribute`: the attribute name

> **Deprecated since 4.10.**

### `attributeGetColumn`

```ts
attributeGetColumn(renderer: Gtk.CellRenderer, attribute: string): number
```

Returns the model column that an attribute has been mapped to,
or -1 if the attribute is not mapped.

**Parameters**

- `renderer`: a `GtkCellRenderer`
- `attribute`: an attribute on the renderer

**Returns** the model column, or -1

> **Deprecated since 4.10.**

### `cellGetProperty`

```ts
cellGetProperty(renderer: Gtk.CellRenderer, propertyName: string, value: GObject.Value): void
```

Gets the value of a cell property for `renderer` in `area`.

**Parameters**

- `renderer`: a `GtkCellRenderer` inside `area`
- `propertyName`: the name of the property to get
- `value`: a location to return the value

> **Deprecated since 4.10.**

### `cellSetProperty`

```ts
cellSetProperty(renderer: Gtk.CellRenderer, propertyName: string, value: GObject.Value | JsValue): void
```

Sets a cell property for `renderer` in `area`.

**Parameters**

- `renderer`: a `GtkCellRenderer` inside `area`
- `propertyName`: the name of the cell property to set
- `value`: the value to set the cell property to

> **Deprecated since 4.10.**

### `copyContext`

```ts
copyContext(context: Gtk.CellAreaContext): Gtk.CellAreaContext
```

This is sometimes needed for cases where rows need to share
alignments in one orientation but may be separately grouped
in the opposing orientation.

For instance, `GtkIconView` creates all icons (rows) to have
the same width and the cells theirin to have the same
horizontal alignments. However each row of icons may have
a separate collective height. `GtkIconView` uses this to
request the heights of each row based on a context which
was already used to request all the row widths that are
to be displayed.

**Parameters**

- `context`: the `GtkCellArea`Context to copy

**Returns** a newly created `GtkCellArea`Context copy of `context`.

> **Deprecated since 4.10.**

### `createContext`

```ts
createContext(): Gtk.CellAreaContext
```

Creates a `GtkCellArea`Context to be used with `area` for
all purposes. `GtkCellArea`Context stores geometry information
for rows for which it was operated on, it is important to use
the same context for the same row of data at all times (i.e.
one should render and handle events with the same `GtkCellArea`Context
which was used to request the size of those rows of data).

**Returns** a newly created `GtkCellArea`Context which can be used with `area`.

> **Deprecated since 4.10.**

### `event`

```ts
event(context: Gtk.CellAreaContext, widget: Gtk.Widget, event: Gdk.Event, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState): number
```

Delegates event handling to a `GtkCellArea`.

**Parameters**

- `context`: the `GtkCellArea`Context for this row of data.
- `widget`: the `GtkWidget` that `area` is rendering to
- `event`: the `GdkEvent` to handle
- `cellArea`: the `widget` relative coordinates for `area`
- `flags`: the `GtkCellRenderer`State for `area` in this row.

**Returns** `true` if the event was handled by `area`.

> **Deprecated since 4.10.**

### `focus`

```ts
focus(direction: Gtk.DirectionType): boolean
```

This should be called by the `area`’s owning layout widget
when focus is to be passed to `area`, or moved within `area`
for a given `direction` and row data.

Implementing `GtkCellArea` classes should implement this
method to receive and navigate focus in its own way particular
to how it lays out cells.

**Parameters**

- `direction`: the `GtkDirectionType`

**Returns** `true` if focus remains inside `area` as a result of this call.

> **Deprecated since 4.10.**

### `foreach`

```ts
foreach(callback: Gtk.CellCallback): void
```

Calls `callback` for every `GtkCellRenderer` in `area`.

**Parameters**

- `callback`: the `GtkCellCallback` to call

> **Deprecated since 4.10.**

### `foreachAlloc`

```ts
foreachAlloc(context: Gtk.CellAreaContext, widget: Gtk.Widget, cellArea: Gdk.Rectangle, backgroundArea: Gdk.Rectangle, callback: Gtk.CellAllocCallback): void
```

Calls `callback` for every `GtkCellRenderer` in `area` with the
allocated rectangle inside `cell_area`.

**Parameters**

- `context`: the `GtkCellArea`Context for this row of data.
- `widget`: the `GtkWidget` that `area` is rendering to
- `cellArea`: the `widget` relative coordinates and size for `area`
- `backgroundArea`: the `widget` relative coordinates of the background area
- `callback`: the `GtkCellAllocCallback` to call

### `getCellAllocation`

```ts
getCellAllocation(context: Gtk.CellAreaContext, widget: Gtk.Widget, renderer: Gtk.CellRenderer, cellArea: Gdk.Rectangle): Gdk.Rectangle
```

Derives the allocation of `renderer` inside `area` if `area`
were to be rendered in `cell_area`.

**Parameters**

- `context`: the `GtkCellArea`Context used to hold sizes for `area`.
- `widget`: the `GtkWidget` that `area` is rendering on
- `renderer`: the `GtkCellRenderer` to get the allocation for
- `cellArea`: the whole allocated area for `area` in `widget` for this row

**Returns** where to store the allocation for `renderer`

> **Deprecated since 4.10.**

### `getCellAtPosition`

```ts
getCellAtPosition(context: Gtk.CellAreaContext, widget: Gtk.Widget, cellArea: Gdk.Rectangle, x: number, y: number): [Gtk.CellRenderer, Gdk.Rectangle]
```

Gets the `GtkCellRenderer` at `x` and `y` coordinates inside `area` and optionally
returns the full cell allocation for it inside `cell_area`.

**Parameters**

- `context`: the `GtkCellArea`Context used to hold sizes for `area`.
- `widget`: the `GtkWidget` that `area` is rendering on
- `cellArea`: the whole allocated area for `area` in `widget` for this row
- `x`: the x position
- `y`: the y position

**Returns** Tuple of:

- `result`: the `GtkCellRenderer` at `x` and `y`.
- `allocArea`: where to store the inner allocated area of the returned cell renderer

> **Deprecated since 4.10.**

### `getCurrentPathString`

```ts
getCurrentPathString(): string
```

Gets the current `GtkTreePath` string for the currently
applied `GtkTreeIter`, this is implicitly updated when
`gtk_cell_area_apply_attributes()` is called and can be
used to interact with renderers from `GtkCellArea`
subclasses.

**Returns** The current `GtkTreePath` string for the current
attributes applied to `area`. This string belongs to the area and
should not be freed.

### `getEditedCell`

```ts
getEditedCell(): Gtk.CellRenderer | null
```

Gets the `GtkCellRenderer` in `area` that is currently
being edited.

**Returns** The currently edited `GtkCellRenderer`

> **Deprecated since 4.10.**

### `getEditWidget`

```ts
getEditWidget(): Gtk.CellEditable | null
```

Gets the `GtkCellEditable` widget currently used
to edit the currently edited cell.

**Returns** The currently active `GtkCellEditable` widget

> **Deprecated since 4.10.**

### `getFocusCell`

```ts
getFocusCell(): Gtk.CellRenderer | null
```

Retrieves the currently focused cell for `area`

**Returns** the currently focused cell in `area`.

> **Deprecated since 4.10.**

### `getFocusFromSibling`

```ts
getFocusFromSibling(renderer: Gtk.CellRenderer): Gtk.CellRenderer | null
```

Gets the `GtkCellRenderer` which is expected to be focusable
for which `renderer` is, or may be a sibling.

This is handy for `GtkCellArea` subclasses when handling events,
after determining the renderer at the event location it can
then chose to activate the focus cell for which the event
cell may have been a sibling.

**Parameters**

- `renderer`: the `GtkCellRenderer`

**Returns** the `GtkCellRenderer`
  for which `renderer` is a sibling

> **Deprecated since 4.10.**

### `getFocusSiblings`

```ts
getFocusSiblings(renderer: Gtk.CellRenderer): Gtk.CellRenderer[]
```

Gets the focus sibling cell renderers for `renderer`.

**Parameters**

- `renderer`: the `GtkCellRenderer` expected to have focus

**Returns** A `GList` of `GtkCellRenderer`s.
      The returned list is internal and should not be freed.

> **Deprecated since 4.10.**

### `getPreferredHeight`

```ts
getPreferredHeight(context: Gtk.CellAreaContext, widget: Gtk.Widget): [number, number]
```

Retrieves a cell area’s initial minimum and natural height.

`area` will store some geometrical information in `context` along the way;
when requesting sizes over an arbitrary number of rows, it’s not important
to check the `minimum_height` and `natural_height` of this call but rather to
consult `gtk_cell_area_context_get_preferred_height()` after a series of
requests.

**Parameters**

- `context`: the `GtkCellArea`Context to perform this request with
- `widget`: the `GtkWidget` where `area` will be rendering

**Returns** Tuple of:

- `minimumHeight`: location to store the minimum height
- `naturalHeight`: location to store the natural height

> **Deprecated since 4.10.**

### `getPreferredHeightForWidth`

```ts
getPreferredHeightForWidth(context: Gtk.CellAreaContext, widget: Gtk.Widget, width: number): [number, number]
```

Retrieves a cell area’s minimum and natural height if it would be given
the specified `width`.

`area` stores some geometrical information in `context` along the way
while calling `gtk_cell_area_get_preferred_width()`. It’s important to
perform a series of `gtk_cell_area_get_preferred_width()` requests with
`context` first and then call `gtk_cell_area_get_preferred_height_for_width()`
on each cell area individually to get the height for width of each
fully requested row.

If at some point, the width of a single row changes, it should be
requested with `gtk_cell_area_get_preferred_width()` again and then
the full width of the requested rows checked again with
`gtk_cell_area_context_get_preferred_width()`.

**Parameters**

- `context`: the `GtkCellArea`Context which has already been requested for widths.
- `widget`: the `GtkWidget` where `area` will be rendering
- `width`: the width for which to check the height of this area

**Returns** Tuple of:

- `minimumHeight`: location to store the minimum height
- `naturalHeight`: location to store the natural height

> **Deprecated since 4.10.**

### `getPreferredWidth`

```ts
getPreferredWidth(context: Gtk.CellAreaContext, widget: Gtk.Widget): [number, number]
```

Retrieves a cell area’s initial minimum and natural width.

`area` will store some geometrical information in `context` along the way;
when requesting sizes over an arbitrary number of rows, it’s not important
to check the `minimum_width` and `natural_width` of this call but rather to
consult `gtk_cell_area_context_get_preferred_width()` after a series of
requests.

**Parameters**

- `context`: the `GtkCellArea`Context to perform this request with
- `widget`: the `GtkWidget` where `area` will be rendering

**Returns** Tuple of:

- `minimumWidth`: location to store the minimum width
- `naturalWidth`: location to store the natural width

> **Deprecated since 4.10.**

### `getPreferredWidthForHeight`

```ts
getPreferredWidthForHeight(context: Gtk.CellAreaContext, widget: Gtk.Widget, height: number): [number, number]
```

Retrieves a cell area’s minimum and natural width if it would be given
the specified `height`.

`area` stores some geometrical information in `context` along the way
while calling `gtk_cell_area_get_preferred_height()`. It’s important to
perform a series of `gtk_cell_area_get_preferred_height()` requests with
`context` first and then call `gtk_cell_area_get_preferred_width_for_height()`
on each cell area individually to get the height for width of each
fully requested row.

If at some point, the height of a single row changes, it should be
requested with `gtk_cell_area_get_preferred_height()` again and then
the full height of the requested rows checked again with
`gtk_cell_area_context_get_preferred_height()`.

**Parameters**

- `context`: the `GtkCellArea`Context which has already been requested for widths.
- `widget`: the `GtkWidget` where `area` will be rendering
- `height`: the height for which to check the width of this area

**Returns** Tuple of:

- `minimumWidth`: location to store the minimum width
- `naturalWidth`: location to store the natural width

> **Deprecated since 4.10.**

### `getRequestMode`

```ts
getRequestMode(): Gtk.SizeRequestMode
```

Gets whether the area prefers a height-for-width layout
or a width-for-height layout.

**Returns** The `GtkSizeRequestMode` preferred by `area`.

### `hasRenderer`

```ts
hasRenderer(renderer: Gtk.CellRenderer): boolean
```

Checks if `area` contains `renderer`.

**Parameters**

- `renderer`: the `GtkCellRenderer` to check

**Returns** `true` if `renderer` is in the `area`.

> **Deprecated since 4.10.**

### `innerCellArea`

```ts
innerCellArea(widget: Gtk.Widget, cellArea: Gdk.Rectangle): Gdk.Rectangle
```

This is a convenience function for `GtkCellArea` implementations
to get the inner area where a given `GtkCellRenderer` will be
rendered. It removes any padding previously added by `gtk_cell_area_request_renderer()`.

**Parameters**

- `widget`: the `GtkWidget` that `area` is rendering onto
- `cellArea`: the `widget` relative coordinates where one of `area`’s cells is to be placed

**Returns** the return location for the inner cell area

> **Deprecated since 4.10.**

### `isActivatable`

```ts
isActivatable(): boolean
```

Returns whether the area can do anything when activated,
after applying new attributes to `area`.

**Returns** whether `area` can do anything when activated.

> **Deprecated since 4.10.**

### `isFocusSibling`

```ts
isFocusSibling(renderer: Gtk.CellRenderer, sibling: Gtk.CellRenderer): boolean
```

Returns whether `sibling` is one of `renderer`’s focus siblings
(see `gtk_cell_area_add_focus_sibling()`).

**Parameters**

- `renderer`: the `GtkCellRenderer` expected to have focus
- `sibling`: the `GtkCellRenderer` to check against `renderer`’s sibling list

**Returns** `true` if `sibling` is a focus sibling of `renderer`

> **Deprecated since 4.10.**

### `remove`

```ts
remove(renderer: Gtk.CellRenderer): void
```

Removes `renderer` from `area`.

**Parameters**

- `renderer`: the `GtkCellRenderer` to remove from `area`

> **Deprecated since 4.10.**

### `removeFocusSibling`

```ts
removeFocusSibling(renderer: Gtk.CellRenderer, sibling: Gtk.CellRenderer): void
```

Removes `sibling` from `renderer`’s focus sibling list
(see `gtk_cell_area_add_focus_sibling()`).

**Parameters**

- `renderer`: the `GtkCellRenderer` expected to have focus
- `sibling`: the `GtkCellRenderer` to remove from `renderer`’s focus area

> **Deprecated since 4.10.**

### `requestRenderer`

```ts
requestRenderer(renderer: Gtk.CellRenderer, orientation: Gtk.Orientation, widget: Gtk.Widget, forSize: number): [number, number]
```

This is a convenience function for `GtkCellArea` implementations
to request size for cell renderers. It’s important to use this
function to request size and then use `gtk_cell_area_inner_cell_area()`
at render and event time since this function will add padding
around the cell for focus painting.

**Parameters**

- `renderer`: the `GtkCellRenderer` to request size for
- `orientation`: the `GtkOrientation` in which to request size
- `widget`: the `GtkWidget` that `area` is rendering onto
- `forSize`: the allocation contextual size to request for, or -1 if the base request for the orientation is to be returned.

**Returns** Tuple of:

- `minimumSize`: location to store the minimum size
- `naturalSize`: location to store the natural size

> **Deprecated since 4.10.**

### `setFocusCell`

```ts
setFocusCell(renderer: Gtk.CellRenderer | null): void
```

Explicitly sets the currently focused cell to `renderer`.

This is generally called by implementations of
`GtkCellAreaClass.focus()` or `GtkCellAreaClass.event()`,
however it can also be used to implement functions such
as `gtk_tree_view_set_cursor_on_cell()`.

**Parameters**

- `renderer`: the `GtkCellRenderer` to give focus to

> **Deprecated since 4.10.**

### `snapshot`

```ts
snapshot(context: Gtk.CellAreaContext, widget: Gtk.Widget, snapshot: Gtk.Snapshot, backgroundArea: Gdk.Rectangle, cellArea: Gdk.Rectangle, flags: Gtk.CellRendererState, paintFocus: boolean): void
```

Snapshots `area`’s cells according to `area`’s layout onto at
the given coordinates.

**Parameters**

- `context`: the `GtkCellArea`Context for this row of data.
- `widget`: the `GtkWidget` that `area` is rendering to
- `snapshot`: the `GtkSnapshot` to draw to
- `backgroundArea`: the `widget` relative coordinates for `area`’s background
- `cellArea`: the `widget` relative coordinates for `area`
- `flags`: the `GtkCellRenderer`State for `area` in this row.
- `paintFocus`: whether `area` should paint focus on focused cells for focused rows or not.

> **Deprecated since 4.10.**

### `stopEditing`

```ts
stopEditing(canceled: boolean): void
```

Explicitly stops the editing of the currently edited cell.

If `canceled` is `true`, the currently edited cell renderer
will emit the ::editing-canceled signal, otherwise the
the ::editing-done signal will be emitted on the current
edit widget.

See `gtk_cell_area_get_edited_cell()` and `gtk_cell_area_get_edit_widget()`.

**Parameters**

- `canceled`: whether editing was canceled.

> **Deprecated since 4.10.**
