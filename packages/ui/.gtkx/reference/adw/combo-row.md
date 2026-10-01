---
description: "A Gtk.ListBoxRow used to choose from a list of items."
---

# AdwComboRow

A `Gtk.ListBoxRow` used to choose from a list of items.



The `AdwComboRow` widget allows the user to choose from a list of valid
choices. The row displays the selected choice. When activated, the row
displays a popover which allows the user to make a new choice.

Example of an `AdwComboRow` UI definition:
```xml
<object class="AdwComboRow">
  <property name="title" translatable="yes">Combo Row</property>
  <property name="model">
    <object class="GtkStringList">
      <items>
        <item translatable="yes">Foo</item>
        <item translatable="yes">Bar</item>
        <item translatable="yes">Baz</item>
      </items>
    </object>
  </property>
</object>
```

The `ComboRow.selected` and `ComboRow.selectedItem`
properties can be used to keep track of the selected item and react to their
changes.

`AdwComboRow` mirrors `Gtk.DropDown`, see that widget for details.

`AdwComboRow` is `Gtk.ListBoxRow.activatable` if a model is set.

### CSS nodes

`AdwComboRow` has a main CSS node with name `row` and the `.combo` style
class.

Its popover has the node named `popover` with the `.menu` style class, it
contains a `Gtk.ScrolledWindow`, which in turn contains a
`Gtk.ListView`, both are accessible via their regular nodes.

### Accessibility

`AdwComboRow` uses the `Gtk.AccessibleRole.combo-box` role.

```tsx
import { AdwComboRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → [AdwActionRow](.gtkx/reference/adw/action-row.md) → **AdwComboRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ComboRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enableSearch`

`boolean` · default `false`

Whether to show a search entry in the popup.

If set to `TRUE`, a search entry will be shown in the popup that
allows to search for items in the list.

Search requires `ComboRow.expression` to be set.

_Available since 1.4._

### `expression`

`Gtk.Expression`

An expression used to obtain strings from items.

The expression must have a value type of `G_TYPE_STRING`.

It's used to bind strings to labels produced by the default factory if
`ComboRow.factory` is not set, or when
`ComboRow.useSubtitle` is set to `TRUE`.

### `factory`

`Gtk.ListItemFactory | ReactElement`

Factory for populating list items.

This factory is always used for the item in the row. It is also used for
items in the popup unless `ComboRow.listFactory` is set.

### `headerFactory`

`Gtk.ListItemFactory | ReactElement`

The factory for creating header widgets for the popup.

_Available since 1.6._

### `listFactory`

`Gtk.ListItemFactory | ReactElement`

The factory for populating list items in the popup.

If this is not set, `ComboRow.factory` is used.

### `model`

`Gio.ListModel | ReactElement`

The model that provides the displayed items.

### `searchMatchMode`

`Gtk.StringFilterMatchMode` · default `GTK_STRING_FILTER_MATCH_MODE_PREFIX`

The match mode for the search filter.

_Available since 1.6._

### `selected`

`number` · default `4294967295`

The position of the selected item.

If no item is selected, the property has the value
`Gtk.INVALID_LIST_POSITION`

### `selectedItem`

`GObject.Object` · read-only, observe with `onNotifySelectedItem`

The selected item.

### `useSubtitle`

`boolean` · default `false`

Whether to use the current value as the subtitle.

If you use a custom list item factory, you will need to give the row a
name conversion expression with `ComboRow.expression`.

If set to `TRUE`, you should not access `ActionRow.subtitle`.

The subtitle is interpreted as Pango markup if
`PreferencesRow.useMarkup` is set to `TRUE`.

## Methods

Methods are called on the `Adw.ComboRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getEnableSearch`

```ts
getEnableSearch(): boolean
```

Gets whether search is enabled.

If set to `TRUE`, a search entry will be shown in the popup that
allows to search for items in the list.

Search requires `ComboRow.expression` to be set.

**Returns** whether the popup includes a search entry

_Available since 1.4._

### `getExpression`

```ts
getExpression(): Gtk.Expression | null
```

Gets the expression used to obtain strings from items.

**Returns** the expression used to obtain strings from items

### `getFactory`

```ts
getFactory(): Gtk.ListItemFactory | null
```

Gets the factory for populating list items.

**Returns** the factory in use

### `getHeaderFactory`

```ts
getHeaderFactory(): Gtk.ListItemFactory | null
```

Gets the factory that's currently used to create header widgets for the popup.

**Returns** The factory in use

_Available since 1.6._

### `getListFactory`

```ts
getListFactory(): Gtk.ListItemFactory | null
```

Gets the factory for populating list items in the popup.

**Returns** the factory in use

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

_Available since 1.6._

### `getSelected`

```ts
getSelected(): number
```

Gets the position of the selected item.

**Returns** the position of the selected item, or
  `Gtk.INVALID_LIST_POSITION` if no item is selected

### `getSelectedItem`

```ts
getSelectedItem(): GObject.Object | null
```

Gets the selected item.

**Returns** the selected item

### `getUseSubtitle`

```ts
getUseSubtitle(): boolean
```

Gets whether to use the current value as the subtitle.

**Returns** whether to use the current value as the subtitle

### `setEnableSearch`

```ts
setEnableSearch(enableSearch: boolean): void
```

Sets whether to enable search.

If set to `TRUE`, a search entry will be shown in the popup that
allows to search for items in the list.

Search requires `ComboRow.expression` to be set.

**Parameters**

- `enableSearch`: whether to enable search

_Available since 1.4._

### `setExpression`

```ts
setExpression(expression: Gtk.Expression | null): void
```

Sets the expression used to obtain strings from items.

The expression must have a value type of `G_TYPE_STRING`.

It's used to bind strings to labels produced by the default factory if
`ComboRow.factory` is not set, or when
`ComboRow.useSubtitle` is set to `TRUE`.

**Parameters**

- `expression`: an expression

### `setFactory`

```ts
setFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the factory for populating list items.

This factory is always used for the item in the row. It is also used for
items in the popup unless `ComboRow.listFactory` is set.

**Parameters**

- `factory`: the factory to use

### `setHeaderFactory`

```ts
setHeaderFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the factory to use for creating header widgets for the popup.

**Parameters**

- `factory`: the factory to use

_Available since 1.6._

### `setListFactory`

```ts
setListFactory(factory: Gtk.ListItemFactory | null): void
```

Sets the factory for populating list items in the popup.

If this is not set, `ComboRow.factory` is used.

**Parameters**

- `factory`: the factory to use

### `setModel`

```ts
setModel(model: Gio.ListModel | null): void
```

Sets the model that provides the displayed items.

**Parameters**

- `model`: the model to use

### `setSearchMatchMode`

```ts
setSearchMatchMode(searchMatchMode: Gtk.StringFilterMatchMode): void
```

Sets the match mode for the search filter.

**Parameters**

- `searchMatchMode`: the new match mode

_Available since 1.6._

### `setSelected`

```ts
setSelected(position: number): void
```

Selects the item at the given position.

**Parameters**

- `position`: the position of the item to select, or `Gtk.INVALID_LIST_POSITION`

### `setUseSubtitle`

```ts
setUseSubtitle(useSubtitle: boolean): void
```

Sets whether to use the current value as the subtitle.

If you use a custom list item factory, you will need to give the row a
name conversion expression with `ComboRow.expression`.

If set to `TRUE`, you should not access `ActionRow.subtitle`.

The subtitle is interpreted as Pango markup if
`PreferencesRow.useMarkup` is set to `TRUE`.

**Parameters**

- `useSubtitle`: whether to use the current value as the subtitle
