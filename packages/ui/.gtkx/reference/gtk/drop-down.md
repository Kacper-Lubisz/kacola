---
description: "Allows the user to choose an item from a list of options."
---

# GtkDropDown

Allows the user to choose an item from a list of options.



The `GtkDropDown` displays the [selected]`Gtk.DropDown.selected`
choice.

The options are given to `GtkDropDown` in the form of `GListModel`
and how the individual options are represented is determined by
a `Gtk.ListItemFactory`. The default factory displays simple strings,
and adds a checkmark to the selected item in the popup.

To set your own factory, use `Gtk.DropDown.setFactory()`. It is
possible to use a separate factory for the items in the popup, with
`Gtk.DropDown.setListFactory()`.

`GtkDropDown` knows how to obtain strings from the items in a
`Gtk.StringList`; for other models, you have to provide an expression
to find the strings via `Gtk.DropDown.setExpression()`.

`GtkDropDown` can optionally allow search in the popup, which is
useful if the list of options is long. To enable the search entry,
use `Gtk.DropDown.setEnableSearch()`.

Here is a UI definition example for `GtkDropDown` with a simple model:

```xml
<object class="GtkDropDown">
  <property name="model">
    <object class="GtkStringList">
      <items>
        <item translatable="yes">Factory</item>
        <item translatable="yes">Home</item>
        <item translatable="yes">Subway</item>
      </items>
    </object>
  </property>
</object>
```

If a `GtkDropDown` is created in this manner, or with
`Gtk.DropDown.newFromStrings()`, for instance, the object returned from
`Gtk.DropDown.getSelectedItem()` will be a `Gtk.StringObject`.

To learn more about the list widget framework, see the
[overview](section-list-widget.html).

### CSS nodes

`GtkDropDown` has a single CSS node with name dropdown,
with the button and popover nodes as children.

### Accessibility

`GtkDropDown` uses the `Gtk.AccessibleRole.combo_box` role.

```tsx
import { GtkDropDown } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkDropDown**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.DropDown` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableSearch`

`boolean` · default `false`

Whether to show a search entry in the popup.

Note that search requires `Gtk.DropDown.expression`
to be set.

### `expression`

`Gtk.Expression`

An expression to evaluate to obtain strings to match against the search
term.

See `Gtk.DropDown.enableSearch` for how to enable search.
If `Gtk.DropDown.factory` is not set, the expression is also
used to bind strings to labels produced by a default factory.

### `factory`

`Gtk.ListItemFactory | ReactElement`

Factory for populating list items.

### `headerFactory`

`Gtk.ListItemFactory | ReactElement`

The factory for creating header widgets for the popup.

_Available since 4.12._

### `listFactory`

`Gtk.ListItemFactory | ReactElement`

The factory for populating list items in the popup.

If this is not set, `Gtk.DropDown.factory` is used.

### `model`

`Gio.ListModel | ReactElement`

Model for the displayed items.

### `searchMatchMode`

`Gtk.StringFilterMatchMode` · default `GTK_STRING_FILTER_MATCH_MODE_PREFIX`

The match mode for the search filter.

_Available since 4.12._

### `selected`

`number` · default `4294967295`

The position of the selected item.

If no item is selected, the property has the value
`GTK_INVALID_LIST_POSITION`.

### `selectedItem`

`GObject.Object` · read-only, observe with `onNotifySelectedItem`

The selected item.

### `showArrow`

`boolean` · default `true`

Whether to show an arrow within the GtkDropDown widget.

_Available since 4.6._

## Signals

### `onActivate`

```ts
(self: Gtk.DropDown) => void
```

Emitted to when the drop down is activated.

The `::activate` signal on `GtkDropDown` is an action signal and
emitting it causes the drop down to pop up its dropdown.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.6._

## Methods

Methods are called on the `Gtk.DropDown` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEnableSearch`

```ts
getEnableSearch(): boolean
```

Returns whether search is enabled.

**Returns** `true` if the popup includes a search entry

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression set that is used to obtain strings from items.

See `Gtk.DropDown.setExpression()`.

**Returns** a `GtkExpression`

### `getFactory`

```ts
getFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate list items.

The factory returned by this function is always used for the
item in the button. It is also used for items in the popup
if `Gtk.DropDown.listFactory` is not set.

**Returns** The factory in use

### `getHeaderFactory`

```ts
getHeaderFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to create header widgets for the popup.

**Returns** The factory in use

_Available since 4.12._

### `getListFactory`

```ts
getListFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to populate list items in the popup.

**Returns** The factory in use

### `getModel`

```ts
getModel(): Gio.ListModel | null
```

Gets the model that provides the displayed items.

**Returns** The model in use

### `getSearchMatchMode`

```ts
getSearchMatchMode(): Gtk.StringFilterMatchMode
```

Returns the match mode that the search filter is using.

**Returns** the match mode of the search filter

_Available since 4.12._

### `getSelected`

```ts
getSelected(): number
```

Gets the position of the selected item.

**Returns** the position of the selected item, or `GTK_INVALID_LIST_POSITION`
  if no item is selected

### `getSelectedItem`

```ts
getSelectedItem(): GObject.Object | null
```

Gets the selected item. If no item is selected, `null` is returned.

**Returns** The selected item

### `getShowArrow`

```ts
getShowArrow(): boolean
```

Returns whether to show an arrow within the widget.

**Returns** `true` if an arrow will be shown.

_Available since 4.6._

### `setEnableSearch`

```ts
setEnableSearch(enableSearch: boolean): void
```

Sets whether a search entry will be shown in the popup that
allows to search for items in the list.

Note that `Gtk.DropDown.expression` must be set for
search to work.

**Parameters**

- `enableSearch`: whether to enable search

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression that gets evaluated to obtain strings from items.

This is used for search in the popup. The expression must have
a value type of `G_TYPE_STRING`.

**Parameters**

- `expression`: a `GtkExpression`

### `setFactory`

```ts
setFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating list items.

**Parameters**

- `factory`: the factory to use

### `setHeaderFactory`

```ts
setHeaderFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for creating header widgets for the popup.

**Parameters**

- `factory`: the factory to use

_Available since 4.12._

### `setListFactory`

```ts
setListFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the `GtkListItemFactory` to use for populating list items in the popup.

**Parameters**

- `factory`: the factory to use

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the `GListModel` to use.

**Parameters**

- `model`: the model to use

### `setSearchMatchMode`

```ts
setSearchMatchMode(searchMatchMode: Gtk.StringFilterMatchMode): void
```

Sets the match mode for the search filter.

**Parameters**

- `searchMatchMode`: the new match mode

_Available since 4.12._

### `setSelected`

```ts
setSelected(position: number): void
```

Selects the item at the given position.

**Parameters**

- `position`: the position of the item to select, or `GTK_INVALID_LIST_POSITION`

### `setShowArrow`

```ts
setShowArrow(showArrow: boolean): void
```

Sets whether an arrow will be displayed within the widget.

**Parameters**

- `showArrow`: whether to show an arrow within the widget

_Available since 4.6._
