---
description: "A GtkComboBox is a widget that allows the user to choose from a list of valid choices."
---

# GtkComboBox

A `GtkComboBox` is a widget that allows the user to choose from a list of
valid choices.



The `GtkComboBox` displays the selected choice; when activated, the
`GtkComboBox` displays a popup which allows the user to make a new choice.

The `GtkComboBox` uses the model-view pattern; the list of valid choices
is specified in the form of a tree model, and the display of the choices
can be adapted to the data in the model by using cell renderers, as you
would in a tree view. This is possible since `GtkComboBox` implements the
`Gtk.CellLayout` interface. The tree model holding the valid
choices is not restricted to a flat list, it can be a real tree, and the
popup will reflect the tree structure.

To allow the user to enter values not in the model, the
`Gtk.ComboBox.hasEntry` property allows the `GtkComboBox` to
contain a `Gtk.Entry`. This entry can be accessed by calling
`Gtk.ComboBox.getChild()` on the combo box.

For a simple list of textual choices, the model-view API of `GtkComboBox`
can be a bit overwhelming. In this case, `Gtk.ComboBoxText` offers
a simple alternative. Both `GtkComboBox` and `GtkComboBoxText` can contain
an entry.

### CSS nodes

```
combobox
├── box.linked
│   ╰── button.combo
│       ╰── box
│           ├── cellview
│           ╰── arrow
╰── window.popup
```

A normal combobox contains a box with the .linked class, a button
with the .combo class and inside those buttons, there are a cellview and
an arrow.

```
combobox
├── box.linked
│   ├── entry.combo
│   ╰── button.combo
│       ╰── box
│           ╰── arrow
╰── window.popup
```

A `GtkComboBox` with an entry has a single CSS node with name combobox.
It contains a box with the .linked class. That box contains an entry and
a button, both with the .combo class added. The button also contains another
node with name arrow.

### Accessibility

`GtkComboBox` uses the `Gtk.AccessibleRole.combo_box` role.

> **Deprecated since 4.10.** Use `Gtk.DropDown` instead

```tsx
import { GtkComboBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkComboBox**

Implements `GtkAccessible`, `GtkBuildable`, `GtkCellEditable`, `GtkCellLayout`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ComboBox` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`number` · default `-1`

The item which is currently active.

If the model is a non-flat treemodel, and the active item is not an
immediate child of the root of the tree, this property has the value
`gtk_tree_path_get_indices (path)[0]`, where `path` is the
`Gtk.TreePath` of the active item.

### `activeId`

`string` · default `null`

The value of the ID column of the active row.

### `buttonSensitivity`

`Gtk.SensitivityType` · default `GTK_SENSITIVITY_AUTO`

Whether the dropdown button is sensitive when
the model is empty.

### `child`

`Gtk.Widget | ReactElement`

The child widget.

### `editingCanceled`

`boolean` · default `false` · from `GtkCellEditable`

Indicates whether editing on the cell has been canceled.

### `entryTextColumn`

`number` · default `-1`

The model column to associate with strings from the entry.

This is property only relevant if the combo was created with
`Gtk.ComboBox.hasEntry` is `true`.

### `hasEntry`

`boolean` · default `false` · construct-only

Whether the combo box has an entry.

### `hasFrame`

`boolean` · default `true`

The `has-frame` property controls whether a frame is drawn around the entry.

### `idColumn`

`number` · default `-1`

The model column that provides string IDs for the values
in the model, if != -1.

### `model`

`Gtk.TreeModel | ReactElement`

The model from which the combo box takes its values.

### `popupFixedWidth`

`boolean` · default `true`

Whether the popup's width should be a fixed width matching the
allocated width of the combo box.

### `popupShown`

`boolean` · default `false` · read-only, observe with `onNotifyPopupShown`

Whether the combo boxes dropdown is popped up.

Note that this property is mainly useful, because
it allows you to connect to notify::popup-shown.

## Signals

### `onActivate`

```ts
(self: Gtk.ComboBox) => void
```

Emitted to when the combo box is activated.

The `::activate` signal on `GtkComboBox` is an action signal and
emitting it causes the combo box to pop up its dropdown.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.6._

### `onChanged`

```ts
(self: Gtk.ComboBox) => void
```

Emitted when the active item is changed.

The can be due to the user selecting a different item from the list,
or due to a call to `Gtk.ComboBox.setActiveIter()`. It will
also be emitted while typing into the entry of a combo box with an entry.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onEditingDone`

```ts
(self: Gtk.ComboBox) => void
```

From `GtkCellEditable`.

This signal is a sign for the cell renderer to update its
value from the `cell_editable`.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing, e.g.
`GtkEntry` emits this signal when the user presses Enter. Typical things to
do in a handler for ::editing-done are to capture the edited value,
disconnect the `cell_editable` from signals on the `GtkCellRenderer`, etc.

`gtk_cell_editable_editing_done()` is a convenience method
for emitting `GtkCellEditable::editing-done`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onFormatEntryText`

```ts
(path: string, self: Gtk.ComboBox) => string | undefined
```

Emitted to allow changing how the text in a combo box's entry is displayed.

See `Gtk.ComboBox.hasEntry`.

Connect a signal handler which returns an allocated string representing
`path`. That string will then be used to set the text in the combo box's
entry. The default signal handler uses the text from the
`Gtk.ComboBox.entryTextColumn` model column.

Here's an example signal handler which fetches data from the model and
displays it in the entry.
```c
static char *
format_entry_text_callback (GtkComboBox *combo,
                            const char *path,
                            gpointer     user_data)
{
  GtkTreeIter iter;
  GtkTreeModel model;
  double       value;

  model = gtk_combo_box_get_model (combo);

  gtk_tree_model_get_iter_from_string (model, &iter, path);
  gtk_tree_model_get (model, &iter,
                      THE_DOUBLE_VALUE_COLUMN, &value,
                      -1);

  return g_strdup_printf ("%g", value);
}
```

**Parameters**

- `path`: the `Gtk.TreePath` string from the combo box's current model to format text for
- `self`: The instance the signal was emitted on.

**Returns** a newly allocated string representing `path`
  for the current `GtkComboBox` model.

### `onMoveActive`

```ts
(scrollType: Gtk.ScrollType, self: Gtk.ComboBox) => void
```

Emitted to move the active selection.

This is an [keybinding signal](class.SignalAction.html).

**Parameters**

- `scrollType`: a `GtkScrollType`
- `self`: The instance the signal was emitted on.

### `onPopdown`

```ts
(self: Gtk.ComboBox) => boolean | undefined
```

Emitted to popdown the combo box list.

This is an [keybinding signal](class.SignalAction.html).

The default bindings for this signal are Alt+Up and Escape.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** whether the combo box was popped down

### `onPopup`

```ts
(self: Gtk.ComboBox) => void
```

Emitted to popup the combo box list.

This is an [keybinding signal](class.SignalAction.html).

The default binding for this signal is Alt+Down.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onRemoveWidget`

```ts
(self: Gtk.ComboBox) => void
```

From `GtkCellEditable`.

This signal is meant to indicate that the cell is finished
editing, and the `cell_editable` widget is being removed and may
subsequently be destroyed.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing. It must
be emitted after the `GtkCellEditable::editing-done` signal,
to give the cell renderer a chance to update the cell's value
before the widget is removed.

`gtk_cell_editable_remove_widget()` is a convenience method
for emitting `GtkCellEditable::remove-widget`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ComboBox` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): number
```

Returns the index of the currently active item.

If the model is a non-flat treemodel, and the active item is not
an immediate child of the root of the tree, this function returns
`gtk_tree_path_get_indices (path)[0]`, where `path` is the
`Gtk.TreePath` of the active item.

**Returns** An integer which is the index of the currently active item,
  or -1 if there’s no active item

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getActiveId`

```ts
getActiveId(): string | null
```

Returns the ID of the active row of `combo_box`.

This value is taken from the active row and the column specified
by the `Gtk.ComboBox.idColumn` property of `combo_box`
(see `Gtk.ComboBox.setIdColumn()`).

The returned value is an interned string which means that you can
compare the pointer by value to other interned strings and that you
must not free it.

If the `Gtk.ComboBox.idColumn` property of `combo_box` is
not set, or if no row is active, or if the active row has a `null`
ID value, then `null` is returned.

**Returns** the ID of the active row

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getActiveIter`

```ts
getActiveIter(): [boolean, Gtk.TreeIter]
```

Sets `iter` to point to the currently active item.

If no item is active, `iter` is left unchanged.

**Returns** Tuple of:

- `result`: `true` if `iter` was set, `false` otherwise
- `iter`: A `GtkTreeIter`

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getButtonSensitivity`

```ts
getButtonSensitivity(): Gtk.SensitivityType
```

Returns whether the combo box sets the dropdown button
sensitive or not when there are no items in the model.

**Returns** `GTK_SENSITIVITY_ON` if the dropdown button
  is sensitive when the model is empty, `GTK_SENSITIVITY_OFF`
  if the button is always insensitive or `GTK_SENSITIVITY_AUTO`
  if it is only sensitive as long as the model has one item to
  be selected.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `combo_box`.

**Returns** the child widget of `combo_box`

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getEntryTextColumn`

```ts
getEntryTextColumn(): number
```

Returns the column which `combo_box` is using to get the strings
from to display in the internal entry.

**Returns** A column in the data source model of `combo_box`.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getHasEntry`

```ts
getHasEntry(): boolean
```

Returns whether the combo box has an entry.

**Returns** whether there is an entry in `combo_box`.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getIdColumn`

```ts
getIdColumn(): number
```

Returns the column which `combo_box` is using to get string IDs
for values from.

**Returns** A column in the data source model of `combo_box`.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getModel`

```ts
getModel(): Gtk.TreeModel | null
```

Returns the `GtkTreeModel` of `combo_box`.

**Returns** A `GtkTreeModel` which was passed
  during construction.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getPopupFixedWidth`

```ts
getPopupFixedWidth(): boolean
```

Gets whether the popup uses a fixed width.

**Returns** `true` if the popup uses a fixed width

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `popdown`

```ts
popdown(): void
```

Hides the menu or dropdown list of `combo_box`.

This function is mostly intended for use by accessibility technologies;
applications should have little use for it.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `popup`

```ts
popup(): void
```

Pops up the menu or dropdown list of `combo_box`.

This function is mostly intended for use by accessibility technologies;
applications should have little use for it.

Before calling this, `combo_box` must be mapped, or nothing will happen.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `popupForDevice`

```ts
popupForDevice(device: Gdk.Device): void
```

Pops up the menu of `combo_box`.

Note that currently this does not do anything with the device, as it was
previously only used for list-mode combo boxes, and those were removed
in GTK 4. However, it is retained in case similar functionality is added
back later.

**Parameters**

- `device`: a `GdkDevice`

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setActive`

```ts
setActive(index: number): void
```

Sets the active item of `combo_box` to be the item at `index`.

**Parameters**

- `index`: An index in the model passed during construction, or -1 to have no active item

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setActiveId`

```ts
setActiveId(activeId: string | null): boolean
```

Changes the active row of `combo_box` to the one that has an ID equal to
`active_id`.

If `active_id` is `null`, the active row is unset. Rows having
a `null` ID string cannot be made active by this function.

If the `Gtk.ComboBox.idColumn` property of `combo_box` is
unset or if no row has the given ID then the function does nothing
and returns `false`.

**Parameters**

- `activeId`: the ID of the row to select

**Returns** `true` if a row with a matching ID was found. If a `null`
  `active_id` was given to unset the active row, the function
  always returns `true`.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setActiveIter`

```ts
setActiveIter(iter: Gtk.TreeIter | null): void
```

Sets the current active item to be the one referenced by `iter`.

If `iter` is `null`, the active item is unset.

**Parameters**

- `iter`: The `GtkTreeIter`

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setButtonSensitivity`

```ts
setButtonSensitivity(sensitivity: Gtk.SensitivityType): void
```

Sets whether the dropdown button of the combo box should update
its sensitivity depending on the model contents.

**Parameters**

- `sensitivity`: specify the sensitivity of the dropdown button

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `combo_box`.

**Parameters**

- `child`: the child widget

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setEntryTextColumn`

```ts
setEntryTextColumn(textColumn: number): void
```

Sets the model column which `combo_box` should use to get strings
from to be `text_column`.

For this column no separate
`Gtk.CellRenderer` is needed.

The column `text_column` in the model of `combo_box` must be of
type `G_TYPE_STRING`.

This is only relevant if `combo_box` has been created with
`Gtk.ComboBox.hasEntry` as `true`.

**Parameters**

- `textColumn`: A column in `model` to get the strings from for the internal entry

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setIdColumn`

```ts
setIdColumn(idColumn: number): void
```

Sets the model column which `combo_box` should use to get string IDs
for values from.

The column `id_column` in the model of `combo_box` must be of type
`G_TYPE_STRING`.

**Parameters**

- `idColumn`: A column in `model` to get string IDs for values from

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setModel`

```ts
setModel(model: Gtk.TreeModel | null): void
```

Sets the model used by `combo_box` to be `model`.

Will unset a previously set model (if applicable). If model is `null`,
then it will unset the model.

Note that this function does not clear the cell renderers, you have to
call `Gtk.CellLayout.clear()` yourself if you need to set up different
cell renderers for the new model.

**Parameters**

- `model`: A `GtkTreeModel`

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setPopupFixedWidth`

```ts
setPopupFixedWidth(fixed: boolean): void
```

Specifies whether the popup’s width should be a fixed width.

If `fixed` is `true`, the popup's width is set to match the
allocated width of the combo box.

**Parameters**

- `fixed`: whether to use a fixed popup width

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `setRowSeparatorFunc`

```ts
setRowSeparatorFunc(func: Gtk.TreeViewRowSeparatorFunc | null): void
```

Sets the row separator function, which is used to determine
whether a row should be drawn as a separator.

If the row separator function is `null`, no separators are drawn.
This is the default value.

**Parameters**

- `func`: a `GtkTreeViewRowSeparatorFunc`

> **Deprecated since 4.10.** Use `Gtk.DropDown`
