---
description: "A GtkComboBoxText is a simple variant of GtkComboBox for text-only use cases."
---

# GtkComboBoxText

A `GtkComboBoxText` is a simple variant of `GtkComboBox` for text-only
use cases.



`GtkComboBoxText` hides the model-view complexity of `GtkComboBox`.

To create a `GtkComboBoxText`, use `Gtk.ComboBoxText.new()` or
`Gtk.ComboBoxText.newWithEntry()`.

You can add items to a `GtkComboBoxText` with
`Gtk.ComboBoxText.appendText()`,
`Gtk.ComboBoxText.insertText()` or
`Gtk.ComboBoxText.prependText()` and remove options with
`Gtk.ComboBoxText.remove()`.

If the `GtkComboBoxText` contains an entry (via the
`Gtk.ComboBox.hasEntry` property), its contents can be retrieved
using `Gtk.ComboBoxText.getActiveText()`.

You should not call `Gtk.ComboBox.setModel()` or attempt to pack more
cells into this combo box via its `Gtk.CellLayout` interface.

### GtkComboBoxText as GtkBuildable

The `GtkComboBoxText` implementation of the `GtkBuildable` interface supports
adding items directly using the `<items>` element and specifying `<item>`
elements for each item. Each `<item>` element can specify the “id”
corresponding to the appended text and also supports the regular
translation attributes “translatable”, “context” and “comments”.

Here is a UI definition fragment specifying `GtkComboBoxText` items:
```xml
<object class="GtkComboBoxText">
  <items>
    <item translatable="yes" id="factory">Factory</item>
    <item translatable="yes" id="home">Home</item>
    <item translatable="yes" id="subway">Subway</item>
  </items>
</object>
```

### CSS nodes

```
combobox
╰── box.linked
    ├── entry.combo
    ├── button.combo
    ╰── window.popup
```

`GtkComboBoxText` has a single CSS node with name combobox. It adds
the style class .combo to the main CSS nodes of its entry and button
children, and the .linked class to the node of its internal box.

> **Deprecated since 4.10.** Use `Gtk.DropDown` with a `Gtk.StringList` instead

```tsx
import { GtkComboBoxText } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkComboBox](.gtkx/reference/gtk/combo-box.md) → **GtkComboBoxText**

Implements `GtkAccessible`, `GtkBuildable`, `GtkCellEditable`, `GtkCellLayout`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ComboBoxText` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.ComboBoxText` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(id: string | null, text: string): void
```

Appends `text` to the list of strings stored in `combo_box`.

If `id` is non-`null` then it is used as the ID of the row.

This is the same as calling `Gtk.ComboBoxText.insert()`
with a position of -1.

**Parameters**

- `id`: a string ID for this value
- `text`: A string

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `appendText`

```ts
appendText(text: string): void
```

Appends `text` to the list of strings stored in `combo_box`.

This is the same as calling `Gtk.ComboBoxText.insertText()`
with a position of -1.

**Parameters**

- `text`: A string

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `getActiveText`

```ts
getActiveText(): string | null
```

Returns the currently active string in `combo_box`.

If no row is currently selected, `null` is returned.
If `combo_box` contains an entry, this function will
return its contents (which will not necessarily
be an item from the list).

**Returns** a newly allocated
  string containing the currently active text.
  Must be freed with `g_free()`.

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `insert`

```ts
insert(position: number, id: string | null, text: string): void
```

Inserts `text` at `position` in the list of strings stored in `combo_box`.

If `id` is non-`null` then it is used as the ID of the row.
See `Gtk.ComboBox.idColumn`.

If `position` is negative then `text` is appended.

**Parameters**

- `position`: An index to insert `text`
- `id`: a string ID for this value
- `text`: A string to display

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `insertText`

```ts
insertText(position: number, text: string): void
```

Inserts `text` at `position` in the list of strings stored in `combo_box`.

If `position` is negative then `text` is appended.

This is the same as calling `Gtk.ComboBoxText.insert()`
with a `null` ID string.

**Parameters**

- `position`: An index to insert `text`
- `text`: A string

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `prepend`

```ts
prepend(id: string | null, text: string): void
```

Prepends `text` to the list of strings stored in `combo_box`.

If `id` is non-`null` then it is used as the ID of the row.

This is the same as calling `Gtk.ComboBoxText.insert()`
with a position of 0.

**Parameters**

- `id`: a string ID for this value
- `text`: a string

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `prependText`

```ts
prependText(text: string): void
```

Prepends `text` to the list of strings stored in `combo_box`.

This is the same as calling `Gtk.ComboBoxText.insertText()`
with a position of 0.

**Parameters**

- `text`: A string

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `remove`

```ts
remove(position: number): void
```

Removes the string at `position` from `combo_box`.

**Parameters**

- `position`: Index of the item to remove

> **Deprecated since 4.10.** Use `Gtk.DropDown`

### `removeAll`

```ts
removeAll(): void
```

Removes all the text entries from the combo box.

> **Deprecated since 4.10.** Use `Gtk.DropDown`
