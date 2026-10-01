---
description: "Configures how rows are displayed in a Gtk.ColumnView."
---

# GtkColumnViewRow

Configures how rows are displayed in a `Gtk.ColumnView`.

It is not used to set the widgets displayed in the individual cells. For that
see `GtkColumnViewColumn.setFactory()` and `GtkColumnViewCell`.

_Available since 4.12._

```tsx
import { GtkColumnViewRow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkColumnViewRow**

## Props

`ref` receives the `Gtk.ColumnViewRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleDescription`

`string` · default `null`

The accessible description to set on the row.

_Available since 4.12._

### `accessibleLabel`

`string` · default `null`

The accessible label to set on the row.

_Available since 4.12._

### `activatable`

`boolean` · default `true`

If the row can be activated by the user.

_Available since 4.12._

### `focusable`

`boolean` · default `true`

If the row can be focused with the keyboard.

_Available since 4.12._

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

The item for this row.

_Available since 4.12._

### `position`

`number` · default `4294967295` · read-only, observe with `onNotifyPosition`

Position of the row.

_Available since 4.12._

### `selectable`

`boolean` · default `true`

If the row can be selected by the user.

_Available since 4.12._

### `selected`

`boolean` · default `false` · read-only, observe with `onNotifySelected`

If the item in the row is currently selected.

_Available since 4.12._

## Methods

Methods are called on the `Gtk.ColumnViewRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAccessibleDescription`

```ts
getAccessibleDescription(): string
```

Gets the accessible description of `self`.

**Returns** the accessible description

_Available since 4.12._

### `getAccessibleLabel`

```ts
getAccessibleLabel(): string
```

Gets the accessible label of `self`.

**Returns** the accessible label

_Available since 4.12._

### `getActivatable`

```ts
getActivatable(): boolean
```

Checks if the row has been set to be activatable via
`gtk_column_view_row_set_activatable()`.

**Returns** `true` if the row is activatable

_Available since 4.12._

### `getFocusable`

```ts
getFocusable(): boolean
```

Checks if a row item has been set to be focusable via
`gtk_column_view_row_set_focusable()`.

**Returns** `true` if the row is focusable

_Available since 4.12._

### `getItem`

```ts
getItem(): GObject.Object | null
```

Gets the model item that associated with `self`.

If `self` is unbound, this function returns `null`.

**Returns** The item displayed

_Available since 4.12._

### `getPosition`

```ts
getPosition(): number
```

Gets the position in the model that `self` currently displays.

If `self` is unbound, `GTK_INVALID_LIST_POSITION` is returned.

**Returns** The position of this row

_Available since 4.12._

### `getSelectable`

```ts
getSelectable(): boolean
```

Checks if the row has been set to be selectable via
`gtk_column_view_row_set_selectable()`.

Do not confuse this function with `Gtk.ColumnViewRow.getSelected()`.

**Returns** `true` if the row is selectable

_Available since 4.12._

### `getSelected`

```ts
getSelected(): boolean
```

Checks if the item is selected that this row corresponds to.

The selected state is maintained by the list widget and its model
and cannot be set otherwise.

**Returns** `true` if the item is selected.

_Available since 4.12._

### `setAccessibleDescription`

```ts
setAccessibleDescription(description: string): void
```

Sets the accessible description for the row,
which may be used by e.g. screen readers.

**Parameters**

- `description`: the description

_Available since 4.12._

### `setAccessibleLabel`

```ts
setAccessibleLabel(label: string): void
```

Sets the accessible label for the row,
which may be used by e.g. screen readers.

**Parameters**

- `label`: the label

_Available since 4.12._

### `setActivatable`

```ts
setActivatable(activatable: boolean): void
```

Sets `self` to be activatable.

If a row is activatable, double-clicking on the row, using
the Return key or calling `gtk_widget_activate()` will activate
the row. Activating instructs the containing columnview to
emit the `Gtk.ColumnView.activate` signal.

By default, row are activatable.

**Parameters**

- `activatable`: if the row should be activatable

_Available since 4.12._

### `setFocusable`

```ts
setFocusable(focusable: boolean): void
```

Sets `self` to be focusable.

If a row is focusable, it can be focused using the keyboard.
This works similar to `Gtk.Widget.setFocusable()`.

Note that if row are not focusable, the contents of cells can still be focused if
they are focusable.

By default, rows are focusable.

**Parameters**

- `focusable`: if the row should be focusable

_Available since 4.12._

### `setSelectable`

```ts
setSelectable(selectable: boolean): void
```

Sets `self` to be selectable.

If a row is selectable, clicking on the row or using the keyboard
will try to select or unselect the row. Whether this succeeds is up to
the model to determine, as it is managing the selected state.

Note that this means that making a row non-selectable has no
influence on the selected state at all. A non-selectable row
may still be selected.

By default, rows are selectable.

**Parameters**

- `selectable`: if the row should be selectable

_Available since 4.12._
