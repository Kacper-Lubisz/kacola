---
description: "Renders a combobox in a cell GtkCellRendererCombo renders text in a cell like GtkCellRendererText from which it is derived."
---

# GtkCellRendererCombo

Renders a combobox in a cell

`GtkCellRendererCombo` renders text in a cell like `GtkCellRendererText` from
which it is derived. But while `GtkCellRendererText` offers a simple entry to
edit the text, `GtkCellRendererCombo` offers a `GtkComboBox`
widget to edit the text. The values to display in the combo box are taken from
the tree model specified in the `GtkCellRendererCombo`:model property.

The combo cell renderer takes care of adding a text cell renderer to the combo
box and sets it to display the column specified by its
`GtkCellRendererCombo`:text-column property. Further properties of the combo box
can be set in a handler for the `GtkCellRenderer::editing-started` signal.

> **Deprecated since 4.10.** List views use widgets to display their contents. You should use `Gtk.DropDown` instead

```tsx
import { GtkCellRendererCombo } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkCellRenderer](.gtkx/reference/gtk/cell-renderer.md) → [GtkCellRendererText](.gtkx/reference/gtk/cell-renderer-text.md) → **GtkCellRendererCombo**

## Props

`ref` receives the `Gtk.CellRendererCombo` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hasEntry`

`boolean` · default `true`

If `true`, the cell renderer will include an entry and allow to enter
values other than the ones in the popup list.

### `model`

`Gtk.TreeModel | ReactElement`

Holds a tree model containing the possible values for the combo box.
Use the text_column property to specify the column holding the values.

### `textColumn`

`number` · default `-1`

Specifies the model column which holds the possible values for the
combo box.

Note that this refers to the model specified in the model property,
not the model backing the tree view to which
this cell renderer is attached.

`GtkCellRendererCombo` automatically adds a text cell renderer for
this column to its combo box.

## Signals

### `onChanged`

```ts
(pathString: string, newIter: Gtk.TreeIter, self: Gtk.CellRendererCombo) => void
```

This signal is emitted each time after the user selected an item in
the combo box, either by using the mouse or the arrow keys.  Contrary
to GtkComboBox, GtkCellRendererCombo::changed is not emitted for
changes made to a selected item in the entry.  The argument `new_iter`
corresponds to the newly selected item in the combo box and it is relative
to the GtkTreeModel set via the model property on GtkCellRendererCombo.

Note that as soon as you change the model displayed in the tree view,
the tree view will immediately cease the editing operating.  This
means that you most probably want to refrain from changing the model
until the combo cell renderer emits the edited or editing_canceled signal.

**Parameters**

- `pathString`: a string of the path identifying the edited cell (relative to the tree view model)
- `newIter`: the new iter selected in the combo box (relative to the combo box model)
- `self`: The instance the signal was emitted on.
