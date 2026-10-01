---
description: "Stores geometrical information for a series of rows in a GtkCellArea The GtkCellAreaContext object is created by a given GtkCellArea implementation via its GtkCellAreaClass.create_context() virtual method and is used ..."
---

# GtkCellAreaContext

Stores geometrical information for a series of rows in a GtkCellArea

The `GtkCellAreaContext` object is created by a given `GtkCellArea`
implementation via its `GtkCellAreaClass.create_context()` virtual
method and is used to store cell sizes and alignments for a series of
`GtkTreeModel` rows that are requested and rendered in the same context.

`GtkCellLayout` widgets can create any number of contexts in which to
request and render groups of data rows. However, it’s important that the
same context which was used to request sizes for a given `GtkTreeModel`
row also be used for the same row when calling other `GtkCellArea` APIs
such as `gtk_cell_area_render()` and `gtk_cell_area_event()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

```tsx
import { GtkCellAreaContext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkCellAreaContext**

## Props

`ref` receives the `Gtk.CellAreaContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `area`

`Gtk.CellArea` · construct-only · deprecated since 4.10

The `GtkCellArea` this context was created by

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `minimumHeight`

`number` · default `-1` · read-only, observe with `onNotifyMinimumHeight` · deprecated since 4.10

The minimum height for the `GtkCellArea` in this context
for all `GtkTreeModel` rows that this context was requested
for using `gtk_cell_area_get_preferred_height()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `minimumWidth`

`number` · default `-1` · read-only, observe with `onNotifyMinimumWidth` · deprecated since 4.10

The minimum width for the `GtkCellArea` in this context
for all `GtkTreeModel` rows that this context was requested
for using `gtk_cell_area_get_preferred_width()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `naturalHeight`

`number` · default `-1` · read-only, observe with `onNotifyNaturalHeight` · deprecated since 4.10

The natural height for the `GtkCellArea` in this context
for all `GtkTreeModel` rows that this context was requested
for using `gtk_cell_area_get_preferred_height()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `naturalWidth`

`number` · default `-1` · read-only, observe with `onNotifyNaturalWidth` · deprecated since 4.10

The natural width for the `GtkCellArea` in this context
for all `GtkTreeModel` rows that this context was requested
for using `gtk_cell_area_get_preferred_width()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5

## Methods

Methods are called on the `Gtk.CellAreaContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `allocate`

```ts
allocate(width: number, height: number): void
```

Allocates a width and/or a height for all rows which are to be
rendered with `context`.

Usually allocation is performed only horizontally or sometimes
vertically since a group of rows are usually rendered side by
side vertically or horizontally and share either the same width
or the same height. Sometimes they are allocated in both horizontal
and vertical orientations producing a homogeneous effect of the
rows. This is generally the case for `GtkTreeView` when
`GtkTreeView:fixed-height-mode` is enabled.

**Parameters**

- `width`: the allocated width for all `GtkTreeModel` rows rendered with `context`, or -1
- `height`: the allocated height for all `GtkTreeModel` rows rendered with `context`, or -1

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getAllocation`

```ts
getAllocation(): [number, number]
```

Fetches the current allocation size for `context`.

If the context was not allocated in width or height, or if the
context was recently reset with `gtk_cell_area_context_reset()`,
the returned value will be -1.

**Returns** Tuple of:

- `width`: location to store the allocated width
- `height`: location to store the allocated height

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getArea`

```ts
getArea(): Gtk.CellArea
```

Fetches the `GtkCellArea` this `context` was created by.

This is generally unneeded by layouting widgets; however,
it is important for the context implementation itself to
fetch information about the area it is being used for.

For instance at `GtkCellAreaContextClass.allocate()` time
it’s important to know details about any cell spacing
that the `GtkCellArea` is configured with in order to
compute a proper allocation.

**Returns** the `GtkCellArea` this context was created by.

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getPreferredHeight`

```ts
getPreferredHeight(): [number, number]
```

Gets the accumulative preferred height for all rows which have been
requested with this context.

After `gtk_cell_area_context_reset()` is called and/or before ever
requesting the size of a `GtkCellArea`, the returned values are 0.

**Returns** Tuple of:

- `minimumHeight`: location to store the minimum height
- `naturalHeight`: location to store the natural height

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getPreferredHeightForWidth`

```ts
getPreferredHeightForWidth(width: number): [number, number]
```

Gets the accumulative preferred height for `width` for all rows
which have been requested for the same said `width` with this context.

After `gtk_cell_area_context_reset()` is called and/or before ever
requesting the size of a `GtkCellArea`, the returned values are -1.

**Parameters**

- `width`: a proposed width for allocation

**Returns** Tuple of:

- `minimumHeight`: location to store the minimum height
- `naturalHeight`: location to store the natural height

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getPreferredWidth`

```ts
getPreferredWidth(): [number, number]
```

Gets the accumulative preferred width for all rows which have been
requested with this context.

After `gtk_cell_area_context_reset()` is called and/or before ever
requesting the size of a `GtkCellArea`, the returned values are 0.

**Returns** Tuple of:

- `minimumWidth`: location to store the minimum width
- `naturalWidth`: location to store the natural width

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `getPreferredWidthForHeight`

```ts
getPreferredWidthForHeight(height: number): [number, number]
```

Gets the accumulative preferred width for `height` for all rows which
have been requested for the same said `height` with this context.

After `gtk_cell_area_context_reset()` is called and/or before ever
requesting the size of a `GtkCellArea`, the returned values are -1.

**Parameters**

- `height`: a proposed height for allocation

**Returns** Tuple of:

- `minimumWidth`: location to store the minimum width
- `naturalWidth`: location to store the natural width

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `pushPreferredHeight`

```ts
pushPreferredHeight(minimumHeight: number, naturalHeight: number): void
```

Causes the minimum and/or natural height to grow if the new
proposed sizes exceed the current minimum and natural height.

This is used by `GtkCellAreaContext` implementations during
the request process over a series of `GtkTreeModel` rows to
progressively push the requested height over a series of
`gtk_cell_area_get_preferred_height()` requests.

**Parameters**

- `minimumHeight`: the proposed new minimum height for `context`
- `naturalHeight`: the proposed new natural height for `context`

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `pushPreferredWidth`

```ts
pushPreferredWidth(minimumWidth: number, naturalWidth: number): void
```

Causes the minimum and/or natural width to grow if the new
proposed sizes exceed the current minimum and natural width.

This is used by `GtkCellAreaContext` implementations during
the request process over a series of `GtkTreeModel` rows to
progressively push the requested width over a series of
`gtk_cell_area_get_preferred_width()` requests.

**Parameters**

- `minimumWidth`: the proposed new minimum width for `context`
- `naturalWidth`: the proposed new natural width for `context`

> **Deprecated since 4.10.** This object will be removed in GTK 5

### `reset`

```ts
reset(): void
```

Resets any previously cached request and allocation
data.

When underlying `GtkTreeModel` data changes its
important to reset the context if the content
size is allowed to shrink. If the content size
is only allowed to grow (this is usually an option
for views rendering large data stores as a measure
of optimization), then only the row that changed
or was inserted needs to be (re)requested with
`gtk_cell_area_get_preferred_width()`.

When the new overall size of the context requires
that the allocated size changes (or whenever this
allocation changes at all), the variable row
sizes need to be re-requested for every row.

For instance, if the rows are displayed all with
the same width from top to bottom then a change
in the allocated width necessitates a recalculation
of all the displayed row heights using
`gtk_cell_area_get_preferred_height_for_width()`.

> **Deprecated since 4.10.** This object will be removed in GTK 5
